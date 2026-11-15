import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { type AuthenticatedUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { DOCUMENT_MAX_BYTES, YATRA_ADMIN_ROLES, YATRA_FINANCE_ROLES, YATRA_OPS_ROLES } from "../domain/yatra.constants";
import { YatraFinanceService } from "../application/yatra-finance.service";
import { YatraInsightsService } from "../application/yatra-insights.service";
import { YatraOpsService } from "../application/yatra-ops.service";
import { YatraRideService } from "../application/yatra-ride.service";
import { ConfirmPaymentDto, PayoutDetailsDto, ReasonDto, SubmitOperatorDto, UploadDocumentDto } from "./yatra.dto";
import {
  AdjustmentDto,
  AdminRideCancelDto,
  AssignRidePartnerDto,
  CommissionRuleDto,
  FinancePayoutRequestDto,
  IssueQueryDto,
  IssueReportDto,
  IssueUpdateDto,
  OpsIssueDto,
  OpsQueryDto,
  OpsReportDto,
  OptionalRangeDto,
  PartnerReviewDto,
  PayeeTypeQueryDto,
  PayoutQueryDto,
  PayoutRequestDto,
  PayoutReviewDto,
  ReconcilePayoutDto,
  ReconRunDto,
  RegisterRidePartnerDto,
  ReportRangeDto,
  RideAcceptDto,
  RidePartnerQueryDto,
  RideQueryDto,
  RideRequestDto,
  RideVehiclesDto,
  RuleQueryDto,
  TransferDto,
  UpdateRidePartnerDto,
} from "./yatra-p5.dto";
import { PaginationDto } from "./yatra.dto";
import { EntityIdPipe, ok, paged, YatraEnabledGuard, YatraWriteThrottle } from "./yatra-http";

const proofUpload = FileInterceptor("proof", { storage: memoryStorage(), limits: { fileSize: DOCUMENT_MAX_BYTES } });
const docUpload = FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: DOCUMENT_MAX_BYTES } });

/** Ride partner console. Every call is scoped to the partner the caller owns. */
@ApiTags("Yatra · Ride Partner")
@ApiBearerAuth()
@UseGuards(YatraEnabledGuard)
@Controller("v1/yatra/ride-partner")
export class YatraRidePartnerController {
  constructor(
    private readonly rides: YatraRideService,
    private readonly finance: YatraFinanceService,
  ) {}

