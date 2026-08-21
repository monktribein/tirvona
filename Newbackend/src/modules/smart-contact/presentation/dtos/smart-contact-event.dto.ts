import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import {
  CLIENT_REPORTABLE_EVENT_TYPES,
  SMART_CONTACT_QR_SOURCES,
} from "../../domain/smart-contact.constants";

export class LogSmartContactEventDto {
  @IsIn(CLIENT_REPORTABLE_EVENT_TYPES as unknown as string[], {
    message: "eventType is not a client-reportable Smart Contact event",
  })
  eventType!: string;

  @IsOptional()
  @IsIn(SMART_CONTACT_QR_SOURCES as unknown as string[])
  source?: string;
}

export class PublicProfileQueryDto {
  @IsOptional()
  @IsIn(SMART_CONTACT_QR_SOURCES as unknown as string[])
  src?: string;

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
