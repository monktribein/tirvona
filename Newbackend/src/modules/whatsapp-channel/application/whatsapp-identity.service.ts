import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { WhatsAppResolvedIdentity } from "../../bookings/domain/booking-customer";
import { normalizeWhatsAppNumber } from "../../../integrations/whatsapp/utils/whatsapp-phone.util";
import { WHATSAPP_CHANNEL_MODEL } from "../domain/whatsapp-channel.constants";
import {
  formatWhatsAppCustomerCode,
  generateWhatsAppCustomerSuffix,
} from "../domain/whatsapp-customer.code";

export interface WhatsAppCustomerIdentity {
  id: string;
  wappId: string;
  phone: string;
  name: string;
  language: "en" | "hi" | "hinglish";
  status: "active" | "blocked";
}

/**
 * Resolves a verified WhatsApp sender to a Tirvona identity, creating a
 * non-login `WhatsAppCustomer` on first contact from a genuinely new number.
 *
 * This service never *writes* to the `users` collection, and never invents an
 * email, a password, or any other website-account field. It does read `users`
 * — read-only, by phone number only — for exactly one purpose: if the number
 * already belongs to a registered Tirvona account, a WhatsApp booking from
 * that number is made under that account's own identity, so the customer
 * sees one booking history whichever channel they use and Admin/Owner show
 * their real registered name. No website flow is touched by this: nothing
 * here calls `save`, `create`, `updateOne` or any other write against `User`.
 *
 * A number that matches no account gets a separate, non-login WhatsApp
 * identity instead — this is never a website account, is never given a
 * password, and is never merged into one automatically. Account linking, if
 * it is ever built, is an explicit opt-in the guest performs later.
 */
@Injectable()
export class WhatsAppIdentityService {
  private readonly logger = new Logger(WhatsAppIdentityService.name);

  constructor(
    @InjectModel(WHATSAPP_CHANNEL_MODEL.Customer)
    private readonly customers: Model<any>,
    @InjectModel("User")
    private readonly users: Model<any>,
  ) {}

  /**
   * Normalizes an inbound number to the digits-only international form the
   * rest of the platform already uses. Throws rather than returning a
   * half-valid value, so a malformed number can never become a customer key.
   */
  normalize(rawPhone: string): string {
    const phone = normalizeWhatsAppNumber(String(rawPhone ?? ""));
    if (!phone)
      throw new BadRequestException("WhatsApp sender number is not valid");
    return phone;
  }

  private toIdentity(row: any): WhatsAppCustomerIdentity {
    return {
      id: String(row._id),
      wappId: row.wappId,
      phone: row.phone,
      name: row.name ?? "",
      language: row.language ?? "hinglish",
      status: row.status ?? "active",
    };
  }

  /**
   * The candidate forms a website `User.phone` might be stored in for one
   * normalized number — mirrors `AuthService.findUserByPhoneInput`'s
   * candidate list (10-digit local, and `+`-prefixed) so this can never
   * disagree with the website's own phone login about who a number belongs
   * to. Duplicated rather than imported: `AuthService`'s method is private,
   * and reaching into the auth module from here would be a much larger
   * change than this read-only lookup calls for.
   */
  private phoneCandidates(normalizedPhone: string): string[] {
    const candidates = [
      normalizedPhone,
      normalizedPhone.startsWith("91") && normalizedPhone.length === 12
        ? normalizedPhone.slice(2)
        : undefined,
      `+${normalizedPhone}`,
    ].filter((value): value is string => Boolean(value));
    return Array.from(new Set(candidates));
  }

  /**
   * Looks up a registered website account by phone number. Read-only: this
   * never creates, updates or deletes a `User` document, and is the only
   * thing in this service that touches the `users` collection at all.
   */
  private async findWebsiteAccount(normalizedPhone: string): Promise<any | null> {
    for (const candidate of this.phoneCandidates(normalizedPhone)) {
      const account = await this.users
        .findOne({ phone: candidate })
        .select("name email phone role status")
        .lean();
      if (account) return account;
    }
    return null;
  }

