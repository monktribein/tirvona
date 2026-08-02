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
  UserQueryDto,
} from "../presentation/user.dto";
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
    return this.users
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean();
  }
  async staff(actor: AuthenticatedUser): Promise<any[]> {
    const ids =
      actor.role === "super_admin"
        ? await this.ashrams.distinct("_id")
        : await this.ashrams.distinct("_id", { ownerId: actor.id });
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
    const ashram = await this.ashrams.findOne({
      _id: dto.ashramId,
      ...(actor.role === "super_admin" ? {} : { ownerId: actor.id }),
    });
    if (!ashram) throw new ForbiddenException("You do not own this ashram");
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
    if (
      actor.role !== "super_admin" &&
      !(await this.ashrams.exists({
        _id: user.employerAshramId,
        ownerId: actor.id,
      }))
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
  ): Promise<{ user: any; tempPassword: string }> {
    if (await this.users.exists({ email: dto.email.toLowerCase() }))
      throw new ConflictException("Email address already registered");
    const tempPassword =
      dto.password || `Tirvona#${Math.floor(1000 + Math.random() * 9000)}`;
    const user = await this.users.create({
      ...dto,
      email: dto.email.toLowerCase(),
      phone:
        dto.phone ||
        `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      role: dto.role || "customer",
      status: dto.status || "active",
      employeeId: `EMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      username:
        dto.username ||
        `usr_${dto.name.toLowerCase().replace(/\s+/g, "_")}_${Math.floor(100 + Math.random() * 900)}`,
      dob: dto.dob ? new Date(dto.dob) : undefined,
      joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
      isVerified: true,
    });
    await this.audit(actor, "USER_ACCOUNT_CREATED", {
      targetUserId: user._id,
      role: user.role,
    });
    return { user, tempPassword };
  }
  private async row(id: string): Promise<any> {
    const row = await this.users.findById(id);
    if (!row) throw new NotFoundException("User not found");
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
    if (status === "suspended")
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
  async role(actor: AuthenticatedUser, id: string, role: string): Promise<any> {
    const row = await this.row(id);
    const oldRole = row.role;
    row.role = role;
    row.tokenVersion = Number(row.tokenVersion ?? 0) + 1;
    await row.save();
    await this.audit(actor, "USER_ROLE_CHANGED", {
      targetUserId: id,
      oldRole,
      role,
    });
    return row;
  }
  async permissions(
    actor: AuthenticatedUser,
    id: string,
    permissions: string[],
  ): Promise<any> {
    const row = await this.row(id);
    row.permissions = [...new Set(permissions)];
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
