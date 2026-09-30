import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { UploadsService } from "../../uploads/application/uploads.service";
import {
  ATTACHMENT_MAX_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "../domain/support.constants";

export interface AttachmentRef {
  attachmentId: Types.ObjectId;
  url: string;
  fileName: string;
  mimeType: string;
  bytes: number;
}

/** Keeps a readable, harmless file name: no paths, no control or markup characters. */
export const safeFileName = (name: string | undefined, fallback: string): string => {
  const base = String(name ?? "")
    .split(/[\\/]/)
    .pop()!
    .replace(/[^\p{L}\p{N} ._()-]/gu, "")
    .trim()
    .slice(0, 120);
  return base || fallback;
};

/**
 * Support attachments. Upload first (images/PDF only, type detected from the
 * bytes, 10 MB), then send the returned ids with a ticket or message. Only
 * the uploader can use an id, and only once.
 */
@Injectable()
export class SupportAttachmentService {
  constructor(
    @InjectModel("SupportAttachment") private readonly attachments: Model<any>,
    private readonly uploads: UploadsService,
  ) {}

  async upload(user: AuthenticatedUser, file: Express.Multer.File | undefined): Promise<any> {
    if (file && file.size > ATTACHMENT_MAX_BYTES)
      throw new BadRequestException("Attachments can be at most 10 MB.");
    const stored = await this.uploads.upload(file, "support", { allowedKinds: ["image", "pdf"] });
    const row = await this.attachments.create({
      uploaderId: user.id,
      url: stored.url,
      publicId: stored.publicId ?? "",
      fileName: safeFileName(file?.originalname, stored.kind === "pdf" ? "document.pdf" : "image"),
      mimeType: stored.mimeType ?? (stored.kind === "pdf" ? "application/pdf" : "image"),
      bytes: Number(stored.bytes ?? file?.size ?? 0),
    });
    return {
      _id: String(row._id),
      url: row.url,
      fileName: row.fileName,
      mimeType: row.mimeType,
      bytes: row.bytes,
    };
  }

  /**
   * Takes ownership of uploaded files for one message. Every id must belong
   * to `user` and be unused; otherwise nothing is claimed.
   */
  async claim(
    user: AuthenticatedUser,
    ids: string[] | undefined,
    ticketId: unknown,
    messageId: unknown,
  ): Promise<AttachmentRef[]> {
    const unique = [...new Set((ids ?? []).map(String))];
    if (!unique.length) return [];
    if (unique.length > MAX_ATTACHMENTS_PER_MESSAGE)
      throw new BadRequestException(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files at a time.`);
    if (unique.some((id) => !Types.ObjectId.isValid(id)))
      throw new BadRequestException("One of the attachments is invalid. Please upload it again.");
    // Each file is claimed with a conditional update, so two messages racing
    // for the same upload cannot both get it; a partial claim is rolled back.
    const rows: any[] = [];
    for (const id of unique) {
      const row = await this.attachments
        .findOneAndUpdate(
          { _id: id, uploaderId: user.id, ticketId: null },
          { $set: { ticketId, messageId } },
          { new: true },
        )
        .lean();
      if (!row) {
        if (rows.length)
          await this.attachments.updateMany(
            { _id: { $in: rows.map((r) => r._id) }, messageId },
            { $set: { ticketId: null, messageId: null } },
          );
        throw new BadRequestException("One of the attachments is invalid or already used. Please upload it again.");
      }
      rows.push(row);
    }
    return rows.map((row: any) => ({
      attachmentId: row._id,
      url: row.url,
      fileName: row.fileName,
      mimeType: row.mimeType,
      bytes: row.bytes,
    }));
  }
}
