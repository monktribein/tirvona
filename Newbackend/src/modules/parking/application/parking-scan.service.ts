import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  PARKING_MODEL,
  PARKING_VEHICLE_META,
} from "../domain/parking.constants";
import { ParkingException } from "../domain/parking.errors";
import {
  datesInSpan,
  hashParkingQr,
  minutesBetween,
  normalizeGateCode,
  normalizeVehicleNumber,
  openParkingQr,
  parkingTransactionReference,
} from "../domain/parking.utils";
import type { ParkingAccess } from "./parking-access.service";
import { ParkingAccessService } from "./parking-access.service";
import { ParkingPricingService } from "./parking-pricing.service";
import {
  PARKING_REPOSITORY,
  ParkingRepository,
} from "../domain/parking.repository";
import { Inject } from "@nestjs/common";

@Injectable()
export class ParkingScanService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly accessService: ParkingAccessService,
    private readonly pricing: ParkingPricingService,
    @Inject(PARKING_REPOSITORY) private readonly repository: ParkingRepository,
    @InjectModel(PARKING_MODEL.QrCode) private readonly qrCodes: Model<any>,
    @InjectModel(PARKING_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(PARKING_MODEL.Location) private readonly locations: Model<any>,
    @InjectModel(PARKING_MODEL.Slot) private readonly slots: Model<any>,
    @InjectModel(PARKING_MODEL.ScanLog) private readonly scanLogs: Model<any>,
    @InjectModel(PARKING_MODEL.Payment) private readonly payments: Model<any>,
    @InjectModel(PARKING_MODEL.Transaction) private readonly ledger: Model<any>,
    @InjectModel(PARKING_MODEL.Staff) private readonly staff: Model<any>,
  ) {}

  private async log(
    user: AuthenticatedUser,
    access: ParkingAccess,
    locationId: string,
    action: string,
    result: string,
    token: string,
    message: string,
    booking?: any,
    qr?: any,
    session?: ClientSession,
  ): Promise<void> {
    await this.scanLogs.create(
      [
        {
          bookingId: booking?._id ?? qr?.bookingId ?? null,
          qrCodeId: qr?._id ?? null,
          locationId,
          scannedByUserId: user.id,
          scannedByStaffId: access.staffIds[0] ?? null,
          action,
          result,
          tokenFingerprint: token ? hashParkingQr(token).slice(0, 12) : "",
          vehicleNumber: booking?.vehicleNumber ?? "",
          assignedSlotNumber: booking?.assignedSlotNumber ?? "",
          message,
          scannedAt: new Date(),
        },
      ],
      { session },
    );
  }

  private async resolveToken(
    token: string,
    locationId: string,
    session?: ClientSession,
  ): Promise<{ qr: any; booking: any }> {
    const payload = openParkingQr(token);
    const gateCode = payload?.b ? null : normalizeGateCode(token);
    if (!payload?.b && !gateCode)
      throw new ParkingException(
        "This QR code is not valid.",
        400,
        "INVALID_TOKEN",
      );
    const qr = await this.qrCodes
      .findOne(
        gateCode
          ? { displayCode: gateCode }
          : { tokenHash: hashParkingQr(token) },
      )
      .sort({ version: -1 })
      .session(session ?? null);
    if (!qr)
      throw new ParkingException(
        gateCode
          ? "No pass found for that gate code. Check the code, or look the vehicle up by its number plate."
          : "This pass is not recognised.",
        404,
        "NOT_FOUND",
      );
    if (qr.status === "revoked")
      throw new ParkingException(
        "This pass has been revoked.",
        400,
        "INVALID_TOKEN",
      );
    if (String(qr.locationId) !== String(locationId))
      throw new ParkingException(
        "This pass belongs to a different parking location.",
        400,
        "WRONG_LOCATION",
      );
    if (new Date() > qr.validUntil)
      throw new ParkingException("This pass has expired.", 400, "EXPIRED");
    if (new Date() < qr.validFrom)
      throw new ParkingException(
        "This pass is not active yet. Please arrive closer to your booked entry time.",
        400,
        "OUT_OF_WINDOW",
      );
    const booking = await this.bookings
      .findById(qr.bookingId)
      .session(session ?? null);
    if (!booking)
      throw new ParkingException(
        "Booking not found for this pass.",
        404,
        "NOT_FOUND",
      );
    return { qr, booking };
  }

  async verify(
    user: AuthenticatedUser,
    access: ParkingAccess,
    token: string,
    locationId: string,
  ): Promise<any> {
    this.accessService.assertLocation(access, locationId);
    try {
      const result = await this.resolveToken(token, locationId);
      await this.log(
        user,
        access,
        locationId,
        "verify",
        "success",
        token,
        "Verified",
        result.booking,
        result.qr,
      );
      return result.booking;
    } catch (error) {
      await this.log(
        user,
        access,
        locationId,
        "verify",
        "invalid_token",
        token,
        error instanceof Error ? error.message : "Invalid token",
      );
      throw error;
    }
  }

  async checkIn(
    user: AuthenticatedUser,
    access: ParkingAccess,
    token: string,
    locationId: string,
  ): Promise<any> {
    this.accessService.assertLocation(access, locationId);
    const result = await this.transactions.run(async (session) => {
      const { qr, booking } = await this.resolveToken(
        token,
        locationId,
        session,
      );
      if (booking.status === "checked_in")
        throw new ParkingException(
          `This vehicle is already checked in${booking.assignedSlotNumber ? ` at bay ${booking.assignedSlotNumber}` : ""}.`,
          409,
          "ALREADY_USED",
        );
      if (booking.status !== "upcoming")
        throw new ParkingException("This booking cannot be checked in.", 400);
      if (booking.paymentStatus !== "paid")
        throw new ParkingException(
          "Payment for this booking is not complete.",
          402,
          "NOT_PAID",
        );
      const slot = await this.slots.findOneAndUpdate(
        {
          locationId,
          slotTypeId: booking.slotTypeId,
          status: "available",
          isActive: true,
        },
        {
          $set: {
            status: "occupied",
            currentBookingId: booking._id,
            occupiedAt: new Date(),
          },
        },
        { new: true, sort: { slotNumber: 1 }, session },
      );
      booking.status = "checked_in";
      booking.checkedInAt = new Date();
      if (slot) {
        booking.assignedSlotId = slot._id;
        booking.assignedSlotNumber = slot.slotNumber;
      }
      booking.history.push({
        status: "checked_in",
        note: slot ? `Checked in at bay ${slot.slotNumber}` : "Checked in",
        updatedBy: user.id,
      });
      await booking.save({ session });
      qr.entryScannedAt = new Date();
      qr.scanCount += 1;
      await qr.save({ session });
      await this.log(
        user,
        access,
        locationId,
        "entry",
        "success",
        token,
        "Entry granted",
        booking,
        qr,
        session,
      );
      await this.staff.updateMany(
        { userId: user.id, status: "active" },
        { $set: { lastActiveAt: new Date() } },
        { session },
      );
      return { booking, slot };
    });
    return {
      ...result,
      message: result.slot
        ? `Entry granted. Direct the vehicle to bay ${result.slot.slotNumber}.`
        : "Entry granted.",
    };
  }

  async checkOut(
    user: AuthenticatedUser,
    access: ParkingAccess,
    token: string,
    locationId: string,
    method: string,
  ): Promise<any> {
    this.accessService.assertLocation(access, locationId);
    return this.transactions.run(async (session) => {
      const { qr, booking } = await this.resolveToken(
        token,
        locationId,
        session,
      );
      if (booking.status !== "checked_in")
        throw new ParkingException(
          booking.status === "checked_out"
            ? "This vehicle has already exited."
            : "This vehicle is not currently checked in.",
          400,
        );
      const now = new Date();
      const location = await this.locations
        .findById(locationId)
        .session(session);
      const settings = await this.pricing.resolveSettings(
        locationId,
        String(location.partnerId),
      );
      const overdue = minutesBetween(booking.exitAt, now);
      const chargeableHours =
        overdue <= settings.overstayGraceMinutes
          ? 0
          : Math.ceil((overdue - settings.overstayGraceMinutes) / 60);
      const card = await this.pricing.findRateCard(
        locationId,
        String(booking.slotTypeId),
        booking.vehicleType,
        booking.entryAt,
      );
      const subtotal = Math.round(
        chargeableHours *
          Number(card?.hourlyRate ?? 0) *
          Number(card?.overstayMultiplier ?? settings.overstayMultiplier),
      );
      const amount =
        subtotal +
        Math.round(
          (subtotal * Number(card?.taxPercent ?? settings.taxPercent)) / 100,
        );
      if (amount > 0) {
        const [payment] = await this.payments.create(
          [
            {
              bookingId: booking._id,
              userId: booking.customerId,
              partnerId: booking.partnerId,
              amount,
              purpose: "overstay",
              method,
              status: "paid",
              paidAt: now,
              transactionId: `PKOVR-${Date.now()}`,
            },
          ],
          { session },
        );
        await this.ledger.create(
          [
            {
              bookingId: booking._id,
              paymentId: payment._id,
              partnerId: booking.partnerId,
              locationId,
              type: "overstay",
              direction: "credit",
              amount,
              description: `Overstay collected for ${booking.bookingReference}`,
              reference: parkingTransactionReference(),
              recordedBy: user.id,
            },
          ],
          { session },
        );
      }
      booking.status = "checked_out";
      booking.checkedOutAt = now;
      booking.actualDurationMinutes = minutesBetween(booking.checkedInAt, now);
      booking.overstayMinutes = overdue;
      booking.pricing.overstayAmount = amount;
      booking.pricing.amountPaid += amount;
      booking.pricing.totalAmount += amount;
      booking.history.push({
        status: "checked_out",
        note: amount
          ? `Checked out with ₹${amount} overstay (${overdue} min)`
          : "Checked out",
        updatedBy: user.id,
      });
      await booking.save({ session });
      if (booking.assignedSlotId)
        await this.slots.updateOne(
          { _id: booking.assignedSlotId },
          {
            $set: {
              status: "available",
              currentBookingId: null,
              occupiedAt: null,
            },
          },
          { session },
        );
      const units = Math.max(
        1,
        Math.ceil(
          PARKING_VEHICLE_META[
            booking.vehicleType as keyof typeof PARKING_VEHICLE_META
          ]?.footprint ?? 1,
        ),
      );
      await this.repository.releaseInventory({
        slotTypeId: String(booking.slotTypeId),
        dates:
          booking.occupiedDates ?? datesInSpan(booking.entryAt, booking.exitAt),
        units,
        session,
      });
      qr.exitScannedAt = now;
      qr.scanCount += 1;
      qr.status = "used";
      await qr.save({ session });
      await this.log(
        user,
        access,
        locationId,
        "exit",
        "success",
        token,
        "Exit granted",
        booking,
        qr,
        session,
      );
      return {
        booking,
        overstay: {
          overstayMinutes: overdue,
          chargeableHours,
          totalAmount: amount,
        },
        message: amount
          ? `Exit granted. Overstay of ₹${amount} collected.`
          : "Exit granted. Thank you.",
      };
    });
  }

  async lookup(
    user: AuthenticatedUser,
    access: ParkingAccess,
    locationId: string,
    vehicleNumber: string,
  ): Promise<any> {
    this.accessService.assertLocation(access, locationId);
    const booking = await this.bookings
      .findOne({
        locationId,
        vehicleNumber: normalizeVehicleNumber(vehicleNumber),
        status: { $in: ["upcoming", "checked_in"] },
      })
      .populate("locationId", "name slug")
      .populate("slotTypeId", "name code");
    await this.log(
      user,
      access,
      locationId,
      "verify",
      booking ? "success" : "not_found",
      "",
      `Manual lookup for ${vehicleNumber}`,
      booking,
    );
    if (!booking)
      throw new ParkingException(
        "No active parking booking found for this vehicle here.",
        404,
      );
    return booking;
  }
}
