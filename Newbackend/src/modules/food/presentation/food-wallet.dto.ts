import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { FOOD_PAYMENT_METHODS, type FoodPaymentMethod } from "../domain/food.constants";

const trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));

/** An empty form field means "not given". */
const blankToUndefined = () =>
  Transform(({ value }) => {
    const text = typeof value === "string" ? value.trim() : value;
    return text === "" ? undefined : text;
  });

/** Tirvona paid a kitchen. Everything except cash needs the receipt image. */
export class RecordFoodPaymentDto {
  /** At least ₹1 and at most ₹10,00,000 in one entry, which catches an extra zero. */
  @IsInt() @Min(100) @Max(100_000_000) amountPaise: number;

  @IsIn(FOOD_PAYMENT_METHODS as unknown as string[]) method: FoodPaymentMethod;

  /** Bank UTR or UPI transaction id. */
  @IsOptional() @blankToUndefined() @IsString() @MaxLength(80) reference?: string;

  /** The uploaded receipt image. Must be https, because it is shown to the kitchen as a link. */
  @IsOptional()
  @blankToUndefined()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(500)
  receiptUrl?: string;

  /** When the money was paid. Defaults to now. */
  @IsOptional() @IsDateString() paidAt?: string;

  @IsOptional() @blankToUndefined() @IsString() @MaxLength(300) note?: string;

  /** Generated once per form, so a retried or double-clicked request records one payment. */
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) idempotencyKey?: string;
}

export class VoidFoodPaymentDto {
  @trim() @IsString() @MinLength(3) @MaxLength(300) reason: string;
}

export class FoodWalletOrdersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
