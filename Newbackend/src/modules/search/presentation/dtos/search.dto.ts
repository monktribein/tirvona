import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class GlobalSearchQueryDto {
  /**
   * Capped because the term becomes an escaped regex. Escaping already removes
   * the ReDoS operators, and the length bound keeps a pathological literal from
   * being scanned across every indexed field.
   */
  @IsString()
  @MaxLength(80)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  perType = 5;
}
