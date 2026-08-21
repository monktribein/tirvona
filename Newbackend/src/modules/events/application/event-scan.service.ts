import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { EVENT_MODEL } from "../domain/event.constants";
import { EventException } from "../domain/event.errors";
import {
  hashEventQr,
  normalizeGateCode,
  openEventQr,
  toDateKey,
} from "../domain/event.utils";
import type { EventAccess } from "./event-access.service";
import type {
  EventManualCheckInDto,
  EventScanDto,
} from "../presentation/dtos/event.dto";

interface ScanOutcome {
  ok: boolean;
  result: string;
  message: string;
  registration?: any;
}

@Injectable()
export class EventScanService {
  constructor(
    private readonly transactions: TransactionService,
    @InjectModel(EVENT_MODEL.Registration)
    private readonly registrations: Model<any>,
    @InjectModel(EVENT_MODEL.QrCode) private readonly qrCodes: Model<any>,
    @InjectModel(EVENT_MODEL.ScanLog) private readonly scanLogs: Model<any>,
    @InjectModel(EVENT_MODEL.Event) private readonly events: Model<any>,
  ) {}

  private async log(input: Record<string, unknown>): Promise<void> {
    await this.scanLogs.create(input);
  }

  private inScope(access: EventAccess, registration: any): boolean {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return true;
    return (
      access.eventIds.includes(String(registration.eventId)) ||
      access.ashramIds.includes(String(registration.ashramId))
    );
  }

  /**
   * Accepts either the sealed QR token or the 8-character display code, which
   * is what gate staff fall back to when a phone screen will not scan in a
   * crowd. Both resolve to the same QR row so the log stays uniform.
   */
  private async resolvePass(dto: EventScanDto): Promise<any | null> {
    if (dto.token) {
      if (!openEventQr(dto.token)) return null;
      return this.qrCodes.findOne({ tokenHash: hashEventQr(dto.token) });
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
    access: EventAccess,
    dto: EventScanDto,
  ): Promise<ScanOutcome> {
    const base = {
      scannedByUserId: user.id,
      action: dto.action ?? "entry",
      tokenFingerprint: dto.token ? hashEventQr(dto.token).slice(0, 16) : "",
      deviceInfo: dto.deviceInfo ?? "",
    };

    const pass = await this.resolvePass(dto);
    if (!pass) {
      await this.log({
        ...base,
        eventId: dto.eventId ?? null,
        result: dto.token ? "invalid_token" : "not_found",
        message: "Pass could not be read.",
      });
      return {
        ok: false,
        result: "not_found",
        message: "This pass could not be verified. Please check the code.",
      };
    }

    const registration = await this.registrations.findById(pass.registrationId);
    const event = registration
      ? await this.events.findById(registration.eventId)
      : null;

    const fail = async (
      result: string,
      message: string,
    ): Promise<ScanOutcome> => {
      await this.log({
        ...base,
        registrationId: pass.registrationId,
        qrCodeId: pass._id,
        eventId: pass.eventId,
        ashramId: registration?.ashramId ?? null,
        registrationReference: registration?.registrationReference ?? "",
        seats: registration?.seats ?? 0,
        result,
        message,
      });
      return { ok: false, result, message };
    };

    if (!registration)
      return fail("not_found", "This pass has no active registration.");
    if (!this.inScope(access, registration))
      return fail("wrong_event", "This pass belongs to another event.");
    if (dto.eventId && String(registration.eventId) !== String(dto.eventId))
      return fail("wrong_event", "This pass is for a different event.");
    if (registration.status === "cancelled")
      return fail("cancelled", "This registration was cancelled.");
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
        registrationId: registration._id,
        qrCodeId: pass._id,
        eventId: registration.eventId,
        ashramId: registration.ashramId,
        registrationReference: registration.registrationReference,
        seats: registration.seats,
        result: "success",
        message: "Pass verified.",
      });
      return {
        ok: true,
        result: "success",
        message: "Pass is valid.",
        registration: { ...registration.toObject(), eventName: event?.name },
      };
    }

    if (registration.status === "checked_in" || pass.status === "used")
      return fail("already_used", "These attendees are already admitted.");

    const admitted = await this.transactions.run(async (txSession) => {
      const row = await this.registrations
        .findById(registration._id)
        .session(txSession);
      if (row.status === "checked_in")
        throw new EventException("These attendees are already admitted.", 409);
      row.status = "checked_in";
      row.checkedInAt = new Date();
      row.checkedInCount = Number(dto.admitCount ?? row.seats);
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
      registrationId: registration._id,
      qrCodeId: pass._id,
      eventId: registration.eventId,
      ashramId: registration.ashramId,
      registrationReference: registration.registrationReference,
      seats: admitted.checkedInCount,
      result: "success",
      message: "Attendees admitted.",
    });
    return {
      ok: true,
      result: "success",
      message: `${admitted.checkedInCount} attendee(s) admitted.`,
      registration: { ...admitted.toObject(), eventName: event?.name },
    };
  }

  async manualCheckIn(
    user: AuthenticatedUser,
    access: EventAccess,
    dto: EventManualCheckInDto,
  ): Promise<any> {
    const registration = await this.registrations.findOne({
      registrationReference: dto.registrationReference.toUpperCase(),
    });
    if (!registration) throw new EventException("Registration not found.", 404);
    if (!this.inScope(access, registration))
      throw new EventException("This registration is for another event.", 403);
    if (registration.status === "cancelled")
      throw new EventException("This registration was cancelled.", 400);
    if (registration.status === "checked_in")
      throw new EventException("These attendees are already admitted.", 409);

    registration.status = "checked_in";
    registration.checkedInAt = new Date();
    registration.checkedInCount = Number(dto.admitCount ?? registration.seats);
    registration.history.push({
      status: "checked_in",
      note: dto.note || "Manual check-in at counter",
      updatedBy: user.id,
    });
    await registration.save();
    await this.log({
      registrationId: registration._id,
      eventId: registration.eventId,
      ashramId: registration.ashramId,
      scannedByUserId: user.id,
      action: "entry",
      result: "success",
      registrationReference: registration.registrationReference,
      seats: registration.checkedInCount,
      message: "Manual check-in",
    });
    return registration;
  }

  async gateRoster(
    access: EventAccess,
    eventId: string,
    date: string,
  ): Promise<any> {
    const event = await this.events.findById(eventId);
    if (!event) throw new EventException("Event not found.", 404);
    if (
      !access.isPlatformAdmin &&
      !access.scopeAllAshrams &&
      !access.eventIds.includes(String(event._id)) &&
      !access.ashramIds.includes(String(event.ashramId))
    )
      throw new EventException("You do not manage this event.", 403);

    const day = toDateKey(date);
    const rows = await this.registrations
      .find({ eventId, attendDate: day, status: { $ne: "cancelled" } })
      .populate("customerId", "name phone")
      .sort({ createdAt: 1 })
      .lean();

    return {
      event: { _id: event._id, name: event.name, startTime: event.startTime },
      date: day.toISOString().slice(0, 10),
      totals: {
        registrations: rows.length,
        seats: rows.reduce((sum, row) => sum + Number(row.seats ?? 0), 0),
        admitted: rows.reduce(
          (sum, row) => sum + Number(row.checkedInCount ?? 0),
          0,
        ),
      },
      registrations: rows,
    };
  }
}
