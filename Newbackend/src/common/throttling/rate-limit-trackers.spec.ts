import {
  accountRateLimitTracker,
  hybridRateLimitTracker,
  ipRateLimitTracker,
} from "./rate-limit-trackers";

const request = (overrides: Record<string, unknown> = {}) =>
  ({
    ip: "203.0.113.10",
    socket: { remoteAddress: "203.0.113.10" },
    body: {},
    params: {},
    ...overrides,
  }) as never;

describe("hybrid rate-limit trackers", () => {
  it("gives 200 platform users behind one public IP independent buckets", () => {
    const trackers = new Set(
      Array.from({ length: 200 }, (_, index) =>
        hybridRateLimitTracker(
          request({ user: { id: `platform-${index + 1}` } }),
        ),
      ),
    );
    expect(trackers.size).toBe(200);
    expect(ipRateLimitTracker(request())).toBe("ip:203.0.113.10");
  });

  it("gives LeadTirvona agents independent buckets on the same IP", () => {
    expect(
      hybridRateLimitTracker(request({ rateLimitLeadUserId: "lead-1" })),
    ).not.toBe(
      hybridRateLimitTracker(request({ rateLimitLeadUserId: "lead-2" })),
    );
  });

  it("keeps unauthenticated traffic IP based", () => {
    expect(hybridRateLimitTracker(request())).toBe("ip:203.0.113.10");
  });

  it("normalizes account identifiers without exposing them in the key", () => {
    const tracker = accountRateLimitTracker("email");
    const first = tracker(request({ body: { email: " User@Example.com " } }));
    const second = tracker(request({ body: { email: "user@example.com" } }));
    expect(first).toBe(second);
    expect(first).not.toContain("user@example.com");
  });
});

