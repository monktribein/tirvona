import { PartnerApiKeyGuard } from "./partner-api-key.guard";
import { UnauthorizedException } from "@nestjs/common";
import { PartnerCryptoService } from "../application/partner-crypto.service";

describe("PartnerApiKeyGuard", () => {
  let guard: PartnerApiKeyGuard;
  let partnerModel: any;
  let apiKeyModel: any;
  let cryptoService: PartnerCryptoService;

  beforeEach(() => {
    cryptoService = new PartnerCryptoService({ get: () => "test-secret-key-32-chars-at-least" } as any);
    partnerModel = {
      findById: jest.fn(),
    };
    apiKeyModel = {
      findOne: jest.fn(),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn() }),
    };
    guard = new PartnerApiKeyGuard(partnerModel, apiKeyModel, cryptoService);
  });

  it("throws UnauthorizedException when no API key header is provided", async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException for invalid prefix", async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { "x-api-key": "invalid_prefix_12345" } }),
      }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("authenticates valid active API key and attaches partner context", async () => {
    const rawKey = "tv_test_abcdef1234567890abcdef1234567890";
    const hashed = cryptoService.hashSecret(rawKey);

    const mockPartner = {
      _id: "partner-123",
      name: "Test Partner",
      slug: "test-partner",
      status: "active",
      scopedAshramIds: ["ashram-1"],
    };

    const mockKey = {
      _id: "key-123",
      partnerId: "partner-123",
      secretHash: hashed,
      keyPrefix: "tv_test_abcdef",
      environment: "sandbox",
      permissions: ["bookings.read"],
      status: "active",
      expiresAt: null,
    };

    apiKeyModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockKey),
    });

    partnerModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockPartner),
    });

    const requestObj: any = { headers: { "x-api-key": rawKey } };
    const context = {
      switchToHttp: () => ({
        getRequest: () => requestObj,
      }),
    } as any;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(requestObj.partner).toBeDefined();
    expect(requestObj.partner.partnerId).toBe("partner-123");
    expect(requestObj.partner.permissions).toContain("bookings.read");
  });

  it("rejects revoked API key", async () => {
    const rawKey = "tv_test_abcdef1234567890abcdef1234567890";
    const hashed = cryptoService.hashSecret(rawKey);

    apiKeyModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "key-123",
        secretHash: hashed,
        status: "revoked",
      }),
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { "x-api-key": rawKey } }),
      }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow("API key has been revoked");
  });
});
