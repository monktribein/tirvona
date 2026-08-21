import { Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import QRCode from "qrcode";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { EVENT_MODEL } from "../domain/event.constants";
import { EVENT_REPOSITORY, EventRepository } from "../domain/event.repository";
import { EventException } from "../domain/event.errors";
import {
  combineDateAndTime,
  eventDisplayCode,
  eventRegistrationReference,
  hashEventQr,
  runsOnDate,
  sealEventQr,
  toDateKey,
} from "../domain/event.utils";
import { EventSettingsService } from "./event-settings.service";
import type {
  CancelRegistrationDto,
  CreateRegistrationDto,
} from "../presentation/dtos/event.dto";

@Injectable()
export class EventRegistrationService {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly repository: EventRepository,
    private readonly transactions: TransactionService,
    private readonly settingsService: EventSettingsService,
    @InjectModel(EVENT_MODEL.Registration)
    private readonly registrations: Model<any>,
    @InjectModel(EVENT_MODEL.QrCode) private readonly qrCodes: Model<any>,
    @InjectModel(EVENT_MODEL.Notification)
    private readonly notifications: Model<any>,
    @InjectModel(EVENT_MODEL.Event) private readonly events: Model<any>,
  ) {}

  async register(
    user: AuthenticatedUser,
    dto: CreateRegistrationDto,
  ): Promise<any> {
    const event = await this.repository.findEventById(dto.eventId);
    if (!event || event.status !== "approved")
      throw new EventException(
        "This event is not open for registration.",
        404,
        "EVENT_NOT_FOUND",
      );

    const settings = await this.settingsService.resolve(
      String(event._id),
      String(event.ashramId),
    );
    if (!settings.allowRegistration || event.requiresRegistration === false)
      throw new EventException(
        "This event does not need a registration — just come along.",
        400,
        "REGISTRATION_DISABLED",
      );

    const date = toDateKey(dto.attendDate);
    if (!runsOnDate(event, date))
      throw new EventException(
        "This event does not run on the date you selected.",
        400,
        "NOT_SCHEDULED",
      );

    const startsAt = combineDateAndTime(
      date,
      event.startTime || "09:00",
      event.timezone,
    );
    const endsAt = new Date(
      startsAt.getTime() + Number(event.durationMinutes || 180) * 60_000,
    );

    const opensFrom = Date.now();
    if (
      (startsAt.getTime() - opensFrom) / 86_400_000 >
      Number(settings.registrationOpensDaysAhead)
    )
      throw new EventException(
        `Registration opens ${settings.registrationOpensDaysAhead} days before the event.`,
        400,
        "TOO_FAR_AHEAD",
      );
    if (
      startsAt.getTime() - opensFrom <
      Number(settings.registrationClosesBeforeMinutes) * 60_000
    )
      throw new EventException(
        "Registration for this day has closed.",
        400,
        "REGISTRATION_CLOSED",
      );

    const maxSeats = Math.min(
      Number(event.maxSeatsPerRegistration || settings.maxSeatsPerRegistration),
      Number(settings.maxSeatsPerRegistration),
    );
    if (dto.seats > maxSeats)
      throw new EventException(
        `You can register up to ${maxSeats} people at a time.`,
        400,
        "TOO_MANY_SEATS",
      );
    if (settings.requireAttendeeNames && (dto.attendees?.length ?? 0) < dto.seats)
      throw new EventException(
        "This event requires the name of everyone attending.",
        400,
        "ATTENDEE_NAMES_REQUIRED",
      );

    if (
      await this.registrations.exists({
        eventId: event._id,
        attendDate: date,
        customerId: user.id,
        status: { $in: ["confirmed", "checked_in", "attended"] },
      })
    )
      throw new EventException(
        "You are already registered for this day. Check My Event Passes.",
        409,
        "ALREADY_REGISTERED",
      );

    const result = await this.transactions.run(async (txSession) => {
      const held = await this.repository.reserveSeats({
        eventId: String(event._id),
        date,
        seats: dto.seats,
        capacity: Number(event.dailyCapacity ?? 0),
        session: txSession,
      });
      if (!held.ok)
        throw new EventException(
          held.remaining
            ? `Only ${held.remaining} place(s) are left for this day.`
            : "This day is fully booked.",
          409,
          "NO_AVAILABILITY",
        );

      const [created] = await this.registrations.create(
        [
          {
            registrationReference: eventRegistrationReference(),
            customerId: user.id,
            eventId: event._id,
            ashramId: event.ashramId,
            attendDate: date,
            startsAt,
            endsAt,
            seats: dto.seats,
            attendees: dto.attendees ?? [],
            contactName: dto.contactName || user.name,
            contactPhone: dto.contactPhone || user.phone || "",
            contactEmail: dto.contactEmail || user.email || "",
            status: "confirmed",
            history: [
              {
                status: "confirmed",
                note: "Registered",
                updatedBy: user.id,
              },
            ],
            source: "web",
          },
        ],
        { session: txSession },
      );

      const pass = await this.issuePass(created, txSession);
      await this.notifications.create(
        [
          {
            userId: created.customerId,
            registrationId: created._id,
            event: "registration_confirmed",
            title: "Event Pass Confirmed",
            message: `Your place at ${event.name} is confirmed.`,
            channel: "in_app",
            status: "queued",
            recipientPhone: created.contactPhone || "",
            meta: {
              registrationReference: created.registrationReference,
              displayCode: pass.displayCode,
              eventName: event.name,
            },
          },
        ],
        { session: txSession },
      );
      return { registration: created, pass };
    });

    return {
      ...result,
      qr: {
        ...result.pass,
        image: await QRCode.toDataURL(result.pass.token, {
          width: 512,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      },
    };
  }

  private async issuePass(
    registration: any,
    session: ClientSession,
  ): Promise<any> {
    const settings = await this.settingsService.resolve(
      String(registration.eventId),
      String(registration.ashramId),
    );
    const previous = await this.qrCodes
      .findOne({ registrationId: registration._id })
      .sort({ version: -1 })
      .session(session);
    if (previous?.status === "active") {
      previous.status = "revoked";
      previous.revokedReason = "Superseded by a reissued pass";
      await previous.save({ session });
    }
    const displayCode = eventDisplayCode();
    const version = Number(previous?.version ?? 0) + 1;
    const validFrom = new Date(
      new Date(registration.startsAt).getTime() -
        Number(settings.gateOpensBeforeMinutes) * 60_000,
    );
    const validUntil = new Date(
      new Date(registration.endsAt).getTime() +
        Number(settings.qrValidityBufferMinutes) * 60_000,
    );
    const token = sealEventQr({
      v: 1,
      r: String(registration._id),
      ref: registration.registrationReference,
      e: String(registration.eventId),
      u: String(registration.customerId),
      s: registration.seats,
      st: registration.startsAt,
      en: registration.endsAt,
      vf: validFrom,
      vu: validUntil,
      d: displayCode,
      ver: version,
    });
    await this.qrCodes.create(
      [
        {
          registrationId: registration._id,
          eventId: registration.eventId,
          customerId: registration.customerId,
          tokenHash: hashEventQr(token),
          token,
          displayCode,
          version,
          validFrom,
          validUntil,
          status: "active",
        },
      ],
      { session },
    );
    return { token, displayCode, validFrom, validUntil };
  }

  async ownRegistration(id: string, userId: string): Promise<any> {
    const registration = await this.repository.findRegistrationForCustomer(
      id,
      userId,
    );
    if (!registration) throw new EventException("Registration not found.", 404);
    return registration;
  }

  listMine(
    userId: string,
    status: string | undefined,
    page: number,
    limit: number,
  ): Promise<any> {
    return this.repository.listRegistrations(
      { customerId: userId, ...(status ? { status } : {}) },
      page,
      Math.min(limit, 50),
    );
  }

  private async renderPass(
    pass: { token: string; [key: string]: unknown },
    registration: any,
    format: string,
  ): Promise<any> {
    const image =
      format === "svg"
        ? await QRCode.toString(pass.token, {
            type: "svg",
            margin: 2,
            errorCorrectionLevel: "M",
          })
        : await QRCode.toDataURL(pass.token, {
            width: 512,
            margin: 2,
            errorCorrectionLevel: "M",
          });
    return {
      format,
      image,
      ...pass,
      registrationReference: registration.registrationReference,
      seats: registration.seats,
      startsAt: registration.startsAt,
    };
  }

  private async assertPassable(id: string, userId: string): Promise<any> {
    const registration = await this.ownRegistration(id, userId);
    if (["cancelled", "no_show"].includes(registration.status))
      throw new EventException(
        "This registration no longer has a valid pass.",
        400,
      );
    return registration;
  }

  async currentPass(id: string, userId: string, format: string): Promise<any> {
    const registration = await this.assertPassable(id, userId);
    const existing = await this.qrCodes
      .findOne({
        registrationId: registration._id,
        status: { $in: ["active", "used"] },
      })
      .sort({ version: -1 })
      .select("+token");
    if (existing?.token)
      return this.renderPass(
        {
          token: existing.token,
          displayCode: existing.displayCode,
          validFrom: existing.validFrom,
          validUntil: existing.validUntil,
        },
        registration,
        format,
      );
    const pass = await this.transactions.run((session) =>
      this.issuePass(registration, session),
    );
    return this.renderPass(pass, registration, format);
  }

  async reissuePass(id: string, userId: string, format: string): Promise<any> {
    const registration = await this.assertPassable(id, userId);
    const pass = await this.transactions.run((session) =>
      this.issuePass(registration, session),
    );
    return this.renderPass(pass, registration, format);
  }

  async cancel(
    id: string,
    user: AuthenticatedUser,
    dto: CancelRegistrationDto,
    bypassOwnership = false,
  ): Promise<any> {
    const existing = bypassOwnership
      ? await this.repository.findRegistration(id)
      : await this.ownRegistration(id, user.id);
    if (!existing) throw new EventException("Registration not found.", 404);

    const settings = await this.settingsService.resolve(
      String(existing.eventId),
      String(existing.ashramId),
    );
    if (!settings.allowCancellation && !bypassOwnership)
      throw new EventException(
        "This registration cannot be cancelled online.",
        400,
      );

    return this.transactions.run(async (txSession) => {
      const row = await this.registrations
        .findOne({
          _id: id,
          ...(bypassOwnership ? {} : { customerId: user.id }),
        })
        .session(txSession);
      if (!row || ["cancelled", "attended"].includes(row.status))
        throw new EventException("This registration is already closed.", 400);
      if (row.status === "checked_in")
        throw new EventException(
          "Attendees already admitted cannot be cancelled.",
          400,
        );

      row.status = "cancelled";
      row.cancellation = {
        reason: dto.reason || "Cancelled by attendee",
        cancelledAt: new Date(),
        cancelledBy: user.id,
      };
      row.history.push({
        status: "cancelled",
        note: dto.reason,
        updatedBy: user.id,
      });
      await row.save({ session: txSession });

      await this.repository.releaseSeats({
        eventId: String(row.eventId),
        date: row.attendDate,
        seats: Number(row.seats),
        session: txSession,
      });
      await this.qrCodes.updateMany(
        { registrationId: row._id, status: "active" },
        { $set: { status: "revoked", revokedReason: "Registration cancelled" } },
        { session: txSession },
      );
      await this.notifications.create(
        [
          {
            userId: row.customerId,
            registrationId: row._id,
            event: "cancellation",
            title: "Event Registration Cancelled",
            message: `Registration ${row.registrationReference} was cancelled.`,
            channel: "in_app",
            status: "queued",
            recipientPhone: row.contactPhone || "",
            meta: { registrationReference: row.registrationReference },
          },
        ],
        { session: txSession },
      );
      return row;
    });
  }
}
