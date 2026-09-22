import { createHmac } from "node:crypto";
import {
  PAYMENT_LINK_PURPOSE,
  PAYMENT_LINK_VERSION,
  paymentLinkKey,
  signPaymentLink,
  verifyPaymentLink,
  type PaymentLinkClaims,
} from "./payment-link-token";

const KEY = Buffer.from("k".repeat(40));
const NOW = 1_800_000_000_000;

const claims = (extra: Partial<PaymentLinkClaims> = {}): PaymentLinkClaims => ({
  v: PAYMENT_LINK_VERSION,
  p: PAYMENT_LINK_PURPOSE,
  b: "507f1f77bcf86cd799439011",
  j: "abcdef0123456789abcdef0123456789",
  iat: NOW - 1000,
  exp: NOW + 10 * 60_000,
  ...extra,
});

const b64u = (value: Buffer | string) => Buffer.from(value).toString("base64url");

describe("signPaymentLink / verifyPaymentLink", () => {
  it("accepts a token it signed", () => {
    const token = signPaymentLink(claims(), KEY);
    const verdict = verifyPaymentLink(token, KEY, NOW);
    expect(verdict).toEqual({ ok: true, claims: claims() });
  });

  it("rejects an expired token", () => {
    const token = signPaymentLink(claims({ exp: NOW - 1 }), KEY);
    expect(verifyPaymentLink(token, KEY, NOW)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a token at exactly its expiry instant", () => {
    const token = signPaymentLink(claims({ exp: NOW }), KEY);
    expect(verifyPaymentLink(token, KEY, NOW)).toMatchObject({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a token signed with a different key", () => {
    const token = signPaymentLink(claims(), Buffer.from("x".repeat(40)));
    expect(verifyPaymentLink(token, KEY, NOW)).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("rejects a token whose booking id was swapped, keeping the old signature", () => {
    const token = signPaymentLink(claims(), KEY);
    const [, signature] = token.split(".");
    const forged = `${b64u(JSON.stringify(claims({ b: "507f1f77bcf86cd799439099" })))}.${signature}`;
    expect(verifyPaymentLink(forged, KEY, NOW)).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("rejects a token whose expiry was extended", () => {
    const token = signPaymentLink(claims({ exp: NOW + 1000 }), KEY);
    const [, signature] = token.split(".");
    const forged = `${b64u(JSON.stringify(claims({ exp: NOW + 86_400_000 })))}.${signature}`;
    expect(verifyPaymentLink(forged, KEY, NOW).ok).toBe(false);
  });

  it("rejects a token signed correctly but minted for another purpose", () => {
    const token = signPaymentLink(claims({ p: "parking_pay" }), KEY);
    expect(verifyPaymentLink(token, KEY, NOW)).toEqual({
      ok: false,
      reason: "purpose",
    });
  });

  it("rejects an unknown token version", () => {
    const token = signPaymentLink(claims({ v: 99 }), KEY);
    expect(verifyPaymentLink(token, KEY, NOW)).toMatchObject({
      ok: false,
      reason: "purpose",
    });
  });

  it.each([
    "",
    "not-a-token",
    "a.b.c",
    ".",
    "abc.",
    ".abc",
    "x".repeat(600),
  ])("rejects a malformed token %j", (token) => {
    expect(verifyPaymentLink(token, KEY, NOW).ok).toBe(false);
  });

  it("rejects a session-style JWT presented as a payment token", () => {
    // Three dot-separated parts, as a real JWT has.
    const jwtLike = `${b64u('{"alg":"HS256"}')}.${b64u('{"sub":"u1"}')}.${b64u("sig")}`;
    expect(verifyPaymentLink(jwtLike, KEY, NOW).ok).toBe(false);
  });

  it("rejects signed-but-nonsense claims", () => {
    const payload = b64u(JSON.stringify({ hello: "world" }));
    const signature = b64u(createHmac("sha256", KEY).update(payload).digest());
    expect(verifyPaymentLink(`${payload}.${signature}`, KEY, NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("verifies the signature before trusting the payload", () => {
    // A payload that is not even JSON, with a wrong signature, must fail as a
    // signature problem — it is never parsed.
    expect(verifyPaymentLink(`${b64u("{{{")}.${b64u("nope")}`, KEY, NOW)).toEqual(
      { ok: false, reason: "signature" },
    );
  });
});

describe("what a token contains", () => {
  it("carries no amount, currency, order id, name, phone, email or identity", () => {
    const token = signPaymentLink(claims(), KEY);
    const decoded = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString("utf8"),
    );
    expect(Object.keys(decoded).sort()).toEqual(
      ["b", "exp", "iat", "j", "p", "v"].sort(),
    );
    expect(JSON.stringify(decoded)).not.toMatch(
      /amount|currency|order|phone|email|name|customer|user|whatsapp/i,
    );
  });

  it("stays short enough to sit in a WhatsApp message", () => {
    expect(signPaymentLink(claims(), KEY).length).toBeLessThan(300);
  });
});

describe("paymentLinkKey", () => {
  const JWT = "j".repeat(48);

  it("prefers an explicit dedicated secret", () => {
    const key = paymentLinkKey({ explicit: "e".repeat(40), jwtSecret: JWT });
    expect(key?.toString()).toBe("e".repeat(40));
  });

  it("derives a separate key from the JWT secret when none is set", () => {
    const key = paymentLinkKey({ explicit: "", jwtSecret: JWT });
    expect(key).not.toBeNull();
    // Domain-separated: it is not the JWT secret itself, so a payment token
    // cannot be forged with the key that signs sessions, or vice versa.
    expect(key!.toString("utf8")).not.toBe(JWT);
    expect(key!.length).toBe(32);
  });

  it("is deterministic, so a link issued by one instance verifies on another", () => {
    const a = paymentLinkKey({ jwtSecret: JWT })!;
    const b = paymentLinkKey({ jwtSecret: JWT })!;
    expect(a.equals(b)).toBe(true);
  });

  it("changes when the JWT secret changes", () => {
    const a = paymentLinkKey({ jwtSecret: JWT })!;
    const b = paymentLinkKey({ jwtSecret: "z".repeat(48) })!;
    expect(a.equals(b)).toBe(false);
  });

  it("refuses to sign with a weak or missing secret", () => {
    expect(paymentLinkKey({ explicit: "short", jwtSecret: "short" })).toBeNull();
    expect(paymentLinkKey({})).toBeNull();
    expect(paymentLinkKey({ explicit: "", jwtSecret: "" })).toBeNull();
  });

  it("a token signed with the derived key is not valid under the raw JWT secret", () => {
    const derived = paymentLinkKey({ jwtSecret: JWT })!;
    const token = signPaymentLink(claims(), derived);
    expect(verifyPaymentLink(token, Buffer.from(JWT), NOW).ok).toBe(false);
  });
});
