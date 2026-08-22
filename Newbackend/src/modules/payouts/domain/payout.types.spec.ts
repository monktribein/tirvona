import { mapProviderStatus } from "./payout.types";

describe("mapProviderStatus", () => {
  it.each([
    ["pending", "pending"],
    ["queued", "pending"],
    ["initiated", "processing"],
    ["processing", "processing"],
    ["processed", "paid"],
    ["failed", "failed"],
    ["reversed", "failed"],
  ])("maps RazorpayX %s to %s", (provider, local) => {
    expect(mapProviderStatus(provider)).toBe(local);
  });
});
