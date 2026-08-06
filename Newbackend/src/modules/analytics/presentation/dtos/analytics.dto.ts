import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

/**
 * The bucket granularities the overview time series supports.
 *
 * These are the four tabs on the admin dashboard. The value drives a
 * `$dateTrunc` unit and a window length, so an unknown string would silently
 * produce an empty chart — hence the closed set rather than a free string.
 */
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
