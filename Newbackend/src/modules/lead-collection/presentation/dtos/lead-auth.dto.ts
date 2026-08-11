import { IsString, MaxLength, MinLength } from "class-validator";

export class LeadLoginDto {
  // Loose on format, strict on content: the service normalises to the last 10
  // digits, so "+91 98765 43210" and "9876543210" reach the same account.
  @IsString() @MinLength(10) @MaxLength(20) phone!: string;
  @IsString() @MinLength(6) @MaxLength(128) password!: string;
}
