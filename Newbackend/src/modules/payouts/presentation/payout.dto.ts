import { Transform, Type } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { PAYOUT_MODES, PAYOUT_STATUSES } from "../domain/payout.constants";

export class SavePayoutBankAccountDto {
  @IsString() @MinLength(2) @MaxLength(100) accountHolderName!: string;
  @IsString() @Matches(/^\d{9,18}$/) accountNumber!: string;
  @IsString() @Matches(/^\d{9,18}$/) confirmAccountNumber!: string;
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
  ifsc!: string;
  @IsOptional() @IsEmail() beneficiaryEmail?: string;
  @IsOptional()
  @Transform(({ value }) => String(value).replace(/[\s()+-]/g, ""))
  @Matches(/^[1-9]\d{7,14}$/)
  beneficiaryPhone?: string;
}

export class CreatePayoutRequestDto {
  @IsMongoId() ashramId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1)
  amount!: number;
  @IsOptional() @IsIn(PAYOUT_MODES) mode?: string;
  @IsUUID("4") clientRequestId!: string;
}

export class RevealManualPayoutBankDetailsDto {
  @IsString() @MinLength(5) @MaxLength(200) reason!: string;
}

export class RecordManualPayoutDto {
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z0-9][A-Z0-9/_-]{5,49}$/)
  transferReference!: string;

  @IsOptional() @IsString() @MaxLength(500) note?: string;

  @IsUUID("4") clientRequestId!: string;

  @IsBoolean() @Equals(true) confirmed!: boolean;
}

export class PayoutListQueryDto {
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsMongoId() ownerId?: string;
  @IsOptional() @IsIn(PAYOUT_STATUSES) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
