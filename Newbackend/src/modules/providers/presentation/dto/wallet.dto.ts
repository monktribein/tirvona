import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import {
  PAYOUT_METHODS,
  WALLET_ENTRY_STATUSES,
  WALLET_ENTRY_TYPES,
  WITHDRAWAL_STATUSES,
} from "../../domain/provider-wallet.constants";
import { PageQueryDto } from "./common.dto";

export class WalletEntryQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(WALLET_ENTRY_TYPES) type?: string;
  @IsOptional() @IsIn(WALLET_ENTRY_STATUSES) status?: string;
}

export class WithdrawalQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(WITHDRAWAL_STATUSES) status?: string;
}

export class AdminWithdrawalQueryDto extends WithdrawalQueryDto {
  @IsOptional() @IsMongoId() providerId?: string;
}

export class SavePayoutAccountDto {
  @IsIn(PAYOUT_METHODS) method!: "BANK" | "UPI";
  @IsString() @Length(2, 120) accountHolderName!: string;

  @ValidateIf((dto) => dto.method === "BANK") @IsString() @Length(9, 24) accountNumber?: string;
  @ValidateIf((dto) => dto.method === "BANK") @IsString() @Length(11, 11) ifsc?: string;
  @IsOptional() @IsString() @MaxLength(120) bankName?: string;

  @ValidateIf((dto) => dto.method === "UPI") @IsString() @Length(4, 320) upiId?: string;
}

export class RequestWithdrawalDto {
  /** Paise. */
  @Type(() => Number) @IsInt() @Min(1) amountMinor!: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class MarkWithdrawalPaidDto {
  /** Bank UTR / UPI reference of the transfer. */
  @IsString() @Length(4, 64) payoutReference!: string;
}

export class RejectWithdrawalDto {
  @IsString() @Length(3, 300) reason!: string;
}
