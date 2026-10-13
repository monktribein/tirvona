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
    shifts?: any[];
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

  // By default the agent checked in an hour before the first test fix and has
  // not checked out, so every fix falls inside the shift.
  const shifts = over.shifts ?? [
    { checkInTime: new Date(iso(-60)), checkOutTime: null, checkedOut: false },
  ];
  const attendance: any = {
    find: jest.fn(() => {
      const c: any = chain(shifts);
      c.limit = jest.fn(() => c);
      return c;
    }),
    findOne: jest.fn(() => chain(shifts.find((s: any) => !s.checkedOut) ?? null)),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  };

  return {
    service: new LeadTrackingService(pings, users, attendance),
    pings,
    users,
    attendance,
    insertMany,
  };
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

describe("LeadTrackingService shifts", () => {
  it("drops points recorded after check-out and tells the device to stop", async () => {
    const { service, insertMany } = build({
      shifts: [
        { checkInTime: new Date(iso(-60)), checkOutTime: new Date(iso(-30)), checkedOut: true },
      ],
    });

    const result = await service.recordFixes(agent, {
      fixes: [{ lat: 27.49, lng: 77.67, recordedAt: iso(0) }],
    } as any);

    expect(insertMany).not.toHaveBeenCalled();
    expect(result.accepted).toBe(0);
    expect(result.reasons.off_duty).toBe(1);
    expect(result.onDuty).toBe(false);
  });

  it("keeps the last points of a shift that land just before check-out", async () => {
    const { service, insertMany } = build({
      shifts: [
        { checkInTime: new Date(iso(-60)), checkOutTime: new Date(iso(1)), checkedOut: true },
      ],
    });

    await service.recordFixes(agent, {
      fixes: [{ lat: 27.49, lng: 77.67, recordedAt: iso(0) }],
    } as any);

    expect(insertMany).toHaveBeenCalled();
  });

  it("measures a shift from the check-in point to the check-out point", async () => {
    const record = {
      _id: "64b7f3a1c2d4e5f6a7b8c9d1",
      date: "2026-09-09",
      status: "present",
      checkedIn: true,
      checkedOut: true,
      checkInTime: new Date(iso(0)),
      checkOutTime: new Date(iso(30)),
      checkInCoords: { lat: 27.49, lng: 77.67, accuracy: 10 },
      checkOutCoords: { lat: 27.52, lng: 77.67, accuracy: 10 },
    };
    const { service, attendance } = build({
      storedFixes: [
        { lat: 27.5, lng: 77.67, accuracy: 10, recordedAt: new Date(iso(10)) },
        { lat: 27.51, lng: 77.67, accuracy: 10, recordedAt: new Date(iso(20)) },
      ],
    });
    attendance.findOne.mockReturnValue(chain(record));

    const shift = await service.shiftRoute(AGENT_ID, record._id);

    // Three legs of ~1.11 km each: check-in → two tracked points → check-out.
    expect(shift.summary.totalKm).toBeCloseTo(3.34, 1);
    expect(shift.summary.route).toHaveLength(4);
    expect(shift.onDuty).toBe(false);
    expect(shift.checkIn.lat).toBe(27.49);
    expect(shift.checkOut?.lat).toBe(27.52);
  });

  it("ignores a check-in that carried no device fix", async () => {
    // Viewed during the shift itself, so it is still live.
    jest.useFakeTimers({ now: new Date(iso(30)) });
    const record = {
      _id: "64b7f3a1c2d4e5f6a7b8c9d2",
      date: "2026-09-09",
      checkedIn: true,
      checkedOut: false,
      checkInTime: new Date(iso(0)),
      checkInCoords: { lat: null, lng: null, accuracy: null },
    };
    const { service, attendance } = build({
      storedFixes: [
        { lat: 27.5, lng: 77.67, accuracy: 10, recordedAt: new Date(iso(10)) },
      ],
    });
    attendance.findOne.mockReturnValue(chain(record));

    const shift = await service.shiftRoute(AGENT_ID, record._id);

    expect(shift.summary.route).toHaveLength(1);
    expect(shift.summary.totalKm).toBe(0);
    expect(shift.checkIn.lat).toBeNull();
    expect(shift.onDuty).toBe(true);
    jest.useRealTimers();
  });

  it("gives each attendance row the distance of its own shift", async () => {
    const { service } = build({
      storedFixes: [
        { lat: 27.5, lng: 77.67, accuracy: 10, recordedAt: new Date(iso(10)) },
        // Belongs to no listed shift, so it must not leak into either total.
        { lat: 28.5, lng: 77.67, accuracy: 10, recordedAt: new Date(iso(600)) },
      ],
    });

    const rows = await service.withShiftDistances(AGENT_ID, [
      {
        checkInTime: new Date(iso(0)),
        checkOutTime: new Date(iso(20)),
        checkedOut: true,
        checkInCoords: { lat: 27.49, lng: 77.67 },
        checkOutCoords: { lat: 27.51, lng: 77.67 },
      },
      { checkInTime: null },
    ]);

    expect(rows[0].distanceKm).toBeCloseTo(2.22, 1);
    expect(rows[0].trackedPoints).toBe(1);
    expect(rows[1].distanceKm).toBe(0);
  });
});

