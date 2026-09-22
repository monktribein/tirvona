import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { copy, formatMoney } from "./copy";
import { resolveReplyLanguage } from "./language";
import {
  extractStayEntities,
  isDiscoveryPhrasing,
  understand,
  type Intent,
  type StayEntities,
} from "./nlu";
import {
  isoDateToUtcMidnight,
  mergeStaySlots,
  nextMissingStaySlot,
  type RequiredStaySlot,
  type StaySlots,
} from "./stay-slots";
import { HttpException } from "@nestjs/common";
import type { WhatsAppResolvedIdentity } from "../../bookings/domain/booking-customer";
import { stayCopy, money } from "./copy-stay";
import {
  extractCouponCode,
  extractPartySplit,
  extractRoomRequest,
  extractServiceCommands,
  isCouponQuestion,
  isCouponRemoval,
  isOfferQuestion,
  isPriceQuestion,
  type FlatService,
  type RoomOption,
  type RoomPick,
  type RoomRequest,
} from "./stay-selection";
import type { StayBookingInput } from "./stay-booking-payload";
import { WhatsAppActionsService } from "./whatsapp-actions.service";
import { WhatsAppIdentityService } from "./whatsapp-identity.service";
import { WhatsAppReplyService } from "./whatsapp-reply.service";
import {
  WhatsAppSessionStore,
  type WhatsAppSession,
} from "./whatsapp-session.store";
import type { InboundMessage } from "./whatsapp-webhook.service";

/**
 * Phrases that, on their own, mean "I want to book/see this over there" even
 * without a word from the STAY keyword list ("room", "ashram", ...). This is
 * what lets a bare "Vrindavan mein chahiye" open the stay flow: it names a
 * place and uses a booking verb, which in a channel that only converses
 * about stays is enough to mean a stay. It is deliberately narrower than
 * "any unknown message with a place-shaped word in it" — gibberish with no
 * booking verb still falls through to "I didn't understand", unchanged.
 */
const BOOKING_INTENT_VERBS =
  /chahiye|chaiye|chahie|karna|karni|krna|krni|kro|karo|book|booking|dikhao|dikha|batao/iu;

/** "isme booking karni hai" — picking the one thing just shown, by reference. */
const SELECT_SHOWN_ITEM =
  /\bisme\b|iss\s*mein|ismein|is\s*mein|isi\s*mein|ye\s*wala|yeh\s*wala|this\s*one|isko|iske\s*liye/iu;

/** The extra, non-slot bookkeeping this flow keeps alongside the `StaySlots` fields. */
interface StayFlowState extends StaySlots {
  /** The slot last asked about, so a repeat can be phrased differently instead of verbatim. */
  _lastAskedSlot?: RequiredStaySlot | null;
  _lastAskedRepeat?: number;
  /** Ashrams shown by the most recent discovery/search list, for "isme booking karni hai". */
  _shownResults?: { id: string; name: string }[];

  /**
   * The room configuration: the same `rooms[{roomId, units}]` list the
   * website builds from its `selectedRooms`. One category × N units and
   * several categories are both just entries here. (`roomId` on `StaySlots`
   * is the older single-room field and is read as one unit of that room.)
   */
  rooms?: RoomPick[];
  /** Conversational detail only: the backend takes `guests` (adults + children). */
  adults?: number;
  children?: number;
  /** Applied through the offers/pricing services; never a discount amount. */
  promoCode?: string;
  /** Selected add-ons, in the website's `services.selectedAddOns` shape. */
  addOns?: { serviceId: string; quantity: number }[];
  /** The four flat services the website offers on every stay. */
  services?: Partial<Record<FlatService, boolean>>;

  // Cached display data for the property in play — names and policy text only,
  // never prices and never anything sensitive.
  _propertyName?: string;
  _propertyCity?: string;
  _detailsShownFor?: string;
  _policy?: {
    checkInTime?: string;
    checkOutTime?: string;
    cancellationPolicy?: string;
  };
  _addOnOptions?: { id: string; name: string; maxQuantity?: number }[];
  _roomOptions?: (RoomOption & {
    id: string;
    name: string;
    capacity?: number;
    unitsLeft?: number | null;
  })[];
  _offers?: { id: string; promoCode: string }[];
  /** True while the bot is waiting for the guest to send a coupon code. */
  _awaitingCoupon?: boolean;
}

/** The rooms the guest has chosen, reading the older single-room field too. */
const selectedRooms = (state: StayFlowState): RoomPick[] =>
  state.rooms?.length
    ? state.rooms
    : state.roomId
      ? [{ roomId: state.roomId, units: 1 }]
      : [];

