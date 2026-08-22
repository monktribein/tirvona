import { ServiceUnavailableException } from "@nestjs/common";
import { AuthController } from "./auth.controller";

describe("AuthController phone OTP delivery response", () => {
  it("returns OTP sent only after Auth confirms delivery", async () => {
    const auth = {
      sendPhoneOtp: jest.fn().mockResolvedValue({ otpToken: "token" }),
    };
    const controller = new AuthController(auth as never, {} as never);

    await expect(
      controller.sendPhone(
        { phone: "919936968762" },
        { id: "request-123" } as never,
      ),
    ).resolves.toEqual({
      success: true,
      message: "OTP sent.",
      data: { otpToken: "token" },
    });
    expect(auth.sendPhoneOtp).toHaveBeenCalledWith(
      "919936968762",
      "request-123",
    );
  });

  it("propagates delivery failure instead of returning a false success", async () => {
    const auth = {
      sendPhoneOtp: jest.fn().mockRejectedValue(
        new ServiceUnavailableException({
          message: "WhatsApp OTP delivery was not accepted. Please try again.",
          code: "WHATSAPP_OTP_DELIVERY_FAILED",
        }),
      ),
    };
    const controller = new AuthController(auth as never, {} as never);

    await expect(
      controller.sendPhone(
        { phone: "9936968762" },
        { id: "request-456" } as never,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
});
