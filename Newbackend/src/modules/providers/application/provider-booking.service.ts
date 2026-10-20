import { forwardRef, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import { Types, type ClientSession, type Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { TransactionService } from "../../../common/database/transaction.service";
import { canonicalPhone } from "../../../common/phone/phone.util";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";
import {
  ADVANCE_PAYMENT_WINDOW_HOURS,
  BOOKING_NUMBER_PREFIX,
  BOOKING_TRANSITIONS,
  MAX_BOOKING_HORIZON_DAYS,
  MAX_MULTI_PANDIT_REQUESTS,
  MAX_TRAVEL_RADIUS_KM,
  type BookingActor,
  type BookingStatus,
  type BookingTransition,
} from "../domain/provider.constants";
import { providerError } from "../domain/provider.errors";
import { addDays, localDateOf, zonedToUtc } from "../domain/provider-time.util";
import { listingBlockers, maskPhone } from "../domain/provider-visibility";
import { validateShiftTravelFeasibility } from "../domain/travel-distance.util";
import { parseYouTubeUrl } from "../domain/youtube";
import { WhatsAppTransactionalNotificationService } from "../../../integrations/whatsapp/services/whatsapp-transactional-notification.service";
import {
  PLATFORM_FEE_LABEL,
  PLATFORM_FEE_LINE,
  platformFeeMinor,
  providerPlatformFeeBps,
} from "../domain/platform-fee";
import { correlationId } from "../infrastructure/request-context";
import { pageParams } from "../presentation/dto/common.dto";
import type {
  AcceptBookingRequestDto,
  BookingListQueryDto,
  BookingTransitionDto,
  CreateMultiPanditBookingRequestDto,
  CreateProviderBookingDto,
} from "../presentation/dto/booking.dto";
import { ProviderAuditService } from "./provider-audit.service";
import { ProviderAvailabilityService } from "./provider-availability.service";
import { ProviderCalendarService } from "./provider-calendar.service";
import { ProviderOfferingService } from "./provider-offering.service";
import { ProviderProfileService } from "./provider-profile.service";
import { ProviderBookingPaymentService } from "./provider-booking-payment.service";
import { ProviderWalletService } from "./provider-wallet.service";
import {
  idStr,
  paged,
  providerConfig,
  randomBase32,
  sameId,
  toObjectId,
} from "./provider.helpers";

const CANCELLED: readonly BookingStatus[] = [
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_PROVIDER",
  "CANCELLED_BY_OPS",
  "PAYMENT_FAILED",
];
const OPS_ROLES = ["service_manager", "super_admin"];
/** A live link makes sense from confirmation until the puja is done. */
const LIVE_STREAM_STATUSES = [
  "CONFIRMED",
  "PROVIDER_ACCEPTED",
  "PREPARATION_IN_PROGRESS",
  "READY_FOR_FULFILMENT",
  "IN_PROGRESS",
];
export const isBookingOps = (user: Pick<AuthenticatedUser, "role">): boolean =>
  OPS_ROLES.includes(user.role);

const HOUR = 3_600_000;
/** The provider may start a service this long before its scheduled time. */
const START_EARLY_HOURS = 2;

interface TransitionContext {
  actorType: BookingActor;
  actorId?: string;
  reasonCode?: string | null;
  paymentRef?: string;
}

@Injectable()
export class ProviderBookingService {
  private readonly logger = new Logger(ProviderBookingService.name);

  constructor(
    @InjectModel("ProviderBooking") private readonly bookings: Model<any>,
    @InjectModel("ProviderBookingStateHistory") private readonly history: Model<any>,
    @InjectModel("ProviderProfile") private readonly profileModel: Model<any>,
    private readonly transactions: TransactionService,
    private readonly offerings: ProviderOfferingService,
    private readonly profiles: ProviderProfileService,
    private readonly calendar: ProviderCalendarService,
    private readonly availability: ProviderAvailabilityService,
    private readonly audit: ProviderAuditService,
    private readonly notifier: InAppNotificationService,
    @Optional()
    @Inject(forwardRef(() => ProviderBookingPaymentService))
    private readonly payments?: ProviderBookingPaymentService,
    @Optional() private readonly wallet?: ProviderWalletService,
    @Optional() private readonly whatsapp?: WhatsAppTransactionalNotificationService,
  ) {}

  // --------------------------------------------------------------- create
  async create(user: AuthenticatedUser, dto: CreateProviderBookingDto) {
    const { offering, variant, ritual } = await this.offerings.loadSellable(dto.offeringId);
    const provider: any = await this.profileModel.findById(offering.providerId).lean();
    if (
      !provider ||
      listingBlockers(provider, { allowDevFixtures: providerConfig().allowDevFixtures }).length
    )
      throw providerError.conflict(
        "PROVIDER_NOT_BOOKABLE",
        "This provider is not currently accepting bookings",
      );
    if (sameId(provider.userId, user.id))
      throw providerError.forbidden("CANNOT_BOOK_OWN_SERVICE", "You cannot book your own service");

    const now = new Date();
    const start = new Date(dto.scheduledStartAt);
    if (start.getTime() < now.getTime() + offering.minNoticeHours * HOUR)
      throw providerError.unprocessable(
        "BOOKING_TOO_SOON",
        `This service needs at least ${offering.minNoticeHours} hours' notice`,
      );
    if (start.getTime() > now.getTime() + MAX_BOOKING_HORIZON_DAYS * 24 * HOUR)
      throw providerError.unprocessable(
        "BOOKING_TOO_FAR",
        `Bookings can be made up to ${MAX_BOOKING_HORIZON_DAYS} days ahead`,
      );
    const end = new Date(start.getTime() + offering.durationMinutes * 60_000);
    const deliveryMode = dto.deliveryMode === "LIVE_ONLINE" ? "LIVE_ONLINE" : "IN_PERSON";
    if (deliveryMode === "LIVE_ONLINE" && !provider.liveOnline?.enabled)
      throw providerError.conflict(
        "LIVE_ONLINE_UNAVAILABLE",
        "This pandit is not taking live online bookings right now. Please choose an in-person booking.",
      );
    // A live online katha happens on video: no address and no travel.
    if (deliveryMode === "IN_PERSON") this.assertLocation(dto, offering, provider);

    const timezone = await this.availability.timezoneOf(provider._id);

    // Check same-day shift travel feasibility
    if (dto.shift && dto.serviceLocation?.city) {
      const dayStart = zonedToUtc(localDateOf(start, timezone), "00:00", timezone);
      const dayEnd = zonedToUtc(addDays(localDateOf(start, timezone), 1), "00:00", timezone);
      const sameDayBookings = await this.bookings
        .find({
          providerId: provider._id,
          status: {
            $in: [
              "CONFIRMED",
              "PROVIDER_ACCEPTED",
              "PREPARATION_IN_PROGRESS",
              "READY_FOR_FULFILMENT",
              "IN_PROGRESS",
            ],
          },
          scheduledStartAt: { $gte: dayStart, $lt: dayEnd },
        })
        .select("scheduledStartAt scheduledEndAt serviceLocation shift")
        .lean();

      for (const prev of sameDayBookings) {
        const feas = validateShiftTravelFeasibility({
          priorEndAt: new Date(prev.scheduledEndAt),
          newStartAt: start,
          priorLocation: prev.serviceLocation,
          newLocation: dto.serviceLocation,
          maxRadiusKm: MAX_TRAVEL_RADIUS_KM,
        });
        if (!feas.feasible) {
          throw providerError.unprocessable(
            "TRAVEL_RADIUS_EXCEEDED",
            feas.reason ?? "Preceding booking on this date is beyond the 50 km straight-line travel radius",
          );
        }
      }
    }

    const titles = await this.snapshotTitles(variant, ritual);
    const pricing = this.pricingSnapshot(offering, deliveryMode);
    const professional = (offering.baseProfessionalFeeMinor ?? 0) as number;
    const advancePercent = (offering.advancePercentage ?? 50) as number;
    const advanceDakshina = Math.round((professional * advancePercent) / 100);
    const remainingDakshina = professional - advanceDakshina;
    const travel = Number(pricing.lines.find((l: any) => l.code === "TRAVEL")?.amountMinor || 0);
    const platformFee = Number(pricing.platformFeeMinor || 0);
    const advanceRequiredMinor = Number(advanceDakshina) + travel + platformFee;
    const remainingBalanceMinor = remainingDakshina;
    const holdExpiresAt = new Date(now.getTime() + providerConfig().holdMinutes * 60_000);

    const serviceSnapshot = {
      schemaVersion: 1,
      ritual: titles.ritual,
      variant: titles.variant,
      provider: {
        id: idStr(provider._id),
        slug: provider.slug,
        displayName: provider.displayName,
        providerType: provider.providerType,
        verificationLevel: provider.verificationLevel,
      },
      offering: {
        id: idStr(offering._id),
        title: offering.title ?? null,
        fulfilmentType: offering.fulfilmentType,
        deliveryMode,
        durationMinutes: offering.durationMinutes,
        teamSize: offering.teamSize,
        inclusions: offering.inclusions ?? [],
        exclusions: offering.exclusions ?? [],
        samagriIncluded: Boolean(offering.samagriIncluded),
        voluntaryDakshinaAllowed: Boolean(offering.voluntaryDakshinaAllowed),
        destination: offering.destination ?? null,
      },
      pricing,
    };

    // A colliding booking number is vanishingly rare; the transaction is simply retried with a new one.
    for (let attempt = 1; ; attempt += 1) {
      const bookingId = new Types.ObjectId();
      try {
        const booking = await this.transactions.run(async (session) => {
          const block = await this.calendar.reserve({
            providerId: provider._id,
            start,
            end,
            blockType: "HOLD",
            sourceId: bookingId,
            expiresAt: holdExpiresAt,
            createdBy: user.id,
            requireWithinRules: true,
            session,
          });
          const [created] = await this.bookings.create(
            [
              {
                _id: bookingId,
                bookingNumber: this.bookingNumber(now),
                customerUserId: toObjectId(user.id),
                providerId: provider._id,
                providerUserId: provider.userId,
                offeringId: offering._id,
                ritualId: ritual._id,
                ritualVariantId: variant._id,
                fulfilmentType: offering.fulfilmentType,
                deliveryMode,
                // A live online booking starts with the pandit's YouTube live page; they can set a specific stream later.
                liveStream:
                  deliveryMode === "LIVE_ONLINE" && provider.liveOnline?.youtubeUrl
                    ? {
                        youtubeUrl: provider.liveOnline.youtubeUrl,
                        videoId: parseYouTubeUrl(provider.liveOnline.youtubeUrl)?.videoId ?? null,
                        source: "PROFILE",
                        addedAt: now,
                      }
                    : null,
                serviceSnapshot,
                scheduledStartAt: start,
                scheduledEndAt: end,
                timezone,
                customerContact: {
                  name: dto.customerName,
                  phone: canonicalPhone(dto.customerPhone),
                  email: dto.customerEmail,
                },
                serviceLocation: deliveryMode === "LIVE_ONLINE" ? null : dto.serviceLocation ?? null,
                customerNotes: dto.notes,
                status: "PAYMENT_PENDING",
                stateVersion: 0,
                holdBlockId: block._id,
                holdExpiresAt,
                serviceType: dto.serviceType ?? offering.serviceType ?? "INDIVIDUAL",
                groupCapacity: dto.groupCapacity ?? offering.groupCapacity ?? null,
                kathaDetails: dto.kathaDetails ?? offering.kathaDetails ?? null,
                shift: dto.shift ?? "ANY",
                advanceRequiredMinor,
                advancePaidMinor: 0,
                remainingBalanceMinor,
                paymentType: "ADVANCE_50",
                contactUnlocked: false,
                providerContactSnapshot: {
                  phone: provider.contactPhone ?? null,
                  email: provider.contactEmail ?? null,
                },
              },
            ],
            { session },
          );
          await this.history.create(
            [
              {
                bookingId,
                fromState: null,
                toState: "PAYMENT_PENDING",
                command: "create",
                actorType: "CUSTOMER",
                actorId: toObjectId(user.id),
                correlationId: correlationId(),
                aggregateVersion: 0,
              },
            ],
            { session },
          );
          return created;
        });
        await this.audit.log(user, "booking.created", "provider_booking", booking._id, {
          providerId: idStr(provider._id),
          offeringId: idStr(offering._id),
          fulfilmentType: offering.fulfilmentType,
        });
        return { success: true, data: await this.viewFor("CUSTOMER", booking._id) };
      } catch (error) {
        if ((error as { code?: number }).code === 11000 && attempt < 3) continue;
        throw error;
      }
    }
  }

  // ------------------------------------------------ multi-pandit requests
  /**
   * Controlled multi-Pandit request workflow:
   * A customer sends one booking request to up to 5 eligible Pandits.
   */
  async createMultiRequest(user: AuthenticatedUser, dto: CreateMultiPanditBookingRequestDto) {
    if (!dto.candidateProviderIds || dto.candidateProviderIds.length === 0) {
      throw providerError.badRequest("NO_PROVIDERS_SELECTED", "Select at least 1 provider");
    }
    if (dto.candidateProviderIds.length > MAX_MULTI_PANDIT_REQUESTS) {
      throw providerError.badRequest(
        "TOO_MANY_PROVIDERS",
        `You can request at most ${MAX_MULTI_PANDIT_REQUESTS} Pandits in a single request cycle`,
      );
    }
    const { offering, variant, ritual } = await this.offerings.loadSellable(dto.offeringId);
    const now = new Date();
    const start = new Date(dto.scheduledStartAt);
    if (start.getTime() < now.getTime() + offering.minNoticeHours * HOUR)
      throw providerError.unprocessable(
        "BOOKING_TOO_SOON",
        `This service needs at least ${offering.minNoticeHours} hours' notice`,
      );
    if (start.getTime() > now.getTime() + MAX_BOOKING_HORIZON_DAYS * 24 * HOUR)
      throw providerError.unprocessable(
        "BOOKING_TOO_FAR",
        `Bookings can be made up to ${MAX_BOOKING_HORIZON_DAYS} days ahead`,
      );
    const end = new Date(start.getTime() + offering.durationMinutes * 60_000);
    const deliveryMode = dto.deliveryMode === "LIVE_ONLINE" ? "LIVE_ONLINE" : "IN_PERSON";
    const requestGroupId = new Types.ObjectId().toString();
    const createdBookings: any[] = [];

    for (const providerId of dto.candidateProviderIds) {
      const provider: any = await this.profileModel.findById(toObjectId(providerId)).lean();
      if (!provider || listingBlockers(provider, { allowDevFixtures: providerConfig().allowDevFixtures }).length) {
        continue;
      }
      if (sameId(provider.userId, user.id)) continue;

      if (deliveryMode === "IN_PERSON") {
        try {
          this.assertLocation(dto as any, offering, provider);
        } catch {
          continue;
        }
      }

      const timezone = await this.availability.timezoneOf(provider._id);
      if (dto.shift && dto.serviceLocation?.city) {
        const dayStart = zonedToUtc(localDateOf(start, timezone), "00:00", timezone);
        const dayEnd = zonedToUtc(addDays(localDateOf(start, timezone), 1), "00:00", timezone);
        const sameDayBookings = await this.bookings
          .find({
            providerId: provider._id,
            status: {
              $in: [
                "CONFIRMED",
                "PROVIDER_ACCEPTED",
                "PREPARATION_IN_PROGRESS",
                "READY_FOR_FULFILMENT",
                "IN_PROGRESS",
              ],
            },
            scheduledStartAt: { $gte: dayStart, $lt: dayEnd },
          })
          .select("scheduledStartAt scheduledEndAt serviceLocation shift")
          .lean();

        let feasible = true;
        for (const prev of sameDayBookings) {
          const check = validateShiftTravelFeasibility({
            priorEndAt: new Date(prev.scheduledEndAt),
            newStartAt: start,
            priorLocation: prev.serviceLocation,
            newLocation: dto.serviceLocation,
            maxRadiusKm: MAX_TRAVEL_RADIUS_KM,
          });
          if (!check.feasible) {
            feasible = false;
            break;
          }
        }
        if (!feasible) continue;
      }

      const titles = await this.snapshotTitles(variant, ritual);
      const pricing = this.pricingSnapshot(offering, deliveryMode);
      const professional = (offering.baseProfessionalFeeMinor ?? 0) as number;
      const advancePercent = (offering.advancePercentage ?? 50) as number;
      const advanceDakshina = Math.round((professional * advancePercent) / 100);
      const remainingDakshina = professional - advanceDakshina;
      const travel = Number(pricing.lines.find((l: any) => l.code === "TRAVEL")?.amountMinor || 0);
      const platformFee = Number(pricing.platformFeeMinor || 0);
      const advanceRequiredMinor = Number(advanceDakshina) + travel + platformFee;
      const remainingBalanceMinor = remainingDakshina;
      const holdExpiresAt = new Date(now.getTime() + 24 * HOUR);

      const serviceSnapshot = {
        schemaVersion: 1,
        ritual: titles.ritual,
        variant: titles.variant,
        provider: {
          id: idStr(provider._id),
          slug: provider.slug,
          displayName: provider.displayName,
          providerType: provider.providerType,
          verificationLevel: provider.verificationLevel,
        },
        offering: {
          id: idStr(offering._id),
          title: offering.title ?? null,
          fulfilmentType: offering.fulfilmentType,
          deliveryMode,
          durationMinutes: offering.durationMinutes,
          teamSize: offering.teamSize,
          inclusions: offering.inclusions ?? [],
          exclusions: offering.exclusions ?? [],
          samagriIncluded: Boolean(offering.samagriIncluded),
          voluntaryDakshinaAllowed: Boolean(offering.voluntaryDakshinaAllowed),
          destination: offering.destination ?? null,
        },
        pricing,
      };

      const bookingId = new Types.ObjectId();
      try {
        const created = await this.transactions.run(async (session) => {
          const block = await this.calendar.reserve({
            providerId: provider._id,
            start,
            end,
            blockType: "HOLD",
            sourceId: bookingId,
            expiresAt: holdExpiresAt,
            createdBy: user.id,
            requireWithinRules: true,
            session,
          });

          const [doc] = await this.bookings.create(
            [
              {
                _id: bookingId,
                bookingNumber: this.bookingNumber(now),
                customerUserId: toObjectId(user.id),
                providerId: provider._id,
                providerUserId: provider.userId,
                offeringId: offering._id,
                ritualId: ritual._id,
                ritualVariantId: variant._id,
                fulfilmentType: offering.fulfilmentType,
                deliveryMode,
                serviceSnapshot,
                scheduledStartAt: start,
                scheduledEndAt: end,
                timezone,
                customerContact: {
                  name: dto.customerName,
                  phone: canonicalPhone(dto.customerPhone),
                  email: dto.customerEmail,
                },
                serviceLocation: deliveryMode === "LIVE_ONLINE" ? null : dto.serviceLocation ?? null,
                customerNotes: dto.notes,
                status: "REQUEST_PENDING",
                stateVersion: 0,
                holdBlockId: block._id,
                holdExpiresAt,
                requestGroupId,
                candidateProviderIds: dto.candidateProviderIds,
                serviceType: dto.serviceType ?? offering.serviceType ?? "INDIVIDUAL",
                groupCapacity: dto.groupCapacity ?? offering.groupCapacity ?? null,
                kathaDetails: dto.kathaDetails ?? offering.kathaDetails ?? null,
                shift: dto.shift ?? "ANY",
                advanceRequiredMinor,
                advancePaidMinor: 0,
                remainingBalanceMinor,
                paymentType: "ADVANCE_50",
                contactUnlocked: false,
                providerContactSnapshot: {
                  phone: provider.contactPhone ?? null,
                  email: provider.contactEmail ?? null,
                },
              },
            ],
            { session },
          );

          await this.history.create(
            [
              {
                bookingId,
                fromState: null,
                toState: "REQUEST_PENDING",
                command: "create_multi_request",
                actorType: "CUSTOMER",
                actorId: toObjectId(user.id),
                correlationId: correlationId(),
                aggregateVersion: 0,
              },
            ],
            { session },
          );

          return doc;
        });

        createdBookings.push(created);

        await this.notifier.notifyUsers([String(provider.userId)], {
          title: `New Puja Request Received`,
          body: `You received a new booking request for ${titles.ritual.titles?.en ?? "Puja"}. Open bookings to review and accept.`,
          deepLink: `/provider/bookings`,
          kind: "provider.booking.request_pending",
        });
      } catch (err) {
        this.logger.warn(`Failed reserving candidate pandit ${providerId}: ${(err as Error).message}`);
      }
    }

    if (!createdBookings.length) {
      throw providerError.unprocessable(
        "NO_ELIGIBLE_PROVIDERS",
        "None of the selected Pandits are eligible or available for this slot",
      );
    }

    await this.audit.log(user, "booking.multi_requested", "provider_booking", createdBookings[0]._id, {
      requestGroupId,
      providerCount: createdBookings.length,
    });

    return {
      success: true,
      data: {
        requestGroupId,
        count: createdBookings.length,
        bookings: createdBookings.map((b) => this.customerView(b.toObject ? b.toObject() : b)),
      },
    };
  }

  /**
   * A Pandit accepts the request: moves to ACCEPTED_AWAITING_ADVANCE with 1-hour payment window.
   */
  async acceptRequest(user: AuthenticatedUser, bookingId: string, _dto?: AcceptBookingRequestDto) {
    const booking: any = await this.bookings
      .findById(toObjectId(bookingId, "bookingId"))
      .select("+customerContact +serviceLocation +customerNotes")
      .lean();
    if (!booking) throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");
    if (!sameId(booking.providerUserId, user.id)) {
      throw providerError.forbidden("NOT_ASSIGNED_PROVIDER", "Only the assigned Pandit can accept this request");
    }
    if (booking.status !== "REQUEST_PENDING") {
      throw providerError.conflict("INVALID_STATE", `Cannot accept booking in state ${booking.status}`);
    }

    if (booking.requestGroupId) {
      const confirmedOther = await this.bookings.findOne({
        requestGroupId: booking.requestGroupId,
        status: "CONFIRMED",
      }).lean();
      if (confirmedOther) {
        throw providerError.conflict(
          "REQUEST_ALREADY_CONFIRMED",
          "This request has already been confirmed with another Pandit",
        );
      }
    }

    const now = new Date();
    const advancePaymentDeadlineAt = new Date(now.getTime() + ADVANCE_PAYMENT_WINDOW_HOURS * HOUR);

    const updated = await this.transactions.run(async (session) => {
      const changed = await this.bookings.findOneAndUpdate(
        { _id: booking._id, status: "REQUEST_PENDING", stateVersion: booking.stateVersion },
        {
          $set: {
            status: "ACCEPTED_AWAITING_ADVANCE",
            advancePaymentDeadlineAt,
            holdExpiresAt: advancePaymentDeadlineAt,
          },
          $inc: { stateVersion: 1 },
        },
        { new: true, session },
      );
      if (!changed)
        throw providerError.conflict(
          "BOOKING_STATE_CONFLICT",
          "Booking state changed. Reload and try again.",
        );

      await this.history.create(
        [
          {
            bookingId: booking._id,
            fromState: "REQUEST_PENDING",
            toState: "ACCEPTED_AWAITING_ADVANCE",
            command: "accept_request",
            actorType: "PROVIDER",
            actorId: toObjectId(user.id),
            correlationId: correlationId(),
            aggregateVersion: changed.stateVersion,
          },
        ],
        { session },
      );

      return changed.toObject();
    });

    await this.notifier.notifyUsers([String(booking.customerUserId)], {
      title: `Pandit Accepted Your Request`,
      body: `Pandit ji accepted your request! You have 1 hour to complete the 50% advance payment to confirm your booking.`,
      deepLink: `/profile/bookings`,
      kind: "provider.booking.accepted_awaiting_advance",
    });

    return { success: true, data: this.providerView(updated) };
  }

  /**
   * A Pandit declines the booking request.
   */
  async declineRequest(user: AuthenticatedUser, bookingId: string, reasonCode?: string) {
    const booking: any = await this.bookings
      .findById(toObjectId(bookingId, "bookingId"))
      .select("+customerContact +serviceLocation")
      .lean();
    if (!booking) throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");
    if (!sameId(booking.providerUserId, user.id)) {
      throw providerError.forbidden("NOT_ASSIGNED_PROVIDER", "Only the assigned Pandit can decline this request");
    }
    if (!["REQUEST_PENDING", "ACCEPTED_AWAITING_ADVANCE"].includes(booking.status)) {
      throw providerError.conflict("INVALID_STATE", `Cannot decline booking in state ${booking.status}`);
    }

    const updated = await this.transactions.run(async (session) => {
      const changed = await this.bookings.findOneAndUpdate(
        { _id: booking._id, status: booking.status, stateVersion: booking.stateVersion },
        {
          $set: {
            status: "CANCELLED_BY_PROVIDER",
            cancelledAt: new Date(),
            cancelReasonCode: reasonCode ?? "DECLINED_BY_PROVIDER",
          },
          $inc: { stateVersion: 1 },
        },
        { new: true, session },
      );
      if (!changed)
        throw providerError.conflict(
          "BOOKING_STATE_CONFLICT",
          "Booking state changed. Reload and try again.",
        );

      await this.history.create(
        [
          {
            bookingId: booking._id,
            fromState: booking.status,
            toState: "CANCELLED_BY_PROVIDER",
            command: "decline_request",
            reasonCode: reasonCode ?? "DECLINED_BY_PROVIDER",
            actorType: "PROVIDER",
            actorId: toObjectId(user.id),
            correlationId: correlationId(),
            aggregateVersion: changed.stateVersion,
          },
        ],
        { session },
      );

      if (booking.holdBlockId) {
        await this.calendar.release(booking.holdBlockId, "RELEASED", session);
      }

      return changed.toObject();
    });

    await this.notifier.notifyUsers([String(booking.customerUserId)], {
      title: `Pandit Declined Request`,
      body: `A Pandit declined your request. You may select another Pandit from your request pool.`,
      deepLink: `/profile/bookings`,
      kind: "provider.booking.cancelled_by_provider",
    });

    return { success: true, data: this.providerView(updated) };
  }

  private async cancelCompetingRequests(confirmedBooking: any) {
    if (!confirmedBooking.requestGroupId) return;
    const siblings = await this.bookings
      .find({
        requestGroupId: confirmedBooking.requestGroupId,
        _id: { $ne: confirmedBooking._id },
        status: { $in: ["REQUEST_PENDING", "ACCEPTED_AWAITING_ADVANCE"] },
      })
      .lean();

    for (const sibling of siblings) {
      try {
        await this.transactions.run(async (session) => {
          await this.bookings.updateOne(
            { _id: sibling._id },
            {
              $set: {
                status: "CANCELLED_BY_OPS",
                cancelledAt: new Date(),
                cancelReasonCode: "ANOTHER_PROVIDER_CONFIRMED",
              },
              $inc: { stateVersion: 1 },
            },
            { session },
          );
          if (sibling.holdBlockId) {
            await this.calendar.release(sibling.holdBlockId, "RELEASED", session);
          }
        });
        await this.notifier.notifyUsers([String(sibling.providerUserId)], {
          title: `Booking Update`,
          body: `Another Pandit was confirmed by the devotee for this request. Your calendar hold has been released.`,
          deepLink: `/provider/bookings`,
          kind: "provider.booking.cancelled_by_ops",
        });
      } catch (err) {
        this.logger.warn(`Failed cancelling sibling request ${sibling._id}: ${(err as Error).message}`);
      }
    }
  }

  private async sendWhatsAppConfirmation(booking: any) {
    const customerPhone = booking.customerContact?.phone;
    if (!customerPhone) return;
    const ref = booking.bookingNumber;
    const serviceName =
      booking.serviceSnapshot?.ritual?.titles?.en ??
      booking.serviceSnapshot?.variant?.titles?.en ??
      "Puja Service";
    const dateStr = new Date(booking.scheduledStartAt).toLocaleString("en-IN", {
      timeZone: booking.timezone ?? "Asia/Kolkata",
    });
    const advancePaid = (booking.advancePaidMinor ?? 0) / 100;
    const total = (booking.serviceSnapshot?.pricing?.totalMinor ?? 0) / 100;
    const remaining = (booking.remainingBalanceMinor ?? 0) / 100;

    const message = [
      `🙏 *Tirvona Booking Confirmed*`,
      ``,
      `*Booking Ref:* ${ref}`,
      `*Service:* ${serviceName}`,
      `*Date & Time:* ${dateStr}`,
      `*Advance Received:* ₹${advancePaid.toLocaleString("en-IN")}`,
      `*Total Service Fee:* ₹${total.toLocaleString("en-IN")}`,
      `*Remaining Balance:* ₹${remaining.toLocaleString("en-IN")}`,
      `*Balance Due:* Before scheduled Puja`,
      `*Pandit Contact:* Unlocked in My Bookings`,
      `*Support:* +91 8000000000 / support@tirvona.com`,
    ].join("\n");

    try {
      if (this.whatsapp) {
        await this.whatsapp.sendOutboxEvent({
          domain: "booking",
          notificationId: `pandit_${booking._id}_${Date.now()}`,
          userId: String(booking.customerUserId),
          event: "confirmed",
          title: `Puja Booking Confirmed: ${ref}`,
          message,
          phone: customerPhone,
          recipientName: booking.customerContact?.name,
          occurredAt: new Date(),
        } as any);
      } else {
        this.logger.log(`[WhatsApp Notification Log] To ${customerPhone}: ${message}`);
      }
    } catch (err) {
      this.logger.warn(`WhatsApp notification failed for ${ref}: ${(err as Error).message}`);
    }
  }

  // ----------------------------------------------------------- transitions
  async transition(
    actorType: BookingActor,
    user: AuthenticatedUser,
    bookingId: string,
    dto: BookingTransitionDto,
  ) {
    const booking = await this.loadFor(actorType, user, bookingId);
    const transition = BOOKING_TRANSITIONS[booking.status as BookingStatus]?.find(
      (candidate) => candidate.command === dto.command,
    );
    if (!transition)
      throw providerError.conflict(
        "BOOKING_INVALID_TRANSITION",
        `"${dto.command}" is not possible while the booking is ${booking.status}`,
      );
    if (!transition.actors.includes(actorType))
      throw providerError.forbidden(
        "BOOKING_TRANSITION_FORBIDDEN",
        `You are not allowed to ${dto.command} this booking`,
      );
    if (transition.reasons && !transition.reasons.includes(dto.reasonCode ?? ""))
      throw providerError.badRequest(
        "BOOKING_REASON_REQUIRED",
        `reasonCode must be one of: ${transition.reasons.join(", ")}`,
      );
    this.assertTiming(transition, booking);

    const updated = await this.apply(booking, transition, {
      actorType,
      actorId: user.id,
      reasonCode: dto.reasonCode ?? null,
    });
    await this.audit.log(user, "booking.transition", "provider_booking", booking._id, {
      from: booking.status,
      to: transition.to,
      command: dto.command,
      reasonCode: dto.reasonCode ?? null,
      actorType,
    });
    if (CANCELLED.includes(transition.to) && booking.status !== "PAYMENT_PENDING") {
      await this.payments?.handleRefundOnCancellation(updated, dto.reasonCode ?? dto.command);
    }
    await this.notifyCounterpart(actorType, updated, transition.to);
    return { success: true, data: await this.viewFor(this.viewerOf(actorType), updated._id) };
  }

  // ---------------------------------------- actor-resolving entry points
  /**
   * Who the caller is *for this booking*, decided from the booking itself and
   * the signed-in user - never from anything the client claims. A stranger is
   * told the booking does not exist.
   */
  async resolveActor(user: AuthenticatedUser, bookingId: string): Promise<BookingActor> {
    const row: any = await this.bookings
      .findById(toObjectId(bookingId, "bookingId"))
      .select("customerUserId providerUserId")
      .lean();
    if (row && sameId(row.customerUserId, user.id)) return "CUSTOMER";
    if (row && sameId(row.providerUserId, user.id)) return "PROVIDER";
    if (row && isBookingOps(user)) return "OPS";
    throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");
  }

  async getAs(user: AuthenticatedUser, bookingId: string) {
    return this.get(await this.resolveActor(user, bookingId), user, bookingId);
  }

  async transitionAs(user: AuthenticatedUser, bookingId: string, dto: BookingTransitionDto) {
    return this.transition(await this.resolveActor(user, bookingId), user, bookingId, dto);
  }

  async historyAs(user: AuthenticatedUser, bookingId: string) {
    return this.stateHistory(await this.resolveActor(user, bookingId), user, bookingId);
  }

  /** Cancellation sugar: picks the right command for who is cancelling and how far the booking has got. */
  async cancelAs(user: AuthenticatedUser, bookingId: string, reasonCode: string) {
    const actor = await this.resolveActor(user, bookingId);
    const booking: any = await this.bookings.findById(toObjectId(bookingId)).select("status").lean();
    const command =
      actor === "CUSTOMER"
        ? "cancel"
        : actor === "OPS"
          ? "cancel_by_ops"
          : booking.status === "CONFIRMED"
            ? "decline"
            : "cancel_by_provider";
    return this.transition(actor, user, bookingId, { command, reasonCode });
  }

  /**
   * The pandit (or ops) sets the YouTube link devotees watch for this booking:
   * any booking can be streamed (a live online katha, or a home puja for family
   * far away). The devotee is told as soon as it is added.
   */
  async setLiveStreamAs(user: AuthenticatedUser, bookingId: string, youtubeUrl: string) {
    const actor = await this.resolveActor(user, bookingId);
    if (actor === "CUSTOMER")
      throw providerError.forbidden("BOOKING_TRANSITION_FORBIDDEN", "Only the pandit can set the live stream link");
    const parsed = parseYouTubeUrl(youtubeUrl);
    if (!parsed)
      throw providerError.badRequest("INVALID_YOUTUBE_LINK", "Enter a YouTube link, e.g. https://youtube.com/live/...");
    const booking: any = await this.bookings.findById(toObjectId(bookingId)).select("status bookingNumber customerUserId").lean();
    if (!LIVE_STREAM_STATUSES.includes(booking.status))
      throw providerError.conflict("BOOKING_NOT_STREAMABLE", `A live link cannot be added while the booking is ${booking.status}`);
    await this.bookings.updateOne(
      { _id: booking._id },
      { $set: { liveStream: { youtubeUrl: parsed.url, videoId: parsed.videoId, source: "BOOKING", addedAt: new Date() } } },
    );
    await this.audit.log(user, "booking.live_stream", "provider_booking", booking._id, { hasVideoId: Boolean(parsed.videoId) });
    try {
      await this.notifier.notifyUsers([String(booking.customerUserId)], {
        title: `Booking ${booking.bookingNumber}`,
        body: "Pandit ji added the YouTube live link for your puja. Open My bookings to watch.",
        deepLink: "/profile/bookings",
        kind: "provider.booking.live_stream",
      });
    } catch (error) {
      this.logger.warn(`Live link notice for ${booking.bookingNumber} failed: ${(error as Error).message}`);
    }
    return this.getAs(user, bookingId);
  }

  // ------------------------------------------- system hooks (payment/ops)
  /**
   * Called by the payment integration once a payment for this booking is
   * captured. Finance logic stays in the payments module: this only moves the
   * state and records the opaque reference. Not exposed over HTTP.
   */
  async confirmPayment(bookingId: string, paymentRef: string) {
    return this.system(bookingId, "confirm_payment", { paymentRef });
  }

  async failPayment(bookingId: string, paymentRef?: string) {
    return this.system(bookingId, "fail_payment", { paymentRef });
  }

  /** Releases an unpaid booking whose hold ran out. Idempotent. */
  async expireHold(bookingId: string) {
    return this.system(bookingId, "expire_hold", { reasonCode: "HOLD_EXPIRED" });
  }

  private async system(
    bookingId: string,
    command: string,
    extra: { paymentRef?: string; reasonCode?: string },
  ) {
    const booking: any = await this.bookings.findById(toObjectId(bookingId, "bookingId")).lean();
    if (!booking) throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");
    const transition = BOOKING_TRANSITIONS[booking.status as BookingStatus]?.find(
      (candidate) => candidate.command === command && candidate.actors.includes("SYSTEM"),
    );
    if (!transition)
      throw providerError.conflict(
        "BOOKING_INVALID_TRANSITION",
        `"${command}" is not possible while the booking is ${booking.status}`,
      );
    const updated = await this.apply(booking, transition, {
      actorType: "SYSTEM",
      reasonCode: extra.reasonCode ?? null,
      paymentRef: extra.paymentRef,
    });
    await this.audit.log(null, "booking.transition", "provider_booking", booking._id, {
      from: booking.status,
      to: transition.to,
      command,
      actorType: "SYSTEM",
    });
    await this.notifyCounterpart("SYSTEM", updated, transition.to);
    if (transition.to === "CONFIRMED") {
      await this.wallet?.notifyEarning(updated);
      if (updated.requestGroupId) {
        await this.cancelCompetingRequests(updated);
      }
      await this.sendWhatsAppConfirmation(updated);
    }
    return updated;
  }

  /** Every state change goes through here: conditional on (status, version), with history and calendar effects in one transaction. */
  private async apply(booking: any, transition: BookingTransition, ctx: TransitionContext) {
    const now = new Date();
    return this.transactions.run(async (session) => {
      const set: Record<string, unknown> = { status: transition.to };
      if (transition.to === "CONFIRMED") {
        set.confirmedAt = now;
        set.holdExpiresAt = null;
        set.contactUnlocked = true;
        const totalMinor = Number(booking.serviceSnapshot?.pricing?.totalMinor || 0);
        const advanceRequired = booking.advanceRequiredMinor ?? Math.round(totalMinor / 2);
        set.advancePaidMinor = advanceRequired;
        set.remainingBalanceMinor = Math.max(0, totalMinor - advanceRequired);
      }
      if (transition.to === "PROVIDER_ACCEPTED") set.acceptedAt = now;
      if (transition.to === "IN_PROGRESS") set.startedAt = now;
      if (transition.to === "COMPLETED") set.completedAt = now;
      if (CANCELLED.includes(transition.to)) {
        set.cancelledAt = now;
        set.cancelReasonCode = ctx.reasonCode ?? transition.command;
      }
      const update: Record<string, unknown> = { $set: set, $inc: { stateVersion: 1 } };
      if (ctx.paymentRef) update.$addToSet = { paymentRefs: ctx.paymentRef };
      if (transition.to === "CONFIRMED" && booking.requestGroupId) await this.claimRequestGroup(booking, session);

      const changed = await this.bookings.findOneAndUpdate(
        { _id: booking._id, status: booking.status, stateVersion: booking.stateVersion },
        update,
        { new: true, session },
      );
      if (!changed)
        throw providerError.conflict(
          "BOOKING_STATE_CONFLICT",
          "The booking changed while this was being processed. Reload and try again.",
        );

      await this.history.create(
        [
          {
            bookingId: booking._id,
            fromState: booking.status,
            toState: transition.to,
            command: transition.command,
            reasonCode: ctx.reasonCode ?? null,
            actorType: ctx.actorType,
            actorId: ctx.actorId ? toObjectId(ctx.actorId) : null,
            correlationId: correlationId(),
            aggregateVersion: changed.stateVersion,
          },
        ],
        { session },
      );
      await this.calendarEffect(booking, transition.to, ctx.reasonCode ?? null, session);
      // The pandit's wallet moves with the booking: credited when the devotee's
      // payment confirms it, reversed when a paid booking is cancelled (and refunded).
      if (transition.to === "CONFIRMED")
        await this.wallet?.recordEarning(changed, ctx.paymentRef, session);
      else if (CANCELLED.includes(transition.to) && booking.status !== "PAYMENT_PENDING")
        await this.wallet?.reverseEarning(changed, session);
      return changed.toObject();
    });
  }

  /**
   * A multi-Pandit request ends with exactly one confirmed Pandit. Inside the
   * confirming transaction: refuse if a sibling is already confirmed, and touch
   * the still-open siblings' version so that a sibling being confirmed at the
   * same moment fails its own conditional update instead of also succeeding.
   */
  private async claimRequestGroup(booking: any, session: ClientSession) {
    const siblings = { requestGroupId: booking.requestGroupId, _id: { $ne: booking._id } };
    const rival = await this.bookings.findOne({ ...siblings, status: "CONFIRMED" }).select("_id").session(session).lean();
    if (rival)
      throw providerError.conflict(
        "REQUEST_ALREADY_CONFIRMED",
        "This request has already been confirmed with another Pandit",
      );
    await this.bookings.updateMany(
      { ...siblings, status: { $in: ["REQUEST_PENDING", "ACCEPTED_AWAITING_ADVANCE"] } },
      { $inc: { stateVersion: 1 } },
      { session },
    );
  }

  private async calendarEffect(
    booking: any,
    to: BookingStatus,
    reasonCode: string | null,
    session: ClientSession,
  ) {
    if (to === "CONFIRMED") {
      await this.calendar.confirmHold(booking.holdBlockId, "BOOKING", session);
    } else if (CANCELLED.includes(to)) {
      await this.calendar.release(
        booking.holdBlockId,
        reasonCode === "HOLD_EXPIRED" ? "EXPIRED" : "RELEASED",
        session,
      );
    }
  }

  private assertTiming(transition: BookingTransition, booking: any) {
    const now = Date.now();
    if (
      transition.command === "start" &&
      now < new Date(booking.scheduledStartAt).getTime() - START_EARLY_HOURS * HOUR
    )
      throw providerError.conflict(
        "BOOKING_TOO_EARLY",
        `A service can be started up to ${START_EARLY_HOURS} hours before its scheduled time`,
      );
    if (
      (transition.command === "accept" || transition.command === "start_preparation") &&
      now > new Date(booking.scheduledEndAt).getTime()
    )
      throw providerError.conflict("BOOKING_IN_PAST", "That booking time has already passed");
  }

  // ---------------------------------------------------------------- reads
  async listMine(user: AuthenticatedUser, query: BookingListQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { customerUserId: toObjectId(user.id) };
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.bookings.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.bookings.countDocuments(filter),
    ]);
    return paged(
      (rows as any[]).map((row) => this.customerView(row)),
      total,
      page,
      limit,
    );
  }

  async listForProvider(user: AuthenticatedUser, query: BookingListQueryDto) {
    const provider = await this.profiles.requireOwn(user);
    const { page, limit, skip } = pageParams(query);
    const timezone = await this.availability.timezoneOf(provider._id);
    const filter: Record<string, unknown> = { providerId: provider._id };
    if (query.status) filter.status = query.status;
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = zonedToUtc(query.from, "00:00", timezone);
    if (query.to) range.$lt = zonedToUtc(addDays(query.to, 1), "00:00", timezone);
    if (Object.keys(range).length) filter.scheduledStartAt = range;
    const sort: Record<string, 1 | -1> = query.from ? { scheduledStartAt: 1 } : { scheduledStartAt: -1 };
    const [rows, total] = await Promise.all([
      this.bookings
        .find(filter)
        .select("+customerContact +serviceLocation +customerNotes")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.bookings.countDocuments(filter),
    ]);
    return paged(
      (rows as any[]).map((row) => this.providerView(row)),
      total,
      page,
      limit,
    );
  }

  /** Cross-provider operations queue for ops/service managers. */
  async listAll(query: BookingListQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.providerId) filter.providerId = toObjectId(query.providerId);
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) range.$lt = new Date(`${addDays(query.to, 1)}T00:00:00.000Z`);
    if (Object.keys(range).length) filter.scheduledStartAt = range;
    const [rows, total] = await Promise.all([
      this.bookings.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.bookings.countDocuments(filter),
    ]);
    return paged(
      (rows as any[]).map((row) => this.opsSummary(row)),
      total,
      page,
      limit,
    );
  }

  async get(actorType: BookingActor, user: AuthenticatedUser, bookingId: string) {
    const booking = await this.loadFor(actorType, user, bookingId);
    if (actorType === "OPS")
      await this.audit.log(user, "booking.viewed", "provider_booking", booking._id, { restricted: true });
    return { success: true, data: await this.viewFor(this.viewerOf(actorType), booking._id) };
  }

  async stateHistory(actorType: BookingActor, user: AuthenticatedUser, bookingId: string) {
    const booking = await this.loadFor(actorType, user, bookingId);
    const rows: any[] = await this.history.find({ bookingId: booking._id }).sort({ createdAt: 1 }).lean();
    return {
      success: true,
      data: rows.map((row) => ({
        from: row.fromState ?? null,
        to: row.toState,
        command: row.command ?? null,
        reasonCode: row.reasonCode ?? null,
        actorType: row.actorType,
        at: row.createdAt,
      })),
    };
  }

  /** Operational counters for the provider dashboard. */
  async summary(user: AuthenticatedUser) {
    const provider = await this.profiles.requireOwn(user);
    const timezone = await this.availability.timezoneOf(provider._id);
    const grouped: any[] = await this.bookings.aggregate([
      { $match: { providerId: provider._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = Object.fromEntries(grouped.map((row) => [row._id, row.count]));
    const now = new Date();
    const today = localDateOf(now, timezone);
    const [next, todayCount] = await Promise.all([
      this.bookings
        .findOne({
          providerId: provider._id,
          status: { $in: ["CONFIRMED", "PROVIDER_ACCEPTED", "PREPARATION_IN_PROGRESS", "READY_FOR_FULFILMENT"] },
          scheduledStartAt: { $gte: now },
        })
        .select("+customerContact +serviceLocation")
        .sort({ scheduledStartAt: 1 })
        .lean(),
      this.bookings.countDocuments({
        providerId: provider._id,
        status: { $in: ["CONFIRMED", "PROVIDER_ACCEPTED", "PREPARATION_IN_PROGRESS", "READY_FOR_FULFILMENT", "IN_PROGRESS"] },
        scheduledStartAt: {
          $gte: zonedToUtc(today, "00:00", timezone),
          $lt: zonedToUtc(addDays(today, 1), "00:00", timezone),
        },
      }),
    ]);
    return {
      success: true,
      data: {
        byStatus,
        awaitingAcceptance: byStatus.CONFIRMED ?? 0,
        awaitingPayment: byStatus.PAYMENT_PENDING ?? 0,
        inProgress: byStatus.IN_PROGRESS ?? 0,
        todayCount,
        timezone,
        nextBooking: next ? this.providerView(next) : null,
      },
    };
  }

  // ------------------------------------------------------------- internals
  /** Loads the booking if, and only if, the actor is a party to it. Strangers get "not found". */
  private async loadFor(actorType: BookingActor, user: AuthenticatedUser, bookingId: string): Promise<any> {
    const booking: any = await this.bookings
      .findById(toObjectId(bookingId, "bookingId"))
      .select("+customerContact +serviceLocation +customerNotes")
      .lean();
    const allowed =
      booking &&
      ((actorType === "CUSTOMER" && sameId(booking.customerUserId, user.id)) ||
        (actorType === "PROVIDER" && sameId(booking.providerUserId, user.id)) ||
        (actorType === "OPS" && isBookingOps(user)));
    if (!allowed) throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");
    return booking;
  }

  private viewerOf(actorType: BookingActor): "CUSTOMER" | "PROVIDER" | "OPS" {
    return actorType === "SYSTEM" ? "OPS" : actorType;
  }

  private async viewFor(viewer: "CUSTOMER" | "PROVIDER" | "OPS", bookingId: unknown) {
    const row: any = await this.bookings
      .findById(toObjectId(bookingId, "bookingId"))
      .select("+customerContact +serviceLocation +customerNotes")
      .lean();
    if (viewer === "CUSTOMER") return this.customerView(row);
    if (viewer === "PROVIDER") return this.providerView(row);
    return this.opsView(row);
  }

  private nextActions(status: BookingStatus, actor: BookingActor) {
    return (BOOKING_TRANSITIONS[status] ?? [])
      .filter((transition) => transition.actors.includes(actor))
      .map((transition) => ({ command: transition.command, reasons: transition.reasons ?? null }));
  }

  private common(row: any) {
    const snapshot = row.serviceSnapshot ?? {};
    return {
      id: idStr(row._id),
      bookingNumber: row.bookingNumber,
      status: row.status,
      fulfilmentType: row.fulfilmentType,
      deliveryMode: row.deliveryMode ?? "IN_PERSON",
      liveStream: row.liveStream
        ? { youtubeUrl: row.liveStream.youtubeUrl, videoId: row.liveStream.videoId ?? null, addedAt: row.liveStream.addedAt ?? null }
        : null,
      ritual: snapshot.ritual ?? null,
      variant: snapshot.variant ?? null,
      offering: snapshot.offering ?? null,
      scheduledStartAt: row.scheduledStartAt,
      scheduledEndAt: row.scheduledEndAt,
      timezone: row.timezone,
      createdAt: row.createdAt,
    };
  }

  customerView(row: any) {
    const snapshot = row.serviceSnapshot ?? {};
    const unlocked = Boolean(row.contactUnlocked);
    return {
      ...this.common(row),
      provider: snapshot.provider ?? null,
      providerContact: unlocked
        ? row.providerContactSnapshot ?? {
            phone: row.providerContact?.phone ?? null,
            email: row.providerContact?.email ?? null,
          }
        : null,
      contactUnlocked: unlocked,
      pricing: snapshot.pricing ?? null,
      advanceRequiredMinor: row.advanceRequiredMinor ?? null,
      advancePaidMinor: row.advancePaidMinor ?? 0,
      remainingBalanceMinor: row.remainingBalanceMinor ?? null,
      advancePaymentDeadlineAt: row.advancePaymentDeadlineAt ?? null,
      requestGroupId: row.requestGroupId ?? null,
      candidateProviderIds: row.candidateProviderIds ?? [],
      serviceType: row.serviceType ?? "INDIVIDUAL",
      groupCapacity: row.groupCapacity ?? null,
      kathaDetails: row.kathaDetails ?? null,
      shift: row.shift ?? "ANY",
      serviceLocation: row.serviceLocation ?? null,
      notes: row.customerNotes ?? null,
      holdExpiresAt: ["PAYMENT_PENDING", "ACCEPTED_AWAITING_ADVANCE"].includes(row.status)
        ? row.holdExpiresAt ?? null
        : null,
      paymentReferences: row.paymentRefs ?? [],
      communication: {
        chatAvailable: unlocked,
        callAvailable: unlocked,
        reason: unlocked ? null : "LOCKED_UNTIL_ADVANCE_PAID",
      },
      nextActions: this.nextActions(row.status, "CUSTOMER"),
    };
  }

  providerView(row: any) {
    const snapshot = row.serviceSnapshot ?? {};
    const open = Boolean(row.contactUnlocked);
    const pricing = snapshot.pricing
      ? {
          currency: snapshot.pricing.currency,
          lines: (snapshot.pricing.lines ?? []).filter((line: any) =>
            ["PROVIDER_SERVICE", "TRAVEL"].includes(line.code),
          ),
          youReceiveMinor:
            snapshot.pricing.providerSubtotalMinor ??
            Number(snapshot.pricing.totalMinor ?? 0) - Number(snapshot.pricing.platformFeeMinor ?? 0),
        }
      : null;
    return {
      ...this.common(row),
      customer: {
        name: row.customerContact?.name ?? null,
        phone: open ? row.customerContact?.phone ?? null : maskPhone(row.customerContact?.phone),
        email: open ? row.customerContact?.email ?? null : null,
        contactVisible: open,
      },
      serviceLocation: row.serviceLocation
        ? {
            city: row.serviceLocation.city,
            state: row.serviceLocation.state,
            ...(open ? { line1: row.serviceLocation.line1 ?? null, pincode: row.serviceLocation.pincode ?? null } : {}),
          }
        : null,
      notes: open ? row.customerNotes ?? null : null,
      contactUnlocked: open,
      advanceRequiredMinor: row.advanceRequiredMinor ?? null,
      advancePaidMinor: row.advancePaidMinor ?? 0,
      remainingBalanceMinor: row.remainingBalanceMinor ?? null,
      advancePaymentDeadlineAt: row.advancePaymentDeadlineAt ?? null,
      requestGroupId: row.requestGroupId ?? null,
      serviceType: row.serviceType ?? "INDIVIDUAL",
      groupCapacity: row.groupCapacity ?? null,
      kathaDetails: row.kathaDetails ?? null,
      shift: row.shift ?? "ANY",
      pricing,
      communication: {
        chatAvailable: open,
        callAvailable: open,
        reason: open ? null : "LOCKED_UNTIL_ADVANCE_PAID",
      },
      nextActions: this.nextActions(row.status, "PROVIDER"),
    };
  }

  opsView(row: any) {
    const snapshot = row.serviceSnapshot ?? {};
    return {
      ...this.common(row),
      customerUserId: idStr(row.customerUserId),
      providerId: idStr(row.providerId),
      provider: snapshot.provider ?? null,
      customer: row.customerContact ?? null,
      serviceLocation: row.serviceLocation ?? null,
      pricing: snapshot.pricing ?? null,
      paymentReferences: row.paymentRefs ?? [],
      stateVersion: row.stateVersion,
      nextActions: this.nextActions(row.status, "OPS"),
    };
  }

  /** List rows for ops carry no contact or address; open one booking for those. */
  private opsSummary(row: any) {
    const snapshot = row.serviceSnapshot ?? {};
    return {
      ...this.common(row),
      customerUserId: idStr(row.customerUserId),
      providerId: idStr(row.providerId),
      providerName: snapshot.provider?.displayName ?? null,
      totalMinor: snapshot.pricing?.totalMinor ?? null,
      currency: snapshot.pricing?.currency ?? null,
    };
  }

  private assertLocation(dto: CreateProviderBookingDto, offering: any, provider: any) {
    const atCustomer = ["LOCAL_HOME", "DESTINATION_PROVIDER_HOME", "ON_BEHALF"].includes(
      offering.fulfilmentType,
    );
    if (["LOCAL_HOME", "DESTINATION_PROVIDER_HOME"].includes(offering.fulfilmentType) && !dto.serviceLocation)
      throw providerError.unprocessable(
        "SERVICE_LOCATION_REQUIRED",
        "Give the address where the service should be performed",
      );
    if (
      offering.fulfilmentType === "LOCAL_HOME" &&
      dto.serviceLocation &&
      (provider.serviceCities ?? []).length &&
      !provider.serviceCities.includes(dto.serviceLocation.city.trim().toLowerCase())
    )
      throw providerError.unprocessable(
        "OUTSIDE_SERVICE_AREA",
        "This provider does not serve that city",
      );
    if (offering.fulfilmentType === "DESTINATION_PROVIDER_HOME" && !provider.travelProfile?.willingToTravel)
      throw providerError.unprocessable(
        "PROVIDER_NOT_TRAVELLING",
        "This provider does not travel to customers' homes",
      );
    if (!atCustomer && dto.serviceLocation) {
      // The venue is the offering's destination; an address from the customer would only be noise.
      dto.serviceLocation = undefined;
    }
  }

  /**
   * The provider's own amounts, fixed at booking time (BR-004). Platform fee,
   * tax and discounts belong to the quote engine, which is not part of this
   * phase, so the snapshot is explicitly a provider estimate.
   */
  private pricingSnapshot(offering: any, deliveryMode: string = "IN_PERSON") {
    const professional = offering.baseProfessionalFeeMinor as number;
    // Nobody travels for a live online katha.
    const charge = deliveryMode === "LIVE_ONLINE" ? { policy: "NONE" } : offering.travelCharge ?? { policy: "NONE" };
    const travel = charge.policy === "FLAT" ? (charge.flatMinor as number) : 0;
    // The devotee pays Tirvona's fee on top of the pandit's professional fee; the pandit keeps fee + travel.
    const feeBps = providerPlatformFeeBps();
    const fee = platformFeeMinor(professional, feeBps);
    const lines: Array<Record<string, unknown>> = [
      { code: "PROVIDER_SERVICE", label: "Professional fee", amountMinor: professional },
      {
        code: "TRAVEL",
        label: charge.policy === "ACTUALS_AT_COST" ? "Travel (at actual cost)" : "Travel charge",
        amountMinor: travel,
        policy: charge.policy,
      },
    ];
    if (fee > 0)
      lines.push({ code: PLATFORM_FEE_LINE, label: `${PLATFORM_FEE_LABEL} (${feeBps / 100}%)`, amountMinor: fee, rateBps: feeBps });
    return {
      status: "PROVIDER_ESTIMATE",
      currency: offering.currency,
      lines,
      providerSubtotalMinor: professional + travel,
      platformFeeMinor: fee,
      totalMinor: professional + travel + fee,
      travelPending: charge.policy === "ACTUALS_AT_COST",
      note: "Provider-declared amounts plus Tirvona's platform fee. Tax and discounts are applied by the quote.",
    };
  }

  private async snapshotTitles(variant: any, ritual: any) {
    return {
      ritual: {
        id: idStr(ritual._id),
        slug: ritual.slug,
        titles: ritual.publishedContent?.titles ?? ritual.titles,
        version: ritual.publishedContent?.version ?? null,
      },
      variant: { id: idStr(variant._id), code: variant.code, titles: variant.titles },
    };
  }

  private bookingNumber(now: Date): string {
    const yy = String(now.getUTCFullYear()).slice(2);
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    return `${BOOKING_NUMBER_PREFIX}-${yy}${mm}${dd}-${randomBase32(6)}`;
  }

  private async notifyCounterpart(actor: BookingActor, booking: any, to: BookingStatus) {
    const title = `Booking ${booking.bookingNumber}`;
    const tell = (userId: unknown, body: string, deepLink: string) =>
      this.notifier.notifyUsers([String(userId)], { title, body, deepLink, kind: `provider.booking.${to.toLowerCase()}` });
    try {
      if (to === "CONFIRMED") {
        await tell(booking.providerUserId, "A new booking is waiting for your acceptance.", "/provider/bookings");
        await tell(booking.customerUserId, "Your booking is confirmed. The provider will accept it shortly.", "/profile/bookings");
      } else if (to === "PROVIDER_ACCEPTED") {
        await tell(booking.customerUserId, "Your pandit has accepted the booking.", "/profile/bookings");
      } else if (to === "CANCELLED_BY_PROVIDER") {
        await tell(booking.customerUserId, "The provider has cancelled this booking. We will contact you about next steps.", "/profile/bookings");
      } else if (to === "CANCELLED_BY_CUSTOMER" && actor === "CUSTOMER") {
        await tell(booking.providerUserId, "The customer has cancelled this booking.", "/provider/bookings");
      } else if (to === "COMPLETED") {
        await tell(booking.customerUserId, "Your service was marked complete.", "/profile/bookings");
      }
    } catch (error) {
      this.logger.warn(`Notification for ${booking.bookingNumber} failed: ${(error as Error).message}`);
    }
  }
}
