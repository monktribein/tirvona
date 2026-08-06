import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { CreateReviewDto } from "../presentation/dtos/booking.dto";

/** Booking states that count as "this person actually stayed here". */
const COMPLETED_STAY = ["checked_out", "completed"];

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel("BookingReview") private readonly reviews: Model<any>,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
  ) {}

  /**
   * Post a review.
   *
   * Any signed-in account may review an ashram. Whether the reviewer actually
   * stayed is decided HERE, from their own booking history — never from a flag
   * in the request — and surfaces as `verifiedStay`. That keeps the badge
   * trustworthy while still letting a visitor who only attended the aarti say
   * so.
   *
   * One review per person per ashram, enforced by a unique index as well as the
   * check below, so two racing submissions cannot both land.
   */
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
      // No booking quoted, but the reviewer may still have stayed here — award
      // the badge if any completed stay of theirs matches this ashram.
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
      // The unique index is the real guard; a duplicate that slipped past the
      // check above lands here rather than as a 500.
      if (error?.code === 11000)
        throw new ConflictException("You have already reviewed this ashram");
      throw error;
    }

    await this.recalculateRating(dto.ashramId);
    return review;
  }

  /** Recompute the ashram's cached average from its approved reviews. */
  private async recalculateRating(ashramId: string): Promise<void> {
    const [rating] = await this.reviews.aggregate([
      // $match does no casting, so the id has to be a real ObjectId here — a
      // string silently matches nothing and would zero every rating.
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

  /** Whether the caller may review, and their existing review if any. */
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
      // Verified stays first, then newest — so the most trustworthy voices sit
      // at the top of the list.
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
}
