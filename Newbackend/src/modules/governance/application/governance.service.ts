import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Types } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  GOVERNANCE_REPOSITORY,
  type GovernanceRepository,
} from "../domain/governance.repository";
import type {
  ApprovalRequestDto,
  BulkNotificationDto,
  InstitutionDto,
  ResubmitRoomCategoryRequestDto,
  RoomCategoryRequestDto,
  UpdateInstitutionDto,
} from "../presentation/dtos/governance.dto";

@Injectable()
export class GovernanceService {
  private readonly adminAliases: Record<string, string> = {
    pilgrims: "users",
    owners: "users",
    staff: "users",
    institutions: "institution",
    institution_contacts: "institution_contacts",
    institution_locations: "institution_locations",
    institution_audits: "institution_audits",
    products: "marketplace",
    vendors: "marketplace",
    newsletter: "waitlist",
    transport: "local",
    restaurants: "local",
    festivals: "events",
    audit: "reports",
    volunteer_jobs: "volunteer",
    services: "service_bookings",
  };
  constructor(
    @Inject(GOVERNANCE_REPOSITORY)
    private readonly repository: GovernanceRepository,
  ) {}

  async createApproval(
    user: AuthenticatedUser,
    dto: ApprovalRequestDto,
  ): Promise<any> {
    let ashramId = dto.ashramId;
    if (!ashramId)
      ashramId = (
        await this.repository.one("GovernanceAshram", { ownerId: user.id })
      )?._id;
    const requestId = `${
      dto.module
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 4) || "APP"
    }-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const data = await this.repository.create("ApprovalRequest", {
      ...dto,
      requestId,
      ashramId,
      stayAdminId: user.id,
      status: "pending",
      priority: dto.priority ?? "normal",
      history: [
        {
          status: "pending",
          comment: `Submitted by ${user.name}.`,
          updatedBy: user.id,
          timestamp: new Date(),
        },
      ],
    });
    await this.notify(
      undefined,
      "super_admin",
      `New ${dto.module.toUpperCase()} Approval Request`,
      `Request "${dto.title}" (${requestId}) submitted for approval.`,
    );
    return {
      success: true,
      message:
        "Approval request submitted successfully to Central Approval Center.",
      data,
    };
  }
  async createRoomCategory(
    user: AuthenticatedUser,
    payload: RoomCategoryRequestDto,
  ): Promise<any> {
    const requestedData = payload;
    if (!requestedData.name)
      throw new BadRequestException("Room category name is required");
    return this.createApproval(user, {
      module: "room_category",
      entityType: "RoomCategory",
      ashramId: payload.ashramId,
      title: payload.title ?? `Room Category: ${requestedData.name}`,
      requestedData: { ...requestedData },
      priority: payload.priority ?? "normal",
    });
  }

  async approvals(
    user: AuthenticatedUser,
    query: Record<string, string>,
  ): Promise<any> {
    const filter: Record<string, any> = {};
    for (const key of ["module", "status", "priority"])
      if (query[key] && query[key] !== "all") filter[key] = query[key];
    if (user.role !== "super_admin") {
      const ids = (
        await this.repository.list(
          "GovernanceAshram",
          { ownerId: user.id },
          { select: "_id", limit: 1000 },
        )
      ).map((row) => row._id);
      filter.$or = [{ stayAdminId: user.id }, { ashramId: { $in: ids } }];
    } else if (query.ashramId) filter.ashramId = query.ashramId;
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 100));
      filter.$and = [
        {
          $or: ["requestId", "title", "module"].map((field) => ({
            [field]: { $regex: term, $options: "i" },
          })),
        },
      ];
    }
    const data = await this.repository.list("ApprovalRequest", filter, {
      populate: ["ashramId", "stayAdminId", "reviewedBy"],
      sort: { createdAt: -1 },
      limit: 1000,
    });
    return { success: true, count: data.length, data };
  }
  async approvalStats(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [
      totalPending,
      underReview,
      needsChanges,
      highPriority,
      approvedToday,
      rejectedToday,
      totalCount,
    ] = await Promise.all([
      this.repository.count("ApprovalRequest", { status: "pending" }),
      this.repository.count("ApprovalRequest", { status: "under_review" }),
      this.repository.count("ApprovalRequest", { status: "needs_changes" }),
      this.repository.count("ApprovalRequest", {
        status: { $in: ["pending", "under_review"] },
        priority: { $in: ["high", "urgent"] },
      }),
      this.repository.count("ApprovalRequest", {
        status: "approved",
        reviewedAt: { $gte: today },
      }),
      this.repository.count("ApprovalRequest", {
        status: "rejected",
        reviewedAt: { $gte: today },
      }),
      this.repository.count("ApprovalRequest"),
    ]);
    return {
      success: true,
      data: {
        totalPending,
        underReview,
        needsChanges,
        highPriority,
        approvedToday,
        rejectedToday,
        totalCount,
        avgApprovalTimeHours: 1.4,
      },
    };
  }
  async approval(user: AuthenticatedUser, id: string): Promise<any> {
    const data = await this.repository.one(
      "ApprovalRequest",
      { _id: id },
      {
        populate: ["ashramId", "stayAdminId", "reviewedBy", "comments.userId"],
      },
    );
    if (!data) throw new NotFoundException("Approval request not found.");
    if (
      user.role !== "super_admin" &&
      String(data.stayAdminId?._id ?? data.stayAdminId) !== user.id &&
      String(data.ashramId?.ownerId ?? "") !== user.id
    )
      throw new ForbiddenException("You cannot access this approval request");
    return { success: true, data };
  }
  async reviewApproval(
    user: AuthenticatedUser,
    id: string,
    action: string,
    comment = "",
  ): Promise<any> {
    const request = await this.repository.one("ApprovalRequest", { _id: id });
    if (!request) throw new NotFoundException("Approval request not found.");
    const statuses: Record<string, string> = {
      approve: "approved",
      reject: "rejected",
      request_changes: "needs_changes",
      under_review: "under_review",
    };
    const status = statuses[action];
    if (action === "approve") await this.executeApproval(request);
    const data = await this.repository.update(
      "ApprovalRequest",
      { _id: id },
      {
        $set: {
          status,
          reviewComment:
            comment || (action === "approve" ? "Approved by Super Admin." : ""),
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
        $push: {
          history: {
            status,
            comment,
            updatedBy: user.id,
            timestamp: new Date(),
          },
        },
      },
    );
    await this.notify(
      request.stayAdminId,
      undefined,
      `Approval Request ${action.toUpperCase()}`,
      `Your request "${request.title}" has been marked as ${status.replace("_", " ")}.`,
    );
    return {
      success: true,
      message: `Approval Request successfully updated to ${status.replace("_", " ")}.`,
      data,
    };
  }
  async commentApproval(
    user: AuthenticatedUser,
    id: string,
    text: string,
  ): Promise<any> {
    await this.approval(user, id);
    const data = await this.repository.update(
      "ApprovalRequest",
      { _id: id },
      {
        $push: {
          comments: {
            userId: user.id,
            userName: user.name,
            text: text.trim(),
            timestamp: new Date(),
          },
        },
      },
    );
    return {
      success: true,
      message: "Comment added to approval thread.",
      data: data?.comments ?? [],
    };
  }
  async resubmitApproval(
    user: AuthenticatedUser,
    id: string,
    payload: ResubmitRoomCategoryRequestDto,
  ): Promise<any> {
    const current = await this.repository.one("ApprovalRequest", {
      _id: id,
      stayAdminId: user.id,
    });
    if (!current) throw new NotFoundException("Approval request not found.");
    const data = await this.repository.update(
      "ApprovalRequest",
      { _id: id },
      {
        $set: {
          requestedData: { ...payload },
          status: "pending",
          reviewComment: "",
        },
        $push: {
          history: {
            status: "pending",
            comment: "Resubmitted",
            updatedBy: user.id,
            timestamp: new Date(),
          },
        },
      },
    );
    return { success: true, message: "Approval request resubmitted.", data };
  }

  async institutions(query: Record<string, string>): Promise<any> {
    const filter: Record<string, any> = {};
    if (query.trustType) filter.trustType = query.trustType;
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 100));
      filter.$or = ["legalName", "trustName", "registrationNo"].map(
        (field) => ({ [field]: { $regex: term, $options: "i" } }),
      );
    }
    if (query.district || query.state) {
      const locations = await this.repository.list(
        "InstitutionLocation",
        {
          ...(query.district ? { district: query.district } : {}),
          ...(query.state ? { state: query.state } : {}),
        },
        { select: "institutionId", limit: 1000 },
      );
      filter._id = { $in: locations.map((row) => row.institutionId) };
    }
    const data = await this.repository.list("InstitutionMaster", filter, {
      sort: { createdAt: -1 },
      limit: 100,
    });
    return { success: true, count: data.length, data };
  }
  async institution(id: string): Promise<any> {
    const master = await this.repository.one("InstitutionMaster", { _id: id });
    if (!master)
      throw new NotFoundException("Institution master profile not found");
    const [contacts, location, qualityAudit] = await Promise.all([
      this.repository.list("InstitutionContact", { institutionId: id }),
      this.repository.one("InstitutionLocation", { institutionId: id }),
      this.repository.one("InstitutionQualityAudit", { institutionId: id }),
    ]);
    return {
      success: true,
      data: { master, contacts, location, qualityAudit },
    };
  }
  async createInstitution(
    user: AuthenticatedUser,
    dto: InstitutionDto,
  ): Promise<any> {
    const data = await this.repository.create("InstitutionMaster", {
      ...dto,
      trustName: dto.trustName ?? dto.legalName,
      registrationNo: dto.registrationNo ?? `REG-${Date.now()}`,
      trustType: dto.trustType ?? "Religious Trust",
      establishedYear: dto.establishedYear ?? 1950,
      status:
        user.role === "super_admin" ? (dto.status ?? "verified") : "onboarding",
      createdById: user.id,
    });
    if (dto.district || dto.state)
      await this.repository.create("InstitutionLocation", {
        institutionId: data._id,
        district: dto.district ?? "Haridwar",
        state: dto.state ?? "Uttarakhand",
      });
    if (dto.phone)
      await this.repository.create("InstitutionContact", {
        institutionId: data._id,
        contactType: "Manager",
        name: "Chief Administrator",
        phone: dto.phone,
        isPrimary: true,
      });
    return {
      success: true,
      message: "Institution master profile created successfully!",
      data,
    };
  }
  async updateInstitution(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateInstitutionDto,
  ): Promise<any> {
    const payload: Record<string, unknown> = { ...dto };
    delete payload.district;
    delete payload.state;
    delete payload.phone;
    if (user.role !== "super_admin") delete payload.status;
    const data = await this.repository.update(
      "InstitutionMaster",
      { _id: id },
      { $set: payload },
    );
    if (!data)
      throw new NotFoundException("Institution master profile not found");
    return {
      success: true,
      message: "Institution profile updated successfully",
      data,
    };
  }
  async deleteInstitution(id: string): Promise<any> {
    if (!(await this.repository.remove("InstitutionMaster", { _id: id })))
      throw new NotFoundException("Institution not found");
    await Promise.all(
      [
        "InstitutionContact",
        "InstitutionLocation",
        "InstitutionQualityAudit",
      ].map((name) => this.repository.removeMany(name, { institutionId: id })),
    );
    return {
      success: true,
      message: "Institution master deleted successfully",
    };
  }

  async telemetryStats(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [
      todaysNotifications,
      criticalAlerts,
      unreadNotifications,
      failedLogins,
      failedPayments,
      otpFailures,
      serverErrors,
      apiErrors,
    ] = await Promise.all([
      this.repository.count("EnterpriseNotification", {
        createdAt: { $gte: today },
      }),
      this.repository.count("EnterpriseNotification", {
        severity: { $in: ["critical", "security", "emergency"] },
      }),
      this.repository.count("EnterpriseNotification", { isRead: false }),
      this.repository.count("ActivityLog", { action: "FAILED_LOGIN" }),
      this.repository.count("ActivityLog", {
        module: "PAYMENT",
        action: "PAYMENT_FAILED",
      }),
      this.repository.count("ActivityLog", { action: "OTP_FAILED" }),
      this.repository.count("ActivityLog", { severity: "emergency" }),
      this.repository.count("ActivityLog", { status: { $gte: 400 } }),
    ]);
    return {
      success: true,
      data: {
        todaysNotifications,
        criticalAlerts,
        unreadNotifications,
        failedLogins,
        pendingComplaints: 0,
        openTickets: 0,
        failedPayments,
        otpFailures,
        serverErrors,
        apiErrors,
        emailsFailed: 0,
        smsFailed: 0,
      },
    };
  }
  async activities(
    user: AuthenticatedUser,
    query: Record<string, string>,
  ): Promise<any> {
    const filter = this.telemetryFilter(query, [
      "userName",
      "userEmail",
      "action",
      "description",
      "ipAddress",
      "activityId",
    ]);
    if (user.role === "district_officer") filter.city = user.district;
    else if (user.role === "owner") filter.userId = user.id;
    return this.page("ActivityLog", filter, query, { timestamp: -1 });
  }
  async notifications(
    user: AuthenticatedUser,
    query: Record<string, string>,
  ): Promise<any> {
    const filter = this.telemetryFilter(query, ["title", "message", "module"]);
    if (query.isRead && query.isRead !== "all")
      filter.isRead = query.isRead === "true";
    if (user.role !== "super_admin")
      filter.$and = [
        ...(filter.$and ?? []),
        {
          $or: [
            { recipientId: user.id },
            { recipientRole: user.role },
            { recipientRole: "all" },
          ],
        },
      ];
    const result = await this.page("EnterpriseNotification", filter, query, {
      createdAt: -1,
    });
    return {
      ...result,
      unreadCount: await this.repository.count("EnterpriseNotification", {
        ...filter,
        isRead: false,
      }),
    };
  }
  async markNotification(user: AuthenticatedUser, id: string): Promise<any> {
    const filter = id === "all" ? { isRead: false } : { _id: id };
    if (user.role !== "super_admin")
      Object.assign(filter, {
        $or: [
          { recipientId: user.id },
          { recipientRole: user.role },
          { recipientRole: "all" },
        ],
      });
    if (id === "all")
      await this.repository.updateMany("EnterpriseNotification", filter, {
        $set: { isRead: true, readAt: new Date() },
      });
    else if (
      !(await this.repository.update("EnterpriseNotification", filter, {
        $set: { isRead: true, readAt: new Date() },
      }))
    )
      throw new NotFoundException("Notification not found");
    return {
      success: true,
      message:
        id === "all"
          ? "All notifications marked as read"
          : "Notification marked as read",
    };
  }
  async deleteNotification(user: AuthenticatedUser, id: string): Promise<any> {
    const filter: Record<string, any> = { _id: id };
    if (user.role !== "super_admin")
      filter.$or = [{ recipientId: user.id }, { recipientRole: user.role }];
    if (!(await this.repository.remove("EnterpriseNotification", filter)))
      throw new NotFoundException("Notification not found");
    return { success: true, message: "Notification deleted" };
  }
  async bulkNotifications(
    user: AuthenticatedUser,
    dto: BulkNotificationDto,
  ): Promise<any> {
    const filter: Record<string, any> = { _id: { $in: dto.ids } };
    if (user.role !== "super_admin")
      filter.$or = [{ recipientId: user.id }, { recipientRole: user.role }];
    if (dto.action === "delete")
      await this.repository.removeMany("EnterpriseNotification", filter);
    else
      await this.repository.updateMany("EnterpriseNotification", filter, {
        $set:
          dto.action === "mark_read"
            ? { isRead: true, readAt: new Date() }
            : dto.action === "mark_unread"
              ? { isRead: false }
              : { isArchived: true },
      });
    return {
      success: true,
      message: `Bulk action '${dto.action}' completed successfully.`,
    };
  }
  async seedTelemetry(): Promise<any> {
    if ((await this.repository.count("ActivityLog")) === 0)
      await this.repository.create("ActivityLog", {
        activityId: `ACT_${Date.now()}`,
        timestamp: new Date(),
        module: "SYSTEM",
        action: "TELEMETRY_INITIALIZED",
        description: "Enterprise telemetry initialized",
        severity: "info",
        role: "system",
      });
    return { success: true, message: "Telemetry data checked/seeded." };
  }

  async adminList(
    user: AuthenticatedUser,
    moduleKey: string,
    subKey: string | undefined,
    query: Record<string, string>,
  ): Promise<any> {
    this.assertAdminModuleAccess(user, moduleKey, subKey, false);
    const name = this.adminModel(moduleKey, subKey);
    const filter: Record<string, any> = {};
    if (moduleKey === "local" && subKey)
      filter.category = subKey === "restaurants" ? "food" : subKey;
    if (query.status && query.status !== "all") filter.status = query.status;
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 100));
      filter.$or = [
        "name",
        "title",
        "email",
        "bookingId",
        "promoCode",
        "department",
      ].map((field) => ({ [field]: { $regex: term, $options: "i" } }));
    }
    const data = (
      await this.repository.list(name, filter, {
        sort: { createdAt: -1 },
        limit: 100,
      })
    ).map((row) => this.redact(row));
    return { success: true, count: data.length, data };
  }
  async adminSave(
    user: AuthenticatedUser,
    moduleKey: string,
    subKey: string | undefined,
    body: Record<string, unknown>,
  ): Promise<any> {
    this.assertAdminModuleAccess(user, moduleKey, subKey, true);
    const name = this.adminModel(moduleKey, subKey);
    const payload = this.cleanAdminPayload(
      body,
      user.role === "super_admin",
      name,
    );
    const id =
      typeof body._id === "string" && Types.ObjectId.isValid(body._id)
        ? body._id
        : undefined;
    const data = id
      ? await this.repository.update(name, { _id: id }, { $set: payload })
      : await this.repository.create(name, payload);
    return {
      success: true,
      message: id ? "Record saved successfully" : "Record created successfully",
      data: this.redact(data),
    };
  }
  async adminDelete(
    user: AuthenticatedUser,
    moduleKey: string,
    id: string,
  ): Promise<any> {
    this.assertAdminModuleAccess(user, moduleKey, undefined, true);
    const name = this.adminModel(moduleKey);
    if (name === "Admin_users" && user.role !== "super_admin")
      throw new ForbiddenException(
        "Only a Super Admin can delete user accounts",
      );
    if (Types.ObjectId.isValid(id))
      await this.repository.remove(name, { _id: id });
    return { success: true, message: "Record deleted successfully" };
  }

  private async executeApproval(request: any): Promise<void> {
    const data = request.requestedData ?? {};
    if (["room_category", "room"].includes(request.module))
      await this.repository.create("GovernanceRoom", {
        ashramId: request.ashramId,
        name: data.name ?? "New Custom Room Category",
        type: String(data.name ?? "")
          .toLowerCase()
          .includes("dorm")
          ? "dormitory"
          : "private_room",
        capacity: data.maxGuests ?? 2,
        totalInventory: 5,
        basePrice: data.suggestedBasePrice ?? 500,
        amenities: data.defaultAmenities ?? [],
        images: data.images ?? [],
        status: "active",
      });
    else if (request.module === "pricing" && data.basePrice)
      await this.repository.update(
        "GovernanceAshram",
        { _id: request.ashramId },
        { $set: { "pricing.basePrice": data.basePrice } },
      );
    else if (request.module === "offer")
      await this.repository.create("GovernanceOffer", {
        ashramId: request.ashramId,
        ownerId: request.stayAdminId,
        title: data.title ?? request.title,
        promoCode:
          data.promoCode ?? `SPECIAL-${Date.now().toString().slice(-4)}`,
        discountType: data.discountType ?? "percentage",
        discountValue: data.discountValue ?? 10,
        status: "active",
      });
  }
  private async notify(
    recipientId: unknown,
    recipientRole: string | undefined,
    title: string,
    message: string,
  ): Promise<void> {
    await this.repository.create("EnterpriseNotification", {
      recipientId,
      recipientRole,
      type: "in_app",
      title,
      message,
      module: "approvals",
      severity: "info",
      isRead: false,
    });
  }
  private telemetryFilter(
    query: Record<string, string>,
    fields: string[],
  ): Record<string, any> {
    const filter: Record<string, any> = {};
    for (const key of ["module", "severity", "role", "type"])
      if (query[key] && query[key] !== "all")
        filter[key] = key === "module" ? query[key].toUpperCase() : query[key];
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 100));
      filter.$or = fields.map((field) => ({
        [field]: { $regex: term, $options: "i" },
      }));
    }
    return filter;
  }
  private async page(
    model: string,
    filter: Record<string, unknown>,
    query: Record<string, string>,
    sort: Record<string, -1>,
  ): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const [data, total] = await Promise.all([
      this.repository.list(model, filter, {
        sort,
        skip: (page - 1) * limit,
        limit,
      }),
      this.repository.count(model, filter),
    ]);
    return {
      success: true,
      count: data.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data,
    };
  }
  private adminModel(moduleKey: string, subKey?: string): string {
    const requested = moduleKey === "local" ? "local" : subKey || moduleKey;
    const key = this.adminAliases[requested] ?? requested;
    if (
      [
        "institution",
        "institution_contacts",
        "institution_locations",
        "institution_audits",
      ].includes(key)
    )
      return key === "institution"
        ? "InstitutionMaster"
        : key === "institution_contacts"
          ? "InstitutionContact"
          : key === "institution_locations"
            ? "InstitutionLocation"
            : "InstitutionQualityAudit";
    const name = `Admin_${key}`;
    const allowed = new Set([
      "users",
      "ashrams",
      "rooms",
      "bookings",
      "offers",
      "blogs",
      "authors",
      "comments",
      "banner",
      "marketplace",
      "categories",
      "waitlist",
      "local",
      "guides",
      "circuits",
      "temples",
      "events",
      "support",
      "reports",
      "volunteer",
      "volunteer_applications",
      "reviews",
      "payments",
      "service_bookings",
      "providers",
    ]);
    if (!allowed.has(key))
      throw new BadRequestException("Unsupported administration module");
    return name;
  }

  private assertAdminModuleAccess(
    user: AuthenticatedUser,
    moduleKey: string,
    subKey: string | undefined,
    write: boolean,
  ): void {
    if (user.role === "super_admin") return;

    const requested = moduleKey === "local" ? "local" : subKey || moduleKey;
    const key = this.adminAliases[requested] ?? requested;
    const roleModules: Record<string, string[]> = {
      banner_manager: ["banner"],
      content_manager: [
        "banner",
        "blogs",
        "authors",
        "comments",
        "circuits",
        "temples",
        "events",
      ],
      offer_manager: ["offers"],
      blog_manager: ["blogs", "authors", "comments"],
      local_manager: ["local", "guides", "events"],
      marketplace_manager: ["marketplace", "categories", "waitlist"],
      finance_manager: ["payments", "reports", "bookings"],
      support: ["support", "bookings", "reviews"],
      service_manager: ["providers", "service_bookings", "local"],
    };
    const logicalKey = moduleKey === "local" ? "local" : key;
    if (!roleModules[user.role]?.includes(logicalKey))
      throw new ForbiddenException(
        "This role cannot access that administration module",
      );

    const readOnlyRoles = new Set([
      "national_admin",
      "state_admin",
      "government_admin",
      "govt_admin",
      "district_officer",
      "inspector",
      "finance_manager",
      "support",
    ]);
    if (write && readOnlyRoles.has(user.role))
      throw new ForbiddenException(
        "This role has read-only access to that module",
      );
  }
  private cleanAdminPayload(
    input: Record<string, unknown>,
    superAdmin: boolean,
    model: string,
  ): Record<string, unknown> {
    const blocked = new Set([
      "_id",
      "__v",
      "createdAt",
      "updatedAt",
      "password",
      "passwordHash",
      "tokenVersion",
      "resetTokenHash",
      "googleId",
      "deviceSessions",
      "__proto__",
      "constructor",
      "prototype",
    ]);
    if (!superAdmin || model !== "Admin_users")
      ["role", "status", "isVerified", "permissions"].forEach((key) =>
        blocked.add(key),
      );
    return Object.fromEntries(
      Object.entries(input).filter(([key]) => !blocked.has(key)),
    );
  }
  private redact<T>(value: T): T {
    if (!value || typeof value !== "object") return value;
    if (value instanceof Date || value instanceof Types.ObjectId) return value;
    if (Buffer.isBuffer(value)) return value;
    const hidden = new Set([
      "password",
      "passwordHash",
      "tokenVersion",
      "resetTokenHash",
      "resetTokenExpiresAt",
      "googleId",
      "deviceSessions",
      "aadhaarId",
      "govtId",
    ]);
    const copy: any = Array.isArray(value) ? [] : {};
    for (const [key, item] of Object.entries(value as any))
      if (!hidden.has(key))
        copy[key] = item && typeof item === "object" ? this.redact(item) : item;
    return copy;
  }
}
