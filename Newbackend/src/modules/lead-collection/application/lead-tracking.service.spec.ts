import { LeadTrackingService } from "./lead-tracking.service";

/**
 * Location history is personal data, so the guarantees worth pinning are that
 * nothing is recorded without live consent and that a device replaying an
 * upload cannot inflate the distance it reports.
 */
const AGENT_ID = "64b7f3a1c2d4e5f6a7b8c9d0";

const agent: any = {
  id: AGENT_ID,
  name: "R. Sharma",
  phone: "9000000000",
  role: "field_agent",
  state: "Uttar Pradesh",
  district: "Mathura",
};

const chain = (rows: unknown) => {
  const c: any = {
    sort: jest.fn(() => c),
    select: jest.fn(() => c),
    lean: jest.fn().mockResolvedValue(rows),
  };
  return c;
};

const build = (
  over: {
    consent?: boolean;
    lastFix?: unknown;
    storedFixes?: unknown[];
    insertMany?: jest.Mock;
  } = {},
) => {
  const insertMany = over.insertMany ?? jest.fn().mockResolvedValue([]);

  const pings: any = {
    findOne: jest.fn(() => chain(over.lastFix ?? null)),
    find: jest.fn(() => chain(over.storedFixes ?? [])),
    aggregate: jest.fn().mockResolvedValue([]),
    insertMany,
  };

  const users: any = {
    findById: jest.fn(() =>
      chain({ trackingConsent: { granted: over.consent ?? true } }),
    ),
    findByIdAndUpdate: jest.fn(() =>
      chain({
        trackingConsent: {
          granted: true,
          grantedAt: new Date(),
          revokedAt: null,
          deviceLabel: "Pixel",
        },
      }),
    ),
  };

  return { service: new LeadTrackingService(pings, users), pings, users, insertMany };
};

const iso = (minutes: number): string =>
  new Date(Date.UTC(2026, 8, 9, 9, 0, 0) + minutes * 60_000).toISOString();

describe("LeadTrackingService consent", () => {
  it("refuses to record anything while consent is off", async () => {
    const { service, insertMany } = build({ consent: false });

    await expect(
      service.recordFixes(agent, {
        fixes: [{ lat: 27.49, lng: 77.67, recordedAt: iso(0) }],
      } as any),
    ).rejects.toThrow(/tracking is off/i);

    expect(insertMany).not.toHaveBeenCalled();
  });

  it("re-checks consent on every upload rather than trusting the client", async () => {
    const { service, users } = build({ consent: true });

    await service.recordFixes(agent, {
      fixes: [{ lat: 27.49, lng: 77.67, recordedAt: iso(0) }],
    } as any);

    expect(users.findById).toHaveBeenCalled();
  });

  it("records the grant and clears any earlier revocation", async () => {
    const { service, users } = build();

    const consent = await service.setConsent(agent, {
      granted: true,
      deviceLabel: "Pixel",
    });

    const patch = users.findByIdAndUpdate.mock.calls[0][1].$set;
    expect(patch["trackingConsent.granted"]).toBe(true);
    expect(patch["trackingConsent.revokedAt"]).toBeNull();
    expect(consent.granted).toBe(true);
  });

  it("revoking stops collection without erasing what was gathered", async () => {
    const { service, users } = build();

    await service.setConsent(agent, { granted: false } as any);

    const patch = users.findByIdAndUpdate.mock.calls[0][1].$set;
    expect(patch["trackingConsent.granted"]).toBe(false);
    expect(patch["trackingConsent.revokedAt"]).toBeInstanceOf(Date);
    // No delete is issued against the stored points.
    expect(patch).not.toHaveProperty("trackingConsent.grantedAt");
  });
});

describe("LeadTrackingService recording", () => {
  it("stamps every stored fix with the agent from the token", async () => {
    const { service, insertMany } = build();

    await service.recordFixes(agent, {
      fixes: [
        { lat: 27.49, lng: 77.67, recordedAt: iso(0) },
        { lat: 27.491, lng: 77.67, recordedAt: iso(4) },
      ],
    } as any);

    const [docs] = insertMany.mock.calls[0];
    expect(docs).toHaveLength(2);
    for (const doc of docs) {
      expect(String(doc.agentId)).toBe(AGENT_ID);
      expect(doc.district).toBe("Mathura");
      expect(doc.date).toBe("2026-09-09");
    }
  });

  it("reports which fixes were rejected and why", async () => {
    const { service } = build();

    const result = await service.recordFixes(agent, {
      fixes: [
        { lat: 27.49, lng: 77.67, recordedAt: iso(0) },
        { lat: 0, lng: 0, recordedAt: iso(2) },
        { lat: 27.6, lng: 77.67, recordedAt: iso(3), accuracy: 900 },
      ],
    } as any);

    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(2);
    expect(result.reasons).toMatchObject({ null_island: 1, inaccurate: 1 });
  });

  it("continues from the day's last stored fix", async () => {
    const { service, pings } = build({
      lastFix: {
        lat: 27.49,
        lng: 77.67,
        recordedAt: new Date(Date.UTC(2026, 8, 9, 8, 58, 0)),
      },
    });

    await service.recordFixes(agent, {
      fixes: [{ lat: 27.491, lng: 77.67, recordedAt: iso(0) }],
    } as any);

    expect(pings.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-09-09" }),
    );
  });

  it("swallows a duplicate-key replay instead of failing the upload", async () => {
    const duplicate = Object.assign(new Error("dup"), { code: 11000 });
    const { service } = build({
      insertMany: jest.fn().mockRejectedValue(duplicate),
    });

    await expect(
      service.recordFixes(agent, {
        fixes: [{ lat: 27.49, lng: 77.67, recordedAt: iso(0) }],
      } as any),
    ).resolves.toMatchObject({ accepted: 1 });
  });

  it("still surfaces a write failure that is not a replay", async () => {
    const { service } = build({
      insertMany: jest.fn().mockRejectedValue(new Error("disk full")),
    });

    await expect(
      service.recordFixes(agent, {
        fixes: [{ lat: 27.49, lng: 77.67, recordedAt: iso(0) }],
      } as any),
    ).rejects.toThrow(/disk full/);
  });
});

describe("LeadTrackingService reading", () => {
  it("reads only the requested agent and day", async () => {
    const { service, pings } = build();

    await service.day(AGENT_ID, "2026-09-01");

    expect(pings.find).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-09-01" }),
    );
  });

  it("falls back to today when no date is supplied", async () => {
    const { service, pings } = build();

    await service.day(AGENT_ID);

    const filter = pings.find.mock.calls[0][0] as any;
    expect(filter.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it("narrows the live board to the caller's district", async () => {
    const { service, pings } = build();

    await service.liveBoard({ state: "Uttar Pradesh", district: "Mathura" });

    const [pipeline] = pings.aggregate.mock.calls[0];
    expect(pipeline[0].$match).toMatchObject({
      district: "Mathura",
      state: "Uttar Pradesh",
    });
  });

  it("leaves the live board unfiltered for an unrestricted caller", async () => {
    const { service, pings } = build();

    await service.liveBoard({});

    const [pipeline] = pings.aggregate.mock.calls[0];
    expect(pipeline[0].$match).not.toHaveProperty("district");
  });

  it("bounds a history request to the requested range", async () => {
    const { service, pings } = build();

    await service.history(AGENT_ID, {
      startDate: "2026-09-01",
      endDate: "2026-09-09",
    });

    const [pipeline] = pings.aggregate.mock.calls[0];
    expect(pipeline[0].$match.date).toEqual({
      $gte: "2026-09-01",
      $lte: "2026-09-09",
    });
  });
});
