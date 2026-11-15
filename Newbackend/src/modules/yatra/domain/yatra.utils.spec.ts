import { NotFoundException } from "@nestjs/common";
import { YatraEnabledGuard } from "../presentation/yatra-http";
import {
  csvCell,
  detectDocumentType,
  generateSeatLayout,
  journeyStatusFor,
  memberCan,
  unsellableReason,
  validateCancellationPolicy,
  validateCustomLayout,
  yatraRefundQuote,
} from "./yatra.utils";

describe("yatra domain rules", () => {
  it("numbers standard layouts row by row and leaves the aisle free", () => {
    const layout = generateSeatLayout("2x2", 10);
    expect(layout.seats.map((s) => s.seatNo)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(new Set(layout.seats.map((s) => s.col))).toEqual(new Set([0, 1, 3, 4]));
    expect(layout.rows).toBe(3);
    expect(generateSeatLayout("2x1", 300).seats).toHaveLength(120);
  });

  it("rejects custom layouts with duplicate seats or positions", () => {
    expect(validateCustomLayout([{ seatNo: "A1", row: 0, col: 0 }, { seatNo: "a1", row: 0, col: 1 }])).toMatch(/twice/);
    expect(validateCustomLayout([{ seatNo: "A1", row: 0, col: 0 }, { seatNo: "A2", row: 0, col: 0 }])).toMatch(/same position/);
    expect(validateCustomLayout([{ seatNo: "A1", row: 0, col: 0 }])).toBeNull();
  });

  it("gives organiser roles only their permissions", () => {
    expect(memberCan("owner", "manageStaff")).toBe(true);
    expect(memberCan("manager", "manageStaff")).toBe(false);
    expect(memberCan("manager", "manageTours")).toBe(true);
    expect(memberCan("staff", "manageTours")).toBe(false);
    expect(memberCan("staff", "createBookings")).toBe(true);
    expect(memberCan(undefined, "viewBookings")).toBe(false);
  });

  it("quotes refunds from the policy windows, with an admin override", () => {
    const policy = { windows: [{ hoursBefore: 72, refundPercent: 90 }, { hoursBefore: 24, refundPercent: 50 }], defaultRefundPercent: 0 };
    const now = new Date("2026-12-01T00:00:00Z");
    expect(yatraRefundQuote(policy, 3000, new Date("2026-12-10T00:00:00Z"), now)).toMatchObject({ refundPercent: 90, refundAmount: 2700 });
    expect(yatraRefundQuote(policy, 3000, new Date("2026-12-02T12:00:00Z"), now)).toMatchObject({ refundPercent: 50, refundAmount: 1500 });
    expect(yatraRefundQuote(policy, 3000, new Date("2026-12-01T10:00:00Z"), now)).toMatchObject({ refundPercent: 0, refundAmount: 0 });
    expect(yatraRefundQuote(policy, 3000, new Date("2026-12-01T10:00:00Z"), now, 100)).toMatchObject({ refundPercent: 100, refundAmount: 3000 });
    expect(validateCancellationPolicy({ windows: [{ hoursBefore: 24, refundPercent: 120 }], defaultRefundPercent: 0 })).toMatch(/between 0 and 100/);
  });

  it("sells only an approved organiser's published tour on a verified vehicle before cut-off", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    const ok = {
      departure: { status: "scheduled", departAt: new Date("2026-12-05T00:00:00Z") },
      tour: { status: "published" },
      operator: { status: "approved" },
      vehicle: { status: "approved" },
      salesCloseMinutes: 60,
      now,
    };
    expect(unsellableReason(ok)).toBeNull();
    expect(unsellableReason({ ...ok, operator: { status: "suspended" } })).toMatch(/organiser/);
    expect(unsellableReason({ ...ok, tour: { status: "approved" } })).toMatch(/not published/);
    expect(unsellableReason({ ...ok, vehicle: { status: "pending_verification" } })).toMatch(/vehicle/);
    expect(unsellableReason({ ...ok, departure: { status: "draft", departAt: ok.departure.departAt } })).toMatch(/closed/);
    expect(unsellableReason({ ...ok, departure: { status: "scheduled", departAt: new Date("2026-12-01T00:30:00Z") } })).toMatch(/closed/);
  });

  it("derives the journey state from its dates", () => {
    const now = new Date("2026-12-05T12:00:00Z");
    expect(journeyStatusFor("confirmed", "2026-12-06", "2026-12-08", now)).toBe("upcoming");
    expect(journeyStatusFor("confirmed", "2026-12-05", "2026-12-08", now)).toBe("ongoing");
    expect(journeyStatusFor("confirmed", "2026-12-01", "2026-12-02", now)).toBe("completed");
    expect(journeyStatusFor("cancelled", "2026-12-06", "2026-12-08", now)).toBe("cancelled");
  });

  it("recognises documents by their bytes and neutralises CSV formulas", () => {
    expect(detectDocumentType(Buffer.from("%PDF-1.7 hello world"))).toMatchObject({ mime: "application/pdf", resourceType: "raw" });
    expect(detectDocumentType(Buffer.from("just some text here"))).toBeNull();
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('Ram "Ji"')).toBe(`"Ram ""Ji"""`);
  });

  it("answers 404 for every Yatra endpoint while YATRA_ENABLED is off", () => {
    const reflector = { getAllAndOverride: () => false } as any;
    const ctx = { getHandler: () => null, getClass: () => null } as any;
    expect(() => new YatraEnabledGuard({ get: () => false } as any, reflector).canActivate(ctx)).toThrow(NotFoundException);
    expect(new YatraEnabledGuard({ get: () => true } as any, reflector).canActivate(ctx)).toBe(true);
    expect(new YatraEnabledGuard({ get: () => false } as any, { getAllAndOverride: () => true } as any).canActivate(ctx)).toBe(true);
  });
});
