/// <reference types="jest" />
/**
 * The development fixtures must be impossible to mistake for real providers:
 * they refuse to be created in production, are invisible to the public API
 * unless explicitly allowed outside production, and are removable without
 * touching anything else.
 */
import type { INestApplication } from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import request from "supertest";
import {
  assertDevEnvironment,
  removeDevFixtures,
  seedDevFixtures,
  type FixtureModels,
} from "./dev/dev-fixtures";
import { as, createProviderTestApp, idemKey, newUser, type ProviderTestApp } from "./testing/provider-test-app";

const V2 = "/api/v2";
const DEV_ENV = { NODE_ENV: "development", PROVIDERS_ALLOW_DEV_FIXTURES: "true" } as NodeJS.ProcessEnv;

describe("development fixtures (real Postgres)", () => {
  let ctx: ProviderTestApp;
  let app: INestApplication;
  let models: FixtureModels;
  const saved = { NODE_ENV: process.env.NODE_ENV, flag: process.env.PROVIDERS_ALLOW_DEV_FIXTURES };
  const http = () => request(app.getHttpServer());
  const setEnv = (nodeEnv: string | undefined, flag: string | undefined) => {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    if (flag === undefined) delete process.env.PROVIDERS_ALLOW_DEV_FIXTURES;
    else process.env.PROVIDERS_ALLOW_DEV_FIXTURES = flag;
  };

  beforeAll(async () => {
    ctx = await createProviderTestApp();
    app = ctx.app;
    const m = (name: string) => app.get(getModelToken(name));
    models = {
      User: m("User"), ProviderRitual: m("ProviderRitual"), ProviderRitualVariant: m("ProviderRitualVariant"),
      ProviderProfile: m("ProviderProfile"), ProviderPrivateProfile: m("ProviderPrivateProfile"),
      ProviderOffering: m("ProviderOffering"), ProviderAvailabilityRule: m("ProviderAvailabilityRule"),
      ProviderCalendarBlock: m("ProviderCalendarBlock"), ProviderBooking: m("ProviderBooking"),
      ProviderBookingStateHistory: m("ProviderBookingStateHistory"), ProviderConsultation: m("ProviderConsultation"),
      ProviderVerificationCase: m("ProviderVerificationCase"), ProviderVerificationEvidence: m("ProviderVerificationEvidence"),
    };
  });
  afterAll(async () => {
    setEnv(saved.NODE_ENV, saved.flag);
    await ctx?.close();
  });
  afterEach(() => setEnv(saved.NODE_ENV, saved.flag));

  it("refuses to run in production or without the explicit development flag", async () => {
    expect(() => assertDevEnvironment({ NODE_ENV: "production", PROVIDERS_ALLOW_DEV_FIXTURES: "true" } as NodeJS.ProcessEnv)).toThrow(/production/);
    expect(() => assertDevEnvironment({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toThrow(/PROVIDERS_ALLOW_DEV_FIXTURES/);
    expect(() => assertDevEnvironment(DEV_ENV)).not.toThrow();
    await expect(seedDevFixtures(models, { passwordHash: "x", env: { NODE_ENV: "production", PROVIDERS_ALLOW_DEV_FIXTURES: "true" } as NodeJS.ProcessEnv })).rejects.toThrow(/production/);
    await expect(removeDevFixtures(models, { NODE_ENV: "production" } as NodeJS.ProcessEnv)).rejects.toThrow(/production/);
    expect(await models.ProviderProfile.countDocuments({})).toBe(0);
  });

  it("creates marked sample data and is safe to run twice", async () => {
    const first = await seedDevFixtures(models, { passwordHash: "hash", env: DEV_ENV });
    expect(first).toMatchObject({ providers: 3, offerings: 3, rituals: 1, users: 3 });
    const again = await seedDevFixtures(models, { passwordHash: "hash", env: DEV_ENV });
    expect(again).toMatchObject({ providers: 0, offerings: 0, rituals: 0, users: 0 });
    expect(await models.ProviderProfile.countDocuments({ isDevFixture: true })).toBe(3);
    expect(await models.ProviderProfile.countDocuments({ isDevFixture: { $ne: true } })).toBe(0);
    const names = (await models.ProviderProfile.find({}).lean()).map((p: any) => p.displayName);
    for (const name of names) expect(name).toContain("[DEV FIXTURE]");
  });

  it("hides every fixture from the public API by default", async () => {
    setEnv("development", undefined);
    expect((await http().get(`${V2}/providers`).expect(200)).body.data).toHaveLength(0);
    expect((await http().get(`${V2}/rituals`).expect(200)).body.data).toHaveLength(0);
    const profile: any = await models.ProviderProfile.findOne({}).lean();
    await http().get(`${V2}/providers/${profile._id}`).expect(404);
    await http().get(`${V2}/providers/${profile.slug}/offerings`).expect(404);
    await http().get(`${V2}/rituals/dev-fixture-rudrabhishek`).expect(404);
  });

  it("shows them in development only when explicitly allowed", async () => {
    setEnv("development", "true");
    const list = (await http().get(`${V2}/providers`).expect(200)).body.data;
    expect(list).toHaveLength(3);
    expect(list.map((p: any) => p.verificationLevel).sort()).toEqual(["IDENTITY_VERIFIED", "IDENTITY_VERIFIED", "PROFESSIONAL_VERIFIED"]);
    expect((await http().get(`${V2}/rituals`).expect(200)).body.data).toHaveLength(1);
    const found = (await http().get(`${V2}/providers?ritual=dev-fixture-rudrabhishek&city=varanasi`).expect(200)).body.data;
    expect(found).toHaveLength(1);
  });

  it("never shows them in production, even if the development flag is left on", async () => {
    setEnv("production", "true");
    expect((await http().get(`${V2}/providers`).expect(200)).body.data).toHaveLength(0);
    expect((await http().get(`${V2}/rituals`).expect(200)).body.data).toHaveLength(0);
    const profile: any = await models.ProviderProfile.findOne({}).lean();
    await http().get(`${V2}/providers/${profile._id}`).expect(404);
    // Nor can a customer book one.
    const offering: any = await models.ProviderOffering.findOne({}).lean();
    const user = newUser();
    await http().post(`${V2}/bookings`).set(as(user)).set("Idempotency-Key", idemKey()).send({
      offeringId: String(offering._id),
      scheduledStartAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      customerName: "Buyer", customerPhone: "9876500009",
      serviceLocation: { city: "Haridwar", state: "Uttarakhand" },
    }).expect(422); // the offering is not sellable: its ritual is a hidden fixture
  });

  it("removes only the fixtures", async () => {
    // A real provider created through the API must survive the clean-up.
    setEnv("development", undefined);
    const real = newUser("customer", "Real Provider");
    await http().post(`${V2}/provider/profile`).set(as(real)).set("Idempotency-Key", idemKey()).send({ displayName: "Real Provider" }).expect(201);
    const removed = await removeDevFixtures(models, DEV_ENV);
    expect(removed).toEqual({ providers: 3, rituals: 1, users: 3 });
    expect(await models.ProviderProfile.countDocuments({})).toBe(1);
    expect(await models.ProviderOffering.countDocuments({})).toBe(0);
    expect(await models.ProviderAvailabilityRule.countDocuments({})).toBe(0);
    expect(await models.ProviderRitual.countDocuments({})).toBe(0);
    expect(await models.User.countDocuments({})).toBe(0);
    expect(((await models.ProviderProfile.findOne({}).lean()) as any).displayName).toBe("Real Provider");
  });
});
