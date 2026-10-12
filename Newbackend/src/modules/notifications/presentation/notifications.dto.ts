import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { IsEntityId } from "../../../common/decorators/is-entity-id.decorator";
import { USER_ROLES } from "../../users/infrastructure/persistence/user.schema";

const AUDIENCE_TYPES = ["all", "users", "role", "ashram"] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

export class AudiencePreviewDto {
  @IsIn(AUDIENCE_TYPES) audienceType: AudienceType;
  @IsOptional() @IsArray() @IsIn(USER_ROLES, { each: true }) targetRoles?: string[];
  @IsOptional() @IsArray() @IsEntityId({ each: true }) targetUserIds?: string[];
  @IsOptional() @IsArray() @IsEntityId({ each: true }) ashramIds?: string[];
}

export class SendCampaignDto {
  @IsString() @MinLength(1) title: string;
  @IsString() @MinLength(1) body: string;
  @IsOptional() @IsUrl() imageUrl?: string;
  @IsOptional() @IsString() deepLink?: string;
  @IsIn(AUDIENCE_TYPES) audienceType: AudienceType;
  @IsOptional() @IsArray() @IsIn(USER_ROLES, { each: true }) targetRoles?: string[];
  @IsOptional() @IsArray() @IsEntityId({ each: true }) targetUserIds?: string[];
  @IsOptional() @IsArray() @IsEntityId({ each: true }) ashramIds?: string[];
}

export class ListCampaignsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 50;
}

export class InboxQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
