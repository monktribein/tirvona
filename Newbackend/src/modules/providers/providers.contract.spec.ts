import { providerRoutes } from "./testing/route-table";

/**
 * OpenAPI v2.0 operations this module implements (path with {param} syntax,
 * custom methods written as the contract writes them). If one of these
 * disappears or is renamed, a client built from the contract breaks.
 */
const OPENAPI_IMPLEMENTED: Array<[string, string]> = [
  ["GET", "/rituals"],
  ["GET", "/rituals/{ritualId}"],
  ["GET", "/rituals/{ritualId}/variants"],
  ["POST", "/admin/rituals"],
  ["POST", "/admin/rituals/{ritualId}:submit-review"],
  ["POST", "/admin/rituals/{ritualId}:approve"],
  ["POST", "/admin/rituals/{ritualId}:publish"],
  ["GET", "/providers"],
  ["GET", "/providers/{providerId}"],
  ["POST", "/provider/profile"],
  ["PATCH", "/provider/profile"],
  ["POST", "/provider/offerings"],
  ["PATCH", "/provider/offerings/{offeringId}"],
  ["POST", "/verification-cases"],
  ["POST", "/verification-cases/{caseId}/evidence"],
  ["POST", "/verification-cases/{caseId}:decide"],
  ["GET", "/providers/{providerId}/availability"],
  ["PUT", "/provider/availability-rules"],
  ["POST", "/provider/calendar-blocks"],
  ["DELETE", "/provider/calendar-blocks/{blockId}"],
  ["POST", "/bookings"],
  ["GET", "/bookings"],
  ["GET", "/bookings/{bookingId}"],
  ["POST", "/bookings/{bookingId}/transitions"],
  ["POST", "/bookings/{bookingId}:cancel"],
  ["GET", "/bookings/{bookingId}/state-history"],
  ["POST", "/consultations"],
  ["GET", "/consultations/{consultationId}"],
  ["POST", "/consultations/{consultationId}:schedule"],
  ["POST", "/consultations/{consultationId}:complete"],
];

/** Contract operations deliberately NOT in this module (they belong to the commerce phase). */
const OPENAPI_DEFERRED = [
  "POST /bookings/{bookingId}:reschedule",
  "POST /quotes",
  "POST /bookings/{bookingId}/payments",
  "POST /bookings/{bookingId}/refunds",
  "GET /provider/settlements",
];

const key = (r: { method: string; path: string }) => `${r.method} ${r.path}`;
// Only a colon that starts a path segment is a parameter; the one after it is the contract's custom-method suffix.
const toOpenApi = (path: string) =>
  path.replace(/^\/api\/v2/, "").replace(/(^|\/):([A-Za-z]+)/g, "$1{$2}");

describe("providers API surface", () => {
  const routes = providerRoutes();

  it("serves every endpoint under /api/v2 and nothing in the version-neutral space", () => {
    expect(routes.length).toBeGreaterThan(50);
    for (const route of routes) {
      expect(route.version).toBe("2");
      expect(route.path.startsWith("/api/v2/")).toBe(true);
    }
  });

  it("implements the OpenAPI v2.0 operations it claims to", () => {
    const have = new Set(routes.map((r) => `${r.method} ${toOpenApi(r.path)}`));
    for (const [method, path] of OPENAPI_IMPLEMENTED) expect(have).toContain(`${method} ${path}`);
  });

  it("does not claim the operations that belong to the commerce phase", () => {
    const have = new Set(routes.map((r) => `${r.method} ${toOpenApi(r.path)}`));
    for (const op of OPENAPI_DEFERRED) expect(have).not.toContain(op);
  });

  it("makes exactly the public catalogue and directory reads anonymous", () => {
    const anonymous = routes.filter((r) => r.isPublic).map(key).sort();
    expect(anonymous).toEqual(
      [
        "GET /api/v2/providers",
        "GET /api/v2/providers/:providerId",
        "GET /api/v2/providers/:providerId/offerings",
        "GET /api/v2/rituals",
        "GET /api/v2/rituals/:ritualId",
        "GET /api/v2/rituals/:ritualId/variants",
      ].sort(),
    );
    // The schedule is for signed-in callers (OpenAPI x-access: Authenticated).
    const schedule = routes.find((r) => r.path === "/api/v2/providers/:providerId/availability")!;
    expect(schedule.isPublic).toBe(false);
  });

  it("requires an Idempotency-Key on every write", () => {
    const writes = routes.filter((r) => r.method !== "GET");
    expect(writes.length).toBeGreaterThan(30);
    const missing = writes.filter((r) => !r.idempotent).map(key);
    expect(missing).toEqual([]);
    // Reads never need one.
    expect(routes.filter((r) => r.method === "GET" && r.idempotent)).toEqual([]);
  });

  it("puts a role on every administration route", () => {
    const admin = routes.filter((r) => r.path.startsWith("/api/v2/admin/"));
    expect(admin.length).toBeGreaterThan(10);
    expect(admin.filter((r) => !r.roles?.length).map(key)).toEqual([]);
  });

  it("keeps verification decisions to reviewers and the integrity report to super_admin", () => {
    const find = (m: string, p: string) => routes.find((r) => r.method === m && r.path === p)!;
    expect(find("POST", "/api/v2/verification-cases/:caseId:decide").roles).toEqual(["verification_reviewer", "super_admin"]);
    expect(find("POST", "/api/v2/verification-cases/:caseId:claim").roles).toEqual(["verification_reviewer", "super_admin"]);
    expect(find("GET", "/api/v2/admin/providers/integrity").roles).toEqual(["super_admin"]);
    expect(find("GET", "/api/v2/admin/providers/:providerId").roles).toEqual(["verification_reviewer", "super_admin"]);
    // The booking list/detail for an owner has no role gate: it is ownership, decided in the service.
    expect(find("POST", "/api/v2/bookings/:bookingId/transitions").roles).toBeUndefined();
  });

  it("never routes a provider-owned action through a client-supplied provider id", () => {
    const ownerRoutes = routes.filter((r) => r.path.startsWith("/api/v2/provider/"));
    expect(ownerRoutes.length).toBeGreaterThan(10);
    expect(ownerRoutes.filter((r) => /:providerId|:userId/.test(r.path)).map(key)).toEqual([]);
  });

  it("registers no duplicate method + path", () => {
    const keys = routes.map(key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
