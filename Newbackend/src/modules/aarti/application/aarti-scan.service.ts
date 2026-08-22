import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { AARTI_MODEL } from "../domain/aarti.constants";
import { AartiException } from "../domain/aarti.errors";
import {
  hashAartiQr,
  normalizeGateCode,
  openAartiQr,
} from "../domain/aarti.utils";
import { AartiPricingService } from "./aarti-pricing.service";
import type { AartiAccess } from "./aarti-access.service";
import type { GateScanDto, ManualCheckInDto } from "../presentation/dtos/aarti.dto";

interface ScanOutcome {
  ok: boolean;
  result: string;
  message: string;
  booking?: any;
}

@Injectable()
export class AartiScanService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly pricing: AartiPricingService,
    @InjectModel(AARTI_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(AARTI_MODEL.QrCode) private readonly qrCodes: Model<any>,
    @InjectModel(AARTI_MODEL.ScanLog) private readonly scanLogs: Model<any>,
    @InjectModel(AARTI_MODEL.Session) private readonly sessions: Model<any>,
  ) {}

  private async log(input: Record<string, unknown>): Promise<void> {
    await this.scanLogs.create(input);
  }

  /**
   * Resolves either form of pass a devotee can present: the sealed QR token, or
   * the 8-character display code read aloud at a crowded ghat where phone
   * cameras fail. Both land on the same QR row, so the gate log stays uniform.
   */
  private async resolvePass(dto: GateScanDto): Promise<any | null> {
    if (dto.token) {
      const payload = openAartiQr(dto.token);
      if (!payload) return null;
      return this.qrCodes.findOne({ tokenHash: hashAartiQr(dto.token) });
    }
    if (dto.displayCode) {
      const normalized = normalizeGateCode(dto.displayCode);
      if (!normalized) return null;
      return this.qrCodes.findOne({ displayCode: normalized });
    }
    return null;
  }

  async scan(
    user: AuthenticatedUser,
    access: AartiAccess,
    dto: GateScanDto,
  ): Promise<ScanOutcome> {
    const base = {
      scannedByUserId: user.id,
      action: dto.action ?? "entry",
      tokenFingerprint: dto.token ? hashAartiQr(dto.token).slice(0, 16) : "",
      deviceInfo: dto.deviceInfo ?? "",
    };

    const pass = await this.resolvePass(dto);
    if (!pass) {
      await this.log({
        ...base,
        sessionId: dto.sessionId ?? null,
        result: dto.token ? "invalid_token" : "not_found",
        message: "Pass could not be read.",
      });
      return {
        ok: false,
        result: "not_found",
        message: "This pass could not be verified. Please check the code.",
      };
    }

    const booking = await this.bookings.findById(pass.bookingId);
    const session = booking
      ? await this.sessions.findById(booking.sessionId)
      : null;
    const fail = async (result: string, message: string): Promise<ScanOutcome> => {
      await this.log({
        ...base,
        bookingId: pass.bookingId,
        qrCodeId: pass._id,
        sessionId: pass.sessionId,
        ashramId: booking?.ashramId ?? null,
        bookingReference: booking?.bookingReference ?? "",
        passCount: booking?.passCount ?? 0,
        result,
        message,
      });
      return { ok: false, result, message };
    };

    if (!booking) return fail("not_found", "This pass has no active booking.");
    if (!access.isPlatformAdmin && !access.scopeAllAshrams) {
      const inScope =
        access.sessionIds.includes(String(booking.sessionId)) ||
        access.ashramIds.includes(String(booking.ashramId));
      if (!inScope)
        return fail("wrong_session", "This pass belongs to another aarti.");
    }
    if (dto.sessionId && String(booking.sessionId) !== String(dto.sessionId))
      return fail("wrong_session", "This pass is for a different aarti.");
    if (booking.status === "cancelled")
      return fail("cancelled", "This booking was cancelled.");
    if (booking.paymentStatus !== "paid")
      return fail("not_paid", "Payment for this booking is not complete.");
    if (pass.status === "revoked")
      return fail("expired", "This pass was replaced. Ask for the latest pass.");

    const now = new Date();
    if (now < pass.validFrom || now > pass.validUntil)
      return fail(
        "out_of_window",
        `This pass is valid from ${new Date(pass.validFrom).toLocaleString("en-IN")}.`,
      );

    if (dto.action === "verify") {
      await this.log({
        ...base,
        bookingId: booking._id,
        qrCodeId: pass._id,
        sessionId: booking.sessionId,
        ashramId: booking.ashramId,
        bookingReference: booking.bookingReference,
        passCount: booking.passCount,
        result: "success",
        message: "Pass verified.",
      });
      return {
        ok: true,
        result: "success",
        message: "Pass is valid.",
        booking: { ...booking.toObject(), sessionName: session?.name },
      };
    }

    if (booking.status === "checked_in" || pass.status === "used")
      return fail("already_used", "These devotees are already admitted.");

    const admitted = await this.transactions.run(async (txSession) => {
      const row = await this.bookings.findById(booking._id).session(txSession);
      if (row.status === "checked_in")
        throw new AartiException("These devotees are already admitted.", 409);
      row.status = "checked_in";
      row.checkedInAt = new Date();
      row.checkedInCount = Number(dto.admitCount ?? row.passCount);
      row.history.push({
        status: "checked_in",
        note: "Admitted at gate",
        updatedBy: user.id,
      });
      await row.save({ session: txSession });
      await this.qrCodes.updateOne(
        { _id: pass._id },
        {
          $set: { status: "used", entryScannedAt: new Date() },
          $inc: { scanCount: 1 },
        },
        { session: txSession },
      );
      return row;
    });

    await this.log({
      ...base,
      bookingId: booking._id,
      qrCodeId: pass._id,
      sessionId: booking.sessionId,
      ashramId: booking.ashramId,
      bookingReference: booking.bookingReference,
      passCount: admitted.checkedInCount,
      result: "success",
      message: "Devotees admitted.",
    });
    return {
      ok: true,
      result: "success",
      message: `${admitted.checkedInCount} devotee(s) admitted.`,
      booking: { ...admitted.toObject(), sessionName: session?.name },
    };
  }

  async manualCheckIn(
    user: AuthenticatedUser,
    access: AartiAccess,
    dto: ManualCheckInDto,
  ): Promise<any> {
    const booking = await this.bookings.findOne({
      bookingReference: dto.bookingReference.toUpperCase(),
    });
    if (!booking) throw new AartiException("Booking not found.", 404);
    if (!access.isPlatformAdmin && !access.scopeAllAshrams) {
      const inScope =
        access.sessionIds.includes(String(booking.sessionId)) ||
        access.ashramIds.includes(String(booking.ashramId));
      if (!inScope)
        throw new AartiException("This booking is for another aarti.", 403);
    }
    if (booking.paymentStatus !== "paid")
      throw new AartiException("Payment for this booking is not complete.", 400);
    if (booking.status === "cancelled")
      throw new AartiException("This booking was cancelled.", 400);
    if (booking.status === "checked_in")
      throw new AartiException("These devotees are already admitted.", 409);

    booking.status = "checked_in";
    booking.checkedInAt = new Date();
    booking.checkedInCount = Number(dto.admitCount ?? booking.passCount);
    booking.history.push({
      status: "checked_in",
      note: dto.note || "Manual check-in at counter",
      updatedBy: user.id,
    });
    await booking.save();
    await this.log({
      bookingId: booking._id,
      sessionId: booking.sessionId,
      ashramId: booking.ashramId,
      scannedByUserId: user.id,
      action: "entry",
      result: "success",
      bookingReference: booking.bookingReference,
      passCount: booking.checkedInCount,
      message: "Manual check-in",
    });
    return booking;
  }

  async gateRoster(
    access: AartiAccess,
    sessionId: string,
    date: string,
  ): Promise<any> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new AartiException("Aarti not found.", 404);
    if (!access.isPlatformAdmin && !access.scopeAllAshrams) {
      const inScope =
        access.sessionIds.includes(String(session._id)) ||
        access.ashramIds.includes(String(session.ashramId));
      if (!inScope) throw new AartiException("You do not manage this aarti.", 403);
    }
    const day = new Date(date);
    const start = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
    );
    const rows = await this.bookings
      .find({
        sessionId,
        sessionDate: start,
        paymentStatus: "paid",
        status: { $ne: "cancelled" },
      })
      .populate("passTypeId", "name code zoneLabel")
      .sort({ createdAt: 1 })
      .lean();
    const settings = await this.pricing.resolveSettings(
      String(session._id),
      String(session.ashramId),
    );
    return {
      session: { _id: session._id, name: session.name, startTime: session.startTime },
      date: start.toISOString().slice(0, 10),
      gateOpensBeforeMinutes: settings.gateOpensBeforeMinutes,
      totals: {
        bookings: rows.length,
        passes: rows.reduce((sum, row) => sum + Number(row.passCount ?? 0), 0),
        admitted: rows.reduce(
          (sum, row) => sum + Number(row.checkedInCount ?? 0),
          0,
        ),
      },
      bookings: rows,
    };
  }
}
