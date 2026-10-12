/**
 * Who may see a provider, and what each audience may see. Everything here is
 * pure so the rules that protect private data are unit tested directly.
 */
import { PLATFORM_FEE_LABEL, platformFeeMinor, providerPlatformFeeBps } from "./platform-fee";
import {
  LEVEL_BY_CASE_TYPE,
  VERIFICATION_CASE_TYPES,
  VERIFICATION_RANK,
  type VerificationCaseType,
  type VerificationLevel,
} from "./provider.constants";

export interface VerificationEntry {
  caseId?: unknown;
  approvedAt?: Date | string | null;
  validUntil?: Date | string | null;
}
export type VerificationMap = Partial<Record<VerificationCaseType, VerificationEntry>>;

const asDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isEntryValid = (
  entry: VerificationEntry | undefined,
  now: Date,
): boolean => {
  if (!entry || !entry.approvedAt) return false;
  const until = asDate(entry.validUntil);
  return until === null || until > now;
};

export interface DerivedVerification {
  level: VerificationLevel;
  rank: number;
  identityVerifiedUntil: Date | null;
}

/**
 * Level is the highest valid verification. A level above IDENTITY never stands
 * without a valid identity check: when identity lapses, everything lapses.
 */
export const deriveVerification = (
  map: VerificationMap | undefined,
  now = new Date(),
): DerivedVerification => {
  const entries = map ?? {};
  const identity = entries.IDENTITY;
  if (!isEntryValid(identity, now))
    return { level: "UNVERIFIED", rank: 0, identityVerifiedUntil: null };
  let level: VerificationLevel = "IDENTITY_VERIFIED";
  for (const type of VERIFICATION_CASE_TYPES) {
    const candidate = LEVEL_BY_CASE_TYPE[type];
    if (isEntryValid(entries[type], now) && VERIFICATION_RANK[candidate] > VERIFICATION_RANK[level])
      level = candidate;
  }
  return {
    level,
    rank: VERIFICATION_RANK[level],
    identityVerifiedUntil: asDate(identity?.validUntil),
  };
};

export interface ListingInput {
  status?: string;
  verificationRank?: number;
  identityVerifiedUntil?: Date | null;
  activeOfferingCount?: number;
  consultation?: { enabled?: boolean } | null;
  isDevFixture?: boolean;
  deletedAt?: Date | null;
}

export type ListingBlocker =
  | "STATUS_NOT_ACTIVE"
  | "IDENTITY_NOT_VERIFIED"
  | "VERIFICATION_EXPIRED"
  | "NOTHING_TO_OFFER"
  | "DEV_FIXTURE_HIDDEN"
  | "DELETED";

/** Reasons a provider is not publicly listed; empty means listed (BR-002). */
export const listingBlockers = (
  profile: ListingInput,
  options: { now?: Date; allowDevFixtures?: boolean } = {},
): ListingBlocker[] => {
  const now = options.now ?? new Date();
  const blockers: ListingBlocker[] = [];
  if (profile.deletedAt) blockers.push("DELETED");
  if (profile.status !== "ACTIVE") blockers.push("STATUS_NOT_ACTIVE");
  if (!profile.verificationRank || profile.verificationRank < 1)
    blockers.push("IDENTITY_NOT_VERIFIED");
  else if (profile.identityVerifiedUntil && profile.identityVerifiedUntil <= now)
    blockers.push("VERIFICATION_EXPIRED");
  if (!profile.activeOfferingCount && !profile.consultation?.enabled)
    blockers.push("NOTHING_TO_OFFER");
  if (profile.isDevFixture && !options.allowDevFixtures)
    blockers.push("DEV_FIXTURE_HIDDEN");
  return blockers;
};

export const isPubliclyListable = (
  profile: ListingInput,
  options: { now?: Date; allowDevFixtures?: boolean } = {},
): boolean => listingBlockers(profile, options).length === 0;

// ------------------------------------------------------------------ views
const idOf = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);

export const maskPhone = (phone?: string | null): string | null => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `${"*".repeat(Math.max(digits.length - 4, 2))}${digits.slice(-4)}`;
};

/** Verified badges for display: what was verified and since when; never evidence or case ids. */
export const verifiedBadges = (
  map: VerificationMap | undefined,
  now = new Date(),
): Array<{ type: VerificationCaseType; level: VerificationLevel; since: Date | null }> =>
  VERIFICATION_CASE_TYPES.filter((type) => isEntryValid(map?.[type], now)).map(
    (type) => ({
      type,
      level: LEVEL_BY_CASE_TYPE[type],
      since: asDate(map?.[type]?.approvedAt),
    }),
  );

/**
 * Public profile (anyone, including search engines). Deliberately an
 * allow-list: userId, contact details, KYC, status internals, calendar and
 * financial data are not read here at all.
 */
