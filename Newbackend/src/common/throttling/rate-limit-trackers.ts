import { createHash } from "node:crypto";
import type { Request } from "express";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";

interface RateLimitRequest extends Request {
  user?: AuthenticatedUser;
  leadUser?: { id?: string };
  rateLimitLeadUserId?: string;
}

const compact = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const ipRateLimitTracker = (
  rawRequest: Record<string, any>,
): string => {
  const request = rawRequest as RateLimitRequest;
  return `ip:${request.ip || request.socket?.remoteAddress || "unknown"}`;
};

export const hybridRateLimitTracker = (
  rawRequest: Record<string, any>,
): string => {
  const request = rawRequest as RateLimitRequest;
  const platformId = compact(request.user?.id || request.user?._id);
  if (platformId) return `platform-user:${platformId}`;

  const leadId = compact(
    request.leadUser?.id || request.rateLimitLeadUserId,
  );
  if (leadId) return `lead-user:${leadId}`;

  return ipRateLimitTracker(request);
};

export const accountRateLimitTracker =
  (...fields: string[]) =>
  (rawRequest: Record<string, any>): string => {
    const request = rawRequest as RateLimitRequest;
    for (const field of fields) {
      const raw = request.body?.[field] ?? request.params?.[field];
      const value = compact(raw);
      if (value) return `account:${field}:${digest(value)}`;
    }
    return ipRateLimitTracker(request);
  };
