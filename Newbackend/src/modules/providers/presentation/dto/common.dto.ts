import { Transform, Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  Max,
  Min,
  registerDecorator,
  type ValidationOptions,
} from "class-validator";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../domain/provider.constants";

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAGE_SIZE) limit?: number;
}

export const pageParams = (query: PageQueryDto) => {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
};

/** "true"/"false" query strings -> booleans (anything else fails validation). */
export const QueryBoolean = () =>
  Transform(({ value }) => {
    if (value === true || value === "true" || value === "1") return true;
    if (value === false || value === "false" || value === "0") return false;
    return value;
  });

const LOCALE_KEY = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

/** A locale map such as { en: "Rudrabhishek", hi: "रुद्राभिषेक" }; `en` is mandatory. */
export function IsLocaleMap(
  maxLength: number,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isLocaleMap",
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a locale map with an "en" entry, each text 1-${maxLength} characters`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (!value || typeof value !== "object" || Array.isArray(value))
            return false;
          const entries = Object.entries(value as Record<string, unknown>);
          if (!entries.length || entries.length > 12) return false;
          if (typeof (value as Record<string, unknown>).en !== "string")
            return false;
          return entries.every(
            ([key, text]) =>
              LOCALE_KEY.test(key) &&
              typeof text === "string" &&
              text.trim().length >= 1 &&
              text.length <= maxLength,
          );
        },
      },
    });
}
