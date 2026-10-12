/**
 * DEVELOPMENT-ONLY sample data for the providers module.
 *
 * This is the only place demo providers come from. Nothing in the services
 * reads or falls back to it. Everything it writes is marked `isDevFixture`, and
 * the services hide such records from every public read unless the process is
 * not production AND PROVIDERS_ALLOW_DEV_FIXTURES=true, so even a fixture that
 * somehow reached a production database cannot be presented as a real
 * provider. `removeDevFixtures` deletes all of it again.
 *
 * Run through `npm run providers:seed-dev` (see src/scripts/seed-provider-dev.ts),
 * which adds the interactive guards (explicit flags, database host check).
 */
import { Types, type Model } from "mongoose";
import { weeklyRrule } from "../domain/availability.util";
import { DAYS_OF_WEEK } from "../domain/provider.constants";
import { slugify } from "../../../common/slug/slug.util";

export interface FixtureModels {
  User: Model<any>;
  ProviderRitual: Model<any>;
  ProviderRitualVariant: Model<any>;
  ProviderProfile: Model<any>;
  ProviderPrivateProfile: Model<any>;
  ProviderOffering: Model<any>;
  ProviderAvailabilityRule: Model<any>;
  ProviderCalendarBlock: Model<any>;
  ProviderBooking: Model<any>;
  ProviderBookingStateHistory: Model<any>;
  ProviderConsultation: Model<any>;
  ProviderVerificationCase: Model<any>;
  ProviderVerificationEvidence: Model<any>;
}

export const DEV_EMAIL_DOMAIN = "dev-fixture.test";
export const DEV_NAME_SUFFIX = "[DEV FIXTURE]";

export function assertDevEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production")
    throw new Error("Refusing to create development fixtures with NODE_ENV=production");
  if (env.PROVIDERS_ALLOW_DEV_FIXTURES !== "true")
    throw new Error(
      "Set PROVIDERS_ALLOW_DEV_FIXTURES=true to confirm this is a development environment",
    );
}

interface FixtureProvider {
  key: string;
  displayName: string;
  providerType: "PANDIT" | "ACHARYA" | "JYOTISHI";
  homeCity: string;
  homeState: string;
  languages: string[];
  levels: Array<"IDENTITY" | "PROFESSIONAL">;
  offerings: Array<{
    fulfilmentType: "LOCAL_HOME" | "AT_DESTINATION" | "ON_BEHALF";
    feeMinor: number;
    durationMinutes: number;
    destination?: { city: string; state: string };
  }>;
  consultation?: { feeMinor: number; slotMinutes: number; channels: string[] };
}

const PROVIDERS: FixtureProvider[] = [
  {
    key: "sharma",
    displayName: `Pt. Dev Sharma ${DEV_NAME_SUFFIX}`,
    providerType: "PANDIT",
    homeCity: "Haridwar",
    homeState: "Uttarakhand",
    languages: ["Hindi", "Sanskrit"],
    levels: ["IDENTITY"],
    offerings: [{ fulfilmentType: "LOCAL_HOME", feeMinor: 210000, durationMinutes: 90 }],
    consultation: { feeMinor: 50000, slotMinutes: 30, channels: ["VIDEO", "PHONE"] },
  },
  {
    key: "mishra",
    displayName: `Acharya Dev Mishra ${DEV_NAME_SUFFIX}`,
    providerType: "ACHARYA",
    homeCity: "Varanasi",
    homeState: "Uttar Pradesh",
    languages: ["Hindi", "Sanskrit", "English"],
    levels: ["IDENTITY", "PROFESSIONAL"],
    offerings: [
      { fulfilmentType: "AT_DESTINATION", feeMinor: 510000, durationMinutes: 120, destination: { city: "Varanasi", state: "Uttar Pradesh" } },
      { fulfilmentType: "ON_BEHALF", feeMinor: 310000, durationMinutes: 90 },
    ],
  },
  {
    key: "joshi",
    displayName: `Jyotishi Dev Joshi ${DEV_NAME_SUFFIX}`,
    providerType: "JYOTISHI",
    homeCity: "Ujjain",
    homeState: "Madhya Pradesh",
    languages: ["Hindi"],
    levels: ["IDENTITY"],
    offerings: [],
    consultation: { feeMinor: 110000, slotMinutes: 45, channels: ["VIDEO"] },
  },
];

