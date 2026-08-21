import { IsString, MaxLength, MinLength } from "class-validator";

export class LeadLoginDto {
  @IsString() @MinLength(10) @MaxLength(20) phone!: string;
  @IsString() @MinLength(6) @MaxLength(128) password!: string;
}
