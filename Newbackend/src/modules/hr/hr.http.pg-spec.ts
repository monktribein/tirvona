/// <reference types="jest" />
/**
 * The HR Management API end to end: real controllers, role and permission guards, validation and error
 * envelope, the HR services and the Postgres storage driver against a throwaway Postgres 17.
 * Run with `npm run test:pg -- hr.http`. The tests share state and run in order: run the whole file.
 */
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { getModelToken } from "../../database/orm-nest";
import { as, newUser } from "../providers/testing/provider-test-app";
import { addDays, todayIst } from "./domain/hr-attendance";
import { HrTasksService } from "./application/hr-tasks.service";
import { createHrTestApp, type HrTestApp } from "./testing/hr-test-app";

type User = ReturnType<typeof newUser>;
const withPerms = (role: string, name: string, permissions: string[]): User => ({ ...newUser(role, name), permissions });

describe("HR Management API (real Postgres)", () => {
  let ctx: HrTestApp;
  let app: INestApplication;

  const superAdmin = newUser("super_admin", "Super Admin");
  const hrPeople = withPerms("staff", "HR People", ["hr.employees.manage"]);
  const hrTasks = withPerms("staff", "HR Tasks", ["hr.tasks.manage"]);
  const hrAttendance = withPerms("staff", "HR Attendance", ["hr.attendance.manage"]);
  const hrReports = withPerms("staff", "HR Reports", ["hr.reports.view"]);
  const customer = newUser("customer", "Pilgrim");
  const managerUser = newUser("staff", "Meera Manager");
  const workerUser = newUser("staff", "Wasim Worker");
  const worker2User = newUser("staff", "Vikas Worker");
  const otherUser = newUser("staff", "Omkar Other");

  const ids: Record<string, string> = {};
  const today = todayIst();
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

  const http = () => request(app.getHttpServer());
  const get = (path: string, user: User) => http().get(`/api${path}`).set(as(user));
  const post = (path: string, user: User, body: object = {}) => http().post(`/api${path}`).set(as(user)).send(body);
  const patch = (path: string, user: User, body: object = {}) => http().patch(`/api${path}`).set(as(user)).send(body);
  const put = (path: string, user: User, body: object = {}) => http().put(`/api${path}`).set(as(user)).send(body);
  const sentOfKind = (kind: string) => ctx.sent.filter((n) => n.kind === kind);

  beforeAll(async () => {
    ctx = await createHrTestApp();
    app = ctx.app;
    // Existing Tirvona logins that HR links employees to.
    const users = app.get(getModelToken("User"));
    for (const u of [managerUser, workerUser, worker2User, otherUser])
      await users.create({ _id: u.id, name: u.name, email: u.email, phone: u.phone, role: "staff", permissions: [] });
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe("access control", () => {
    it("keeps customers and unpermitted staff out of HR administration", async () => {
      await get("/hr/dashboard", customer).expect(403);
      await get("/hr/employees", customer).expect(403);
      await post("/hr/offices", customer, { code: "X1", name: "Nope" }).expect(403);
      await get("/hr/attendance", customer).expect(403);
      // Holding a different HR permission does not open this one.
      await post("/hr/offices", hrTasks, { code: "X1", name: "Nope" }).expect(403);
      await get("/hr/reports/tasks?from=2026-10-01&to=2026-10-31", hrTasks).expect(403);
      await http().get("/api/hr/dashboard").expect(401);
    });

    it("tells any signed-in user what HR offers them, without granting anything", async () => {
      const res = await get("/hr/me/access", customer).expect(200);
      expect(res.body.data).toEqual({
        can: { employees: false, tasks: false, attendance: false, reports: false },
        isManager: false,
        teamSize: 0,
        employee: null,
      });
      const admin = await get("/hr/me/access", superAdmin).expect(200);
      expect(admin.body.data.can).toEqual({ employees: true, tasks: true, attendance: true, reports: true });
    });
  });

  describe("offices, departments and designations", () => {
    it("creates the two offices and refuses duplicates", async () => {
      ids.office1 = (await post("/hr/offices", superAdmin, { code: "vrn-hq", name: "Vrindavan Office", city: "Vrindavan" }).expect(201)).body.data.id;
      ids.office2 = (await post("/hr/offices", hrPeople, { code: "DEL-1", name: "Delhi Office" }).expect(201)).body.data.id;
      await post("/hr/offices", superAdmin, { code: "VRN-HQ", name: "Another" }).expect(409);
      await post("/hr/offices", superAdmin, { code: "NEW-1", name: "  delhi   office " }).expect(409);
      await post("/hr/offices", superAdmin, { code: "!", name: "Bad code" }).expect(400);
      const list = await get("/hr/offices", superAdmin).expect(200);
      expect(list.body.data.map((o: any) => o.code)).toEqual(["DEL-1", "VRN-HQ"]);
    });

    it("creates departments and lets the same title exist in different departments", async () => {
      ids.dev = (await post("/hr/departments", hrPeople, { name: "Development" }).expect(201)).body.data.id;
      ids.ops = (await post("/hr/departments", hrPeople, { name: "Operations" }).expect(201)).body.data.id;
      await post("/hr/departments", hrPeople, { name: "development" }).expect(409);
      ids.leadDev = (await post("/hr/designations", hrPeople, { name: "Team Lead", departmentId: ids.dev }).expect(201)).body.data.id;
      ids.leadOps = (await post("/hr/designations", hrPeople, { name: "Team Lead", departmentId: ids.ops }).expect(201)).body.data.id;
      ids.exec = (await post("/hr/designations", hrPeople, { name: "Executive" }).expect(201)).body.data.id;
      await post("/hr/designations", hrPeople, { name: "team lead", departmentId: ids.dev }).expect(409);
    });
  });

  describe("employees", () => {
    it("adds employees with generated IDs, one profile per person, across one or both offices", async () => {
      const manager = await post("/hr/employees", hrPeople, {
        fullName: "Meera Manager", workEmail: "meera@tirvona.test", primaryOfficeId: ids.office1,
        departmentId: ids.dev, designationId: ids.leadDev, userId: managerUser.id, joiningDate: "2025-01-10",
      }).expect(201);
      ids.manager = manager.body.data.id;
      expect(manager.body.data.employeeCode).toBe("EMP-0001");

      const worker = await post("/hr/employees", hrPeople, {
        fullName: "Wasim Worker", workEmail: "Wasim@Tirvona.test", phone: "+91 98765 43210", primaryOfficeId: ids.office1,
        officeIds: [ids.office2], departmentId: ids.dev, designationId: ids.exec, reportingManagerId: ids.manager, userId: workerUser.id,
      }).expect(201);
      ids.worker = worker.body.data.id;
      expect(worker.body.data.offices.map((o: any) => o.name).sort()).toEqual(["Delhi Office", "Vrindavan Office"]);
      expect(worker.body.data.workEmail).toBe("wasim@tirvona.test");
      expect(worker.body.data.phone).toBe("9876543210");

      ids.worker2 = (await post("/hr/employees", hrPeople, {
        fullName: "Vikas Worker", employeeCode: "tv-77", primaryOfficeId: ids.office2, departmentId: ids.ops, reportingManagerId: ids.manager, userId: worker2User.id,
      }).expect(201)).body.data.id;
      ids.other = (await post("/hr/employees", hrPeople, {
        fullName: "Omkar Other", primaryOfficeId: ids.office2, departmentId: ids.ops, userId: otherUser.id,
      }).expect(201)).body.data.id;
    });

    it("prevents duplicate employees and invalid references", async () => {
      const base = { fullName: "Duplicate", primaryOfficeId: ids.office1 };
      await post("/hr/employees", hrPeople, { ...base, workEmail: "WASIM@tirvona.test" }).expect(409);
      await post("/hr/employees", hrPeople, { ...base, phone: "09876543210" }).expect(409);
      await post("/hr/employees", hrPeople, { ...base, userId: workerUser.id }).expect(409);
      await post("/hr/employees", hrPeople, { ...base, employeeCode: "TV-77" }).expect(409);
      await post("/hr/employees", hrPeople, { ...base, primaryOfficeId: "0123456789abcdef01234567" }).expect(400);
      await post("/hr/employees", hrPeople, { primaryOfficeId: ids.office1 }).expect(400);
      await post("/hr/employees", hrPeople, { ...base, departmentId: ids.ops, designationId: ids.leadDev }).expect(400);
      await post("/hr/employees", hrPeople, { ...base, role: "super_admin" }).expect(400);
    });

    it("never changes the linked login's role or permissions", async () => {
      const users = app.get(getModelToken("User"));
      const linked = await users.findById(workerUser.id).lean();
      expect(linked.role).toBe("staff");
      expect(linked.permissions).toEqual([]);
    });

    it("stops a reporting line that loops", async () => {
      await patch(`/hr/employees/${ids.manager}`, hrPeople, { reportingManagerId: ids.worker }).expect(400);
      await patch(`/hr/employees/${ids.worker}`, hrPeople, { reportingManagerId: ids.worker }).expect(400);
    });

    it("edits office and department assignments and audits only field names", async () => {
      const res = await patch(`/hr/employees/${ids.other}`, hrPeople, { departmentId: ids.dev, officeIds: [ids.office1], notes: "private note" }).expect(200);
      expect(res.body.data.departmentName).toBe("Development");
      expect(res.body.data.offices).toHaveLength(2);
      const audit = (await ctx.db.pool.query("SELECT * FROM public.audit_logs WHERE action = 'HR_EMPLOYEE_UPDATED'")).rows;
      expect(audit).toHaveLength(1);
      expect(JSON.stringify(audit[0])).not.toContain("private note");
      await patch(`/hr/employees/${ids.other}`, hrPeople, { departmentId: ids.ops, officeIds: [] }).expect(200);
    });

    it("shows contact details only to HR people staff and the employee themself", async () => {
      const full = await get("/hr/employees", hrPeople).expect(200);
      expect(full.body.total).toBe(4);
      expect(full.body.data.find((e: any) => e.id === ids.worker).workEmail).toBe("wasim@tirvona.test");

      const limited = await get("/hr/employees", hrTasks).expect(200);
      expect(limited.body.data.find((e: any) => e.id === ids.worker)).not.toHaveProperty("workEmail");
      expect(limited.body.data.find((e: any) => e.id === ids.worker)).not.toHaveProperty("notes");

      const team = await get("/hr/employees", managerUser).expect(200);
      expect(team.body.data.map((e: any) => e.id).sort()).toEqual([ids.worker, ids.worker2].sort());
      expect(team.body.data[0]).not.toHaveProperty("phone");

      await get("/hr/employees", workerUser).expect(403);
      await get(`/hr/employees/${ids.other}`, workerUser).expect(404);
      await get(`/hr/employees/${ids.other}`, managerUser).expect(404);
      const own = await get(`/hr/employees/${ids.worker}`, workerUser).expect(200);
      expect(own.body.data.workEmail).toBe("wasim@tirvona.test");
      expect(own.body.data).not.toHaveProperty("notes");
      expect(own.body.data.account).toBeNull();

      const asHr = await get(`/hr/employees/${ids.worker}`, hrPeople).expect(200);
      expect(asHr.body.data.account).toEqual({ name: workerUser.name, role: "staff", hrPermissions: [] });
    });

    it("paginates, filters, searches and sorts the directory", async () => {
      const page2 = await get("/hr/employees?limit=3&page=2&sort=name", hrPeople).expect(200);
      expect(page2.body).toMatchObject({ total: 4, page: 2, limit: 3 });
      expect(page2.body.data.map((e: any) => e.fullName)).toEqual(["Wasim Worker"]);
      const office2 = await get(`/hr/employees?officeId=${ids.office2}`, hrPeople).expect(200);
      expect(office2.body.data.map((e: any) => e.fullName).sort()).toEqual(["Omkar Other", "Vikas Worker", "Wasim Worker"]);
      const search = await get("/hr/employees?search=work", hrPeople).expect(200);
      expect(search.body.total).toBe(2);
      const regex = await get("/hr/employees?search=.*", hrPeople).expect(200);
      expect(regex.body.total).toBe(0);
      await get("/hr/employees?limit=500", hrPeople).expect(400);
    });

    it("finds a login to link by exact email only", async () => {
      const found = await get(`/hr/account-lookup?email=${encodeURIComponent(workerUser.email)}`, hrPeople).expect(200);
      expect(found.body.data).toMatchObject({ id: workerUser.id, role: "staff", linkedEmployee: { id: ids.worker } });
      expect(found.body.data).not.toHaveProperty("email");
      await get(`/hr/account-lookup?email=${encodeURIComponent(workerUser.email)}`, hrTasks).expect(403);
    });

    it("cannot deactivate an office or department that still has active employees", async () => {
      await patch(`/hr/offices/${ids.office2}`, hrPeople, { active: false }).expect(400);
      await patch(`/hr/departments/${ids.ops}`, hrPeople, { active: false }).expect(400);
    });
  });

  describe("daily tasks", () => {
    it("a manager assigns tasks only to their own team, and the employee is notified", async () => {
      const res = await post("/hr/tasks", managerUser, {
        title: "Update temple listings", description: "Fix timings", expectedOutcome: "Listings updated",
        employeeIds: [ids.worker], dueAt: inHours(4), priority: "high",
      }).expect(201);
      ids.task = res.body.data[0].id;
      expect(res.body.data[0]).toMatchObject({ status: "assigned", officeName: "Vrindavan Office", departmentName: "Development", assignedDate: today });
      expect(sentOfKind("hr.task.assigned").at(-1)!.userIds).toEqual([workerUser.id]);

      await post("/hr/tasks", managerUser, { title: "Not my team", employeeIds: [ids.other], dueAt: inHours(4) }).expect(403);
      await post("/hr/tasks", workerUser, { title: "No team", employeeIds: [ids.worker2], dueAt: inHours(4) }).expect(403);
    });

    it("needs explicit intent to give one task to several people, and is idempotent", async () => {
      const body = { title: "Weekly report", employeeIds: [ids.worker, ids.worker2], dueAt: inHours(6) };
      await post("/hr/tasks", managerUser, body).expect(400);
      const key = "group-request-0001";
      const first = await post("/hr/tasks", managerUser, { ...body, assignToMultiple: true, idempotencyKey: key }).expect(201);
      expect(first.body.data).toHaveLength(2);
      expect(first.body.data[0].groupId).toBe(first.body.data[1].groupId);
      const retry = await post("/hr/tasks", managerUser, { ...body, assignToMultiple: true, idempotencyKey: key }).expect(201);
      expect(retry.body.data.map((t: any) => t.id).sort()).toEqual(first.body.data.map((t: any) => t.id).sort());
      expect((await ctx.db.pool.query("SELECT count(*)::int AS n FROM public.hr_tasks WHERE title = 'Weekly report'")).rows[0].n).toBe(2);
      ids.groupTask2 = first.body.data.find((t: any) => t.employeeId === ids.worker2).id;
    });

    it("validates deadlines", async () => {
      await post("/hr/tasks", hrTasks, { title: "Late already", employeeIds: [ids.other], dueAt: inHours(-3) }).expect(400);
      await post("/hr/tasks", hrTasks, { title: "Bad date", employeeIds: [ids.other], dueAt: "tomorrow" }).expect(400);
      await post("/hr/tasks", hrTasks, { title: "x", employeeIds: [ids.other], dueAt: inHours(2), priority: "critical" }).expect(400);
    });

    it("employees see only their own tasks; other ids are simply not found", async () => {
      await get("/hr/tasks", workerUser).expect(403);
      const mine = await get("/hr/me/tasks?view=today", workerUser).expect(200);
      expect(mine.body.data.every((t: any) => t.employeeId === ids.worker)).toBe(true);
      expect(mine.body.total).toBe(2);
      await get(`/hr/tasks/${ids.task}`, worker2User).expect(404);
      await post(`/hr/tasks/${ids.task}/start`, worker2User).expect(404);
      await get(`/hr/tasks/${ids.task}`, otherUser).expect(404);
      await get(`/hr/tasks/${ids.task}`, customer).expect(404);
      await get("/hr/tasks/not-an-id", superAdmin).expect(404);
    });

    it("runs the full status flow with review and keeps the history", async () => {
      const path = `/hr/tasks/${ids.task}`;
      await post(`${path}/start`, workerUser).expect(201);
      await post(`${path}/start`, workerUser).expect(400);
      // The manager cannot do the assignee's work for them.
      await post(`${path}/submit`, managerUser, { completionSummary: "done" }).expect(403);
      await post(`${path}/progress`, workerUser, { progressPercent: 50, note: "Half the listings fixed" }).expect(201);
      await post(`${path}/block`, workerUser, { reason: "Waiting for temple timings" }).expect(201);
      expect(sentOfKind("hr.task.blocked").at(-1)!.userIds).toEqual([managerUser.id]);
      await post(`${path}/submit`, workerUser, { completionSummary: "done" }).expect(400);
      await post(`${path}/unblock`, managerUser, { note: "Timings shared" }).expect(201);
      await post(`${path}/submit`, workerUser, { completionSummary: "All listings updated", deliverableUrl: "https://example.test/sheet" }).expect(201);
      expect(sentOfKind("hr.task.submitted").at(-1)!.userIds).toEqual([managerUser.id]);

      await post(`${path}/review`, workerUser, { decision: "approve" }).expect(403);
      await post(`${path}/review`, managerUser, { decision: "reject" }).expect(400);
      const rejected = await post(`${path}/review`, managerUser, { decision: "reject", comment: "Two temples missing" }).expect(201);
      expect(rejected.body.data).toMatchObject({ status: "in_progress", reviewStatus: "rejected", rejectionCount: 1 });

      await post(`${path}/submit`, workerUser, { completionSummary: "Added the missing temples" }).expect(201);
      const approved = await post(`${path}/review`, managerUser, { decision: "approve", comment: "Good" }).expect(201);
      expect(approved.body.data).toMatchObject({ status: "completed", reviewStatus: "approved" });
      expect(approved.body.data.completedAt).toBeTruthy();
      // A retried approval fails instead of approving (and notifying) twice.
      await post(`${path}/review`, managerUser, { decision: "approve" }).expect(400);
      expect(sentOfKind("hr.task.approved")).toHaveLength(1);

      await post(`${path}/reopen`, managerUser, {}).expect(400);
      const reopened = await post(`${path}/reopen`, managerUser, { reason: "Client asked for photos too" }).expect(201);
      expect(reopened.body.data.status).toBe("in_progress");
      expect(reopened.body.data.completedAt).toBeNull();

      const detail = await get(path, workerUser).expect(200);
      expect(detail.body.data.history.map((e: any) => e.type)).toEqual([
        "created", "started", "progress", "blocked", "unblocked", "submitted", "rejected", "submitted", "approved", "reopened",
      ]);
      expect(detail.body.data.permissions).toEqual({ work: true, manage: false, review: false });
      const asManager = await get(path, managerUser).expect(200);
      expect(asManager.body.data.permissions).toEqual({ work: false, manage: true, review: true });
    });

    it("reassigns within the manager's team only and records who it moved from", async () => {
      const path = `/hr/tasks/${ids.task}`;
      await post(`${path}/reassign`, managerUser, { employeeId: ids.other, reason: "Workload" }).expect(403);
      const moved = await post(`${path}/reassign`, managerUser, { employeeId: ids.worker2, reason: "Workload" }).expect(201);
      expect(moved.body.data).toMatchObject({ employeeId: ids.worker2, status: "assigned", officeName: "Delhi Office", departmentName: "Operations" });
      const last = moved.body.data.history.at(-1);
      expect(last).toMatchObject({ type: "reassigned", message: "Workload" });
      expect(last.data).toMatchObject({ fromEmployeeId: ids.worker, toEmployeeId: ids.worker2 });
      expect(sentOfKind("hr.task.reassigned").at(-1)!.userIds).toEqual([workerUser.id]);
      // The previous assignee loses access to it.
      await get(path, workerUser).expect(404);
    });

    it("records deadline changes and tells the employee", async () => {
      const due = inHours(30);
      const res = await patch(`/hr/tasks/${ids.task}`, hrTasks, { dueAt: due, priority: "urgent" }).expect(200);
      expect(new Date(res.body.data.dueAt).toISOString()).toBe(due);
      expect(res.body.data.history.slice(-2).map((e: any) => e.type)).toEqual(["edited", "due_changed"]);
      expect(sentOfKind("hr.task.due_changed").at(-1)!.userIds).toEqual([worker2User.id]);
      await patch(`/hr/tasks/${ids.task}`, workerUser, { title: "Mine now" }).expect(404);
      await patch(`/hr/tasks/${ids.task}`, worker2User, { title: "Mine now" }).expect(403);
    });

    it("comments go into the history; there is no way to edit or delete history", async () => {
      await post(`/hr/tasks/${ids.task}/comments`, worker2User, { message: "Starting tomorrow" }).expect(201);
      await http().delete(`/api/hr/tasks/${ids.task}`).set(as(superAdmin)).expect(404);
      await patch(`/hr/tasks/${ids.task}/history`, superAdmin, {}).expect(404);
    });

    it("cancels with a reason, after which work on it is refused", async () => {
      await post(`/hr/tasks/${ids.task}/cancel`, managerUser, {}).expect(400);
      await post(`/hr/tasks/${ids.task}/cancel`, managerUser, { reason: "No longer needed" }).expect(201);
      await post(`/hr/tasks/${ids.task}/progress`, worker2User, { note: "trying" }).expect(400);
    });

    it("overdue tasks stay open, are listed as overdue, and get one reminder", async () => {
      const tasks = app.get(getModelToken("HrTask"));
      const late = await tasks.create({
        taskNumber: "HT-TEST-LATE", title: "Missed deadline", employeeId: ids.worker, officeId: ids.office1, departmentId: ids.dev,
        createdBy: managerUser.id, createdByName: managerUser.name, assignedDate: addDays(today, -1),
        dueAt: new Date(Date.now() - 2 * 3_600_000), priority: "urgent", status: "assigned",
      });
      const overdue = await get("/hr/tasks?overdue=true", superAdmin).expect(200);
      expect(overdue.body.data.map((t: any) => t.id)).toContain(String(late._id));
      expect(overdue.body.data.every((t: any) => t.overdue)).toBe(true);

      const service = app.get(HrTasksService);
      const first = await service.sweepReminders();
      expect(first.overdue).toBe(1);
      expect((await service.sweepReminders()).overdue).toBe(0);
      expect(sentOfKind("hr.task.overdue").map((n) => n.userIds)).toEqual([[workerUser.id], [managerUser.id]]);
      expect((await tasks.findById(late._id).lean()).status).toBe("assigned");
    });

    it("filters and paginates the task list", async () => {
      const cancelled = await get("/hr/tasks?status=cancelled", superAdmin).expect(200);
      expect(cancelled.body.data.map((t: any) => t.id)).toEqual([ids.task]);
      const both = await get("/hr/tasks?status=assigned,cancelled&limit=1", superAdmin).expect(200);
      expect(both.body.total).toBeGreaterThanOrEqual(2);
      expect(both.body.data).toHaveLength(1);
      const byEmployee = await get(`/hr/tasks?employeeId=${ids.worker2}`, superAdmin).expect(200);
      expect(byEmployee.body.data.every((t: any) => t.employeeId === ids.worker2)).toBe(true);
      const byOffice = await get(`/hr/tasks?officeId=${ids.office2}&date=${today}`, superAdmin).expect(200);
      expect(byOffice.body.data.every((t: any) => t.officeId === ids.office2)).toBe(true);
      // A manager filtering for someone outside their team gets nothing back.
      const outside = await get(`/hr/tasks?employeeId=${ids.other}`, managerUser).expect(200);
      expect(outside.body.total).toBe(0);
      await get("/hr/tasks?status=finished", superAdmin).expect(400);
    });
  });

  describe("attendance, leave and corrections", () => {
    it("employees check in and out once a day", async () => {
      await post("/hr/me/attendance/check-in", customer).expect(403);
      await post("/hr/me/attendance/check-in", workerUser, { officeId: ids.office2 }).expect(201);
      await post("/hr/me/attendance/check-in", workerUser).expect(409);
      await post("/hr/me/attendance/check-out", worker2User).expect(400);
      await post("/hr/me/attendance/check-out", workerUser).expect(201);
      await post("/hr/me/attendance/check-out", workerUser).expect(409);
      // An employee can only check in at one of their own offices.
      await post("/hr/me/attendance/check-in", otherUser, { officeId: ids.office1 }).expect(400);
      const todayRow = await get("/hr/me/attendance/today", workerUser).expect(200);
      expect(todayRow.body.data.attendance).toMatchObject({ status: "present", source: "self", officeId: ids.office2 });
    });

    it("leave requests are approved by HR attendance staff and block overlaps", async () => {
      const leave = await post("/hr/me/leaves", worker2User, { fromDate: today, toDate: addDays(today, 1), type: "sick", reason: "Fever" }).expect(201);
      await post("/hr/me/leaves", worker2User, { fromDate: addDays(today, 1), toDate: addDays(today, 2), type: "casual", reason: "Trip" }).expect(409);
      await post("/hr/me/leaves", worker2User, { fromDate: addDays(today, 3), toDate: addDays(today, 2), type: "casual", reason: "Backwards" }).expect(400);
      await post(`/hr/leaves/${leave.body.data.id}/decision`, managerUser, { decision: "approve" }).expect(403);
      await post(`/hr/leaves/${leave.body.data.id}/decision`, hrAttendance, { decision: "approve" }).expect(201);
      await post(`/hr/leaves/${leave.body.data.id}/decision`, hrAttendance, { decision: "reject" }).expect(400);
      expect(sentOfKind("hr.leave.approved").at(-1)!.userIds).toEqual([worker2User.id]);
    });

    it("the register shows each employee's state for the day", async () => {
      await get("/hr/attendance", workerUser).expect(403);
      await get("/hr/attendance", hrTasks).expect(403);
      const reg = await get(`/hr/attendance?date=${today}`, hrAttendance).expect(200);
      const state = Object.fromEntries(reg.body.data.map((r: any) => [r.employeeId, r.state]));
      expect(state).toEqual({ [ids.manager]: "not_marked", [ids.worker]: "present", [ids.worker2]: "on_leave", [ids.other]: "not_marked" });
      expect(reg.body.counts).toMatchObject({ present: 1, on_leave: 1, not_marked: 2 });
      const onlyLeave = await get(`/hr/attendance?date=${today}&status=on_leave`, hrAttendance).expect(200);
      expect(onlyLeave.body.total).toBe(1);
    });

    it("HR entries and approved corrections are audited with before and after", async () => {
      const yesterday = addDays(today, -1);
      await put("/hr/attendance", hrAttendance, { employeeId: ids.other, date: yesterday, status: "absent" }).expect(400);
      await put("/hr/attendance", hrAttendance, { employeeId: ids.other, date: yesterday, status: "absent", reason: "No show" }).expect(200);
      await put("/hr/attendance", hrAttendance, { employeeId: ids.other, date: addDays(today, 1), status: "present", reason: "Future" }).expect(400);

      const checkIn = new Date(`${yesterday}T09:30:00+05:30`).toISOString();
      const checkOut = new Date(`${yesterday}T18:00:00+05:30`).toISOString();
      const request = await post("/hr/me/attendance-corrections", otherUser, {
        date: yesterday, requestedStatus: "present", requestedCheckInAt: checkIn, requestedCheckOutAt: checkOut, reason: "I was at the Delhi office",
      }).expect(201);
      await post("/hr/me/attendance-corrections", otherUser, { date: yesterday, requestedStatus: "present", reason: "Again please" }).expect(409);
      await post(`/hr/attendance-corrections/${request.body.data.id}/decision`, hrAttendance, { decision: "approve", note: "Verified" }).expect(201);
      await post(`/hr/attendance-corrections/${request.body.data.id}/decision`, hrAttendance, { decision: "approve" }).expect(400);

      const decided = (await get("/hr/attendance-corrections?status=approved", hrAttendance).expect(200)).body.data[0];
      expect(decided.before).toMatchObject({ status: "absent" });
      expect(decided.after).toMatchObject({ status: "present" });
      const audit = (await ctx.db.pool.query("SELECT action FROM public.audit_logs WHERE module = 'HR' AND action LIKE 'HR_ATTENDANCE%' ORDER BY created_at")).rows;
      expect(audit.map((a: any) => a.action)).toEqual(["HR_ATTENDANCE_MARKED", "HR_ATTENDANCE_CORRECTION_APPROVED"]);
    });

    it("summarises attendance over a range", async () => {
      const res = await get(`/hr/attendance/summary?from=${addDays(today, -1)}&to=${today}&employeeId=${ids.other}`, hrAttendance).expect(200);
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0].present).toBe(1);
      await get(`/hr/attendance/summary?from=2025-01-01&to=2026-12-31`, hrAttendance).expect(400);
      await get(`/hr/reports/attendance?from=${today}&to=${today}`, hrReports).expect(200);
      await get(`/hr/reports/attendance?from=${today}&to=${today}`, hrTasks).expect(403);
    });
  });

  describe("dashboard and reports", () => {
    it("counts everything from the records", async () => {
      const res = await get(`/hr/dashboard?date=${today}`, hrReports).expect(200);
      const d = res.body.data;
      expect(d.employees).toMatchObject({ active: 4, present: 1, onLeave: 1, absentOrNotCheckedIn: 2 });
      const byOffice = Object.fromEntries(d.employees.byOffice.map((o: any) => [o.name, o.count]));
      expect(byOffice).toEqual({ "Delhi Office": 3, "Vrindavan Office": 2 });
      expect(d.tasks.overdue).toBe(1);
      expect(d.tasks.assigned).toBe(3);
      expect(d.tasks.assignedByStatus).toMatchObject({ assigned: 2, cancelled: 1 });
      const office1 = await get(`/hr/dashboard?date=${today}&officeId=${ids.office1}`, superAdmin).expect(200);
      expect(office1.body.data.employees.byOffice).toHaveLength(1);
      expect(office1.body.data.employees.active).toBe(2);
    });

    it("reports per employee, office and department with clearly defined metrics", async () => {
      const from = addDays(today, -7);
      const byEmployee = await get(`/hr/reports/tasks?from=${from}&to=${today}`, hrReports).expect(200);
      expect(byEmployee.body.data.totals.assigned).toBe(4);
      const worker = byEmployee.body.data.data.find((r: any) => r.key === ids.worker);
      expect(worker).toMatchObject({ label: "Wasim Worker", assigned: 2, overdue: 1, completedByPriority: { low: 0, medium: 0, high: 0, urgent: 0 } });
      const byOffice = await get(`/hr/reports/tasks?from=${from}&to=${today}&groupBy=office`, hrReports).expect(200);
      expect(byOffice.body.data.data.map((r: any) => r.label).sort()).toEqual(["Delhi Office", "Vrindavan Office"]);
      const byDepartment = await get(`/hr/reports/tasks?from=${from}&to=${today}&groupBy=department`, hrReports).expect(200);
      expect(byDepartment.body.data.data.map((r: any) => r.label).sort()).toEqual(["Development", "Operations"]);
      await get(`/hr/reports/tasks?from=${today}&to=${from}`, hrReports).expect(400);
    });
  });

  describe("deactivation", () => {
    it("needs a reason, keeps the record, and ends the employee's HR access", async () => {
      await patch(`/hr/employees/${ids.worker2}/status`, hrPeople, { status: "inactive" }).expect(400);
      const res = await patch(`/hr/employees/${ids.worker2}/status`, hrPeople, { status: "inactive", reason: "Left the company" }).expect(200);
      expect(res.body.data).toMatchObject({ status: "inactive", openTasks: 1 });
      await get("/hr/me/tasks", worker2User).expect(403);
      const directory = await get("/hr/employees/directory", hrTasks).expect(200);
      expect(directory.body.data.map((e: any) => e.id)).not.toContain(ids.worker2);
      const all = await get("/hr/employees?status=all", hrPeople).expect(200);
      expect(all.body.total).toBe(4);
      const reactivated = await patch(`/hr/employees/${ids.worker2}/status`, hrPeople, { status: "active" }).expect(200);
      expect(reactivated.body.data.status).toBe("active");
    });
  });
});
