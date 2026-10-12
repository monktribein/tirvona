import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { SensitiveThrottle } from "../../../common/throttling/rate-limit.decorators";
import { ProviderConsultationService } from "../application/provider-consultation.service";
import { Idempotent } from "../infrastructure/idempotency.interceptor";
import {
  CancelWithReasonDto,
  CompleteConsultationDto,
  ConsultationListQueryDto,
  MessageListQueryDto,
  CreateConsultationDto,
  ScheduleConsultationDto,
  SendConsultationMessageDto,
} from "./dto/booking.dto";
import { ObjectIdPipe } from "./object-id.pipe";
import { ProviderApi } from "./provider-api.decorator";

/**
 * Ask-a-Pandit / Ask-a-Jyotishi. Only the customer and the expert can read a
 * consultation (there is deliberately no admin read), and completing one never
 * creates a booking or a payment.
 */
@ProviderApi()
@Controller({ path: "consultations", version: "2" })
export class ConsultationsController {
  constructor(private readonly consultations: ProviderConsultationService) {}

  @Post()
  @Idempotent("consultation.create", { sensitive: true })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConsultationDto) {
    return this.consultations.create(user, dto);
  }

  /** The caller's consultations as a customer. Experts use GET /provider/consultations. */
  @Get()
  mine(@CurrentUser() user: AuthenticatedUser, @Query() query: ConsultationListQueryDto) {
    return this.consultations.listMine(user, query);
  }

  @Get(":consultationId")
  one(
    @CurrentUser() user: AuthenticatedUser,
    @Param("consultationId", ObjectIdPipe) consultationId: string,
  ) {
    return this.consultations.get(user, consultationId);
  }

  /** Expert confirms the requested time or moves it. */
  @Post(":consultationId\\:schedule")
  @Idempotent("consultation.schedule", { sensitive: true })
  schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param("consultationId", ObjectIdPipe) consultationId: string,
    @Body() dto: ScheduleConsultationDto,
  ) {
    return this.consultations.schedule(user, consultationId, dto);
  }

  @Post(":consultationId\\:start")
  @Idempotent("consultation.start", { sensitive: true })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param("consultationId", ObjectIdPipe) consultationId: string,
  ) {
    return this.consultations.start(user, consultationId);
  }

  @Post(":consultationId\\:complete")
  @Idempotent("consultation.complete", { sensitive: true })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("consultationId", ObjectIdPipe) consultationId: string,
    @Body() dto: CompleteConsultationDto,
  ) {
    return this.consultations.complete(user, consultationId, dto);
  }

  @Get(":consultationId/messages")
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("consultationId", ObjectIdPipe) consultationId: string,
    @Query() query: MessageListQueryDto,
  ) {
    return this.consultations.listMessages(user, consultationId, query);
  }

  @Post(":consultationId/messages")
  @SensitiveThrottle(30, 60_000)
  @Idempotent("consultation.message")
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("consultationId", ObjectIdPipe) consultationId: string,
    @Body() dto: SendConsultationMessageDto,
  ) {
    return this.consultations.sendMessage(user, consultationId, dto);
  }

  /** Customer or expert; which one is decided by the consultation, not by the caller. */
  @Post(":consultationId\\:cancel")
  @Idempotent("consultation.cancel", { sensitive: true })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("consultationId", ObjectIdPipe) consultationId: string,
    @Body() dto: CancelWithReasonDto,
  ) {
    return this.consultations.cancelAs(user, consultationId, dto);
  }
}
