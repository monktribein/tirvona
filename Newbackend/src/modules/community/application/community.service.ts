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
  COMMUNITY_REPOSITORY,
  type CommunityRepository,
} from "../domain/community.repository";
import type {
  ApplicationStatusDto,
  UpdateVisitorArticleDto,
  UpdateVolunteerJobDto,
  UserMemoryDto,
  VisitorArticleDto,
  VolunteerApplicationDto,
  VolunteerJobDto,
} from "../presentation/dtos/community.dto";

@Injectable()
export class CommunityService {
  private readonly memoryCategories = new Set([
    "bookingDraft",
    "plannerDraft",
    "offerDraft",
    "marketplaceCart",
    "wishlist",
    "recentSearches",
    "recentCities",
    "filters",
    "dashboardState",
    "profileProgress",
    "preferences",
    "recentlyViewed",
    "lastVisitedPage",
  ]);
  constructor(
    @Inject(COMMUNITY_REPOSITORY)
    private readonly repository: CommunityRepository,
  ) {}

  async memory(sessionId: string): Promise<any> {
    const key = this.session(sessionId);
    let data = await this.repository.one("memories", { sessionId: key });
    if (!data)
      data = await this.repository.create("memories", {
        sessionId: key,
        preferences: { language: "en", currency: "INR", theme: "light" },
      });
    return { success: true, data };
  }
  async saveMemory(sessionId: string, dto: UserMemoryDto): Promise<any> {
    const data = await this.repository.update(
      "memories",
      { sessionId: this.session(sessionId) },
      { $set: { ...dto, sessionId: this.session(sessionId) } },
      true,
    );
    return { success: true, message: "User memory synced successfully.", data };
  }
  async clearMemory(sessionId: string, category: string): Promise<any> {
    if (!this.memoryCategories.has(category))
      throw new BadRequestException("Unknown memory category");
    const arrays = new Set([
      "marketplaceCart",
      "wishlist",
      "recentSearches",
      "recentCities",
      "recentlyViewed",
    ]);
    await this.repository.update(
      "memories",
      { sessionId: this.session(sessionId) },
      { $set: { [category]: arrays.has(category) ? [] : {} } },
    );
    return {
      success: true,
      message: `Cleared ${category} memory successfully.`,
    };
  }

