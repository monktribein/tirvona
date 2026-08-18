import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { Roles } from "../../../common/decorators/roles.decorator";
import { BookingIdentityService } from "../application/booking-identity.service";
import { parseIdentityCode } from "../domain/identity-code";

/**
 * Read and pre-registration surface for the Ashram Booking Unique Identity
 * Code.
 *
 * A property's registration number is normally minted lazily, on its first
 * booking. `POST` exists so an operator can mint it at onboarding time
 * instead — the ashram module cannot call into this one without breaking the
 * isolation this feature is scoped to keep, so the trigger is an explicit
 * action here rather than a hook over there. Both routes are idempotent.
 *
 * Every path is four segments deep (`bookings/identity/…`), so none of them
 * can be shadowed by `BookingsController`'s two-segment `bookings/:id`.
 */
@Controller("bookings/identity")
export class BookingIdentityController {
  constructor(private readonly identity: BookingIdentityService) {}

  /**
   * Decode a code without touching the database.
   *
   * Pure format arithmetic — useful at a reception desk to confirm a code is
   * structurally genuine, and to read off the cluster and guest type it names,
   * before looking the booking itself up.
   */
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

  /** The registration for an ashram, or null if it has never been registered. */
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

  /**
   * Register an ashram now rather than on its first booking.
   *
   * Idempotent: calling it again returns the registration already issued, which
   * is permanent and cannot be reassigned.
   */
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
