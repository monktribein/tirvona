import type { WhatsAppOutboxNotification } from "../types/whatsapp.types";
import { WhatsAppTransactionalNotificationService } from "./whatsapp-transactional-notification.service";

const templatesStub = () => ({
  send: jest
    .fn()
    .mockResolvedValue({ status: "accepted", provider: "meta_cloud" }),
});

const notification = (
  overrides: Partial<WhatsAppOutboxNotification>,
): WhatsAppOutboxNotification => ({
  domain: "booking",
  notificationId: "n-1",
  event: "booking_confirmed",
  phone: "+919876543210",
  recipientName: "Asha Verma",
  title: "Booking confirmed",
  message: "Your booking TRV-1001 is confirmed.",
  ...overrides,
});

const stay = {
  guestName: "Asha Verma",
  reference: "TRV-1001",
  ashramName: "Kashi Ashram",
  roomName: "Ganga Dorm",
  checkInDate: "2026-01-10T04:30:00.000Z",
  checkOutDate: "2026-01-12T05:30:00.000Z",
  guestsCount: 2,
  checkInCode: "482913",
  amountPaid: 2400,
  totalAmount: 2400,
  currency: "INR",
};

/** Sends one notification and returns what reached the template service. */
const deliver = async (input: Partial<WhatsAppOutboxNotification>) => {
  const templates = templatesStub();
  const result = await new WhatsAppTransactionalNotificationService(
    templates as never,
  ).sendOutboxEvent(notification(input));
  return { templates, result, sent: templates.send.mock.calls[0]?.[0] };
};

