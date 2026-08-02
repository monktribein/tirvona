import { Type } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class BlogCommentDto {
  @IsOptional() @IsString() @MaxLength(80) userName?: string;
  @IsOptional() @IsEmail() @MaxLength(120) userEmail?: string;
  @IsString() @MaxLength(2000) comment: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number;
}

export class CmsChangeDto {
  @IsOptional() @IsString() @MaxLength(80) page?: string;
  @IsString() @MaxLength(120) section: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() oldValue?: unknown;
  @IsObject() newValue: Record<string, unknown>;
}

export class RejectContentDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class GenerateItineraryDto {
  @IsOptional() @IsString() @MaxLength(120) destination?: string;
  @IsOptional() @IsString() @MaxLength(120) purpose?: string;
  @IsOptional() @IsString() @MaxLength(120) startCity?: string;
  @IsOptional() @IsString() travelDate?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  durationDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) adults?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(50) children?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  seniorCitizens?: number;
  @IsOptional() @IsString() @MaxLength(40) budgetType?: string;
  @IsOptional() @IsObject() preferences?: Record<string, unknown>;
}