  async jobs(query: Record<string, string>, ownerId?: string): Promise<any> {
    const filter: Record<string, any> = ownerId
      ? { ownerId }
      : { status: "open" };
    for (const key of ["category", "type", "accommodation", "food"])
      if (query[key] && query[key] !== "all") filter[key] = query[key];
    for (const key of ["city", "department"])
      if (query[key] && query[key] !== "all")
        filter[key] = { $regex: escapeRegex(query[key]), $options: "i" };
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 100));
      filter.$or = [
        "title",
        "ashramName",
        "department",
        "city",
        "responsibilities",
      ].map((field) => ({ [field]: { $regex: term, $options: "i" } }));
    }
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const [data, total] = await Promise.all([
      this.repository.list("jobs", filter, {
        sort: { createdAt: -1 },
        skip: (page - 1) * limit,
        limit,
      }),
      this.repository.count("jobs", filter),
    ]);
    return { success: true, count: data.length, total, data };
  }
  async job(id: string): Promise<any> {
    const data = await this.repository.one("jobs", { _id: id });
    if (!data) throw new NotFoundException("Volunteer opening not found.");
    return { success: true, data };
  }
  async apply(
    user: AuthenticatedUser,
    dto: VolunteerApplicationDto,
  ): Promise<any> {
    if (
      !(await this.repository.one("jobs", {
        _id: dto.jobId,
        status: { $in: ["open", "closing_soon"] },
      }))
    )
      throw new NotFoundException("Volunteer opening is not available.");
    if (
      await this.repository.one("applications", {
        jobId: dto.jobId,
        userId: user.id,
        status: { $ne: "rejected" },
      })
    )
      throw new BadRequestException("You already applied for this opening.");
    const data = await this.repository.create("applications", {
      ...dto,
      userId: user.id,
      status: "applied",
    });
    return {
      success: true,
      message: "Application submitted successfully!",
      data,
    };
  }
  async createJob(user: AuthenticatedUser, dto: VolunteerJobDto): Promise<any> {
    const data = await this.repository.create("jobs", {
      ...dto,
      ownerId: user.id,
      status: dto.status ?? "open",
    });
    return { success: true, data };
  }
  async updateJob(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateVolunteerJobDto,
  ): Promise<any> {
    await this.ownsJob(user, id);
    const data = await this.repository.update(
      "jobs",
      { _id: id },
      { $set: { ...dto } },
    );
    return { success: true, data };
  }
  async deleteJob(user: AuthenticatedUser, id: string): Promise<any> {
    await this.ownsJob(user, id);
    await this.repository.remove("jobs", { _id: id });
    return { success: true, message: "Volunteer opening deleted." };
  }
  async applications(
    user: AuthenticatedUser,
    query: Record<string, string>,
  ): Promise<any> {
    const owned =
      user.role === "super_admin"
        ? undefined
        : (
            await this.repository.list(
              "jobs",
              { ownerId: user.id },
              { select: "_id", limit: 1000 },
            )
          ).map((job) => job._id);
    const filter: Record<string, unknown> = {
      ...(owned ? { jobId: { $in: owned } } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const data = await this.repository.list("applications", filter, {
      populate: ["jobId"],
      sort: { createdAt: -1 },
    });
    return { success: true, count: data.length, data };
  }
  async applicationStatus(
    user: AuthenticatedUser,
    id: string,
    dto: ApplicationStatusDto,
  ): Promise<any> {
    const application = await this.repository.one(
      "applications",
      { _id: id },
      { populate: ["jobId"] },
    );
    if (!application) throw new NotFoundException("Application not found.");
    if (
      user.role !== "super_admin" &&
      String(application.jobId?.ownerId) !== user.id
    )
      throw new ForbiddenException("You cannot manage this application");
    const data = await this.repository.update(
      "applications",
      { _id: id },
      {
        $set: {
          status: dto.status,
          ...(dto.notes ? { "interviewSchedule.notes": dto.notes } : {}),
        },
      },
    );
    return {
      success: true,
      message: `Application marked as ${dto.status}.`,
      data,
    };
  }

  async eligibleBookings(user: AuthenticatedUser): Promise<any> {
    const bookings = await this.repository.list(
      "bookings",
      { customerId: user.id, status: { $in: ["completed", "checked_out"] } },
      { populate: ["ashramId"], sort: { checkOutDate: -1 } },
    );
    const existing = await this.repository.list(
      "articles",
      { visitorId: user.id },
      { select: "bookingId status" },
    );
    const statuses = new Map(
      existing.map((article) => [String(article.bookingId), article.status]),
    );
    const data = bookings.map((booking) => ({
      _id: booking._id,
      bookingId: booking.bookingId,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      ashram: booking.ashramId,
      hasSubmittedArticle: Boolean(
        statuses.get(String(booking._id)) &&
        statuses.get(String(booking._id)) !== "rejected",
      ),
      existingArticleStatus: statuses.get(String(booking._id)) ?? null,
    }));
    return { success: true, count: data.length, data };
  }
  async createArticle(
    user: AuthenticatedUser,
    dto: VisitorArticleDto,
  ): Promise<any> {
    const booking = await this.repository.one(
      "bookings",
      { _id: dto.bookingId },
      { populate: ["ashramId"] },
    );
    if (!booking) throw new NotFoundException("Booking record not found.");
    if (String(booking.customerId) !== user.id)
      throw new ForbiddenException("Booking does not belong to you.");
    if (!["completed", "checked_out"].includes(booking.status))
      throw new BadRequestException(
        "Only completed ashram stays are eligible for verified articles.",
      );
    if (
      await this.repository.one("articles", {
        bookingId: dto.bookingId,
        status: { $in: ["pending", "approved"] },
      })
    )
      throw new BadRequestException(
        "An article has already been submitted for this completed stay.",
      );
    const ashram = booking.ashramId;
    if (!ashram?.ownerId)
      throw new BadRequestException(
        "Associated Ashram or Owner information missing.",
      );
    const status = dto.status === "draft" ? "draft" : "pending";
    const data = await this.repository.create("articles", {
      ...dto,
      uuid: `ART-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      visitorId: user.id,
      ashramId: ashram._id,
      ownerId: ashram.ownerId,
      slug: this.slug(dto.title),
      status,
      isVerifiedStay: true,
      visitDate: booking.checkInDate ?? booking.createdAt,
      visitMonth: new Date(
        booking.checkInDate ?? booking.createdAt,
      ).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      viewsCount: 0,
      likesCount: 0,
    });
    await this.history(data._id, "new", status, user.id);
    if (status === "pending")
      await this.notify(
        ashram.ownerId,
        "New Visitor Article Submitted",
        `A new verified visitor article "${dto.title}" was submitted for ${ashram.name}.`,
        data._id,
      );
    return {
      success: true,
      message:
        status === "draft"
          ? "Article saved as draft."
          : "Article submitted for Owner approval.",
      data,
    };
  }
  async updateArticle(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateVisitorArticleDto,
  ): Promise<any> {
    const article = await this.repository.one("articles", { _id: id });
    if (!article) throw new NotFoundException("Article not found.");
    if (String(article.visitorId) !== user.id)
      throw new ForbiddenException("Unauthorized to edit this article.");
    const previousStatus = article.status;
    const update = {
      ...dto,
      ...(dto.status === "pending" ? { rejectionReason: "" } : {}),
    };
    const data = await this.repository.update(
      "articles",
      { _id: id },
      { $set: update },
    );
    if (dto.status && dto.status !== previousStatus) {
      await this.history(id, previousStatus, dto.status, user.id);
      if (dto.status === "pending")
        await this.notify(
          article.ownerId,
          "Resubmitted Visitor Article",
          `Visitor resubmitted article "${dto.title ?? article.title}" for review.`,
          id,
        );
    }
    return { success: true, message: "Article updated successfully.", data };
  }
  async myArticles(user: AuthenticatedUser, status?: string): Promise<any> {
    const filter: Record<string, unknown> = {
      visitorId: user.id,
      ...(status &&
      ["draft", "pending", "approved", "rejected"].includes(status)
        ? { status }
        : {}),
    };
    const data = await this.repository.list("articles", filter, {
      populate: ["ashramId", "bookingId"],
      sort: { updatedAt: -1 },
    });
    return {
      success: true,
      counts: await this.articleCounts({ visitorId: user.id }),
      data,
    };
  }
  async ownerArticles(user: AuthenticatedUser, status?: string): Promise<any> {
    const filter: Record<string, unknown> = {
      ownerId: user.id,
      ...(status && status !== "all" ? { status } : {}),
    };
    const data = await this.repository.list("articles", filter, {
      populate: ["visitorId", "ashramId", "bookingId"],
      sort: { createdAt: -1 },
    });
    return {
      success: true,
      counts: await this.articleCounts({ ownerId: user.id }),
      data,
    };
  }
  async reviewArticle(
    user: AuthenticatedUser,
    id: string,
    action: "approve" | "reject",
    reason?: string,
  ): Promise<any> {
    if (action === "reject" && !reason?.trim())
      throw new BadRequestException(
        "Rejection reason is mandatory when rejecting an article.",
      );
    const article = await this.repository.one(
      "articles",
      { _id: id },
      { populate: ["ashramId"] },
    );
    if (!article) throw new NotFoundException("Article not found.");
    if (user.role !== "super_admin" && String(article.ownerId) !== user.id)
      throw new ForbiddenException("You do not own this Ashram.");
    const status = action === "approve" ? "approved" : "rejected";
    const data = await this.repository.update(
      "articles",
      { _id: id },
      {
        $set: {
          status,
          rejectionReason: action === "reject" ? reason!.trim() : "",
          ...(action === "approve" ? { publishedAt: new Date() } : {}),
        },
      },
    );
    await this.history(id, article.status, status, user.id, reason);
    await this.notify(
      article.visitorId,
      action === "approve"
        ? "Article Approved & Published!"
        : "Article Status Updated",
      action === "approve"
        ? `Your article "${article.title}" is now published.`
        : `Your article "${article.title}" was rejected. Reason: ${reason}`,
      id,
    );
    return {
      success: true,
      message:
        action === "approve"
          ? "Article approved and published."
          : "Article rejected.",
      data,
    };
  }
  async publicArticles(query: Record<string, string>): Promise<any> {
    const filter: Record<string, any> = {
      status: "approved",
      ...(query.category && query.category.toLowerCase() !== "all"
        ? { category: query.category }
        : {}),
      ...(query.ashramId ? { ashramId: query.ashramId } : {}),
    };
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 100));
      filter.$or = ["title", "shortDescription", "tags"].map((field) => ({
        [field]: { $regex: term, $options: "i" },
      }));
    }
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const sort =
      query.sort === "popular"
        ? { viewsCount: -1, likesCount: -1 }
        : { publishedAt: -1 };
    const [data, total] = await Promise.all([
      this.repository.list("articles", filter, {
        populate: ["visitorId", "ashramId"],
        sort,
        skip: (page - 1) * limit,
        limit,
      }),
      this.repository.count("articles", filter),
    ]);
    return {
      success: true,
      count: data.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data,
    };
  }
  async publicArticle(slug: string): Promise<any> {
    const filter = Types.ObjectId.isValid(slug)
      ? { $or: [{ slug }, { _id: slug }], status: "approved" }
      : { slug, status: "approved" };
    const article = await this.repository.one("articles", filter, {
      populate: ["visitorId", "ashramId", "bookingId"],
    });
    if (!article) throw new NotFoundException("Article not found.");
    await this.repository.update(
      "articles",
      { _id: article._id },
      { $inc: { viewsCount: 1 } },
    );
    article.viewsCount = Number(article.viewsCount ?? 0) + 1;
    const [comments, relatedArticles] = await Promise.all([
      this.repository.list(
        "comments",
        { articleId: article._id, isApproved: { $ne: false } },
        { sort: { createdAt: -1 } },
      ),
      this.repository.list(
        "articles",
        {
          status: "approved",
          _id: { $ne: article._id },
          $or: [
            { category: article.category },
            { ashramId: article.ashramId?._id ?? article.ashramId },
          ],
        },
        { populate: ["visitorId"], limit: 4 },
      ),
    ]);
    return { success: true, data: { article, comments, relatedArticles } };
  }
  async likeArticle(user: AuthenticatedUser, id: string): Promise<any> {
    if (
      !(await this.repository.one("articles", { _id: id, status: "approved" }))
    )
      throw new NotFoundException("Article not found.");
    const existing = await this.repository.one("likes", {
      articleId: id,
      userId: user.id,
    });
    if (existing) {
      await this.repository.remove("likes", { _id: existing._id });
      const article = await this.repository.update(
        "articles",
        { _id: id },
        { $inc: { likesCount: -1 } },
      );
      return {
        success: true,
        liked: false,
        likesCount: Math.max(0, article?.likesCount ?? 0),
      };
    }
    await this.repository.create("likes", { articleId: id, userId: user.id });
    const article = await this.repository.update(
      "articles",
      { _id: id },
      { $inc: { likesCount: 1 } },
    );
    return { success: true, liked: true, likesCount: article?.likesCount ?? 1 };
  }
  async commentArticle(
    user: AuthenticatedUser,
    id: string,
    comment: string,
  ): Promise<any> {
    if (
      !(await this.repository.one("articles", { _id: id, status: "approved" }))
    )
      throw new NotFoundException("Article not found.");
    const data = await this.repository.create("comments", {
      articleId: id,
      userId: user.id,
      userName: user.name || "Verified Pilgrim",
      userRole: user.role,
      comment: comment.trim(),
      isApproved: true,
    });
    return { success: true, message: "Comment added.", data };
  }

  private session(value: string): string {
    const sessionId = String(value || "").trim();
    if (!/^[a-zA-Z0-9_-]{16,128}$/.test(sessionId))
      throw new BadRequestException("A valid X-Session-Id header is required");
    return sessionId;
  }
  private slug(value: string): string {
    return `${value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s-]+/g, "-")}-${crypto.randomUUID().slice(0, 5)}`;
  }
  private async ownsJob(user: AuthenticatedUser, id: string): Promise<void> {
    const job = await this.repository.one("jobs", { _id: id });
    if (!job) throw new NotFoundException("Volunteer opening not found.");
    if (user.role !== "super_admin" && String(job.ownerId) !== user.id)
      throw new ForbiddenException("You cannot manage this opening");
  }
  private async history(
    articleId: unknown,
    previousStatus: string,
    newStatus: string,
    actionBy: string,
    reason = "",
  ): Promise<void> {
    await this.repository.create("histories", {
      articleId,
      previousStatus,
      newStatus,
      actionBy,
      reason,
    });
  }
  private async notify(
    recipientId: unknown,
    title: string,
    message: string,
    articleId: unknown,
  ): Promise<void> {
    await this.repository.create("notifications", {
      recipientId,
      title,
      message,
      type: "visitor_article",
      data: { articleId },
      isRead: false,
    });
  }
  private async articleCounts(
    scope: Record<string, unknown>,
  ): Promise<Record<string, number>> {
    const [draft, pending, approved, rejected, total] = await Promise.all(
      ["draft", "pending", "approved", "rejected"]
        .map((status) =>
          this.repository.count("articles", { ...scope, status }),
        )
        .concat(this.repository.count("articles", scope)),
    );
    return { draft, pending, approved, rejected, total };
  }
}
