import { Injectable, type PipeTransform } from "@nestjs/common";
import { providerError } from "../domain/provider.errors";

/** Rejects anything that is not a 24-hex id before it reaches a query. */
@Injectable()
export class ObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== "string" || !/^[a-fA-F0-9]{24}$/.test(value))
      throw providerError.badRequest("INVALID_ID", "The id in the URL is not valid");
    return value;
  }
}

/** Id or slug (lowercase letters, digits, hyphens) for public lookups. */
@Injectable()
export class IdOrSlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/.test(value))
      throw providerError.badRequest("INVALID_ID", "The id or slug in the URL is not valid");
    return value;
  }
}
