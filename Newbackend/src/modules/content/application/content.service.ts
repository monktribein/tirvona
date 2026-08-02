import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { escapeRegex } from "../../../common/utils/escape-regex";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  CONTENT_REPOSITORY,
  type ContentRepository,
} from "../domain/content.repository";
import type {
  BlogCommentDto,
  CmsChangeDto,
  GenerateItineraryDto,
} from "../presentation/dtos/content.dto";

@Injectable()
export class ContentService {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly repository: ContentRepository,
  ) {}

  async blogPosts(query: Record<string, string>): Promise<any> {
    const filter: Record<string, any> = { status: "published" };
    if (query.category && query.category !== "All")
      filter.category = query.category;
    if (query.contentType && query.contentType !== "All")
      filter.contentType = query.contentType;
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 100));
      filter.$or = ["title", "excerpt"].map((key) => ({
        [key]: { $regex: term, $options: "i" },
      }));
      filter.$or.push({ tags: { $in: [new RegExp(term, "i")] } });
    }
    const data = await this.repository.list("blogPosts", filter, {
      populate: ["authorId"],
      sort: { createdAt: -1 },
    });
    return { success: true, count: data.length, data };
  }

  async blogPost(slug: string): Promise<any> {
    const post = await this.repository.one(
      "blogPosts",
      { slug, status: "published" },
      ["authorId"],
    );
    if (!post) throw new NotFoundException("Article or video not found");
    await this.repository.update(
      "blogPosts",
      { _id: post._id },
      { $inc: { views: 1 } },
    );
    post.views = Number(post.views ?? 0) + 1;
    const [comments, relatedPosts] = await Promise.all([
      this.repository.list(
        "blogComments",
        { postId: post._id, status: "approved" },
        { sort: { createdAt: -1 } },
      ),
      this.repository.list(
        "blogPosts",
        {
          _id: { $ne: post._id },
          category: post.category,
          status: "published",
        },
        { populate: ["authorId"], limit: 3 },
      ),
    ]);
    return { success: true, data: { post, comments, relatedPosts } };
  }

  async comment(slug: string, dto: BlogCommentDto): Promise<any> {
    const post = await this.repository.one("blogPosts", { slug });
    if (!post) throw new NotFoundException("Post not found");
    const data = await this.repository.create("blogComments", {
      postId: post._id,
      userName: dto.userName?.trim() || "Devotee Pilgrim",
      userEmail: dto.userEmail?.trim() || "pilgrim@tirvona.com",
      comment: dto.comment.trim(),
      rating: dto.rating ?? 5,
      status: "approved",
    });
    return { success: true, message: "Comment submitted successfully!", data };
  }

  async like(slug: string): Promise<any> {
    const post = await this.repository.update(
      "blogPosts",
      { slug },
      { $inc: { likes: 1 } },
    );
    if (!post) throw new NotFoundException("Post not found");
    return { success: true, likes: post.likes };
  }

  async submitChange(user: AuthenticatedUser, dto: CmsChangeDto): Promise<any> {
    const data = await this.repository.create("requests", {
      userId: user.id,
      role: user.role,
      page: dto.page ?? "homepage",
      section: dto.section,
      title: dto.title ?? `Edit ${dto.section} on ${dto.page ?? "homepage"}`,
      oldValue: dto.oldValue ?? null,
      newValue: dto.newValue,
      status: "pending",
    });
    await this.audit(user.id, "CMS_CHANGE_REQUEST_SUBMITTED", {
      requestId: data._id,
    });
    return {
      success: true,
      message: "Content change request submitted for Owner approval",
      data,
    };
  }

  async cmsRequests(filter: Record<string, unknown>): Promise<any> {
    const data = await this.repository.list("requests", filter, {
      populate: ["userId", "approvedBy", "rejectedBy"],
      sort: { createdAt: -1 },
    });
    return { success: true, count: data.length, data };
  }

  async publish(
    id: string,
    user: AuthenticatedUser,
    approve: boolean,
    reason?: string,
  ): Promise<any> {
    const request = await this.repository.one("requests", { _id: id });
    if (!request) throw new NotFoundException("Change request not found");
    if (request.status !== "pending")
      throw new BadRequestException(`Request is already ${request.status}`);
    const update = approve
      ? { status: "approved", approvedBy: user.id }
      : {
          status: "rejected",
          rejectedBy: user.id,
          reason: reason ?? "Content does not align with trust guidelines",
        };
    const data = await this.repository.update("requests", { _id: id }, update);
    if (
      approve &&
      String(request.section).includes("banner") &&
      request.newValue &&
      typeof request.newValue === "object"
    ) {
      await this.repository.create("banners", {
        title: request.newValue.title ?? request.title,
        imageUrl:
          request.newValue.imageUrl ??
          request.newValue.bannerImage ??
          "/banner/ashram_rishikesh.png",
        linkUrl: request.newValue.linkUrl ?? "/",
        status: "active",
        createdBy: request.userId,
      });
    }
    await this.audit(
      user.id,
      approve ? "CMS_CHANGE_REQUEST_APPROVED" : "CMS_CHANGE_REQUEST_REJECTED",
      { requestId: id },
    );
    return {
      success: true,
      message: approve
        ? "Content change approved and published successfully"
        : "Content change request rejected with feedback",
      data,
    };
  }

  async published(): Promise<any> {
    const requests = await this.repository.list(
      "requests",
      { status: "approved" },
      { sort: { updatedAt: -1 }, limit: 100 },
    );
    const data: Record<string, unknown> = {};
    for (const request of requests)
      if (!(request.section in data)) data[request.section] = request.newValue;
    return { success: true, data };
  }

  async deleteRequest(id: string, user: AuthenticatedUser): Promise<any> {
    const request = await this.repository.remove("requests", { _id: id });
    if (!request) throw new NotFoundException("Change request not found");
    await this.audit(user.id, "CMS_CHANGE_REQUEST_DELETED", { requestId: id });
    return {
      success: true,
      message: "Change request deleted. Reverted to default system content.",
    };
  }

  async resetSection(section: string, user: AuthenticatedUser): Promise<any> {
    const deletedCount = await this.repository.removeMany("requests", {
      section,
    });
    await this.audit(user.id, "CMS_SECTION_RESET", { section, deletedCount });
    return {
      success: true,
      message: `Reset ${section} section. Restored original system default image & text.`,
      deletedCount,
    };
  }

  async catalogue(
    type: "circuits" | "temples" | "events" | "directory",
    query: Record<string, string>,
  ): Promise<any> {
    const map = {
      circuits: "circuits",
      temples: "temples",
      events: "events",
      directory: "directory",
    } as const;
    const filter: Record<string, any> =
      type === "events" ? {} : { status: "active" };
    const exact =
      type === "circuits"
        ? "circuitType"
        : type === "events"
          ? "eventType"
          : type === "directory"
            ? "moduleType"
            : undefined;
    if (exact && query[exact] && query[exact] !== "All")
      filter[exact] = query[exact];
    if (query.category && query.category !== "All")
      filter.category = query.category;
    for (const field of ["city", "state"])
      if (query[field])
        filter[field] = { $regex: escapeRegex(query[field]), $options: "i" };
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 100));
      filter.$or = (
        type === "temples" ? ["name", "deity", "city"] : ["title"]
      ).map((field) => ({ [field]: { $regex: term, $options: "i" } }));
    }
    const data = await this.repository.list(map[type], filter, {
      sort:
        type === "events"
          ? { startDate: 1 }
          : { displayOrder: 1, rating: -1, createdAt: -1 },
    });
    return { success: true, count: data.length, data };
  }

  async catalogueOne(
    type: "circuits" | "temples" | "events",
    slug: string,
  ): Promise<any> {
    const data = await this.repository.one(type, {
      slug,
      ...(type === "events" ? {} : { status: "active" }),
    });
    if (!data)
      throw new NotFoundException(
        type === "circuits"
          ? "Pilgrimage Circuit not found"
          : type === "temples"
            ? "Temple not found"
            : "Event not found",
      );
    return { success: true, data };
  }

  async itinerary(dto: GenerateItineraryDto): Promise<any> {
    const durationDays = dto.durationDays ?? 7;
    const data = await this.repository.create("itineraries", {
      destination: dto.destination ?? "Kedarnath & Char Dham",
      purpose: dto.purpose ?? "Pilgrimage & Darshan",
      startCity: dto.startCity ?? "Haridwar",
      travelDate: dto.travelDate ?? new Date().toISOString().slice(0, 10),
      durationDays,
      adults: dto.adults ?? 2,
      children: dto.children ?? 0,
      seniorCitizens: dto.seniorCitizens ?? 0,
      budgetType: dto.budgetType ?? "Standard",
      preferences: dto.preferences ?? {},
      totalEstimatedCost: durationDays * 2800,
    });
    return { success: true, message: "Itinerary generated successfully", data };
  }

  async templates(): Promise<any> {
    const data = await this.repository.list("plannerTemplates", {
      status: "active",
    });
    return { success: true, count: data.length, data };
  }

  async local(query: Record<string, string>, category?: string): Promise<any> {
    const filter: Record<string, any> = { status: "active" };
    if (query.city && !["all", "All"].includes(query.city))
      filter.city = { $regex: escapeRegex(query.city), $options: "i" };
    const selected = category ?? query.category;
    if (selected && !["all", "All"].includes(selected))
      filter.category = selected === "restaurants" ? "food" : selected;
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 100));
      filter.$or = ["title", "location", "description"].map((field) => ({
        [field]: { $regex: term, $options: "i" },
      }));
    }
    const data = await this.repository.list("localServices", filter, {
      sort: { rating: -1, createdAt: -1 },
    });
    return { success: true, count: data.length, data };
  }

  private async audit(
    userId: string,
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.repository.create("audits", {
      userId,
      action,
      module: "CMS",
      details,
    });
  }
}
