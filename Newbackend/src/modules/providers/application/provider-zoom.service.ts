import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { providerError } from "../domain/provider.errors";
import { ProviderAuditService } from "./provider-audit.service";
import { sameId, toObjectId } from "./provider.helpers";

export interface ZoomMeetingView {
  meetingId: string;
  topic?: string;
  joinUrl: string;
  /** Host link. Only ever returned to the booking's provider. */
  startUrl?: string;
  status: string;
  createdAt?: Date;
  isHost: boolean;
}

/** A meeting is only meaningful while the service is still to happen or happening. */
const MEETING_STATUSES = [
  "CONFIRMED",
  "PROVIDER_ACCEPTED",
  "PREPARATION_IN_PROGRESS",
  "READY_FOR_FULFILMENT",
  "IN_PROGRESS",
];
const OPS_ROLES = ["super_admin", "service_manager"];
/** An unfinished creation older than this is treated as dead and may be retaken. */
const STALE_CREATION_MS = 60_000;
const ZOOM_TIMEOUT_MS = 10_000;

/**
 * Zoom Live Pooja (Server-to-Server OAuth).
 *
 * - Credentials missing -> a structured `ZOOM_NOT_CONFIGURED` error, never a crash.
 * - One meeting per booking: creation is claimed with a conditional update before
 *   Zoom is called, so two simultaneous requests cannot create two meetings.
 * - Only the booking's provider is the host and receives the host link. The
 *   devotee gets the join link, and only while the booking is live. Operations
 *   staff can see the join link but never hold the host link.
 */
@Injectable()
export class ProviderZoomService {
  private readonly logger = new Logger(ProviderZoomService.name);

  constructor(
    @InjectModel("ProviderBooking") private readonly bookings: Model<any>,
    private readonly audit: ProviderAuditService,
  ) {}

  isConfigured(): boolean {
    const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
    return Boolean(ZOOM_ACCOUNT_ID?.trim() && ZOOM_CLIENT_ID?.trim() && ZOOM_CLIENT_SECRET?.trim());
  }

  async getMeeting(
    user: AuthenticatedUser,
    bookingId: string,
  ): Promise<{ success: boolean; data: ZoomMeetingView | null; configured: boolean }> {
    const booking: any = await this.bookings
      .findById(toObjectId(bookingId, "bookingId"))
      .select("+zoomMeeting.startUrl")
      .lean();
    const isCustomer = booking && sameId(user.id, booking.customerUserId);
    const isProvider = booking && sameId(user.id, booking.providerUserId);
    const isOps = booking && OPS_ROLES.includes(user.role);
    // Anyone else is told the booking does not exist.
    if (!isCustomer && !isProvider && !isOps)
      throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");

    const configured = this.isConfigured();
    const meeting = booking.zoomMeeting;
    if (!meeting?.meetingId || !MEETING_STATUSES.includes(booking.status))
      return { success: true, data: null, configured };

    return {
      success: true,
      configured,
      data: {
        meetingId: meeting.meetingId,
        topic: meeting.topic || `Tirvona Live Pooja: ${booking.bookingNumber}`,
        joinUrl: meeting.joinUrl,
        ...(isProvider && meeting.startUrl ? { startUrl: meeting.startUrl } : {}),
        status: meeting.status || "SCHEDULED",
        createdAt: meeting.createdAt,
        isHost: Boolean(isProvider),
      },
    };
  }

