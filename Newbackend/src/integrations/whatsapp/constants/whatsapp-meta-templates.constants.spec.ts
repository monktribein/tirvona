import { META_AUTH_OTP_TEMPLATE } from "./whatsapp.constants";
import {
  META_TRANSACTIONAL_EVENT,
  META_TRANSACTIONAL_TEMPLATE_SPEC,
  metaTransactionalEventFor,
  whatsappSuppressionReasonFor,
} from "./whatsapp-meta-templates.constants";

describe("Meta transactional template catalog", () => {
  it("proposes a tirvona_ template with ordered variables for every logical event", () => {
    for (const event of Object.values(META_TRANSACTIONAL_EVENT)) {
      const spec = META_TRANSACTIONAL_TEMPLATE_SPEC[event];
      expect(spec.proposedName).toBe(`tirvona_${event}`);
      expect(spec.bodyVariables.length).toBeGreaterThan(0);
    }
  });

  it("never proposes the working authentication template", () => {
    const names = Object.values(META_TRANSACTIONAL_TEMPLATE_SPEC).map(
      (spec) => spec.proposedName,
    );
    expect(names).not.toContain(META_AUTH_OTP_TEMPLATE);
  });

  it.each([
    ["booking", "booking_held", "reservation_held"],
    ["booking", "booking_confirmed", "stay_confirmed"],
    ["booking", "payment_failed", "payment_failed"],
    ["booking", "booking_cancelled", "reservation_cancelled"],
    ["booking", "booking_expired", "reservation_expired"],
    ["booking", "checked_in", "service_checked_in"],
    ["booking", "checked_out", "service_checked_out"],
    ["booking", "checkin_reminder", "stay_reminder"],
    ["booking", "refund_approved", "refund_update"],
    ["booking", "refund_failed", "refund_update"],
    ["booking", "refund_completed", "refund_update"],
    ["parking", "booking_confirmed", "parking_confirmed"],
    ["parking", "cancellation", "reservation_cancelled"],
    ["parking", "refund", "reservation_cancelled"],
    ["parking", "checked_in", "service_checked_in"],
    ["parking", "checked_out", "service_checked_out"],
    ["parking", "expired", "reservation_expired"],
    ["parking", "exit_reminder", "parking_reminder"],
    ["aarti", "booking_confirmed", "aarti_confirmed"],
    ["aarti", "cancellation", "reservation_cancelled"],
    ["aarti", "refund", "reservation_cancelled"],
    ["aarti", "checked_in", "service_checked_in"],
    ["aarti", "aarti_reminder", "aarti_reminder"],
    ["event", "registration_confirmed", "event_registered"],
    ["event", "cancellation", "reservation_cancelled"],
    ["event", "event_reminder", "event_reminder"],
  ])("maps %s/%s to %s", (domain, event, expected) => {
    expect(metaTransactionalEventFor(domain, event)).toBe(expected);
  });

  it("keeps community, marketplace-style and unrelated events off Meta", () => {
    expect(metaTransactionalEventFor("community", "article_liked")).toBeUndefined();
    expect(
      metaTransactionalEventFor("community", "volunteer_application_submitted"),
    ).toBeUndefined();
    expect(metaTransactionalEventFor("booking", "room_assigned")).toBeUndefined();
  });

  it("suppresses unverified payment failures from WhatsApp in every paid domain", () => {
    for (const domain of ["booking", "parking", "aarti"])
      expect(whatsappSuppressionReasonFor(domain, "payment_failed")).toBe(
        "payment_failure_unverified",
      );
    expect(
      whatsappSuppressionReasonFor("booking", "booking_confirmed"),
    ).toBeUndefined();
  });

  it("keeps a paid parking no-show off WhatsApp and off the expired template", () => {
    expect(metaTransactionalEventFor("parking", "no_show")).toBeUndefined();
    expect(whatsappSuppressionReasonFor("parking", "no_show")).toBe(
      "paid_no_show_has_no_template",
    );
    // An unpaid hold that lapsed is still a genuine expiry.
    expect(metaTransactionalEventFor("parking", "expired")).toBe(
      "reservation_expired",
    );
    expect(whatsappSuppressionReasonFor("parking", "expired")).toBeUndefined();
  });
});
