import { WHATSAPP_TEMPLATE } from "../constants/whatsapp.constants";
import { Msg91WhatsAppProvider } from "../providers/msg91/msg91-whatsapp.provider";
import { whatsappConfig } from "./whatsapp.config";

const TEMPLATE_KEYS = Object.values(WHATSAPP_TEMPLATE);

const envKeys = [
  "MSG91_WHATSAPP_TEMPLATE_BOOKING_CONFIRMATION",
  "MSG91_WHATSAPP_TEMPLATE_BOOKING_CONFIRMATION_BODY_VARS",
  "MSG91_WHATSAPP_TEMPLATE_AUTH_OTP",
];
const originalEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);

const providerFor = () =>
  new Msg91WhatsAppProvider({ sendTemplate: jest.fn() } as never, {
    ...whatsappConfig(),
    dryRun: false,
    msg91: {
      ...whatsappConfig().msg91,
      enabled: true,
      authKey: "key",
      integratedNumber: "919000000000",
    },
  } as never);

describe("MSG91 template registry", () => {
  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("registers an entry for every notification type", () => {
    const templates = whatsappConfig().msg91.templates;
    for (const key of TEMPLATE_KEYS)
      expect(templates[key]).toEqual(
        expect.objectContaining({ bodyVariables: expect.any(Array) }),
      );
  });

  it("ships tirvona_otp approved and every other template unconfigured", () => {
    delete process.env.MSG91_WHATSAPP_TEMPLATE_AUTH_OTP;
    delete process.env.MSG91_WHATSAPP_TEMPLATE_BOOKING_CONFIRMATION;
    const templates = whatsappConfig().msg91.templates;

    expect(templates[WHATSAPP_TEMPLATE.AUTH_OTP].name).toBe("tirvona_otp");
    for (const key of TEMPLATE_KEYS.filter(
      (candidate) => candidate !== WHATSAPP_TEMPLATE.AUTH_OTP,
    ))
      expect(templates[key].name).toBe("");
  });

  it("treats an unconfigured template as unsupported so the fallback delivers it", () => {
    delete process.env.MSG91_WHATSAPP_TEMPLATE_BOOKING_CONFIRMATION;
    const provider = providerFor();

    expect(provider.supports(WHATSAPP_TEMPLATE.AUTH_OTP)).toBe(true);
    expect(provider.supports(WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION)).toBe(
      false,
    );
  });

  it("enables a notification type as soon as its approved name is configured", () => {
    process.env.MSG91_WHATSAPP_TEMPLATE_BOOKING_CONFIRMATION =
      "tirvona_booking_confirmed";

    expect(
      whatsappConfig().msg91.templates[WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION]
        .name,
    ).toBe("tirvona_booking_confirmed");
    expect(providerFor().supports(WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION)).toBe(
      true,
    );
  });

  it("reads a differently approved placeholder order from the environment", () => {
    process.env.MSG91_WHATSAPP_TEMPLATE_BOOKING_CONFIRMATION_BODY_VARS =
      " reference , guest_name ";

    expect(
      whatsappConfig().msg91.templates[WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION]
        .bodyVariables,
    ).toEqual(["reference", "guest_name"]);
  });
});
