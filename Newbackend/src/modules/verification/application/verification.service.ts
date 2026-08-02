import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { VerificationStatusDto } from "../presentation/verification.dto";

@Injectable()
export class VerificationService {
  constructor(
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    @InjectModel("AuditLog") private readonly audits: Model<any>,
  ) {}
  private jurisdiction(user: AuthenticatedUser): Record<string, unknown> {
    if (["district_officer", "inspector"].includes(user.role)) {
      if (!user.district || !user.state)
        throw new ForbiddenException(
          "District and state jurisdiction must be assigned to this account",
        );
      return { "address.district": user.district, "address.state": user.state };
    }
    if (["state_admin", "govt_admin", "government_admin"].includes(user.role)) {
      if (!user.state)
        throw new ForbiddenException(
          "State jurisdiction must be assigned to this account",
        );
      return { "address.state": user.state };
    }
    return {};
  }
  async pending(user: AuthenticatedUser): Promise<any[]> {
    const rows = await this.ashrams
      .find({
        status: { $in: ["pending_inspection", "pending_docs"] },
        ...this.jurisdiction(user),
      })
      .populate(
        "ownerId",
        "name email phone govtIdType govtIdUrl +govtIdNumber",
      )
      .sort({ createdAt: 1 })
      .lean();
    return rows.map((row: any) => {
      const owner = row.ownerId;
      if (!owner || typeof owner !== "object") return row;
      const idNumber = String(owner.govtIdNumber ?? "");
      const safeOwner = { ...owner };
      delete safeOwner.govtIdNumber;
      return {
        ...row,
        ownerId: {
          ...safeOwner,
          govtIdNumberMasked: idNumber
            ? `${"*".repeat(Math.max(0, idNumber.length - 4))}${idNumber.slice(-4)}`
            : "",
        },
      };
    });
  }
  private async row(user: AuthenticatedUser, id: string): Promise<any> {
    const ashram = await this.ashrams.findById(id);
    if (!ashram) throw new NotFoundException("Ashram not found");
    if (
      ["district_officer", "inspector"].includes(user.role) &&
      (ashram.address?.district !== user.district ||
        ashram.address?.state !== user.state)
    )
      throw new ForbiddenException(
        "Not authorized for this district jurisdiction",
      );
    if (
      ["state_admin", "govt_admin", "government_admin"].includes(user.role) &&
      user.state &&
      ashram.address?.state !== user.state
    )
      throw new ForbiddenException(
        "Not authorized for this state jurisdiction",
      );
    return ashram;
  }
  async schedule(
    user: AuthenticatedUser,
    id: string,
    date: string,
  ): Promise<any> {
    const ashram = await this.row(user, id);
    const scheduledDate = new Date(date);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date())
      throw new BadRequestException("Inspection date must be in the future");
    if (!["pending_docs", "rejected"].includes(ashram.status))
      throw new ForbiddenException(
        "Only an ashram awaiting documents or resubmitted after rejection can be scheduled",
      );
    const documents = ashram.documents ?? {};
    if (
      !documents.trustDeedUrl ||
      !documents.fireSafetyCertificateUrl ||
      !documents.landOwnershipUrl
    )
      throw new ForbiddenException(
        "Trust deed, fire-safety certificate, and land ownership document are required before inspection",
      );
    ashram.inspectionDetails = {
      ...(ashram.inspectionDetails?.toObject?.() ?? {}),
      scheduledDate,
      officerId: user.id,
    };
    ashram.status = "pending_inspection";
    await ashram.save();
    await this.audits.create({
      userId: user.id,
      action: "ASHRAM_INSPECTION_SCHEDULED",
      module: "GOVT_APPROVAL",
      details: { ashramId: id, scheduledDate: date },
    });
    return ashram;
  }
  async status(
    user: AuthenticatedUser,
    id: string,
    dto: VerificationStatusDto,
  ): Promise<any> {
    const ashram = await this.row(user, id);
    const before = ashram.status;
    const allowedTransitions: Record<string, string[]> = {
      pending_docs: ["rejected"],
      pending_inspection: ["approved", "rejected"],
      approved: ["suspended"],
    };
    if (!allowedTransitions[before]?.includes(dto.status))
      throw new ForbiddenException(
        `Ashram cannot move from ${before} to ${dto.status}`,
      );
    ashram.status = dto.status;
    ashram.rejectionReason =
      dto.status === "rejected"
        ? dto.rejectionReason || "Failed document check or safety inspection"
        : "";
    ashram.inspectionDetails = {
      ...(ashram.inspectionDetails?.toObject?.() ?? {}),
      comments: dto.comments || "Completed inspection review",
      officerId: user.id,
      reportUrl: dto.reportUrl || ashram.inspectionDetails?.reportUrl,
      inspectedAt: new Date(),
    };
    await ashram.save();
    if (dto.status === "approved")
      await this.users.updateOne(
        { _id: ashram.ownerId, role: "owner" },
        { $set: { status: "active", isVerified: true } },
      );
    await this.audits.create({
      userId: user.id,
      action: `ASHRAM_VERIFY_${dto.status.toUpperCase()}`,
      module: "GOVT_APPROVAL",
      details: {
        ashramId: id,
        before,
        status: dto.status,
        comments: dto.comments,
      },
    });
    return ashram;
  }
}
