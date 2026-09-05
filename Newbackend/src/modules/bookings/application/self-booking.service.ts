import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { TransactionService } from "../../../common/database/transaction.service";
import {
  assertAshramInScope,
  isUnrestricted,
  resolveAshramScope,
  type AshramScope,
} from "../../../common/auth/ashram-scope";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  BOOKING_REPOSITORY,
  type BookingRepository,
} from "../domain/booking.repository";
import {
  SELF_BOOKING_SOURCE,
  TIRVONA_BOOKING_SOURCE,
  bookingReference,
  checkinCode,
  financialReference,
  reservationReference,
  roundMoney,
} from "../domain/booking.utils";
import type {
  CreateSelfBookingDto,
  SelfBookingAvailabilityDto,
} from "../presentation/dtos/self-booking.dto";
import { BookingPricingService } from "./booking-pricing.service";
import { QrService } from "../../smart-contact/application/qr.service";

const SELF_BOOKING_ROLES = [
  "ashram_owner",
  "owner",
  "manager",
  "reception",
  "ashram_admin",
  "stay_admin",
  "super_admin",
];

const RESERVATION_HOLD_MS = 30 * 60 * 1000;

const eachNight = (start: Date, end: Date): Date[] => {
  const dates: Date[] = [];
  for (
    let cursor = new Date(start);
    cursor < end;
    cursor = new Date(cursor.getTime() + 86_400_000)
  )
    dates.push(new Date(cursor));
  return dates;
};

