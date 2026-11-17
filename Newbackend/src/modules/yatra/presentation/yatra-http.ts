import {
  type ArgumentMetadata,
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  type PipeTransform,
  SetMetadata,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Throttle } from "@nestjs/throttler";
import { hybridRateLimitTracker, ipRateLimitTracker } from "../../../common/throttling/rate-limit-trackers";

const ALWAYS_AVAILABLE = "yatraAlwaysAvailable";
/** Marks an endpoint that answers even while Yatra is switched off (the feature flag itself). */
export const YatraAlwaysAvailable = () => SetMetadata(ALWAYS_AVAILABLE, true);

/**
 * Tirvona Yatra is on unless YATRA_ENABLED=false. While off, every Yatra
 * endpoint answers 404, so nothing can be created or sold.
 */
@Injectable()
export class YatraEnabledGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<boolean>("yatraEnabled")) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALWAYS_AVAILABLE, [context.getHandler(), context.getClass()])) return true;
    throw new NotFoundException({ success: false, message: "Tirvona Yatra is not available yet.", code: "YATRA_DISABLED" });
  }
}

/** Route ids are 24 hex characters; anything else is a 400, never a database query. */
@Injectable()
export class EntityIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (typeof value !== "string" || !/^[0-9a-f]{24}$/i.test(value))
      throw new BadRequestException(`${metadata.data ?? "id"} must be a valid id`);
    return value;
  }
}

/** Per-account limit for money and inventory writes (falls back to IP for guests). */
export const YatraWriteThrottle = (limit: number, ttl: number) =>
  Throttle({
    default: { limit, ttl, getTracker: hybridRateLimitTracker },
    ipAbuse: { limit: limit * 50, ttl, getTracker: ipRateLimitTracker },
  });

export const ok = <T>(data: T, message?: string) => ({ success: true, ...(message ? { message } : {}), data });
export const paged = (result: { items: unknown[]; total: number }, page: number, limit: number) => ({
  success: true,
  data: result.items,
  total: result.total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(result.total / limit)),
});
