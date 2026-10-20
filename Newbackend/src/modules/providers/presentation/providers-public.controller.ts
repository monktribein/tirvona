import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { ProviderAvailabilityService } from "../application/provider-availability.service";
import { ProviderDiscoveryService } from "../application/provider-discovery.service";
import { ProviderOfferingService } from "../application/provider-offering.service";
import { ProviderProfileService } from "../application/provider-profile.service";
import { RitualCatalogService } from "../application/ritual-catalog.service";
import { RitualSearchQueryDto } from "./dto/catalog.dto";
import {
  AvailabilityQueryDto,
  ThirtyDayCalendarQueryDto,
  ProviderSearchQueryDto,
  PublicOfferingsQueryDto,
} from "./dto/provider.dto";
import { IdOrSlugPipe } from "./object-id.pipe";

/** Public ritual catalogue: published content only. */
@Controller({ path: "rituals", version: "2" })
export class RitualsPublicController {
  constructor(private readonly catalogue: RitualCatalogService) {}

  @Public() @Get()
  search(@Query() query: RitualSearchQueryDto) {
    return this.catalogue.listPublic(query);
  }

  @Public() @Get(":ritualId")
  one(@Param("ritualId", IdOrSlugPipe) ritualId: string) {
    return this.catalogue.getPublic(ritualId);
  }

  @Public() @Get(":ritualId/variants")
  variants(@Param("ritualId", IdOrSlugPipe) ritualId: string) {
    return this.catalogue.listPublicVariants(ritualId);
  }
}

/**
 * Public provider directory. Anonymous callers see only providers that are
 * ACTIVE, verified and listed; there is no way to reach a private profile,
 * KYC, contact or calendar detail from here.
 */
@Controller({ path: "providers", version: "2" })
export class ProvidersPublicController {
  constructor(
    private readonly discovery: ProviderDiscoveryService,
    private readonly profiles: ProviderProfileService,
    private readonly offerings: ProviderOfferingService,
    private readonly availability: ProviderAvailabilityService,
  ) {}

  @Public() @Get()
  search(@Query() query: ProviderSearchQueryDto) {
    return this.discovery.search(query);
  }

  @Public() @Get(":providerId")
  one(@Param("providerId", IdOrSlugPipe) providerId: string) {
    return this.profiles.getPublic(providerId);
  }

  @Public() @Get(":providerId/offerings")
  offeringsOf(
    @Param("providerId", IdOrSlugPipe) providerId: string,
    @Query() query: PublicOfferingsQueryDto,
  ) {
    return this.offerings.listPublic(providerId, query);
  }

  /** OpenAPI: Authenticated. Free windows only; never who or why a time is held. */
  @Get(":providerId/availability")
  availabilityOf(
    @CurrentUser() user: AuthenticatedUser,
    @Param("providerId", IdOrSlugPipe) providerId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availability.query(user, providerId, query);
  }

  @Public()
  @Get(":providerId/calendar-30-days")
  thirtyDayCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param("providerId", IdOrSlugPipe) providerId: string,
    @Query() query: ThirtyDayCalendarQueryDto,
  ) {
    return this.availability.getThirtyDayCalendar(user, providerId, query);
  }
}