@Injectable()
export class SelfBookingService {
  private readonly logger = new Logger(SelfBookingService.name);

  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly repository: BookingRepository,
    private readonly transactions: TransactionService,
    private readonly pricing: BookingPricingService,
    private readonly qr: QrService,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("BookingStatusHistory") private readonly history: Model<any>,
    @InjectModel("BookingPayment") private readonly payments: Model<any>,
    @InjectModel("BookingReceipt") private readonly receipts: Model<any>,
    @InjectModel("BookingTransaction")
    private readonly financialTransactions: Model<any>,
    @InjectModel("BookingAuditLog") private readonly audits: Model<any>,
    @InjectModel("BookingInventory") private readonly inventory: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("Room") private readonly rooms: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
  ) {}

  private assertRole(user: AuthenticatedUser): void {
    if (!SELF_BOOKING_ROLES.includes(user.role))
      throw new ForbiddenException(
        "You are not allowed to record counter bookings.",
      );
  }

  private async issueActiveCheckinCode(): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = checkinCode();
      const collision = await this.bookings.exists({
        checkInCode: code,
        status: { $in: ["pending", "confirmed"] },
        deletedAt: null,
      });
      if (!collision) return code;
    }
    throw new BadRequestException(
      "Could not issue a check-in code. Please retry the booking.",
    );
  }

  private async scope(user: AuthenticatedUser): Promise<AshramScope> {
    return resolveAshramScope(user, this.ashrams);
  }

  async authorizedAshrams(user: AuthenticatedUser): Promise<any[]> {
    this.assertRole(user);
    const scope = await this.scope(user);
    return this.ashrams
      .find({
        ...(isUnrestricted(scope) ? {} : { _id: { $in: scope } }),
        deletedAt: null,
      })
      .select("_id name address.city address.state status")
      .sort({ name: 1 })
      .lean();
  }

  async availability(
    user: AuthenticatedUser,
    query: SelfBookingAvailabilityDto,
  ): Promise<any[]> {
    this.assertRole(user);
    assertAshramInScope(await this.scope(user), query.ashramId);

    const start = new Date(query.checkInDate);
    const end = new Date(query.checkOutDate);
    if (!Number.isFinite(start.getTime()) || start >= end)
      throw new BadRequestException(
        "Check-out date must be after check-in date",
      );
    const nights = eachNight(start, end);

    const rooms = await this.rooms
      .find({ ashramId: query.ashramId, status: "active", deletedAt: null })
      .lean();

    return Promise.all(
      (rooms as any[]).map(async (room) => {
        const rows = await this.inventory
          .find({ roomId: room._id, date: { $in: nights } })
          .lean();
        const free = nights.map((date) => {
          const row = (rows as any[]).find(
            (item) => new Date(item.date).getTime() === date.getTime(),
          );
          if (!row) return Number(room.totalInventory ?? 0);
          if (row.isClosed) return 0;
          return Math.max(
            0,
            Number(row.totalInventory ?? room.totalInventory ?? 0) -
              Number(row.heldCount ?? 0) -
              Number(row.bookedCount ?? 0) -
              Number(row.maintenanceCount ?? 0),
          );
        });
        return {
          roomId: String(room._id),
          name: room.name,
          type: room.type,
          totalInventory: Number(room.totalInventory ?? 0),
          availableCount: free.length ? Math.min(...free) : 0,
          basePrice: Number(room.basePrice ?? room.pricePerNight ?? 0),
          nights: nights.length,
        };
      }),
    );
  }

  private async scopedBooking(
    user: AuthenticatedUser,
    id: string,
  ): Promise<any> {
    this.assertRole(user);
    const booking = await this.bookings
      .findById(id)
      .select("+checkInCode")
      .populate("ashramId", "name address")
      .populate("roomId", "name type")
      .lean();
    if (!booking) throw new NotFoundException("Booking not found");
    assertAshramInScope(
      await this.scope(user),
      (booking as any).ashramId?._id ?? (booking as any).ashramId,
      "You do not have access to this booking.",
    );
    return booking;
  }

  async receipt(user: AuthenticatedUser, id: string): Promise<any> {
    const booking = await this.scopedBooking(user, id);
    const [payment, receipt] = await Promise.all([
      this.payments
        .findOne({ bookingId: booking._id })
        .sort({ createdAt: -1 })
        .lean(),
      this.receipts
        .findOne({ bookingId: booking._id })
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    return {
      bookingId: booking.bookingId,
      reservationNumber: booking.reservationNumber,
      bookingSource: booking.bookingSource,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      checkInCode: booking.checkInCode,
      ashram: {
        name: (booking as any).ashramId?.name,
        address: (booking as any).ashramId?.address,
      },
      room: {
        name: (booking as any).roomId?.name,
        type: (booking as any).roomId?.type,
      },
      guest: booking.walkInGuest ?? null,
      stay: {
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        guestsCount: booking.guestsCount,
        roomsBookedCount: booking.roomsBookedCount,
      },
      pricing: booking.pricing,
      payment: payment
        ? {
            method: payment.method,
            amount: payment.amount,
            status: payment.status,
            transactionId: payment.transactionId,
            paidAt: payment.paidAt,
          }
        : null,
      receiptNumber: receipt?.receiptNumber ?? null,
      issuedAt: receipt?.issuedAt ?? null,
    };
  }

  async checkInQr(user: AuthenticatedUser, id: string): Promise<string> {
    const booking = await this.scopedBooking(user, id);
    return this.qr.renderSvg(
      `TIRVONA:${booking.bookingId}:${booking.checkInCode}`,
      { caption: String(booking.bookingId) },
    );
  }

  private async resolveWalkInGuest(
    dto: CreateSelfBookingDto,
    session: any,
  ): Promise<any> {
    const phone = dto.guestPhone.trim();
    const existing = await this.users.findOne({ phone }).session(session);
    if (existing) return existing;
    const [created] = await this.users.create(
      [
        {
          name: dto.guestName.trim(),
          phone,
          email:
            dto.guestEmail?.trim().toLowerCase() ||
            `walkin.${phone.replace(/\D/g, "")}@guest.tirvona.local`,
          role: "customer",
          status: "active",
          isVerified: false,
          authProvider: "local",
        },
      ],
      { session },
    );
    return created;
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateSelfBookingDto,
  ): Promise<any> {
    this.assertRole(user);
    assertAshramInScope(await this.scope(user), dto.ashramId);

    const ashram = await this.ashrams.findOne({
      _id: dto.ashramId,
      deletedAt: null,
    });
    if (!ashram) throw new NotFoundException("Ashram not found");

    const quote = await this.pricing.quote({
      ashramId: dto.ashramId,
      rooms: dto.rooms,
      checkInDate: dto.checkInDate,
      checkOutDate: dto.checkOutDate,
      guestsCount: dto.guestsCount,
      roomsBookedCount: dto.roomsBookedCount,
    } as never);

    const isSelf = dto.bookingType !== TIRVONA_BOOKING_SOURCE;
    const tariff = roundMoney(Number(quote.pricing.totalAmount ?? 0));
    const collected = isSelf ? roundMoney(Number(dto.amountCollected ?? 0)) : 0;
    if (collected > tariff)
      throw new BadRequestException(
        "Collected amount cannot exceed the booking total",
      );

    const code = await this.issueActiveCheckinCode();

    return this.transactions.run(async (session) => {
      for (const roomReq of dto.rooms) {
        await this.repository.holdInventory({
          ashramId: dto.ashramId,
          roomId: roomReq.roomId,
          dates: quote.dates,
          count: roomReq.units,
          capacity: quote.room.totalInventory,
          session,
        });
      }

      const guest = await this.resolveWalkInGuest(dto, session);

      const [booking] = await this.bookings.create(
        [
          {
            bookingId: bookingReference(),
            reservationNumber: reservationReference(),
            customerId: guest._id,
            ashramId: dto.ashramId,
            rooms: dto.rooms.map(r => ({ roomId: r.roomId, units: r.units })),
            roomId: dto.rooms[0]?.roomId,
            bookingSource: isSelf
              ? SELF_BOOKING_SOURCE
              : TIRVONA_BOOKING_SOURCE,
            bookedBy: user.id,
            walkInGuest: {
              name: dto.guestName.trim(),
              phone: dto.guestPhone.trim(),
              email: dto.guestEmail?.trim().toLowerCase(),
              idType: dto.guestIdType,
              idNumber: dto.guestIdNumber,
              address: dto.guestAddress,
            },
            checkInDate: new Date(dto.checkInDate),
            checkOutDate: new Date(dto.checkOutDate),
            occupiedDates: quote.dates,
            guestsCount: dto.guestsCount,
            roomsBookedCount: dto.roomsBookedCount,
            status: isSelf ? "confirmed" : "pending",
            pricing: { ...quote.pricing, amountPaid: collected },
            paymentMode: isSelf ? "offline" : "online",
            gatewayStatus: isSelf ? "success" : "not_initiated",
            paymentStatus:
              collected >= tariff && collected > 0
                ? "fully_paid"
                : collected > 0
                  ? "partially_paid"
                  : "pending",
            checkInCode: code,
            specialRequests: dto.specialRequests,
            reservationExpiresAt: isSelf
              ? null
              : new Date(Date.now() + RESERVATION_HOLD_MS),
          },
        ],
        { session },
      );

      if (isSelf) {
        for (const roomReq of dto.rooms) {
          await this.repository.confirmInventory({
            roomId: roomReq.roomId,
            dates: quote.dates,
            count: roomReq.units,
            session,
          });
          await this.inventory.updateMany(
            { roomId: roomReq.roomId, date: { $in: quote.dates } },
            { $inc: { offlineBookedCount: roomReq.units } },
            { session },
          );
        }
      }

      let payment: any = null;
      let receipt: any = null;
      if (isSelf) {
          [payment] = await this.payments.create(
          [
            {
              bookingId: booking._id,
              userId: guest._id,
              ashramId: dto.ashramId,
              bookingSource: SELF_BOOKING_SOURCE,
              collectedBy: user.id,
              amount: collected,
              purpose: "booking",
              method: dto.paymentMethod,
              status: collected > 0 ? "success" : "pending",
              transactionId:
                dto.paymentReference?.trim() || financialReference("BKPAY"),
              paidAt: collected > 0 ? new Date() : undefined,
            },
          ],
          { session },
        );

        [receipt] = await this.receipts.create(
          [
            {
              receiptNumber: financialReference("RCPT"),
              bookingId: booking._id,
              paymentId: payment._id,
              amount: collected,
              method: dto.paymentMethod,
              issuedAt: new Date(),
            },
          ],
          { session },
        );

        await this.financialTransactions.create(
          [
            {
              bookingId: booking._id,
              paymentId: payment._id,
              ashramId: dto.ashramId,
              ownerId: ashram.ownerId,
              bookingSource: SELF_BOOKING_SOURCE,
              type: "booking",
              direction: "credit",
              amount: collected,
              reference: financialReference("BKTXN"),
            },
          ],
          { session },
        );

        await this.history.create(
          [
            {
              bookingId: booking._id,
              fromStatus: "pending",
              toStatus: "confirmed",
              note: `Self booking recorded (${dto.paymentMethod})`,
              actorId: user.id,
              actorRole: user.role,
            },
          ],
          { session },
        );
      } else {
        await this.history.create(
          [
            {
              bookingId: booking._id,
              fromStatus: "pending",
              toStatus: "pending",
              note: "Tirvona booking created at the counter, awaiting online payment",
              actorId: user.id,
              actorRole: user.role,
            },
          ],
          { session },
        );
      }

      await this.audits.create(
        [
          {
            userId: user.id,
            action: isSelf
              ? "SELF_BOOKING_CREATED"
              : "COUNTER_TIRVONA_BOOKING_CREATED",
            bookingId: booking._id,
            ashramId: dto.ashramId,
            details: {
              bookingSource: isSelf
                ? SELF_BOOKING_SOURCE
                : TIRVONA_BOOKING_SOURCE,
              method: isSelf ? dto.paymentMethod : "razorpay",
              amountCollected: collected,
              tariff,
              receiptNumber: receipt?.receiptNumber ?? null,
            },
          },
        ],
        { session },
      );

      this.logger.log(
        JSON.stringify({
          event: isSelf
            ? "booking.self_booking_created"
            : "booking.counter_tirvona_booking_created",
          bookingId: String(booking._id),
          reference: booking.bookingId,
          ashramId: dto.ashramId,
          actorId: user.id,
          method: isSelf ? dto.paymentMethod : "razorpay",
        }),
      );

      return {
        booking,
        payment,
        receipt,
        checkInCode: code,
        requiresOnlinePayment: !isSelf,
        amountDue: isSelf ? 0 : tariff,
      };
    });
  }
}
