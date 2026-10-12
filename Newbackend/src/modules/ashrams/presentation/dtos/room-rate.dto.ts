import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { IsEntityId } from "../../../../common/decorators/is-entity-id.decorator";

export class UpsertRoomRateDto {
  @IsEntityId()
  ashramId: string;

  @IsEntityId()
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
  @IsEntityId()
  ashramId: string;

  @IsArray()
  @IsEntityId({ each: true })
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
