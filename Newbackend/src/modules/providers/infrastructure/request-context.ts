import { AsyncLocalStorage } from "node:async_hooks";
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";

/**
 * Per-request facts the audit trail needs (request id, client address, agent)
 * without threading them through every service signature.
 */
export interface ProviderRequestContext {
  requestId: string;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<ProviderRequestContext>();

export const currentRequestContext = (): ProviderRequestContext | undefined =>
  storage.getStore();

/** Correlation id for state history; falls back to a caller-supplied value outside HTTP. */
export const correlationId = (fallback = "system"): string =>
  storage.getStore()?.requestId ?? fallback;

@Injectable()
export class ProviderRequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { id?: string }>();
    const store: ProviderRequestContext = {
      requestId: request.id ?? "unknown",
      ip: request.ip,
      userAgent: String(request.headers["user-agent"] ?? "").slice(0, 300) || undefined,
    };
    return new Observable((subscriber) =>
      storage.run(store, () => next.handle().subscribe(subscriber)),
    );
  }
}
