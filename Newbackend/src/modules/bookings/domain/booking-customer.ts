import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  DEFAULT_BOOKING_CHANNEL,
  WHATSAPP_BOOKING_CHANNEL,
  type BookingChannel,
} from "./booking.utils";

/**
 * Presents a booking's customer the same way whichever identity made it.
 *
 * A booking is made either by a website account (`customerId` → `users`) or by
 * a WhatsApp guest (`whatsappCustomerId` → `whatsapp_customers`). Owner and
 * admin surfaces should not have to care which: an owner looking at their
 * Booking Centre wants a name and a phone number, not a branch.
 *
 * So every read path that populates a customer runs its rows through this,
 * which fills `customerId` from the WhatsApp identity when there is no
 * account. That is not invented data — it is the real guest's real name and
 * number, rendered in the shape the existing views already read. The WhatsApp
 * identity is also exposed on its own as `whatsappCustomer`, so admin and
 * support can see and search the WAPP id.
 */

/**
 * Who is making or acting on a booking.
 *
 * Every booking-writing method takes one of these instead of an
 * `AuthenticatedUser`, because the customer on a booking is no longer always
 * a website account. Exactly one of `userId` / `whatsappCustomerId` is set —
 * the same rule the Booking schema enforces — and `role` and `channel` are
 * what end up on the history and audit rows.
 */
export interface BookingActor {
  userId: string | null;
  whatsappCustomerId: string | null;
  role: string;
  channel: BookingChannel;
  name?: string;
  phone?: string;
  /** Roles and scopes, present only for a website principal. */
  principal?: AuthenticatedUser;
}

/** The actor for a request made by a signed-in website user. */
export const actorFromUser = (
  user: AuthenticatedUser,
  channel: BookingChannel = DEFAULT_BOOKING_CHANNEL,
): BookingActor => ({
  userId: String(user.id),
  whatsappCustomerId: null,
  role: user.role,
  channel,
  name: user.name,
  phone: user.phone,
  principal: user,
});

/**
 * The actor for a WhatsApp guest.
 *
 * `role` is a label for history and audit rows only — it is never checked for
 * permissions, because a WhatsApp guest has none beyond their own bookings and
 * every action verifies ownership directly.
 */
export const actorFromWhatsAppCustomer = (customer: {
  id: string;
  name?: string;
  phone: string;
}): BookingActor => ({
  userId: null,
  whatsappCustomerId: String(customer.id),
  role: "whatsapp_customer",
  channel: WHATSAPP_BOOKING_CHANNEL,
  name: customer.name,
  phone: customer.phone,
});

/**
 * The result of resolving a verified WhatsApp sender to a Tirvona identity.
 *
 * Two shapes:
 *   - `"account"` — the number matches an existing website `User` by phone.
 *     The booking is made under that user's own `customerId`, exactly as if
 *     they had booked on the website: it appears in their normal booking
 *     history, and Admin/Owner show their real registered name and phone
 *     rather than a WhatsApp-only identity.
 *   - `"guest"` — no website account matches. A separate, non-login
 *     `WhatsAppCustomer` identity is used instead, carrying its own WAPP id.
 *
 * This type is deliberately declared in the bookings domain, alongside
 * `BookingActor`, rather than in the WhatsApp channel module: turning a
 * resolved identity into a `BookingActor` is a booking-domain concern (see
 * `actorFromResolvedIdentity`), and keeping it here means bookings never
 * needs to import anything from the channel that calls it. `language` is
 * spelled out as a literal union instead of importing the channel's
 * `ReplyLanguage` type, for the same reason.
 */
export interface WhatsAppResolvedIdentity {
  kind: "account" | "guest";
  /** Set only for `"account"` — the matched website user's id. */
  userId: string | null;
  /** Set only for `"guest"` — the WhatsAppCustomer document's id. */
  whatsappCustomerId: string | null;
  /** The public WAPP code. Set only for `"guest"`; an account has no need of one. */
  displayId: string | null;
  name: string;
  phone: string;
  /** The website role for an account; a fixed label for a guest. */
  role: string;
  /** Null for an account: no per-channel language preference is stored on `User`. */
  language: "en" | "hi" | "hinglish" | null;
  status: "active" | "blocked";
}

/**
 * Builds the actor for a resolved WhatsApp identity.
 *
 * An `"account"` identity was matched by phone number alone, not by signing
 * in — so, unlike `actorFromUser`, it never carries a `principal`. Without
 * one, `assertCanManage`'s staff branch is unreachable for this actor: it can
 * only ever act on bookings that are actually theirs, checked the same way a
 * guest's are, by comparing identity fields on the booking itself.
 */