export const toPublicProvider = (profile: any, now = new Date()) => ({
  id: idOf(profile._id ?? profile.id),
  slug: profile.slug,
  providerType: profile.providerType,
  displayName: profile.displayName,
  bio: profile.bio ?? null,
  avatarUrl: profile.avatarUrl ?? null,
  languages: profile.languages ?? [],
  traditions: profile.traditions ?? [],
  specializations: profile.specializations ?? [],
  experienceYears: profile.experienceYears ?? null,
  homeCity: profile.homeCity ?? null,
  homeState: profile.homeState ?? null,
  serviceCities: (profile.serviceAreas ?? []).map((area: any) => ({
    city: area.city,
    state: area.state ?? null,
  })),
  travel: {
    willingToTravel: Boolean(profile.travelProfile?.willingToTravel),
    overnightOk: Boolean(profile.travelProfile?.overnightOk),
    modes: profile.travelProfile?.modes ?? [],
    maxDistanceKm: profile.travelProfile?.maxDistanceKm ?? null,
    stayArrangement: profile.travelProfile?.stayArrangement ?? null,
    notes: profile.travelProfile?.notes ?? null,
  },
  /** Pandit has switched on live online katha / puja. */
  liveOnline: Boolean(profile.liveOnline?.enabled),
  /** Their YouTube live page, shown only while live online is on. */
  liveYoutubeUrl: profile.liveOnline?.enabled ? profile.liveOnline?.youtubeUrl ?? null : null,
  verificationLevel: profile.verificationLevel,
  verifiedBadges: verifiedBadges(profile.verification, now),
  consultation: profile.consultation?.enabled
    ? {
        enabled: true,
        feeMinor: profile.consultation.feeMinor ?? null,
        currency: profile.consultation.currency ?? "INR",
        slotMinutes: profile.consultation.slotMinutes ?? null,
        channels: profile.consultation.channels ?? [],
      }
    : { enabled: false },
  availableWeekdays: profile.availableWeekdays ?? [],
  acceptingBookings: (profile.activeOfferingCount ?? 0) > 0,
  offerings: {
    count: profile.activeOfferingCount ?? 0,
    minFeeMinor: profile.minFeeMinor ?? null,
    maxFeeMinor: profile.maxFeeMinor ?? null,
    currency: profile.feeCurrency ?? "INR",
  },
});

/** Public offering. The fee is the provider's indicative professional fee; the payable total comes from the booking. */
export const toPublicOffering = (offering: any, catalogue?: { ritual?: any; variant?: any }) => {
  const feeBps = providerPlatformFeeBps();
  const fee = platformFeeMinor(offering.baseProfessionalFeeMinor, feeBps);
  return {
  id: idOf(offering._id ?? offering.id),
  providerId: idOf(offering.providerId),
  ritualId: idOf(offering.ritualId),
  ritualVariantId: idOf(offering.ritualVariantId),
  ritual: catalogue?.ritual ?? null,
  variant: catalogue?.variant ?? null,
  fulfilmentType: offering.fulfilmentType,
  title: offering.title ?? null,
  description: offering.description ?? null,
  destination: offering.destination ?? null,
  durationMinutes: offering.durationMinutes,
  teamSize: offering.teamSize,
  minNoticeHours: offering.minNoticeHours,
  indicativeFee: {
    amountMinor: offering.baseProfessionalFeeMinor,
    currency: offering.currency,
  },
  /** Tirvona's fee on top of the professional fee, and what the devotee pays before any travel charge. */
  platformFee: { rateBps: feeBps, percent: feeBps / 100, amountMinor: fee, label: PLATFORM_FEE_LABEL },
  devoteePriceMinor: offering.baseProfessionalFeeMinor + fee,
  travelCharge: offering.travelCharge ?? { policy: "NONE" },
  inclusions: offering.inclusions ?? [],
  exclusions: offering.exclusions ?? [],
  samagriIncluded: Boolean(offering.samagriIncluded),
  voluntaryDakshinaAllowed: Boolean(offering.voluntaryDakshinaAllowed),
  tags: offering.tags ?? [],
  };
};

/** Share of the onboarding checklist done, so clients stop inventing a number. */
export const profileCompletion = (
  profile: any,
  facts: { hasOffering: boolean; hasAvailability: boolean },
): { percent: number; missing: string[] } => {
  const checks: Array<[string, boolean]> = [
    ["displayName", Boolean(profile.displayName)],
    ["bio", Boolean(profile.bio && profile.bio.length >= 30)],
    ["avatar", Boolean(profile.avatarUrl)],
    ["languages", (profile.languages ?? []).length > 0],
    ["specializations", (profile.specializations ?? []).length > 0],
    ["location", Boolean(profile.homeCity)],
    ["offering", facts.hasOffering],
    ["availability", facts.hasAvailability],
    ["identityVerification", (profile.verificationRank ?? 0) >= 1],
  ];
  const missing = checks.filter(([, done]) => !done).map(([name]) => name);
  return {
    percent: Math.round(((checks.length - missing.length) / checks.length) * 100),
    missing,
  };
};