  async createMeeting(
    user: AuthenticatedUser,
    bookingId: string,
  ): Promise<{ success: boolean; data: ZoomMeetingView; reused: boolean }> {
    const id = toObjectId(bookingId, "bookingId");
    const booking: any = await this.bookings.findById(id).select("+zoomMeeting.startUrl").lean();
    if (!booking || !sameId(user.id, booking.providerUserId))
      throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");
    if (!MEETING_STATUSES.includes(booking.status))
      throw providerError.unprocessable(
        "BOOKING_NOT_ELIGIBLE_FOR_ZOOM",
        `A Zoom session can only be created for a paid, live booking (current status: ${booking.status})`,
      );

    const view = (meeting: any, reused: boolean) => ({
      success: true,
      reused,
      data: {
        meetingId: meeting.meetingId,
        topic: meeting.topic,
        joinUrl: meeting.joinUrl,
        startUrl: meeting.startUrl,
        status: meeting.status || "SCHEDULED",
        createdAt: meeting.createdAt,
        isHost: true,
      } as ZoomMeetingView,
    });

    if (booking.zoomMeeting?.meetingId) return view(booking.zoomMeeting, true);
    if (!this.isConfigured())
      throw providerError.unprocessable(
        "ZOOM_NOT_CONFIGURED",
        "Zoom Live Pooja is not configured on this server (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET are required).",
      );

    // Claim the creation before calling Zoom, so only one request can create the meeting.
    const now = new Date();
    const claimed = await this.bookings.updateOne(
      {
        _id: id,
        $or: [
          { zoomMeeting: null },
          { "zoomMeeting.status": "CREATING", "zoomMeeting.lockedAt": { $lt: new Date(now.getTime() - STALE_CREATION_MS) } },
        ],
      },
      { $set: { zoomMeeting: { status: "CREATING", lockedAt: now } } },
    );
    if (!claimed.matchedCount) {
      const current: any = await this.bookings.findById(id).select("+zoomMeeting.startUrl").lean();
      if (current?.zoomMeeting?.meetingId) return view(current.zoomMeeting, true);
      throw providerError.conflict("ZOOM_CREATION_IN_PROGRESS", "The Zoom session is already being created. Try again in a moment.");
    }

    let created: any;
    try {
      created = await this.callZoomCreateMeeting(booking);
    } catch (error) {
      await this.bookings.updateOne({ _id: id, "zoomMeeting.status": "CREATING" }, { $set: { zoomMeeting: null } });
      throw error;
    }
    const meeting = {
      meetingId: String(created.id),
      topic: created.topic || `Tirvona Live Pooja: ${booking.bookingNumber}`,
      joinUrl: created.join_url,
      startUrl: created.start_url,
      password: created.password || "",
      status: "SCHEDULED",
      createdAt: new Date(),
    };
    await this.bookings.updateOne({ _id: id, "zoomMeeting.status": "CREATING" }, { $set: { zoomMeeting: meeting } });
    // Ids only: neither link nor password is audited.
    await this.audit.log(user, "booking.zoom_meeting_created", "provider_booking", id, {
      meetingId: meeting.meetingId,
    });
    return view(meeting, false);
  }

  private async callZoomCreateMeeting(booking: any): Promise<any> {
    const accountId = process.env.ZOOM_ACCOUNT_ID?.trim() ?? "";
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID?.trim()}:${process.env.ZOOM_CLIENT_SECRET?.trim()}`,
    ).toString("base64");
    const failed = (code: string, message: string, status?: number) => {
      this.logger.error(`${code}${status ? ` (HTTP ${status})` : ""}`); // never the response body: it can echo credentials
      return providerError.badGateway(code, status ? `${message} (${status})` : message);
    };

    let accessToken: string | undefined;
    try {
      const tokenRes = await fetch(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
        {
          method: "POST",
          headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
          signal: AbortSignal.timeout(ZOOM_TIMEOUT_MS),
        },
      );
      if (!tokenRes.ok) throw failed("ZOOM_AUTH_FAILED", "Failed to authenticate with Zoom", tokenRes.status);
      accessToken = ((await tokenRes.json()) as any)?.access_token;
    } catch (error) {
      if ((error as { getStatus?: unknown }).getStatus) throw error;
      throw failed("ZOOM_AUTH_FAILED", "Could not reach Zoom to authenticate");
    }
    if (!accessToken) throw failed("ZOOM_AUTH_FAILED", "Zoom did not return an access token");

    const duration = Number(booking.serviceSnapshot?.offering?.durationMinutes) || 60;
    try {
      const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(ZOOM_TIMEOUT_MS),
        body: JSON.stringify({
          topic: `Tirvona Live Pooja: ${booking.bookingNumber}`,
          type: 2,
          start_time: new Date(booking.scheduledStartAt).toISOString(),
          duration,
          timezone: booking.timezone || "Asia/Kolkata",
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            mute_upon_entry: true,
            waiting_room: true,
            audio: "both",
            auto_recording: "none",
          },
        }),
      });
      if (!res.ok) throw failed("ZOOM_CREATION_FAILED", "Zoom could not create the meeting", res.status);
      return await res.json();
    } catch (error) {
      if ((error as { getStatus?: unknown }).getStatus) throw error;
      throw failed("ZOOM_CREATION_FAILED", "Could not reach Zoom to create the meeting");
    }
  }
}
