import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  REFUND_MODULES,
  REFUND_STATUSES,
} from "../../infrastructure/persistence/refund.schemas";

export class CreateRefundRequestDto {
  @IsIn(REFUND_MODULES as unknown as string[]) module!: string;
  @IsMongoId() sourceId!: string;
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
  @IsOptional() @IsString() @MaxLength(1000) customerNote?: string;
}

export class RefundDecisionDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class RejectRefundDto {
  @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}

export class RefundQueryDto {
  @IsOptional() @IsIn(REFUND_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsIn(REFUND_MODULES as unknown as string[]) module?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

class CancellationWindowDto {
  @IsOptional() @IsString() @MaxLength(60) label?: string;
  @Type(() => Number) @IsNumber() @Min(0) hoursBefore!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) refundPercent!: number;
}

class ProcessingFeeDto {
  @IsOptional() @IsIn(["none", "flat", "percent"]) type?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) value?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxAmount?: number;
}

export class SaveRefundPolicyDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsIn([...(REFUND_MODULES as unknown as string[]), "global"]) module!: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priority?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CancellationWindowDto)
  cancellationWindows?: CancellationWindowDto[];

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  defaultRefundPercent?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProcessingFeeDto)
  processingFee?: ProcessingFeeDto;

  @IsOptional() @IsBoolean() refundPlatformFee?: boolean;
  @IsOptional() @IsBoolean() refundGst?: boolean;
  @IsOptional() @IsBoolean() refundAddOns?: boolean;
  @IsOptional() @IsBoolean() refundDonation?: boolean;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) autoApproveBelow?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  requiresSecondApprovalAbove?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) claimWindowHours?: number;
}
