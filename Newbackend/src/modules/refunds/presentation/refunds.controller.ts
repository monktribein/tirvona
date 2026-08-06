import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { RefundPolicyService } from "../application/refund-policy.service";
import { RefundsService } from "../application/refunds.service";
import {
  CreateRefundRequestDto,
  RefundDecisionDto,
  RefundQueryDto,
  RejectRefundDto,
  SaveRefundPolicyDto,
} from "./dtos/refund.dto";

/**
 * Refund requests.
 *
 * No route is `@Public()`. What a caller may see is decided inside the service
 * by scoping the query, so a pilgrim, an ashram owner and a finance admin all
 * hit the same URLs and get different estates back. The role gates below are
 * the coarse filter; the fine one is the scope filter.
 */
@Controller("refunds")
export class RefundsController {
  constructor(private readonly service: RefundsService) {}

  /** Anyone signed in may claim against their own purchase. */
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRefundRequestDto,
  ) {
    return { success: true, data: await this.service.create(user, dto) };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RefundQueryDto,
  ) {
    return { success: true, ...(await this.service.list(user, query)) };
  }

  /** Counts for the console header. Declared before `:id`. */
  @Get("summary")
  async summary(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.service.summary(user) };
  }

  @Get(":id")
  async one(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.service.get(user, id) };
  }

  @Post(":id/review")
  @HttpCode(200)
  @Roles("super_admin", "national_admin", "finance_manager", "support")
  async review(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RefundDecisionDto,
  ) {
    return {
      success: true,
      data: await this.service.review(user, id, dto.note ?? ""),
    };
  }

  @Post(":id/approve")
  @HttpCode(200)
  @Roles("super_admin", "national_admin", "finance_manager")
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RefundDecisionDto,
  ) {
    return {
      success: true,
      data: await this.service.approve(user, id, dto.note ?? ""),
    };
  }

  @Post(":id/reject")
  @HttpCode(200)
  @Roles("super_admin", "national_admin", "finance_manager", "support")
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RejectRefundDto,
  ) {
    return {
      success: true,
      data: await this.service.reject(user, id, dto.reason),
    };
  }

  /** The requester may withdraw; staff may cancel on their behalf. */
  @Post(":id/cancel")
  @HttpCode(200)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RefundDecisionDto,
  ) {
    return {
      success: true,
      data: await this.service.cancel(user, id, dto.note ?? ""),
    };
  }

  /** Push the money. Money-moving is finance and platform only. */
  @Post(":id/process")
  @HttpCode(200)
  @Roles("super_admin", "national_admin", "finance_manager")
  async process(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return { success: true, data: await this.service.process(user, id) };
  }
}

/**
 * Refund policy configuration — Super Admin only.
 *
 * Deliberately narrower than the request routes: finance may approve a payout
 * under the rules, but changing the rules themselves is a platform decision.
 */
@Controller("refund-policies")
@Roles("super_admin", "national_admin")
export class RefundPoliciesController {
  constructor(private readonly service: RefundPolicyService) {}

  @Get()
  async list(@Query("module") module?: string) {
    const data = await this.service.list(module ? { module } : {});
    return { success: true, count: data.length, data };
  }

  @Get(":id")
  async one(@Param("id") id: string) {
    return { success: true, data: await this.service.get(id) };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveRefundPolicyDto,
  ) {
    return { success: true, data: await this.service.create(user, dto) };
  }

  @Put(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SaveRefundPolicyDto,
  ) {
    return { success: true, data: await this.service.update(user, id, dto) };
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.service.remove(user, id);
  }
}
