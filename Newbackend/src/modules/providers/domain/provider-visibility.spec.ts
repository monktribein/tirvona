import {
  deriveVerification,
  isPubliclyListable,
  listingBlockers,
  maskPhone,
  profileCompletion,
  toPublicOffering,
  toPublicProvider,
  verifiedBadges,
} from "./provider-visibility";

const NOW = new Date("2026-10-09T00:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const entry = (validUntil: Date | null, approvedAt: Date | null = days(-10)) => ({ caseId: "c1", approvedAt, validUntil });

describe("verification level", () => {
  it("is UNVERIFIED without a valid identity check", () => {
    expect(deriveVerification({}, NOW)).toMatchObject({ level: "UNVERIFIED", rank: 0 });
    expect(deriveVerification(undefined, NOW).level).toBe("UNVERIFIED");
    expect(deriveVerification({ IDENTITY: entry(days(-1)) }, NOW).level).toBe("UNVERIFIED"); // lapsed
    expect(deriveVerification({ IDENTITY: entry(days(30), null) }, NOW).level).toBe("UNVERIFIED"); // never approved
  });

  it("takes the highest valid verification", () => {
    expect(deriveVerification({ IDENTITY: entry(days(30)) }, NOW)).toMatchObject({ level: "IDENTITY_VERIFIED", rank: 1 });
    expect(deriveVerification({ IDENTITY: entry(days(30)), PROFESSIONAL: entry(days(30)) }, NOW).level).toBe("PROFESSIONAL_VERIFIED");
    expect(deriveVerification({ IDENTITY: entry(days(30)), PROFESSIONAL: entry(days(30)), INSTITUTION: entry(days(30)) }, NOW).level).toBe("INSTITUTION_VERIFIED");
    expect(deriveVerification({ IDENTITY: entry(days(30)), PROFESSIONAL: entry(days(30)), TRUST_REVIEW: entry(days(30)) }, NOW)).toMatchObject({ level: "TIRVONA_TRUSTED", rank: 4 });
  });

  it("drops to the next valid level when a higher one lapses", () => {
    expect(deriveVerification({ IDENTITY: entry(days(30)), PROFESSIONAL: entry(days(-1)) }, NOW).level).toBe("IDENTITY_VERIFIED");
  });

  it("loses everything when identity lapses, however valid the rest is", () => {
    const level = deriveVerification({ IDENTITY: entry(days(-1)), PROFESSIONAL: entry(days(300)), TRUST_REVIEW: entry(days(300)) }, NOW).level;
    expect(level).toBe("UNVERIFIED");
  });

  it("treats an approval with no end date as not expiring", () => {
    const derived = deriveVerification({ IDENTITY: entry(null) }, NOW);
    expect(derived).toMatchObject({ level: "IDENTITY_VERIFIED", identityVerifiedUntil: null });
  });

  it("reports when identity verification ends", () => {
    expect(deriveVerification({ IDENTITY: entry(days(45)) }, NOW).identityVerifiedUntil).toEqual(days(45));
  });

  it("shows badges for valid verifications only, without case ids", () => {
    const badges = verifiedBadges({ IDENTITY: entry(days(30)), PROFESSIONAL: entry(days(-3)) }, NOW);
    expect(badges).toEqual([{ type: "IDENTITY", level: "IDENTITY_VERIFIED", since: days(-10) }]);
  });
});

describe("public listing rules", () => {
  const listed = {
    status: "ACTIVE",
    verificationRank: 1,
    identityVerifiedUntil: days(30),
    activeOfferingCount: 2,
    consultation: { enabled: false },
    isDevFixture: false,
    deletedAt: null,
  };

  it("lists an active, verified provider with something to offer", () => {
    expect(listingBlockers(listed, { now: NOW })).toEqual([]);
    expect(isPubliclyListable(listed, { now: NOW })).toBe(true);
  });

  it.each([
    [{ status: "ONBOARDING" }, "STATUS_NOT_ACTIVE"],
    [{ status: "SUSPENDED" }, "STATUS_NOT_ACTIVE"],
    [{ status: "INACTIVE" }, "STATUS_NOT_ACTIVE"],
    [{ verificationRank: 0 }, "IDENTITY_NOT_VERIFIED"],
    [{ verificationRank: undefined }, "IDENTITY_NOT_VERIFIED"],
    [{ identityVerifiedUntil: days(-1) }, "VERIFICATION_EXPIRED"],
    [{ activeOfferingCount: 0 }, "NOTHING_TO_OFFER"],
    [{ isDevFixture: true }, "DEV_FIXTURE_HIDDEN"],
    [{ deletedAt: days(-1) }, "DELETED"],
  ])("blocks listing when %j", (patch, blocker) => {
    expect(listingBlockers({ ...listed, ...patch }, { now: NOW })).toContain(blocker);
    expect(isPubliclyListable({ ...listed, ...patch }, { now: NOW })).toBe(false);
  });

  it("lists a consultation-only provider", () => {
    expect(isPubliclyListable({ ...listed, activeOfferingCount: 0, consultation: { enabled: true } }, { now: NOW })).toBe(true);
  });

  it("shows development fixtures only when explicitly allowed", () => {
    expect(isPubliclyListable({ ...listed, isDevFixture: true }, { now: NOW, allowDevFixtures: true })).toBe(true);
    expect(isPubliclyListable({ ...listed, isDevFixture: true }, { now: NOW })).toBe(false);
  });
});

describe("public projections", () => {
  // A deliberately full document: everything private is present so a leak would show.
  const stored = {
    _id: "665f1f77bcf86cd799439011",
    userId: "665f1f77bcf86cd799439099",
    slug: "pt-ramesh",
    providerType: "PANDIT",
    displayName: "Pt Ramesh",
    bio: "Bio",
    avatarUrl: "https://x/y.png",
    languages: ["Hindi"],
    traditions: ["Smarta"],
    specializations: ["Rudrabhishek"],
    experienceYears: 30,
    homeCity: "Haridwar",
    homeState: "Uttarakhand",
    serviceAreas: [{ city: "Haridwar", state: "UK", internalNote: "secret" }],
    serviceCities: ["haridwar"],
    travelProfile: { willingToTravel: true, overnightOk: false, modes: ["TRAIN"], regions: ["north"], minNoticeHours: 48 },
    consultation: { enabled: true, feeMinor: 50000, currency: "INR", slotMinutes: 30, channels: ["VIDEO"], privateNote: "x" },
    verificationLevel: "IDENTITY_VERIFIED",
    verificationRank: 1,
    verification: { IDENTITY: { caseId: "case-secret", approvedAt: days(-5), validUntil: days(100) } },
    identityVerifiedUntil: days(100),
    status: "ACTIVE",
    statusReason: "internal",
    statusChangedBy: "admin-id",
    metricsSnapshot: { x: 1 },
    calendarSeq: 7,
    availableWeekdays: ["MONDAY"],
    activeOfferingCount: 2,
    minFeeMinor: 100,
    maxFeeMinor: 900,
    feeCurrency: "INR",
    isPubliclyListed: true,
    isDevFixture: false,
    deletedAt: null,
    createdAt: days(-100),
    legalName: "Ramesh Kumar Sharma",
    mobile: "9876543210",
    email: "r@example.test",
    address: { line1: "secret street" },
    kycRefs: ["e1"],
  };

  it("exposes an allow-list and nothing private", () => {
    const view = toPublicProvider(stored, NOW);
    const text = JSON.stringify(view);
    for (const secret of ["665f1f77bcf86cd799439099", "case-secret", "secret", "internal", "admin-id", "Ramesh Kumar", "9876543210", "r@example.test", "e1", "calendarSeq", "userId", "legalName", "metricsSnapshot", "statusReason", "ACTIVE\"", "privateNote"])
      expect(text).not.toContain(secret);
    expect(view).toMatchObject({
      id: "665f1f77bcf86cd799439011",
      displayName: "Pt Ramesh",
      verificationLevel: "IDENTITY_VERIFIED",
      acceptingBookings: true,
      offerings: { count: 2, minFeeMinor: 100, maxFeeMinor: 900 },
      consultation: { enabled: true, feeMinor: 50000 },
    });
    expect(view.serviceCities).toEqual([{ city: "Haridwar", state: "UK" }]);
    expect(view.verifiedBadges).toEqual([{ type: "IDENTITY", level: "IDENTITY_VERIFIED", since: days(-5) }]);
  });

  it("hides consultation fees when consultations are off", () => {
    expect(toPublicProvider({ ...stored, consultation: { enabled: false, feeMinor: 1 } }, NOW).consultation).toEqual({ enabled: false });
  });

  it("projects an offering with its indicative fee but no internals", () => {
    const view = toPublicOffering({
      _id: "o1", providerId: "p1", ritualId: "r1", ritualVariantId: "v1", fulfilmentType: "LOCAL_HOME",
      durationMinutes: 90, teamSize: 2, minNoticeHours: 24, baseProfessionalFeeMinor: 250000, currency: "INR",
      travelCharge: { policy: "FLAT", flatMinor: 50000 }, inclusions: ["a"], exclusions: ["b"], samagriIncluded: false,
      voluntaryDakshinaAllowed: true, status: "ACTIVE", createdBy: "secret", deletedAt: null,
    });
    expect(view.indicativeFee).toEqual({ amountMinor: 250000, currency: "INR" });
    expect(JSON.stringify(view)).not.toContain("secret");
    expect((view as any).baseProfessionalFeeMinor).toBeUndefined();
  });
});

describe("masking and completion", () => {
  it("masks all but the last four digits", () => {
    expect(maskPhone("9876543210")).toBe("******3210");
    expect(maskPhone("+91 98765 43210")).toBe("********3210");
    expect(maskPhone("123")).toBe("****");
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone("")).toBeNull();
  });

  it("scores profile completion from real facts, not a made-up number", () => {
    const empty = profileCompletion({ displayName: "A" }, { hasOffering: false, hasAvailability: false });
    expect(empty.percent).toBeLessThan(25);
    expect(empty.missing).toEqual(expect.arrayContaining(["bio", "avatar", "offering", "availability", "identityVerification"]));
    const full = profileCompletion(
      { displayName: "A", bio: "x".repeat(40), avatarUrl: "u", languages: ["Hindi"], specializations: ["s"], homeCity: "c", verificationRank: 1 },
      { hasOffering: true, hasAvailability: true },
    );
    expect(full).toEqual({ percent: 100, missing: [] });
  });
});
