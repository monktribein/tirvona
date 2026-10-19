import { ForbiddenException } from "@nestjs/common";
import { GovernanceService } from "./governance.service";

const make = (ownedAshram: unknown = null) => {
  const calls: any[] = [];
  const repository = {
    list: async (model: string, filter: any) => {
      calls.push({ op: "list", model, filter });
      return [];
    },
    count: async (model: string, filter: any) => {
      calls.push({ op: "count", model, filter });
      return 0;
    },
    one: async () => ownedAshram,
    create: async (_model: string, data: any) => data,
    remove: async (model: string, filter: any) => {
      calls.push({ op: "remove", model, filter });
      return true;
    },
  };
  const service: any = Object.create(GovernanceService.prototype);
  service.repository = repository;
  service.notify = async () => undefined;
  return { service, calls };
};

const logFilter = (calls: any[]) =>
  calls.find((c) => c.op === "list" && c.model === "ActivityLog").filter;

describe("governance data isolation", () => {
  it.each(["customer", "pandit_provider", "volunteer", "manager", "reception"])(
    "activity log is limited to the caller's own entries for %s",
    async (role) => {
      const { service, calls } = make();
      await service.activities({ id: "u1", role }, {});
      expect(logFilter(calls).userId).toBe("u1");
    },
  );

  it.each(["super_admin", "national_admin"])(
    "platform staff (%s) keep the full activity log",
    async (role) => {
      const { service, calls } = make();
      await service.activities({ id: "a1", role }, {});
      expect(logFilter(calls).userId).toBeUndefined();
    },
  );

  it("platform stats for a customer only count their own notifications and logs", async () => {
    const { service, calls } = make();
    await service.telemetryStats({ id: "u1", role: "customer" });
    const logs = calls.filter((c) => c.model === "ActivityLog");
    expect(logs.length).toBeGreaterThan(0);
    for (const c of logs) expect(c.filter.userId).toBe("u1");
    const notes = calls.filter((c) => c.model === "EnterpriseNotification");
    for (const c of notes) expect(c.filter.$or).toBeDefined();
  });

  it("approval stats for a non-admin are scoped to their own requests", async () => {
    const { service, calls } = make();
    await service.approvalStats({ id: "u1", role: "customer" });
    for (const c of calls.filter((x) => x.op === "count"))
      expect(c.filter.$or).toEqual(expect.arrayContaining([{ stayAdminId: "u1" }]));
  });

  it("rejects an approval request aimed at an ashram the caller does not own", async () => {
    const { service } = make(null);
    await expect(
      service.createApproval(
        { id: "u1", role: "customer", name: "U" },
        { module: "pricing", title: "x", ashramId: "someone-elses", requestedData: {} },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows an approval request for the caller's own ashram", async () => {
    const { service } = make({ _id: "a1", ownerId: "u1" });
    await expect(
      service.createApproval(
        { id: "u1", role: "ashram_owner", name: "U" },
        { module: "pricing", title: "x", ashramId: "a1", requestedData: {} },
      ),
    ).resolves.toMatchObject({ success: true });
  });

  it("notification delete is limited to notifications addressed to the caller", async () => {
    const { service, calls } = make();
    await service.deleteNotification({ id: "u1", role: "customer" }, "n1");
    expect(calls.find((c) => c.op === "remove").filter.recipientId).toBe("u1");
  });
});
