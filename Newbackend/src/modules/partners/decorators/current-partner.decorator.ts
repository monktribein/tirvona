import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { PartnerPermission, PartnerEnvironment } from "../domain/partner.constants";

export interface AuthenticatedPartnerContext {
  partnerId: string;
  partnerName: string;
  partnerSlug: string;
  environment: PartnerEnvironment;
  scopedAshramIds: string[];
  permissions: PartnerPermission[];
  keyId: string;
  keyPrefix: string;
  rateLimitPerMinute?: number;
}

export const CurrentPartner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPartnerContext =>
    context.switchToHttp().getRequest<{ partner: AuthenticatedPartnerContext }>().partner,
);
