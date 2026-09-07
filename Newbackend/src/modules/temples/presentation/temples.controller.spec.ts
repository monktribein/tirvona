import "reflect-metadata";
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator";
import { ROLES_KEY } from "../../../common/decorators/roles.decorator";
import { TemplesController } from "./temples.controller";

/**
 * JwtAuthGuard is registered globally (APP_GUARD), so every anonymous temple
 * route must carry `@Public()` or the public site gets a 401. This guards
 * against that regression without booting Nest.
 */
const isPublic = (method: string) =>
  Reflect.getMetadata(IS_PUBLIC_KEY, (TemplesController.prototype as any)[method]) === true;
const roles = (method: string): string[] | undefined =>
  Reflect.getMetadata(ROLES_KEY, (TemplesController.prototype as any)[method]);

describe("TemplesController route protection", () => {
  it.each([
    "getPublicTemples",
    "getNearbyByCoordinates",
    "getTempleBySlug",
    "getTempleAartis",
    "getTempleFestivals",
    "getNearbyEntities",
    "getTempleByNativeSlug",
  ])("%s is publicly reachable", (method) => {
    expect(isPublic(method)).toBe(true);
  });

  it.each([
    "getAllTemplesAdmin",
    "createTemple",
    "getTempleByIdAdmin",
    "updateTemple",
    "deleteTemple",
    "addAarti",
    "updateAarti",
    "deleteAarti",
    "addFestival",
    "updateFestival",
  ])("%s stays behind the super_admin role", (method) => {
    expect(isPublic(method)).toBe(false);
    expect(roles(method)).toContain("super_admin");
  });
});
