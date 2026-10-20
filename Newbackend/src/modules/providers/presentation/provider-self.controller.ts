import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { ProviderAvailabilityService } from "../application/provider-availability.service";
import { ProviderBookingService } from "../application/provider-booking.service";
import { ProviderConsultationService } from "../application/provider-consultation.service";
import { ProviderOfferingService } from "../application/provider-offering.service";
import { ProviderProfileService } from "../application/provider-profile.service";
import { Idempotent } from "../infrastructure/idempotency.interceptor";
import { ConsultationListQueryDto } from "./dto/booking.dto";
import {
  ThirtyDayCalendarQueryDto,
  CalendarQueryDto,
  CreateCalendarBlockDto,
  CreateOfferingDto,
  CreateProviderProfileDto,
  LiveOnlineDto,
  ProviderStatusDto,
  PutAvailabilityRulesDto,
  UpdateOfferingDto,
  UpdateProviderProfileDto,
} from "./dto/provider.dto";
import { ObjectIdPipe } from "./object-id.pipe";
import { ProviderApi } from "./provider-api.decorator";

/**
 * Everything a provider does to their own account. Authorization is
 * ownership: each handler resolves the provider from the signed-in user's id
 * (the JWT), never from an id, role or provider reference sent by the client.
 */
@ProviderApi()
@Controller({ path: "provider", version: "2" })
export class ProviderSelfController {
  constructor(
    private readonly profiles: ProviderProfileService,
    private readonly offerings: ProviderOfferingService,
    private readonly availability: ProviderAvailabilityService,
    private readonly bookings: ProviderBookingService,
    private readonly consultations: ProviderConsultationService,
  ) {}

  // ---------------------------------------------------------------- profile
  @Post("profile")
  @Idempotent("provider.profile.create", { sensitive: true })
  createProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProviderProfileDto) {
    return this.profiles.create(user, dto);
  }

  @Get("profile")
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getOwn(user);
  }

  @Patch("profile")
  @Idempotent("provider.profile.update", { sensitive: true })
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProviderProfileDto) {
    return this.profiles.update(user, dto);
  }

  /** Go live (needs verified identity) or step back to inactive. Suspension is admin-only. */
  @Patch("profile/status")
  @Idempotent("provider.profile.status", { sensitive: true })
  status(@CurrentUser() user: AuthenticatedUser, @Body() dto: ProviderStatusDto) {
    return this.profiles.setOwnStatus(user, dto.status as "ACTIVE" | "INACTIVE");
  }

  /** "Live online available" switch on the dashboard. */
  @Patch("profile/live")
  @Idempotent("provider.profile.live")
  setLive(@CurrentUser() user: AuthenticatedUser, @Body() dto: LiveOnlineDto) {
    return this.profiles.setLiveOnline(user, dto.enabled, dto.youtubeUrl);
  }

  // -------------------------------------------------------------- offerings
  @Get("offerings")
  listOfferings(@CurrentUser() user: AuthenticatedUser, @Query("status") status?: string) {
    return this.offerings.listOwn(user, status);
  }

  @Post("offerings")
  @Idempotent("provider.offering.create")
  createOffering(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOfferingDto) {
    return this.offerings.create(user, dto);
  }

  @Get("offerings/:offeringId")
  offering(
    @CurrentUser() user: AuthenticatedUser,
    @Param("offeringId", ObjectIdPipe) offeringId: string,
  ) {
    return this.offerings.getOwn(user, offeringId);
  }

  @Patch("offerings/:offeringId")
  @Idempotent("provider.offering.update")
  updateOffering(
    @CurrentUser() user: AuthenticatedUser,
    @Param("offeringId", ObjectIdPipe) offeringId: string,
    @Body() dto: UpdateOfferingDto,
  ) {
    return this.offerings.update(user, offeringId, dto);
  }

  // ----------------------------------------------------------- availability
  @Get("availability-rules")
  rules(@CurrentUser() user: AuthenticatedUser) {
    return this.availability.getOwnRules(user);
  }

  @Put("availability-rules")
  @Idempotent("provider.availability.put")
  putRules(@CurrentUser() user: AuthenticatedUser, @Body() dto: PutAvailabilityRulesDto) {
    return this.availability.putRules(user, dto);
  }

  @Get("calendar-blocks")
  blocks(@CurrentUser() user: AuthenticatedUser, @Query() query: CalendarQueryDto) {
    return this.availability.listBlocks(user, query);
  }

  @Post("calendar-blocks")
  @Idempotent("provider.calendar.create")
  createBlock(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCalendarBlockDto) {
    return this.availability.createBlock(user, dto);
  }

  @Delete("calendar-blocks/:blockId")
  @Idempotent("provider.calendar.release")
  releaseBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param("blockId", ObjectIdPipe) blockId: string,
  ) {
    return this.availability.releaseBlock(user, blockId);
  }

  @Get("calendar-30-days")
  thirtyDayCalendar(@CurrentUser() user: AuthenticatedUser, @Query() query: ThirtyDayCalendarQueryDto) {
    return this.availability.getOwnThirtyDayCalendar(user, query);
  }

  // ------------------------------------------------- operations dashboards
  /** Booking counters and the next booking. The full list is GET /bookings?role=provider. */
  @Get("bookings/summary")
  bookingSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.bookings.summary(user);
  }

  @Get("consultations")
  consultationQueue(@CurrentUser() user: AuthenticatedUser, @Query() query: ConsultationListQueryDto) {
    return this.consultations.listForExpert(user, query);
  }
}
