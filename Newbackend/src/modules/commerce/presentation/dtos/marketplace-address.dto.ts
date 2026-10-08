import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class AddressDto {
  @IsOptional() @IsString() @MaxLength(30) label?: string;
  @IsString() @MinLength(2) @MaxLength(80) fullName!: string;
  @Matches(/^[0-9+\-\s]{8,15}$/, { message: "phone must be a valid number" })
  phone!: string;
  @IsString() @MinLength(3) @MaxLength(120) line1!: string;
  @IsOptional() @IsString() @MaxLength(120) line2?: string;
  @IsOptional() @IsString() @MaxLength(80) landmark?: string;
  @IsString() @MinLength(2) @MaxLength(60) city!: string;
  @IsString() @MinLength(2) @MaxLength(60) state!: string;
  @Matches(/^[1-9][0-9]{5}$/, { message: "pincode must be 6 digits" })
  pincode!: string;
  @IsOptional() @IsString() @MaxLength(60) country?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto extends AddressDto {}
