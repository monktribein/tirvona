import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Public } from "../../../../common/decorators/public.decorator";
import { AARTI_MODEL } from "../../domain/aarti.constants";
import { AartiDiscoveryService } from "../../application/aarti-discovery.service";
import { AartiPricingService } from "../../application/aarti-pricing.service";
import { AartiStreamService } from "../../application/aarti-stream.service";
import {
  AartiCalendarQueryDto,
  AartiDateQueryDto,
  AartiQuoteDto,
  AartiSearchDto,
  PaginationDto,
  StreamSearchDto,
} from "../dtos/aarti.dto";

@ApiTags("Aarti Discovery")
@Public()
@Controller("aarti")
export class AartiPublicController {
  constructor(
    private readonly discovery: AartiDiscoveryService,
    private readonly pricing: AartiPricingService,
    private readonly streams: AartiStreamService,
    @InjectModel(AARTI_MODEL.Session) private readonly sessions: Model<any>,
    @InjectModel(AARTI_MODEL.PassType) private readonly passTypes: Model<any>,
    @InjectModel(AARTI_MODEL.Review) private readonly reviews: Model<any>,
  ) {}

  @Get("filters") filters() {
    return { success: true, data: this.discovery.filters() };
  }

  @Get("cities") async cities() {
    return { success: true, data: await this.discovery.cities() };
  }

  @Get("sessions") search(@Query() query: AartiSearchDto) {
    return this.discovery.search(query);
  }

  @Get("live") liveStreams(@Query() query: StreamSearchDto) {
    return this.streams.publicList(query);
  }

  @Get("live/:slug") async liveDetail(@Param("slug") slug: string) {
    const data = await this.streams.publicDetail(slug);
    if (!data) throw new NotFoundException("Live pooja not found.");
    return { success: true, data };
  }

  @Get("sessions/:id/passes")
  @Header("Cache-Control", "no-store")
  async passes(@Param("id") id: string, @Query() query: AartiDateQueryDto) {
    const session = await this.sessions.findOne({
      _id: id,
      status: "approved",
    });
    if (!session) throw new NotFoundException("Aarti not found.");
    return {
      success: true,
      data: {
        sessionId: session._id,
        passTypes: await this.discovery.passTypesFor(session, query.date),
      },
    };
  }

  @Get("sessions/:id/calendar")
  @Header("Cache-Control", "no-store")
  async calendar(
    @Param("id") id: string,
    @Query() query: AartiCalendarQueryDto,
  ) {
    const session = await this.sessions.findOne({
      _id: id,
      status: "approved",
    });
    if (!session) throw new NotFoundException("Aarti not found.");
    return {
      success: true,
      data: await this.discovery.availabilityCalendar(
        session,
        query.fromDate,
        query.toDate,
      ),
    };
  }

  @Get("sessions/:id/reviews")
  async sessionReviews(
    @Param("id") id: string,
    @Query() page: PaginationDto,
  ) {
    const limit = Math.min(page.limit, 50);
    const filter = { sessionId: id, status: "approved" };
    const [data, total] = await Promise.all([
      this.reviews
        .find(filter)
        .populate("customerId", "name avatarUrl")
        .sort({ createdAt: -1 })
        .skip((page.page - 1) * limit)
        .limit(limit),
      this.reviews.countDocuments(filter),
    ]);
    return { success: true, count: data.length, total, data };
  }

  @Get("sessions/:idOrSlug")
  async detail(
    @Param("idOrSlug") idOrSlug: string,
    @Query() query: AartiDateQueryDto,
  ) {
    const data = await this.discovery.detail(idOrSlug, query.date);
    if (!data) throw new NotFoundException("Aarti not found.");
    return { success: true, data };
  }

  @Post("quote")
  async quote(@Body() dto: AartiQuoteDto) {
    const [session, passType] = await Promise.all([
      this.sessions.findOne({ _id: dto.sessionId, status: "approved" }),
      this.passTypes.findOne({
        _id: dto.passTypeId,
        sessionId: dto.sessionId,
        isActive: true,
      }),
    ]);
    if (!session) throw new NotFoundException("Aarti not found.");
    if (!passType) throw new NotFoundException("This pass is not available.");
    const result = await this.pricing.quote(session, passType, dto);
    if (!result.ok)
      return { success: false, code: result.code, message: result.message };
    return { success: true, data: result.quote };
  }
}
