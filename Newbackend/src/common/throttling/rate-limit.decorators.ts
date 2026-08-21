import { Throttle } from "@nestjs/throttler";
import {
  accountRateLimitTracker,
  hybridRateLimitTracker,
  ipRateLimitTracker,
} from "./rate-limit-trackers";

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const DefaultSensitiveThrottle = (...identifierFields: string[]) =>
  Throttle({
    default: {
      limit: () => positiveInteger(process.env.THROTTLE_LIMIT, 120),
      ttl: () => positiveInteger(process.env.THROTTLE_TTL_MS, 60_000),
      getTracker: accountRateLimitTracker(...identifierFields),
    },
    ipAbuse: {
      limit: () => positiveInteger(process.env.THROTTLE_LIMIT, 120),
      ttl: () => positiveInteger(process.env.THROTTLE_TTL_MS, 60_000),
      getTracker: ipRateLimitTracker,
    },
  });

export const SensitiveThrottle = (
  limit: number,
  ttl: number,
  ...identifierFields: string[]
) =>
  Throttle({
    default: {
      limit,
      ttl,
      getTracker: accountRateLimitTracker(...identifierFields),
    },
    ipAbuse: { limit, ttl, getTracker: ipRateLimitTracker },
  });

export const AuthenticatedUploadThrottle = (limit: number, ttl: number) =>
  Throttle({
    default: { limit, ttl, getTracker: hybridRateLimitTracker },
    ipAbuse: {
      limit: limit * 250,
      ttl,
      getTracker: ipRateLimitTracker,
    },
  });

