import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { TransactionService } from "../../../common/database/transaction.service";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  HR_OPEN_TASK_STATUSES,
  type HrTaskEventType,
  type HrTaskStatus,
} from "../domain/hr.constants";
import { canTransition, isOverdue, overdueFilter } from "../domain/hr-tasks";
import { isDateKey, todayIst } from "../domain/hr-attendance";
import { istDayBounds } from "../../day-stay/domain/day-stay-time";
import type {
  HrMyTasksQueryDto,
  HrTaskCreateDto,
  HrTaskQueryDto,
  HrTaskSubmitDto,
  HrTaskUpdateDto,
} from "../presentation/hr.dto";
import { HrAccessService, type HrAccess } from "./hr-access.service";
import { HrNotificationService } from "./hr-notification.service";
import { HrOrganisationService, isEntityId } from "./hr-organisation.service";

/** A due time a few minutes in the past is a slow form, not a mistake. */
const PAST_TOLERANCE_MS = 5 * 60_000;

const employeeLink = (taskId: string) => `/admin/hr/my-work?task=${taskId}`;
const managerLink = (taskId: string) => `/admin/hr/tasks?task=${taskId}`;

/** What the caller may do with one task. */
interface TaskRoles {
  /** The employee the task is assigned to. */
  assignee: boolean;
  /** HR task permission, or the assignee's reporting manager. */
  manager: boolean;
}

interface TransitionSpec {
  /** Who may do it. */
  who: (roles: TaskRoles) => boolean;
  /** Statuses it may start from. */
  from: HrTaskStatus[];
  /** New status (omit to keep the current one). */
  to?: HrTaskStatus;
  set?: Record<string, unknown>;
  unset?: string[];
  inc?: Record<string, number>;
  event: { type: HrTaskEventType; message?: string; data?: Record<string, unknown> };
  /** Error text when the task is in a status this action cannot start from. */
  wrongStatus: string;
}

@Injectable()
export class HrTasksService {
  private readonly logger = new Logger(HrTasksService.name);

  constructor(
    @InjectModel("HrTask") private readonly tasks: Model<any>,
    @InjectModel("HrTaskEvent") private readonly events: Model<any>,
    @InjectModel("HrEmployee") private readonly employees: Model<any>,
    private readonly organisation: HrOrganisationService,
    private readonly notifications: HrNotificationService,
    private readonly transactions: TransactionService,
  ) {}

  // ------------------------------------------------------------ scope and views

  /** Tasks the caller may list on the Daily Tasks page: all for HR task staff, the team for a manager. */
  private listScope(access: HrAccess): Record<string, unknown> {
    if (access.can.tasks) return {};
    if (access.teamIds.length) return { employeeId: { $in: access.teamIds } };
    throw new ForbiddenException("Your account cannot see other employees' tasks.");
  }

  /** Tasks the caller may open: the list scope plus their own. */
  private detailScope(access: HrAccess): Record<string, unknown> | null {
    if (access.can.tasks) return {};
    const ids = [...access.teamIds, ...(access.employee ? [String(access.employee._id)] : [])];
    return ids.length ? { employeeId: { $in: ids } } : null;
  }

  private rolesFor(access: HrAccess, task: any): TaskRoles {
    const employeeId = String(task.employeeId);
    return {
      assignee: !!access.employee && String(access.employee._id) === employeeId,
      manager: access.can.tasks || access.teamIds.includes(employeeId),
    };
  }

