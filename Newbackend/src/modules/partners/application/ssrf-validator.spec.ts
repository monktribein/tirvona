import { isPrivateIp, validateWebhookUrl } from "../application/ssrf-validator.util";
import { BadRequestException } from "@nestjs/common";

describe("Webhook SSRF Protection", () => {
  it("detects IPv4 private and loopback addresses", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.1.25")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.254")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("104.21.5.12")).toBe(false);
  });

  it("detects IPv6 private addresses", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
  });

  it("rejects local domains like localhost or internal", async () => {
    await expect(validateWebhookUrl("http://localhost:3000/callback", false)).rejects.toThrow(
      BadRequestException,
    );
    await expect(validateWebhookUrl("https://my-service.internal/webhook", false)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("requires HTTPS in production mode", async () => {
    await expect(
      validateWebhookUrl("http://api.partner.com/webhook", true),
    ).rejects.toThrow(BadRequestException);
  });
});
