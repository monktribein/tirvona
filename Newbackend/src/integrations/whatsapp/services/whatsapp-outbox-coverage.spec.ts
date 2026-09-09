import { WHATSAPP_TEMPLATE } from "../constants/whatsapp.constants";
import type { WhatsAppOutboxNotification } from "../types/whatsapp.types";
import { WhatsAppTransactionalNotificationService } from "./whatsapp-transactional-notification.service";

const templatesStub = () => ({ send: jest.fn().mockResolvedValue({ status: "accepted", provider: "msg91" }) });

const serviceWith = (templates: ReturnType<typeof templatesStub>) =>
  new WhatsAppTransactionalNotificationService(templates as never);

const notification = (
  overrides: Partial<WhatsAppOutboxNotification>,
): WhatsAppOutboxNotification => ({
  domain: "booking",
  notificationId: "n-1",
  event: "booking_confirmed",
  phone: "+919876543210",
  title: "Booking confirmed",
  message: "Your booking TRV-1 is confirmed.",
  ...overrides,
});

describe("WhatsApp outbox coverage", () => {
  describe("template resolution", () => {
    const service = serviceWith(templatesStub());

    it.each([
      ["booking", "booking_confirmed", WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION],
      ["booking", "payment_success", WHATSAPP_TEMPLATE.PAYMENT_SUCCESS],
      ["booking", "payment_failed", WHATSAPP_TEMPLATE.PAYMENT_FAILURE],
      ["booking", "booking_cancelled", WHATSAPP_TEMPLATE.CANCELLATION],
      ["booking", "refund_completed", WHATSAPP_TEMPLATE.REFUND],
      ["booking", "checkin_reminder", WHATSAPP_TEMPLATE.CHECKIN_REMINDER],
      ["booking", "checked_in", WHATSAPP_TEMPLATE.CHECKIN_CONFIRMED],
      ["booking", "checked_out", WHATSAPP_TEMPLATE.CHECKOUT_COMPLETED],
      ["parking", "booking_confirmed", WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION],
      ["aarti", "booking_confirmed", WHATSAPP_TEMPLATE.AARTI_CONFIRMATION],
      ["aarti", "cancellation", WHATSAPP_TEMPLATE.AARTI_CANCELLATION],
      ["aarti", "refund", WHATSAPP_TEMPLATE.REFUND],
      ["event", "registration_confirmed", WHATSAPP_TEMPLATE.EVENT_REGISTRATION],
      ["event", "cancellation", WHATSAPP_TEMPLATE.EVENT_CANCELLATION],
      [
        "community",
        "volunteer_application_submitted",
        WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION,
      ],
      ["booking", "something_unmapped", WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION],
    ])("maps %s/%s to %s", (domain, event, expected) => {
      expect(service.templateKeyFor(domain, event)).toBe(expected);
    });

    it("keeps aarti and stay bookings on separate templates for one event name", () => {
      expect(service.templateKeyFor("aarti", "booking_confirmed")).not.toBe(
        service.templateKeyFor("booking", "booking_confirmed"),
      );
    });
  });

  describe("template variables", () => {
    it("carries the full stay detail a booking template needs", async () => {
      const templates = templatesStub();
      await serviceWith(templates).sendOutboxEvent(
        notification({
          recipientName: "Asha Verma",
          stay: {
            guestName: "Asha Verma",
            reference: "TRV-1001",
            ashramName: "Rishikesh Ashram",
            ashramCity: "Rishikesh",
            ashramState: "Uttarakhand",
            roomName: "Ganga Dorm",
            checkInDate: "2026-01-10T04:30:00.000Z",
            checkOutDate: "2026-01-12T05:30:00.000Z",
            guestsCount: 2,
            roomsCount: 1,
            checkInCode: "482913",
            amountPaid: 2400,
            totalAmount: 2400,
            currency: "INR",
          },
        }),
      );

      const variables = templates.send.mock.calls[0][0].variables;
      expect(variables).toMatchObject({
        guest_name: "Asha Verma",
        ashram_name: "Rishikesh Ashram",
        location: "Rishikesh, Uttarakhand",
        room_name: "Ganga Dorm",
        reference: "TRV-1001",
        guests: 2,
        rooms: 1,
        code: "482913",
        amount: "₹2,400",
      });
      expect(String(variables.check_in)).toContain("Jan");
      expect(String(variables.check_out)).toContain("Jan");
    });

    it("carries the parking gate code and pass link", async () => {
      const templates = templatesStub();
      await serviceWith(templates).sendOutboxEvent(
        notification({
          domain: "parking",
          parking: {
            reference: "PRK-9",
            locationName: "North Gate",
            vehicleNumber: "UP32AB1234",
            displayCode: "GATE-77",
            passUrl: "https://www.tirvona.com/parking/booking/PRK-9",
            amountPaid: 50,
            currency: "INR",
          },
        }),
      );

      expect(templates.send.mock.calls[0][0].variables).toMatchObject({
        reference: "PRK-9",
        location: "North Gate",
        vehicle_number: "UP32AB1234",
        code: "GATE-77",
        pass_url: "https://www.tirvona.com/parking/booking/PRK-9",
        amount: "₹50",
      });
    });

    it("carries the aarti session and entry code", async () => {
      const templates = templatesStub();
      await serviceWith(templates).sendOutboxEvent(
        notification({
          domain: "aarti",
          aarti: {
            guestName: "Ravi",
            reference: "AAR-5",
            sessionName: "Ganga Aarti",
            displayCode: "AA-31",
            amountPaid: 100,
            currency: "INR",
          },
        }),
      );

      expect(templates.send.mock.calls[0][0].variables).toMatchObject({
        guest_name: "Ravi",
        session_name: "Ganga Aarti",
        reference: "AAR-5",
        code: "AA-31",
      });
    });

    it("carries the event name and entry code", async () => {
      const templates = templatesStub();
      await serviceWith(templates).sendOutboxEvent(
        notification({
          domain: "event",
          event: "registration_confirmed",
          eventPass: {
            guestName: "Meera",
            reference: "EVT-3",
            eventName: "Deepotsav",
            venue: "Main Hall",
            displayCode: "EV-12",
          },
        }),
      );

      expect(templates.send.mock.calls[0][0].variables).toMatchObject({
        guest_name: "Meera",
        event_name: "Deepotsav",
        reference: "EVT-3",
        code: "EV-12",
        location: "Main Hall",
      });
    });

    it("omits variables with no value rather than sending empty placeholders", async () => {
      const templates = templatesStub();
      await serviceWith(templates).sendOutboxEvent(
        notification({ stay: { reference: "TRV-2" } }),
      );

      const variables = templates.send.mock.calls[0][0].variables;
      expect(variables).not.toHaveProperty("ashram_name");
      expect(variables).not.toHaveProperty("code");
      expect(variables.reference).toBe("TRV-2");
    });

    it("always supplies the composed body so the text provider is unaffected", async () => {
      const templates = templatesStub();
      await serviceWith(templates).sendOutboxEvent(
        notification({
          stay: { reference: "TRV-3", ashramName: "Kashi Ashram" },
        }),
      );

      const variables = templates.send.mock.calls[0][0].variables;
      expect(String(variables.message)).toContain("Kashi Ashram");
      expect(String(variables.message)).toContain("Booking Confirmed");
    });

    it("sends one message per outbox row", async () => {
      const templates = templatesStub();
      await serviceWith(templates).sendOutboxEvent(notification({}));
      expect(templates.send).toHaveBeenCalledTimes(1);
    });
  });
});
