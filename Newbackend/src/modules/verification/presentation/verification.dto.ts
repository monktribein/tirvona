import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
export class ScheduleInspectionDto {
  @IsDateString() date: string;
}
export class VerificationStatusDto {
  @IsIn(["approved", "rejected", "suspended"]) status: string;
  @IsOptional() @IsString() comments?: string;
  @IsOptional() @IsString() rejectionReason?: string;
  @IsOptional() @IsString() reportUrl?: string;
}
