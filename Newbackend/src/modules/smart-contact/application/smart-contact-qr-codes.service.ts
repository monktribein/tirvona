import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  buildProfileUrl,
  smartContactConfig,
  type SmartContactConfig,
} from "../config/smart-contact.config";
import {
  SMART_CONTACT_CONNECTION,
  SMART_CONTACT_QR_MODEL,
  type SmartContactQrFormat,
  type SmartContactQrSource,
} from "../domain/smart-contact.constants";
import type {
  ActorRef,
  SmartContactProfileView,
  SmartContactQrView,
} from "../domain/smart-contact.types";
import { SmartContactAuditService } from "./smart-contact-audit.service";

@Injectable()
export class SmartContactQrCodesService {
  private readonly config: SmartContactConfig = smartContactConfig();

  constructor(
    @InjectModel(SMART_CONTACT_QR_MODEL, SMART_CONTACT_CONNECTION)
    private readonly qrCodes: Model<Record<string, any>>,
    private readonly audit: SmartContactAuditService,
  ) {}

  private async nextIdentifier(profile: SmartContactProfileView): Promise<string> {
    const initials =
      `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase() || "TC";
    const [latest] = await this.qrCodes
      .find({ qrIdentifier: /^TSC-/ })
      .sort({ qrIdentifier: -1 })
      .limit(1)
      .lean();
    const previous = latest?.qrIdentifier
      ? Number.parseInt(String(latest.qrIdentifier).split("-").pop() ?? "0", 10)
      : 0;
    const next = (Number.isFinite(previous) ? previous : 0) + 1;
    return `TSC-${initials}-${String(next).padStart(5, "0")}`;
  }

  private toView(doc: Record<string, any>): SmartContactQrView {
    const base = `${this.config.apiBaseUrl}/api/v1/admin/smart-contacts/${String(doc.profileId)}/qr/${String(doc._id)}`;
    return {
      id: String(doc._id),
      profileId: String(doc.profileId),
      qrIdentifier: doc.qrIdentifier,
      destinationUrl: doc.destinationUrl,
      source: doc.source,
      formats: doc.formats ?? [],
      status: doc.status,
      downloadUrls: {
        svg: `${base}.svg`,
        png: `${base}.png`,
        pdf: `${base}.pdf`,
      },
      createdBy: doc.createdById
        ? { id: doc.createdById, name: doc.createdByName ?? "" }
        : null,
      createdAt: doc.createdAt?.toISOString?.() ?? "",
    };
  }

  async create(
    profile: SmartContactProfileView,
    input: {
      source?: SmartContactQrSource;
      formats?: SmartContactQrFormat[];
      label?: string;
    },
    actor: ActorRef,
    ip?: string,
  ): Promise<SmartContactQrView> {
    const source = input.source ?? "business-card";
    const url = buildProfileUrl(this.config, profile.slug);
    const destinationUrl =
      source === "business-card" ? url : `${url}?src=${source}`;

    const created = await this.qrCodes.create({
      profileId: new Types.ObjectId(profile.id),
      qrIdentifier: await this.nextIdentifier(profile),
      destinationUrl,
      source,
      formats: input.formats?.length ? input.formats : ["svg", "png"],
      label: input.label ?? "",
      createdById: actor.id,
      createdByName: actor.name,
    });

    await this.audit.record({
      profileId: profile.id,
      action: "QR_GENERATED",
      newValue: { qrIdentifier: created.qrIdentifier, source, destinationUrl },
      actor,
      ip,
    });

    return this.toView(created.toObject());
  }

  async listForProfile(profileId: string): Promise<SmartContactQrView[]> {
    if (!Types.ObjectId.isValid(profileId)) return [];
    const rows = await this.qrCodes
      .find({ profileId: new Types.ObjectId(profileId) })
      .sort({ createdAt: -1 })
      .lean();
    return rows.map((row) => this.toView(row));
  }

  async findOne(profileId: string, qrId: string): Promise<SmartContactQrView> {
    if (!Types.ObjectId.isValid(profileId) || !Types.ObjectId.isValid(qrId))
      throw new NotFoundException("QR code not found.");
    const doc = await this.qrCodes
      .findOne({
        _id: new Types.ObjectId(qrId),
        profileId: new Types.ObjectId(profileId),
      })
      .lean();
    if (!doc) throw new NotFoundException("QR code not found.");
    return this.toView(doc);
  }

  async retire(
    profileId: string,
    qrId: string,
    actor: ActorRef,
    ip?: string,
  ): Promise<SmartContactQrView> {
    const existing = await this.findOne(profileId, qrId);
    const updated = await this.qrCodes
      .findByIdAndUpdate(qrId, { $set: { status: "RETIRED" } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException("QR code not found.");

    await this.audit.record({
      profileId,
      action: "QR_RETIRED",
      field: "status",
      oldValue: existing.status,
      newValue: "RETIRED",
      actor,
      ip,
    });

    return this.toView(updated);
  }

  async resolveSource(
    profileId: string,
    source: string | undefined,
  ): Promise<string | null> {
    if (!source || !Types.ObjectId.isValid(profileId)) return null;
    const doc = await this.qrCodes
      .findOne({
        profileId: new Types.ObjectId(profileId),
        source,
        status: "ACTIVE",
      })
      .select({ _id: 1 })
      .lean();
    return doc ? String(doc._id) : null;
  }
}
