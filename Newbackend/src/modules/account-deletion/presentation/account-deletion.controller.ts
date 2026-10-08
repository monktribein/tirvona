import { Body, Controller, Delete, Get, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import {
  AuthenticatedUser,
  CurrentUser,
} from "../../../common/decorators/current-user.decorator";
import { AuthenticatedUploadThrottle } from "../../../common/throttling/rate-limit.decorators";
import { AccountDeletionService } from "../application/account-deletion.service";
import { DeleteAccountDto } from "./account-deletion.dto";

@ApiTags("Account deletion")
@ApiBearerAuth()
@Controller("users/me")
export class AccountDeletionController {
  constructor(private readonly service: AccountDeletionService) {}

  /** What stops this account from being deleted right now, if anything. */
  @Get("deletion-check")
  async check(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.service.eligibility(user) };
  }

  /** Permanently erases the signed-in person's account (Google Play policy). */
  @Delete()
  // Per-user bucket: the password check must not be brute-forceable.
  @AuthenticatedUploadThrottle(5, 900_000)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Req() request: Request & { id?: string },
  ) {
    await this.service.delete(user, dto, {
      ip: request.ip,
      userAgent: request.get("user-agent") ?? undefined,
      requestId: request.id,
    });
    return {
      success: true,
      message:
        "Your account has been deleted. Your personal details were erased; booking and payment records are kept only as the law requires.",
    };
  }
}