describe("LeadTrackingService attendance totals", () => {
  it("totals every shift in the chosen dates, not just the rows on the page", async () => {
    const day1 = {
      _id: "a1",
      date: "2026-09-09",
      status: "present",
      checkedIn: true,
      checkedOut: true,
      checkInTime: new Date(iso(0)),
      checkOutTime: new Date(iso(20)),
      checkInCoords: { lat: 27.49, lng: 77.67 },
      checkOutCoords: { lat: 27.51, lng: 77.67 },
    };
    const day2 = {
      _id: "a2",
      date: "2026-09-10",
      status: "half_day",
      checkedIn: true,
      checkedOut: true,
      checkInTime: new Date(iso(1440)),
      checkOutTime: new Date(iso(1460)),
      checkInCoords: { lat: 27.49, lng: 77.67 },
      checkOutCoords: { lat: 27.5, lng: 77.67 },
    };
    const { service, attendance } = build({ shifts: [day1, day2] });

    // The page only holds day2; the range holds both.
    const result = await service.withAttendanceDistances(
      AGENT_ID,
      { records: [{ _id: "a2" }], summary: { totalDaysPresent: 2 } },
      { startDate: "2026-09-09", endDate: "2026-09-10" },
    );

    expect(attendance.find.mock.calls.at(-1)[0].date).toEqual({
      $gte: "2026-09-09",
      $lte: "2026-09-10",
    });
    expect(result.records[0].distanceKm).toBeCloseTo(1.11, 1);
    expect(result.summary.totalDistanceKm).toBeCloseTo(3.34, 1);
    expect(result.summary.longestDayDate).toBe("2026-09-09");
    expect(result.summary.presentDays).toBe(1);
    expect(result.summary.halfDays).toBe(1);
    expect(result.summary.totalDaysPresent).toBe(2);
  });
});

describe("LeadTrackingService forgotten check-out", () => {
  afterEach(() => jest.useRealTimers());

  it("ends a shift left open at the close of its own day", async () => {
    // Checked in on 9 Sep, never checked out; viewed on 10 Sep.
    jest.useFakeTimers({ now: new Date("2026-09-10T12:00:00+05:30") });
    const forgotten = {
      _id: "f1",
      date: "2026-09-09",
      status: "checked_in",
      checkedIn: true,
      checkedOut: false,
      checkInTime: new Date(iso(0)),
      checkInCoords: { lat: 27.49, lng: 77.67 },
    };
    const { service, attendance } = build({
      shifts: [forgotten],
      storedFixes: [
        { lat: 27.5, lng: 77.67, accuracy: 10, recordedAt: new Date(iso(10)) },
        // Next day's movement must not be added to the 9 Sep shift.
        { lat: 27.6, lng: 77.67, accuracy: 10, recordedAt: new Date("2026-09-10T11:00:00+05:30") },
      ],
    });

    const [row] = await service.withShiftDistances(AGENT_ID, [forgotten]);
    expect(row.trackedPoints).toBe(1);
    expect(row.distanceKm).toBeCloseTo(1.11, 1);

    attendance.findOne.mockReturnValue(chain(forgotten));
    expect(await service.isOnDuty(AGENT_ID)).toBe(false);
    const shift = await service.shiftRoute(AGENT_ID, "64b7f3a1c2d4e5f6a7b8c9d3");
    expect(shift.onDuty).toBe(false);
  });
});

describe("LeadTrackingService saved shift distance", () => {
  const finished = {
    _id: "64b7f3a1c2d4e5f6a7b8c9e1",
    date: "2026-09-09",
    status: "present",
    checkedIn: true,
    checkedOut: true,
    checkInTime: new Date(iso(0)),
    checkOutTime: new Date(iso(30)),
    checkInCoords: { lat: 27.49, lng: 77.67 },
    checkOutCoords: { lat: 27.52, lng: 77.67 },
  };

  it("keeps a finished shift's distance after its raw points have expired", async () => {
    const { service, pings } = build({ storedFixes: [] });

    const [row] = await service.withShiftDistances(AGENT_ID, [
      { ...finished, distanceKm: 12.5, trackedPoints: 240 },
    ]);

    expect(row.distanceKm).toBe(12.5);
    expect(row.trackedPoints).toBe(240);
    expect(pings.find).not.toHaveBeenCalled();
  });

  it("saves the distance when the shift is measured at check-out", async () => {
    const { service, attendance } = build({
      storedFixes: [
        { lat: 27.5, lng: 77.67, accuracy: 10, recordedAt: new Date(iso(10)) },
        { lat: 27.51, lng: 77.67, accuracy: 10, recordedAt: new Date(iso(20)) },
      ],
    });
    attendance.findOne.mockReturnValue(chain(finished));

    const km = await service.saveShiftDistance(AGENT_ID, finished._id);

    expect(km).toBeCloseTo(3.34, 1);
    const [filter, update] = attendance.updateOne.mock.calls.at(-1);
    expect(String(filter._id)).toBe(finished._id);
    expect(update.$set.distanceKm).toBeCloseTo(3.34, 1);
    expect(update.$set.trackedPoints).toBe(2);
  });

  it("clears a saved distance when late points arrive for that shift", async () => {
    const { service, attendance } = build();

    await service.recordFixes(agent, {
      fixes: [{ lat: 27.49, lng: 77.67, recordedAt: iso(0) }],
    } as any);

    const [, update] = attendance.updateMany.mock.calls.at(-1);
    expect(update.$set).toEqual({ distanceKm: null, trackedPoints: null, distanceMeasuredAt: null });
  });
});
