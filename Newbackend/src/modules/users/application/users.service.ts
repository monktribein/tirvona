import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import bcrypt from "bcryptjs";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type {
  CreateAccountDto,
  CreateStaffDto,
  SuspendUserDto,
  UpdateAccountDto,
  UserQueryDto,
} from "../presentation/user.dto";
import { ASHRAM_OWNER_ROLE } from "../../../common/auth/ashram-access";
import {
  isUnrestricted,
  resolveAshramScope,
} from "../../../common/auth/ashram-scope";
const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
@Injectable()
export class UsersService {
  constructor(
    @InjectModel("User") private readonly users: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("AuditLog") private readonly audits: Model<any>,
  ) {}
  private audit(
    actor: AuthenticatedUser,
    action: string,
    details: unknown,
  ): Promise<any> {
    return this.audits.create({
      userId: actor.id,
      action,
      module: "USER_MGMT",
      details,
    });
  }
  async list(query: UserQueryDto): Promise<any[]> {
    const filter: any = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (query.search) {
      const value = { $regex: escapeRegex(query.search), $options: "i" };
      filter.$or = [{ name: value }, { email: value }, { phone: value }];
    }
    const rows = await this.users
      .find(filter)
      .select("+aadhaarCardUrl +panCardUrl")
      .populate("employerAshramId", "name address.city address.state")
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean();
    return rows.map((row: any) => {
      const { aadhaarCardUrl, panCardUrl, employerAshramId, ...safe } = row;
      delete safe.passwordHash;
      return {
        ...safe,
        employerAshramId: employerAshramId?._id ?? employerAshramId ?? null,
        assignedAshram: employerAshramId?._id
          ? {
              _id: String(employerAshramId._id),
              name: employerAshramId.name,
              city: employerAshramId.address?.city ?? "",
              state: employerAshramId.address?.state ?? "",
            }
          : null,
        hasAadhaarCard: Boolean(aadhaarCardUrl?.trim()),
        hasPanCard: Boolean(panCardUrl?.trim()),
      };
    });
  }
  async staff(actor: AuthenticatedUser): Promise<any[]> {
    const scope = await resolveAshramScope(actor, this.ashrams);
    const ids = isUnrestricted(scope)
      ? await this.ashrams.distinct("_id")
      : scope;
    return this.users
      .find({
        role: { $in: ["manager", "reception", "housekeeping"] },
        employerAshramId: { $in: ids },
      })
      .populate("employerAshramId", "name")
      .sort({ createdAt: -1 })
      .lean();
  }
  async createStaff(
    actor: AuthenticatedUser,
    dto: CreateStaffDto,
  ): Promise<any> {
    const scope = await resolveAshramScope(actor, this.ashrams);
    if (!isUnrestricted(scope) && !scope.includes(String(dto.ashramId)))
      throw new ForbiddenException("You do not manage this ashram");
    const ashram = await this.ashrams.findOne({
      _id: dto.ashramId,
      deletedAt: null,
    });
    if (!ashram) throw new NotFoundException("Ashram not found");
    if (
      await this.users.exists({
        $or: [{ email: dto.email.toLowerCase() }, { phone: dto.phone }],
      })
    )
      throw new ConflictException(
        "A user with this email or phone already exists",
      );
    const user = await this.users.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      passwordHash: await bcrypt.hash(dto.password, 12),
      role: dto.role,
      status: "active",
      isVerified: true,
      employerAshramId: dto.ashramId,
      scopedAshramIds: [dto.ashramId],
    });
    await this.audit(actor, "STAFF_CREATE", {
      staffId: user._id,
      role: dto.role,
      ashramId: dto.ashramId,
    });
    return user;
  }
  async removeStaff(actor: AuthenticatedUser, id: string): Promise<void> {
    const user = await this.users.findById(id);
    if (!user || !["manager", "reception", "housekeeping"].includes(user.role))
      throw new NotFoundException("Staff member not found");
    const scope = await resolveAshramScope(actor, this.ashrams);
    if (
      !isUnrestricted(scope) &&
      !scope.includes(String(user.employerAshramId))
    )
      throw new ForbiddenException(
        "Not authorized to manage this staff member",
      );
    user.status = "suspended";
    user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
    await user.save();
    await this.audit(actor, "STAFF_DEACTIVATE", { staffId: id });
  }
  async createAccount(
    actor: AuthenticatedUser,
    dto: CreateAccountDto,
  ): Promise<{ user: any }> {
    if (await this.users.exists({ email: dto.email.toLowerCase() }))
      throw new ConflictException("Email address already registered");
    if (await this.users.exists({ phone: dto.phone.trim() }))
      throw new ConflictException("Phone number already registered");
    const isPilgrim = dto.role === "customer";
    if (
      !isPilgrim &&
      (!dto.aadhaarCardUrl?.trim() ||
        !dto.panCardUrl?.trim())
    )
      throw new BadRequestException(
        "Aadhaar card and PAN card are mandatory for role accounts",
      );
    const assignedAshram = await this.resolveAssignedAshram(dto);
    const user = await this.users.create({
      name: dto.name,
      gender: dto.gender,
      role: dto.role,
      aadhaarCardUrl: dto.aadhaarCardUrl,
      panCardUrl: dto.panCardUrl,
      email: dto.email.toLowerCase(),
      phone: dto.phone.trim(),
      passwordHash: await bcrypt.hash(dto.password, 12),
      status: "active",
      permissions:
        dto.role === "ashram_admin" ? ["ashrams.manage_all"] : [],
      employerAshramId: assignedAshram?._id ?? null,
      scopedAshramIds: assignedAshram ? [assignedAshram._id] : [],
      employeeId: `EMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      username: `usr_${dto.name.toLowerCase().replace(/\s+/g, "_")}_${Math.floor(100 + Math.random() * 900)}`,
      joiningDate: new Date(),
      isVerified: true,
    });
    await this.audit(actor, "USER_ACCOUNT_CREATED", {
      targetUserId: user._id,
      role: user.role,
      assignedAshramId: assignedAshram?._id ?? null,
      assignedAshramName: assignedAshram?.name ?? null,
    });
    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    delete safeUser.aadhaarCardUrl;
    delete safeUser.panCardUrl;
    return { user: safeUser };
  }
  async assignableAshrams(search?: string): Promise<any[]> {
    const term = search?.trim();
    const filter: Record<string, unknown> = {
      status: "approved",
      deletedAt: null,
    };
    if (term) {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { "address.city": { $regex: safe, $options: "i" } },
        { "address.state": { $regex: safe, $options: "i" } },
      ];
    }
    return this.ashrams
      .find(filter)
      .select("_id name address.city address.state")
      .sort({ name: 1 })
      .limit(50)
      .lean();
  }

  private async resolveAssignedAshram(
    dto: Pick<CreateAccountDto, "role" | "assignedAshramId">,
  ): Promise<{ _id: any; name: string } | null> {
    const ashramScopedRoles = [
      ASHRAM_OWNER_ROLE,
      "manager",
      "reception",
      "housekeeping",
    ];
    if (!ashramScopedRoles.includes(dto.role)) return null;
    if (!dto.assignedAshramId)
      throw new BadRequestException(
        "An assigned ashram is required for this ashram role",
      );
    const ashram = await this.ashrams
      .findOne({
        _id: dto.assignedAshramId,
        status: "approved",
        deletedAt: null,
      })
      .select("_id name")
      .lean();
    if (!ashram)
      throw new BadRequestException(
        "The selected ashram does not exist or is not approved",
      );
    return ashram as { _id: any; name: string };
  }

  private async row(id: string): Promise<any> {
    const row = await this.users.findById(id);
    if (!row) throw new NotFoundException("User not found");
    return row;
  }
  async updateAccount(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateAccountDto,
  ): Promise<any> {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();
    if (await this.users.exists({ _id: { $ne: id }, email }))
      throw new ConflictException("Email address already registered");
    if (await this.users.exists({ _id: { $ne: id }, phone }))
      throw new ConflictException("Phone number already registered");
    const row = await this.row(id);
    Object.assign(row, {
      name: dto.name.trim(),
      email,
      phone,
      gender: dto.gender,
    });
    await row.save();
    await this.audit(actor, "USER_ACCOUNT_UPDATED", { targetUserId: id });
    return row;
  }
  async status(
    actor: AuthenticatedUser,
    id: string,
    status: string,
  ): Promise<any> {
    if (id === actor.id && status === "suspended")
      throw new BadRequestException("You cannot suspend your own account");
    const row = await this.row(id);
    row.status = status;
    row.isSuspended = status === "suspended";
    if (status === "active") {
      row.suspensionType = "none";
      row.suspensionEndDate = undefined;
    } else if (status === "suspended") {
      row.suspensionType = "temporary";
    }
    row.tokenVersion = Number(row.tokenVersion ?? 0) + 1;
    await row.save();
    await this.audit(actor, "USER_STATUS_UPDATE", { targetUserId: id, status });
    return row;
  }
  async suspend(
    actor: AuthenticatedUser,
    id: string,
    dto: SuspendUserDto,
  ): Promise<any> {
    if (id === actor.id)
      throw new BadRequestException("You cannot suspend your own account");
    const row = await this.row(id);
    const end =
      dto.suspensionType === "temporary"
        ? dto.customEndDate
          ? new Date(dto.customEndDate)
          : new Date(Date.now() + dto.durationDays * 86_400_000)
        : undefined;
    Object.assign(row, {
      isSuspended: true,
      status:
        dto.suspensionType === "permanent"
          ? "perm_suspended"
          : "temp_suspended",
      suspensionReason: dto.reason || "Terms Violation",
      suspensionType: dto.suspensionType,
      suspendedBy: actor.id,
      suspendedAt: new Date(),
      suspensionEndDate: end,
      internalNotes: dto.internalNotes || "",
      visibleMessage: dto.visibleMessage || "",
      tokenVersion: Number(row.tokenVersion ?? 0) + 1,
    });
    await row.save();
    await this.audit(actor, "USER_SUSPENDED", {
      targetUserId: id,
      type: dto.suspensionType,
      end,
    });
    return row;
  }
  async reactivate(actor: AuthenticatedUser, id: string): Promise<any> {
    const row = await this.row(id);
    Object.assign(row, {
      isSuspended: false,
      status: "active",
      suspensionType: "none",
      suspensionEndDate: undefined,
    });
    await row.save();
    await this.audit(actor, "USER_REACTIVATED", { targetUserId: id });
    return row;
  }
  async role(
    actor: AuthenticatedUser,
    id: string,
    dto: { role: string; aadhaarCardUrl?: string; panCardUrl?: string },
  ): Promise<any> {
    const row = await this.users
      .findById(id)
      .select("+aadhaarCardUrl +panCardUrl");
    if (!row) throw new NotFoundException("User not found");
    const aadhaarCardUrl =
      dto.aadhaarCardUrl?.trim() || row.aadhaarCardUrl?.trim();
    const panCardUrl = dto.panCardUrl?.trim() || row.panCardUrl?.trim();
    if (dto.role !== "customer" && (!aadhaarCardUrl || !panCardUrl))
      throw new BadRequestException(
        "Upload an Aadhaar card and PAN card before assigning an operational role",
      );
    const oldRole = row.role;
    row.role = dto.role;
    if (dto.aadhaarCardUrl?.trim())
      row.aadhaarCardUrl = dto.aadhaarCardUrl.trim();
    if (dto.panCardUrl?.trim()) row.panCardUrl = dto.panCardUrl.trim();
    row.permissions =
      dto.role === "ashram_admin"
        ? [...new Set([...(row.permissions ?? []), "ashrams.manage_all"])]
        : (row.permissions ?? []).filter(
            (permission: string) => permission !== "ashrams.manage_all",
          );
    row.tokenVersion = Number(row.tokenVersion ?? 0) + 1;
    await row.save();
    await this.audit(actor, "USER_ROLE_CHANGED", {
      targetUserId: id,
      oldRole,
      role: dto.role,
    });
    const safeUser = row.toObject();
    delete safeUser.passwordHash;
    delete safeUser.aadhaarCardUrl;
    delete safeUser.panCardUrl;
    return safeUser;
  }
  async permissions(
    actor: AuthenticatedUser,
    id: string,
    permissions: string[],
  ): Promise<any> {
    const row = await this.row(id);
    row.permissions = [
      ...new Set(
        permissions.filter(
          (permission) =>
            permission !== "ashrams.manage_all" ||
            row.role === "ashram_admin" ||
            row.role === "super_admin",
        ),
      ),
    ];
    row.tokenVersion = Number(row.tokenVersion ?? 0) + 1;
    await row.save();
    await this.audit(actor, "USER_PERMISSIONS_UPDATED", {
      targetUserId: id,
      permissionsCount: permissions.length,
    });
    return row;
  }
  async reset(
    actor: AuthenticatedUser,
    id: string,
    password?: string,
  ): Promise<string> {
    const row = await this.users.findById(id).select("+passwordHash");
    if (!row) throw new NotFoundException("User not found");
    const generated =
      password || `Tirvona#${Math.floor(1000 + Math.random() * 9000)}`;
    row.passwordHash = await bcrypt.hash(generated, 12);
    row.tokenVersion = Number(row.tokenVersion ?? 0) + 1;
    await row.save();
    await this.audit(actor, "USER_PASSWORD_RESET", { targetUserId: id });
    return generated;
  }
  async softDelete(actor: AuthenticatedUser, id: string): Promise<any> {
    if (id === actor.id)
      throw new BadRequestException("You cannot delete your own admin account");
    const row = await this.row(id);
    Object.assign(row, {
      status: "deleted",
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: actor.id,
      tokenVersion: Number(row.tokenVersion ?? 0) + 1,
    });
    await row.save();
    await this.audit(actor, "USER_SOFT_DELETED", { targetUserId: id });
    return row;
  }
  async bulkSoftDelete(
    actor: AuthenticatedUser,
    ids: string[],
  ): Promise<number> {
    const uniqueIds = [...new Set(ids)].filter((id) => id !== actor.id);
    if (!uniqueIds.length)
      throw new BadRequestException(
        "Select at least one account other than your own",
      );
    const now = new Date();
    const result = await this.users.updateMany(
      { _id: { $in: uniqueIds }, isDeleted: { $ne: true } },
      {
        $set: {
          status: "deleted",
          isDeleted: true,
          deletedAt: now,
          deletedBy: actor.id,
        },
        $inc: { tokenVersion: 1 },
      },
    );
    await this.audit(actor, "USER_BULK_SOFT_DELETED", {
      requestedIds: uniqueIds,
      deletedCount: result.modifiedCount,
    });
    return result.modifiedCount;
  }
  async restore(actor: AuthenticatedUser, id: string): Promise<any> {
    const row = await this.row(id);
    Object.assign(row, {
      status: "active",
      isDeleted: false,
      isSuspended: false,
      deletedAt: undefined,
      deletedBy: undefined,
    });
    await row.save();
    await this.audit(actor, "USER_RESTORED", { targetUserId: id });
    return row;
  }
  async permanentDelete(
    actor: AuthenticatedUser,
    id: string,
    password: string,
  ): Promise<void> {
    if (id === actor.id)
      throw new BadRequestException(
        "You cannot permanently delete your own account",
      );
    const admin = await this.users.findById(actor.id).select("+passwordHash");
    if (
      !admin?.passwordHash ||
      !(await bcrypt.compare(password, admin.passwordHash))
    )
      throw new UnauthorizedException("Invalid Admin Password");
    const row = await this.row(id);
    if (!row.isDeleted)
      throw new BadRequestException(
        "Only soft-deleted accounts can be permanently deleted",
      );
    await this.users.deleteOne({ _id: id, isDeleted: true });
    await this.audit(actor, "USER_PERMANENTLY_DELETED", {
      targetUserId: id,
      email: row.email,
    });
  }
}
