import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * The signed token in a WhatsApp payment link.
 *
 * A token is a *capability to pay one specific booking*, nothing more. It says
 * which booking (`b`), what it is for (`p`), which link it is (`j`) and when it
 * stops working (`exp`). It deliberately carries no amount, no currency, no
 * order id, no name, no phone number and no identity: every one of those is
 * read from the server's own records when the link is used, so there is
 * nothing in the token a client could edit to change what is paid or by whom.
 *
 * Signed with HMAC-SHA256 and a key that is used for nothing else, so a token
 * cannot be forged from — or mistaken for — a session JWT, and vice versa.
 */

export const PAYMENT_LINK_PURPOSE = "stay_pay";
/**
 * A parking payment link. Same key and format, different purpose: a stay
 * token is refused by the parking endpoints and a parking token by the stay
 * ones, because each verifies the purpose it expects.
 */
export const PARKING_PAYMENT_LINK_PURPOSE = "parking_pay";
export const PAYMENT_LINK_VERSION = 1;
/** The longest a link lives, even if the booking hold would last longer. */
export const PAYMENT_LINK_MAX_TTL_MS = 30 * 60_000;

export interface PaymentLinkClaims {
  /** Token format version. */
  v: number;
  /** Purpose. A token minted for anything else is refused. */
  p: string;
  /** The booking this link can pay — its database id. */
  b: string;
  /** This link's id. Only the most recently issued one is honoured. */
  j: string;
  /** Issued at, epoch milliseconds. */
  iat: number;
  /** Expires at, epoch milliseconds. */
  exp: number;
}

export type PaymentLinkRejection =
  | "malformed"
  | "signature"
  | "purpose"
  | "expired";

export type PaymentLinkVerdict =
  | { ok: true; claims: PaymentLinkClaims }
  | { ok: false; reason: PaymentLinkRejection };

const b64u = (value: Buffer | string): string =>
  Buffer.from(value).toString("base64url");

const INFO = "tirvona:stay-payment-link:v1";

/**
 * The signing key. A dedicated `PAYMENT_LINK_SECRET` is used when configured;
 * otherwise a key is derived from the API's JWT secret with HKDF and a fixed,
 * domain-separating label, so it is a different key from the JWT signing key
 * and cannot be used to forge one. With neither, there is no key and links
 * are neither issued nor accepted.
 */
export const paymentLinkKey = (input: {
  explicit?: string | null;
  jwtSecret?: string | null;
}): Buffer | null => {
  const explicit = String(input.explicit ?? "");
  if (explicit.length >= 32) return Buffer.from(explicit, "utf8");
  const jwt = String(input.jwtSecret ?? "");
  if (jwt.length >= 32)
    return Buffer.from(
      hkdfSync("sha256", Buffer.from(jwt, "utf8"), Buffer.from("tirvona"), INFO, 32),
    );
  return null;
};

const sign = (payload: string, key: Buffer): string =>
  b64u(createHmac("sha256", key).update(payload).digest());

export const signPaymentLink = (
  claims: PaymentLinkClaims,
  key: Buffer,
): string => {
  const payload = b64u(JSON.stringify(claims));
  return `${payload}.${sign(payload, key)}`;
};

/**
 * Checks a token. The signature is verified first, in constant time, so an
 * unsigned or altered token is rejected before its contents are trusted or
 * even parsed.
 */
export const verifyPaymentLink = (
  token: string,
  key: Buffer,
  now: number = Date.now(),
  purpose: string = PAYMENT_LINK_PURPOSE,
): PaymentLinkVerdict => {
  if (typeof token !== "string" || token.length > 512)
    return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1])
    return { ok: false, reason: "malformed" };
  const [payload, signature] = parts;

  const expected = Buffer.from(sign(payload, key));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return { ok: false, reason: "signature" };

  let claims: PaymentLinkClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    !claims ||
    typeof claims.b !== "string" ||
    typeof claims.j !== "string" ||
    typeof claims.exp !== "number" ||
    typeof claims.iat !== "number"
  )
    return { ok: false, reason: "malformed" };
  if (claims.p !== purpose || claims.v !== PAYMENT_LINK_VERSION)
    return { ok: false, reason: "purpose" };
  if (now >= claims.exp) return { ok: false, reason: "expired" };
  return { ok: true, claims };
};
