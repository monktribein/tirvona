import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  INBOUND_RATE_LIMIT,
  SESSION_ABSOLUTE_TTL_SECONDS,
  SESSION_IDLE_TTL_SECONDS,
  SESSION_MAX_MESSAGES,
  type WhatsAppFlow,
} from "../domain/whatsapp-channel.constants";
import type { ReplyLanguage } from "./language";

/**
 * Conversation state for one WhatsApp number.
 *
 * Only identifiers and the guest's own choices are kept. Nothing sensitive
 * goes in here: no OTP, no payment credential, no QR token, no access token,
 * and no more personal data than the flow actually needs. The store is
 * ephemeral by design — if it is lost the guest is greeted afresh and nothing
 * is corrupted, because every authoritative fact lives in Mongo.
 */
export interface WhatsAppSession {
  phone: string;
  /** Set only for a matched website account. */
  userId: string | null;
  /** Set only for a WhatsApp-only guest identity. */
  whatsappCustomerId: string | null;
  /** The public WAPP code — set only alongside `whatsappCustomerId`. */
  displayId: string | null;
  flow: WhatsAppFlow | null;
  step: string | null;
  language: ReplyLanguage;
  /** Ids and selections for the flow in progress. Never secrets. */
  data: Record<string, unknown>;
  /**
   * Which list "next"/"previous" would turn, and the page on screen. Only a
   * cursor: turning a page runs the database query again for that page, so
   * nothing about the rows themselves is ever read back from here.
   */
  paging?: WhatsAppPaging;
  /** Meta's 24-hour customer service window is measured from this. */
  lastInboundAt: number;
  startedAt: number;
  messageCount: number;
}

/** A list the guest can page through, and how to fetch it again. */
export interface WhatsAppPaging {
  list:
    | "stays"
    | "rooms"
    /** Dates a chosen room category actually has open, paged a screen at a time. */
    | "check_in_dates"
    | "check_out_dates"
    | "bookings"
    | "cancel"
    | "parking_locations"
    | "parking_bays"
    | "parking_bookings"
    | "parking_cancel";
  page: number;
  /** For "stays"/"parking_locations": the search that produced the list, so page N is the same search. */
  query?: {
    place?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    /** For "parking_locations": the calendar date/time halves of the window. */
    entryAt?: string;
    entryTime?: string;
    exitAt?: string;
    exitTime?: string;
    vehicleType?: string;
  };
}

const KEY_PREFIX = "wa:session:";
const RATE_PREFIX = "wa:rate:";
const LOCK_PREFIX = "wa:lock:";

/**
 * Redis-backed conversation state, per-phone rate limiting and a per-phone
 * lock.
 *
 * Redis is already a hard dependency of this backend (BullMQ and the health
 * check), but there was no injectable client — the health controller builds
 * its own. This owns one properly managed connection for the channel rather
 * than repeating that.
 */
@Injectable()
export class WhatsAppSessionStore implements OnApplicationShutdown {
  private readonly logger = new Logger(WhatsAppSessionStore.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>("redisUrl") ?? "redis://127.0.0.1:6379",
      {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
        lazyConnect: false,
        keyPrefix: `${config.get<string>("queuePrefix") ?? "tirvona"}:`,
      },
    );
    this.redis.on("error", (error) =>
      this.logger.error(
        JSON.stringify({
          event: "whatsapp.session_store_error",
          errorType: error.name,
        }),
      ),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  private key(phone: string): string {
    return `${KEY_PREFIX}${phone}`;
  }

  /**
   * Reads the live session, or null when there is none.
   *
   * A session past its absolute lifetime or message cap is dropped rather
   * than returned, so a conversation can never carry a stale price or a stale
   * availability snapshot indefinitely, and a runaway loop cannot grow without
   * bound. The idle TTL is enforced by Redis itself.
   */
  async get(phone: string): Promise<WhatsAppSession | null> {
    const raw = await this.redis.get(this.key(phone)).catch(() => null);
    if (!raw) return null;
    let session: WhatsAppSession;
    try {
      session = JSON.parse(raw) as WhatsAppSession;
    } catch {
      await this.clear(phone);
      return null;
    }
    const agedOut =
      Date.now() - session.startedAt > SESSION_ABSOLUTE_TTL_SECONDS * 1_000;
    const tooChatty = session.messageCount > SESSION_MAX_MESSAGES;
    if (agedOut || tooChatty) {
      await this.clear(phone);
      return null;
    }
    return session;
  }

  /** Writes the session back and refreshes its idle TTL. */
  async save(session: WhatsAppSession): Promise<void> {
    await this.redis
      .set(
        this.key(session.phone),
        JSON.stringify(session),
        "EX",
        SESSION_IDLE_TTL_SECONDS,
      )
      .catch((error) => {
        // A conversation that cannot persist its state is still better served
        // by a fresh greeting than by a crash, so this is logged and swallowed.
        this.logger.error(
          JSON.stringify({
            event: "whatsapp.session_save_failed",
            errorType: error instanceof Error ? error.name : "UnknownError",
          }),
        );
      });
  }

  async clear(phone: string): Promise<void> {
    await this.redis.del(this.key(phone)).catch(() => undefined);
  }

  /** Starts a session for a guest whose previous one expired or never existed. */
  start(input: {
    phone: string;
    userId: string | null;
    whatsappCustomerId: string | null;
    displayId: string | null;
    language: ReplyLanguage;
  }): WhatsAppSession {
    const now = Date.now();
    return {
      phone: input.phone,
      userId: input.userId,
      whatsappCustomerId: input.whatsappCustomerId,
      displayId: input.displayId,
      flow: null,
      step: null,
      language: input.language,
      data: {},
      lastInboundAt: now,
      startedAt: now,
      messageCount: 0,
    };
  }

  /**
   * Per-phone inbound limit.
   *
   * Every delivery reaches us from Meta's own IP range, so the platform's
   * IP-based throttler cannot tell one abusive guest from the whole customer
   * base. Counting per number is the only limit that applies to the right
   * person.
   */
  async withinRateLimit(phone: string): Promise<boolean> {
    const key = `${RATE_PREFIX}${phone}`;
    try {
      const count = await this.redis.incr(key);
      if (count === 1)
        await this.redis.expire(key, INBOUND_RATE_LIMIT.windowSeconds);
      return count <= INBOUND_RATE_LIMIT.points;
    } catch {
      // Redis being unreachable must not silently block every customer.
      return true;
    }
  }

  /**
   * Takes a short lock for one number so two messages sent in quick
   * succession cannot advance the same flow twice — which would otherwise let
   * a double-tapped confirmation create two bookings.
   *
   * Returns a release function, or null when the lock is already held.
   */
  async acquireLock(
    phone: string,
    ttlSeconds = 30,
  ): Promise<(() => Promise<void>) | null> {
    const key = `${LOCK_PREFIX}${phone}`;
    try {
      const token = `${Date.now()}-${Math.random()}`;
      const taken = await this.redis.set(key, token, "EX", ttlSeconds, "NX");
      if (taken !== "OK") return null;
      return async () => {
        // Only release a lock we still own; a lock that already expired may
        // now belong to the next message.
        const current = await this.redis.get(key).catch(() => null);
        if (current === token) await this.redis.del(key).catch(() => undefined);
      };
    } catch {
      // Without Redis the conversation still runs, just without the guard.
      return async () => undefined;
    }
  }
}
