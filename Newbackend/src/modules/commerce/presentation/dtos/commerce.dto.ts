import { Type } from "class-transformer";
import { PartialType } from "@nestjs/swagger";
import {
  IsArray,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
export class WaitlistDto {
  @IsEmail() email: string;
  @IsOptional() @IsIn(["buyer", "seller"]) role?: string;
}
export class ServiceProviderDto {
  @IsString() @MaxLength(160) name: string;
  @IsString() @MaxLength(80) category: string;
  @IsOptional() @IsString() subcategory?: string;
  @IsOptional() @IsString() tagline?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsString() city: string;
  @IsString() state: string;
  @IsOptional() @IsString() address?: string;
  @IsObject() pricing: Record<string, unknown>;
  @IsOptional() @IsObject() specifications?: Record<string, unknown>;
  @IsString() contactPhone: string;
  @IsOptional() @IsString() whatsappNumber?: string;
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsString() status?: string;
}
export class UpdateServiceProviderDto extends PartialType(ServiceProviderDto) {}
export class ServiceBookingDto {
  @IsString() serviceId: string;
  @IsString() @MaxLength(120) customerName: string;
  @IsString() @MaxLength(30) customerPhone: string;
  @IsOptional() @IsString() bookingDate?: string;
  @IsOptional() @IsString() bookingTime?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) guestsCount?: number;
  @Type(() => Number) @IsNumber() @Min(0) totalAmount: number;
  @IsOptional() @IsString() @MaxLength(1000) specialNotes?: string;
}
