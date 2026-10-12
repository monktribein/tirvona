import { PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  FULFILMENT_TYPES,
  RITUAL_STATUSES,
  VARIANT_STATUSES,
} from "../../domain/provider.constants";
import { IsLocaleMap, PageQueryDto } from "./common.dto";
import { Type } from "class-transformer";
import { ArrayMaxSize as MaxItems, IsArray as IsList, IsIn as OneOf, IsOptional as Optional, IsString as Str, Length as Len, ValidateNested as Nested } from "class-validator";
import { MAX_PROCESS_STEPS, PROCESS_STEP_OWNERS } from "../../domain/provider.constants";

export class ProcessStepDto {
  @Str() @Len(2, 120) title: string;
  @Optional() @Str() @Len(0, 600) detail?: string;
  @Optional() @OneOf(PROCESS_STEP_OWNERS) owner?: string;
}

/** The puja's step-by-step guide: what happens before the pandit arrives, during, and after. */
export class RitualProcessDto {
  @Optional() @IsList() @MaxItems(MAX_PROCESS_STEPS) @Nested({ each: true }) @Type(() => ProcessStepDto) before?: ProcessStepDto[];
  @Optional() @IsList() @MaxItems(MAX_PROCESS_STEPS) @Nested({ each: true }) @Type(() => ProcessStepDto) during?: ProcessStepDto[];
  @Optional() @IsList() @MaxItems(MAX_PROCESS_STEPS) @Nested({ each: true }) @Type(() => ProcessStepDto) after?: ProcessStepDto[];
}

const trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateRitualDto {
  /** Generated from the English title when omitted. */
  @IsOptional() @trim() @Matches(SLUG, { message: "slug must be lowercase letters, digits and hyphens" }) @MaxLength(80) slug?: string;
  @IsLocaleMap(160) titles: Record<string, string>;
  @IsLocaleMap(600) summary: Record<string, string>;
  @IsOptional() @trim() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(15) @IsString({ each: true }) @MaxLength(80, { each: true }) aliases?: string[];
  @IsArray() @ArrayMaxSize(6) @IsIn(FULFILMENT_TYPES, { each: true }) applicableFulfilmentTypes: string[];
  @IsOptional() @IsInt() @Min(1) @Max(2880) defaultDurationMinutes?: number;
}

/** The slug is a stable public URL; it cannot be edited. */
export class UpdateRitualDto extends PartialType(CreateRitualDto) {}

export class RitualWorkflowDto {
  @IsOptional() @trim() @IsString() @MaxLength(500) note?: string;
}

export class CreateRitualVariantDto {
  @trim() @Matches(SLUG, { message: "code must be lowercase letters, digits and hyphens" }) @MinLength(2) @MaxLength(60) code: string;
  @IsLocaleMap(160) titles: Record<string, string>;
  /** Inclusions, indicative mantra count/steps, duration band, team-size range. */
  @IsObject() scope: Record<string, unknown>;
}

export class UpdateRitualVariantDto {
  @IsOptional() @IsLocaleMap(160) titles?: Record<string, string>;
  @IsOptional() @IsObject() scope?: Record<string, unknown>;
  @IsOptional() @IsIn(VARIANT_STATUSES) status?: string;
}

export class RitualSearchQueryDto extends PageQueryDto {
  @IsOptional() @trim() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @trim() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsIn(FULFILMENT_TYPES) fulfilmentType?: string;
  @IsOptional() @trim() @IsString() @Matches(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/) locale?: string;
}

export class AdminRitualQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(RITUAL_STATUSES) status?: string;
  @IsOptional() @trim() @IsString() @MaxLength(80) q?: string;
}
