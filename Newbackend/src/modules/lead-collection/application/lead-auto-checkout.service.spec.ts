import { LeadAttendanceService, LEAD_AUTO_CHECKOUT_NOTE } from "./lead-attendance.service";
import { LeadAutoCheckoutService } from "./lead-auto-checkout.service";

const HOUR = 3_600_000;
const now = new Date("2026-11-18T20:00:00.000Z");

/** Fake attendance collection that understands just the filters the sweep uses. */
const fakeModel = (rows: any[], lostRace: string[] = []) => {
  const find = (filter: any) => {
    const cutoff: Date = filter.checkInTime.$lte;
    const hits = rows.filter(
      (r) => r.checkedIn === filter.checkedIn && r.checkedOut === filter.checkedOut && r.checkInTime <= cutoff,
    );
    return { select: () => ({ lean: async () => hits.map((r) => ({ ...r })) }) };
  };
  const findOneAndUpdate = async (filter: any, update: any) => {
    const row = rows.find((r) => r._id === filter._id && r.checkedOut === filter.checkedOut);
    if (!row || lostRace.includes(row._id)) return null;
    Object.assign(row, update.$set);
    return row;
  };
  return { find, findOneAndUpdate } as never;
};

const open = (id: string, hoursAgo: number, extra: Record<string, unknown> = {}) => ({
  _id: id,
  agentId: `agent-${id}`,
  checkedIn: true,
  checkedOut: false,
  checkInTime: new Date(now.getTime() - hoursAgo * HOUR),
  notes: "",
  ...extra,
});

describe("Lead auto check-out", () => {
  it("closes shifts open for 9+ hours at exactly 9 hours after check-in", async () => {
    const rows: any[] = [open("a", 10), open("b", 9)];
    const service = new LeadAttendanceService(fakeModel(rows), {} as never);

    const closed = await service.autoCheckOutStale(now);

    expect(closed).toEqual([
      { agentId: "agent-a", attendanceId: "a" },
      { agentId: "agent-b", attendanceId: "b" },
    ]);
    expect(rows[0]).toMatchObject({
      checkedOut: true,
      totalWorkingMinutes: 540,
      formattedWorkingHours: "9 hr 0 min",
      status: "present",
      notes: LEAD_AUTO_CHECKOUT_NOTE,
    });
    // 10h ago + 9h, not "now": a late sweep must not inflate the hours.
    expect(rows[0].checkOutTime).toEqual(new Date(now.getTime() - 1 * HOUR));
  });

  it("leaves shifts under 9 hours and already-closed shifts alone", async () => {
    const rows: any[] = [open("fresh", 8.9), open("done", 12, { checkedOut: true })];
    const service = new LeadAttendanceService(fakeModel(rows), {} as never);
    expect(await service.autoCheckOutStale(now)).toEqual([]);
    expect(rows[0].checkedOut).toBe(false);
  });

  it("keeps an existing note and does not count a shift someone else closed first", async () => {
    const rows: any[] = [open("a", 11, { notes: "Meeting at temple" }), open("b", 11)];
    const service = new LeadAttendanceService(fakeModel(rows, ["b"]), {} as never);

    const closed = await service.autoCheckOutStale(now);

    expect(closed.map((c) => c.attendanceId)).toEqual(["a"]);
    expect(rows[0].notes).toBe(`Meeting at temple | ${LEAD_AUTO_CHECKOUT_NOTE}`);
  });
});

describe("LeadAutoCheckoutService", () => {
  const build = (closed: unknown[], measure: jest.Mock = jest.fn().mockResolvedValue(1.2)) => {
    const attendance = { autoCheckOutStale: jest.fn().mockResolvedValue(closed) };
    const tracking = { saveShiftDistance: measure };
    return { service: new LeadAutoCheckoutService(attendance as never, tracking as never), attendance, measure };
  };

  afterEach(() => {
    delete process.env.LEAD_AUTO_CHECKOUT_ENABLED;
  });

  it("saves each closed shift's distance, and survives a distance failure", async () => {
    const measure = jest.fn().mockRejectedValueOnce(new Error("no points")).mockResolvedValueOnce(2);
    const { service } = build(
      [
        { agentId: "g1", attendanceId: "a1" },
        { agentId: "g2", attendanceId: "a2" },
      ],
      measure,
    );
    await service.sweep();
    expect(measure).toHaveBeenCalledWith("g1", "a1");
    expect(measure).toHaveBeenCalledWith("g2", "a2");
  });

  it("does nothing when switched off", async () => {
    process.env.LEAD_AUTO_CHECKOUT_ENABLED = "false";
    const { service, attendance } = build([]);
    await service.sweep();
    expect(attendance.autoCheckOutStale).not.toHaveBeenCalled();
  });
});