export const actorFromResolvedIdentity = (
  identity: WhatsAppResolvedIdentity,
): BookingActor => {
  if (identity.kind === "account")
    return {
      userId: identity.userId,
      whatsappCustomerId: null,
      role: identity.role || "customer",
      channel: WHATSAPP_BOOKING_CHANNEL,
      name: identity.name,
      phone: identity.phone,
    };
  return actorFromWhatsAppCustomer({
    id: identity.whatsappCustomerId!,
    name: identity.name,
    phone: identity.phone,
  });
};

/** The identity fields to write onto a booking-owned row for this actor. */
export const actorIdentityFields = (
  actor: BookingActor,
): { customerId: string | null; whatsappCustomerId: string | null } => ({
  customerId: actor.userId,
  whatsappCustomerId: actor.whatsappCustomerId,
});

/** The same identity, named as an outbox/payment row names it. */
export const actorOwnerFields = (
  actor: BookingActor,
): { userId: string | null; whatsappCustomerId: string | null } => ({
  userId: actor.userId,
  whatsappCustomerId: actor.whatsappCustomerId,
});

export interface BookingCustomerView {
  _id: string;
  name: string;
  email: string;
  phone: string;
  /** "account" for a website user, "whatsapp" for a WhatsApp guest. */
  kind: "account" | "whatsapp";
  /** Present only for a WhatsApp guest. */
  wappId?: string;
}

const asId = (value: unknown): string =>
  String((value as any)?._id ?? value ?? "");

/**
 * The customer identity on a booking row, whichever kind it is.
 * Returns null for a row whose customer could not be populated (a deleted
 * account), which callers already handle.
 */
export const bookingCustomerView = (row: any): BookingCustomerView | null => {
  const account = row?.customerId;
  if (account && typeof account === "object" && "name" in account)
    return {
      _id: asId(account),
      name: String(account.name ?? ""),
      email: String(account.email ?? ""),
      phone: String(account.phone ?? ""),
      kind: "account",
    };

  const guest = row?.whatsappCustomerId;
  if (guest && typeof guest === "object" && "wappId" in guest)
    return {
      _id: asId(guest),
      // A guest who never gave a name still has to render as something an
      // owner can read, and their WAPP id is the identifier they were given.
      name: String(guest.name || guest.wappId || "WhatsApp guest"),
      email: "",
      phone: String(guest.phone ?? ""),
      kind: "whatsapp",
      wappId: String(guest.wappId ?? ""),
    };

  return null;
};

/**
 * Normalizes one lean booking row for an owner or admin view.
 *
 * `customerId` is filled from the WhatsApp identity when the booking has no
 * account, so existing UI that reads `booking.customerId.name` keeps working
 * without a change. `whatsappCustomer` carries the WAPP id for the surfaces
 * that want to show it explicitly.
 */
export const withBookingCustomer = <T extends Record<string, any>>(
  row: T,
): T => {
  if (!row) return row;
  const view = bookingCustomerView(row);
  if (!view) return row;
  return {
    ...row,
    customerId:
      view.kind === "account"
        ? row.customerId
        : {
            _id: view._id,
            name: view.name,
            email: view.email,
            phone: view.phone,
          },
    ...(view.kind === "whatsapp"
      ? {
          whatsappCustomer: {
            _id: view._id,
            wappId: view.wappId,
            name: view.name,
            phone: view.phone,
          },
        }
      : {}),
    customerKind: view.kind,
  };
};

/** `withBookingCustomer` over a list. */
export const withBookingCustomers = <T extends Record<string, any>>(
  rows: T[],
): T[] => (Array.isArray(rows) ? rows.map(withBookingCustomer) : rows);

/**
 * The customer-identity filter for "bookings belonging to this requester".
 *
 * Website callers pass a user id; the WhatsApp channel passes a WhatsApp
 * customer id. Keeping the shape in one place stops a caller accidentally
 * querying `customerId` with a WhatsApp id, which would silently return
 * nothing — or worse, match a different customer.
 */
export const bookingOwnerFilter = (owner: {
  userId?: string | null;
  whatsappCustomerId?: string | null;
}): Record<string, unknown> => {
  if (owner.whatsappCustomerId)
    return { whatsappCustomerId: owner.whatsappCustomerId };
  if (owner.userId) return { customerId: owner.userId };
  // Never fall through to an unfiltered query: that would hand one caller
  // every customer's bookings.
  throw new Error("A booking owner filter needs a customer identity");
};

/**
 * True when `row` belongs to the given identity. Used before any action that
 * reads or changes someone's booking, so a reference typed into a chat can
 * never by itself authorize anything.
 */
export const bookingBelongsTo = (
  row: any,
  owner: { userId?: string | null; whatsappCustomerId?: string | null },
): boolean => {
  if (owner.whatsappCustomerId)
    return (
      Boolean(row?.whatsappCustomerId) &&
      asId(row.whatsappCustomerId) === String(owner.whatsappCustomerId)
    );
  if (owner.userId)
    return (
      Boolean(row?.customerId) && asId(row.customerId) === String(owner.userId)
    );
  return false;
};