  private async payeeId(user: AuthenticatedUser): Promise<string> {
    return this.rides.partnerIdOf(user);
  }

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.rides.me(user));
  }

  @Post("register")
  @YatraWriteThrottle(5, 3_600_000)
  async register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterRidePartnerDto) {
    return ok(await this.rides.register(user, dto), "Registered. Add your vehicles and documents, then submit for approval.");
  }

  @Patch("profile")
  async profile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateRidePartnerDto) {
    return ok(await this.rides.updateProfile(user, dto), "Profile saved.");
  }

  @Put("vehicles")
  async vehicles(@CurrentUser() user: AuthenticatedUser, @Body() dto: RideVehiclesDto) {
    return ok(await this.rides.setVehicles(user, dto.vehicles), "Vehicles saved.");
  }

  @Put("payout")
  async payout(@CurrentUser() user: AuthenticatedUser, @Body() dto: PayoutDetailsDto) {
    return ok(await this.rides.setPayout(user, dto), "Payout details saved.");
  }

  @Post("submit")
  async submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitOperatorDto) {
    return ok(await this.rides.submit(user, dto.acceptTerms), "Submitted to Tirvona for approval.");
  }

  @Get("documents")
  async documents(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.rides.listDocuments(user));
  }

  @Post("documents")
  @YatraWriteThrottle(30, 900_000)
  @UseInterceptors(docUpload)
  async upload(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File, @Body() dto: UploadDocumentDto) {
    return ok(await this.rides.uploadDocument(user, file, dto), "Uploaded privately for verification.");
  }

  @Get("documents/:id/link")
  async documentLink(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.rides.documentLink(user, id));
  }

  @Delete("documents/:id")
  async deleteDocument(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.rides.deleteDocument(user, id));
  }

  @Get("requests")
  async requests(@CurrentUser() user: AuthenticatedUser, @Query("tab") tab?: string) {
    return ok(await this.rides.partnerRequests(user, tab));
  }

  @Post("requests/:id/accept")
  async accept(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: RideAcceptDto) {
    return ok(await this.rides.partnerAccept(user, id, dto), "Accepted. The pilgrim will be asked to pay.");
  }

  @Post("requests/:id/reject")
  async reject(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReasonDto) {
    return ok(await this.rides.partnerReject(user, id, dto.reason), "Declined.");
  }

  @Post("requests/:id/start")
  async start(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.rides.partnerStart(user, id), "Ride started.");
  }

  @Post("requests/:id/complete")
  async complete(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.rides.partnerComplete(user, id), "Ride completed.");
  }

  @Post("requests/:id/cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReasonDto) {
    return ok(await this.rides.partnerCancel(user, id, dto.reason), "Ride cancelled; the pilgrim is refunded in full.");
  }

  @Post("requests/:id/issues")
  @YatraWriteThrottle(10, 600_000)
  async issue(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: IssueReportDto) {
    return ok(await this.rides.reportIssue(user, id, dto, "partner"), "Issue reported to Tirvona.");
  }

  @Get("earnings")
  async earnings(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    const payeeId = await this.payeeId(user);
    const [summary, statement] = await Promise.all([this.finance.summary("ride_partner", payeeId), this.finance.statement("ride_partner", payeeId, query.page, query.limit)]);
    return { ...paged(statement, query.page, query.limit), summary };
  }

  @Get("payouts")
  async payouts(@CurrentUser() user: AuthenticatedUser) {
    const payeeId = await this.payeeId(user);
    return ok((await this.finance.listPayouts({ payeeType: "ride_partner", payeeId, page: 1, limit: 100 })).items);
  }

  @Post("payouts")
  @YatraWriteThrottle(10, 3_600_000)
  async requestPayout(@CurrentUser() user: AuthenticatedUser, @Body() dto: PayoutRequestDto) {
    return ok(await this.finance.requestPayout(user, "ride_partner", await this.payeeId(user), dto.amount, dto.note), "Payout requested.");
  }

  @Post("payouts/:id/cancel")
  async cancelPayout(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.finance.cancelPayout(user, id, { payeeType: "ride_partner", payeeId: await this.payeeId(user) }));
  }

  @Get("payouts/:id/proof")
  async proof(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.finance.proofLink(id, { payeeType: "ride_partner", payeeId: await this.payeeId(user) }));
  }
}

/** Pilgrim rides and issue reports inside the Journey Hub. */
@ApiTags("Yatra · Pilgrim rides")
@ApiBearerAuth()
@UseGuards(YatraEnabledGuard)
@Controller("v1/yatra")
export class YatraRideCustomerController {
  constructor(private readonly rides: YatraRideService) {}

  @Get("ride-partners")
  async partners(@Query("city") city = "") {
    return ok(await this.rides.availablePartners(city));
  }

  @Get("journeys/:id/rides")
  async list(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.rides.journeyRides(user, id));
  }

  @Post("journeys/:id/rides")
  @YatraWriteThrottle(20, 600_000)
  async request(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: RideRequestDto) {
    return ok(await this.rides.requestRide(user, id, dto), "Ride requested.");
  }

  @Post("journeys/:id/issues")
  @YatraWriteThrottle(10, 600_000)
  async journeyIssue(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: IssueReportDto) {
    return ok(await this.rides.reportJourneyIssue(user, id, dto), "Issue reported to Tirvona.");
  }

  @Post("rides/:id/cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReasonDto) {
    return ok(await this.rides.customerCancel(user, id, dto.reason), "Ride cancelled.");
  }

  @Post("rides/:id/payment-order")
  @YatraWriteThrottle(30, 600_000)
  async order(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.rides.rideOrder(user, id));
  }

  @Post("rides/:id/confirm-payment")
  async confirm(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ConfirmPaymentDto) {
    return ok(await this.rides.rideConfirm(user, id, dto), "Payment verified. Your ride is confirmed.");
  }

  @Post("rides/:id/issues")
  @YatraWriteThrottle(10, 600_000)
  async issue(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: IssueReportDto) {
    return ok(await this.rides.reportIssue(user, id, dto, "customer"), "Issue reported to Tirvona.");
  }
}

/** Organiser payout requests (own organiser only). */
@ApiTags("Yatra · Organiser")
@ApiBearerAuth()
@UseGuards(YatraEnabledGuard)
@Controller("v1/yatra/operator")
export class YatraOperatorPayoutController {
  constructor(private readonly insights: YatraInsightsService) {}

