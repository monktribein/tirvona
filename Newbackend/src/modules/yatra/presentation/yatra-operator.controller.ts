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
import { DOCUMENT_MAX_BYTES } from "../domain/yatra.constants";
import { YatraBookingService } from "../application/yatra-booking.service";
import { YatraCharterService } from "../application/yatra-charter.service";
import { YatraTripService } from "../application/yatra-trip.service";
import { YatraCatalogService } from "../application/yatra-catalog.service";
import { YatraInsightsService } from "../application/yatra-insights.service";
import { YatraInventoryService } from "../application/yatra-inventory.service";
import { YatraOperatorService } from "../application/yatra-operator.service";
import {
  AddStaffDto,
  BookingQueryDto,
  CheckInDto,
  CreateBookingDto,
  CreateDepartureDto,
  CreateLinkDto,
  CreateTourDto,
  DateRangeDto,
  DepartureQueryDto,
  LinkActiveDto,
  RespondCharterDto,
  ShareLocationDto,
  PayoutDetailsDto,
  ReasonDto,
  RegisterOperatorDto,
  SubmitOperatorDto,
  UpdateDepartureDto,
  UpdateOperatorDto,
  UpdateStaffDto,
  UpdateTourDto,
  UpdateVehicleDto,
  UploadDocumentDto,
  VehicleDto,
} from "./yatra.dto";
import { EntityIdPipe, ok, paged, YatraEnabledGuard, YatraWriteThrottle } from "./yatra-http";

/**
 * The partner console. Any signed-in account may register a partner;
 * every other call is scoped on the server to the caller's own partner
 * and checked against the caller's partner role (owner/manager/staff).
 */
@ApiTags("Yatra · Partner")
@ApiBearerAuth()
@UseGuards(YatraEnabledGuard)
@Controller("v1/yatra/operator")
export class YatraOperatorController {
  constructor(
    private readonly operators: YatraOperatorService,
    private readonly catalog: YatraCatalogService,
    private readonly inventory: YatraInventoryService,
    private readonly bookings: YatraBookingService,
    private readonly insights: YatraInsightsService,
    private readonly trips: YatraTripService,
    private readonly charters: YatraCharterService,
  ) {}

