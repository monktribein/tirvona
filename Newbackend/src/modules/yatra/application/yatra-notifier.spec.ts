/**
 * Yatra customer email: only reports success when Resend accepted the message.
 * The Resend SDK returns `{ data, error }` for API-level rejections instead of throwing.
 */
const send = jest.fn();
jest.mock("resend", () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send } })) }));

import { YatraNotifier } from "./yatra-support.service";

const config = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] }) as any;
const enabled = { yatraEmailEnabled: true, resendApiKey: "re_test_key", resendFromEmail: "Tirvona <noreply@tirvona.test>", frontendUrl: "https://staging.tirvona.test" };
const build = (values: Record<string, unknown>) => new YatraNotifier({} as any, {} as any, { findById: jest.fn() } as any, config(values));
const target = { contact: { email: "pilgrim@example.test", name: "Pilgrim" } };
const input = { title: "Your Yatra booking is confirmed", message: "Seat 5 on the Braj Darshan bus." } as any;

describe("YatraNotifier.emailCustomer", () => {
  beforeEach(() => send.mockReset());

  it("returns true only when Resend accepts the email", async () => {
    send.mockResolvedValue({ data: { id: "email_1" }, error: null });
    await expect(build(enabled).emailCustomer(target, input)).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "pilgrim@example.test", subject: "Your Yatra booking is confirmed" }));
  });

  it("returns false when Resend rejects the email without throwing", async () => {
    send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "The from address is not verified" } });
    await expect(build(enabled).emailCustomer(target, input)).resolves.toBe(false);
  });

  it("returns false and never throws when the SDK throws", async () => {
    send.mockRejectedValue(new Error("network down"));
    await expect(build(enabled).emailCustomer(target, input)).resolves.toBe(false);
  });

  it("sends nothing while YATRA_EMAIL_ENABLED is off", async () => {
    await expect(build({ ...enabled, yatraEmailEnabled: false }).emailCustomer(target, input)).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
