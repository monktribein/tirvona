/// <reference types="jest" />
/**
 * End-to-end tests of the providers API: real controllers, guards, validation,
 * error envelope, idempotency, services, transactions and the Postgres storage
 * driver against a real Postgres 17. Run with `npm run test:pg`.
 */
import { ConfigService } from "@nestjs/config";
import type { INestApplication } from "@nestjs/common";
import { createHmac } from "node:crypto";
import Razorpay from "razorpay";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import request from "supertest";
import { WalletService } from "../wallet/application/wallet.service";
import { ProviderBookingPaymentService } from "./application/provider-booking-payment.service";
import { ProviderBookingService } from "./application/provider-booking.service";
import { ProviderConsultationService } from "./application/provider-consultation.service";
import { ProviderMaintenanceService } from "./application/provider-maintenance.service";
import { ProviderIntegrityService } from "./application/provider-integrity.service";
import { ProviderWalletService } from "./application/provider-wallet.service";
import { providerRoutes } from "./testing/route-table";
import {
  as,
  createProviderTestApp,
  idemKey,
  newUser,
  type ProviderTestApp,
  type TestUser,
} from "./testing/provider-test-app";

// The payment gateway is replaced by a recorder; the wallet, bookings and database are real.
jest.mock("razorpay", () => {
  const create = jest.fn();
  const refund = jest.fn();
  const Gateway: any = function Gateway() {
    return { orders: { create }, payments: { refund } };
  };
  Gateway.__mocks = { create, refund };
  return Gateway;
});

const V2 = "/api/v2";
const SHA = "a".repeat(64);

