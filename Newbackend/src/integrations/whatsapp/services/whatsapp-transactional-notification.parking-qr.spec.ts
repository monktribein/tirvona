import type { WhatsAppOutboxNotification } from "../types/whatsapp.types";
import { parseTestRecipients } from "../utils/whatsapp-test-recipients.util";
import { WhatsAppTransactionalNotificationService } from "./whatsapp-transactional-notification.service";

const QR_PNG = Buffer.from("rendered-parking-pass-png");

const templatesStub = () => ({
  send: jest.fn().mockResolvedValue({ status: "accepted", provider: "meta_cloud" }),
});

const parkingConfirmed = (
  overrides: Partial<WhatsAppOutboxNotification> = {},
): WhatsAppOutboxNotification => ({
  domain: "parking",
  notificationId: "n-1",
  event: "booking_confirmed",
  phone: "919811111111",
  title: "Parking Confirmed",
  message: "Your parking booking PRK-9 is confirmed.",
  parking: { reference: "PRK-9", displayCode: "1CNC-AKPC", locationName: "North Gate" },
  parkingQrImage: QR_PNG,
  ...overrides,
});

const sent = async (
  notification: WhatsAppOutboxNotification,
  config?: unknown,
) => {
  const templates = templatesStub();
  await new WhatsAppTransactionalNotificationService(
    templates as never,
    config as never,
  ).sendOutboxEvent(notification);
  return { templates, input: templates.send.mock.calls[0]?.[0] };
};

describe("WhatsApp parking confirmation QR follow-up", () => {
  it("attaches the rendered pass QR to the parking confirmation", async () => {
    const { input } = await sent(parkingConfirmed());
    expect(input.metaEvent).toBe("parking_confirmed");
    expect(input.followUpImage).toEqual({
      data: QR_PNG,
      mimeType: "image/png",
      filename: "tirvona-parking-pass-PRK-9.png",
      caption:
        "Tirvona parking pass PRK-9\nShow this QR code at the parking entry gate.\nGate code: 1CNC-AKPC",
    });
    // The gate code in the template body is unchanged by the QR follow-up.
    expect(input.variables.gate_code).toBe("1CNC-AKPC");
  });

  it("sends no image when the worker had no QR to render", async () => {
    const { input } = await sent(parkingConfirmed({ parkingQrImage: undefined }));
    expect(input).not.toHaveProperty("followUpImage");
  });

  it.each([
    ["parking entry", { event: "checked_in" }],
    ["parking cancellation", { event: "cancellation" }],
    ["stay confirmation", { domain: "booking" as const, parking: undefined }],
  ])("sends no QR image with a %s", async (_label, overrides) => {
    const { input } = await sent(parkingConfirmed(overrides));
    expect(input).not.toHaveProperty("followUpImage");
  });

  it("still blocks a non-allow-listed recipient in test mode, QR included", async () => {
    const { templates } = await sent(parkingConfirmed(), {
      testMode: true,
      testRecipients: parseTestRecipients("919936968762"),
    });
    expect(templates.send).not.toHaveBeenCalled();
  });
});
