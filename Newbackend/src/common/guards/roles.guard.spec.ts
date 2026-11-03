import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

const contextFor = (user: object, roles: string[]) => {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, "getAllAndOverride")
    .mockImplementation((key: unknown) => (key === "roles" ? roles : false) as never);
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(reflector), context };
};

const allows = (role: string, roles: string[]) => {
  const { guard, context } = contextFor({ id: "u1", role, permissions: [] }, roles);
  return guard.canActivate(context);
};

describe("RolesGuard for area-scoped HR and Executive logins", () => {
  it("opens stay-owner routes to hr and executive (scoped to their area stays elsewhere)", () => {
    expect(allows("hr", ["owner", "stay_admin", "manager", "super_admin"])).toBe(true);
    expect(allows("executive", ["owner"])).toBe(true);
  });

  it("keeps Super Admin and other roles' routes closed to them", () => {
    expect(allows("hr", ["super_admin"])).toBe(false);
    expect(allows("executive", ["finance_manager", "super_admin"])).toBe(false);
    expect(allows("executive", ["temple_owner"])).toBe(false);
  });

  it("opens the routes that name them", () => {
    expect(allows("executive", ["super_admin", "hr", "executive"])).toBe(true);
    expect(allows("hr", ["super_admin", "hr"])).toBe(true);
  });

  it("does not change other roles", () => {
    expect(allows("customer", ["owner"])).toBe(false);
    expect(allows("manager", ["owner"])).toBe(false);
    expect(allows("owner", ["owner"])).toBe(true);
  });
});
