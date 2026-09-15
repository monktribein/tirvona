import {
  WhatsAppDeliveryUnconfirmedError,
  WhatsAppIntegrationError,
} from "../errors/whatsapp.errors";
import type { WhatsAppProviderRequest } from "../types/whatsapp.types";
import { WhatsAppProviderRouter } from "./whatsapp-provider.router";

const transactional: WhatsAppProviderRequest = {
  to: "+919876543210",
  messageType: "booking_confirmation",
  message: "Your stay is confirmed.",
  idempotencyKey: "booking:n-1:whatsapp",
  metaEvent: "stay_confirmed",
  templateVariables: { reference: "TRV-1001" },
};

const metaCloudStub = (overrides: Record<string, unknown> = {}) => ({
  isAvailable: jest.fn().mockReturnValue(true),
  supports: jest.fn().mockReturnValue(false),
  supportsTransactional: jest.fn().mockReturnValue(true),
  sendMessage: jest
    .fn()
    .mockResolvedValue({ status: "accepted", provider: "meta_cloud" }),
  ...overrides,
});

const msg91Stub = () => ({
  isAvailable: jest.fn().mockReturnValue(false),
  supports: jest.fn().mockReturnValue(false),
  sendMessage: jest.fn(),
});

const akNexusStub = () => ({
  sendMessage: jest
    .fn()
    .mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
});

const router = (
  metaCloud: ReturnType<typeof metaCloudStub>,
  msg91: ReturnType<typeof msg91Stub>,
  akNexus: ReturnType<typeof akNexusStub>,
) =>
  new WhatsAppProviderRouter(
    metaCloud as never,
    msg91 as never,
    akNexus as never,
  );

describe("WhatsAppProviderRouter transactional notifications", () => {
  it("uses Meta Cloud when the event's approved template is configured", async () => {
    const metaCloud = metaCloudStub();
    const akNexus = akNexusStub();

    await expect(
      router(metaCloud, msg91Stub(), akNexus).sendMessage(transactional),
    ).resolves.toMatchObject({ provider: "meta_cloud" });
    expect(metaCloud.sendMessage).toHaveBeenCalledWith(transactional);
    expect(akNexus.sendMessage).not.toHaveBeenCalled();
  });

  it("skips Meta and keeps the existing path when no template is configured", async () => {
    const metaCloud = metaCloudStub({
      supportsTransactional: jest.fn().mockReturnValue(false),
    });
    const akNexus = akNexusStub();

    await expect(
      router(metaCloud, msg91Stub(), akNexus).sendMessage(transactional),
    ).resolves.toMatchObject({ provider: "ak_nexus" });
    expect(metaCloud.sendMessage).not.toHaveBeenCalled();
    expect(akNexus.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("stops without any fallback when Meta's outcome is unconfirmed", async () => {
    const metaCloud = metaCloudStub({
      sendMessage: jest
        .fn()
        .mockRejectedValue(new WhatsAppDeliveryUnconfirmedError("meta_cloud")),
    });
    const msg91 = msg91Stub();
    msg91.isAvailable.mockReturnValue(true);
    msg91.supports.mockReturnValue(true);
    const akNexus = akNexusStub();

    await expect(
      router(metaCloud, msg91, akNexus).sendMessage(transactional),
    ).rejects.toBeInstanceOf(WhatsAppDeliveryUnconfirmedError);
    expect(metaCloud.sendMessage).toHaveBeenCalledTimes(1);
    expect(msg91.sendMessage).not.toHaveBeenCalled();
    expect(akNexus.sendMessage).not.toHaveBeenCalled();
  });

  it("falls back after a definite Meta rejection, which cannot have delivered", async () => {
    const metaCloud = metaCloudStub({
      sendMessage: jest
        .fn()
        .mockRejectedValue(
          new WhatsAppIntegrationError(
            "Meta rejected the WhatsApp template request",
            "INVALID_REQUEST",
            false,
            400,
          ),
        ),
    });
    const akNexus = akNexusStub();

    await expect(
      router(metaCloud, msg91Stub(), akNexus).sendMessage(transactional),
    ).resolves.toMatchObject({ provider: "ak_nexus" });
    expect(akNexus.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("leaves OTP routing untouched: Meta first without a transactional check", async () => {
    const metaCloud = metaCloudStub({
      supports: jest.fn().mockReturnValue(true),
    });
    const otp: WhatsAppProviderRequest = {
      to: "+919876543210",
      messageType: "auth_otp",
      message: "Your code is 123456",
      idempotencyKey: "auth-otp:1",
      templateVariables: { otp: "123456" },
    };

    await expect(
      router(metaCloud, msg91Stub(), akNexusStub()).sendMessage(otp),
    ).resolves.toMatchObject({ provider: "meta_cloud" });
    expect(metaCloud.supportsTransactional).not.toHaveBeenCalled();
  });
});