describe("Providers API (real Postgres)", () => {
  let ctx: ProviderTestApp;
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  // Actors
  const editor = newUser("content_manager", "Editor One");
  const approver = newUser("content_manager", "Approver Two");
  const reviewer = newUser("verification_reviewer", "Reviewer");
  const ops = newUser("service_manager", "Ops");
  const root = newUser("super_admin", "Root");
  const panditUser = newUser("customer", "Ramesh Sharma");
  const jyotishUser = newUser("customer", "Vidyadhar Sharma");

  let ritualId: string;
  let variantId: string;
  let panditId: string;
  let offeringId: string;

  // ---------------------------------------------------------------- helpers
  const post = (path: string, user: TestUser, body: object = {}, key: string | null = idemKey()) => {
    let req = http().post(`${V2}${path}`).set(as(user));
    if (key) req = req.set("Idempotency-Key", key);
    return req.send(body);
  };
  const patch = (path: string, user: TestUser, body: object) =>
    http().patch(`${V2}${path}`).set(as(user)).set("Idempotency-Key", idemKey()).send(body);
  const put = (path: string, user: TestUser, body: object) =>
    http().put(`${V2}${path}`).set(as(user)).set("Idempotency-Key", idemKey()).send(body);
  const get = (path: string, user?: TestUser) => {
    const req = http().get(`${V2}${path}`);
    return user ? req.set(as(user)) : req;
  };

  /** A start time N days ahead at 10:00 IST (04:30Z), expressed with an explicit offset. */
  const slot = (daysAhead: number, hourIst = 10) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + daysAhead);
    d.setUTCHours(hourIst - 6, 30, 0, 0); // IST = UTC+5:30
    return d.toISOString();
  };
  const istDate = (daysAhead: number) => {
    const d = new Date(Date.now() + daysAhead * 86_400_000 + 5.5 * 3_600_000);
    return d.toISOString().slice(0, 10);
  };

  const savedGateway = { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET, payoutKey: process.env.PAYOUT_ENCRYPTION_KEY };
  beforeAll(async () => {
    // Fake test-mode keys: nothing real is ever read from the workspace .env in these tests.
    process.env.RAZORPAY_KEY_ID = "rzp_test_qa_key";
    process.env.RAZORPAY_KEY_SECRET = "qa_test_secret_value";
    // Throwaway key for sealing pandit payout account numbers.
    process.env.PAYOUT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    ctx = await createProviderTestApp();
    app = ctx.app;
  });
  afterAll(async () => {
    for (const [k, v] of [["RAZORPAY_KEY_ID", savedGateway.id], ["RAZORPAY_KEY_SECRET", savedGateway.secret], ["PAYOUT_ENCRYPTION_KEY", savedGateway.payoutKey]] as const)
    {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await ctx?.close();
  });

  // ============================================================== catalogue
  describe("ritual catalogue", () => {
    it("runs draft -> review -> approve -> publish with maker-checker and a hidden draft", async () => {
      const created = await post("/admin/rituals", editor, {
        titles: { en: "Rudrabhishek", hi: "रुद्राभिषेक" },
        summary: { en: "Abhishek of Lord Shiva with Sri Rudram." },
        category: "Shiva",
        applicableFulfilmentTypes: ["LOCAL_HOME", "AT_DESTINATION", "ON_BEHALF"],
        defaultDurationMinutes: 90,
      }).expect(201);
      ritualId = created.body.data.id;
      expect(created.body.data).toMatchObject({ slug: "rudrabhishek", status: "DRAFT", isListed: false });

      // A draft is invisible to the public.
      await get(`/rituals/${created.body.data.slug}`).expect(404);

      await post(`/admin/rituals/${ritualId}:submit-review`, editor).expect(201);
      // The author cannot approve their own work.
      const selfApproval = await post(`/admin/rituals/${ritualId}:approve`, editor).expect(403);
      expect(selfApproval.body.code).toBe("MAKER_CHECKER_VIOLATION");
      await post(`/admin/rituals/${ritualId}:approve`, approver).expect(201);
      await post(`/admin/rituals/${ritualId}:publish`, approver).expect(201);

      const page = await get("/rituals").expect(200);
      expect(page.body.data.map((r: any) => r.slug)).toContain("rudrabhishek");
      const one = await get("/rituals/rudrabhishek").expect(200);
      expect(one.body.data).toMatchObject({ contentVersion: 1, defaultDurationMinutes: 90 });
    });

    it("keeps the published page live while the next version is drafted", async () => {
      await post(`/admin/rituals/${ritualId}:revise`, editor, { note: "wording" }).expect(201);
      await patch(`/admin/rituals/${ritualId}`, editor, {
        titles: { en: "Rudrabhishek Puja" },
      }).expect(200);
      const live = await get("/rituals/rudrabhishek").expect(200);
      expect(live.body.data.titles.en).toBe("Rudrabhishek"); // not the draft
      // Back through the workflow to publish v2.
      await post(`/admin/rituals/${ritualId}:submit-review`, editor).expect(201);
      await post(`/admin/rituals/${ritualId}:approve`, approver).expect(201);
      await post(`/admin/rituals/${ritualId}:publish`, approver).expect(201);
      const v2 = await get("/rituals/rudrabhishek").expect(200);
      expect(v2.body.data).toMatchObject({ contentVersion: 2 });
      expect(v2.body.data.titles.en).toBe("Rudrabhishek Puja");
    });

    it("validates variants and refuses unknown scope fields", async () => {
      await post(`/admin/rituals/${ritualId}/variants`, editor, {
        code: "standard",
        titles: { en: "Standard" },
        scope: { inclusions: ["Sankalp"], secretField: 1 },
      }).expect(400);
      const ok = await post(`/admin/rituals/${ritualId}/variants`, editor, {
        code: "standard",
        titles: { en: "Standard" },
        scope: { inclusions: ["Sankalp"], durationBand: { minMinutes: 60, maxMinutes: 120 }, teamSize: { min: 1, max: 2 } },
      }).expect(201);
      variantId = ok.body.data.id;
      const variants = await get("/rituals/rudrabhishek/variants").expect(200);
      expect(variants.body.data).toHaveLength(1);
    });

    it("keeps catalogue administration to content roles", async () => {
      await post("/admin/rituals", panditUser, {
        titles: { en: "X" },
        summary: { en: "Y" },
        applicableFulfilmentTypes: ["LOCAL_HOME"],
      }).expect(403);
      await get("/admin/rituals", reviewer).expect(403);
    });
  });

  // ================================================== idempotency + profile
  describe("provider onboarding", () => {
    it("requires the Idempotency-Key header on writes", async () => {
      const res = await post("/provider/profile", panditUser, { displayName: "Pt Ramesh Sharma" }, null).expect(400);
      expect(res.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
      const short = await post("/provider/profile", panditUser, { displayName: "Pt Ramesh Sharma" }, "short").expect(400);
      expect(short.body.code).toBe("IDEMPOTENCY_KEY_INVALID");
    });

    it("rejects unknown fields and client-supplied identity", async () => {
      const res = await post("/provider/profile", panditUser, {
        displayName: "Pt Ramesh Sharma",
        userId: newUser().id,
        status: "ACTIVE",
        verificationLevel: "TIRVONA_TRUSTED",
      }).expect(400);
      expect(res.body.success).toBe(false);
    });

    it("creates one profile per user, replays an identical request, and refuses key reuse", async () => {
      const key = idemKey();
      const body = {
        providerType: "PANDIT",
        displayName: "Pt Ramesh Sharma",
        bio: "Thirty years of Vedic ritual practice in Haridwar and Varanasi.",
        languages: ["Hindi", "Sanskrit"],
        specializations: ["Rudrabhishek", "Griha Pravesh"],
        homeCity: "Haridwar",
        homeState: "Uttarakhand",
        serviceAreas: [{ city: "Haridwar", state: "Uttarakhand" }, { city: "Rishikesh" }],
        experienceYears: 30,
        contactEmail: "ramesh@example.test",
        contactPhone: "9876543210",
        travelProfile: { willingToTravel: true, overnightOk: true, modes: ["TRAIN"] },
      };
      const first = await post("/provider/profile", panditUser, body, key).expect(201);
      panditId = first.body.data.id;
      expect(first.body.data).toMatchObject({
        status: "ONBOARDING",
        verificationLevel: "UNVERIFIED",
        slug: "pt-ramesh-sharma",
        legalName: panditUser.name,
      });
      expect(first.body.data.listing.isPubliclyListed).toBe(false);

      const replay = await post("/provider/profile", panditUser, body, key).expect(201);
      expect(replay.headers["idempotent-replay"]).toBe("true");
      expect(replay.body.data.id).toBe(panditId);

      const reused = await post("/provider/profile", panditUser, { ...body, displayName: "Someone Else" }, key).expect(409);
      expect(reused.body.code).toBe("IDEMPOTENCY_KEY_REUSED");

      const second = await post("/provider/profile", panditUser, body).expect(409);
      expect(second.body.code).toBe("PROVIDER_PROFILE_EXISTS");
    });

    it("shows the owner their own record and nobody else's", async () => {
      const own = await get("/provider/profile", panditUser).expect(200);
      expect(own.body.data.contactEmail).toBe("ramesh@example.test");
      await get("/provider/profile", newUser()).expect(404);
      await get("/provider/profile").expect(401);
    });

    it("keeps an unverified provider out of the public directory", async () => {
      await get(`/providers/${panditId}`).expect(404);
      const list = await get("/providers").expect(200);
      expect(list.body.data).toHaveLength(0);
      // Cannot go live without a verified identity.
      const live = await patch("/provider/profile/status", panditUser, { status: "ACTIVE" }).expect(409);
      expect(live.body.code).toBe("IDENTITY_VERIFICATION_REQUIRED");
    });
  });

  // ============================================================ verification
  describe("verification workflow", () => {
    let caseId: string;

    it("lets a provider open a case only for themselves", async () => {
      const foreign = await post("/verification-cases", panditUser, {
        verificationType: "IDENTITY",
        providerId: newUser().id,
      }).expect(403);
      expect(foreign.body.code).toBe("PROVIDER_MISMATCH");
      await post("/verification-cases", panditUser, { verificationType: "TRUST_REVIEW" }).expect(403);
      await post("/verification-cases", panditUser, { verificationType: "PROFESSIONAL" }).expect(409); // identity first

      const opened = await post("/verification-cases", panditUser, { verificationType: "IDENTITY" }).expect(201);
      caseId = opened.body.data.id;
      expect(opened.body.data).toMatchObject({ status: "OPEN", submitted: false, attempt: 1 });
      const duplicate = await post("/verification-cases", panditUser, { verificationType: "IDENTITY" }).expect(409);
      expect(duplicate.body.code).toBe("VERIFICATION_CASE_ALREADY_OPEN");
    });

    it("refuses to submit without the required document and refuses arbitrary links as evidence", async () => {
      const empty = await post(`/verification-cases/${caseId}:submit`, panditUser).expect(422);
      expect(empty.body.code).toBe("EVIDENCE_REQUIRED");
      const bad = await post(`/verification-cases/${caseId}/evidence`, panditUser, {
        evidenceType: "KYC_ID",
        storageKey: "https://evil.example.com/aadhaar.pdf",
        sha256: SHA,
      }).expect(400);
      expect(bad.body.code).toBe("EVIDENCE_REFERENCE_INVALID");
      await post(`/verification-cases/${caseId}/evidence`, panditUser, {
        evidenceType: "KYC_ID",
        storageKey: "tirvona/verification/kyc-1",
        sha256: "not-a-hash",
      }).expect(400);
    });

    it("stores evidence metadata, never exposes the storage key to the provider", async () => {
      const added = await post(`/verification-cases/${caseId}/evidence`, panditUser, {
        evidenceType: "KYC_ID",
        storageKey: "tirvona/verification/kyc-1",
        sha256: SHA,
        mimeType: "application/pdf",
        sizeBytes: 12345,
        label: "ID card",
      }).expect(201);
      expect(added.body.data).toMatchObject({ evidenceType: "KYC_ID", malwareScanStatus: "PENDING" });
      expect(JSON.stringify(added.body)).not.toContain("kyc-1");

      const dup = await post(`/verification-cases/${caseId}/evidence`, panditUser, {
        evidenceType: "KYC_ID",
        storageKey: "tirvona/verification/kyc-2",
        sha256: SHA,
      }).expect(409);
      expect(dup.body.code).toBe("EVIDENCE_DUPLICATE");

      const owner = await get(`/verification-cases/${caseId}`, panditUser).expect(200);
      expect(JSON.stringify(owner.body)).not.toContain("kyc-1");
      expect(JSON.stringify(owner.body)).not.toContain(SHA);
    });

    it("hides the case from strangers and from the queue until it is submitted", async () => {
      await get(`/verification-cases/${caseId}`, newUser()).expect(404);
      const queueBefore = await get("/verification-cases", reviewer).expect(200);
      expect(queueBefore.body.data).toHaveLength(0);
      await post(`/verification-cases/${caseId}:submit`, panditUser).expect(201);
      const queue = await get("/verification-cases", reviewer).expect(200);
      expect(queue.body.data.map((c: any) => c.id)).toContain(caseId);
      // Evidence is locked once submitted.
      await post(`/verification-cases/${caseId}/evidence`, panditUser, {
        evidenceType: "KYC_ID",
        storageKey: "tirvona/verification/kyc-3",
        sha256: "b".repeat(64),
      }).expect(409);
    });

    it("enforces reviewer-only access, conflict of interest and assignment", async () => {
      await post(`/verification-cases/${caseId}:claim`, panditUser).expect(403); // role
      // A reviewer who owns the provider account cannot review it.
      const selfReviewer = { ...panditUser, role: "verification_reviewer" };
      const coi = await post(`/verification-cases/${caseId}:claim`, selfReviewer).expect(403);
      expect(coi.body.code).toBe("CONFLICT_OF_INTEREST");

      const claimed = await post(`/verification-cases/${caseId}:claim`, reviewer).expect(201);
      expect(claimed.body.data.status).toBe("IN_REVIEW");
      // Reviewers (and only they) see the storage reference and the hash.
      expect(claimed.body.data.evidence[0].objectStorageKey).toBe("tirvona/verification/kyc-1");
      const again = await post(`/verification-cases/${caseId}:claim`, newUser("verification_reviewer")).expect(409);
      expect(again.body.code).toBe("VERIFICATION_NOT_CLAIMABLE");

      const other = newUser("verification_reviewer");
      const notMine = await post(`/verification-cases/${caseId}:decide`, other, { decision: "APPROVE", reasonCode: "VERIFIED" }).expect(403);
      expect(notMine.body.code).toBe("VERIFICATION_NOT_ASSIGNED");
    });

    it("validates reason codes, then approves and lifts the provider to IDENTITY_VERIFIED", async () => {
      const wrong = await post(`/verification-cases/${caseId}:decide`, reviewer, { decision: "APPROVE", reasonCode: "ILLEGIBLE_EVIDENCE" }).expect(400);
      expect(wrong.body.code).toBe("REASON_CODE_INVALID");
      await post(`/verification-cases/${caseId}:decide`, reviewer, { decision: "REJECT", reasonCode: "MAYBE" }).expect(400);

      const approved = await post(`/verification-cases/${caseId}:decide`, reviewer, {
        decision: "APPROVE",
        reasonCode: "VERIFIED",
        internalNote: "Checked against the original.",
      }).expect(201);
      expect(approved.body.data.status).toBe("APPROVED");
      expect(approved.body.data.internalNote).toBe("Checked against the original.");

      const mine = await get("/provider/profile", panditUser).expect(200);
      expect(mine.body.data.verificationLevel).toBe("IDENTITY_VERIFIED");
      // The provider never sees the reviewer's note.
      const owner = await get(`/verification-cases/${caseId}`, panditUser).expect(200);
      expect(owner.body.data.internalNote).toBeUndefined();
      expect(ctx.notifications.some((n) => n.kind === "provider.verification.approved")).toBe(true);

      const decided = await post(`/verification-cases/${caseId}:decide`, reviewer, { decision: "APPROVE", reasonCode: "VERIFIED" }).expect(409);
      expect(decided.body.code).toBe("VERIFICATION_NOT_IN_REVIEW");
    });

    it("lets a rejected provider resubmit only when the reason allows it", async () => {
      const u = newUser("customer", "Second Provider");
      await post("/provider/profile", u, { displayName: "Second Provider" }).expect(201);
      const c1 = (await post("/verification-cases", u, {}).expect(201)).body.data.id;
      await post(`/verification-cases/${c1}/evidence`, u, { evidenceType: "KYC_ID", storageKey: "tirvona/v/second-1", sha256: "c".repeat(64) }).expect(201);
      await post(`/verification-cases/${c1}:submit`, u).expect(201);
      await post(`/verification-cases/${c1}:claim`, reviewer).expect(201);
      await post(`/verification-cases/${c1}:decide`, reviewer, { decision: "REJECT", reasonCode: "ILLEGIBLE_EVIDENCE", providerMessage: "Photo is blurry" }).expect(201);

      const resub = await post(`/verification-cases/${c1}:resubmit`, u).expect(201);
      expect(resub.body.data).toMatchObject({ status: "OPEN", attempt: 2, previousCaseId: c1, evidenceCount: 1 });
      // Fraud is final.
      const c2 = resub.body.data.id;
      await post(`/verification-cases/${c2}:submit`, u).expect(201);
      await post(`/verification-cases/${c2}:claim`, reviewer).expect(201);
      await post(`/verification-cases/${c2}:decide`, reviewer, { decision: "REJECT", reasonCode: "FRAUD_SUSPECTED" }).expect(201);
      const final = await post(`/verification-cases/${c2}:resubmit`, u).expect(409);
      expect(final.body.code).toBe("VERIFICATION_NOT_RESUBMITTABLE");
      await post("/verification-cases", u, {}).expect(409);
    });
  });

  // ============================================ offerings + availability + go-live
  describe("offerings, availability and the public directory", () => {
    const FORBIDDEN_PUBLIC_KEYS = [
      "userId", "legalName", "contactEmail", "contactPhone", "mobile", "email", "address", "kycRefs",
      "calendarSeq", "caseId", "verification", "isDevFixture", "statusReason", "deletedAt", "internalNote",
      "objectStorageKey", "sha256", "customerContact", "paymentRefs",
    ];
    const keysOf = (value: unknown, out = new Set<string>()): Set<string> => {
      if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
      else if (value && typeof value === "object")
        for (const [k, v] of Object.entries(value)) {
          out.add(k);
          keysOf(v, out);
        }
      return out;
    };
    const expectNoPrivateKeys = (body: unknown) => {
      const found = [...keysOf(body)].filter((k) => FORBIDDEN_PUBLIC_KEYS.includes(k));
      expect(found).toEqual([]);
    };

    it("refuses offerings the catalogue does not allow", async () => {
      const base = { ritualVariantId: variantId, fulfilmentType: "LOCAL_HOME", durationMinutes: 90, baseProfessionalFeeMinor: 250000 };
      const notApplicable = await post("/provider/offerings", panditUser, { ...base, fulfilmentType: "CORPORATE" }).expect(422);
      expect(notApplicable.body.code).toBe("FULFILMENT_NOT_APPLICABLE");
      await post("/provider/offerings", panditUser, { ...base, fulfilmentType: "INSTITUTION_AUTHORIZED" }).expect(400);
      const unknown = await post("/provider/offerings", panditUser, { ...base, ritualVariantId: newUser().id }).expect(422);
      expect(unknown.body.code).toBe("VARIANT_NOT_AVAILABLE");
      const noDestination = await post("/provider/offerings", panditUser, { ...base, fulfilmentType: "AT_DESTINATION" }).expect(422);
      expect(noDestination.body.code).toBe("DESTINATION_REQUIRED");
      const noAmount = await post("/provider/offerings", panditUser, { ...base, travelCharge: { policy: "FLAT" } }).expect(422);
      expect(noAmount.body.code).toBe("TRAVEL_CHARGE_AMOUNT_REQUIRED");
      await post("/provider/offerings", panditUser, { ...base, baseProfessionalFeeMinor: -1 }).expect(400);
      await post("/provider/offerings", panditUser, { ...base, baseProfessionalFeeMinor: 12.5 }).expect(400);
      await post("/provider/offerings", panditUser, { ...base, currency: "JPY" }).expect(400);
    });

    it("creates a priced offering with inclusions, exclusions and a travel charge", async () => {
      const created = await post("/provider/offerings", panditUser, {
        ritualVariantId: variantId,
        fulfilmentType: "LOCAL_HOME",
        title: "Rudrabhishek at your home",
        durationMinutes: 90,
        teamSize: 2,
        baseProfessionalFeeMinor: 250000,
        currency: "INR",
        travelCharge: { policy: "FLAT", flatMinor: 50000, notes: "Within Haridwar" },
        inclusions: ["Sankalp", "Panchamrit abhishek"],
        exclusions: ["Samagri"],
        voluntaryDakshinaAllowed: true,
      }).expect(201);
      offeringId = created.body.data.id;
      expect(created.body.data).toMatchObject({
        status: "ACTIVE",
        indicativeFee: { amountMinor: 250000, currency: "INR" },
        travelCharge: { policy: "FLAT", flatMinor: 50000 },
        ritual: { slug: "rudrabhishek" },
      });
      const dup = await post("/provider/offerings", panditUser, {
        ritualVariantId: variantId, fulfilmentType: "LOCAL_HOME", durationMinutes: 60, baseProfessionalFeeMinor: 100,
      }).expect(409);
      expect(dup.body.code).toBe("OFFERING_ALREADY_EXISTS");
    });

    it("scopes offerings to their owner", async () => {
      const stranger = newUser();
      await post("/provider/profile", stranger, { displayName: "Intruder Pandit" }).expect(201);
      await patch(`/provider/offerings/${offeringId}`, stranger, { baseProfessionalFeeMinor: 1 }).expect(404);
      await get(`/provider/offerings/${offeringId}`, stranger).expect(404);
      const mine = await get("/provider/offerings", panditUser).expect(200);
      expect(mine.body.data).toHaveLength(1);
    });

    it("keeps Jyotish providers out of ritual offerings", async () => {
      await post("/provider/profile", jyotishUser, { providerType: "JYOTISHI", displayName: "Jyotishi Vidyadhar", languages: ["Hindi"] }).expect(201);
      const res = await post("/provider/offerings", jyotishUser, {
        ritualVariantId: variantId, fulfilmentType: "LOCAL_HOME", durationMinutes: 60, baseProfessionalFeeMinor: 1000,
      }).expect(422);
      expect(res.body.code).toBe("PROVIDER_TYPE_CANNOT_OFFER_RITUALS");
    });

    it("validates the weekly schedule and stores it with its timezone", async () => {
      const overlap = await put("/provider/availability-rules", panditUser, {
        rules: [{ dayOfWeek: "MONDAY", isAvailable: true, slots: [{ startTime: "08:00", endTime: "12:00" }, { startTime: "11:00", endTime: "14:00" }] }],
      }).expect(400);
      expect(overlap.body.code).toBe("AVAILABILITY_OVERLAPPING_SLOTS");
      await put("/provider/availability-rules", panditUser, {
        rules: [{ dayOfWeek: "MONDAY", isAvailable: true, slots: [{ startTime: "12:00", endTime: "08:00" }] }],
      }).expect(400);
      await put("/provider/availability-rules", panditUser, { timezone: "Mars/Olympus", rules: [] }).expect(400);
      await put("/provider/availability-rules", panditUser, {
        rules: [{ dayOfWeek: "MONDAY", isAvailable: true, slots: [{ startTime: "25:00", endTime: "26:00" }] }],
      }).expect(400);

      const week = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((dayOfWeek) => ({
        dayOfWeek, isAvailable: true, slots: [{ startTime: "08:00", endTime: "18:00" }],
      }));
      const saved = await put("/provider/availability-rules", panditUser, { timezone: "Asia/Kolkata", rules: week }).expect(200);
      expect(saved.body.data.timezone).toBe("Asia/Kolkata");
      const read = await get("/provider/availability-rules", panditUser).expect(200);
      expect(read.body.data.rules).toHaveLength(7);
      expect(read.body.data.rules[0]).toMatchObject({ dayOfWeek: "MONDAY", isAvailable: true });
    });

    it("goes live once identity is verified, and only then appears in the directory", async () => {
      const live = await patch("/provider/profile/status", panditUser, { status: "ACTIVE" }).expect(200);
      expect(live.body.data).toMatchObject({ status: "ACTIVE", isActive: true });
      expect(live.body.data.listing).toMatchObject({ isPubliclyListed: true, blockers: [] });
      expect(live.body.data.profileCompletionPercent).toBeGreaterThan(80);
      await get(`/providers/${panditId}`).expect(200);
      await get("/providers/pt-ramesh-sharma").expect(200); // slug works too
    });

    it("exposes only public fields in the directory", async () => {
      const detail = await get(`/providers/${panditId}`).expect(200);
      expectNoPrivateKeys(detail.body);
      expect(detail.body.data).toMatchObject({
        displayName: "Pt Ramesh Sharma",
        verificationLevel: "IDENTITY_VERIFIED",
        acceptingBookings: true,
        offerings: { count: 1, minFeeMinor: 250000 },
      });
      expect(JSON.stringify(detail.body)).not.toContain("ramesh@example.test");
      expect(JSON.stringify(detail.body)).not.toContain("9876543210");
      const search = await get("/providers").expect(200);
      expectNoPrivateKeys(search.body);
      const offers = await get(`/providers/${panditId}/offerings`).expect(200);
      expectNoPrivateKeys(offers.body);
      expect(offers.body.data[0]).toMatchObject({ indicativeFee: { amountMinor: 250000 }, ritual: { slug: "rudrabhishek" } });
    });

    it("searches on the server by ritual, language, location, verification, price and text", async () => {
      const ok = async (query: string) => (await get(`/providers?${query}`).expect(200)).body;
      expect((await ok("ritual=rudrabhishek")).data).toHaveLength(1);
      expect((await ok(`ritual=${ritualId}`)).data).toHaveLength(1);
      expect((await ok("ritual=no-such-ritual")).data).toHaveLength(0);
      expect((await ok("language=Hindi")).data).toHaveLength(1);
      expect((await ok("language=Tamil")).data).toHaveLength(0);
      expect((await ok("city=Haridwar")).data).toHaveLength(1);
      expect((await ok("city=Rishikesh")).data).toHaveLength(1); // service area
      expect((await ok("city=Mumbai")).data).toHaveLength(0);
      expect((await ok("fulfilmentType=LOCAL_HOME")).data).toHaveLength(1);
      expect((await ok("fulfilmentType=ON_BEHALF")).data).toHaveLength(0);
      expect((await ok("minVerification=IDENTITY_VERIFIED")).data).toHaveLength(1);
      expect((await ok("minVerification=PROFESSIONAL_VERIFIED")).data).toHaveLength(0);
      expect((await ok("q=ramesh")).data).toHaveLength(1);
      expect((await ok("q=rudra")).data).toHaveLength(1); // matches the ritual name
      expect((await ok("q=zzz")).data).toHaveLength(0);
      expect((await ok("minFeeMinor=100000&maxFeeMinor=300000")).data).toHaveLength(1);
      expect((await ok("minFeeMinor=900000")).data).toHaveLength(0);
      expect((await ok("sort=price_asc&limit=1")).meta).toMatchObject({ page: 1, limit: 1, total: 1, hasMore: false });
      await get("/providers?minVerification=PLATINUM").expect(400);
      await get("/providers?limit=500").expect(400);
      await get("/providers?sort=whatever").expect(400);
      await get("/providers?providerType=WIZARD").expect(400);
    });

    it("filters by a free window on a date", async () => {
      const date = istDate(8);
      const free = await get(`/providers?date=${date}&durationMinutes=90`).expect(200);
      expect(free.body.data).toHaveLength(1);
      const tooLong = await get(`/providers?date=${date}&durationMinutes=900`).expect(200);
      expect(tooLong.body.data).toHaveLength(0);
      await get("/providers?date=2026-02-30").expect(400);
    });

    it("reports free windows to signed-in callers without revealing who holds the rest", async () => {
      await get(`/providers/${panditId}/availability?from=${istDate(9)}`).expect(401);
      const day = istDate(9);
      const res = await get(`/providers/${panditId}/availability?from=${day}&to=${day}&durationMinutes=60`, newUser()).expect(200);
      expect(res.body.data.timezone).toBe("Asia/Kolkata");
      expect(res.body.data.days[0].windows[0]).toMatchObject({ startTime: "08:00", endTime: "18:00" });
      expectNoPrivateKeys(res.body);
      await get(`/providers/${panditId}/availability?from=${day}&to=${istDate(200)}`, newUser()).expect(400);
    });

    it("blocks dates with a manual block, which removes the windows and can be released", async () => {
      const day = istDate(10);
      const block = await post("/provider/calendar-blocks", panditUser, { startDate: day, endDate: day, reason: "Pilgrimage" }).expect(201);
      expect(block.body.data).toMatchObject({ startDate: day, endDate: day, blockType: "MANUAL", releasable: true });
      const gone = await get(`/providers/${panditId}/availability?from=${day}`, newUser()).expect(200);
      expect(gone.body.data.days[0].windows).toHaveLength(0);
      expect(JSON.stringify(gone.body)).not.toContain("Pilgrimage");
      await post("/provider/calendar-blocks", panditUser, { startDate: day, endAt: "2030-01-01T00:00:00Z" }).expect(400);
      await http().delete(`${V2}/provider/calendar-blocks/${block.body.data.id}`).set(as(newUser())).set("Idempotency-Key", idemKey()).expect(404);
      await http().delete(`${V2}/provider/calendar-blocks/${block.body.data.id}`).set(as(panditUser)).set("Idempotency-Key", idemKey()).expect(200);
      const back = await get(`/providers/${panditId}/availability?from=${day}`, newUser()).expect(200);
      expect(back.body.data.days[0].windows).toHaveLength(1);
    });
  });

  // ================================================================= bookings
  describe("bookings", () => {
    const customer = newUser("customer", "Asha Verma");
    const bookBody = (start = slot(3), extra: object = {}) => ({
      offeringId,
      scheduledStartAt: start,
      customerName: "Asha Verma",
      customerPhone: "9876500001",
      serviceLocation: { line1: "12 Ganga Road", city: "Haridwar", state: "Uttarakhand" },
      notes: "Ground floor, please bring a mat",
      ...extra,
    });
    let bookingId: string;
    const Booking = () => app.get(getModelToken("ProviderBooking"));
    const Block = () => app.get(getModelToken("ProviderCalendarBlock"));

    it("books a slot: server-side price snapshot, calendar hold, PAYMENT_PENDING", async () => {
      const res = await post("/bookings", customer, bookBody()).expect(201);
      bookingId = res.body.data.id;
      expect(res.body.data).toMatchObject({
        status: "PAYMENT_PENDING",
        fulfilmentType: "LOCAL_HOME",
        pricing: { status: "PROVIDER_ESTIMATE", currency: "INR", totalMinor: 300000 },
        provider: { displayName: "Pt Ramesh Sharma" },
      });
      expect(res.body.data.bookingNumber).toMatch(/^PJ-\d{6}-[A-Z0-9]{6}$/);
      expect(res.body.data.holdExpiresAt).toBeTruthy();
      expect(res.body.data.nextActions.map((a: any) => a.command)).toEqual(["cancel"]);
      // The price is the server's, whatever the client sends.
      const forged = await post("/bookings", newUser(), { ...bookBody(slot(5)), totalMinor: 1, pricing: { totalMinor: 1 } }).expect(400);
      expect(forged.body.success).toBe(false);
    });

    it("refuses bookings that break the offering's rules", async () => {
      const soon = await post("/bookings", newUser(), bookBody(slot(0))).expect(422);
      expect(soon.body.code).toBe("BOOKING_TOO_SOON");
      const noPlace = await post("/bookings", newUser(), bookBody(slot(5), { serviceLocation: undefined })).expect(422);
      expect(noPlace.body.code).toBe("SERVICE_LOCATION_REQUIRED");
      const far = await post("/bookings", newUser(), bookBody(slot(5), { serviceLocation: { city: "Mumbai", state: "Maharashtra" } })).expect(422);
      expect(far.body.code).toBe("OUTSIDE_SERVICE_AREA");
      const night = await post("/bookings", newUser(), bookBody(slot(5, 21))).expect(409);
      expect(night.body.code).toBe("PROVIDER_UNAVAILABLE_AT_TIME");
      const own = await post("/bookings", panditUser, bookBody(slot(5))).expect(403);
      expect(own.body.code).toBe("CANNOT_BOOK_OWN_SERVICE");
      await post("/bookings", newUser(), bookBody(slot(5, 10).replace("Z", ""))).expect(400); // no offset
      await post("/bookings", newUser(), bookBody(slot(5), { offeringId: "nope" })).expect(400);
      const gone = await post("/bookings", newUser(), bookBody(slot(5), { offeringId: newUser().id })).expect(404);
      expect(gone.body.code).toBe("OFFERING_NOT_FOUND");
    });

    it("never double-books: parallel requests for one slot create exactly one booking", async () => {
      const start = slot(4);
      const results = await Promise.all(
        Array.from({ length: 8 }, () => post("/bookings", newUser(), bookBody(start))),
      );
      const created = results.filter((r) => r.status === 201);
      const refused = results.filter((r) => r.status === 409);
      expect(created).toHaveLength(1);
      expect(refused).toHaveLength(7);
      expect(new Set(refused.map((r) => r.body.code))).toEqual(new Set(["PROVIDER_TIME_CONFLICT"]));
      const holds = await Block().countDocuments({ resourceId: panditId, status: "ACTIVE", startAt: new Date(start) });
      expect(holds).toBe(1);
    });

    it("treats overlapping times as conflicts and adjacent times as free", async () => {
      // slot(4) is held 10:00-11:30 IST by the test above.
      const overlap = await post("/bookings", newUser(), bookBody(new Date(new Date(slot(4)).getTime() + 30 * 60_000).toISOString())).expect(409);
      expect(overlap.body.code).toBe("PROVIDER_TIME_CONFLICT");
      const adjacent = new Date(new Date(slot(4)).getTime() + 90 * 60_000).toISOString();
      await post("/bookings", newUser(), bookBody(adjacent)).expect(201);
    });

    it("shows the provider the booking with the contact masked until they accept", async () => {
      const list = await get("/bookings?role=provider", panditUser).expect(200);
      const row = list.body.data.find((b: any) => b.id === bookingId);
      expect(row.customer.contactVisible).toBe(false);
      expect(row.customer.phone).toMatch(/^\*+0001$/);
      expect(row.serviceLocation.line1).toBeUndefined();
      expect(row.notes).toBeNull();
      expect(row.pricing.lines.map((l: any) => l.code)).toEqual(["PROVIDER_SERVICE", "TRAVEL"]);
    });

    it("lets only the payment integration confirm a booking", async () => {
      const byCustomer = await post(`/bookings/${bookingId}/transitions`, customer, { command: "confirm_payment" }).expect(403);
      expect(byCustomer.body.code).toBe("BOOKING_TRANSITION_FORBIDDEN");
      const byProvider = await post(`/bookings/${bookingId}/transitions`, panditUser, { command: "accept" }).expect(409);
      expect(byProvider.body.code).toBe("BOOKING_INVALID_TRANSITION"); // nobody has paid yet

      await app.get(ProviderBookingService).confirmPayment(bookingId, "pay_test_1");
      const after = await get(`/bookings/${bookingId}`, customer).expect(200);
      expect(after.body.data).toMatchObject({ status: "CONFIRMED", paymentReferences: ["pay_test_1"] });
      expect(ctx.notifications.some((n) => n.kind === "provider.booking.confirmed" && n.userIds.includes(panditUser.id))).toBe(true);
      // Replaying the system event is harmless.
      await expect(app.get(ProviderBookingService).confirmPayment(bookingId, "pay_test_1")).rejects.toMatchObject({ status: 409 });
    });

    it("authorises each step by the caller's relationship to the booking", async () => {
      await post(`/bookings/${bookingId}/transitions`, customer, { command: "accept" }).expect(403);
      await get(`/bookings/${bookingId}`, newUser()).expect(404); // a stranger learns nothing
      await get(`/bookings/${bookingId}/state-history`, newUser()).expect(404);
      await post(`/bookings/${bookingId}/transitions`, newUser(), { command: "accept" }).expect(404);
      const accepted = await post(`/bookings/${bookingId}/transitions`, panditUser, { command: "accept" }).expect(201);
      expect(accepted.body.data.status).toBe("PROVIDER_ACCEPTED");
      expect(accepted.body.data.customer).toMatchObject({ contactVisible: true, phone: "9876500001" });
      expect(accepted.body.data.serviceLocation.line1).toBe("12 Ganga Road");
      expect(accepted.body.data.notes).toBe("Ground floor, please bring a mat");
      const bad = await post(`/bookings/${bookingId}/transitions`, panditUser, { command: "start" }).expect(409);
      expect(bad.body.code).toBe("BOOKING_INVALID_TRANSITION");
      await post(`/bookings/${bookingId}/transitions`, panditUser, { command: "start_preparation" }).expect(201);
      await post(`/bookings/${bookingId}/transitions`, panditUser, { command: "mark_ready" }).expect(201);
      const early = await post(`/bookings/${bookingId}/transitions`, panditUser, { command: "start" }).expect(409);
      expect(early.body.code).toBe("BOOKING_TOO_EARLY");
    });

    it("runs the service to completion and keeps an append-only history", async () => {
      const soon = new Date(Date.now() + 3_600_000);
      await Booking().updateOne({ _id: bookingId }, { $set: { scheduledStartAt: soon, scheduledEndAt: new Date(soon.getTime() + 5_400_000) } });
      await post(`/bookings/${bookingId}/transitions`, panditUser, { command: "start" }).expect(201);
      const done = await post(`/bookings/${bookingId}/transitions`, panditUser, { command: "complete" }).expect(201);
      expect(done.body.data.status).toBe("COMPLETED");
      const history = await get(`/bookings/${bookingId}/state-history`, customer).expect(200);
      expect(history.body.data.map((h: any) => h.to)).toEqual([
        "PAYMENT_PENDING", "CONFIRMED", "PROVIDER_ACCEPTED", "PREPARATION_IN_PROGRESS",
        "READY_FOR_FULFILMENT", "IN_PROGRESS", "COMPLETED",
      ]);
      const finished = await post(`/bookings/${bookingId}/transitions`, panditUser, { command: "accept" }).expect(409);
      expect(finished.body.code).toBe("BOOKING_INVALID_TRANSITION");
    });

    it("gives ops a queue without contact details, and audits opening a booking", async () => {
      await get("/admin/provider-bookings", customer).expect(403);
      const queue = await get("/admin/provider-bookings?status=COMPLETED", ops).expect(200);
      expect(queue.body.data.length).toBeGreaterThan(0);
      expect(JSON.stringify(queue.body)).not.toContain("9876500001");
      expect(JSON.stringify(queue.body)).not.toContain("Ganga Road");
      const one = await get(`/bookings/${bookingId}`, ops).expect(200);
      expect(one.body.data.customer.phone).toBe("9876500001");
    });

    it("releases the slot when a customer cancels, and demands a reason", async () => {
      const start = slot(11);
      const buyer = newUser("customer", "Cancels");
      const first = await post("/bookings", buyer, bookBody(start)).expect(201);
      const noReason = await post(`/bookings/${first.body.data.id}:cancel`, buyer, {}).expect(400);
      expect(noReason.body.success).toBe(false);
      const cancelled = await post(`/bookings/${first.body.data.id}:cancel`, buyer, { reasonCode: "CHANGE_OF_PLAN" }).expect(201);
      expect(cancelled.body.data.status).toBe("CANCELLED_BY_CUSTOMER");
      await post("/bookings", newUser(), bookBody(start)).expect(201); // the time is free again
    });

    it("lets the provider decline a paid booking, which frees the time and tells the customer", async () => {
      const start = slot(12);
      const buyer = newUser("customer", "Declined");
      const res = await post("/bookings", buyer, bookBody(start)).expect(201);
      await app.get(ProviderBookingService).confirmPayment(res.body.data.id, "pay_test_decline");
      const declined = await post(`/bookings/${res.body.data.id}:cancel`, panditUser, { reasonCode: "UNAVAILABLE" }).expect(201);
      expect(declined.body.data.status).toBe("CANCELLED_BY_PROVIDER");
      expect(ctx.notifications.some((n) => n.kind === "provider.booking.cancelled_by_provider" && n.userIds.includes(buyer.id))).toBe(true);
      await post("/bookings", newUser(), bookBody(start)).expect(201);
    });

    it("expires unpaid holds and gives the time back", async () => {
      const start = slot(13);
      const buyer = newUser();
      const res = await post("/bookings", buyer, bookBody(start)).expect(201);
      const past = new Date(Date.now() - 20 * 60_000);
      await Booking().updateOne({ _id: res.body.data.id }, { $set: { holdExpiresAt: past } });
      await Block().updateMany({ sourceId: res.body.data.id }, { $set: { expiresAt: past } });
      const swept = await app.get(ProviderMaintenanceService).sweepHolds();
      expect(swept.bookings).toBeGreaterThanOrEqual(1);
      const after = await get(`/bookings/${res.body.data.id}`, buyer).expect(200);
      expect(after.body.data.status).toBe("CANCELLED_BY_OPS");
      const history = await get(`/bookings/${res.body.data.id}/state-history`, buyer).expect(200);
      expect(history.body.data.at(-1)).toMatchObject({ to: "CANCELLED_BY_OPS", reasonCode: "HOLD_EXPIRED", actorType: "SYSTEM" });
      await post("/bookings", newUser(), bookBody(start)).expect(201);
    });

    it("refuses a late payment for a slot that was resold, instead of double-selling it", async () => {
      const start = slot(14);
      const a = await post("/bookings", newUser(), bookBody(start)).expect(201);
      const past = new Date(Date.now() - 20 * 60_000);
      await Booking().updateOne({ _id: a.body.data.id }, { $set: { holdExpiresAt: past } });
      await Block().updateMany({ sourceId: a.body.data.id }, { $set: { expiresAt: past } }); // expired, not yet swept
      const b = await post("/bookings", newUser(), bookBody(start)).expect(201); // legitimately takes the time
      await expect(app.get(ProviderBookingService).confirmPayment(a.body.data.id, "pay_late")).rejects.toMatchObject({ status: 409 });
      const stillPending = (await Booking().findById(a.body.data.id).lean()) as any;
      expect(stillPending.status).toBe("PAYMENT_PENDING");
      await app.get(ProviderBookingService).confirmPayment(b.body.data.id, "pay_ok");
      const confirmed = (await Booking().findById(b.body.data.id).lean()) as any;
      expect(confirmed.status).toBe("CONFIRMED");
    });

    it("does not let a provider release a block that holds a booking", async () => {
      const blocks = await get("/provider/calendar-blocks?limit=50", panditUser).expect(200);
      const held = blocks.body.data.find((b: any) => !b.releasable);
      expect(held).toBeTruthy();
      const res = await http().delete(`${V2}/provider/calendar-blocks/${held.id}`).set(as(panditUser)).set("Idempotency-Key", idemKey()).expect(409);
      expect(res.body.code).toBe("BLOCK_NOT_RELEASABLE");
    });

    it("summarises the provider's workload", async () => {
      const summary = await get("/provider/bookings/summary", panditUser).expect(200);
      expect(summary.body.data.byStatus.COMPLETED).toBe(1);
      expect(summary.body.data).toMatchObject({ timezone: "Asia/Kolkata" });
      expect(summary.body.data.awaitingPayment).toBeGreaterThan(0);
    });

    it("lists a customer's own bookings only", async () => {
      const mine = await get("/bookings", customer).expect(200);
      expect(mine.body.data.map((b: any) => b.id)).toEqual([bookingId]);
      expect(mine.body.meta).toMatchObject({ page: 1, total: 1 });
    });
  });


  // ============================================================ consultations
  describe("consultations", () => {
    const customer = newUser("customer", "Meera Joshi");
    const Consultation = () => app.get(getModelToken("ProviderConsultation"));
    const Booking = () => app.get(getModelToken("ProviderBooking"));
    const Block = () => app.get(getModelToken("ProviderCalendarBlock"));
    let jyotishId: string;
    let panditConsultationId: string;

    const verify = async (user: TestUser) => {
      const id = (await post("/verification-cases", user, {}).expect(201)).body.data.id;
      await post(`/verification-cases/${id}/evidence`, user, {
        evidenceType: "KYC_ID",
        storageKey: `tirvona/verification/${id}`,
        sha256: id.padEnd(64, "0"),
      }).expect(201);
      await post(`/verification-cases/${id}:submit`, user).expect(201);
      await post(`/verification-cases/${id}:claim`, reviewer).expect(201);
      await post(`/verification-cases/${id}:decide`, reviewer, { decision: "APPROVE", reasonCode: "VERIFIED" }).expect(201);
    };
    const week = () =>
      ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((dayOfWeek) => ({
        dayOfWeek, isAvailable: true, slots: [{ startTime: "08:00", endTime: "18:00" }],
      }));
    const consultBody = (extra: object = {}) => ({
      consultationType: "PANDIT",
      expertProviderId: panditId,
      channel: "VIDEO",
      scheduledStartAt: slot(6, 15),
      questionSummary: "Which muhurat suits Griha Pravesh this month?",
      ...extra,
    });

    beforeAll(async () => {
      await patch("/provider/profile", panditUser, {
        consultation: { enabled: true, feeMinor: 50000, slotMinutes: 30, channels: ["VIDEO", "PHONE"] },
      }).expect(200);
      await verify(jyotishUser);
      await put("/provider/availability-rules", jyotishUser, { timezone: "Asia/Kolkata", rules: week() }).expect(200);
      await patch("/provider/profile", jyotishUser, {
        consultation: { enabled: true, feeMinor: 150000, slotMinutes: 45, channels: ["VIDEO"] },
      }).expect(200);
      const live = await patch("/provider/profile/status", jyotishUser, { status: "ACTIVE" }).expect(200);
      jyotishId = live.body.data.id;
    });

    it("lists a consultation-only Jyotishi without any bookable ritual", async () => {
      const detail = await get(`/providers/${jyotishId}`).expect(200);
      expect(detail.body.data).toMatchObject({
        providerType: "JYOTISHI",
        acceptingBookings: false,
        consultation: { enabled: true, feeMinor: 150000 },
      });
      const found = await get("/providers?providerType=JYOTISHI&hasConsultation=true").expect(200);
      expect(found.body.data.map((p: any) => p.id)).toEqual([jyotishId]);
    });

    it("keeps Pandit and Jyotish consultations apart", async () => {
      const wrongType = await post("/consultations", customer, consultBody({ consultationType: "JYOTISHI" })).expect(422);
      expect(wrongType.body.code).toBe("CONSULTATION_TYPE_MISMATCH");
      const reverse = await post("/consultations", customer, consultBody({ expertProviderId: jyotishId })).expect(422);
      expect(reverse.body.code).toBe("CONSULTATION_TYPE_MISMATCH");
      const channel = await post("/consultations", customer, consultBody({ consultationType: "JYOTISHI", expertProviderId: jyotishId, channel: "PHONE" })).expect(422);
      expect(channel.body.code).toBe("CHANNEL_NOT_OFFERED");
      const self = await post("/consultations", panditUser, consultBody()).expect(403);
      expect(self.body.code).toBe("CANNOT_CONSULT_SELF");
      const soon = await post("/consultations", customer, consultBody({ scheduledStartAt: new Date(Date.now() + 600_000).toISOString() })).expect(422);
      expect(soon.body.code).toBe("CONSULTATION_TOO_SOON");
      await post("/consultations", customer, consultBody({ chartAccessGrant: { all: true } })).expect(400);
    });

    it("requests, confirms and completes a consultation without creating a booking", async () => {
      const bookingsBefore = await Booking().countDocuments({});
      const created = await post("/consultations", customer, consultBody()).expect(201);
      panditConsultationId = created.body.data.id;
      expect(created.body.data).toMatchObject({
        status: "REQUESTED",
        consultationType: "PANDIT",
        fee: { amountMinor: 50000, currency: "INR" },
        expert: { displayName: "Pt Ramesh Sharma" },
      });
      expect(created.body.data.questionSummary).toContain("muhurat");

      const queue = await get("/provider/consultations", panditUser).expect(200);
      expect(queue.body.data.map((c: any) => c.id)).toContain(panditConsultationId);
      expect(JSON.stringify(queue.body)).not.toContain("muhurat"); // the question is not in lists
      expect((await get("/consultations", customer).expect(200)).body.data).toHaveLength(1);

      const early = await post(`/consultations/${panditConsultationId}:complete`, panditUser, {}).expect(409);
      expect(early.body.code).toBe("CONSULTATION_INVALID_TRANSITION"); // must be confirmed first
      const confirmed = await post(`/consultations/${panditConsultationId}:schedule`, panditUser, {}).expect(201);
      expect(confirmed.body.data.status).toBe("SCHEDULED");
      expect(ctx.notifications.some((n) => n.kind === "provider.consultation.scheduled" && n.userIds.includes(customer.id))).toBe(true);
      const tooEarly = await post(`/consultations/${panditConsultationId}:complete`, panditUser, {}).expect(409);
      expect(tooEarly.body.code).toBe("CONSULTATION_TOO_EARLY");

      await Consultation().updateOne({ _id: panditConsultationId }, { $set: { scheduledStartAt: new Date(Date.now() - 3_600_000), scheduledEndAt: new Date(Date.now() - 1_800_000) } });
      const done = await post(`/consultations/${panditConsultationId}:complete`, panditUser, { expertNotes: "Advised Shukla Paksha dates." }).expect(201);
      expect(done.body.data.status).toBe("COMPLETED");
      expect(done.body.data.expertNotes).toBe("Advised Shukla Paksha dates.");

      const asCustomer = await get(`/consultations/${panditConsultationId}`, customer).expect(200);
      expect(asCustomer.body.data.expertNotes).toBeUndefined();
      expect(asCustomer.body.data.questionSummary).toContain("muhurat");
      expect(JSON.stringify(asCustomer.body)).not.toContain("Shukla");
      expect(await Booking().countDocuments({})).toBe(bookingsBefore); // consultations never create bookings
    });

    it("gives nobody else access, not even administrators", async () => {
      for (const outsider of [newUser(), reviewer, ops, root]) await get(`/consultations/${panditConsultationId}`, outsider).expect(404);
      await post(`/consultations/${panditConsultationId}:schedule`, customer, {}).expect(404);
    });

    it("links a consultation to the customer's own booking with that provider only", async () => {
      const buyer = newUser("customer", "Linked Buyer");
      const booking = await post("/bookings", buyer, {
        offeringId, scheduledStartAt: slot(16), customerName: "Linked Buyer", customerPhone: "9876500002",
        serviceLocation: { city: "Haridwar", state: "Uttarakhand" },
      }).expect(201);
      const ok = await post("/consultations", buyer, consultBody({ scheduledStartAt: slot(6, 16), bookingId: booking.body.data.id })).expect(201);
      expect(ok.body.data.bookingId).toBe(booking.body.data.id);
      const stolen = await post("/consultations", customer, consultBody({ scheduledStartAt: slot(6, 17), bookingId: booking.body.data.id })).expect(422);
      expect(stolen.body.code).toBe("BOOKING_NOT_RELATED");
      const jyotish = await post("/consultations", buyer, consultBody({ consultationType: "JYOTISHI", expertProviderId: jyotishId, channel: "VIDEO", scheduledStartAt: slot(6, 11), bookingId: booking.body.data.id })).expect(422);
      expect(jyotish.body.code).toBe("BOOKING_LINK_NOT_ALLOWED");
    });

    it("lets the expert move the time, refuses conflicts, and frees the old slot", async () => {
      const buyer = newUser();
      const created = await post("/consultations", buyer, consultBody({ scheduledStartAt: slot(7, 11) })).expect(201);
      const clash = await post(`/consultations/${created.body.data.id}:schedule`, panditUser, { scheduledStartAt: slot(4) }).expect(409);
      expect(clash.body.code).toBe("PROVIDER_TIME_CONFLICT"); // slot(4) holds a puja booking
      const moved = await post(`/consultations/${created.body.data.id}:schedule`, panditUser, { scheduledStartAt: slot(7, 15) }).expect(201);
      expect(moved.body.data.status).toBe("SCHEDULED");
      expect(new Date(moved.body.data.scheduledStartAt).toISOString()).toBe(slot(7, 15));
      await post("/consultations", newUser(), consultBody({ scheduledStartAt: slot(7, 11) })).expect(201); // old slot is free
    });

    it("releases requests the expert never answered", async () => {
      const buyer = newUser();
      const created = await post("/consultations", buyer, consultBody({ scheduledStartAt: slot(8, 15) })).expect(201);
      const past = new Date(Date.now() - 60_000);
      await Consultation().updateOne({ _id: created.body.data.id }, { $set: { holdExpiresAt: past } });
      await Block().updateMany({ sourceId: created.body.data.id }, { $set: { expiresAt: past } });
      const count = await app.get(ProviderConsultationService).expireUnanswered();
      expect(count).toBeGreaterThanOrEqual(1);
      const after = await get(`/consultations/${created.body.data.id}`, buyer).expect(200);
      expect(after.body.data).toMatchObject({ status: "CANCELLED", cancelledBy: "SYSTEM", cancelReasonCode: "EXPERT_NO_RESPONSE" });
      await post("/consultations", newUser(), consultBody({ scheduledStartAt: slot(8, 15) })).expect(201);
    });

    it("lets either party cancel with a valid reason, decided by the record", async () => {
      const buyer = newUser();
      const created = await post("/consultations", buyer, consultBody({ scheduledStartAt: slot(9, 15) })).expect(201);
      await post(`/consultations/${created.body.data.id}:cancel`, buyer, { reasonCode: "BECAUSE" }).expect(400);
      await post(`/consultations/${created.body.data.id}:cancel`, newUser(), { reasonCode: "OTHER" }).expect(404);
      const cancelled = await post(`/consultations/${created.body.data.id}:cancel`, buyer, { reasonCode: "CHANGE_OF_PLAN" }).expect(201);
      expect(cancelled.body.data).toMatchObject({ status: "CANCELLED", cancelledBy: "CUSTOMER" });
      const again = await post(`/consultations/${created.body.data.id}:cancel`, buyer, { reasonCode: "OTHER" }).expect(409);
      expect(again.body.code).toBe("CONSULTATION_INVALID_TRANSITION");
    });
  });

  // ================================================================ idempotency
  describe("idempotency", () => {
    it("releases the key when a request fails, so the caller can fix it and retry with the same key", async () => {
      const u = newUser("customer", "Retry Person");
      const key = idemKey();
      await post("/provider/profile", u, { displayName: "x" }, key).expect(400); // too short
      const fixed = await post("/provider/profile", u, { displayName: "Retry Provider" }, key).expect(201);
      expect(fixed.body.data.displayName).toBe("Retry Provider");
    });

    it("runs a request once when identical requests race", async () => {
      const key = idemKey();
      const start = istDate(40);
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          post("/provider/calendar-blocks", panditUser, { startDate: start, endDate: start, reason: "Retreat" }, key),
        ),
      );
      expect(results.every((r) => r.status === 201 || r.status === 409)).toBe(true);
      expect(results.some((r) => r.status === 201)).toBe(true);
      const created = new Set(results.filter((r) => r.status === 201).map((r) => r.body.data.id));
      expect(created.size).toBe(1); // every success is the same block
      const blocks = await get("/provider/calendar-blocks?limit=50", panditUser).expect(200);
      expect(blocks.body.data.filter((b: any) => b.startDate === start)).toHaveLength(1);
    });
  });

  // ===================================================== admin, audit, integrity
  describe("administration and audit", () => {
    it("onboards a new provider with a login account the administrator sets the password for", async () => {
      const body = {
        displayName: "Acharya Login Test", providerType: "PANDIT", languages: ["Hindi"],
        email: "Login.Pandit@Example.com", phone: "9876501234", password: "Str0ngPass!",
      };
      await post("/admin/providers", ops, body).expect(403);
      await post("/admin/providers", root, { ...body, password: "short" }).expect(400);
      await post("/admin/providers", root, { ...body, password: undefined }).expect(400);
      const created = await post("/admin/providers", root, body).expect(201);
      expect(created.body.data.status).toBe("ONBOARDING");

      const User = app.get(getModelToken("User"));
      const account: any = await User.findOne({ email: "login.pandit@example.com" }).select("+passwordHash").lean();
      expect(account).toMatchObject({ role: "pandit_provider", status: "active", phone: "9876501234" });
      expect(account.passwordHash).not.toContain("Str0ngPass!");
      expect(await (await import("bcryptjs")).default.compare("Str0ngPass!", account.passwordHash)).toBe(true);

      // The login identifiers are unique: the same email or phone cannot be onboarded twice.
      await post("/admin/providers", root, { ...body, phone: "9876509999" }).expect(409);
      await post("/admin/providers", root, { ...body, email: "other.pandit@example.com" }).expect(409);
      expect(await User.countDocuments({ email: "other.pandit@example.com" })).toBe(0);
    });

    it("suspends a provider: hidden, frozen and unbookable, then reinstated", async () => {
      await post(`/admin/providers/${panditId}:suspend`, newUser(), { reasonCode: "COMPLIANCE_VIOLATION" }).expect(403);
      await post(`/admin/providers/${panditId}:suspend`, ops, { reasonCode: "NOT_A_REASON" }).expect(400);
      const suspended = await post(`/admin/providers/${panditId}:suspend`, ops, { reasonCode: "COMPLIANCE_VIOLATION" }).expect(201);
      expect(suspended.body.data.status).toBe("SUSPENDED");

      await get(`/providers/${panditId}`).expect(404);
      expect((await get("/providers?providerType=PANDIT").expect(200)).body.data).toHaveLength(0);
      const frozen = await patch(`/provider/offerings/${offeringId}`, panditUser, { baseProfessionalFeeMinor: 1 }).expect(403);
      expect(frozen.body.code).toBe("PROVIDER_SUSPENDED");
      await patch("/provider/profile/status", panditUser, { status: "ACTIVE" }).expect(403);
      const refused = await post("/bookings", newUser(), {
        offeringId, scheduledStartAt: slot(20), customerName: "Late Buyer", customerPhone: "9876500003",
        serviceLocation: { city: "Haridwar", state: "Uttarakhand" },
      }).expect(409);
      expect(refused.body.code).toBe("PROVIDER_NOT_BOOKABLE");
      expect((await get("/provider/profile", panditUser).expect(200)).body.data.status).toBe("SUSPENDED"); // still readable by the owner

      await post(`/admin/providers/${panditId}:reinstate`, ops, { reasonCode: "OTHER" }).expect(201);
      expect((await get("/provider/profile", panditUser).expect(200)).body.data.status).toBe("INACTIVE");
      await get(`/providers/${panditId}`).expect(404); // not live until the provider chooses
      await patch("/provider/profile/status", panditUser, { status: "ACTIVE" }).expect(200);
      await get(`/providers/${panditId}`).expect(200);
    });

    it("limits the private profile to reviewers, and records each read", async () => {
      await get(`/admin/providers/${panditId}`, ops).expect(403);
      await get(`/admin/providers/${panditId}`, panditUser).expect(403);
      const view = await get(`/admin/providers/${panditId}`, reviewer).expect(200);
      expect(view.body.data.legalName).toBe(panditUser.name);
      expect(view.body.data.userId).toBe(panditUser.id); // lets an administrator find the owning login
      const AuditLog = app.get(getModelToken("AuditLog"));
      const reads = await AuditLog.countDocuments({ action: "providers.profile.private_viewed" });
      expect(reads).toBeGreaterThanOrEqual(1);
      const list = await get("/admin/providers?status=ACTIVE", ops).expect(200);
      expect(JSON.stringify(list.body)).not.toContain("ramesh@example.test");
    });

    it("keeps sensitive values out of the audit trail", async () => {
      const AuditLog = app.get(getModelToken("AuditLog"));
      const rows = (await AuditLog.find({ module: "providers" }).lean()) as any[];
      expect(rows.length).toBeGreaterThan(20);
      const text = JSON.stringify(rows);
      for (const secret of [
        "tirvona/verification/kyc-1", SHA, "9876543210", "ramesh@example.test", "Checked against the original",
        "12 Ganga Road", "9876500001", "muhurat", "Shukla", "Photo is blurry",
      ])
        expect(text).not.toContain(secret);
      const actions = new Set(rows.map((r) => r.action));
      for (const expected of [
        "providers.profile.created", "providers.verification.approved", "providers.verification.rejected",
        "providers.booking.created", "providers.booking.transition", "providers.consultation.requested",
        "providers.profile.suspended", "providers.ritual.published",
      ])
        expect(actions).toContain(expected);
      const withRequest = rows.filter((r) => r.requestId);
      expect(withRequest.length).toBeGreaterThan(rows.length / 2); // correlated to the HTTP request
    });

    it("finds no dangling references in a healthy database, and finds one that is planted", async () => {
      const clean = await get("/admin/providers/integrity", root).expect(200);
      expect(clean.body.data).toEqual({ ok: true, findings: [] });
      await get("/admin/providers/integrity", ops).expect(403);

      const Offering = app.get(getModelToken("ProviderOffering"));
      const orphanProvider = newUser().id;
      await Offering.collection.insertOne({
        providerId: new Types.ObjectId(orphanProvider),
        ritualId: new Types.ObjectId(ritualId),
        ritualVariantId: new Types.ObjectId(variantId),
        fulfilmentType: "ON_BEHALF",
        durationMinutes: 30,
        baseProfessionalFeeMinor: 1,
        status: "INACTIVE",
      } as any);
      const dirty = await app.get(ProviderIntegrityService).check();
      expect(dirty.ok).toBe(false);
      expect(dirty.findings.map((f) => f.check)).toContain("provider_offerings.providerId -> provider_profiles");
      await Offering.collection.deleteMany({ providerId: new Types.ObjectId(orphanProvider) });
      expect((await app.get(ProviderIntegrityService).check()).ok).toBe(true);
    });
  });


  // ======================================================== payments (test mode)
  describe("payments, wallet and refunds (gateway mocked, wallet real)", () => {
    const KEY_SECRET = "qa_test_secret_value";
    const mocks = () => (Razorpay as any).__mocks as { create: jest.Mock; refund: jest.Mock };
    const sign = (orderId: string, paymentId: string, secret = KEY_SECRET) =>
      createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    const Booking = () => app.get(getModelToken("ProviderBooking"));
    const bookBody = (start: string) => ({
      offeringId, scheduledStartAt: start, customerName: "Pay Tester", customerPhone: "9876500010",
      serviceLocation: { city: "Haridwar", state: "Uttarakhand" },
    });
    const newBooking = async (daysAhead: number, buyer = newUser("customer", "Payer")) => {
      const res = await post("/bookings", buyer, bookBody(slot(daysAhead))).expect(201);
      return { buyer, id: res.body.data.id as string };
    };
    let orderSeq = 0;
    beforeEach(() => {
      mocks().create.mockReset();
      mocks().refund.mockReset();
      mocks().create.mockImplementation(async (input: any) => ({ id: `order_QA${++orderSeq}`, amount: input.amount, currency: input.currency }));
      mocks().refund.mockImplementation(async (paymentId: string, input: any) => ({ id: `rfnd_${paymentId}`, status: "pending", amount: input.amount }));
    });

    it("prices the gateway order from the server's snapshot, never from the client", async () => {
      const { buyer, id } = await newBooking(30);
      const res = await post(`/bookings/${id}/payment/order`, buyer, { amount: 1, totalMinor: 1 }).expect(400); // unknown fields refused
      expect(res.body.success).toBe(false);
      const order = await post(`/bookings/${id}/payment/order`, buyer, {}).expect(201);
      expect(mocks().create).toHaveBeenCalledWith(expect.objectContaining({ amount: 300000, currency: "INR" }));
      expect(order.body.configured).toBe(true);
      expect(order.body.data).toMatchObject({ amount: 300000, currency: "INR" });
      expect(JSON.stringify(order.body)).not.toContain(KEY_SECRET);
      const stored = (await Booking().findById(id).lean()) as any;
      expect(stored.paymentOrder).toMatchObject({ gatewayMinor: 300000, walletMinor: 0 });
      expect(stored.status).toBe("PAYMENT_PENDING"); // opening an order confirms nothing
    });

    it("lets only the booking's customer pay for it", async () => {
      const { id } = await newBooking(31);
      await post(`/bookings/${id}/payment/order`, newUser(), {}).expect(404);
      await post(`/bookings/${id}/payment/order`, panditUser, {}).expect(404);
      await post(`/bookings/${id}/payment/order`, ops, {}).expect(404);
      expect(mocks().create).not.toHaveBeenCalled();
    });

    it("rejects a forged signature and a genuine signature from a different order", async () => {
      const { buyer, id } = await newBooking(32);
      const order = (await post(`/bookings/${id}/payment/order`, buyer, {}).expect(201)).body.data.orderId;
      const forged = await post(`/bookings/${id}/payment`, buyer, { razorpay_order_id: order, razorpay_payment_id: "pay_QA1", razorpay_signature: "0".repeat(64) }).expect(400);
      expect(forged.body.code).toBe("PAYMENT_SIGNATURE_INVALID");
      // The attack: pay a cheap order of your own, replay its (valid) signature against an expensive booking.
      const otherOrder = "order_SOMEONE_ELSES_CHEAP_ORDER";
      const swapped = await post(`/bookings/${id}/payment`, buyer, { razorpay_order_id: otherOrder, razorpay_payment_id: "pay_QA2", razorpay_signature: sign(otherOrder, "pay_QA2") }).expect(400);
      expect(swapped.body.code).toBe("PAYMENT_ORDER_MISMATCH");
      expect(((await Booking().findById(id).lean()) as any).status).toBe("PAYMENT_PENDING");
    });

    it("confirms exactly once on a valid checkout callback, and a repeat is harmless", async () => {
      const { buyer, id } = await newBooking(33);
      const order = (await post(`/bookings/${id}/payment/order`, buyer, {}).expect(201)).body.data.orderId;
      const body = { razorpay_order_id: order, razorpay_payment_id: "pay_QA3", razorpay_signature: sign(order, "pay_QA3") };
      await post(`/bookings/${id}/payment`, newUser(), body).expect(404); // not the owner
      await post(`/bookings/${id}/payment`, buyer, body).expect(201);
      const confirmed = (await Booking().findById(id).lean()) as any;
      expect(confirmed.status).toBe("CONFIRMED");
      expect(confirmed.paymentRefs).toEqual(expect.arrayContaining([order, "pay_QA3"]));
      const again = await post(`/bookings/${id}/payment`, buyer, body).expect(201);
      expect(again.body.alreadyConfirmed).toBe(true);
      const history = await Booking().db.collection("provider_booking_state_history").countDocuments({ bookingId: confirmed._id, toState: "CONFIRMED" });
      expect(history).toBe(1);
    });

    it("reconciles a delayed webhook by order and amount, and ignores wrong, duplicate and unknown events", async () => {
      const svc = app.get(ProviderBookingPaymentService);
      const { buyer, id } = await newBooking(34);
      const order = (await post(`/bookings/${id}/payment/order`, buyer, {}).expect(201)).body.data.orderId;
      expect(await svc.confirmPaymentFromWebhook("order_UNKNOWN", "pay_X", { amountPaise: 300000 })).toBe(false);
      expect(await svc.confirmPaymentFromWebhook(order, "pay_QA4", { amountPaise: 100 })).toBe(true); // claimed, not confirmed
      expect(await svc.confirmPaymentFromWebhook(order, "pay_QA4", undefined)).toBe(true); // no amount: refuse to guess
      expect(((await Booking().findById(id).lean()) as any).status).toBe("PAYMENT_PENDING");
      expect(await svc.confirmPaymentFromWebhook(order, "pay_QA4", { amountPaise: 300000, currency: "INR" })).toBe(true);
      expect(((await Booking().findById(id).lean()) as any).status).toBe("CONFIRMED");
      expect(await svc.confirmPaymentFromWebhook(order, "pay_QA4", { amountPaise: 300000 })).toBe(true); // duplicate
      const rows = await Booking().db.collection("provider_booking_state_history").countDocuments({ bookingId: new Types.ObjectId(id), toState: "CONFIRMED" });
      expect(rows).toBe(1);
    });

    it("does not resurrect a cancelled booking when a payment webhook arrives late", async () => {
      const svc = app.get(ProviderBookingPaymentService);
      const { buyer, id } = await newBooking(35);
      const order = (await post(`/bookings/${id}/payment/order`, buyer, {}).expect(201)).body.data.orderId;
      await post(`/bookings/${id}:cancel`, buyer, { reasonCode: "CHANGE_OF_PLAN" }).expect(201);
      expect(await svc.confirmPaymentFromWebhook(order, "pay_QA5", { amountPaise: 300000 })).toBe(true);
      expect(((await Booking().findById(id).lean()) as any).status).toBe("CANCELLED_BY_CUSTOMER");
    });

    it("splits a payment between wallet and gateway, captures the wallet share, and refunds each part to where it came from", async () => {
      const wallet = app.get(WalletService);
      const buyer = newUser("customer", "Split Payer");
      await wallet.credit({ userId: buyer.id, amount: 1000, module: "admin", category: "admin_credit", description: "QA credit", idempotencyKey: `qa-credit-${buyer.id}` });
      const { id } = await newBooking(36, buyer);
      const order = await post(`/bookings/${id}/payment/order`, buyer, { useWallet: true }).expect(201);
      expect(order.body.wallet).toMatchObject({ applied: 1000, gatewayAmount: 2000, total: 3000 });
      expect(mocks().create).toHaveBeenCalledWith(expect.objectContaining({ amount: 200000 }));
      expect(await wallet.availableBalance(buyer.id)).toBe(0); // reserved while the gateway payment is pending

      const orderId = order.body.data.orderId;
      await post(`/bookings/${id}/payment`, buyer, { razorpay_order_id: orderId, razorpay_payment_id: "pay_SPLIT1", razorpay_signature: sign(orderId, "pay_SPLIT1") }).expect(201);
      expect(((await Booking().findById(id).lean()) as any).status).toBe("CONFIRMED");
      // The wallet share was actually spent (a lapsing hold would otherwise hand it back for free).
      const w: any = await app.get(getModelToken("PilgrimWallet")).findOne({ userId: buyer.id }).lean();
      expect(w.balance).toBe(0);
      expect(w.heldAmount ?? 0).toBe(0);
      expect(w.totalSpent).toBe(1000);

      await post(`/bookings/${id}:cancel`, panditUser, { reasonCode: "UNAVAILABLE" }).expect(201);
      expect(mocks().refund).toHaveBeenCalledTimes(1);
      expect(mocks().refund).toHaveBeenCalledWith("pay_SPLIT1", expect.objectContaining({ amount: 200000 })); // only the gateway part
      expect(await wallet.availableBalance(buyer.id)).toBe(1000); // only the wallet part
      const refund = ((await Booking().findById(id).lean()) as any).refund;
      expect(refund.wallet).toMatchObject({ status: "CREDITED", amountMinor: 100000 });
      expect(refund.gateway).toMatchObject({ status: "PENDING", amountMinor: 200000, paymentId: "pay_SPLIT1" }); // the gateway's word, not "refunded"
    });

    it("pays entirely from the wallet, and reverses the spend if the booking cannot be confirmed", async () => {
      const wallet = app.get(WalletService);
      const buyer = newUser("customer", "Wallet Payer");
      await wallet.credit({ userId: buyer.id, amount: 5000, module: "admin", category: "admin_credit", description: "QA credit", idempotencyKey: `qa-credit-${buyer.id}` });
      const { id } = await newBooking(37, buyer);
      const res = await post(`/bookings/${id}/payment/order`, buyer, { useWallet: true }).expect(201);
      expect(res.body.walletPaid).toBe(true);
      expect(mocks().create).not.toHaveBeenCalled(); // no gateway order for a wallet-only payment
      expect(((await Booking().findById(id).lean()) as any).status).toBe("CONFIRMED");
      expect(await wallet.availableBalance(buyer.id)).toBe(2000);
      await post(`/bookings/${id}:cancel`, buyer, { reasonCode: "CHANGE_OF_PLAN" }).expect(201);
      expect(await wallet.availableBalance(buyer.id)).toBe(5000);
      expect(mocks().refund).not.toHaveBeenCalled();
    });

    it("does not report a refund as done when the gateway fails or is not configured", async () => {
      const { buyer, id } = await newBooking(38);
      const orderId = (await post(`/bookings/${id}/payment/order`, buyer, {}).expect(201)).body.data.orderId;
      await post(`/bookings/${id}/payment`, buyer, { razorpay_order_id: orderId, razorpay_payment_id: "pay_FAIL1", razorpay_signature: sign(orderId, "pay_FAIL1") }).expect(201);
      mocks().refund.mockRejectedValueOnce(new Error("gateway down"));
      await post(`/bookings/${id}:cancel`, panditUser, { reasonCode: "UNAVAILABLE" }).expect(201);
      const refund = ((await Booking().findById(id).lean()) as any).refund;
      expect(refund.gateway.status).toBe("FAILED"); // recorded for operations, not swallowed
      expect(JSON.stringify(refund)).not.toMatch(/REFUNDED|SUCCESS/);
    });

    it("reports a configuration blocker instead of a fake order when the gateway keys are missing", async () => {
      const { buyer, id } = await newBooking(39);
      const config = app.get(ConfigService);
      const spy = jest.spyOn(config, "get").mockImplementation(((key: string) => (key.startsWith("razorpay") ? undefined : (config as any).internalConfig?.[key])) as any);
      try {
        const res = await post(`/bookings/${id}/payment/order`, buyer, {}).expect(201);
        expect(res.body).toMatchObject({ configured: false, blocker: "RAZORPAY_CREDENTIALS_MISSING" });
        expect(mocks().create).not.toHaveBeenCalled();
        const cb = await post(`/bookings/${id}/payment`, buyer, { razorpay_order_id: "order_QAX", razorpay_payment_id: "pay_QAX", razorpay_signature: "a".repeat(64) }).expect(409);
        expect(cb.body.code).toBe("GATEWAY_NOT_CONFIGURED");
      } finally {
        spy.mockRestore();
      }
      expect(((await Booking().findById(id).lean()) as any).status).toBe("PAYMENT_PENDING");
    });
  });

  // ============================================================ consultation chat
  describe("customer - acharya chat", () => {
    const customer = newUser("customer", "Chat Customer");
    let consultationId: string;
    const Message = () => app.get(getModelToken("ProviderConsultationMessage"));

    beforeAll(async () => {
      const created = await post("/consultations", customer, {
        consultationType: "PANDIT", expertProviderId: panditId, channel: "VIDEO",
        scheduledStartAt: slot(44, 15), questionSummary: "About muhurat",
      }).expect(201);
      consultationId = created.body.data.id;
    });

    it("lets the two parties talk, in order, with the right names", async () => {
      const a = await post(`/consultations/${consultationId}/messages`, customer, { content: "Namaste, is the muhurat fine?" }).expect(201);
      expect(a.body.data).toMatchObject({ senderRole: "CUSTOMER", senderName: "Chat Customer", readAt: null });
      const b = await post(`/consultations/${consultationId}/messages`, panditUser, { content: "Namaste. Yes, please come at 6." }).expect(201);
      expect(b.body.data).toMatchObject({ senderRole: "EXPERT", senderName: "Pt Ramesh Sharma" });
      const thread = await get(`/consultations/${consultationId}/messages`, customer).expect(200);
      expect(thread.body.data.map((m: any) => m.content)).toEqual(["Namaste, is the muhurat fine?", "Namaste. Yes, please come at 6."]);
    });

    it("keeps unread counts and read receipts accurate", async () => {
      const x = newUser("customer", "Unread Customer");
      const c = await post("/consultations", x, { consultationType: "PANDIT", expertProviderId: panditId, channel: "VIDEO", scheduledStartAt: slot(45, 15) }).expect(201);
      const id = c.body.data.id;
      await post(`/consultations/${id}/messages`, x, { content: "one" }).expect(201);
      await post(`/consultations/${id}/messages`, x, { content: "two" }).expect(201);
      const queue = await get("/provider/consultations", panditUser).expect(200);
      expect(queue.body.data.find((r: any) => r.id === id).unreadCount).toBe(2);
      expect((await get("/consultations", x).expect(200)).body.data.find((r: any) => r.id === id).unreadCount).toBe(0); // own messages are not unread
      const opened = await get(`/consultations/${id}/messages`, panditUser).expect(200);
      expect(opened.body.data.every((m: any) => m.readAt)).toBe(true);
      expect((await get("/provider/consultations", panditUser).expect(200)).body.data.find((r: any) => r.id === id).unreadCount).toBe(0);
      const seenBySender = await get(`/consultations/${id}/messages`, x).expect(200);
      expect(seenBySender.body.data.every((m: any) => m.readAt)).toBe(true); // the customer's messages show as read after the expert opened them
    });

    it("never loses a message sent while the other side is opening the thread", async () => {
      const x = newUser("customer", "Race Customer");
      const c = await post("/consultations", x, { consultationType: "PANDIT", expertProviderId: panditId, channel: "VIDEO", scheduledStartAt: slot(46, 15) }).expect(201);
      const id = c.body.data.id;
      const sends = Array.from({ length: 20 }, (_, i) => post(`/consultations/${id}/messages`, x, { content: `m${i}` }));
      const reads = Array.from({ length: 10 }, () => get(`/consultations/${id}/messages`, panditUser));
      const results = await Promise.all([...sends, ...reads]);
      expect(results.slice(0, 20).every((r) => r.status === 201)).toBe(true);
      expect(await Message().countDocuments({ consultationId: id })).toBe(20); // the array-overwrite bug would drop some
    });

    it("pages with a cursor for polling and reconnects", async () => {
      const all = (await get(`/consultations/${consultationId}/messages`, customer).expect(200)).body.data;
      const after = await get(`/consultations/${consultationId}/messages?after=${all[0].id}`, customer).expect(200);
      expect(after.body.data.map((m: any) => m.id)).toEqual(all.slice(1).map((m: any) => m.id));
      await get(`/consultations/${consultationId}/messages?limit=0`, customer).expect(400);
    });

    it("admits only the two parties, and not administrators", async () => {
      for (const outsider of [newUser(), ops, root, reviewer]) {
        await get(`/consultations/${consultationId}/messages`, outsider).expect(404);
        await post(`/consultations/${consultationId}/messages`, outsider, { content: "hi" }).expect(404);
      }
      await get(`/consultations/${consultationId}/messages`).expect(401);
    });

    it("validates content and attachments", async () => {
      const send = (body: object) => post(`/consultations/${consultationId}/messages`, customer, body);
      await send({ content: "   " }).expect(400);
      await send({ content: "x".repeat(4001) }).expect(400);
      await send({ content: "see file", attachments: [{ url: "https://evil.example.com/x.exe", name: "x" }] }).expect(400);
      await send({ content: "see file", attachments: [{ url: "javascript:alert(1)", name: "x" }] }).expect(400);
      await send({ content: "see file", attachments: Array.from({ length: 6 }, () => ({ url: "https://res.cloudinary.com/demo/a.pdf", name: "a" })) }).expect(400);
      await send({ content: "x", senderRole: "EXPERT", senderName: "Forged" }).expect(400);
      const ok = await send({ content: "see file", attachments: [{ url: "https://res.cloudinary.com/demo/chart.pdf", name: "chart.pdf", mimeType: "application/pdf" }] }).expect(201);
      expect(ok.body.data.attachments).toHaveLength(1);
    });

    it("delivers live and notifies the other party, and a retried send does not duplicate", async () => {
      const before = ctx.liveEvents.length;
      const key = idemKey();
      const body = { content: "live message" };
      await post(`/consultations/${consultationId}/messages`, customer, body, key).expect(201);
      const replay = await post(`/consultations/${consultationId}/messages`, customer, body, key).expect(201);
      expect(replay.headers["idempotent-replay"]).toBe("true");
      expect(await Message().countDocuments({ consultationId, content: "live message" })).toBe(1);
      const event = ctx.liveEvents.slice(before).find((e) => e.event === "consultation:message");
      expect(event?.userId).toBe(String((await app.get(getModelToken("ProviderConsultation")).findById(consultationId).lean() as any).expertUserId));
      expect(ctx.notifications.some((n) => n.kind === "provider.consultation.message")).toBe(true);
    });

    it("closes the thread when the consultation is cancelled, but keeps the history readable", async () => {
      const x = newUser("customer", "Closing Customer");
      const c = await post("/consultations", x, { consultationType: "PANDIT", expertProviderId: panditId, channel: "VIDEO", scheduledStartAt: slot(47, 15) }).expect(201);
      await post(`/consultations/${c.body.data.id}/messages`, x, { content: "before" }).expect(201);
      await post(`/consultations/${c.body.data.id}:cancel`, x, { reasonCode: "CHANGE_OF_PLAN" }).expect(201);
      const closed = await post(`/consultations/${c.body.data.id}/messages`, x, { content: "after" }).expect(409);
      expect(closed.body.code).toBe("CONSULTATION_CLOSED");
      expect((await get(`/consultations/${c.body.data.id}/messages`, x).expect(200)).body.data).toHaveLength(1);
    });

    it("keeps chat content out of the audit trail", async () => {
      const AuditLog = app.get(getModelToken("AuditLog"));
      const text = JSON.stringify(await AuditLog.find({ module: "providers" }).lean());
      expect(text).not.toContain("Namaste");
      expect(text).not.toContain("live message");
    });
  });

  // ===================================================================== Zoom
  describe("Zoom Live Pooja (Zoom API mocked)", () => {
    const START = "https://zoom.us/s/HOST-START-SECRET?zak=host-token";
    const JOIN = "https://zoom.us/j/123456789?pwd=guest";
    const Booking = () => app.get(getModelToken("ProviderBooking"));
    let fetchMock: jest.SpiedFunction<typeof fetch>;
    const saved = { a: process.env.ZOOM_ACCOUNT_ID, c: process.env.ZOOM_CLIENT_ID, s: process.env.ZOOM_CLIENT_SECRET };
    const zoomCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes("api.zoom.us")).length;
    const mockZoom = (meetingOk = true) =>
      fetchMock.mockImplementation((async (url: any) => {
        if (String(url).includes("zoom.us/oauth")) return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
        if (!meetingOk) return new Response("nope", { status: 500 });
        await new Promise((r) => setTimeout(r, 30));
        return new Response(JSON.stringify({ id: 987654321, topic: "t", join_url: JOIN, start_url: START, password: "p" }), { status: 201 });
      }) as any);
    const paid = async (daysAhead: number) => {
      const buyer = newUser("customer", "Zoom Customer");
      const b = await post("/bookings", buyer, { offeringId, scheduledStartAt: slot(daysAhead), customerName: "Zoom Customer", customerPhone: "9876500011", serviceLocation: { city: "Haridwar", state: "Uttarakhand" } }).expect(201);
      await app.get(ProviderBookingService).confirmPayment(b.body.data.id, `pay_ZOOM${daysAhead}`);
      return { buyer, id: b.body.data.id as string };
    };

    beforeEach(() => {
      fetchMock = jest.spyOn(global, "fetch") as any;
      process.env.ZOOM_ACCOUNT_ID = "acct"; process.env.ZOOM_CLIENT_ID = "cid"; process.env.ZOOM_CLIENT_SECRET = "csecret";
      mockZoom();
    });
    afterEach(() => {
      fetchMock.mockRestore();
      for (const [k, v] of [["ZOOM_ACCOUNT_ID", saved.a], ["ZOOM_CLIENT_ID", saved.c], ["ZOOM_CLIENT_SECRET", saved.s]] as const)
      {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });

    it("reports a configuration blocker, not a crash, when credentials are missing", async () => {
      delete process.env.ZOOM_ACCOUNT_ID;
      const { id } = await paid(50);
      const res = await post(`/bookings/${id}:zoom:create`, panditUser, {}).expect(422);
      expect(res.body.code).toBe("ZOOM_NOT_CONFIGURED");
      expect(zoomCalls()).toBe(0);
      expect((await get(`/bookings/${id}/zoom`, panditUser).expect(200)).body).toMatchObject({ data: null, configured: false });
    });

    it("lets only the booking's provider create a meeting, and only for a live paid booking", async () => {
      const unpaid = (await post("/bookings", newUser(), { offeringId, scheduledStartAt: slot(51), customerName: "Zoom Customer", customerPhone: "9876500012", serviceLocation: { city: "Haridwar", state: "Uttarakhand" } }).expect(201)).body.data.id;
      const early = await post(`/bookings/${unpaid}:zoom:create`, panditUser, {}).expect(422);
      expect(early.body.code).toBe("BOOKING_NOT_ELIGIBLE_FOR_ZOOM");
      const { buyer, id } = await paid(52);
      await post(`/bookings/${id}:zoom:create`, buyer, {}).expect(404); // the customer is not the host
      await post(`/bookings/${id}:zoom:create`, newUser(), {}).expect(404);
      await post(`/bookings/${id}:zoom:create`, ops, {}).expect(404); // ops never hold the host link
      expect(zoomCalls()).toBe(0);
    });

    it("works after the provider accepts (PROVIDER_ACCEPTED), creates one meeting, and gives the host link only to the provider", async () => {
      const { buyer, id } = await paid(53);
      await post(`/bookings/${id}/transitions`, panditUser, { command: "accept" }).expect(201);
      const created = await post(`/bookings/${id}:zoom:create`, panditUser, {}).expect(201);
      expect(created.body).toMatchObject({ reused: false, data: { joinUrl: JOIN, startUrl: START, isHost: true } });
      const asCustomer = await get(`/bookings/${id}/zoom`, buyer).expect(200);
      expect(asCustomer.body.data).toMatchObject({ joinUrl: JOIN, isHost: false });
      expect(JSON.stringify(asCustomer.body)).not.toContain("HOST-START-SECRET");
      const asOps = await get(`/bookings/${id}/zoom`, ops).expect(200);
      expect(asOps.body.data.joinUrl).toBe(JOIN);
      expect(JSON.stringify(asOps.body)).not.toContain("HOST-START-SECRET");
      const asHost = await get(`/bookings/${id}/zoom`, panditUser).expect(200);
      expect(asHost.body.data.startUrl).toBe(START);
      await get(`/bookings/${id}/zoom`, newUser()).expect(404);
      await get(`/bookings/${id}/zoom`).expect(401);
    });

    it("never creates two meetings for one booking, even for simultaneous requests", async () => {
      const { id } = await paid(54);
      const results = await Promise.all(Array.from({ length: 5 }, () => post(`/bookings/${id}:zoom:create`, panditUser, {})));
      expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
      expect(zoomCalls()).toBe(1);
      const again = await post(`/bookings/${id}:zoom:create`, panditUser, {}).expect(201);
      expect(again.body.reused).toBe(true);
      expect(zoomCalls()).toBe(1);
      expect(((await Booking().findById(id).lean()) as any).zoomMeeting.meetingId).toBe("987654321");
    });

    it("never exposes the host link or password in any booking view, list or audit record", async () => {
      const { buyer, id } = await paid(55);
      await post(`/bookings/${id}:zoom:create`, panditUser, {}).expect(201);
      const surfaces = [
        await get(`/bookings/${id}`, buyer), await get(`/bookings/${id}`, panditUser), await get(`/bookings/${id}`, ops),
        await get("/bookings", buyer), await get("/bookings?role=provider", panditUser), await get("/admin/provider-bookings", ops),
        await get("/provider/bookings/summary", panditUser),
      ];
      for (const res of surfaces) {
        const text = JSON.stringify(res.body);
        expect(text).not.toContain("HOST-START-SECRET");
        expect(text).not.toContain("zak=host-token");
      }
      const audit = JSON.stringify(await app.get(getModelToken("AuditLog")).find({ module: "providers" }).lean());
      expect(audit).not.toContain("HOST-START-SECRET");
      expect(audit).not.toContain("zoom.us/j/");
    });

    it("surfaces Zoom failures as 502 and lets the provider retry", async () => {
      const { id } = await paid(56);
      mockZoom(false);
      const failed = await post(`/bookings/${id}:zoom:create`, panditUser, {}).expect(502);
      expect(failed.body.code).toBe("ZOOM_CREATION_FAILED");
      expect(((await Booking().findById(id).lean()) as any).zoomMeeting).toBeNull(); // no half-created state
      mockZoom(true);
      await post(`/bookings/${id}:zoom:create`, panditUser, {}).expect(201);
    });

    it("withdraws the link when the booking is cancelled", async () => {
      const { buyer, id } = await paid(57);
      await post(`/bookings/${id}:zoom:create`, panditUser, {}).expect(201);
      await post(`/bookings/${id}:cancel`, buyer, { reasonCode: "CHANGE_OF_PLAN" }).expect(201);
      expect((await get(`/bookings/${id}/zoom`, buyer).expect(200)).body.data).toBeNull();
      expect((await get(`/bookings/${id}/zoom`, panditUser).expect(200)).body.data).toBeNull();
    });
  });

  // =========================================================== admin console
  describe("Super Admin - Pandit & Acharya management", () => {
    const User = () => app.get(getModelToken("User"));
    const mkAccount = async (name: string) => {
      const u = newUser("customer", name);
      await User().collection.insertOne({ _id: new Types.ObjectId(u.id), name, email: u.email, phone: u.phone, role: "customer", status: "active", isDeleted: false } as any);
      return u;
    };

    it("shows dashboard figures computed from real data, to ops only", async () => {
      await get("/admin/providers/overview", newUser()).expect(403);
      await get("/admin/providers/overview", reviewer).expect(403);
      const o = (await get("/admin/providers/overview", ops).expect(200)).body.data;
      const Profile = app.get(getModelToken("ProviderProfile"));
      const Booking = app.get(getModelToken("ProviderBooking"));
      expect(o.totalProviders).toBe(await Profile.countDocuments({ deletedAt: null }));
      expect(o.activeProviders).toBe(await Profile.countDocuments({ deletedAt: null, status: "ACTIVE" }));
      expect(o.totalBookings).toBe(await Booking.countDocuments({}));
      expect(o.upcomingBookings).toBe(await Booking.countDocuments({ status: { $in: ["CONFIRMED", "PROVIDER_ACCEPTED", "PREPARATION_IN_PROGRESS", "READY_FOR_FULFILMENT", "IN_PROGRESS"] } }));
      expect(o.upcomingBookings).toBeGreaterThan(0); // includes accepted bookings, not just a status that does not exist
      expect(o.completedBookings).toBeGreaterThanOrEqual(1);
      expect(o.recentBookings.length).toBeLessThanOrEqual(5);
      expect(JSON.stringify(o)).not.toContain("9876");
    });

    it("onboards a provider for an existing account: Super Admin only, validated, never pre-verified", async () => {
      const account = await mkAccount("Admin Made");
      const body = { userId: account.id, displayName: "Admin Created Acharya", providerType: "ACHARYA", languages: ["Hindi"], homeCity: "Varanasi" };
      await post("/admin/providers", ops, body).expect(403); // ops cannot create
      await post("/admin/providers", newUser(), body).expect(403);
      await post("/admin/providers", root, { ...body, status: "ACTIVE" }).expect(400); // no status
      await post("/admin/providers", root, { ...body, verificationLevel: "TIRVONA_TRUSTED" }).expect(400);
      await post("/admin/providers", root, { ...body, providerType: "WIZARD" }).expect(400);
      await post("/admin/providers", root, { ...body, userId: newUser().id }).expect(404); // no such account
      await post("/admin/providers", root, { ...body, userId: "not-an-id" }).expect(400);
      const created = await post("/admin/providers", root, body).expect(201);
      expect(created.body.data).toMatchObject({ status: "ONBOARDING", verificationLevel: "UNVERIFIED", providerType: "ACHARYA", legalName: "Admin Made" });
      await get(`/providers/${created.body.data.id}`).expect(404); // not public until verified and live
      await post("/admin/providers", root, body).expect(409); // one profile per account
      // The account holder now owns it through the normal self-service endpoints.
      expect((await get("/provider/profile", account).expect(200)).body.data.id).toBe(created.body.data.id);
      // The private row exists (the earlier code created the profile and then failed on this).
      expect(await app.get(getModelToken("ProviderPrivateProfile")).countDocuments({ providerId: created.body.data.id })).toBe(1);
    });

    it("edits only validated public fields and refuses to bypass verification", async () => {
      const account = await mkAccount("Edit Target");
      const id = (await post("/admin/providers", root, { userId: account.id, displayName: "Edit Target Pandit" }).expect(201)).body.data.id;
      await patch(`/admin/providers/${id}`, newUser(), { bio: "x" }).expect(403);
      await patch(`/admin/providers/${id}`, reviewer, { bio: "x" }).expect(403);
      await patch(`/admin/providers/${id}`, ops, { providerType: "WIZARD" }).expect(400);
      await patch(`/admin/providers/${id}`, ops, { avatarUrl: "javascript:alert(1)" }).expect(400);
      await patch(`/admin/providers/${id}`, ops, { languages: ["Klingon"] }).expect(400);
      await patch(`/admin/providers/${id}`, ops, { verificationLevel: "TIRVONA_TRUSTED", userId: newUser().id }).expect(400);
      const live = await patch(`/admin/providers/${id}`, ops, { status: "ACTIVE" }).expect(409);
      expect(live.body.code).toBe("IDENTITY_VERIFICATION_REQUIRED");
      const ok = await patch(`/admin/providers/${id}`, ops, { bio: "Edited by operations for clarity.", homeCity: "Ujjain" }).expect(200);
      expect(ok.body.data).toMatchObject({ homeCity: "Ujjain", verificationLevel: "UNVERIFIED" });
      const audit = JSON.stringify(await app.get(getModelToken("AuditLog")).find({ action: "providers.profile.admin_updated" }).lean());
      expect(audit).toContain("bio");
      expect(audit).not.toContain("Edited by operations");
    });

    it("lets operations pause and restore offerings under the catalogue's rules", async () => {
      await get("/admin/offerings", newUser()).expect(403);
      const list = await get(`/admin/offerings?providerId=${panditId}`, ops).expect(200);
      expect(list.body.data[0].providerName).toBe("Pt Ramesh Sharma");
      expect(list.body.data.length).toBeGreaterThan(0);
      await patch(`/admin/offerings/${offeringId}/status`, newUser(), { status: "PAUSED" }).expect(403);
      await patch(`/admin/offerings/${offeringId}/status`, ops, { status: "HACKED" }).expect(400);
      await patch(`/admin/offerings/${offeringId}/status`, ops, { status: "PAUSED", extra: 1 }).expect(400);
      const paused = await patch(`/admin/offerings/${offeringId}/status`, ops, { status: "PAUSED" }).expect(200);
      expect(paused.body.data.status).toBe("PAUSED");
      await post("/bookings", newUser(), { offeringId, scheduledStartAt: slot(60), customerName: "Zoom Customer", customerPhone: "9876500013", serviceLocation: { city: "Haridwar", state: "Uttarakhand" } }).expect(422); // paused: not sellable
      expect((await get(`/providers/${panditId}/offerings`).expect(200)).body.data).toHaveLength(0);
      await patch(`/admin/offerings/${offeringId}/status`, ops, { status: "ACTIVE" }).expect(200);
      expect((await get(`/providers/${panditId}/offerings`).expect(200)).body.data).toHaveLength(1);
      expect((await get(`/admin/offerings?status=ACTIVE&providerId=${panditId}`, ops).expect(200)).body.data.length).toBe(1);
      const audit = await app.get(getModelToken("AuditLog")).countDocuments({ action: "providers.offering.admin_status_changed" });
      expect(audit).toBe(2);
    });

    it("lists consultations for oversight without the customer's question or the expert's notes", async () => {
      await get("/admin/consultations", newUser()).expect(403);
      const list = await get("/admin/consultations", ops).expect(200);
      expect(list.body.data.length).toBeGreaterThan(0);
      const text = JSON.stringify(list.body);
      for (const secret of ["muhurat", "Shukla", "questionSummary", "expertNotes", "9876"]) expect(text).not.toContain(secret);
    });

    it("has no way to hard-delete providers, offerings, bookings or evidence", async () => {
      const deletes = providerRoutes().filter((r) => r.method === "DELETE").map((r) => r.path);
      expect(deletes).toEqual(["/api/v2/provider/calendar-blocks/:blockId"]); // releasing a soft block is the only delete
    });
  });

  // ======================================================= authorization sweep
  describe("authorization on every route (server side)", () => {
    const fill = (path: string) => path.replace(/:[A-Za-z]+/g, (m, offset, whole) => (whole[offset - 1] === "/" ? new Types.ObjectId().toHexString() : m));
    const call = (route: { method: string; path: string }, user?: TestUser) => {
      let req = (http() as any)[route.method.toLowerCase()](fill(route.path));
      if (user) req = req.set(as(user));
      if (route.method !== "GET") req = req.set("Idempotency-Key", idemKey()).send({});
      return req;
    };
    const authed = () => providerRoutes().filter((r) => !r.isPublic);

    it("answers 401 to every non-public route without a session", async () => {
      expect(authed().length).toBeGreaterThan(55);
      for (const route of authed()) {
        const res = await call(route);
        expect([route.path, res.status]).toEqual([route.path, 401]);
      }
    });

    it("answers 403 to a plain customer on every role-protected route", async () => {
      const protectedRoutes = authed().filter((r) => r.roles?.length);
      expect(protectedRoutes.length).toBeGreaterThanOrEqual(25);
      const customer = newUser("customer", "Plain Customer");
      for (const route of protectedRoutes) {
        const res = await call(route, customer);
        expect([`${route.method} ${route.path}`, res.status]).toEqual([`${route.method} ${route.path}`, 403]);
      }
    });

    it("keeps reviewers out of Super Admin-only and ops-only routes, and vice versa", async () => {
      const find = (m: string, p: string) => providerRoutes().find((r) => r.method === m && r.path === p)!;
      for (const route of [find("POST", "/api/v2/admin/providers"), find("GET", "/api/v2/admin/providers/integrity"), find("GET", "/api/v2/admin/providers/overview"), find("GET", "/api/v2/admin/provider-bookings")])
        expect((await call(route, reviewer)).status).toBe(403);
      for (const route of [find("POST", "/api/v2/verification-cases/:caseId:decide"), find("POST", "/api/v2/verification-cases/:caseId:claim")])
        expect((await call(route, ops)).status).toBe(403);
    });

    it("ignores a role claimed by the client in a body, query or custom header", async () => {
      const customer = newUser("customer", "Claims Admin");
      const res = await http().get(`${V2}/admin/providers/overview?role=super_admin`).set(as(customer)).set("x-user-role", "super_admin").expect(403);
      expect(res.body.success).toBe(false);
      await http().post(`${V2}/admin/providers`).set(as(customer)).set("Idempotency-Key", idemKey()).send({ role: "super_admin", displayName: "x", userId: customer.id }).expect(403);
    });

    it("never lets a provider touch another provider's data", async () => {
      const intruder = newUser("customer", "Intruder");
      await post("/provider/profile", intruder, { displayName: "Intruder Two" }).expect(201);
      const Booking = app.get(getModelToken("ProviderBooking"));
      const someBooking: any = await Booking.findOne({ providerId: panditId }).lean();
      expect((await post(`/bookings/${someBooking._id}/transitions`, intruder, { command: "accept" })).status).toBe(404);
      expect((await get(`/bookings/${someBooking._id}`, intruder)).status).toBe(404);
      expect((await get("/bookings?role=provider", intruder).expect(200)).body.data).toHaveLength(0);
      expect((await patch(`/provider/offerings/${offeringId}`, intruder, { baseProfessionalFeeMinor: 1 })).status).toBe(404);
      expect((await get(`/provider/calendar-blocks`, intruder).expect(200)).body.data).toHaveLength(0);
    });
  });

  describe("pandit wallet: earnings, 72-hour hold and withdrawals", () => {
    const finance = newUser("finance_manager", "Finance Desk");
    const Booking = () => app.get(getModelToken("ProviderBooking"));
    const Entry = () => app.get(getModelToken("ProviderWalletEntry"));
    const bookBody = (start: string) => ({
      offeringId, scheduledStartAt: start, customerName: "Wallet Devotee", customerPhone: "9876500020",
      serviceLocation: { city: "Haridwar", state: "Uttarakhand" },
    });
    const paidBooking = async (daysAhead: number, buyer = newUser("customer", "Wallet Devotee")) => {
      const res = await post("/bookings", buyer, bookBody(slot(daysAhead))).expect(201);
      await app.get(ProviderBookingService).confirmPayment(res.body.data.id, `pay_wallet_${daysAhead}`);
      return { buyer, id: res.body.data.id as string };
    };
    const wallet = async () => (await get("/provider/wallet", panditUser).expect(200)).body.data;
    /** Pretend the 72 hours have passed for this booking's earning. */
    const passHold = (bookingId: string) =>
      Entry().updateOne({ bookingId, type: "EARNING" }, { $set: { availableAt: new Date(Date.now() - 1000) } });

    it("credits a paid booking as pending for 72 hours, not withdrawable yet", async () => {
      const before = await wallet();
      const { id } = await paidBooking(70);
      const after = await wallet();
      expect(after.pendingMinor - before.pendingMinor).toBe(300000);
      expect(after.availableMinor).toBe(before.availableMinor);
      const entry: any = await Entry().findOne({ bookingId: id, type: "EARNING" }).lean();
      expect(entry).toMatchObject({ status: "PENDING", amountMinor: 300000, grossMinor: 300000, paymentMethod: "RAZORPAY" });
      const holdMs = new Date(entry.availableAt).getTime() - new Date(entry.createdAt).getTime();
      expect(Math.round(holdMs / 3_600_000)).toBe(72);
      expect(after.rules.holdHours).toBe(72);
      expect(ctx.notifications.some((n) => n.kind === "provider.wallet.earning" && n.userIds.includes(panditUser.id))).toBe(true);
      // Confirming the same payment again never credits twice.
      await expect(app.get(ProviderBookingService).confirmPayment(id, "pay_wallet_70")).rejects.toMatchObject({ status: 409 });
      expect(await Entry().countDocuments({ bookingId: id, type: "EARNING" })).toBe(1);
    });

    it("releases the earning to the available balance once the hold has passed", async () => {
      const { id } = await paidBooking(71);
      const before = await wallet();
      await passHold(id);
      const after = await wallet();
      expect(after.availableMinor - before.availableMinor).toBe(300000);
      expect(before.pendingMinor - after.pendingMinor).toBe(300000);
      expect(((await Entry().findOne({ bookingId: id, type: "EARNING" }).lean()) as any).status).toBe("AVAILABLE");
    });

    it("stores the payout account encrypted and only ever shows it masked", async () => {
      const badIfsc = await put("/provider/wallet/payout-account", panditUser, {
        method: "BANK", accountHolderName: "Ramesh Sharma", accountNumber: "123456789012", ifsc: "BADIFSC0000",
      }).expect(400);
      expect(badIfsc.body.code).toBe("INVALID_IFSC");
      const saved = await put("/provider/wallet/payout-account", panditUser, {
        method: "BANK", accountHolderName: "Ramesh Sharma", accountNumber: "123456789012", ifsc: "SBIN0001234", bankName: "SBI",
      }).expect(200);
      expect(saved.body.data).toMatchObject({ method: "BANK", accountNumberLast4: "9012", ifsc: "SBIN0001234" });
      expect(JSON.stringify(saved.body)).not.toContain("123456789012");
      expect(JSON.stringify((await get("/provider/wallet", panditUser).expect(200)).body)).not.toContain("123456789012");
    });

    it("withdraws only what is available, and finance pays it with a reference", async () => {
      const before = await wallet();
      const tooMuch = await post("/provider/wallet/withdrawals", panditUser, { amountMinor: before.availableMinor + 100 }).expect(409);
      expect(tooMuch.body.code).toBe("INSUFFICIENT_BALANCE");
      const tooSmall = await post("/provider/wallet/withdrawals", panditUser, { amountMinor: 50 }).expect(400);
      expect(tooSmall.body.code).toBe("WITHDRAWAL_TOO_SMALL");

      const req = await post("/provider/wallet/withdrawals", panditUser, { amountMinor: 100000 }).expect(201);
      expect(req.body.data).toMatchObject({ status: "REQUESTED", amountMinor: 100000 });
      expect(req.body.data.destination.label).toContain("9012");
      const mid = await wallet();
      expect(before.availableMinor - mid.availableMinor).toBe(100000);
      expect(mid.withdrawingMinor - before.withdrawingMinor).toBe(100000);

      // Only finance roles run the queue.
      await get("/admin/provider-wallets/withdrawals", panditUser).expect(403);
      const queue = await get("/admin/provider-wallets/withdrawals?status=REQUESTED", finance).expect(200);
      expect(queue.body.data.find((w: any) => w.id === req.body.data.id).provider.displayName).toBe("Pt Ramesh Sharma");
      const dest = await post(`/admin/provider-wallets/withdrawals/${req.body.data.id}/destination`, finance).expect(201);
      expect(dest.body.data).toMatchObject({ accountNumber: "123456789012", ifsc: "SBIN0001234" });

      await post(`/admin/provider-wallets/withdrawals/${req.body.data.id}:mark-paid`, finance, {}).expect(400);
      const paid = await post(`/admin/provider-wallets/withdrawals/${req.body.data.id}:mark-paid`, finance, { payoutReference: "UTR123456789" }).expect(201);
      expect(paid.body.data).toMatchObject({ status: "PAID", payoutReference: "UTR123456789" });
      const after = await wallet();
      expect(after.withdrawingMinor).toBe(before.withdrawingMinor);
      expect(after.lifetimeWithdrawnMinor - before.lifetimeWithdrawnMinor).toBe(100000);
      // Paying twice is refused.
      const again = await post(`/admin/provider-wallets/withdrawals/${req.body.data.id}:mark-paid`, finance, { payoutReference: "UTR999999" }).expect(409);
      expect(again.body.code).toBe("WITHDRAWAL_STATE_CONFLICT");
    });

    it("returns the money when a withdrawal is cancelled or rejected", async () => {
      const before = await wallet();
      const a = await post("/provider/wallet/withdrawals", panditUser, { amountMinor: 20000 }).expect(201);
      await post(`/provider/wallet/withdrawals/${a.body.data.id}:cancel`, panditUser).expect(201);
      const b = await post("/provider/wallet/withdrawals", panditUser, { amountMinor: 30000 }).expect(201);
      await post(`/admin/provider-wallets/withdrawals/${b.body.data.id}:reject`, finance, { reason: "Account name mismatch" }).expect(201);
      const after = await wallet();
      expect(after.availableMinor).toBe(before.availableMinor);
      expect(after.withdrawingMinor).toBe(before.withdrawingMinor);
      // Another provider cannot cancel this pandit's withdrawal.
      const c = await post("/provider/wallet/withdrawals", panditUser, { amountMinor: 10000 }).expect(201);
      expect((await post(`/provider/wallet/withdrawals/${c.body.data.id}:cancel`, jyotishUser)).status).toBe(404);
      await post(`/provider/wallet/withdrawals/${c.body.data.id}:cancel`, panditUser).expect(201);
    });

    it("voids a pending earning when the paid booking is cancelled and refunded", async () => {
      const before = await wallet();
      const { id } = await paidBooking(72);
      await post(`/bookings/${id}:cancel`, panditUser, { reasonCode: "UNAVAILABLE" }).expect(201);
      const after = await wallet();
      expect(after.pendingMinor).toBe(before.pendingMinor);
      expect(after.lifetimeEarnedMinor).toBe(before.lifetimeEarnedMinor);
      expect(((await Entry().findOne({ bookingId: id, type: "EARNING" }).lean()) as any).status).toBe("REVERSED");
    });

    it("takes back a released earning, carrying any shortfall as recovery from the next earnings", async () => {
      const { id } = await paidBooking(73);
      await passHold(id);
      const start = await wallet();
      // Withdraw everything, then the booking is cancelled: nothing is left to take back.
      const all = await post("/provider/wallet/withdrawals", panditUser, { amountMinor: start.availableMinor }).expect(201);
      await post(`/bookings/${id}:cancel`, panditUser, { reasonCode: "UNAVAILABLE" }).expect(201);
      const owed = await wallet();
      expect(owed.availableMinor).toBe(0);
      expect(owed.recoveryDueMinor - start.recoveryDueMinor).toBe(300000);
      // The next released earning settles the recovery first.
      const next = await paidBooking(74);
      await passHold(next.id);
      const settled = await wallet();
      expect(settled.recoveryDueMinor).toBe(start.recoveryDueMinor);
      expect(settled.availableMinor).toBe(0);
      await post(`/provider/wallet/withdrawals/${all.body.data.id}:cancel`, panditUser).expect(201);
      expect(((await Booking().findById(id).lean()) as any).status).toBe("CANCELLED_BY_PROVIDER");
    });

    it("sweeps due releases in the background", async () => {
      const { id } = await paidBooking(75);
      await passHold(id);
      const released = await app.get(ProviderWalletService).releaseDue();
      expect(released).toBeGreaterThanOrEqual(1);
      expect(((await Entry().findOne({ bookingId: id, type: "EARNING" }).lean()) as any).status).toBe("AVAILABLE");
    });

    it("gives finance a platform-wide overview", async () => {
      await get("/admin/provider-wallets/overview", panditUser).expect(403);
      const res = await get("/admin/provider-wallets/overview", finance).expect(200);
      expect(res.body.data.wallets).toBeGreaterThanOrEqual(1);
      expect(res.body.data.paidOutMinor).toBeGreaterThanOrEqual(100000);
    });
  });

});
