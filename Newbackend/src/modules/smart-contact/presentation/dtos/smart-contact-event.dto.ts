import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import {
  CLIENT_REPORTABLE_EVENT_TYPES,
  SMART_CONTACT_QR_SOURCES,
} from "../../domain/smart-contact.constants";

/**
 * What the public contact page is allowed to report (spec §23).
 *
 * The enum is `CLIENT_REPORTABLE_EVENT_TYPES`, not the full list: profile
 * views, scans and vCard downloads are recorded server-side when the
 * corresponding response is served. Accepting those from the browser would let
 * anyone POST a few thousand `PROFILE_VIEW`s and move the conversion rate the
 * console reports.
 */
export class LogSmartContactEventDto {
  @IsIn(CLIENT_REPORTABLE_EVENT_TYPES as unknown as string[], {
    message: "eventType is not a client-reportable Smart Contact event",
  })
  eventType!: string;

  /** `?src=business-card` and friends (spec §28). */
  @IsOptional()
  @IsIn(SMART_CONTACT_QR_SOURCES as unknown as string[])
  source?: string;
}

export class PublicProfileQueryDto {
  @IsOptional()
  @IsIn(SMART_CONTACT_QR_SOURCES as unknown as string[])
  src?: string;

  /**
   * Set by the public page when the visit began as a QR scan, so the funnel
   * can separate a scan from someone opening a shared link. It is a hint from
   * an untrusted client and is only ever used to label an event, never to
   * grant anything.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === "true")
  scan?: boolean;
}

export class SmartContactAnalyticsQueryDto {
  @IsOptional()
  @IsIn(["today", "yesterday", "last7", "last30", "thisMonth", "custom"])
  preset?: string;

  @IsOptional() @IsString() @MaxLength(40) from?: string;
  @IsOptional() @IsString() @MaxLength(40) to?: string;
}
