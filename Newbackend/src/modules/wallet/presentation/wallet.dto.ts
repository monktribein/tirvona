import { Transform, Type } from "class-transformer";
import {
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
} from "class-validator";
import {
  WALLET_TXN_CATEGORIES,
  WITHDRAWAL_METHODS,
  WITHDRAWAL_STATUSES,
} from "../domain/wallet.constants";

class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class WalletTransactionQueryDto extends PageDto {
  @IsOptional() @IsIn(["credit", "debit"]) type?: string;
  @IsOptional() @IsIn(WALLET_TXN_CATEGORIES as unknown as string[]) category?: string;
}

export class WalletAdminQueryDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(["balance", "recent"]) sort?: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  hasBalance?: boolean;
}

export class WithdrawalQueryDto extends PageDto {
  @IsOptional() @IsIn(WITHDRAWAL_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}

export class CreateWithdrawalDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(1_000_000) amount!: number;
  @IsIn(WITHDRAWAL_METHODS as unknown as string[]) method!: "bank" | "upi";
  @IsOptional() @IsString() @MaxLength(120) accountHolderName?: string;
  @IsOptional() @IsString() @MaxLength(30) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(15) ifsc?: string;
  @IsOptional() @IsString() @MaxLength(120) bankName?: string;
  @IsOptional() @IsString() @MaxLength(120) upiId?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class AdminCreditDto {
  @IsMongoId() userId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(1_000_000) amount!: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(80) idempotencyKey?: string;
}

export class WithdrawalDecisionDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class RejectWithdrawalDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class MarkWithdrawalPaidDto {
  @IsString() @MinLength(3) @MaxLength(80) payoutReference!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