describe("WhatsApp transactional notifications for Meta templates", () => {
  it("reservation held carries amount due and the payment deadline", async () => {
    const { sent } = await deliver({
      event: "booking_held",
      stay: {
        ...stay,
        amountPaid: 0,
        reservationExpiresAt: "2026-01-05T10:00:00.000Z",
      },
    });
    expect(sent.metaEvent).toBe("reservation_held");
    expect(sent.variables).toMatchObject({
      customer_name: "Asha Verma",
      booking_type: "Ashram stay",
      reference: "TRV-1001",
      amount_due: "₹2,400",
    });
    expect(String(sent.variables.payment_deadline)).toContain("2026");
  });

  it("stay confirmed carries dates, guests, amount and the stored check-in code", async () => {
    const { sent } = await deliver({ event: "booking_confirmed", stay });
    expect(sent.metaEvent).toBe("stay_confirmed");
    expect(sent.variables).toMatchObject({
      property_name: "Kashi Ashram",
      reference: "TRV-1001",
      guests: 2,
      amount_paid: "₹2,400",
      check_in_code: "482913",
    });
    expect(String(sent.variables.check_in_date)).toContain("Jan");
    expect(String(sent.variables.check_out_date)).toContain("Jan");
  });

  it("never sends an unverified payment failure over WhatsApp", async () => {
    const { templates, result } = await deliver({
      event: "payment_failed",
      stay,
    });
    expect(templates.send).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "skipped",
      reason: "payment_failure_unverified",
    });
  });

  it("stay cancellation carries the refund status and amount", async () => {
    const { sent } = await deliver({
      event: "booking_cancelled",
      stay,
      data: { refundAmount: "1200" },
    });
    expect(sent.metaEvent).toBe("reservation_cancelled");
    expect(sent.variables).toMatchObject({
      booking_type: "Ashram stay",
      refund_status: "Refund initiated",
      refund_amount: "₹1,200",
    });
  });

  it("a cancellation with nothing refundable says so", async () => {
    const { sent } = await deliver({
      event: "booking_cancelled",
      stay,
      data: { refundAmount: "0" },
    });
    expect(sent.variables).toMatchObject({
      refund_status: "No refund due",
      refund_amount: "₹0",
    });
  });

  it("refund update carries status, amount and the refund number", async () => {
    const { sent } = await deliver({
      event: "refund_completed",
      stay,
      data: {
        amount: "1200",
        refundNumber: "RFD-2026-0001",
        refundStatus: "completed",
      },
    });
    expect(sent.metaEvent).toBe("refund_update");
    expect(sent.variables).toMatchObject({
      reference: "TRV-1001",
      refund_status: "Completed",
      refund_amount: "₹1,200",
      payment_reference: "RFD-2026-0001",
    });
  });

  it("reservation expired carries when the hold lapsed", async () => {
    const { sent } = await deliver({
      event: "booking_expired",
      stay,
      occurredAt: "2026-01-05T10:01:00.000Z",
    });
    expect(sent.metaEvent).toBe("reservation_expired");
    expect(String(sent.variables.expiry_time)).toContain("2026");
  });

  it("stay check-in carries the time and assigned rooms", async () => {
    const { sent } = await deliver({
      event: "checked_in",
      stay: {
        ...stay,
        checkedInAt: "2026-01-10T06:00:00.000Z",
        roomNumbers: ["101", "102"],
      },
    });
    expect(sent.metaEvent).toBe("service_checked_in");
    expect(sent.variables.service_details).toBe("Room 101, 102");
    expect(String(sent.variables.check_in_time)).toContain("Jan");
  });

  it("stay check-out carries the settlement", async () => {
    const { sent } = await deliver({
      event: "checked_out",
      stay: { ...stay, checkedOutAt: "2026-01-12T05:00:00.000Z" },
    });
    expect(sent.metaEvent).toBe("service_checked_out");
    expect(sent.variables.settlement_details).toBe("Amount paid ₹2,400");
  });

  it("stay reminder comes from the existing check-in reminder event", async () => {
    const { sent } = await deliver({ event: "checkin_reminder", stay });
    expect(sent.metaEvent).toBe("stay_reminder");
  });

  it("parking confirmation carries the stored gate code and times", async () => {
    const { sent } = await deliver({
      domain: "parking",
      event: "booking_confirmed",
      parking: {
        reference: "PRK-9",
        locationName: "North Gate",
        locationCity: "Haridwar",
        vehicleNumber: "UP32AB1234",
        entryAt: "2026-01-10T04:30:00.000Z",
        exitAt: "2026-01-10T08:30:00.000Z",
        displayCode: "GATE-77",
        amountPaid: 50,
        currency: "INR",
      },
    });
    expect(sent.metaEvent).toBe("parking_confirmed");
    expect(sent.variables).toMatchObject({
      parking_location: "North Gate, Haridwar",
      reference: "PRK-9",
      vehicle_number: "UP32AB1234",
      amount_paid: "₹50",
      gate_code: "GATE-77",
    });
    expect(String(sent.variables.entry_time)).toContain("Jan");
  });

  it("parking entry reads as an entry, not as a fresh confirmation", async () => {
    const { sent } = await deliver({
      domain: "parking",
      event: "checked_in",
      parking: {
        reference: "PRK-9",
        locationName: "North Gate",
        vehicleNumber: "UP32AB1234",
        slotNumber: "B12",
        checkedInAt: "2026-01-10T04:35:00.000Z",
      },
    });
    expect(sent.metaEvent).toBe("service_checked_in");
    expect(String(sent.variables.message)).toContain("Parking Entry Recorded");
    expect(String(sent.variables.message)).not.toContain("Parking Confirmed");
    expect(sent.variables.service_details).toBe(
      "Bay B12, North Gate, Vehicle UP32AB1234",
    );
  });

  it("parking exit carries any overstay charge", async () => {
    const { sent } = await deliver({
      domain: "parking",
      event: "checked_out",
      parking: { reference: "PRK-9", overstayAmount: 40, currency: "INR" },
    });
    expect(sent.metaEvent).toBe("service_checked_out");
    expect(sent.variables.settlement_details).toBe("Overstay charge ₹40");
  });

  it("never tells a paid parking no-show that the reservation expired", async () => {
    const { templates, result } = await deliver({
      domain: "parking",
      event: "no_show",
      parking: { reference: "PRK-9", amountPaid: 50 },
    });
    expect(templates.send).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "skipped",
      reason: "paid_no_show_has_no_template",
    });
  });

  it("aarti confirmation carries devotees and the stored entry code", async () => {
    const { sent } = await deliver({
      domain: "aarti",
      event: "booking_confirmed",
      aarti: {
        guestName: "Ravi",
        reference: "AAR-5",
        sessionName: "Ganga Aarti",
        displayCode: "AA-31",
        passCount: 3,
        scheduledAt: "2026-01-10T13:00:00.000Z",
        amountPaid: 300,
        currency: "INR",
      },
    });
    expect(sent.metaEvent).toBe("aarti_confirmed");
    expect(sent.variables).toMatchObject({
      customer_name: "Ravi",
      service_name: "Ganga Aarti",
      reference: "AAR-5",
      devotees: 3,
      amount_paid: "₹300",
      entry_code: "AA-31",
    });
  });

  it("event registration carries seats, venue and the stored entry code", async () => {
    const { sent } = await deliver({
      domain: "event",
      event: "registration_confirmed",
      eventPass: {
        guestName: "Meera",
        reference: "EVT-3",
        eventName: "Deepotsav",
        venue: "Main Hall",
        displayCode: "EV-12",
        seats: 2,
        startsAt: "2026-01-10T13:00:00.000Z",
      },
    });
    expect(sent.metaEvent).toBe("event_registered");
    expect(sent.variables).toMatchObject({
      customer_name: "Meera",
      event_name: "Deepotsav",
      reference: "EVT-3",
      venue: "Main Hall",
      seats: 2,
      entry_code: "EV-12",
    });
  });

  it("event cancellation reports that nothing is refundable", async () => {
    const { sent } = await deliver({
      domain: "event",
      event: "cancellation",
      eventPass: { reference: "EVT-3" },
    });
    expect(sent.metaEvent).toBe("reservation_cancelled");
    expect(sent.variables.refund_status).toBe("Not applicable");
  });

  it("community notifications carry no Meta event and keep their existing path", async () => {
    const { sent } = await deliver({
      domain: "community",
      event: "volunteer_application_submitted",
    });
    expect(sent).not.toHaveProperty("metaEvent");
    expect(sent.templateKey).toBe("general_notification");
  });
});
