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
      if (!COMPLETED_STAY.includes(booking.status))
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
          status: { $in: COMPLETED_STAY },
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
