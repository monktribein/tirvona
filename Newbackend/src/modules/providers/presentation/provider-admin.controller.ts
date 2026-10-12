import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { ProviderBookingService } from "../application/provider-booking.service";
import { ProviderConsultationService } from "../application/provider-consultation.service";
import { ProviderIntegrityService } from "../application/provider-integrity.service";
import { ProviderOfferingService } from "../application/provider-offering.service";
import { ProviderProfileService } from "../application/provider-profile.service";
import { RitualCatalogService } from "../application/ritual-catalog.service";
import { Idempotent } from "../infrastructure/idempotency.interceptor";
import { BookingListQueryDto, ConsultationListQueryDto } from "./dto/booking.dto";
import {
  AdminRitualQueryDto,
  CreateRitualDto,
  CreateRitualVariantDto,
  RitualProcessDto,
  RitualWorkflowDto,
  UpdateRitualDto,
  UpdateRitualVariantDto,
} from "./dto/catalog.dto";
import {
  AdminCreateProviderDto,
  AdminOfferingQueryDto,
  AdminOfferingStatusDto,
  AdminUpdateProviderDto,
  ProviderAdminActionDto,
} from "./dto/provider.dto";
import { AdminProviderQueryDto } from "./dto/verification.dto";
import { ObjectIdPipe } from "./object-id.pipe";
import { ProviderApi } from "./provider-api.decorator";

/** Content roles: `content_manager` authors and reviews (with maker-checker); `super_admin` can do everything. */
const CONTENT = ["content_manager", "super_admin"] as const;

/** Ritual catalogue administration (SRS M06). Draft -> review -> approve -> publish, with a second person approving. */
@ProviderApi()
@Roles(...CONTENT)
@Controller({ path: "admin/rituals", version: "2" })
export class AdminRitualsController {
  constructor(private readonly catalogue: RitualCatalogService) {}

  @Get()
  list(@Query() query: AdminRitualQueryDto) {
    return this.catalogue.list(query);
  }

  @Post()
  @Idempotent("ritual.create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRitualDto) {
    return this.catalogue.create(user, dto);
  }

  /** Puja process guide (before / during / after). Live for devotees and pandits as soon as it is saved. */
  @Put(":ritualId/process")
  @Idempotent("ritual.process")
  setProcess(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ritualId", ObjectIdPipe) ritualId: string,
    @Body() dto: RitualProcessDto,
  ) {
    return this.catalogue.setProcess(user, ritualId, dto);
  }

  @Get(":ritualId")
  one(@Param("ritualId", ObjectIdPipe) ritualId: string) {
    return this.catalogue.get(ritualId);
  }

  @Patch(":ritualId")
  @Idempotent("ritual.update")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ritualId", ObjectIdPipe) ritualId: string,
    @Body() dto: UpdateRitualDto,
  ) {
    return this.catalogue.update(user, ritualId, dto);
  }

  @Post(":ritualId\\:submit-review")
  @Idempotent("ritual.submit_review")
  submit(@CurrentUser() user: AuthenticatedUser, @Param("ritualId", ObjectIdPipe) ritualId: string) {
    return this.catalogue.submitReview(user, ritualId);
  }

  @Post(":ritualId\\:approve")
  @Idempotent("ritual.approve")
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ritualId", ObjectIdPipe) ritualId: string,
    @Body() dto: RitualWorkflowDto,
  ) {
    return this.catalogue.approve(user, ritualId, dto.note);
  }

  @Post(":ritualId\\:publish")
  @Idempotent("ritual.publish")
  publish(@CurrentUser() user: AuthenticatedUser, @Param("ritualId", ObjectIdPipe) ritualId: string) {
    return this.catalogue.publish(user, ritualId);
  }

  /** Reviewer sends content back, or an editor starts the next version of published content. */
  @Post(":ritualId\\:revise")
  @Idempotent("ritual.revise")
  revise(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ritualId", ObjectIdPipe) ritualId: string,
    @Body() dto: RitualWorkflowDto,
  ) {
    return this.catalogue.revise(user, ritualId, dto.note);
  }

  @Post(":ritualId\\:archive")
  @Idempotent("ritual.archive")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ritualId", ObjectIdPipe) ritualId: string,
    @Body() dto: RitualWorkflowDto,
  ) {
    return this.catalogue.archive(user, ritualId, dto.note);
  }

  @Post(":ritualId/variants")
  @Idempotent("ritual.variant.create")
  createVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ritualId", ObjectIdPipe) ritualId: string,
    @Body() dto: CreateRitualVariantDto,
  ) {
    return this.catalogue.createVariant(user, ritualId, dto);
  }
}

