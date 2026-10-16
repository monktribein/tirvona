import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PartnerManagementService } from "./partner-management.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";

describe("PartnerManagementService", () => {
  let service: PartnerManagementService;
  let mockPartnerModel: any;
  let mockApiKeyModel: any;
  let mockWebhookModel: any;
  let mockDeliveryLogModel: any;
  let mockCryptoService: any;
  let mockDispatcher: any;

  const mockAdminUser: AuthenticatedUser = {
    id: "admin-1",
    email: "superadmin@tirvona.com",
    role: "super_admin",
  } as any;

  beforeEach(() => {
    mockPartnerModel = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn() }) }),
      findById: jest.fn(),
      create: jest.fn(),
    };

    mockApiKeyModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn() }) }),
      findById: jest.fn(),
    };

    mockWebhookModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn() }) }),
      findById: jest.fn(),
      deleteOne: jest.fn(),
    };

    mockDeliveryLogModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ lean: jest.fn() }),
        }),
      }),
      findById: jest.fn(),
      findOne: jest.fn(),
    };

    mockCryptoService = {
      generateRandomString: jest.fn().mockReturnValue("1234567890abcdef12345678"),
      hashSecret: jest.fn().mockReturnValue("hash_sha256_mocked"),
      encryptSecret: jest.fn().mockReturnValue({
        ciphertext: "encrypted_cipher",
        iv: "iv_hex",
        tag: "tag_hex",
        last4: "5678",
      }),
    };

    mockDispatcher = {
      publishEvent: jest.fn(),
      retryEvent: jest.fn(),
    };

    service = new PartnerManagementService(
      mockPartnerModel,
      mockApiKeyModel,
      mockWebhookModel,
      mockDeliveryLogModel,
      mockCryptoService,
      mockDispatcher,
    );
  });

  describe("createPartner", () => {
    it("creates a partner when slug is unique", async () => {
      mockPartnerModel.findOne.mockResolvedValue(null);
      mockPartnerModel.create.mockResolvedValue({
        _id: "partner-1",
        name: "Cleartrip",
        slug: "cleartrip",
        environment: "sandbox",
      });

      const partner = await service.createPartner(mockAdminUser, {
        name: "Cleartrip",
        slug: "Cleartrip",
        contactEmail: "api@cleartrip.com",
        environment: "sandbox",
        allowedPermissions: ["bookings.read"],
      });

      expect(mockPartnerModel.findOne).toHaveBeenCalledWith({ slug: "cleartrip" });
      expect(mockPartnerModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Cleartrip",
          slug: "cleartrip",
          createdBy: "admin-1",
        }),
      );
      expect(partner.slug).toBe("cleartrip");
    });

    it("throws ConflictException if partner slug already exists", async () => {
      mockPartnerModel.findOne.mockResolvedValue({ _id: "existing" });

      await expect(
        service.createPartner(mockAdminUser, {
          name: "Cleartrip",
          slug: "cleartrip",
          contactEmail: "api@cleartrip.com",
          environment: "sandbox",
          allowedPermissions: ["bookings.read"],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("createApiKey", () => {
    it("enforces that requested permissions must be within partner's allowedPermissions", async () => {
      mockPartnerModel.findById.mockResolvedValue({
        _id: "partner-1",
        allowedPermissions: ["bookings.read"],
      });

      await expect(
        service.createApiKey(mockAdminUser, "partner-1", {
          name: "Sync Key",
          environment: "sandbox",
          permissions: ["bookings.read", "payments.read"], // payments.read not granted
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("generates key with prefix and stores only the SHA-256 hash, returning raw secret once", async () => {
      mockPartnerModel.findById.mockResolvedValue({
        _id: "partner-1",
        allowedPermissions: ["bookings.read", "inventory.read"],
      });

      mockApiKeyModel.create.mockResolvedValue({
        _id: "key-1",
        partnerId: "partner-1",
        name: "Sync Key",
        keyPrefix: "tv_test_123456",
        status: "active",
      });

      const res = await service.createApiKey(mockAdminUser, "partner-1", {
        name: "Sync Key",
        environment: "sandbox",
        permissions: ["bookings.read"],
      });

      expect(res.rawSecret).toBe("tv_test_1234567890abcdef12345678");
      expect(mockApiKeyModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          keyPrefix: "tv_test_123456",
          secretHash: "hash_sha256_mocked",
          status: "active",
        }),
      );
    });
  });

  describe("retryDelivery", () => {
    it("successfully retries a webhook delivery given a delivery log ID", async () => {
      mockDeliveryLogModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439011",
          eventId: "evt-uuid-1234",
          status: "failed",
        }),
      });
      mockDispatcher.retryEvent.mockResolvedValue(true);

      const result = await service.retryDelivery("507f1f77bcf86cd799439011");

      expect(mockDispatcher.retryEvent).toHaveBeenCalledWith("evt-uuid-1234");
      expect(result).toEqual({ success: true, eventId: "evt-uuid-1234" });
    });

    it("successfully retries when eventId is passed directly", async () => {
      mockDeliveryLogModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          eventId: "evt-uuid-9999",
        }),
      });
      mockDispatcher.retryEvent.mockResolvedValue(true);

      const result = await service.retryDelivery("evt-uuid-9999");

      expect(mockDispatcher.retryEvent).toHaveBeenCalledWith("evt-uuid-9999");
      expect(result).toEqual({ success: true, eventId: "evt-uuid-9999" });
    });

    it("throws NotFoundException if event cannot be retried by dispatcher", async () => {
      mockDeliveryLogModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      mockDispatcher.retryEvent.mockResolvedValue(false);

      await expect(
        service.retryDelivery("unknown-id"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