  // ----------------------------------------------------------- live location
  @Get("departures/:id/location")
  async locationStatus(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.trips.organiserStatus(user, id));
  }

  // The driver's page posts a position every few seconds while it is open.
  @Post("departures/:id/location")
  @YatraWriteThrottle(120, 60_000)
  async shareLocation(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ShareLocationDto) {
    return ok(await this.trips.share(user, id, dto));
  }

  @Post("departures/:id/location/stop")
  async stopLocation(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.trips.stop(user, id), "Location sharing stopped.");
  }

  // ---------------------------------------------------------- full-bus requests
  @Get("charter-requests")
  async charterRequests(@CurrentUser() user: AuthenticatedUser, @Query("status") status?: string) {
    return ok(await this.charters.listForOperator(user, status));
  }

  @Post("charter-requests/:id/respond")
  @YatraWriteThrottle(30, 600_000)
  async respondCharter(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: RespondCharterDto) {
    return ok(await this.charters.respond(user, id, dto), dto.action === "accept" ? "Accepted. The seats are held for the pilgrim to pay." : "Request declined.");
  }

  // ------------------------------------------------------------ organisation
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.operators.me(user));
  }

  @Post("register")
  @YatraWriteThrottle(5, 3_600_000)
  async register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterOperatorDto) {
    return ok(await this.operators.register(user, dto), "Partner registered. Complete your profile and KYC to submit it for approval.");
  }

  @Patch("profile")
  async profile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOperatorDto) {
    return ok(await this.operators.updateProfile(user, dto), "Profile saved.");
  }

  @Put("payout")
  async payout(@CurrentUser() user: AuthenticatedUser, @Body() dto: PayoutDetailsDto) {
    return ok(await this.operators.setPayout(user, dto), "Payout details saved.");
  }

  @Post("submit")
  async submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitOperatorDto) {
    return ok(await this.operators.submit(user, dto.acceptTerms), "Submitted to Tirvona for verification.");
  }

  // ------------------------------------------------------------------- staff
  @Get("staff")
  async staff(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.operators.listStaff(user));
  }

  @Post("staff")
  async addStaff(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddStaffDto) {
    return ok(await this.operators.addStaff(user, dto), "Team member added.");
  }

  @Patch("staff/:id")
  async updateStaff(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: UpdateStaffDto) {
    return ok(await this.operators.updateStaff(user, id, dto.role), "Role updated.");
  }

  @Delete("staff/:id")
  async removeStaff(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.operators.removeStaff(user, id), "Team member removed.");
  }

  // --------------------------------------------------------------- documents
  @Get("documents")
  async documents(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.operators.listDocuments(user));
  }

  @Post("documents")
  @YatraWriteThrottle(30, 900_000)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: DOCUMENT_MAX_BYTES } }))
  async upload(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File, @Body() dto: UploadDocumentDto) {
    return ok(await this.operators.uploadDocument(user, file, dto), "Document uploaded privately for verification.");
  }

  @Get("documents/:id/link")
  async documentLink(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.operators.documentLink(user, id, false));
  }

  @Delete("documents/:id")
  async deleteDocument(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.operators.deleteDocument(user, id), "Document deleted.");
  }

  // ---------------------------------------------------------------- vehicles
  @Get("vehicles")
  async vehicles(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.catalog.listVehicles(user));
  }

  @Post("vehicles")
  async createVehicle(@CurrentUser() user: AuthenticatedUser, @Body() dto: VehicleDto) {
    return ok(await this.catalog.createVehicle(user, dto), "Vehicle added. Upload its RC, permit and insurance, then submit it.");
  }

  @Patch("vehicles/:id")
  async updateVehicle(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: UpdateVehicleDto) {
    return ok(await this.catalog.updateVehicle(user, id, dto), "Vehicle saved.");
  }

  @Post("vehicles/:id/submit")
  async submitVehicle(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.catalog.submitVehicle(user, id), "Vehicle sent for verification.");
  }

  // ------------------------------------------------------------------- tours
  @Get("circuit-templates")
  async templates(@Query("q") q?: string) {
    return ok(await this.catalog.circuitTemplates(q));
  }

  @Get("circuit-templates/:id")
  async template(@Param("id", EntityIdPipe) id: string) {
    return ok(await this.catalog.circuitTemplate(id));
  }

  @Get("tours")
  async tours(@CurrentUser() user: AuthenticatedUser, @Query("status") status?: string) {
    return ok(await this.catalog.listTours(user, status));
  }

  @Post("tours")
  async createTour(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTourDto) {
    return ok(await this.catalog.createTour(user, dto), "Tour draft saved.");
  }

  @Get("tours/:id")
  async tour(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.catalog.getTour(user, id));
  }

  @Patch("tours/:id")
  async updateTour(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: UpdateTourDto) {
    return ok(await this.catalog.updateTour(user, id, dto), "Tour draft saved.");
  }

  @Post("tours/:id/submit")
  async submitTour(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.catalog.submitTour(user, id), "Tour sent to Tirvona for review. Only Tirvona can publish it.");
  }

  // -------------------------------------------------------------- departures
  @Get("departures")
  async departures(@CurrentUser() user: AuthenticatedUser, @Query() query: DepartureQueryDto) {
    return ok(await this.inventory.listDepartures(user, { tourId: query.tourId, status: query.status, upcoming: query.upcoming === "true" }));
  }

  @Post("departures")
  async createDeparture(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDepartureDto) {
    return ok(await this.inventory.createDeparture(user, dto), "Departure saved as a draft.");
  }

  @Get("departures/:id")
  async departure(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.inventory.getDeparture(user, id));
  }

  @Patch("departures/:id")
  async updateDeparture(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: UpdateDepartureDto) {
    return ok(await this.inventory.updateDeparture(user, id, dto), "Departure saved.");
  }

  @Post("departures/:id/open")
  async open(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.inventory.openDeparture(user, id), "Departure is open for booking.");
  }

  @Post("departures/:id/close-sales")
  async closeSales(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.inventory.setSales(user, id, false), "Sales stopped for this departure.");
  }

  @Post("departures/:id/reopen-sales")
  async reopenSales(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.inventory.setSales(user, id, true), "Sales reopened.");
  }

  @Get("departures/:id/seats")
  async seats(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    await this.inventory.getDeparture(user, id);
    return ok(await this.inventory.seatMap(id, "operator"));
  }

  @Get("departures/:id/manifest")
  async manifest(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.bookings.manifest(user, id));
  }

  @Get("departures/:id/manifest.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async manifestCsv(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Res() res: Response) {
    const { filename, csv } = await this.bookings.manifestCsv(user, id);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(`${String.fromCharCode(0xfeff)}${csv}`);
  }

  @Post("departures/:id/check-in")
  async checkIn(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: CheckInDto) {
    return ok(await this.bookings.checkIn(user, id, dto), "Checked in.");
  }

  // ---------------------------------------------------------------- bookings
  @Get("bookings")
  async bookingsList(@CurrentUser() user: AuthenticatedUser, @Query() query: BookingQueryDto) {
    return paged(await this.bookings.operatorBookings(user, query), query.page, query.limit);
  }

  @Post("bookings")
  @YatraWriteThrottle(60, 600_000)
  async assisted(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookingDto) {
    return ok(await this.bookings.createOrganizerBooking(user, dto), "Seats held. Send the payment link to your customer; the booking confirms once they pay.");
  }

  @Get("bookings/:id")
  async booking(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.bookings.operatorBooking(user, id));
  }

  @Post("bookings/:id/payment-link")
  async reissue(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.bookings.reissuePaymentLink(user, id), "New payment link ready.");
  }

  @Post("bookings/:id/release")
  async release(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.bookings.operatorRelease(user, id), "Seats released.");
  }

  @Post("bookings/:id/cancel-request")
  async cancelRequest(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReasonDto) {
    return ok(await this.bookings.requestCancellation(user, id, dto.reason, true), "Cancellation request sent to Tirvona.");
  }

  // ----------------------------------------------------------- links & money
  @Get("links")
  async links(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.insights.listLinks(user));
  }

  @Post("links")
  async createLink(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLinkDto) {
    return ok(await this.insights.createLink(user, dto), "Booking link created.");
  }

  @Get("links/:id/qr")
  async linkQr(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.insights.linkQr(user, id));
  }

  @Patch("links/:id")
  async setLink(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: LinkActiveDto) {
    return ok(await this.insights.setLinkActive(user, id, dto.active));
  }

  @Get("earnings")
  async earnings(@CurrentUser() user: AuthenticatedUser, @Query() query: DateRangeDto) {
    const result = await this.insights.earnings(user, query);
    return { ...paged(result, query.page, query.limit), summary: result.summary };
  }

  @Get("payouts")
  async payouts(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.insights.payouts(user));
  }

  @Get("reports")
  async reports(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.insights.reports(user));
  }
}