  private async views(rows: any[], now = new Date()) {
    const employeeIds = [...new Set(rows.map((t) => String(t.employeeId)))];
    const [people, names] = await Promise.all([
      employeeIds.length
        ? this.employees.find({ _id: { $in: employeeIds } }).select("fullName employeeCode").lean()
        : [],
      this.organisation.names({ offices: rows.map((t) => t.officeId), departments: rows.map((t) => t.departmentId) }),
    ]);
    const byId = new Map<string, any>(people.map((p: any) => [String(p._id), p]));
    return rows.map((t) => {
      const person = byId.get(String(t.employeeId));
      return {
        id: String(t._id),
        taskNumber: t.taskNumber,
        groupId: t.groupId ?? null,
        title: t.title,
        description: t.description ?? "",
        expectedOutcome: t.expectedOutcome ?? "",
        employeeId: String(t.employeeId),
        employeeName: person?.fullName ?? "",
        employeeCode: person?.employeeCode ?? "",
        officeId: t.officeId ? String(t.officeId) : null,
        officeName: t.officeId ? names.offices.get(String(t.officeId)) ?? null : null,
        departmentId: t.departmentId ? String(t.departmentId) : null,
        departmentName: t.departmentId ? names.departments.get(String(t.departmentId)) ?? null : null,
        createdByName: t.createdByName ?? "",
        assignedDate: t.assignedDate,
        dueAt: t.dueAt,
        priority: t.priority,
        status: t.status,
        overdue: isOverdue(t, now),
        progressPercent: t.progressPercent ?? 0,
        progressNote: t.progressNote ?? "",
        blockedReason: t.blockedReason ?? "",
        completionSummary: t.completionSummary ?? "",
        deliverableUrl: t.deliverableUrl ?? "",
        reviewStatus: t.reviewStatus ?? "none",
        reviewComment: t.reviewComment ?? "",
        reviewedByName: t.reviewedByName ?? "",
        reviewedAt: t.reviewedAt ?? null,
        rejectionCount: t.rejectionCount ?? 0,
        startedAt: t.startedAt ?? null,
        submittedAt: t.submittedAt ?? null,
        completedAt: t.completedAt ?? null,
        cancelledAt: t.cancelledAt ?? null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
  }

  // ------------------------------------------------------------ reads

  async list(access: HrAccess, query: HrTaskQueryDto) {
    const and: Record<string, unknown>[] = [this.listScope(access)];
    if (query.employeeId) and.push({ employeeId: query.employeeId });
    if (query.officeId) and.push({ officeId: query.officeId });
    if (query.departmentId) and.push({ departmentId: query.departmentId });
    if (query.status?.length) and.push({ status: { $in: query.status } });
    if (query.priority) and.push({ priority: query.priority });
    if (query.date) and.push({ assignedDate: query.date });
    if (query.from) and.push({ assignedDate: { $gte: query.from } });
    if (query.to) and.push({ assignedDate: { $lte: query.to } });
    if (query.completedOn) {
      const { start, end } = istDayBounds(query.completedOn);
      and.push({ status: "completed", completedAt: { $gte: start, $lte: end } });
    }
    if (query.overdue) and.push(overdueFilter());
    if (query.search) {
      const pattern = { $regex: escapeRegex(query.search), $options: "i" };
      and.push({ $or: [{ title: pattern }, { taskNumber: pattern }] });
    }
    const filter = { $and: and };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [rows, total] = await Promise.all([
      this.tasks.find(filter).sort({ assignedDate: -1, dueAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.tasks.countDocuments(filter),
    ]);
    return { data: await this.views(rows), total, page, limit };
  }

  /** The signed-in employee's own tasks. */
  async myTasks(access: HrAccess, query: HrMyTasksQueryDto) {
    const employee = HrAccessService.requireEmployee(access);
    const view = query.view ?? "today";
    const filter: Record<string, unknown> =
      view === "today"
        ? { employeeId: employee._id, assignedDate: todayIst() }
        : view === "open"
          ? { employeeId: employee._id, status: { $in: [...HR_OPEN_TASK_STATUSES, "submitted"] } }
          : { employeeId: employee._id, status: { $in: ["completed", "cancelled"] } };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sort: Record<string, 1 | -1> = view === "history" ? { updatedAt: -1, _id: 1 } : { dueAt: 1, _id: 1 };
    const [rows, total] = await Promise.all([
      this.tasks.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      this.tasks.countDocuments(filter),
    ]);
    return { data: await this.views(rows), total, page, limit };
  }

  /** One task with its full history and what the caller may do with it. */
  async get(access: HrAccess, id: string) {
    const task = await this.load(access, id);
    const [view] = await this.views([task]);
    const history = await this.events.find({ taskId: task._id }).sort({ createdAt: 1, _id: 1 }).limit(500).lean();
    const roles = this.rolesFor(access, task);
    return {
      ...view,
      history: history.map((e: any) => ({
        id: String(e._id),
        type: e.type,
        actorName: e.actorName ?? "",
        fromStatus: e.fromStatus ?? null,
        toStatus: e.toStatus ?? null,
        message: e.message ?? "",
        data: e.data ?? null,
        createdAt: e.createdAt,
      })),
      permissions: {
        work: roles.assignee,
        manage: roles.manager,
        // Nobody approves their own work, whatever their permissions.
        review: roles.manager && !roles.assignee,
      },
    };
  }

  private async load(access: HrAccess, id: string) {
    const scope = this.detailScope(access);
    if (!scope || !isEntityId(id)) throw new NotFoundException("Task not found");
    // The scope is part of the query, so another team's task id simply is not found.
    const task = await this.tasks.findOne({ _id: id, ...scope }).lean();
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  // ------------------------------------------------------------ create

  async create(access: HrAccess, dto: HrTaskCreateDto) {
    if (!access.can.tasks && !access.teamIds.length)
      throw new ForbiddenException("Your account cannot assign tasks.");
    const employeeIds = [...new Set(dto.employeeIds)];
    if (employeeIds.length > 1 && !dto.assignToMultiple)
      throw new BadRequestException("Confirm that this task should be given to each selected employee.");

    const keyFor = (employeeId: string) => (dto.idempotencyKey ? `${dto.idempotencyKey}:${employeeId}` : undefined);
    if (dto.idempotencyKey) {
      const earlier = await this.tasks.find({ idempotencyKey: { $in: employeeIds.map(keyFor) } }).lean();
      if (earlier.length === employeeIds.length) return this.views(earlier);
      if (earlier.length) throw new ConflictException("This request was already partly processed. Reload the task list.");
    }

    const people = await this.employees.find({ _id: { $in: employeeIds }, status: "active" }).lean();
    if (people.length !== employeeIds.length) throw new BadRequestException("Choose active employees only.");
    if (!access.can.tasks && people.some((p: any) => !access.teamIds.includes(String(p._id))))
      throw new ForbiddenException("You can only assign tasks to employees who report to you.");

    const dueAt = new Date(dto.dueAt);
    if (Number.isNaN(dueAt.getTime())) throw new BadRequestException("The due time is not a valid date.");
    if (dueAt.getTime() < Date.now() - PAST_TOLERANCE_MS) throw new BadRequestException("The due time is already in the past.");
    const assignedDate = dto.assignedDate ?? todayIst();
    if (!isDateKey(assignedDate)) throw new BadRequestException("Choose a valid task date.");
    if (dueAt.getTime() < istDayBounds(assignedDate).start.getTime())
      throw new BadRequestException("The due time cannot be before the task date.");

    const groupId = employeeIds.length > 1 ? `G-${randomBytes(6).toString("hex")}` : undefined;
    const created = await this.transactions.run(async (session) => {
      const rows: any[] = [];
      for (const person of people) {
        const [task] = await this.createWithNumber(
          {
            groupId,
            title: dto.title,
            description: dto.description ?? "",
            expectedOutcome: dto.expectedOutcome ?? "",
            employeeId: person._id,
            officeId: person.primaryOfficeId ?? null,
            departmentId: person.departmentId ?? null,
            createdBy: access.userId,
            createdByName: access.userName,
            assignedDate,
            dueAt,
            priority: dto.priority ?? "medium",
            status: "assigned",
            idempotencyKey: keyFor(String(person._id)),
          },
          session,
        );
        await this.events.create(
          [{ taskId: task._id, type: "created", actorId: access.userId, actorName: access.userName, toStatus: "assigned", data: groupId ? { groupId, groupSize: people.length } : undefined }],
          { session },
        );
        rows.push(task.toObject ? task.toObject() : task);
      }
      return rows;
    });

    for (const task of created) {
      const userIds = await this.notifications.userIdsOf([task.employeeId]);
      await this.notifications.send(
        userIds,
        "New task assigned",
        `${task.title} (due ${this.formatDue(task.dueAt)})`,
        employeeLink(String(task._id)),
        "hr.task.assigned",
      );
    }
    return this.views(created);
  }

  private async createWithNumber(fields: Record<string, unknown>, session: any): Promise<any[]> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.tasks.create([{ ...fields, taskNumber: this.taskNumber() }], { session });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000 || attempt >= 3) throw error;
      }
    }
  }

  private taskNumber() {
    const d = todayIst().replace(/-/g, "").slice(2);
    return `HT-${d}-${randomBytes(3).toString("hex").toUpperCase()}`;
  }

  private formatDue(dueAt: Date) {
    return new Date(dueAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  // ------------------------------------------------------------ status changes

  /**
   * Applies one status change as a conditional update (only if the status is still what was
   * read), with its history entry in the same transaction. A retried or concurrent request
   * therefore fails instead of applying, or notifying, twice.
   */
  private async transition(access: HrAccess, id: string, spec: TransitionSpec) {
    const task = await this.load(access, id);
    const roles = this.rolesFor(access, task);
    if (!spec.who(roles)) throw new ForbiddenException("You cannot do this on this task.");
    const from = task.status as HrTaskStatus;
    if (!spec.from.includes(from)) throw new BadRequestException(spec.wrongStatus);
    if (spec.to && spec.to !== from && !canTransition(from, spec.to))
      throw new BadRequestException(spec.wrongStatus);

    const update: Record<string, unknown> = {
      $set: { ...(spec.set ?? {}), ...(spec.to ? { status: spec.to } : {}) },
    };
    if (spec.unset?.length) update.$unset = Object.fromEntries(spec.unset.map((f) => [f, ""]));
    if (spec.inc) update.$inc = spec.inc;

    const updated = await this.transactions.run(async (session) => {
      const row = await this.tasks.findOneAndUpdate({ _id: task._id, status: from }, update, { new: true, session }).lean();
      if (!row) throw new ConflictException("This task was just changed by someone else. Reload it and try again.");
      await this.events.create(
        [
          {
            taskId: task._id,
            type: spec.event.type,
            actorId: access.userId,
            actorName: access.userName,
            fromStatus: from,
            toStatus: (row as any).status,
            message: spec.event.message ?? "",
            data: spec.event.data,
          },
        ],
        { session },
      );
      return row as any;
    });
    return { before: task, after: updated };
  }

  async start(access: HrAccess, id: string) {
    const { after } = await this.transition(access, id, {
      who: (r) => r.assignee,
      from: ["assigned"],
      to: "in_progress",
      set: { startedAt: new Date() },
      event: { type: "started" },
      wrongStatus: "Only a newly assigned task can be started.",
    });
    return this.get(access, String(after._id));
  }

  async progress(access: HrAccess, id: string, progressPercent: number | undefined, note: string) {
    const task = await this.load(access, id);
    const set: Record<string, unknown> = { progressNote: note };
    if (progressPercent !== undefined) set.progressPercent = progressPercent;
    if (task.status === "assigned") set.startedAt = new Date();
    const { after } = await this.transition(access, id, {
      who: (r) => r.assignee,
      from: ["assigned", "in_progress"],
      to: "in_progress",
      set,
      event: { type: "progress", message: note, data: progressPercent !== undefined ? { progressPercent } : undefined },
      wrongStatus: "Progress can only be updated on a task that is assigned or in progress.",
    });
    return this.get(access, String(after._id));
  }

  async block(access: HrAccess, id: string, reason: string) {
    const { after } = await this.transition(access, id, {
      who: (r) => r.assignee,
      from: ["assigned", "in_progress"],
      to: "blocked",
      set: { blockedReason: reason },
      event: { type: "blocked", message: reason },
      wrongStatus: "Only a task that is assigned or in progress can be marked blocked.",
    });
    await this.notifyManagers(after, "Task blocked", `${after.title}: ${reason}`, "hr.task.blocked");
    return this.get(access, String(after._id));
  }

  async unblock(access: HrAccess, id: string, note?: string) {
    const { after } = await this.transition(access, id, {
      who: (r) => r.assignee || r.manager,
      from: ["blocked"],
      to: "in_progress",
      set: { blockedReason: "" },
      event: { type: "unblocked", message: note ?? "" },
      wrongStatus: "This task is not blocked.",
    });
    return this.get(access, String(after._id));
  }

  async submit(access: HrAccess, id: string, dto: HrTaskSubmitDto) {
    const { after } = await this.transition(access, id, {
      who: (r) => r.assignee,
      from: ["assigned", "in_progress"],
      to: "submitted",
      set: {
        completionSummary: dto.completionSummary,
        deliverableUrl: dto.deliverableUrl ?? "",
        submittedAt: new Date(),
        reviewStatus: "pending",
        reviewComment: "",
        progressPercent: 100,
      },
      event: { type: "submitted", message: dto.completionSummary, data: dto.deliverableUrl ? { deliverableUrl: dto.deliverableUrl } : undefined },
      wrongStatus: "Only a task that is assigned or in progress can be submitted for review.",
    });
    await this.notifyManagers(after, "Task ready for review", `${after.title} was submitted for review.`, "hr.task.submitted");
    return this.get(access, String(after._id));
  }

  async review(access: HrAccess, id: string, decision: "approve" | "reject", comment?: string) {
    if (decision === "reject" && !comment?.trim())
      throw new BadRequestException("Say what needs to change when sending work back.");
    const now = new Date();
    const { after } = await this.transition(access, id, {
      // Separation of duties: the assignee never reviews their own work.
      who: (r) => r.manager && !r.assignee,
      from: ["submitted"],
      to: decision === "approve" ? "completed" : "in_progress",
      set:
        decision === "approve"
          ? { reviewStatus: "approved", reviewComment: comment ?? "", reviewedBy: access.userId, reviewedByName: access.userName, reviewedAt: now, completedAt: now }
          : { reviewStatus: "rejected", reviewComment: comment, reviewedBy: access.userId, reviewedByName: access.userName, reviewedAt: now },
      inc: decision === "reject" ? { rejectionCount: 1 } : undefined,
      event: { type: decision === "approve" ? "approved" : "rejected", message: comment ?? "" },
      wrongStatus: "Only work submitted for review can be approved or sent back.",
    });
    const userIds = await this.notifications.userIdsOf([after.employeeId]);
    await this.notifications.send(
      userIds,
      decision === "approve" ? "Task approved" : "Task sent back",
      decision === "approve" ? `${after.title} was approved.` : `${after.title}: ${comment}`,
      employeeLink(String(after._id)),
      decision === "approve" ? "hr.task.approved" : "hr.task.rejected",
    );
    return this.get(access, String(after._id));
  }

  async reopen(access: HrAccess, id: string, reason: string) {
    const task = await this.load(access, id);
    const fromCompleted = task.status === "completed";
    const { after } = await this.transition(access, id, {
      who: (r) => r.manager,
      from: ["completed", "cancelled"],
      to: fromCompleted ? "in_progress" : "assigned",
      set: { reviewStatus: "none", dueSoonNotified: false, overdueNotified: false },
      unset: fromCompleted ? ["completedAt"] : ["cancelledAt"],
      event: { type: "reopened", message: reason },
      wrongStatus: "Only a completed or cancelled task can be reopened.",
    });
    const userIds = await this.notifications.userIdsOf([after.employeeId]);
    await this.notifications.send(userIds, "Task reopened", `${after.title}: ${reason}`, employeeLink(String(after._id)), "hr.task.reopened");
    return this.get(access, String(after._id));
  }

  async cancel(access: HrAccess, id: string, reason: string) {
    const { after } = await this.transition(access, id, {
      who: (r) => r.manager,
      from: ["assigned", "in_progress", "blocked", "submitted"],
      to: "cancelled",
      set: { cancelledAt: new Date() },
      event: { type: "cancelled", message: reason },
      wrongStatus: "This task is already completed or cancelled.",
    });
    const userIds = await this.notifications.userIdsOf([after.employeeId]);
    await this.notifications.send(userIds, "Task cancelled", `${after.title}: ${reason}`, employeeLink(String(after._id)), "hr.task.cancelled");
    return this.get(access, String(after._id));
  }

  async reassign(access: HrAccess, id: string, employeeId: string, reason: string) {
    const task = await this.load(access, id);
    if (String(task.employeeId) === employeeId) throw new BadRequestException("The task is already assigned to this employee.");
    const person = isEntityId(employeeId) ? await this.employees.findOne({ _id: employeeId, status: "active" }).lean() : null;
    if (!person) throw new BadRequestException("Choose an active employee.");
    if (!access.can.tasks && !access.teamIds.includes(employeeId))
      throw new ForbiddenException("You can only reassign to employees who report to you.");
    const previous = await this.employees.findById(task.employeeId).select("fullName").lean();
    const { after } = await this.transition(access, id, {
      who: (r) => r.manager,
      from: HR_OPEN_TASK_STATUSES,
      to: "assigned",
      set: {
        employeeId: person._id,
        officeId: person.primaryOfficeId ?? null,
        departmentId: person.departmentId ?? null,
        blockedReason: "",
        progressPercent: 0,
        dueSoonNotified: false,
        overdueNotified: false,
      },
      unset: ["startedAt"],
      event: {
        type: "reassigned",
        message: reason,
        data: { fromEmployeeId: String(task.employeeId), fromEmployeeName: previous?.fullName ?? "", toEmployeeId: employeeId, toEmployeeName: person.fullName },
      },
      wrongStatus: "Only open tasks (assigned, in progress or blocked) can be reassigned.",
    });
    const [newUser] = await this.notifications.userIdsOf([person._id]);
    const [oldUser] = await this.notifications.userIdsOf([task.employeeId]);
    await this.notifications.send([newUser], "Task reassigned to you", `${after.title} (due ${this.formatDue(after.dueAt)})`, employeeLink(String(after._id)), "hr.task.assigned");
    await this.notifications.send([oldUser], "Task reassigned", `${after.title} was reassigned to someone else.`, employeeLink(String(after._id)), "hr.task.reassigned");
    return this.get(access, String(after._id));
  }

  /** Edits the task details. A changed due time is recorded and the employee is told. */
  async update(access: HrAccess, id: string, dto: HrTaskUpdateDto) {
    const task = await this.load(access, id);
    if (!this.rolesFor(access, task).manager) throw new ForbiddenException("You cannot edit this task.");
    if (task.status === "completed" || task.status === "cancelled")
      throw new BadRequestException("Reopen the task before editing it.");
    const set: Record<string, unknown> = {};
    for (const field of ["title", "description", "expectedOutcome", "priority"] as const)
      if (dto[field] !== undefined && dto[field] !== task[field]) set[field] = dto[field];
    let dueChanged: Date | null = null;
    if (dto.dueAt !== undefined) {
      const dueAt = new Date(dto.dueAt);
      if (Number.isNaN(dueAt.getTime())) throw new BadRequestException("The due time is not a valid date.");
      if (dueAt.getTime() !== new Date(task.dueAt).getTime()) {
        if (dueAt.getTime() < Date.now() - PAST_TOLERANCE_MS) throw new BadRequestException("The new due time is already in the past.");
        set.dueAt = dueAt;
        set.dueSoonNotified = false;
        set.overdueNotified = false;
        dueChanged = dueAt;
      }
    }
    if (!Object.keys(set).length) return this.get(access, id);
    const edited = Object.keys(set).filter((k) => !["dueAt", "dueSoonNotified", "overdueNotified"].includes(k));
    await this.transactions.run(async (session) => {
      const row = await this.tasks.findOneAndUpdate({ _id: task._id, status: task.status }, { $set: set }, { session });
      if (!row) throw new ConflictException("This task was just changed by someone else. Reload it and try again.");
      const entries: any[] = [];
      if (edited.length) entries.push({ taskId: task._id, type: "edited", actorId: access.userId, actorName: access.userName, data: { fields: edited } });
      if (dueChanged)
        entries.push({ taskId: task._id, type: "due_changed", actorId: access.userId, actorName: access.userName, data: { from: task.dueAt, to: dueChanged } });
      await this.events.create(entries, { session, ordered: true });
    });
    if (dueChanged) {
      const userIds = await this.notifications.userIdsOf([task.employeeId]);
      await this.notifications.send(userIds, "Task deadline changed", `${set.title ?? task.title} is now due ${this.formatDue(dueChanged)}.`, employeeLink(id), "hr.task.due_changed");
    }
    return this.get(access, id);
  }

  async comment(access: HrAccess, id: string, message: string) {
    const task = await this.load(access, id);
    const roles = this.rolesFor(access, task);
    await this.events.create({ taskId: task._id, type: "comment", actorId: access.userId, actorName: access.userName, message });
    if (roles.assignee) await this.notifyManagers(task, "New comment on a task", `${task.title}: ${message}`, "hr.task.comment");
    else {
      const userIds = await this.notifications.userIdsOf([task.employeeId]);
      await this.notifications.send(userIds, "New comment on your task", `${task.title}: ${message}`, employeeLink(id), "hr.task.comment");
    }
    return this.get(access, id);
  }

  /** The assignee's reporting manager and whoever created the task (never the assignee themselves). */
  private async notifyManagers(task: any, title: string, body: string, kind: string) {
    const [managerUser, [assigneeUser]] = await Promise.all([
      this.notifications.managerUserIdOf(task.employeeId),
      this.notifications.userIdsOf([task.employeeId]),
    ]);
    const recipients = [managerUser, task.createdBy ? String(task.createdBy) : null].filter((u) => u && u !== assigneeUser);
    await this.notifications.send(recipients, title, body, managerLink(String(task._id)), kind);
  }

  // ------------------------------------------------------------ reminders

  /**
   * "Due soon" and "overdue" reminders. Each is claimed with a one-time flag on the task
   * before it is sent, so overlapping sweeps or several API instances never send it twice.
   * Overdue high and urgent tasks are also raised with the manager and the task's creator.
   * Nothing here changes a task's status.
   */
  async sweepReminders(now = new Date()): Promise<{ dueSoon: number; overdue: number }> {
    const settings = await this.organisation.settings();
    const windowMs = Number(settings.dueSoonHours ?? 2) * 3_600_000;
    let dueSoon = 0;
    let overdue = 0;

    const soon = await this.tasks
      .find({ status: { $in: HR_OPEN_TASK_STATUSES }, dueSoonNotified: { $ne: true }, dueAt: { $gt: now, $lte: new Date(now.getTime() + windowMs) } })
      .sort({ dueAt: 1 })
      .limit(200)
      .lean();
    for (const task of soon) {
      const claimed = await this.tasks.findOneAndUpdate(
        { _id: task._id, dueSoonNotified: { $ne: true }, dueAt: task.dueAt, status: { $in: HR_OPEN_TASK_STATUSES } },
        { $set: { dueSoonNotified: true } },
      );
      if (!claimed) continue;
      dueSoon += 1;
      const userIds = await this.notifications.userIdsOf([task.employeeId]);
      await this.notifications.send(userIds, "Task due soon", `${task.title} is due ${this.formatDue(task.dueAt)}.`, employeeLink(String(task._id)), "hr.task.due_soon");
    }

    const late = await this.tasks
      .find({ status: { $in: HR_OPEN_TASK_STATUSES }, overdueNotified: { $ne: true }, dueAt: { $lte: now } })
      .sort({ dueAt: 1 })
      .limit(200)
      .lean();
    for (const task of late) {
      const claimed = await this.tasks.findOneAndUpdate(
        { _id: task._id, overdueNotified: { $ne: true }, dueAt: task.dueAt, status: { $in: HR_OPEN_TASK_STATUSES } },
        { $set: { overdueNotified: true } },
      );
      if (!claimed) continue;
      overdue += 1;
      const userIds = await this.notifications.userIdsOf([task.employeeId]);
      await this.notifications.send(userIds, "Task overdue", `${task.title} was due ${this.formatDue(task.dueAt)}.`, employeeLink(String(task._id)), "hr.task.overdue");
      if (task.priority === "high" || task.priority === "urgent")
        await this.notifyManagers(task, "Important task overdue", `${task.title} (${task.priority}) missed its deadline.`, "hr.task.overdue");
    }
    if (dueSoon || overdue) this.logger.log(`HR reminders: ${dueSoon} due soon, ${overdue} overdue`);
    return { dueSoon, overdue };
  }
}
