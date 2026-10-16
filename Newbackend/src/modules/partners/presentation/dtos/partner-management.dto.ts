import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  PARTNER_ENVIRONMENTS,
  PARTNER_PERMISSIONS,
  PARTNER_STATUSES,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_STATUSES,
  type PartnerEnvironment,
  type PartnerPermission,
  type PartnerStatus,
  type WebhookEventType,
  type WebhookStatus,
} from "../../domain/partner.constants";

export class CreatePartnerDto {
  @ApiProperty({ example: "EaseMyTrip Integrations" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "easemytrip" })
  @IsString()
  @MinLength(2)
  slug!: string;

  @ApiProperty({ example: "partner-support@easemytrip.com" })
  @IsEmail()
  contactEmail!: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: "Travel distribution partner" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PARTNER_ENVIRONMENTS, default: "sandbox" })
  @IsIn(PARTNER_ENVIRONMENTS)
  environment!: PartnerEnvironment;

  @ApiProperty({ enum: PARTNER_PERMISSIONS, isArray: true })
  @IsArray()
  @IsEnum(PARTNER_PERMISSIONS, { each: true })
  allowedPermissions!: PartnerPermission[];

  @ApiPropertyOptional({ type: [String], description: "Allowed ashram IDs" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopedAshramIds?: string[];

  @ApiPropertyOptional({ default: 120 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  rateLimitPerMinute?: number;
}

export class UpdatePartnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PARTNER_STATUSES })
  @IsOptional()
  @IsIn(PARTNER_STATUSES)
  status?: PartnerStatus;

  @ApiPropertyOptional({ enum: PARTNER_PERMISSIONS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(PARTNER_PERMISSIONS, { each: true })
  allowedPermissions?: PartnerPermission[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopedAshramIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(10)
  rateLimitPerMinute?: number;
}

export class CreateApiKeyDto {
  @ApiProperty({ example: "Production Backend Key" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: PARTNER_ENVIRONMENTS })
  @IsIn(PARTNER_ENVIRONMENTS)
  environment!: PartnerEnvironment;

  @ApiProperty({ enum: PARTNER_PERMISSIONS, isArray: true })
  @IsArray()
  @IsEnum(PARTNER_PERMISSIONS, { each: true })
  permissions!: PartnerPermission[];

  @ApiPropertyOptional({ description: "Expiry date (ISO string)" })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class CreateWebhookDto {
  @ApiProperty({ example: "https://api.partner.com/webhooks/tirvona" })
  @IsString()
  url!: string;

  @ApiPropertyOptional({ example: "Main production webhook receiver" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: WEBHOOK_EVENT_TYPES, isArray: true })
  @IsArray()
  @IsEnum(WEBHOOK_EVENT_TYPES, { each: true })
  subscribedEvents!: WebhookEventType[];
}

export class UpdateWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: WEBHOOK_STATUSES })
  @IsOptional()
  @IsIn(WEBHOOK_STATUSES)
  status?: WebhookStatus;

  @ApiPropertyOptional({ enum: WEBHOOK_EVENT_TYPES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(WEBHOOK_EVENT_TYPES, { each: true })
  subscribedEvents?: WebhookEventType[];
}
