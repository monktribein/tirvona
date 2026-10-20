import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PartnerAdminController } from "./partner-admin.controller";
import { PartnerV1Controller } from "./partner-v1.controller";
import { PartnerManagementService } from "../application/partner-management.service";
import { PartnerApiService } from "../application/partner-api.service";
import { PartnerApiKeyGuard } from "../guards/partner-api-key.guard";
import { PartnerPermissionsGuard } from "../guards/partner-permissions.guard";

/**
 * Route-level contract for the Developer API. These guard against two real regressions:
 *  - `GET /partners/webhooks` and `/partners/deliveries` being swallowed by `GET /partners/:id`
 *  - the partner API being mounted at `/api/v1/v1/...` instead of `/api/v1/...`
 */
describe("Partner routes", () => {
  let app: INestApplication;
  const management = {
    listPartners: jest.fn().mockResolvedValue([]),
    getPartner: jest.fn().mockResolvedValue({ _id: "p1" }),
    listWebhooks: jest.fn().mockResolvedValue([{ _id: "w1" }]),
    listDeliveryLogs: jest.fn().mockResolvedValue([{ _id: "d1" }]),
    listApiKeys: jest.fn().mockResolvedValue([]),
    sendTestWebhook: jest.fn().mockResolvedValue({ eventId: "e1" }),
  };
  const partnerApi = {
    listBookings: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    getPaymentStatus: jest.fn().mockResolvedValue({ status: "success" }),
  };
  const allowAll = { canActivate: () => true };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PartnerAdminController, PartnerV1Controller],
      providers: [
        { provide: PartnerManagementService, useValue: management },
        { provide: PartnerApiService, useValue: partnerApi },
      ],
    })
      .overrideGuard(PartnerApiKeyGuard)
      .useValue(allowAll)
      .overrideGuard(PartnerPermissionsGuard)
      .useValue(allowAll)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/partners/webhooks lists webhooks (not a partner lookup)", async () => {
    const res = await request(app.getHttpServer()).get("/api/partners/webhooks?partnerId=abc").expect(200);
    expect(res.body.data).toEqual([{ _id: "w1" }]);
    expect(management.listWebhooks).toHaveBeenCalledWith("abc");
    expect(management.getPartner).not.toHaveBeenCalled();
  });

  it("GET /api/partners/deliveries lists delivery logs (not a partner lookup)", async () => {
    const res = await request(app.getHttpServer()).get("/api/partners/deliveries?partnerId=abc").expect(200);
    expect(res.body.data).toEqual([{ _id: "d1" }]);
    expect(management.getPartner).not.toHaveBeenCalled();
  });

  it("GET /api/partners/:id still resolves a partner", async () => {
    await request(app.getHttpServer()).get("/api/partners/6ad1fa0afba17709320043f0").expect(200);
    expect(management.getPartner).toHaveBeenCalledWith("6ad1fa0afba17709320043f0");
  });

  it("GET /api/partners/:id/keys lists keys", async () => {
    await request(app.getHttpServer()).get("/api/partners/6ad1fa0afba17709320043f0/keys").expect(200);
    expect(management.listApiKeys).toHaveBeenCalledWith("6ad1fa0afba17709320043f0");
  });

  it("POST /api/partners/webhooks/:id/test sends a test event", async () => {
    const res = await request(app.getHttpServer()).post("/api/partners/webhooks/w1/test").expect(201);
    expect(res.body.data).toEqual({ eventId: "e1" });
  });

  it("serves the partner API at /api/v1/bookings (single v1 segment)", async () => {
    await request(app.getHttpServer()).get("/api/v1/bookings").expect(200);
    await request(app.getHttpServer()).get("/api/v1/v1/bookings").expect(404);
  });

  it("serves payment status at /api/v1/payments/:id/status", async () => {
    await request(app.getHttpServer()).get("/api/v1/payments/TRV-1/status").expect(200);
    expect(partnerApi.getPaymentStatus).toHaveBeenCalled();
  });
});