export interface SeedSummary {
  users: number;
  rituals: number;
  providers: number;
  offerings: number;
  loginEmails: string[];
}

/** Idempotent: running it twice leaves one set of fixtures. */
export async function seedDevFixtures(
  models: FixtureModels,
  options: { passwordHash: string; env?: NodeJS.ProcessEnv },
): Promise<SeedSummary> {
  assertDevEnvironment(options.env);
  const now = new Date();
  const summary: SeedSummary = { users: 0, rituals: 0, providers: 0, offerings: 0, loginEmails: [] };

  // ---- catalogue: one published ritual with one variant
  const ritualContent = {
    titles: { en: "Rudrabhishek (dev fixture)" },
    summary: { en: "Sample ritual used only in development." },
    category: "Shiva",
    aliases: [],
    applicableFulfilmentTypes: ["LOCAL_HOME", "AT_DESTINATION", "ON_BEHALF"],
    defaultDurationMinutes: 90,
    version: 1,
  };
  let ritual: any = await models.ProviderRitual.findOne({ slug: "dev-fixture-rudrabhishek" });
  if (!ritual) {
    ritual = await models.ProviderRitual.create({
      slug: "dev-fixture-rudrabhishek",
      ...ritualContent,
      status: "PUBLISHED",
      contentVersion: 1,
      publishedContent: ritualContent,
      publishedAt: now,
      searchText: "rudrabhishek (dev fixture) shiva",
      isListed: true,
      isDevFixture: true,
    });
    summary.rituals += 1;
  }
  let variant: any = await models.ProviderRitualVariant.findOne({ ritualId: ritual._id, code: "standard" });
  if (!variant)
    variant = await models.ProviderRitualVariant.create({
      ritualId: ritual._id,
      code: "standard",
      titles: { en: "Standard" },
      scope: { inclusions: ["Sankalp", "Abhishek"], durationBand: { minMinutes: 60, maxMinutes: 150 } },
      status: "ACTIVE",
    });

  // ---- providers
  for (const spec of PROVIDERS) {
    const email = `dev-provider-${spec.key}@${DEV_EMAIL_DOMAIN}`;
    summary.loginEmails.push(email);
    let user: any = await models.User.findOne({ email });
    if (!user) {
      user = await models.User.create({
        name: spec.displayName.replace(` ${DEV_NAME_SUFFIX}`, ""),
        email,
        phone: `90000${String(summary.loginEmails.length).padStart(5, "0")}`,
        passwordHash: options.passwordHash,
        role: "pandit_provider",
        status: "active",
      });
      summary.users += 1;
    }
    if (await models.ProviderProfile.exists({ userId: user._id })) continue;

    const verification: Record<string, unknown> = {};
    for (const level of spec.levels)
      verification[level] = { caseId: new Types.ObjectId(), approvedAt: now, validUntil: new Date(now.getTime() + 365 * 86_400_000) };
    const rank = spec.levels.includes("PROFESSIONAL") ? 2 : 1;
    const profile: any = await models.ProviderProfile.create({
      userId: user._id,
      slug: `${slugify(spec.displayName.replace(DEV_NAME_SUFFIX, ""))}-dev`,
      providerType: spec.providerType,
      displayName: spec.displayName,
      bio: "Development fixture. Not a real provider.",
      languages: spec.languages,
      specializations: ["Rudrabhishek"],
      homeCity: spec.homeCity,
      homeState: spec.homeState,
      serviceAreas: [{ city: spec.homeCity, state: spec.homeState }],
      serviceCities: [spec.homeCity.toLowerCase()],
      travelProfile: { willingToTravel: true, overnightOk: true, modes: ["TRAIN"] },
      consultation: spec.consultation ? { enabled: true, currency: "INR", ...spec.consultation } : { enabled: false },
      verification,
      verificationLevel: rank === 2 ? "PROFESSIONAL_VERIFIED" : "IDENTITY_VERIFIED",
      verificationRank: rank,
      identityVerifiedUntil: new Date(now.getTime() + 365 * 86_400_000),
      status: "ACTIVE",
      isDevFixture: true,
    });
    await models.ProviderPrivateProfile.create({
      providerId: profile._id,
      legalName: user.name,
      email,
    });
    await models.ProviderAvailabilityRule.insertMany(
      DAYS_OF_WEEK.map((day) => ({
        resourceType: "PROVIDER",
        resourceId: profile._id,
        timezone: "Asia/Kolkata",
        rrule: weeklyRrule(day),
        window: { startTime: "08:00", endTime: "18:00" },
        status: "ACTIVE",
      })),
    );
    for (const offering of spec.offerings) {
      await models.ProviderOffering.create({
        providerId: profile._id,
        ritualId: ritual._id,
        ritualVariantId: variant._id,
        fulfilmentType: offering.fulfilmentType,
        destination: offering.destination ?? null,
        durationMinutes: offering.durationMinutes,
        teamSize: 1,
        minNoticeHours: 24,
        baseProfessionalFeeMinor: offering.feeMinor,
        currency: "INR",
        travelCharge: { policy: "NONE" },
        inclusions: ["Sankalp", "Abhishek"],
        status: "ACTIVE",
      });
      summary.offerings += 1;
    }
    // The search read-model is derived data; fill it the same way the services do.
    await models.ProviderProfile.updateOne(
      { _id: profile._id },
      {
        $set: {
          ritualIds: spec.offerings.length ? [ritual._id] : [],
          ritualVariantIds: spec.offerings.length ? [variant._id] : [],
          fulfilmentTypes: [...new Set(spec.offerings.map((o) => o.fulfilmentType))],
          minFeeMinor: spec.offerings.length ? Math.min(...spec.offerings.map((o) => o.feeMinor)) : null,
          maxFeeMinor: spec.offerings.length ? Math.max(...spec.offerings.map((o) => o.feeMinor)) : null,
          activeOfferingCount: spec.offerings.length,
          availableWeekdays: [...DAYS_OF_WEEK],
          isPubliclyListed: true,
        },
      },
    );
    summary.providers += 1;
  }
  return summary;
}

