import { SetMetadata } from "@nestjs/common";
import { PartnerPermission } from "../domain/partner.constants";

export const PARTNER_PERMISSIONS_KEY = "partner_permissions";
export const RequirePartnerPermissions = (...permissions: PartnerPermission[]) =>
  SetMetadata(PARTNER_PERMISSIONS_KEY, permissions);
