import { UseInterceptors, applyDecorators } from "@nestjs/common";
import { IdempotencyInterceptor } from "../infrastructure/idempotency.interceptor";
import { ProviderRequestContextInterceptor } from "../infrastructure/request-context";

/** Request context for the audit trail, plus Idempotency-Key enforcement on handlers marked @Idempotent. */
export const ProviderApi = () =>
  applyDecorators(
    UseInterceptors(ProviderRequestContextInterceptor, IdempotencyInterceptor),
  );