/** Deletes every fixture and everything that hangs off one. Never touches a record without the marker. */
export async function removeDevFixtures(
  models: FixtureModels,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ providers: number; rituals: number; users: number }> {
  assertDevEnvironment(env);
  const providers: any[] = await models.ProviderProfile.find({ isDevFixture: true }).select("_id userId").lean();
  const providerIds = providers.map((p) => p._id);
  if (providerIds.length) {
    const byProvider = { providerId: { $in: providerIds } };
    const bookings: any[] = await models.ProviderBooking.find(byProvider).select("_id").lean();
    await models.ProviderBookingStateHistory.deleteMany({ bookingId: { $in: bookings.map((b) => b._id) } });
    await models.ProviderBooking.deleteMany(byProvider);
    await models.ProviderConsultation.deleteMany({ expertProviderId: { $in: providerIds } });
    await models.ProviderCalendarBlock.deleteMany({ resourceId: { $in: providerIds } });
    await models.ProviderAvailabilityRule.deleteMany({ resourceId: { $in: providerIds } });
    await models.ProviderOffering.deleteMany(byProvider);
    await models.ProviderVerificationEvidence.deleteMany(byProvider);
    await models.ProviderVerificationCase.deleteMany(byProvider);
    await models.ProviderPrivateProfile.deleteMany(byProvider);
    await models.ProviderProfile.deleteMany({ _id: { $in: providerIds } });
  }
  const rituals: any[] = await models.ProviderRitual.find({ isDevFixture: true }).select("_id").lean();
  if (rituals.length) {
    await models.ProviderRitualVariant.deleteMany({ ritualId: { $in: rituals.map((r) => r._id) } });
    await models.ProviderRitual.deleteMany({ _id: { $in: rituals.map((r) => r._id) } });
  }
  const users = await models.User.deleteMany({
    email: { $regex: `@${DEV_EMAIL_DOMAIN.replace(/\./g, "\\.")}$` },
  });
  return { providers: providerIds.length, rituals: rituals.length, users: users.deletedCount ?? 0 };
}
