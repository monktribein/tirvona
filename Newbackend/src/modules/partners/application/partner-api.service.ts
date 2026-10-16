import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedPartnerContext } from "../decorators/current-partner.decorator";

@Injectable()
export class PartnerApiService {
  constructor(
    @InjectModel("Booking") private readonly bookingModel: Model<any>,
    @InjectModel("BookingPayment") private readonly paymentModel: Model<any>,
    @InjectModel("Room") private readonly roomModel: Model<any>,
    @InjectModel("BookingInventory") private readonly inventoryModel: Model<any>,
    @InjectModel("Ashram") private readonly ashramModel: Model<any>,
  ) {}

  /**
   * Helper to verify if an ashramId is within the partner's allowed scope.
   */
  private assertAshramInScope(partner: AuthenticatedPartnerContext, ashramId: string | unknown): void {
    if (partner.scopedAshramIds && partner.scopedAshramIds.length > 0) {
      if (!ashramId || !partner.scopedAshramIds.includes(String(ashramId))) {
        throw new ForbiddenException("Partner is not authorized to access this property");
      }
    }
  }

  // -------------------------------------------------------------
  // BOOKINGS READ
  // -------------------------------------------------------------
  async listBookings(
    partner: AuthenticatedPartnerContext,
    query: {
      ashramId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const filter: Record<string, any> = {};

    // Partner scope enforcement
    if (query.ashramId) {
      this.assertAshramInScope(partner, query.ashramId);
      filter.ashramId = query.ashramId;
    } else if (partner.scopedAshramIds && partner.scopedAshramIds.length > 0) {
      filter.ashramId = { $in: partner.scopedAshramIds };
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.startDate || query.endDate) {
      filter.checkInDate = {};
      if (query.startDate) filter.checkInDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.checkInDate.$lte = new Date(query.endDate);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .select("-guestDetails.idProof -guestDetails.idNumber -guestDetails.uploadedDocument")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.bookingModel.countDocuments(filter),
    ]);

    return {
      items: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBooking(partner: AuthenticatedPartnerContext, bookingIdOrRef: string) {
    const query = bookingIdOrRef.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: bookingIdOrRef }
      : { bookingId: bookingIdOrRef };

    const booking = await this.bookingModel
      .findOne(query)
      .select("-guestDetails.idProof -guestDetails.idNumber -guestDetails.uploadedDocument")
      .lean();

    if (!booking) throw new NotFoundException("Booking not found");

    this.assertAshramInScope(partner, booking.ashramId);
    return booking;
  }

  // -------------------------------------------------------------
  // INVENTORY AVAILABILITY READ
  // -------------------------------------------------------------
  async getAvailability(
    partner: AuthenticatedPartnerContext,
    params: {
      ashramId: string;
      roomId?: string;
      startDate: string;
      endDate: string;
    },
  ) {
    this.assertAshramInScope(partner, params.ashramId);

    const ashram = await this.ashramModel.findById(params.ashramId).lean();
    if (!ashram) throw new NotFoundException("Ashram not found");

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      throw new BadRequestException("Invalid date range");
    }

    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);

    const roomFilter: Record<string, any> = { ashramId: params.ashramId, deletedAt: null };
    if (params.roomId) roomFilter._id = params.roomId;

    const rooms = await this.roomModel.find(roomFilter).lean();
    const roomIds = rooms.map((r: any) => r._id);

    const inventoryRows = await this.inventoryModel
      .find({
        roomId: { $in: roomIds },
        date: { $gte: start, $lte: end },
      })
      .lean();

    const inventoryMap = new Map<string, any>();
    for (const row of inventoryRows) {
      const key = `${String(row.roomId)}:${new Date(row.date).toISOString().slice(0, 10)}`;
      inventoryMap.set(key, row);
    }

    const results = rooms.map((room: any) => {
      const dailyDetails: any[] = [];
      let minAvailable = Infinity;

      for (
        let cursor = new Date(start);
        cursor <= end;
        cursor = new Date(cursor.getTime() + 86_400_000)
      ) {
        const dateStr = cursor.toISOString().slice(0, 10);
        const inv = inventoryMap.get(`${String(room._id)}:${dateStr}`);

        const capacity = Number(inv?.totalInventory ?? room.totalInventory ?? 0);
        const booked = Number(inv?.bookedCount ?? 0);
        const held = Number(inv?.heldCount ?? 0);
        const maintenance = Number(inv?.maintenanceCount ?? 0);
        const isClosed = Boolean(inv?.isClosed);

        const available = isClosed ? 0 : Math.max(0, capacity - booked - held - maintenance);
        minAvailable = Math.min(minAvailable, available);

        dailyDetails.push({
          date: dateStr,
          capacity,
          booked,
          held,
          available,
          price: inv?.customPrice ?? room.basePrice,
          isClosed,
        });
      }

      return {
        roomId: room._id,
        roomName: room.name,
        roomType: room.type || room.roomType,
        basePrice: room.basePrice,
        minAvailableAcrossDates: minAvailable === Infinity ? 0 : minAvailable,
        daily: dailyDetails,
      };
    });

    return {
      ashramId: params.ashramId,
      ashramName: ashram.name,
      startDate: params.startDate,
      endDate: params.endDate,
      rooms: results,
    };
  }

  // -------------------------------------------------------------
  // PAYMENT STATUS READ
  // -------------------------------------------------------------
  async getPaymentStatus(partner: AuthenticatedPartnerContext, paymentIdOrBookingId: string) {
    const isObjectId = paymentIdOrBookingId.match(/^[0-9a-fA-F]{24}$/);
    const filter = isObjectId
      ? { $or: [{ _id: paymentIdOrBookingId }, { bookingId: paymentIdOrBookingId }] }
      : { transactionId: paymentIdOrBookingId };

    const payment = await this.paymentModel.findOne(filter).lean();
    if (!payment) throw new NotFoundException("Payment record not found");

    this.assertAshramInScope(partner, payment.ashramId);

    return {
      paymentId: payment._id,
      bookingId: payment.bookingId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      paidAt: payment.paidAt,
      transactionId: payment.transactionId,
      gatewayOrderId: payment.gateway?.orderId,
    };
  }
}
