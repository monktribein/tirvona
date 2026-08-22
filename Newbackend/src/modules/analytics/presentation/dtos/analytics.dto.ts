import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export const ANALYTICS_RANGES = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export class AnalyticsOverviewQueryDto {
  @IsOptional() @IsIn(ANALYTICS_RANGES) range: AnalyticsRange = "daily";
}

export class RecentBookingsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}
