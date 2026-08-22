import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { AARTI_MODEL } from "../domain/aarti.constants";
import { AartiException } from "../domain/aarti.errors";
import {
  aartiSlug,
  deriveStreamEmbed,
  isStreamLive,
} from "../domain/aarti.utils";
import { AartiAccessService, type AartiAccess } from "./aarti-access.service";
import type {
  AartiListQueryDto,
  ApproveAartiDto,
  CreateAartiStreamDto,
  StreamSearchDto,
  UpdateAartiStreamDto,
} from "../presentation/dtos/aarti.dto";

const PUBLIC_STREAM_FIELDS =
  "title slug description deity provider streamUrl embedUrl thumbnailUrl venueName city state startsAt endsAt recurrenceDays isLive isFeatured viewCount lastLiveAt ashramId sessionId";

@Injectable()
export class AartiStreamService {
  constructor(
    private readonly accessService: AartiAccessService,
    @InjectModel(AARTI_MODEL.Stream) private readonly streams: Model<any>,
    @InjectModel(AARTI_MODEL.Session) private readonly sessions: Model<any>,
  ) {}

  private decorate(stream: any): any {
    const live = isStreamLive(stream);
    return {
      ...stream,
      isLiveNow: live,
      state: live
        ? "live"
        : stream.startsAt && new Date(stream.startsAt) > new Date()
          ? "upcoming"
          : "recorded",
    };
  }

