import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { Roles } from "../../../common/decorators/roles.decorator";
import { BookingIdentityService } from "../application/booking-identity.service";
import { parseIdentityCode } from "../domain/identity-code";

@Controller("bookings/identity")
export class BookingIdentityController {
  constructor(private readonly identity: BookingIdentityService) {}

  @Get("decode/:code")
  @Roles(
    "owner",
    "stay_admin",
    "manager",
    "reception",
    "support",
    "national_admin",
    "super_admin",
  )
  decode(@Param("code") code: string) {
    const parsed = parseIdentityCode(code);
    return { success: true, valid: Boolean(parsed), data: parsed };
  }

  @Get("properties/:ashramId")
  @Roles(
    "owner",
    "stay_admin",
    "manager",
    "support",
    "national_admin",
    "super_admin",
  )
  async property(@Param("ashramId") ashramId: string) {
    return {
      success: true,
      data: await this.identity.findPropertyIdentity(ashramId),
    };
  }

  @Post("properties/:ashramId")
  @Roles("national_admin", "super_admin")
  @HttpCode(200)
  async register(@Param("ashramId") ashramId: string) {
    return {
      success: true,
      message: "Property identity registered.",
      data: await this.identity.ensurePropertyIdentity(ashramId),
    };
  }
}