  @Post("payouts")
  @YatraWriteThrottle(10, 3_600_000)
  async request(@CurrentUser() user: AuthenticatedUser, @Body() dto: PayoutRequestDto) {
    return ok(await this.insights.requestPayout(user, dto.amount, dto.note), "Payout requested. Tirvona Finance will review it.");
  }

  @Post("payouts/:id/cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.insights.cancelPayout(user, id), "Payout request cancelled.");
  }

  @Get("payouts/:id/proof")
  async proof(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.insights.payoutProof(user, id));
  }
}

/**
 * Finance: commission rules, payables, manual payouts, reports and Razorpay
 * settlement reconciliation. Super Admin and Finance Manager only. Nothing
 * here starts a bank transfer.
 */
@ApiTags("Yatra · Finance")
@ApiBearerAuth()
@Roles(...YATRA_FINANCE_ROLES)
@UseGuards(YatraEnabledGuard)
@Controller("v1/yatra/finance")
export class YatraFinanceController {
  constructor(private readonly finance: YatraFinanceService) {}

  @Get("dashboard")
  async dashboard(@Query() query: OptionalRangeDto) {
    return ok(await this.finance.dashboard(query));
  }

  @Get("report")
  async report(@Query() query: ReportRangeDto) {
    return ok(await this.finance.dailyReport(query.from, query.to));
  }

  @Get("report.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async reportCsv(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportRangeDto, @Res() res: Response) {
    const { filename, csv } = await this.finance.reportCsv(user, query.from, query.to);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(`${String.fromCharCode(0xfeff)}${csv}`);
  }

  @Get("rules")
  async rules(@Query() query: RuleQueryDto) {
    return ok(await this.finance.listRules(query));
  }

  @Post("rules")
  async createRule(@CurrentUser() user: AuthenticatedUser, @Body() dto: CommissionRuleDto) {
    return ok(await this.finance.createRule(user, dto), "Commission rule saved. Existing bookings keep their own rule.");
  }

  @Post("rules/:id/retire")
  async retireRule(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.finance.retireRule(user, id), "Rule retired.");
  }

  @Get("awaiting-rule")
  async awaitingRule() {
    return ok(await this.finance.bookingsAwaitingRule());
  }

  @Post("bookings/:id/apply-rule")
  async applyRule(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.finance.applyCurrentRule(user, id), "Rule applied and earning posted.");
  }

  @Get("payees")
  async payees(@Query() query: PayeeTypeQueryDto) {
    return ok(await this.finance.payees(query.payeeType));
  }

  @Get("payees/:type/:id")
  async payee(@Param("type") type: string, @Param("id", EntityIdPipe) id: string, @Query() query: PaginationDto) {
    const payeeType = type === "ride_partner" ? "ride_partner" : "operator";
    const [summary, statement] = await Promise.all([this.finance.summary(payeeType, id), this.finance.statement(payeeType, id, query.page, query.limit)]);
    return { ...paged(statement, query.page, query.limit), summary };
  }

  @Post("adjustments")
  async adjust(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdjustmentDto) {
    return ok(await this.finance.addAdjustment(user, dto), "Adjustment recorded.");
  }

  @Get("payouts")
  async payouts(@Query() query: PayoutQueryDto) {
    return paged(await this.finance.listPayouts(query), query.page, query.limit);
  }

  @Post("payouts")
  async createPayout(@CurrentUser() user: AuthenticatedUser, @Body() dto: FinancePayoutRequestDto) {
    return ok(await this.finance.requestPayout(user, dto.payeeType, dto.payeeId, dto.amount, dto.note, true), "Payout created.");
  }

  @Get("payouts/:id")
  async payout(@Param("id", EntityIdPipe) id: string) {
    return ok(await this.finance.getPayout(id));
  }

  @Post("payouts/:id/review")
  async review(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: PayoutReviewDto) {
    return ok(await this.finance.reviewPayout(user, id, dto.action, dto.note));
  }

  @Post("payouts/:id/transfer")
  @UseInterceptors(proofUpload)
  async transfer(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: TransferDto, @UploadedFile() proof?: Express.Multer.File) {
    return ok(await this.finance.recordTransfer(user, id, dto, proof), "Transfer recorded.");
  }

  @Post("payouts/:id/reconcile")
  async reconcile(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReconcilePayoutDto) {
    return ok(await this.finance.reconcilePayout(user, id, dto), "Payout reconciled.");
  }

  @Post("payouts/:id/cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.finance.cancelPayout(user, id));
  }

  @Get("payouts/:id/proof")
  async proof(@Param("id", EntityIdPipe) id: string) {
    return ok(await this.finance.proofLink(id));
  }

  @Get("reconciliation")
  async runs() {
    return ok(await this.finance.reconciliationRuns());
  }

  @Post("reconciliation")
  async run(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReconRunDto) {
    return ok(await this.finance.reconcileRazorpay(user, dto.date));
  }
}

