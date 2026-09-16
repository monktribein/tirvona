import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpsertRoomRateDto {
  @IsMongoId()
  ashramId: string;

  @IsMongoId()
  roomId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mrp: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(90)
  discountPercent: number;

  @IsOptional()
  @IsBoolean()
  isDiscountActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ToggleRateDiscountDto {
  @IsBoolean()
  isDiscountActive: boolean;
}

export class BulkRoomRatesDto {
  @IsMongoId()
  ashramId: string;

  @IsArray()
  @IsMongoId({ each: true })
  roomIds: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(90)
  discountPercent: number;

  @IsOptional()
  @IsBoolean()
  isDiscountActive?: boolean;
}