/**
 * Drives one WhatsApp conversation.
 *
 * The engine is a state machine over a small set of flows, not a rigid
 * questionnaire: a guest can hand over several facts in one sentence and only
 * gets asked for what is still missing, can correct something they already
 * said, and can switch flow at any point. What it never does is decide
 * anything — availability, price, whether a booking can be cancelled and what
 * it refunds all come from the domain services through the action layer.
 *
 * Replies are conversational messages inside Meta's 24-hour window. The
 * official booking confirmation is not sent from here: it is raised as an
 * outbox row by the booking service and delivered by the existing
 * notification worker, so the guest gets exactly one.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly identity: WhatsAppIdentityService,
    private readonly sessions: WhatsAppSessionStore,
    private readonly reply: WhatsAppReplyService,
    private readonly actions: WhatsAppActionsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Handles one verified inbound message end to end.
   *
   * Errors never reach the guest as a stack or a status code: an expected
   * domain refusal (sold out, expired hold) gets its own sentence, and
   * anything unexpected gets an apology that makes clear nothing was charged.
   */
  async handle(message: InboundMessage): Promise<void> {
    const phone = this.identity.normalize(message.phone);
    const correlationId = `wa:${message.messageId}`;

    if (!(await this.sessions.withinRateLimit(phone))) {
      const existing = await this.sessions.get(phone);
      await this.reply.text(
        phone,
        correlationId,
        copy.rateLimited(existing?.language ?? "hinglish"),
      );
      return;
    }

    // One message at a time per guest: a double-tapped confirmation must not
    // be able to run the booking step twice.
    const release = await this.sessions.acquireLock(phone);
    if (!release) {
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.message_skipped_locked",
          messageId: message.messageId,
        }),
      );
      return;
    }

    try {
      const customer = await this.identity.resolveIdentity(
        phone,
        message.profileName,
      );
      if (customer.status === "blocked") {
        this.logger.warn(
          JSON.stringify({
            event: "whatsapp.blocked_customer_ignored",
            identityKind: customer.kind,
            wappId: customer.displayId ?? undefined,
            userId: customer.userId ?? undefined,
          }),
        );
        return;
      }

      const previous = await this.sessions.get(phone);
      const isNewSession = !previous;
      const session =
        previous ??
        this.sessions.start({
          phone,
          userId: customer.userId,
          whatsappCustomerId: customer.whatsappCustomerId,
          displayId: customer.displayId,
          // An account has no persisted per-channel language, so a fresh
          // session for one falls back to the channel default rather than
          // reading a field that does not exist on `User`.
          language: customer.language ?? "hinglish",
        });

      // Language follows the guest: what they wrote this time, else what the
      // conversation was already in, else what we remembered about them.
      const language = resolveReplyLanguage(
        message.text,
        session.language,
        customer.language,
      );
      // Only a WhatsApp-only guest identity has a persisted language
      // preference to update; an account's language lives on the session
      // only, since `User` is never written to by this channel.
      if (
        customer.kind === "guest" &&
        customer.whatsappCustomerId &&
        language !== customer.language
      )
        await this.identity.setLanguage(customer.whatsappCustomerId, language);
      session.language = language;
      // Re-stamped from the identity resolved for *this* message rather than
      // left as whatever the session was opened with. A guest who registers
      // on the website mid-session flips from "guest" to "account", and a
      // session still carrying the old WhatsApp customer id would be a trap
      // for anyone who later read these fields to build an actor from.
      session.userId = customer.userId;
      session.whatsappCustomerId = customer.whatsappCustomerId;
      session.displayId = customer.displayId;
      session.lastInboundAt = Date.now();
      session.messageCount += 1;

      await this.route({
        message,
        correlationId,
        customer,
        session,
        isNewSession,
      });

      await this.sessions.save(session);
    } catch (error) {
      await this.failGracefully(phone, correlationId, error);
    } finally {
      await release();
    }
  }

  /**
   * Turns an unexpected failure into something a guest can act on.
   *
   * Never surfaces an internal message. The distinction that matters to a
   * guest is whether their money or their booking moved — nothing here does
   * either, and the copy says so.
   */
  private async failGracefully(
    phone: string,
    correlationId: string,
    error: unknown,
  ): Promise<void> {
    const session = await this.sessions.get(phone).catch(() => null);
    const language = session?.language ?? "hinglish";
    const name = (error as any)?.name ?? "UnknownError";
    const status = (error as any)?.status;

    this.logger.error(
      JSON.stringify({
        event: "whatsapp.conversation_failed",
        correlationId,
        errorType: name,
        status,
      }),
    );

    // A conflict from the booking service means the room went while the guest
    // was deciding — that is an ordinary outcome, not a fault.
    const body =
      status === 409
        ? copy.soldOut(language)
        : status === 503
          ? copy.availabilityUnavailable(language)
          : copy.genericError(language);
    await this.reply
      .text(phone, `${correlationId}:error`, body)
      .catch(() => undefined);
  }

  /** Chooses what this message means given where the conversation is. */
  private async route(context: {
    message: InboundMessage;
    correlationId: string;
    customer: WhatsAppResolvedIdentity;
    session: WhatsAppSession;
    isNewSession: boolean;
  }): Promise<void> {
    const { message, session } = context;

    // A tapped list row or button is unambiguous, so it wins over anything
    // the free-text reader might have inferred.
    if (message.replyId) return this.routeReplyId(context);

    // Mid-booking, a message about the booking itself — a coupon, a room
    // count, a service, "price batao" — is a command on that booking, not a
    // switch to another service: "parking bhi chahiye" here is an add-on, and
    // must not be read as a request to open the parking flow.
    if (session.flow === "stay_booking" && this.stayState(session).ashramId) {
      if (await this.handleStayCommand(context, message.text)) return;
    }

    const understanding = understand(message.text);

    // A guest who says "cancel", "help" or names a different service mid-flow
    // is switching, not answering the question they were asked.
    const switching: Intent[] = [
      "cancel",
      "help",
      "refund_status",
      "my_bookings",
      "availability_query",
      "parking",
      "aarti",
      "event",
      "prashad",
      "marketplace",
      "menu",
      "greeting",
      "payment_claim",
    ];
    if (session.flow && switching.includes(understanding.intent))
      return this.routeIntent(context, understanding.intent);

    if (session.flow === "stay_booking")
      return this.handleStayFlow(context, message.text);
    if (session.flow === "cancellation")
      return this.continueCancellation(context, understanding.intent);

    // No explicit stay keyword ("room", "ashram", ...), but a booking verb
    // together with a place name — "Vrindavan mein chahiye" — is enough to
    // mean a stay in a channel that only converses about stays. Gibberish
    // with no booking verb ("asdfgh qwerty") never reaches this: it has no
    // verb to match, so it still falls through to "I didn't understand".
    if (
      understanding.intent === "unknown" &&
      !session.flow &&
      BOOKING_INTENT_VERBS.test(message.text)
    ) {
      const probe = extractStayEntities(message.text);
      if (probe.location || probe.checkInDate || probe.guests) {
        session.flow = "stay_booking";
        session.step = null;
        return this.handleStayFlow(context, message.text);
      }
    }

    return this.routeIntent(context, understanding.intent);
  }

  /** Routes a tap on an interactive row or button. */
  private async routeReplyId(context: {
    message: InboundMessage;
    correlationId: string;
    customer: WhatsAppResolvedIdentity;
    session: WhatsAppSession;
  }): Promise<void> {
    const { message, session } = context;
    const [kind, value, extra] = message.replyId.split(":");

    if (kind === "menu") {
      const intents: Record<string, Intent> = {
        stay: "search_stay",
        parking: "parking",
        aarti: "aarti",
        event: "event",
        prashad: "prashad",
        marketplace: "marketplace",
        bookings: "my_bookings",
        help: "help",
      };
      return this.routeIntent(context, intents[value] ?? "menu");
    }

    if (kind === "stay") {
      // Whether this ashram came from a dated search (dates and guests
      // already known) or from a plain discovery browse (they are not),
      // `afterAshramChosen` is the single place that decides what happens
      // next: ask for whatever is still missing, or go straight to rooms.
      (session.data as StayFlowState).ashramId = value;
      session.flow = "stay_booking";
      return this.afterAshramChosen(context);
    }

    if (kind === "room") return this.chooseRoom(context, value);

    if (kind === "offer") return this.applyCoupon(context, value);

    if (kind === "change") return this.routeChange(context, value);

    if (kind === "confirm") {
      if (value === "yes") return this.createBooking(context);
      session.flow = null;
      session.step = null;
      session.data = {};
      return this.sendMenu(context, copy.cancelAborted(session.language));
    }

    if (kind === "booking") {
      if (value === "cancel") {
        session.flow = "cancellation";
        session.step = "confirm";
        session.data = { bookingId: extra };
        return this.presentCancellation(context, extra);
      }
      if (value === "pay") return this.sendPaymentLink(context, extra);
      return this.showBooking(context, extra);
    }

    if (kind === "cancel") {
      if (value === "yes") return this.performCancellation(context);
      session.flow = null;
      session.step = null;
      session.data = {};
      return this.reply.text(
        session.phone,
        context.correlationId,
        copy.cancelAborted(session.language),
      );
    }

    return this.sendMenu(context, copy.notUnderstood(session.language));
  }

  /** Routes a recognised intent from free text. */
  private async routeIntent(
    context: {
      message: InboundMessage;
      correlationId: string;
      customer: WhatsAppResolvedIdentity;
      session: WhatsAppSession;
      isNewSession?: boolean;
    },
    intent: Intent,
  ): Promise<void> {
    const { session, customer, correlationId } = context;
    const language = session.language;

    switch (intent) {
      case "greeting":
      case "menu":
        session.flow = null;
        session.step = null;
        session.data = {};
        return this.sendGreeting(context);

      case "search_stay": {
        // Re-entering the stay flow the guest is already in ("booking karni
        // hai" said again mid-conversation) must not wipe what they have
        // already told the bot — only starting it fresh, from the menu or
        // another flow, clears the slate.
        const alreadyInStayFlow = session.flow === "stay_booking";
        session.flow = "stay_booking";
        if (!alreadyInStayFlow) session.data = {};
        return this.handleStayFlow(context, context.message.text);
      }

      case "availability_query":
        session.flow = "stay_booking";
        return this.runAvailabilityQuery(context, context.message.text);

      case "my_bookings":
        session.flow = null;
        session.step = null;
        return this.listBookings(context);

      case "cancel":
        session.flow = "cancellation";
        session.step = "pick";
        session.data = {};
        return this.listBookingsToCancel(context);

      case "refund_status":
        return this.showRefundStatus(context);

      case "payment_claim":
        // A guest saying they paid changes nothing: only the verified
        // Razorpay webhook can confirm a payment.
        return this.reply.text(
          session.phone,
          correlationId,
          copy.paymentNotConfirmed(language),
        );

      case "help":
        return this.reply.text(
          session.phone,
          correlationId,
          copy.help(
            language,
            customer.kind === "guest" ? customer.displayId : undefined,
          ),
        );

      case "parking":
      case "aarti":
      case "event":
      case "prashad":
      case "marketplace": {
        // These flows are not conversational yet. Rather than pretend, the
        // guest is told plainly and pointed at the website page that works.
        const label: Record<string, string> = {
          parking: "Parking",
          aarti: "Aarti",
          event: "Events",
          prashad: "Prashad",
          marketplace: "Marketplace",
        };
        const base = (
          this.config.get<string>("frontendUrl") ?? "https://tirvona.com"
        ).replace(/\/+$/, "");
        const path: Record<string, string> = {
          parking: "/parking",
          aarti: "/aarti",
          event: "/events",
          prashad: "/marketplace",
          marketplace: "/marketplace",
        };
        await this.reply.text(
          session.phone,
          correlationId,
          copy.comingSoon(language, label[intent]),
        );
        return this.reply.text(
          session.phone,
          `${correlationId}:link`,
          copy.openOnWeb(language, `${base}${path[intent]}`),
          true,
        );
      }

      case "affirm":
      case "deny":
      case "unknown":
      default:
        return this.sendMenu(context, copy.notUnderstood(language));
    }
  }

  // ---- greeting and menu --------------------------------------------------

  private async sendGreeting(context: {
    correlationId: string;
    customer: WhatsAppResolvedIdentity;
    session: WhatsAppSession;
    isNewSession?: boolean;
  }): Promise<void> {
    const { session, customer, correlationId } = context;
    await this.reply.text(
      session.phone,
      correlationId,
      copy.greeting(session.language, customer.name || undefined),
    );
    // A guest is told their customer id once, when it is first issued, so it
    // is available to them and to support without repeating it every time.
    // Only a WhatsApp-only guest has a WAPP id at all — an existing website
    // account already has its own identity and needs no introduction to one.
    if (
      context.isNewSession &&
      customer.kind === "guest" &&
      customer.displayId &&
      !customer.name
    )
      await this.reply.text(
        session.phone,
        `${correlationId}:wappid`,
        copy.wappIdIntro(session.language, customer.displayId),
      );
    return this.sendMenu(context);
  }

  private async sendMenu(
    context: { correlationId: string; session: WhatsAppSession },
    preface?: string,
  ): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    if (preface)
      await this.reply.text(session.phone, `${correlationId}:pre`, preface);
    return this.reply.list(
      session.phone,
      `${correlationId}:menu`,
      copy.menuTitle(language),
      copy.menuButton(language),
      copy.menuItems(language),
      { sectionTitle: copy.menuTitle(language) },
    );
  }

  // ---- stay booking -------------------------------------------------------

  /** Reads `session.data` as the typed stay-flow state it actually holds. */
  private stayState(session: WhatsAppSession): StayFlowState {
    return session.data as StayFlowState;
  }

  /**
   * The single entry point for every message while the guest is talking
   * about a stay — a fresh request, an answer to a question, a correction, a
   * location change, or "isme booking karni hai" picking something already
   * shown.
   *
   * This replaces the old per-step logic that decided, from `session.step`
   * alone, which slot an incoming date belonged to. That guess is why a
   * reply like "tomorrow" given in answer to the checkout question could be
   * written onto check-in instead and silently vanish, making the bot repeat
   * the same question. Here, every message is read for everything it
   * contains via `extractStayEntities` — told which slot the conversation is
   * actually waiting on, so an unmarked date/time is attributed correctly —
   * merged onto the slots that are already known (never gated by step), and
   * only then is the next question decided, purely from which required slot
   * is still empty.
   */
  private async handleStayFlow(
    context: {
      correlationId: string;
      customer: WhatsAppResolvedIdentity;
      session: WhatsAppSession;
    },
    text: string,
  ): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    const current = this.stayState(session);

    // Picking something already shown — "isme booking karni hai" — is
    // resolved before anything else, so the rest of this turn proceeds with
    // the ashram it named already set.
    if (!current.ashramId && SELECT_SHOWN_ITEM.test(text) && current._shownResults?.length) {
      if (current._shownResults.length === 1) {
        current.ashramId = current._shownResults[0].id;
      } else {
        return this.reply.text(
          session.phone,
          correlationId,
          copy.pickFromListAgain(language),
        );
      }
    }

    const focusSlot = nextMissingStaySlot(current);
    const extracted: StayEntities = extractStayEntities(text, {
      knownCheckInDate: current.checkInDate,
      knownCheckOutDate: current.checkOutDate,
      focusSlot,
    });
    const merged = mergeStaySlots(current, extracted) as StayFlowState;
    merged._shownResults = current._shownResults;

    // Adults and children are conversational detail: the backend only takes
    // the total, so `guests` is always their sum. A plain total ("3 log")
    // replaces any earlier split rather than leaving a stale one behind.
    const split = extractPartySplit(text);
    if (split.adults !== undefined || split.children !== undefined) {
      const children = split.children ?? merged.children ?? 0;
      const adults =
        split.adults ??
        merged.adults ??
        Math.max(1, Number(current.guests ?? 1) - (split.children ?? 0));
      merged.adults = adults;
      merged.children = children;
      merged.guests = adults + children;
    } else if (extracted.guests !== undefined) {
      delete merged.adults;
      delete merged.children;
    }

    // A different place makes the old property's rooms and add-ons
    // meaningless. Dates, guests, coupon and services are the guest's own
    // choices and stay; the pricing service re-checks them on the new stay.
    if (current.ashramId && !merged.ashramId) {
      delete merged.rooms;
      delete merged.roomId;
      delete merged.addOns;
      delete merged._roomOptions;
      delete merged._detailsShownFor;
    }
    session.data = merged as unknown as Record<string, unknown>;

    // A place with no dates at all, or an explicit "show me the list"
    // request, is a browse — item 9's DISCOVER step — not a demand for
    // dates. Once a specific ashram is chosen (here or via a tap), this
    // branch no longer applies and the flow moves on to filling whatever
    // dates/guests are still missing for it.
    if (!merged.ashramId && !merged.checkInDate && (merged.location || isDiscoveryPhrasing(text)))
      return this.runDiscovery(context, merged.location);

    const missing = nextMissingStaySlot(merged);
    if (missing) {
      // A repeat is "the exact slot just asked about is still empty" —
      // not "this message extracted nothing at all". A reply the parser
      // misreads as something else entirely (rare, but real free text
      // always risks it) still leaves the asked-about slot unfilled, and
      // that is what should trigger the rephrased clarification; whether
      // some other field also changed along the way does not matter.
      const stillSameSlotMissing = missing === focusSlot;
      const repeated = merged._lastAskedSlot === missing && stillSameSlotMissing;
      merged._lastAskedSlot = missing;
      merged._lastAskedRepeat = repeated ? (merged._lastAskedRepeat ?? 0) + 1 : 0;
      return this.askForSlot(context, missing, repeated);
    }
    merged._lastAskedSlot = null;
    merged._lastAskedRepeat = 0;

    if (merged.ashramId) return this.afterAshramChosen(context);
    return this.runDatedSearch(context);
  }

  /**
   * Asks for exactly one missing slot.
   *
   * On a repeat — the same slot asked last turn and this message added
   * nothing new at all — the question is rephrased rather than sent
   * verbatim, which is the loop-protection item 11 asks for: a guest whose
   * answer the parser genuinely failed to read gets a clearer, more explicit
   * prompt instead of hearing the identical question a second time.
   */
  private async askForSlot(
    context: { correlationId: string; session: WhatsAppSession },
    slot: RequiredStaySlot,
    repeated: boolean,
  ): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    const prompt = repeated
      ? copy.clarifySlot(language, slot)
      : {
          location: copy.askLocation,
          checkInDate: copy.askCheckIn,
          checkOutDate: copy.askCheckOut,
          guests: copy.askGuests,
        }[slot](language);
    return this.reply.text(session.phone, correlationId, prompt);
  }

  /**
   * A browse: stays matching a place (or, with none given, the general
   * list), shown with no date filter — item 9's DISCOVER step. Selecting a
   * result carries the same `stay:<id>` reply id the dated search below
   * uses, so both paths converge on `afterAshramChosen` and behave
   * identically from there on.
   */
  private async runDiscovery(
    context: { correlationId: string; session: WhatsAppSession },
    location: string | undefined,
  ): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    const results = await this.actions.searchStays({ place: location });

    if (!results.length)
      return this.reply.text(
        session.phone,
        `${correlationId}:none`,
        copy.noStaysFound(language, location ?? ""),
      );

    this.stayState(session)._shownResults = results.map((stay: any) => ({
      id: String(stay._id),
      name: String(stay.name ?? "Stay"),
    }));

    await this.reply.text(
      session.phone,
      `${correlationId}:discovery`,
      copy.discoveryResults(language, location),
    );
    return this.reply.list(
      session.phone,
      `${correlationId}:stays`,
      copy.pickStay(language),
      copy.menuButton(language),
      results.map((stay: any) => ({
        id: `stay:${String(stay._id)}`,
        title: String(stay.name ?? "Stay"),
        description: [
          stay.address?.city,
          stay.startingPrice ? formatMoney(Number(stay.startingPrice)) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    );
  }

  /**
   * Runs once a specific ashram is set — from a dated search result, a
   * discovery pick, or a tap. If dates/guests are already known (the dated
   * search path) this goes straight to its rooms; if not (picked straight
   * out of a browse) it asks for whatever is still missing first, exactly
   * like any other missing slot.
   */
  private async afterAshramChosen(context: {
    correlationId: string;
    session: WhatsAppSession;
  }): Promise<void> {
    const { session } = context;
    const state = this.stayState(session);
    const missing = nextMissingStaySlot(state);
    if (missing) return this.askForSlot(context, missing, false);

    // Introduce the property once per choice — its details, then its rooms —
    // rather than dumping everything in one message, and never again just
    // because the guest changed a date or a count.
    if (state._detailsShownFor !== state.ashramId) {
      const shown = await this.showProperty(context);
      if (!shown) return;
    }
    // A room configuration already chosen is kept across every later change
    // of date, guests, services or coupon: go straight back to the summary.
    if (selectedRooms(state).length) return this.presentSummary(context);
    return this.askForRoom(context);
  }

  /**
   * The property as the website's detail page shows it: name, place,
   * description, facilities, the standard check-in/out times, minimum stay
   * and cancellation policy. Cached (names and policy text only) so the
   * summary can restate the policy without asking again.
   */
  private async showProperty(context: {
    correlationId: string;
    session: WhatsAppSession;
  }): Promise<boolean> {
    const { session, correlationId } = context;
    const state = this.stayState(session);
    const details = await this.actions.propertyDetails(String(state.ashramId));
    if (!details) {
      delete state.ashramId;
      delete state.rooms;
      await this.reply.text(
        session.phone,
        `${correlationId}:gone`,
        copy.noStaysFound(session.language, state.location ?? ""),
      );
      return false;
    }
    state._propertyName = details.name;
    state._propertyCity = details.city;
    state._policy = {
      checkInTime: details.policies.checkInTime,
      checkOutTime: details.policies.checkOutTime,
      cancellationPolicy: details.policies.cancellationPolicy,
    };
    state._addOnOptions = details.addOns.map((a) => ({
      id: a.id,
      name: a.name,
      maxQuantity: a.maxQuantity,
    }));
    state._detailsShownFor = String(state.ashramId);
    await this.reply.text(
      session.phone,
      `${correlationId}:property`,
      stayCopy.propertyIntro(session.language, {
        name: details.name,
        city: details.city,
        description: details.description,
        amenities: details.amenities,
        checkInTime: details.policies.checkInTime,
        checkOutTime: details.policies.checkOutTime,
        minStay: details.policies.minStay,
        cancellationPolicy: details.policies.cancellationPolicy,
      }),
    );
    return true;
  }

  /**
   * Answers "kaunsi date available hai" from whatever is already known,
   * through the same public calendar the website's room page reads — never
   * a second, independently computed answer.
   */
  private async runAvailabilityQuery(
    context: { correlationId: string; session: WhatsAppSession },
    text: string,
  ): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    const state = this.stayState(session);
    const extracted = extractStayEntities(text, {
      knownCheckInDate: state.checkInDate,
      knownCheckOutDate: state.checkOutDate,
    });
    if (extracted.location && !state.ashramId) state.location = extracted.location;
    session.data = state as unknown as Record<string, unknown>;

    let roomId = state.roomId;
    if (!roomId && state.ashramId) {
      const rooms = await this.actions.roomsFor(state.ashramId);
      roomId = rooms[0]?._id ? String(rooms[0]._id) : undefined;
    }

    if (roomId) {
      const calendar = await this.actions.availabilityForRoom(roomId);
      const open = calendar
        .filter((day: any) => day.available && !day.isClosed)
        .slice(0, 6);
      return this.reply.text(
        session.phone,
        correlationId,
        copy.availabilitySummary(language, open.map((day: any) => day.date)),
      );
    }

    if (state.location) return this.runDiscovery(context, state.location);

    return this.askForSlot(context, "location", false);
  }

  private async runDatedSearch(context: {
    correlationId: string;
    session: WhatsAppSession;
  }): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    const data = this.stayState(session);

    await this.reply.text(
      session.phone,
      `${correlationId}:searching`,
      copy.searching(language),
    );

    const stays = await this.actions.searchStays({
      place: data.location,
      checkIn: isoDateToUtcMidnight(data.checkInDate!),
      checkOut: isoDateToUtcMidnight(data.checkOutDate!),
      guests: data.guests,
    });

    if (!stays.length) {
      // Nothing is cleared here: the guest was explicitly offered a choice
      // ("try nearby dates or another location"), and the ordinary
      // correction path already lets them change either by just saying so
      // in their next message — forcing a fresh location re-entry when the
      // date was more likely the problem would throw away a fact they
      // already gave for no reason.
      return this.reply.text(
        session.phone,
        `${correlationId}:none`,
        copy.noAvailabilityDetailed(language, {
          location: data.location ?? "",
          checkInDate: data.checkInDate!,
          checkOutDate: data.checkOutDate!,
        }),
      );
    }

    this.stayState(session)._shownResults = stays.map((stay: any) => ({
      id: String(stay._id),
      name: String(stay.name ?? "Stay"),
    }));
    return this.reply.list(
      session.phone,
      `${correlationId}:stays`,
      copy.pickStay(language),
      copy.menuButton(language),
      stays.map((stay: any) => ({
        id: `stay:${String(stay._id)}`,
        title: String(stay.name ?? "Stay"),
        description: [
          stay.address?.city,
          stay.startingPrice ? formatMoney(Number(stay.startingPrice)) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    );
  }

  private async askForRoom(context: {
    correlationId: string;
    session: WhatsAppSession;
  }): Promise<void> {
    const { session, correlationId } = context;
    const data = this.stayState(session);
    const stay = this.stayDates(data);
    const rooms = await this.actions.roomsFor(String(data.ashramId), stay);
    if (!rooms.length) {
      delete data.ashramId;
      const location = data.location ?? "";
      return this.reply.text(
        session.phone,
        `${correlationId}:norooms`,
        copy.noStaysFound(session.language, location),
      );
    }
    this.cacheRoomOptions(data, rooms);
    // A category with no unit open on some night of the stay cannot be booked
    // for these dates, so it is not offered — the count comes from the same
    // calendar the website reads.
    const open = rooms.filter((room: any) => room.unitsLeft !== 0);
    if (!open.length)
      return this.reply.text(
        session.phone,
        `${correlationId}:soldout`,
        stayCopy.noRoomsForDates(session.language),
      );
    session.step = "pick_room";
    return this.reply.list(
      session.phone,
      `${correlationId}:rooms`,
      stayCopy.pickRoomCategory(session.language, {
        nights: this.nightsBetween(data),
        guests: Number(data.guests ?? 1),
      }),
      copy.menuButton(session.language),
      open.slice(0, 10).map((room: any) => ({
        id: `room:${String(room._id)}`,
        title: String(room.name ?? "Room"),
        description: stayCopy.roomRowDescription(session.language, {
          acType: room.acType,
          capacity: room.capacity,
          basePrice: room.basePrice,
          unitsLeft: room.unitsLeft,
        }),
      })),
    );
  }

  private stayDates(data: StayFlowState): { checkIn: Date; checkOut: Date } {
    return {
      checkIn: isoDateToUtcMidnight(data.checkInDate!),
      checkOut: isoDateToUtcMidnight(data.checkOutDate!),
    };
  }

  private nightsBetween(data: StayFlowState): number {
    const { checkIn, checkOut } = this.stayDates(data);
    return Math.max(
      1,
      Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000),
    );
  }

  /** Keeps the names and open-unit counts needed to read "2 deluxe" against real categories. */
  private cacheRoomOptions(data: StayFlowState, rooms: any[]): void {
    data._roomOptions = rooms.map((room: any) => ({
      id: String(room._id),
      name: String(room.name ?? "Room"),
      type: room.type,
      capacity: room.capacity,
      unitsLeft: room.unitsLeft ?? null,
    }));
  }

  /**
   * The website's own request structure for what the guest has chosen so far.
   * The arrival/departure times the guest asked for are kept on the booking
   * as its `specialRequests` — a field the website also stores — because the
   * booking has no time-of-day field of its own.
   */
  private stayInput(
    data: StayFlowState,
    guestName?: string,
  ): StayBookingInput {
    const times = [
      data.checkInTime ? `Requested check-in ${data.checkInTime}` : "",
      data.checkOutTime ? `Requested check-out ${data.checkOutTime}` : "",
    ].filter(Boolean);
    const { checkIn, checkOut } = this.stayDates(data);
    return {
      ashramId: String(data.ashramId),
      rooms: selectedRooms(data),
      checkIn,
      checkOut,
      guests: Number(data.guests ?? 1),
      promoCode: data.promoCode,
      addOns: data.addOns,
      services: data.services,
      specialRequests: times.length
        ? `${times.join("; ")} (via WhatsApp)`
        : undefined,
      guestName,
    };
  }

  /**
   * Shows the price from the pricing service and asks for a decision.
   * Every figure here came from `BookingPricingService`; none is computed in
   * this file. The check-in/check-out clock times the guest gave are shown
   * back to them for confirmation, but travel no further than this message —
   * the booking itself is dated at the calendar-day level the schema already
   * uses, exactly as a website booking is.
   */
  private async presentSummary(
    context: {
      correlationId: string;
      session: WhatsAppSession;
    },
    known?: { quote: any },
  ): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    const data = this.stayState(session);
    const chosen = selectedRooms(data);
    if (!chosen.length) return this.askForRoom(context);

    // Re-read what is open for the *current* dates: a changed date, or a
    // room count that no longer fits, must be caught here, not at payment.
    const rooms = await this.actions.roomsFor(
      String(data.ashramId),
      this.stayDates(data),
    );
    this.cacheRoomOptions(data, rooms);
    const options = data._roomOptions ?? [];
    for (const pick of chosen) {
      const option = options.find((o) => o.id === pick.roomId);
      if (
        option &&
        option.unitsLeft !== null &&
        option.unitsLeft !== undefined &&
        pick.units > option.unitsLeft
      ) {
        await this.reply.text(
          session.phone,
          `${correlationId}:units`,
          stayCopy.roomUnitsExceed(language, {
            room: option.name,
            left: option.unitsLeft,
          }),
        );
        delete data.rooms;
        delete data.roomId;
        return this.askForRoom(context);
      }
    }

    let quote = known?.quote;
    if (!quote) {
      try {
        quote = await this.actions.quoteStay(this.stayInput(data));
      } catch (error) {
        if (!(error instanceof HttpException) || error.getStatus() >= 500)
          throw error;
        const reason = String((error as HttpException).message);
        // A coupon that no longer fits the booking (a room change, another
        // date) is dropped with the service's own reason, and the stay is
        // priced again without it — the guest keeps everything else.
        if (data.promoCode && /promo|coupon|offer/i.test(reason)) {
          const code = data.promoCode;
          delete data.promoCode;
          await this.reply.text(
            session.phone,
            `${correlationId}:promo`,
            stayCopy.couponRefused(language, { code, reason }),
          );
          return this.presentSummary(context);
        }
        await this.reply.text(
          session.phone,
          `${correlationId}:refused`,
          stayCopy.quoteRefused(language, reason),
        );
        return this.askForRoom(context);
      }
    }

    const pricing = quote?.pricing ?? {};
    (data as any).quotedTotal = Number(pricing.totalAmount ?? 0);
    const services = quote?.services ?? {};
    const flatServices = (["prasad", "meals", "parking", "locker"] as const)
      .filter((key) => services[key]?.ordered)
      .map((key) => ({ key, price: Number(services[key]?.price ?? 0) }));

    await this.reply.text(
      session.phone,
      `${correlationId}:quote`,
      stayCopy.summary(language, {
        property: data._propertyName ?? "Tirvona stay",
        city: data._propertyCity,
        rooms: chosen.map((pick) => ({
          name: options.find((o) => o.id === pick.roomId)?.name ?? "Room",
          units: pick.units,
        })),
        checkInDate: data.checkInDate!,
        checkInTime: data.checkInTime,
        checkOutDate: data.checkOutDate!,
        checkOutTime: data.checkOutTime,
        policyCheckIn: data._policy?.checkInTime,
        policyCheckOut: data._policy?.checkOutTime,
        nights: Number(quote?.nights ?? this.nightsBetween(data)),
        guests: Number(data.guests),
        adults: data.adults,
        children: data.children,
        addOns: (services.selectedAddOns ?? []).map((a: any) => ({
          name: String(a.name ?? ""),
          quantity: Number(a.quantity ?? 1),
          totalPrice: Number(a.totalPrice ?? 0),
        })),
        flatServices,
        coupon:
          data.promoCode && quote?.coupon
            ? {
                code: String(quote.coupon.promoCode ?? data.promoCode),
                title: quote.coupon.offerTitle,
              }
            : null,
        pricing: {
          basePrice: Number(pricing.basePrice ?? 0),
          servicesPrice: Number(pricing.servicesPrice ?? 0),
          extraGuestAmount: Number(pricing.extraGuestAmount ?? 0),
          platformFee: Number(pricing.platformFee ?? 0),
          gstAmount: Number(pricing.gstAmount ?? 0),
          gstPercent: Number(pricing.gstPercent ?? 0),
          discountAmount: Number(pricing.discountAmount ?? 0),
          totalAmount: Number(pricing.totalAmount ?? 0),
        },
        cancellationPolicy: data._policy?.cancellationPolicy,
      }),
    );
    session.step = "confirm";
    return this.reply.buttons(
      session.phone,
      `${correlationId}:confirm`,
      stayCopy.summaryPrompt(language),
      [
        { id: "confirm:yes", title: stayCopy.confirmButton(language) },
        { id: "change:menu", title: stayCopy.changeButton(language) },
        { id: "confirm:no", title: stayCopy.cancelButton(language) },
      ],
    );
  }

  /** Tapping a category picks it (× the count the guest already asked for). */
  private async chooseRoom(
    context: { correlationId: string; session: WhatsAppSession },
    roomId: string,
  ): Promise<void> {
    const data = this.stayState(context.session);
    const previous = selectedRooms(data).find((r) => r.roomId === roomId);
    const units = (data as any)._pendingUnits ?? previous?.units ?? 1;
    delete (data as any)._pendingUnits;
    data.rooms = [{ roomId, units }];
    delete data.roomId;
    return this.presentSummary(context);
  }

  /** The "Change" menu and each of its options. */
  private async routeChange(
    context: { correlationId: string; session: WhatsAppSession },
    what: string,
  ): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    const data = this.stayState(session);
    switch (what) {
      case "rooms":
        return this.askForRoom(context);
      case "guests":
        return this.reply.text(session.phone, correlationId, stayCopy.askGuestSplit(language));
      case "dates":
        return this.reply.text(session.phone, correlationId, stayCopy.askDates(language));
      case "services":
        return this.reply.text(
          session.phone,
          correlationId,
          stayCopy.servicesList(
            language,
            (await this.actions.propertyDetails(String(data.ashramId)))?.addOns ?? [],
          ),
        );
      case "coupon":
        data._awaitingCoupon = true;
        return this.reply.text(session.phone, correlationId, stayCopy.askCoupon(language));
      default:
        return this.reply.list(
          session.phone,
          `${correlationId}:change`,
          stayCopy.changeMenuBody(language),
          copy.menuButton(language),
          stayCopy.changeMenuRows(language),
        );
    }
  }

  /** Cancels the booking-in-progress (not a booking that exists). */
  private async abandonStay(context: {
    correlationId: string;
    session: WhatsAppSession;
  }): Promise<void> {
    const { session } = context;
    session.flow = null;
    session.step = null;
    session.data = {};
    return this.sendMenu(context, copy.cancelAborted(session.language));
  }

  /**
   * Reads a message that is a command on the booking in progress: a coupon
   * (apply, ask, remove), an offers question, a room category or count, a
   * guest split, an add-on, or "price batao". Returns true when it handled
   * the message; false lets the ordinary slot reader have it (dates, times,
   * a new place).
   *
   * It only ever turns words into a structured change to the guest's
   * selection and hands that to the domain services — a coupon is validated
   * by the offers service, a price is the pricing service's, a room count is
   * checked against the calendar.
   */
  private async handleStayCommand(
    context: {
      correlationId: string;
      customer: WhatsAppResolvedIdentity;
      session: WhatsAppSession;
    },
    text: string,
  ): Promise<boolean> {
    const { session, correlationId } = context;
    const language = session.language;
    const data = this.stayState(session);
    const expectingCode = Boolean(data._awaitingCoupon);
    data._awaitingCoupon = false;

    // A short yes/no at the summary is the confirmation or the refusal.
    if (session.step === "confirm" && text.trim().split(/\s+/).length <= 3) {
      const intent = understand(text).intent;
      if (intent === "affirm") {
        await this.createBooking(context);
        return true;
      }
      if (intent === "deny") {
        await this.abandonStay(context);
        return true;
      }
    }

    if (isCouponRemoval(text)) {
      if (!data.promoCode) {
        await this.reply.text(session.phone, correlationId, stayCopy.noCouponToRemove(language));
        return true;
      }
      delete data.promoCode;
      await this.reply.text(session.phone, `${correlationId}:rm`, stayCopy.couponRemoved(language));
      if (selectedRooms(data).length) await this.presentSummary(context);
      return true;
    }

    const code = extractCouponCode(text, { expectingCode });
    if (code) {
      await this.applyCoupon(context, code);
      return true;
    }

    if (isCouponQuestion(text) || isOfferQuestion(text)) {
      await this.showOffers(context);
      return true;
    }

    const options = data._roomOptions ?? [];
    if (options.length) {
      const request = extractRoomRequest(text, options);
      if (
        request.picks.length ||
        request.ambiguous.length ||
        request.unitsOnly !== undefined
      ) {
        await this.applyRoomRequest(context, request);
        return true;
      }
    }

    const commands = extractServiceCommands(
      text,
      (data._addOnOptions ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        maxQuantity: a.maxQuantity,
      })),
    );
    if (
      Object.keys(commands.flat).length ||
      commands.addOns.length ||
      commands.removeAddOns.length
    ) {
      data.services = { ...(data.services ?? {}), ...commands.flat };
      const addOns = new Map((data.addOns ?? []).map((a) => [a.serviceId, a]));
      for (const id of commands.removeAddOns) addOns.delete(id);
      for (const a of commands.addOns) addOns.set(a.serviceId, a);
      data.addOns = [...addOns.values()];
      await this.reply.text(session.phone, `${correlationId}:svc`, stayCopy.servicesUpdated(language));
      if (selectedRooms(data).length) await this.presentSummary(context);
      return true;
    }

    if (isPriceQuestion(text) && selectedRooms(data).length) {
      await this.presentSummary(context);
      return true;
    }
    return false;
  }

  /**
   * Applies "2 deluxe aur 1 standard", "2 rooms", "deluxe wala". Counts are
   * checked against the calendar's open units before anything changes, so a
   * request that cannot be met leaves the guest's selection untouched.
   */
  private async applyRoomRequest(
    context: { correlationId: string; session: WhatsAppSession },
    request: RoomRequest,
  ): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    const data = this.stayState(session);
    const options = data._roomOptions ?? [];
    const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? "Room";

    if (request.ambiguous.length) {
      return void (await this.reply.text(
        session.phone,
        `${correlationId}:ambig`,
        stayCopy.roomAmbiguous(
          language,
          request.ambiguous[0].candidates.map((c) => String(c.name ?? "")),
        ),
      ));
    }

    const current = new Map(selectedRooms(data).map((r) => [r.roomId, r.units]));
    for (const pick of request.picks) {
      if (pick.explicit || !current.has(pick.roomId))
        current.set(pick.roomId, pick.units);
    }
    if (request.unitsOnly !== undefined && !request.picks.length) {
      if (current.size === 1) {
        const [only] = [...current.keys()];
        current.set(only, request.unitsOnly);
      } else if (current.size === 0) {
        (data as any)._pendingUnits = request.unitsOnly;
        return void (await this.reply.text(
          session.phone,
          `${correlationId}:pick`,
          stayCopy.pickRoomFirst(language),
        ));
      } else {
        return void (await this.reply.text(
          session.phone,
          `${correlationId}:which`,
          stayCopy.roomAmbiguous(language, [...current.keys()].map(nameOf)),
        ));
      }
    }

    for (const [roomId, units] of current) {
      const option = options.find((o) => o.id === roomId);
      if (
        option &&
        option.unitsLeft !== null &&
        option.unitsLeft !== undefined &&
        units > option.unitsLeft
      )
        return void (await this.reply.text(
          session.phone,
          `${correlationId}:units`,
          stayCopy.roomUnitsExceed(language, { room: option.name, left: option.unitsLeft }),
        ));
    }

    data.rooms = [...current].map(([roomId, units]) => ({ roomId, units }));
    delete data.roomId;
    await this.reply.text(
      session.phone,
      `${correlationId}:rooms`,
      stayCopy.roomsChosen(
        language,
        data.rooms.map((r) => ({ name: nameOf(r.roomId), units: r.units })),
      ),
    );
    return this.presentSummary(context);
  }

  /**
   * Tries a coupon through the offers and pricing services. Nothing is
   * decided here: a refusal shows the service's own reason, and a code with
   * no room chosen yet is only remembered — never assumed valid.
   */
  private async applyCoupon(
    context: { correlationId: string; session: WhatsAppSession },
    code: string,
  ): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    const data = this.stayState(session);
    if (!selectedRooms(data).length) {
      data.promoCode = code;
      return void (await this.reply.text(
        session.phone,
        `${correlationId}:held`,
        stayCopy.couponHeld(language, code),
      ));
    }
    const result = await this.actions.applyPromo({
      ...this.stayInput(data),
      promoCode: code,
    });
    if (!result.ok)
      return void (await this.reply.text(
        session.phone,
        `${correlationId}:promo`,
        stayCopy.couponRefused(language, { code, reason: result.reason }),
      ));
    data.promoCode = code;
    await this.reply.text(
      session.phone,
      `${correlationId}:promo`,
      stayCopy.couponApplied(language, {
        code,
        discount: result.discountAmount,
        total: Number(result.quote?.pricing?.totalAmount ?? 0),
      }),
    );
    return this.presentSummary(context, { quote: result.quote });
  }

  /** "Koi offer / coupon hai?" — the property's running offers, from the offers service. */
  private async showOffers(context: {
    correlationId: string;
    session: WhatsAppSession;
  }): Promise<void> {
    const { session, correlationId } = context;
    const language = session.language;
    const data = this.stayState(session);
    const offers = await this.actions.listOffers(String(data.ashramId));
    if (!offers.length) {
      data._awaitingCoupon = true;
      return void (await this.reply.text(session.phone, correlationId, stayCopy.noOffers(language)));
    }
    data._offers = offers.map((o: any) => ({ id: o.id, promoCode: o.promoCode }));
    data._awaitingCoupon = true;
    return this.reply.list(
      session.phone,
      `${correlationId}:offers`,
      stayCopy.offersHeader(language),
      copy.menuButton(language),
      offers.slice(0, 10).map((o: any) => ({
        id: `offer:${o.promoCode}`,
        ...stayCopy.offerRow(language, o),
      })),
    );
  }

  /**
   * Creates the booking and hands back a payment link.
   *
   * No confirmation message is sent from here. The booking is pending until
   * Razorpay's webhook verifies the payment, and the confirmation the guest
   * gets is the transactional one raised by the booking service.
   */
  private async createBooking(context: {
    correlationId: string;
    customer: WhatsAppResolvedIdentity;
    session: WhatsAppSession;
  }): Promise<void> {
    const { session, customer, correlationId } = context;
    const data = this.stayState(session);
    if (!selectedRooms(data).length || !data.ashramId || !data.checkInDate)
      return this.askForRoom(context);

    // The same structure the website posts — the rooms with their units, the
    // services, the coupon — so the booking is priced and held exactly as
    // the summary the guest just confirmed.
    const booking = await this.actions.createStayBooking(
      customer,
      this.stayInput(data, customer.name || undefined),
    );

    const link = await this.actions.createPaymentLink(
      customer,
      String(booking._id),
    );

    session.flow = null;
    session.step = null;
    session.data = {};

    const minutes = Math.max(
      1,
      Math.round(
        (new Date(booking.reservationExpiresAt).getTime() - Date.now()) / 60_000,
      ),
    );
    return this.reply.text(
      session.phone,
      `${correlationId}:pay`,
      copy.paymentLink(session.language, {
        reference: link.reference,
        amount: link.amount,
        url: link.url,
        minutes,
      }),
      true,
    );
  }

  // ---- my bookings --------------------------------------------------------

  private async listBookings(context: {
    correlationId: string;
    customer: WhatsAppResolvedIdentity;
    session: WhatsAppSession;
  }): Promise<void> {
    const { session, customer, correlationId } = context;
    const bookings = await this.actions.myStayBookings(customer);
    if (!bookings.length)
      return this.reply.text(
        session.phone,
        correlationId,
        copy.noBookings(session.language),
      );

    const lines = bookings
      .slice(0, 10)
      .map((booking: any) =>
        [
          `*${booking.bookingId}*`,
          booking.ashramId?.name,
          `${new Date(booking.checkInDate).toLocaleDateString("en-IN")} → ${new Date(booking.checkOutDate).toLocaleDateString("en-IN")}`,
          `${booking.status} · ${booking.paymentStatus}`,
          formatMoney(Number(booking.pricing?.totalAmount ?? 0)),
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n");

    await this.reply.text(
      session.phone,
      correlationId,
      `${copy.bookingsHeader(session.language)}\n\n${lines}`,
    );

    // Every booking opens its details; the actions the domain would allow
    // (pay now, cancel) are offered there, next to the facts they depend on.
    return this.reply.list(
      session.phone,
      `${correlationId}:actions`,
      stayCopy.openBookingPrompt(session.language),
      copy.menuButton(session.language),
      bookings.slice(0, 10).map((booking: any) => ({
        id: `booking:view:${String(booking._id)}`,
        title: String(booking.bookingId),
        description: [booking.ashramId?.name, `${booking.status} · ${booking.paymentStatus}`]
          .filter(Boolean)
          .join(" · "),
      })),
    );
  }

  private async showRefundStatus(context: {
    correlationId: string;
    customer: WhatsAppResolvedIdentity;
    session: WhatsAppSession;
  }): Promise<void> {
    const { session, customer, correlationId } = context;
    const statuses = await this.actions.refundStatuses(customer);
    return this.reply.text(
      session.phone,
      correlationId,
      stayCopy.refundStatus(
        session.language,
        statuses.map((s: any) => ({
          reference: String(s.bookingId),
          decided: s.decidedRefundAmount ?? null,
          cancellationRefund: s.cancellationRefund,
          request: s.request,
        })),
      ),
    );
  }

  private async showBooking(
    context: {
      correlationId: string;
      customer: WhatsAppResolvedIdentity;
      session: WhatsAppSession;
    },
    bookingId: string,
  ): Promise<void> {
    const { session, customer, correlationId } = context;
    const booking = await this.actions
      .getBooking(customer, bookingId)
      .catch(() => null);
    if (!booking)
      return this.reply.text(
        session.phone,
        correlationId,
        copy.notYourBooking(session.language),
      );
    const closed = ["cancelled", "refunded"].includes(booking.status);
    const refund = closed
      ? await this.actions
          .refundStatusFor(customer, String(booking._id))
          .catch(() => null)
      : null;
    const refundLine = refund
      ? [
          refund.decidedRefundAmount !== null && refund.decidedRefundAmount !== undefined
            ? money(Number(refund.decidedRefundAmount))
            : "",
          refund.cancellationRefund?.status,
          refund.request ? `${refund.request.refundNumber}: ${refund.request.status}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;
    await this.reply.text(
      session.phone,
      correlationId,
      stayCopy.bookingDetail(session.language, {
        reference: String(booking.bookingId),
        property: String(booking.ashramId?.name ?? ""),
        rooms: (booking.rooms ?? [])
          .map((r: any) => `${r.units ?? 1} × ${r.roomId?.name ?? "Room"}`)
          .join(", "),
        checkIn: new Date(booking.checkInDate).toLocaleDateString("en-IN", { timeZone: "UTC" }),
        checkOut: new Date(booking.checkOutDate).toLocaleDateString("en-IN", { timeZone: "UTC" }),
        guests: Number(booking.guestsCount ?? 0),
        status: String(booking.status),
        paymentStatus: String(booking.paymentStatus),
        total: Number(booking.pricing?.totalAmount ?? 0),
        checkInCode:
          booking.status === "confirmed" ? String(booking.checkInCode ?? "") || undefined : undefined,
        refund: refundLine,
      }),
    );

    // Only actions the domain would accept are offered.
    const canPay =
      booking.status === "pending" &&
      booking.paymentStatus === "pending" &&
      (!booking.reservationExpiresAt ||
        new Date(booking.reservationExpiresAt).getTime() > Date.now());
    const canCancel = ["pending", "confirmed"].includes(booking.status);
    const buttons = [
      canPay
        ? { id: `booking:pay:${String(booking._id)}`, title: stayCopy.payNowButton(session.language) }
        : null,
      canCancel
        ? { id: `booking:cancel:${String(booking._id)}`, title: stayCopy.cancelBookingButton(session.language) }
        : null,
    ].filter(Boolean) as { id: string; title: string }[];
    if (!buttons.length) return;
    return this.reply.buttons(
      session.phone,
      `${correlationId}:bookingactions`,
      stayCopy.bookingActionsPrompt(session.language),
      buttons,
    );
  }

  private async sendPaymentLink(
    context: {
      correlationId: string;
      customer: WhatsAppResolvedIdentity;
      session: WhatsAppSession;
    },
    bookingId: string,
  ): Promise<void> {
    const { session, customer, correlationId } = context;
    const link = await this.actions.createPaymentLink(customer, bookingId);
    return this.reply.text(
      session.phone,
      correlationId,
      copy.paymentLink(session.language, {
        reference: link.reference,
        amount: link.amount,
        url: link.url,
        minutes: Math.max(
          1,
          Math.round((link.expiresAt.getTime() - Date.now()) / 60_000),
        ),
      }),
      true,
    );
  }

  // ---- cancellation -------------------------------------------------------

  private async listBookingsToCancel(context: {
    correlationId: string;
    customer: WhatsAppResolvedIdentity;
    session: WhatsAppSession;
  }): Promise<void> {
    const { session, customer, correlationId } = context;
    const bookings = (await this.actions.myStayBookings(customer)).filter(
      (booking: any) => ["pending", "confirmed"].includes(booking.status),
    );
    if (!bookings.length)
      return this.reply.text(
        session.phone,
        correlationId,
        copy.noBookings(session.language),
      );
    return this.reply.list(
      session.phone,
      `${correlationId}:cancellist`,
      copy.cancelWhich(session.language),
      copy.menuButton(session.language),
      bookings.slice(0, 10).map((booking: any) => ({
        id: `booking:cancel:${String(booking._id)}`,
        title: String(booking.bookingId),
        description: String(booking.ashramId?.name ?? ""),
      })),
    );
  }

  /**
   * States what the existing policy would refund and asks for an explicit
   * yes. A cancellation is never inferred from a guest saying "cancel".
   */
  private async presentCancellation(
    context: {
      correlationId: string;
      customer: WhatsAppResolvedIdentity;
      session: WhatsAppSession;
    },
    bookingId: string,
  ): Promise<void> {
    const { session, customer, correlationId } = context;
    const booking = await this.actions
      .getBooking(customer, bookingId)
      .catch(() => null);
    if (!booking) {
      session.flow = null;
      session.step = null;
      return this.reply.text(
        session.phone,
        correlationId,
        copy.notYourBooking(session.language),
      );
    }
    const refund = await this.actions.previewCancellationRefund(
      customer,
      booking,
    );
    session.data = { bookingId: String(booking._id) };
    session.step = "confirm";
    return this.reply.buttons(
      session.phone,
      `${correlationId}:cancelconfirm`,
      copy.cancelConfirm(session.language, {
        reference: String(booking.bookingId),
        refund,
      }),
      [
        { id: "cancel:yes", title: copy.yes(session.language) },
        { id: "cancel:no", title: copy.no(session.language) },
      ],
    );
  }

  private async continueCancellation(
    context: {
      message: InboundMessage;
      correlationId: string;
      customer: WhatsAppResolvedIdentity;
      session: WhatsAppSession;
    },
    intent: Intent,
  ): Promise<void> {
    const { session, correlationId } = context;
    if (session.step === "confirm" && intent === "affirm")
      return this.performCancellation(context);
    if (session.step === "confirm" && intent === "deny") {
      session.flow = null;
      session.step = null;
      session.data = {};
      return this.reply.text(
        session.phone,
        correlationId,
        copy.cancelAborted(session.language),
      );
    }
    return this.listBookingsToCancel(context);
  }

  private async performCancellation(context: {
    correlationId: string;
    customer: WhatsAppResolvedIdentity;
    session: WhatsAppSession;
  }): Promise<void> {
    const { session, customer, correlationId } = context;
    const bookingId = String(session.data.bookingId ?? "");
    if (!bookingId)
      return this.reply.text(
        session.phone,
        correlationId,
        copy.notYourBooking(session.language),
      );

    const result = await this.actions.cancelBooking(
      customer,
      bookingId,
      "Cancelled by the guest over WhatsApp",
    );
    session.flow = null;
    session.step = null;
    session.data = {};
    return this.reply.text(
      session.phone,
      correlationId,
      copy.cancelled(session.language, {
        reference: String(result.booking?.bookingId ?? ""),
        refund: Number(result.refundAmount ?? 0),
      }),
    );
  }
}
