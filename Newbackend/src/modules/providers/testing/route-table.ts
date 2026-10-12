/**
 * Reads the route table straight from the controllers' decorators, so tests
 * (and humans printing it) see exactly what Nest will register.
 */
import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA, VERSION_METADATA } from "@nestjs/common/constants";
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator";
import { ROLES_KEY } from "../../../common/decorators/roles.decorator";
import { IDEMPOTENT_KEY } from "../infrastructure/idempotency.interceptor";
import { ProviderBookingsController } from "../presentation/bookings.controller";
import { ConsultationsController } from "../presentation/consultations.controller";
import {
  AdminConsultationsController,
  AdminOfferingsController,
  AdminProviderBookingsController,
  AdminProvidersController,
  AdminRitualVariantsController,
  AdminRitualsController,
} from "../presentation/provider-admin.controller";
import { ProviderSelfController } from "../presentation/provider-self.controller";
import {
  ProvidersPublicController,
  RitualsPublicController,
} from "./../presentation/providers-public.controller";
import { VerificationCasesController } from "../presentation/verification.controller";
import {
  AdminProviderWalletController,
  ProviderWalletController,
} from "../presentation/provider-wallet.controller";

export const PROVIDER_CONTROLLERS = [
  RitualsPublicController,
  ProvidersPublicController,
  ProviderSelfController,
  ProviderBookingsController,
  VerificationCasesController,
  ConsultationsController,
  AdminRitualsController,
  AdminRitualVariantsController,
  AdminProvidersController,
  AdminProviderBookingsController,
  AdminOfferingsController,
  AdminConsultationsController,
  ProviderWalletController,
  AdminProviderWalletController,
];

export interface RouteInfo {
  method: string;
  /** Full path as a client calls it, e.g. /api/v2/providers/:providerId */
  path: string;
  version: string | string[] | undefined;
  isPublic: boolean;
  roles: string[] | undefined;
  idempotent: boolean;
  controller: string;
}

const METHODS: Record<number, string> = {
  [RequestMethod.GET]: "GET",
  [RequestMethod.POST]: "POST",
  [RequestMethod.PUT]: "PUT",
  [RequestMethod.DELETE]: "DELETE",
  [RequestMethod.PATCH]: "PATCH",
};

const BACKSLASH = String.fromCharCode(92);
const join = (...parts: string[]) =>
  "/" + parts.map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");

export function providerRoutes(): RouteInfo[] {
  const out: RouteInfo[] = [];
  for (const controller of PROVIDER_CONTROLLERS) {
    const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
    const version = Reflect.getMetadata(VERSION_METADATA, controller);
    const classRoles = Reflect.getMetadata(ROLES_KEY, controller) as string[] | undefined;
    const classPublic = Boolean(Reflect.getMetadata(IS_PUBLIC_KEY, controller));
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = (controller.prototype as unknown as Record<string, unknown>)[name] as object | undefined;
      if (name === "constructor" || typeof handler !== "function") continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler);
      if (method === undefined) continue;
      const sub = (Reflect.getMetadata(PATH_METADATA, handler) as string) ?? "";
      out.push({
        method: METHODS[method],
        // The backslash in a route is the escape for the OpenAPI ":action" suffix; clients send a plain colon.
        path: join("api", `v${version}`, base, sub.split(BACKSLASH).join("")),
        version,
        isPublic: classPublic || Boolean(Reflect.getMetadata(IS_PUBLIC_KEY, handler)),
        roles: (Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined) ?? classRoles,
        idempotent: Boolean(Reflect.getMetadata(IDEMPOTENT_KEY, handler)),
        controller: controller.name,
      });
    }
  }
  return out;
}