@ProviderApi()
@Roles(...CONTENT)
@Controller({ path: "admin/ritual-variants", version: "2" })
export class AdminRitualVariantsController {
  constructor(private readonly catalogue: RitualCatalogService) {}

  @Patch(":variantId")
  @Idempotent("ritual.variant.update")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("variantId", ObjectIdPipe) variantId: string,
    @Body() dto: UpdateRitualVariantDto,
  ) {
    return this.catalogue.updateVariant(user, variantId, dto);
  }
}

/** Provider oversight. Reading a provider's private profile is restricted and audited. */
@ProviderApi()
@Controller({ path: "admin/providers", version: "2" })
export class AdminProvidersController {
  constructor(
    private readonly profiles: ProviderProfileService,
    private readonly integrity: ProviderIntegrityService,
  ) {}

  @Roles("service_manager", "super_admin")
  @Get("overview")
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.overview(user);
  }

  @Roles("verification_reviewer", "service_manager", "super_admin")
  @Get()
  list(@Query() query: AdminProviderQueryDto) {
    return this.profiles.listAdmin(query);
  }

  @Roles("super_admin")
  @Post()
  @Idempotent("provider.admin.create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdminCreateProviderDto) {
    return this.profiles.createAdmin(user, dto);
  }

  /** Read-only referential-integrity report. Declared before :providerId so it is not read as an id. */
  @Roles("super_admin")
  @Get("integrity")
  integrityReport() {
    return this.integrity.check().then((report) => ({ success: true, data: report }));
  }

  @Roles("verification_reviewer", "super_admin")
  @Get(":providerId")
  one(@CurrentUser() user: AuthenticatedUser, @Param("providerId", ObjectIdPipe) providerId: string) {
    return this.profiles.getAdmin(user, providerId);
  }

  @Roles("service_manager", "super_admin")
  @Patch(":providerId")
  @Idempotent("provider.admin.update")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("providerId", ObjectIdPipe) providerId: string,
    @Body() dto: AdminUpdateProviderDto,
  ) {
    return this.profiles.updateAdmin(user, providerId, dto);
  }

  @Roles("service_manager", "super_admin")
  @Post(":providerId\\:suspend")
  @Idempotent("provider.suspend")
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param("providerId", ObjectIdPipe) providerId: string,
    @Body() dto: ProviderAdminActionDto,
  ) {
    return this.profiles.suspend(user, providerId, dto);
  }

  @Roles("service_manager", "super_admin")
  @Post(":providerId\\:reinstate")
  @Idempotent("provider.reinstate")
  reinstate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("providerId", ObjectIdPipe) providerId: string,
    @Body() dto: ProviderAdminActionDto,
  ) {
    return this.profiles.reinstate(user, providerId, dto);
  }
}

/** Operations queue across all providers. Row data carries no contact or address; open a booking for those. */
@ProviderApi()
@Roles("service_manager", "super_admin")
@Controller({ path: "admin/provider-bookings", version: "2" })
export class AdminProviderBookingsController {
  constructor(private readonly bookings: ProviderBookingService) {}

  @Get()
  list(@Query() query: BookingListQueryDto) {
    return this.bookings.listAll(query);
  }
}

/** Super Admin & ops management for provider puja offerings. */
@ProviderApi()
@Roles("service_manager", "super_admin")
@Controller({ path: "admin/offerings", version: "2" })
export class AdminOfferingsController {
  constructor(private readonly offerings: ProviderOfferingService) {}

  @Get()
  list(@Query() query: AdminOfferingQueryDto) {
    return this.offerings.listAdmin(query);
  }

  @Patch(":offeringId/status")
  @Idempotent("offering.admin.status")
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("offeringId", ObjectIdPipe) offeringId: string,
    @Body() body: AdminOfferingStatusDto,
  ) {
    return this.offerings.setStatusAdmin(user, offeringId, body.status);
  }
}

/** Super Admin & ops management for provider consultations. */
@ProviderApi()
@Roles("service_manager", "super_admin")
@Controller({ path: "admin/consultations", version: "2" })
export class AdminConsultationsController {
  constructor(private readonly consultations: ProviderConsultationService) {}

  @Get()
  list(@Query() query: ConsultationListQueryDto) {
    return this.consultations.listAdmin(query);
  }
}
