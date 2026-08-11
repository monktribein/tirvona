import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  GOVERNANCE_REPOSITORY,
  type GovernanceRepository,
} from "../domain/governance.repository";
import {
  ADMIN_MODULE_KEYS,
  ADMIN_REFS,
} from "../infrastructure/persistence/governance.schemas";
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
    room_categories: "rooms",
    service: "service_bookings",
    services: "service_bookings",
    planner: "circuits",
    routes: "templates",
    rituals: "templates",
  };
  private readonly adminCollections = new Set(ADMIN_MODULE_KEYS);
  /**
   * The console renders a table of scalar columns and edits a handful of
   * fields, so the listing fetches only those. Everything else stays in the
   * database — safe, because a save issues a partial $set and leaves untouched
   * fields alone. Ashram profiles are large enough that sending them whole put
   * the request past the client's timeout on a slow connection.
   */
  private static readonly ADMIN_LIST_PROJECTIONS: Record<string, string> = {
    Admin_ashrams:
      "name status isVerified rating slug ashramCode ownerId email phone contact.email contact.phone address.city address.state address.district images coverImageUrl gallery galleryUrls documents createdAt updatedAt",
    Admin_rooms:
      "name type acType capacity totalInventory basePrice status ashramId createdAt updatedAt",
    Admin_users:
      "name email phone role status isVerified district state employerAshramId createdAt updatedAt",
    // Parking rows nest pricing, history, and geo objects the table never
    // renders; a location additionally carries its whole image gallery.
    Admin_parking_partners:
      "partnerCode businessName contactPerson contactEmail contactPhone status isVerified commissionPercent address.city address.state createdAt updatedAt",
    Admin_parking_locations:
      "name slug status isVerified isFeatured totalCapacity partnerId address.city address.state rating.average contactPhone images coverImage createdAt updatedAt",
    Admin_parking_bookings:
      "bookingReference status paymentStatus vehicleType vehicleNumber assignedSlotNumber entryAt exitAt durationHours pricing.totalAmount locationId partnerId customerId slotTypeId createdAt updatedAt",
    Admin_parking_slot_types:
      "name code locationId totalCapacity vehicleTypes isCovered hasEvCharging floorLabel isActive displayOrder createdAt updatedAt",
    Admin_parking_slots:
      "slotNumber locationId slotTypeId status floorLabel zone isActive occupiedAt createdAt updatedAt",
    Admin_parking_staff:
      "userId partnerId locationIds parkingRole employeeCode shift phone status lastActiveAt createdAt updatedAt",
    Admin_parking_commissions:
      "bookingId partnerId locationId grossAmount commissionPercent commissionAmount partnerEarning settlementStatus settledAt payoutBatchId createdAt updatedAt",
    Admin_parking_transactions:
      "reference type direction amount currency partnerId locationId bookingId description occurredAt createdAt",
    Admin_parking_scan_logs:
      "action result locationId bookingId vehicleNumber assignedSlotNumber scannedByUserId message scannedAt createdAt",
  };
  private readonly adminNeutralSubKeys = new Set([
    "all",
    "homepage",
    "hero_slider",
    "upload",
    "approval",
    "amenities",
    "categories",
    "facilities",
    "availability",
    "pricing",
    "season_pricing",
    "inventory",
  ]);
  private readonly adminStatusSubKeys: Record<string, string> = {
    approved: "approved",
    rejected: "rejected",
    pending: "pending",
    confirmed: "confirmed",
    completed: "completed",
    cancelled: "cancelled",
    active: "active",
    draft: "draft",
    scheduled: "scheduled",
    refunds: "pending",
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
    this.applyAdminSubKeyFilter(moduleKey, subKey, filter);
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
    // Foreign keys render as a bare ObjectId unless they are resolved, which
    // makes a joined table (a parking booking names neither its location nor
    // its customer) unreadable.
    const refs = ADMIN_REFS[name.replace(/^Admin_/, "")] ?? {};
    const populate = Object.entries(refs).map(([path, { select }]) => ({
      path,
      select,
    }));
    const data = (
      await this.repository.list(name, filter, {
        sort: { createdAt: -1 },
        limit: 100,
        ...(populate.length ? { populate } : {}),
        ...(GovernanceService.ADMIN_LIST_PROJECTIONS[name]
          ? { select: GovernanceService.ADMIN_LIST_PROJECTIONS[name] }
          : {}),
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
    if (
      GovernanceService.ADMIN_STATUS_LOCKED.has(name) &&
      ("status" in body || "isVerified" in body)
    )
      throw new BadRequestException(
        "A booking's status changes through the payment, check-in, check-out, or cancellation workflow, not this console",
      );
    const payload = this.cleanAdminPayload(
      body,
      user.role === "super_admin",
      name,
    );
    const id =
      typeof body._id === "string" && Types.ObjectId.isValid(body._id)
        ? body._id
        : undefined;

    if (name === "Admin_parking_locations") {
      const photos = new Set(
        [
          typeof payload.coverImage === "string"
            ? payload.coverImage.trim()
            : "",
          ...(Array.isArray(payload.images)
            ? payload.images.map((image) =>
                typeof image === "string" ? image.trim() : "",
              )
            : []),
        ].filter(Boolean),
      );
      if (photos.size < 3)
        throw new BadRequestException(
          "At least 3 unique parking photos are required. Map data does not count as a photo.",
        );
    }

    let data;
    if (name === "banners" || moduleKey === "banner") {
      const sec = (payload.category || payload.section || subKey) as string;
      const existing = id
        ? await this.repository.one(name, { _id: id })
        : sec
          ? await this.repository.one(name, {
              $or: [{ category: sec }, { section: sec }],
            })
          : null;

      if (existing) {
        data = await this.repository.update(
          name,
          { _id: existing._id },
          { $set: { ...payload, category: sec, section: sec } },
        );
      } else {
        data = await this.repository.create(
          name,
          await this.withCreationDefaults(user, name, {
            ...payload,
            category: sec,
            section: sec,
          }),
        );
      }
    } else {
      data = id
        ? await this.repository.update(name, { _id: id }, { $set: payload })
        : await this.repository.create(
            name,
            await this.withCreationDefaults(user, name, payload),
          );
    }
    if (!data) throw new NotFoundException("Record not found");
    return {
      success: true,
      message: id ? "Record saved successfully" : "Record created successfully",
      data: this.redact(data),
    };
  }

  /**
   * Ashrams and rooms carry required identity fields that the generic console
   * form does not collect. Without them a created row is invisible to the
   * public listing and unusable by the booking engine.
   */
  private async withCreationDefaults(
    user: AuthenticatedUser,
    model: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (model === "Admin_ashrams") {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      const name = String(payload.name ?? "").trim();
      if (!name)
        throw new BadRequestException("An ashram needs a name to be created");
      return {
        ...payload,
        name,
        ownerId: payload.ownerId ?? user.id,
        createdBy: user.id,
        description:
          String(payload.description ?? "").trim() ||
          "Spiritual Ashram lodging & accommodation.",
        ashramCode: payload.ashramCode ?? `ASH-${suffix}`,
        slug:
          payload.slug ??
          `${
            name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "") || "ashram"
          }-${suffix.toLowerCase()}`,
        status: payload.status ?? "pending_docs",
      };
    }
    if (model === "Admin_rooms") {
      if (!payload.ashramId)
        throw new BadRequestException(
          "A room category must be linked to an ashram",
        );
      return {
        ...payload,
        type: payload.type ?? "private_room",
        acType: payload.acType ?? "Non-AC",
        capacity: Number(payload.capacity ?? 1),
        totalInventory: Number(payload.totalInventory ?? 1),
        basePrice: Number(payload.basePrice ?? 0),
        status: payload.status ?? "active",
      };
    }
    return payload;
  }
  async adminDelete(
    user: AuthenticatedUser,
    moduleKey: string,
    id: string,
    subKey?: string,
  ): Promise<any> {
    this.assertAdminModuleAccess(user, moduleKey, subKey, true);
    const name = this.adminModel(moduleKey, subKey);
    if (name === "Admin_users" && user.role !== "super_admin")
      throw new ForbiddenException(
        "Only a Super Admin can delete user accounts",
      );
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid record id");
    const removed = await this.repository.remove(name, { _id: id });
    if (!removed) throw new NotFoundException("Record not found");
    if (name === "banners" || moduleKey === "banner") {
      const sec = removed.category || removed.section;
      if (sec) {
        await Promise.all([
          this.repository.removeMany("requests", { section: sec }),
          this.repository.removeMany("banners", {
            $or: [{ category: sec }, { section: sec }],
          }),
        ]);
      }
    }
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
    else if (request.module === "offer") {
      // Written with the field names and enum values `booking_coupons`
      // declares. The loose model would happily persist anything, and a row
      // missing `offerTitle`/`promoCode`/`validTill` renders as a blank card
      // and cannot be edited or redeemed afterwards.
      const maximumRedemptions = Number(data.maximumRedemptions) || 100;
      const discountType =
        data.discountType === "Flat Amount" || data.discountType === "flat"
          ? "Flat Amount"
          : "Percentage";
      const title = data.title ?? request.title ?? "Approved offer";
      await this.repository.create("GovernanceOffer", {
        ashramId: request.ashramId,
        ownerId: request.stayAdminId,
        offerTitle: title,
        description: data.description ?? title,
        offerType: data.offerType ?? "SPECIAL OFFER",
        promoCode: String(
          data.promoCode ?? `SPECIAL-${Date.now().toString().slice(-4)}`,
        ).toUpperCase(),
        discountType,
        discountValue: Number(data.discountValue) || 10,
        validFrom: new Date(),
        // Approvals carry no expiry of their own; default to 90 days so the
        // offer is time-bounded rather than valid forever by accident.
        validTill: data.validTill
          ? new Date(data.validTill)
          : new Date(Date.now() + 90 * 86_400_000),
        maximumRedemptions,
        remainingRedemptions: maximumRedemptions,
        perUserLimit: 1,
        featured: false,
        viewsCount: 0,
        clicksCount: 0,
        redemptionsCount: 0,
        revenueGenerated: 0,
        deletedAt: null,
        status: "active",
      });
    }
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
  private normalizeAdminKey(value?: string): string | undefined {
    return value?.trim().replace(/-/g, "_");
  }

  private adminLogicalKey(moduleKey: string, subKey?: string): string {
    const moduleName = this.normalizeAdminKey(moduleKey) ?? moduleKey;
    const section = this.normalizeAdminKey(subKey);
    const moduleLogical = this.adminAliases[moduleName] ?? moduleName;
    if (moduleName === "local") return "local";
    if (moduleName === "banner") return "banner";
    if (moduleName === "ashrams" && section === "room_categories")
      return "rooms";
    if (
      !section ||
      this.adminNeutralSubKeys.has(section) ||
      this.adminStatusSubKeys[section]
    )
      return moduleLogical;
    const sectionLogical = this.adminAliases[section] ?? section;
    // A sub-key only redirects to another collection when one actually exists
    // for it. Anything else (users/roles, offers/featured, reports/revenue …)
    // is a view of the module itself, narrowed by applyAdminSubKeyFilter.
    return this.adminCollections.has(sectionLogical)
      ? sectionLogical
      : moduleLogical;
  }

  private applyAdminSubKeyFilter(
    moduleKey: string,
    subKey: string | undefined,
    filter: Record<string, any>,
  ): void {
    const moduleName = this.normalizeAdminKey(moduleKey) ?? moduleKey;
    const section = this.normalizeAdminKey(subKey);
    if (!section || section === "all") return;
    // When the sub-key selected a collection of its own (blogs/authors,
    // marketplace/orders, reports/bookings …) the data set is already scoped
    // and narrowing it by the sub-key again would empty the result.
    if (
      this.adminLogicalKey(moduleKey, subKey) !==
      (this.adminAliases[moduleName] ?? moduleName)
    )
      return;

    if (moduleName === "local") {
      filter.category = section === "restaurants" ? "food" : section;
      return;
    }

    if (moduleName === "users") {
      if (section === "pilgrims") filter.role = "customer";
      else if (section === "owners") filter.role = "owner";
      else if (section === "staff")
        filter.role = {
          $in: ["manager", "reception", "housekeeping", "staff"],
        };
      else if (section === "content_managers") filter.role = "content_manager";
      // `roles` is the whole directory grouped by role in the UI — no filter.
      return;
    }

    if (moduleName === "institution" && section === "trusts") {
      filter.trustType = { $exists: true, $ne: "" };
      return;
    }

    if (moduleName === "reports") {
      // booking_reports rows are typed by what was generated.
      filter.reportType = { $regex: escapeRegex(section), $options: "i" };
      return;
    }

    if (moduleName === "banner" && !this.adminStatusSubKeys[section]) {
      const bannerCategories = [
        "homepage",
        "hero_banner",
        "festival_banner",
        "offer_banner",
        "announcement",
        "destinations_banner",
        "parking_banner",
        "marketplace_banner",
      ];
      if (section === "homepage") {
        filter.$or = [
          { category: { $in: bannerCategories } },
          { section: { $in: bannerCategories } },
        ];
      } else {
        filter.$or = [{ category: section }, { section: section }];
      }
      return;
    }

    if (moduleName === "offers" && section === "featured") {
      filter.featured = true;
      return;
    }

    // Parking tables are narrowed by their own lifecycle values, which do not
    // overlap the shared status sub-keys ("upcoming"/"checked_in"/"no_show" for
    // a booking, "settled"/"on_hold" for a commission). Handled before the
    // shared map so a name it happens to share — "pending", "cancelled" — still
    // lands on the right field.
    if (moduleName.startsWith("parking_")) {
      if (moduleName === "parking_commissions") {
        if (GovernanceService.PARKING_SETTLEMENT_STATUSES.has(section))
          filter.settlementStatus = section;
        return;
      }
      if (moduleName === "parking_transactions") {
        if (GovernanceService.PARKING_TRANSACTION_TYPES.has(section))
          filter.type = section;
        return;
      }
      if (moduleName === "parking_scan_logs") {
        if (["entry", "exit", "verify"].includes(section))
          filter.action = section;
        else if (section === "failed") filter.result = { $ne: "success" };
        return;
      }
      if (moduleName === "parking_staff") {
        if (GovernanceService.PARKING_STAFF_ROLES.has(section))
          filter.parkingRole = section;
        else if (["active", "inactive", "suspended"].includes(section))
          filter.status = section;
        return;
      }
      if (moduleName === "parking_slots" && section === "occupied") {
        filter.status = "occupied";
        return;
      }
      // Partners, locations, bookings, slot types and pricing all key off
      // `status`, except the two boolean flags a location exposes.
      if (section === "featured") {
        filter.isFeatured = true;
        return;
      }
      if (section === "unverified") {
        filter.isVerified = false;
        return;
      }
      filter.status = section;
      return;
    }

    const status = this.adminStatusSubKeys[section];
    if (status) filter.status = status;
  }
  private adminModel(moduleKey: string, subKey?: string): string {
    const key = this.adminLogicalKey(moduleKey, subKey);
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
    if (!this.adminCollections.has(key))
      throw new BadRequestException("Unsupported administration module");
    return `Admin_${key}`;
  }

  private assertAdminModuleAccess(
    user: AuthenticatedUser,
    moduleKey: string,
    subKey: string | undefined,
    write: boolean,
  ): void {
    if (user.role === "super_admin") return;

    const key = this.adminLogicalKey(moduleKey, subKey);
    const roleModules: Record<string, string[]> = {
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
  /**
   * Booking state drives inventory, payments, and refunds, so it may only move
   * through the booking workflow endpoints.
   */
  private static readonly ADMIN_STATUS_LOCKED = new Set([
    "Admin_bookings",
    // Same reasoning for parking: a booking's state drives slot occupancy, QR
    // validity, and refunds; a partner's drives a cascade that suspends every
    // location it owns; money rows are written by the settlement run. All of
    // these move through /parking/admin, which enforces the transition.
    "Admin_parking_bookings",
    "Admin_parking_partners",
    "Admin_parking_commissions",
    "Admin_parking_transactions",
  ]);
  private static readonly PARKING_SETTLEMENT_STATUSES = new Set([
    "pending",
    "processing",
    "settled",
    "on_hold",
    "reversed",
  ]);
  private static readonly PARKING_TRANSACTION_TYPES = new Set([
    "booking",
    "overstay",
    "refund",
    "commission",
    "payout",
  ]);
  private static readonly PARKING_STAFF_ROLES = new Set([
    "parking_partner",
    "parking_manager",
    "security_guard",
  ]);
  /**
   * The console's generic active/inactive toggle, mapped onto the ashram
   * verification lifecycle. Everything else must match the schema enum.
   */
  private static readonly ASHRAM_STATUS_ALIASES: Record<string, string> = {
    active: "approved",
    inactive: "suspended",
    verified: "approved",
    approved: "approved",
    rejected: "rejected",
    suspended: "suspended",
    archived: "suspended",
    pending: "pending_docs",
    pending_docs: "pending_docs",
    pending_inspection: "pending_inspection",
  };

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
    // Roles and permissions stay a user-module concern regardless of who asks.
    if (!superAdmin || model !== "Admin_users")
      ["role", "permissions"].forEach((key) => blocked.add(key));
    // Modules with their own state machine never accept status/isVerified here.
    if (GovernanceService.ADMIN_STATUS_LOCKED.has(model))
      ["status", "isVerified"].forEach((key) => blocked.add(key));

    const payload = Object.fromEntries(
      Object.entries(input).filter(([key]) => !blocked.has(key)),
    );

    if (model === "Admin_ashrams") {
      if (typeof input.isVerified === "boolean") {
        payload.isVerified = input.isVerified;
      } else if (typeof input.isVerified === "string") {
        const lower = (input.isVerified as string).toLowerCase();
        payload.isVerified = lower === "true" || lower === "verified" || lower === "yes";
      }

      if (typeof payload.status === "string") {
        const requested = payload.status.trim().toLowerCase();
        if (!requested) {
          delete payload.status;
          return payload;
        }
        const mapped = GovernanceService.ASHRAM_STATUS_ALIASES[requested];
        if (!mapped)
          throw new BadRequestException(
            "An ashram can only be set to approved, rejected, suspended, pending_docs, or pending_inspection",
          );
        payload.status = mapped;
        if (mapped === "approved" && payload.isVerified === undefined) {
          payload.isVerified = true;
        }
      }
    }
    return payload;
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
