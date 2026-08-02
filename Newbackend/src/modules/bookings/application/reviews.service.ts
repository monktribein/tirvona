import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { CreateReviewDto } from "../presentation/dtos/booking.dto";

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel("BookingReview") private readonly reviews: Model<any>,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
  ) {}
  async create(user: AuthenticatedUser, dto: CreateReviewDto): Promise<any> {
    const booking = await this.bookings.findOne({
      _id: dto.bookingId,
      customerId: user.id,
      ashramId: dto.ashramId,
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (!["checked_out", "completed"].includes(booking.status))
      throw new BadRequestException("You can review an ashram after checkout");
    if (await this.reviews.exists({ bookingId: booking._id }))
      throw new ConflictException("You have already reviewed this booking");
    const review = await this.reviews.create({
      customerId: user.id,
      ashramId: dto.ashramId,
      bookingId: dto.bookingId,
      rating: dto.rating,
      comment: dto.comment,
      status: "approved",
    });
    const [rating] = await this.reviews.aggregate([
      { $match: { ashramId: booking.ashramId, status: "approved" } },
      {
        $group: {
          _id: null,
          average: { $avg: "$rating.overall" },
          count: { $sum: 1 },
        },
      },
    ]);
    await this.ashrams.updateOne(
      { _id: dto.ashramId },
      {
        $set: {
          rating: {
            average: Number((rating?.average ?? 0).toFixed(2)),
            count: rating?.count ?? 0,
          },
        },
      },
    );
    return review;
  }
  forAshram(id: string): Promise<any[]> {
    return this.reviews
      .find({ ashramId: id, status: "approved" })
      .populate("customerId", "name avatar")
      .sort({ createdAt: -1 })
      .lean();
  }
  recent(): Promise<any[]> {
    return this.reviews
      .find({ status: "approved" })
      .populate("customerId", "name avatar")
      .populate("ashramId", "name address images")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }
}