/** Super Admin: ride partner approval and ride oversight. */
@ApiTags("Yatra · Super Admin")
@ApiBearerAuth()
@Roles(...YATRA_ADMIN_ROLES)
@UseGuards(YatraEnabledGuard)
@Controller("v1/yatra/admin")
export class YatraRideAdminController {
  constructor(private readonly rides: YatraRideService) {}

  @Get("ride-partners")
  async partners(@Query() query: RidePartnerQueryDto) {
    return paged(await this.rides.adminPartners(query), query.page, query.limit);
  }

  @Get("ride-partners/:id")
  async partner(@Param("id", EntityIdPipe) id: string) {
    return ok(await this.rides.adminPartner(id));
  }

  @Post("ride-partners/:id/review")
  async review(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: PartnerReviewDto) {
    return ok(await this.rides.adminReviewPartner(user, id, dto.action, dto.note));
  }

  @Get("ride-partner-documents/:id/link")
  async documentLink(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.rides.adminPartnerDocumentLink(user, id));
  }

  @Get("rides")
  async list(@Query() query: RideQueryDto) {
    return paged(await this.rides.adminRides(query), query.page, query.limit);
  }

  @Post("rides/:id/assign")
  async assign(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: AssignRidePartnerDto) {
    return ok(await this.rides.assignPartner(user, id, dto.partnerId), "Partner assigned.");
  }

  @Post("rides/:id/cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: AdminRideCancelDto) {
    return ok(await this.rides.adminCancel(user, id, dto.reason, dto.refundPercent ?? 100), "Ride cancelled.");
  }
}

/** Destination Operations: Super Admin anywhere, HR / Executive in their office city only. */
@ApiTags("Yatra · Destination Ops")
@ApiBearerAuth()
@Roles(...YATRA_OPS_ROLES)
@UseGuards(YatraEnabledGuard)
@Controller("v1/yatra/ops")
export class YatraOpsController {
  constructor(
    private readonly ops: YatraOpsService,
    private readonly rides: YatraRideService,
  ) {}

  @Get("dashboard")
  async dashboard(@CurrentUser() user: AuthenticatedUser, @Query() query: OpsQueryDto) {
    return ok(await this.ops.dashboard(user, query));
  }

  @Get("bookings/lookup")
  async lookup(@CurrentUser() user: AuthenticatedUser, @Query("reference") reference = "", @Query("city") city?: string) {
    return ok(await this.ops.lookupBooking(user, reference, city));
  }

  @Get("departures/:id/passengers")
  async passengers(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.ops.departurePassengers(user, id));
  }

  @Get("issues")
  async issues(@CurrentUser() user: AuthenticatedUser, @Query() query: IssueQueryDto) {
    return paged(await this.ops.listIssues(user, query), query.page, query.limit);
  }

  @Post("issues")
  async createIssue(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpsIssueDto) {
    return ok(await this.ops.createIssue(user, dto), "Incident recorded.");
  }

  @Patch("issues/:id")
  async updateIssue(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: IssueUpdateDto) {
    return ok(await this.ops.updateIssue(user, id, dto));
  }

  @Get("report")
  async report(@CurrentUser() user: AuthenticatedUser, @Query() query: OpsReportDto) {
    return ok(await this.ops.cityReport(user, query));
  }

  @Get("ride-partners")
  async partners(@CurrentUser() user: AuthenticatedUser, @Query("city") city = "") {
    await this.ops.assertCity(user, city);
    return ok(await this.rides.availablePartners(city));
  }

  @Post("rides/:id/assign")
  async assign(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: AssignRidePartnerDto) {
    await this.ops.assertCity(user, await this.rides.rideCity(id));
    return ok(await this.rides.assignPartner(user, id, dto.partnerId), "Partner assigned.");
  }
}