  /**
   * Resolves a verified sender to whichever identity actually owns the
   * number: a matched website account, or — only when no account matches —
   * a WhatsApp-only guest identity.
   *
   * This is the entry point the conversation engine and the action layer
   * use. `resolve()` below remains for the guest-only path (also used
   * directly by admin/support lookups), but every place that turns an
   * inbound message into a booking actor should go through this method so an
   * existing customer is never quietly duplicated as a second identity.
   */
  async resolveIdentity(
    rawPhone: string,
    profileName?: string,
  ): Promise<WhatsAppResolvedIdentity> {
    const phone = this.normalize(rawPhone);
    const account = await this.findWebsiteAccount(phone);
    if (account)
      return {
        kind: "account",
        userId: String(account._id),
        whatsappCustomerId: null,
        displayId: null,
        name: account.name ?? "",
        phone: account.phone ?? phone,
        role: account.role ?? "customer",
        // No per-channel language preference is stored on `User`; the
        // conversation falls back to the session's own language, then to the
        // channel default.
        language: null,
        status: account.status === "active" ? "active" : "blocked",
      };

    const guest = await this.resolve(phone, profileName);
    return {
      kind: "guest",
      userId: null,
      whatsappCustomerId: guest.id,
      displayId: guest.wappId,
      name: guest.name,
      phone: guest.phone,
      role: "whatsapp_customer",
      language: guest.language,
      status: guest.status,
    };
  }

  /** Looks up an existing WhatsApp-only identity without creating one. */
  async find(rawPhone: string): Promise<WhatsAppCustomerIdentity | null> {
    const phone = this.normalize(rawPhone);
    const row = await this.customers.findOne({ phone }).lean();
    return row ? this.toIdentity(row) : null;
  }

  /** Looks up a WhatsApp-only identity by its public WAPP code. Used by admin and support. */
  async findByWappId(
    wappId: string,
  ): Promise<WhatsAppCustomerIdentity | null> {
    const row = await this.customers
      .findOne({ wappId: String(wappId ?? "").trim().toUpperCase() })
      .lean();
    return row ? this.toIdentity(row) : null;
  }

  /**
   * Returns the WhatsApp-only identity for this number, creating it on first
   * contact. Callers that need to honour an existing website account should
   * use `resolveIdentity` instead — this method always deals in
   * `WhatsAppCustomer` rows and never consults `users`.
   *
   * Concurrency is handled by the unique index on `phone` rather than by a
   * read-then-write check, which would race: two simultaneous first messages
   * from the same number would both see "no customer" and both insert. Here
   * the loser of that race gets a duplicate key error and re-reads the
   * winner's row, so the number still ends up with exactly one WAPP id.
   *
   * The WAPP code itself (`WAPP-YYYYMMDD-XXXXXX`) is generated fresh on each
   * attempt: on the rare chance the random suffix collides with an existing
   * code, the loop simply tries again with a new one, exactly as
   * `financialReference` and `bookingReference` do elsewhere in this
   * codebase. There is no shared counter to contend on.
   */
  async resolve(
    rawPhone: string,
    profileName?: string,
  ): Promise<WhatsAppCustomerIdentity> {
    const phone = this.normalize(rawPhone);
    const existing = await this.customers.findOne({ phone });
    if (existing) return this.touch(existing, profileName);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const createdAt = new Date();
      const wappId = formatWhatsAppCustomerCode(
        createdAt,
        generateWhatsAppCustomerSuffix(),
      );
      try {
        const created = await this.customers.create({
          wappId,
          phone,
          name: (profileName ?? "").trim(),
          whatsappVerified: true,
          lastSeenAt: createdAt,
        });
        this.logger.log(
          JSON.stringify({
            event: "whatsapp.customer_created",
            wappId,
            // The number itself is never logged.
            phoneSuffix: phone.slice(-4),
          }),
        );
        return this.toIdentity(created);
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
        // Either another delivery for this number won the race (re-read it),
        // or the generated code collided with an existing one (retry with a
        // freshly generated suffix).
        const raced = await this.customers.findOne({ phone });
        if (raced) return this.touch(raced, profileName);
      }
    }
    throw new ServiceUnavailableException(
      "Could not register this WhatsApp number. Please try again.",
    );
  }

  /**
   * Records the contact and fills in a name we did not have. An existing name
   * is never overwritten from Meta's profile, because the guest may have
   * given a different name during a booking and that one is the one the owner
   * will see on the booking.
   */
  private async touch(
    row: any,
    profileName?: string,
  ): Promise<WhatsAppCustomerIdentity> {
    const name = (profileName ?? "").trim();
    const update: Record<string, unknown> = { lastSeenAt: new Date() };
    if (name && !row.name) update.name = name;
    await this.customers.updateOne({ _id: row._id }, { $set: update });
    return this.toIdentity({ ...row.toObject?.() ?? row, ...update });
  }

  /** Records a name the guest gave us during a conversation. Guest identities only. */
  async setName(id: string, name: string): Promise<void> {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return;
    await this.customers.updateOne({ _id: id }, { $set: { name: trimmed } });
  }

  /** Remembers the language a guest is writing in, across conversations. Guest identities only. */
  async setLanguage(
    id: string,
    language: "en" | "hi" | "hinglish",
  ): Promise<void> {
    await this.customers.updateOne({ _id: id }, { $set: { language } });
  }
}
