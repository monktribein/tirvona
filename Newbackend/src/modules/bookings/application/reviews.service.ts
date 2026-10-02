import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { CreateReviewDto } from "../presentation/dtos/booking.dto";

const COMPLETED_STAY = ["checked_out", "completed"];

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel("BookingReview") private readonly reviews: Model<any>,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateReviewDto): Promise<any> {
    const ashram = await this.ashrams.findOne({
      _id: dto.ashramId,
      deletedAt: null,
    });
    if (!ashram) throw new NotFoundException("Ashram not found");

    let bookingId: string | null = null;
    let verifiedStay = false;

    if (dto.bookingId) {
      const booking = await this.bookings.findOne({
        _id: dto.bookingId,
        customerId: user.id,
        ashramId: dto.ashramId,
      });
      if (!booking) throw new NotFoundException("Booking not found");
      const isOverdueStay =
        booking.status === "checked_in" &&
        booking.checkOutDate &&
        new Date(booking.checkOutDate) < new Date();
      if (!COMPLETED_STAY.includes(booking.status) && !isOverdueStay)
        throw new BadRequestException(
          "You can review this stay after checkout",
        );
      bookingId = String(booking._id);
      verifiedStay = true;
    } else {
      verifiedStay = Boolean(
        await this.bookings.exists({
          customerId: user.id,
          ashramId: dto.ashramId,
          $or: [
            { status: { $in: COMPLETED_STAY } },
            { status: "checked_in", checkOutDate: { $lt: new Date() } },
          ],
        }),
      );
    }

    if (
      await this.reviews.exists({
        customerId: user.id,
        ashramId: dto.ashramId,
      })
    )
      throw new ConflictException("You have already reviewed this ashram");

    let review: any;
    try {
      review = await this.reviews.create({
        customerId: user.id,
        ashramId: dto.ashramId,
        bookingId,
        verifiedStay,
        rating: dto.rating,
        comment: dto.comment,
        // Only a super admin may set a public name other than their own.
        ...(user.role === "super_admin" && dto.displayName?.trim()
          ? { displayName: dto.displayName.trim() }
          : {}),
        status: "approved",
      });
    } catch (error: any) {
      if (error?.code === 11000)
        throw new ConflictException("You have already reviewed this ashram");
      throw error;
    }

    await this.recalculateRating(dto.ashramId);
    return review;
  }

  private async recalculateRating(ashramId: string): Promise<void> {
    const [rating] = await this.reviews.aggregate([
      {
        $match: {
          ashramId: new Types.ObjectId(String(ashramId)),
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          average: { $avg: "$rating.overall" },
          count: { $sum: 1 },
        },
      },
    ]);
    await this.ashrams.updateOne(
      { _id: ashramId },
      {
        $set: {
          rating: {
            average: Number((rating?.average ?? 0).toFixed(2)),
            count: rating?.count ?? 0,
          },
        },
      },
    );
  }

  /** Every stay review for the super-admin console, newest first. */
  async adminList(query: Record<string, string>): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter: Record<string, any> = {};
    if (["approved", "hidden", "pending"].includes(query.status))
      filter.status = query.status;
    if (query.ashramId && Types.ObjectId.isValid(query.ashramId))
      filter.ashramId = query.ashramId;
    const term = query.search?.trim().slice(0, 100);
    if (term) {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const ashramIds = (
        await this.ashrams.find({ name: pattern }).select("_id").lean()
      ).map((a: any) => a._id);
      filter.$or = [
        { comment: pattern },
        { displayName: pattern },
        { ashramId: { $in: ashramIds } },
      ];
    }
    const [data, total] = await Promise.all([
      this.reviews
        .find(filter)
        .populate("customerId", "name email phone role")
        .populate("ashramId", "name address")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.reviews.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  /** Hides or re-shows a review; hidden reviews stop counting in the rating. */
  async setStatus(
    user: AuthenticatedUser,
    id: string,
    status: "approved" | "hidden",
  ): Promise<any> {
    if (user.role !== "super_admin")
      throw new ForbiddenException("Only a super admin can moderate reviews");
    const review = await this.reviews.findById(id);
    if (!review) throw new NotFoundException("Review not found");
    review.status = status;
    await review.save();
    await this.recalculateRating(String(review.ashramId));
    return review;
  }

  /**
   * Lets a super admin set or clear the public reviewer name on a review they
   * posted. An empty name falls back to their account name.
   */
  async setDisplayName(
    user: AuthenticatedUser,
    id: string,
    displayName: string,
  ): Promise<any> {
    if (user.role !== "super_admin")
      throw new ForbiddenException("Only a super admin can set a reviewer name");
    const review = await this.reviews.findById(id);
    if (!review) throw new NotFoundException("Review not found");
    if (String(review.customerId) !== user.id)
      throw new ForbiddenException("You can only rename reviews you posted");
    const name = displayName.trim();
    review.displayName = name || undefined;
    await review.save();
    return review;
  }

  async eligibility(
    user: AuthenticatedUser,
    ashramId: string,
  ): Promise<Record<string, unknown>> {
    const [existing, stay] = await Promise.all([
      this.reviews.findOne({ customerId: user.id, ashramId }).lean(),
      this.bookings
        .findOne({
          customerId: user.id,
          ashramId,
          status: { $in: COMPLETED_STAY },
        })
        .select("_id")
        .lean(),
    ]);
    return {
      canReview: !existing,
      alreadyReviewed: Boolean(existing),
      existingReview: existing ?? null,
      verifiedStay: Boolean(stay),
      bookingId: stay ? String((stay as any)._id) : null,
    };
  }

  forAshram(id: string): Promise<any[]> {
    return this.reviews
      .find({ ashramId: id, status: "approved" })
      .populate("customerId", "name avatarUrl")
      .sort({ verifiedStay: -1, createdAt: -1 })
      .lean();
  }

  recent(): Promise<any[]> {
    return this.reviews
      .find({ status: "approved" })
      .populate("customerId", "name avatarUrl")
      .populate("ashramId", "name address images")
      .sort({ verifiedStay: -1, createdAt: -1 })
      .limit(20)
      .lean();
  }

  async remove(user: AuthenticatedUser, id: string): Promise<any> {
    const review = await this.reviews.findById(id);
    if (!review) throw new NotFoundException("Review not found");

    const isAuthor = String(review.customerId) === user.id;
    const isAdminOrOwner = ["super_admin", "ashram_admin", "ashram_owner", "owner", "manager"].includes(
      user.role,
    );

    if (!isAuthor && !isAdminOrOwner) {
      throw new ForbiddenException(
        "You are not authorized to remove this review",
      );
    }

    const ashramId = String(review.ashramId);
    await this.reviews.deleteOne({ _id: id });
    await this.recalculateRating(ashramId);
    return { success: true, message: "Review deleted successfully" };
  }
}
