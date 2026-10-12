import { createHash } from "node:crypto";
import {
  Injectable,
  SetMetadata,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectModel } from "../../../database/orm-nest";
import type { Request, Response } from "express";
import type { Model } from "../../../database/orm";
import { Observable, from, of, throwError } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";
import { IDEMPOTENCY_TTL_HOURS } from "../domain/provider.constants";
import { providerError } from "../domain/provider.errors";

export const IDEMPOTENT_KEY = "providers:idempotent";

export interface IdempotentOptions {
  /**
   * Restricted data (KYC evidence, contact details): store only the status and
   * the created resource id and replay a minimal body, instead of the response
   * itself (Data Dictionary 7.53: "not sensitive full response").
   */
  sensitive?: boolean;
}

/** Marks a mutating handler as idempotent: the `Idempotency-Key` header is then mandatory. */
export const Idempotent = (operation: string, options: IdempotentOptions = {}) =>
  SetMetadata(IDEMPOTENT_KEY, { operation, ...options });

const KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
/** An IN_PROGRESS record this old belongs to a request that died; it may be taken over. */
const STALE_IN_PROGRESS_MS = 2 * 60_000;

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    );
  return value;
};

export const requestFingerprint = (request: {
  method: string;
  originalUrl?: string;
  url?: string;
  body?: unknown;
}): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        method: request.method,
        url: request.originalUrl ?? request.url,
        body: stable(request.body ?? {}),
      }),
    )
    .digest("hex");

/**
 * Enforces the OpenAPI `Idempotency-Key` header on mutating provider
 * endpoints. The same key + same request by the same caller returns the first
 * result instead of repeating the side effect; the same key with a different
 * request is a conflict. Failed requests release the key so the caller can fix
 * the input and retry with it.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel("ProviderIdempotencyKey") private readonly keys: Model<any>,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const meta = this.reflector.get<{ operation: string } & IdempotentOptions>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: { id?: string } }>();
    const response = http.getResponse<Response>();

    const key = String(request.headers["idempotency-key"] ?? "").trim();
    if (!key)
      throw providerError.badRequest(
        "IDEMPOTENCY_KEY_REQUIRED",
        "The Idempotency-Key header is required for this request",
      );
    if (!KEY_PATTERN.test(key))
      throw providerError.badRequest(
        "IDEMPOTENCY_KEY_INVALID",
        "Idempotency-Key must be 16-128 characters (letters, digits, . _ : -)",
      );

    const actorId = request.user?.id ?? "anonymous";
    const scope = { key, operation: meta.operation, actorId };
    const requestHash = requestFingerprint(request);
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 3_600_000);

    const claim = async (): Promise<boolean> => {
      try {
        await this.keys.create({
          ...scope,
          requestHash,
          state: "IN_PROGRESS",
          expiresAt,
        });
        return true;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) return false;
        throw error;
      }
    };

    if (!(await claim())) {
      const existing = await this.keys.findOne(scope).lean<any>();
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw providerError.conflict(
            "IDEMPOTENCY_KEY_REUSED",
            "This Idempotency-Key was already used for a different request",
          );
        if (existing.state === "COMPLETED" && existing.responseRef) {
          response.setHeader("Idempotent-Replay", "true");
          response.status(existing.responseRef.statusCode ?? 200);
          return of(existing.responseRef.body);
        }
        const stale =
          Date.now() - new Date(existing.createdAt).getTime() > STALE_IN_PROGRESS_MS;
        if (!stale)
          throw providerError.conflict(
            "IDEMPOTENCY_IN_PROGRESS",
            "A request with this Idempotency-Key is still being processed",
          );
        await this.keys.deleteOne({ ...scope, state: "IN_PROGRESS" });
      }
      if (!(await claim()))
        throw providerError.conflict(
          "IDEMPOTENCY_IN_PROGRESS",
          "A request with this Idempotency-Key is still being processed",
        );
    }

    const statusCode = (): number => {
      const declared = Reflect.getMetadata("__httpCode__", context.getHandler());
      return declared ?? (request.method === "POST" ? 201 : 200);
    };

    return next.handle().pipe(
      mergeMap((result) =>
        from(
          this.keys
            .updateOne(scope, {
              $set: {
                state: "COMPLETED",
                responseRef: meta.sensitive
                  ? {
                      statusCode: statusCode(),
                      body: {
                        success: true,
                        replayed: true,
                        data: {
                          id: (result as any)?.data?.id ?? (result as any)?.data?._id,
                        },
                      },
                    }
                  : { statusCode: statusCode(), body: result },
              },
            })
            .then(() => result),
        ),
      ),
      catchError((error) =>
        from(this.keys.deleteOne(scope).catch(() => undefined)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }
}
