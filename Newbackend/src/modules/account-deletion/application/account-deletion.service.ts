import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { DeleteAccountDto } from "../presentation/account-deletion.dto";
import {
  type DeletionBlocker,
  OpenCommitmentsService,
} from "./open-commitments.service";

/**
 * Roles that may erase themselves from the app. Staff, owners and admins run
 * business records (ashrams, payouts, audit trails) that need an administrator
 * to hand over first, so they go through support.
 */
export const SELF_DELETABLE_ROLES = ["customer"];

export interface DeletionEligibility {
  eligible: boolean;
  /** How the app must re-authenticate the person before deleting. */
  reauth: "password" | "google";
  blockers: DeletionBlocker[];
  /** Set when the account type cannot self-delete. */
  supportOnly: boolean;
}

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectModel("User") private readonly users: Model<any>,
    @InjectModel("AuditLog") private readonly audits: Model<any>,
    private readonly commitments: OpenCommitmentsService,
    private readonly config: ConfigService,
  ) {}

  private async load(id: string): Promise<any> {
    const user = await this.users.findById(id).select("+passwordHash");
    if (!user || user.isDeleted) throw new NotFoundException("User not found");
    return user;
  }

  async eligibility(actor: AuthenticatedUser): Promise<DeletionEligibility> {
    const user = await this.load(actor.id);
    const supportOnly = !SELF_DELETABLE_ROLES.includes(user.role);
    const blockers = supportOnly
      ? []
      : await this.commitments.blockers(actor.id);
    return {
      eligible: !supportOnly && blockers.length === 0,
      reauth: user.passwordHash ? "password" : "google",
      blockers,
      supportOnly,
    };
  }

  /**
   * Proves it is really the account holder, not a stolen session. Failures are
   * 400s on purpose: the mobile client signs the user out on any 401.
   */
  private async reauthenticate(
    user: any,
    dto: DeleteAccountDto,
  ): Promise<void> {
    if (user.passwordHash) {
      if (!dto.password)
        throw new BadRequestException("Enter your password to continue");
      if (!(await bcrypt.compare(dto.password, user.passwordHash)))
        throw new BadRequestException({
          code: "INVALID_PASSWORD",
          message: "That password is not correct",
        });
      return;
    }
    const clientId = this.config.get<string>("googleClientId");
    if (!clientId)
      throw new BadRequestException("Google authentication is not configured");
    if (!dto.googleCredential)
      throw new BadRequestException("Confirm with Google to continue");
    let payload;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({
        idToken: dto.googleCredential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new BadRequestException({
        code: "GOOGLE_CONFIRMATION_FAILED",
        message: "Google confirmation failed. Try again.",
      });
    }
    const sameAccount =
      payload?.email_verified &&
      String(payload.email ?? "").toLowerCase() ===
        String(user.email ?? "").toLowerCase() &&
      (!user.googleId || user.googleId === payload.sub);
    if (!sameAccount)
      throw new BadRequestException({
        code: "GOOGLE_ACCOUNT_MISMATCH",
        message: "Confirm with the Google account you signed up with",
      });
  }

  async delete(
    actor: AuthenticatedUser,
    dto: DeleteAccountDto,
    context: { ip?: string; userAgent?: string; requestId?: string } = {},
  ): Promise<void> {
    const user = await this.load(actor.id);
    if (!SELF_DELETABLE_ROLES.includes(user.role))
      throw new ForbiddenException({
        code: "ACCOUNT_DELETION_SUPPORT_ONLY",
        message:
          "This account type cannot be deleted in the app. Please contact Tirvona support to close it.",
      });

    await this.reauthenticate(user, dto);

    const blockers = await this.commitments.blockers(actor.id);
    if (blockers.length)
      throw new ConflictException({
        code: "ACCOUNT_DELETION_BLOCKED",
        message: blockers[0].message,
        blockers,
      });

    const id = String(user._id);
    const now = new Date();
    // Erase the personal details but keep the row: bookings, payments and the
    // ledger point at this id and must stay intact for tax and dispute
    // records. The unique email/phone are replaced with reserved stand-ins so
    // the person (or someone else) can register with them again.
    const result = await this.users.updateOne(
      { _id: id, isDeleted: { $ne: true } },
      {
        $set: {
          name: "Deleted user",
          email: `deleted.${id}@deleted.tirvona.invalid`,
          phone: `deleted-${id}`,
          status: "deleted",
          isDeleted: true,
          isSuspended: false,
          deletedAt: now,
          deletedBy: id,
          avatarUrl: "",
          district: "",
          state: "",
          city: "",
          gender: "",
          govtIdType: "",
          govtIdNumber: "",
          govtIdUrl: "",
          aadhaarCardUrl: "",
          panCardUrl: "",
          internalNotes: "",
          visibleMessage: "",
          remarks: "",
          fcmTokens: [],
          permissions: [],
          scopedAshramIds: [],
          scopedTempleIds: [],
        },
        // Signing out everywhere: every issued JWT carries the old version.
        $inc: { tokenVersion: 1 },
        $unset: {
          passwordHash: "",
          googleId: "",
          dob: "",
          username: "",
          employeeId: "",
          resetTokenHash: "",
          resetTokenExpiresAt: "",
        },
      },
    );
    if (!result.matchedCount)
      throw new ConflictException("This account has already been deleted");

    try {
      await this.audits.create({
        userId: id,
        action: "ACCOUNT_SELF_DELETED",
        module: "ACCOUNT",
        details: { role: user.role, reason: dto.reason?.trim() || undefined },
        ipAddress: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId,
      });
    } catch (error) {
      // The account is already erased; a failed audit row must not turn that
      // into an error the person would retry.
      this.logger.error(
        `Audit entry for deleted account ${id} failed: ${(error as Error).message}`,
      );
    }
  }
}
