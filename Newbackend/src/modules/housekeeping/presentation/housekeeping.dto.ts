import { IsIn, IsOptional, IsString } from "class-validator";
export class UpdateHousekeepingDto {
  @IsIn(["clean", "dirty", "cleaning", "maintenance"]) status: string;
  @IsOptional() @IsString() notes?: string;
}