  /**
   * The public Live Pooja wall. `liveOnly` is what the /live-pooja hero renders
   * — a stream counts as live from its scheduled `startsAt` until `endsAt`, so
   * an ashram never has to remember to flip a switch mid-aarti.
   */
  async publicList(query: StreamSearchDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 24, 60);
    const filter: Record<string, unknown> = { status: "approved" };
    if (query.city)
      filter.city = new RegExp(`^${escapeRegex(query.city)}$`, "i");
    if (query.ashramId) filter.ashramId = query.ashramId;
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), "i");
      filter.$or = [{ title: pattern }, { deity: pattern }, { venueName: pattern }];
    }

    const rows = await this.streams
      .find(filter)
      .select(PUBLIC_STREAM_FIELDS)
      .populate("ashramId", "name ashramCode address.city")
      .sort({ isFeatured: -1, displayOrder: 1, startsAt: -1 })
      .limit(200)
      .lean();

    const decorated = rows.map((row) => this.decorate(row));
    const live = decorated.filter((row) => row.isLiveNow);
    const upcoming = decorated
      .filter((row) => row.state === "upcoming")
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    const recorded = decorated.filter((row) => row.state === "recorded");

    const pool = query.liveOnly ? live : [...live, ...upcoming, ...recorded];
    const start = (page - 1) * limit;

    return {
      success: true,
      counts: {
        live: live.length,
        upcoming: upcoming.length,
        recorded: recorded.length,
      },
      total: pool.length,
      page,
      totalPages: Math.ceil(pool.length / limit) || 1,
      data: pool.slice(start, start + limit),
      live,
      upcoming: upcoming.slice(0, 12),
    };
  }

  async publicDetail(slug: string): Promise<any | null> {
    const stream = await this.streams
      .findOne({ slug: slug.toLowerCase(), status: "approved" })
      .select(PUBLIC_STREAM_FIELDS)
      .populate("ashramId", "name ashramCode address.city address.state")
      .populate("sessionId", "name slug kind startTime")
      .lean();
    if (!stream) return null;
    await this.streams.updateOne({ _id: stream._id }, { $inc: { viewCount: 1 } });
    return this.decorate(stream);
  }

  async list(access: AartiAccess, query: AartiListQueryDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const filter: Record<string, unknown> = {
      ...this.accessService.scopeFilter(access),
    };
    if (query.status) filter.status = query.status;
    if (query.ashramId) filter.ashramId = query.ashramId;
    if (query.q) filter.title = new RegExp(escapeRegex(query.q), "i");
    const [rows, total] = await Promise.all([
      this.streams
        .find(filter)
        .populate("ashramId", "name ashramCode")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.streams.countDocuments(filter),
    ]);
    return { data: rows.map((row) => this.decorate(row)), total, page, limit };
  }

  private async assertOwned(
    access: AartiAccess,
    id: string,
  ): Promise<any> {
    const stream = await this.streams.findById(id);
    if (!stream) throw new AartiException("Live pooja not found.", 404);
    this.accessService.assertAshram(access, String(stream.ashramId));
    return stream;
  }

  async create(
    user: AuthenticatedUser,
    access: AartiAccess,
    dto: CreateAartiStreamDto,
  ): Promise<any> {
    this.accessService.assertAshram(access, dto.ashramId);
    if (dto.sessionId) {
      const session = await this.sessions.findById(dto.sessionId);
      if (!session) throw new AartiException("Aarti not found.", 404);
      this.accessService.assertSession(access, session);
    }
    const derived = deriveStreamEmbed(dto.provider ?? "youtube", dto.streamUrl);
    return this.streams.create({
      ...dto,
      ownerId: user.id,
      slug: aartiSlug(dto.title, dto.city ?? ""),
      embedUrl: dto.embedUrl || derived.embedUrl,
      thumbnailUrl: dto.thumbnailUrl || derived.thumbnailUrl,
      status: "draft",
    });
  }

  async update(
    access: AartiAccess,
    id: string,
    dto: UpdateAartiStreamDto,
  ): Promise<any> {
    const stream = await this.assertOwned(access, id);
    // A changed video URL is exactly what review exists to catch, so an
    // approved stream returns to the queue when its source moves.
    const urlChanged = dto.streamUrl && dto.streamUrl !== stream.streamUrl;
    Object.assign(stream, dto);
    if (dto.streamUrl) {
      const derived = deriveStreamEmbed(
        dto.provider ?? stream.provider,
        dto.streamUrl,
      );
      stream.embedUrl = dto.embedUrl || derived.embedUrl;
      if (!dto.thumbnailUrl && derived.thumbnailUrl)
        stream.thumbnailUrl = derived.thumbnailUrl;
    }
    if (urlChanged && stream.status === "approved" && !access.isPlatformAdmin) {
      stream.status = "pending";
      stream.submittedAt = new Date();
    }
    await stream.save();
    return stream;
  }

  async submit(access: AartiAccess, id: string): Promise<any> {
    const stream = await this.assertOwned(access, id);
    if (!["draft", "rejected"].includes(stream.status))
      throw new AartiException(
        "Only a draft or rejected live pooja can be submitted for review.",
        400,
      );
    stream.status = "pending";
    stream.submittedAt = new Date();
    stream.rejectionReason = "";
    await stream.save();
    return stream;
  }

  async review(
    user: AuthenticatedUser,
    id: string,
    dto: ApproveAartiDto,
  ): Promise<any> {
    const stream = await this.streams.findById(id);
    if (!stream) throw new AartiException("Live pooja not found.", 404);
    if (dto.decision === "approve") {
      stream.status = "approved";
      stream.approvedAt = new Date();
      stream.approvedBy = user.id;
      stream.rejectionReason = "";
    } else {
      stream.status = "rejected";
      stream.rejectionReason = dto.reason || "Not approved";
    }
    await stream.save();
    return stream;
  }

  async setLive(access: AartiAccess, id: string, isLive: boolean): Promise<any> {
    const stream = await this.assertOwned(access, id);
    stream.isLive = isLive;
    if (isLive) stream.lastLiveAt = new Date();
    await stream.save();
    return this.decorate(stream.toObject());
  }

  async setFeatured(id: string, isFeatured: boolean): Promise<any> {
    const stream = await this.streams.findById(id);
    if (!stream) throw new AartiException("Live pooja not found.", 404);
    stream.isFeatured = isFeatured;
    await stream.save();
    return stream;
  }

  async remove(access: AartiAccess, id: string): Promise<any> {
    const stream = await this.assertOwned(access, id);
    await this.streams.deleteOne({ _id: stream._id });
    return { deleted: true, _id: id };
  }
}
