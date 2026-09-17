import {
  META_TRANSACTIONAL_EVENT,
  META_TRANSACTIONAL_TEMPLATE_SPEC,
} from "../../constants/whatsapp-meta-templates.constants";
import type { WhatsAppProviderRequest } from "../../types/whatsapp.types";
import {
  MetaCloudWhatsAppProvider,
  metaParameterText,
} from "./meta-cloud-whatsapp.provider";

const unconfiguredTemplates = () =>
  Object.fromEntries(
    Object.values(META_TRANSACTIONAL_EVENT).map((event) => [
      event,
      {
        name: "",
        language: "en",
        bodyVariables: META_TRANSACTIONAL_TEMPLATE_SPEC[event].bodyVariables,
      },
    ]),
  );

const config = ({
  dryRun = false,
  configured = {},
  parameterFormat = "positional",
}: {
  dryRun?: boolean;
  configured?: Record<string, { name: string; language: string; bodyVariables: readonly string[] }>;
  parameterFormat?: string;
} = {}) =>
  ({
    dryRun,
    metaCloud: {
      apiVersion: "v23.0",
      accessToken: "test-access-token",
      phoneNumberId: "123456789",
      businessAccountId: "987654321",
      parameterFormat,
      authTemplate: { name: "tirvona_authetication", language: "en" },
      transactionalTemplates: { ...unconfiguredTemplates(), ...configured },
    },
  }) as never;

const stayConfirmed = {
  stay_confirmed: {
    name: "tirvona_stay_confirmed",
    language: "en",
    bodyVariables: META_TRANSACTIONAL_TEMPLATE_SPEC.stay_confirmed.bodyVariables,
  },
};

const transactional: WhatsAppProviderRequest = {
  to: "+919876543210",
  messageType: "booking_confirmation",
  message: "composed text body",
  idempotencyKey: "booking:n-1:whatsapp",
  metaEvent: "stay_confirmed",
  templateVariables: {
    customer_name: "Asha\nVerma",
    property_name: "Kashi Ashram",
    reference: "TRV-1001",
    check_in_date: "Sat, 10 Jan 2026",
    check_out_date: "Mon, 12 Jan 2026",
    guests: 2,
    amount_paid: "₹2,400",
  },
};

const clientStub = () => ({
  sendAuthenticationTemplate: jest
    .fn()
    .mockResolvedValue({ status: "accepted", provider: "meta_cloud" }),
  sendTransactionalTemplate: jest
    .fn()
    .mockResolvedValue({ status: "accepted", provider: "meta_cloud" }),
});

describe("MetaCloudWhatsAppProvider transactional templates", () => {
  it("keeps OTP on the authentication template only", () => {
    const provider = new MetaCloudWhatsAppProvider(
      clientStub() as never,
      config({ configured: stayConfirmed }),
    );
    expect(provider.supports("auth_otp")).toBe(true);
    expect(
      provider.supportsTransactional({
        ...transactional,
        messageType: "auth_otp",
      }),
    ).toBe(false);
  });

  it("treats a template without an approved name as unsupported and never calls Meta", async () => {
    const client = clientStub();
    const provider = new MetaCloudWhatsAppProvider(client as never, config());

    expect(provider.supportsTransactional(transactional)).toBe(false);
    await expect(provider.sendMessage(transactional)).rejects.toMatchObject({
      code: "TEMPLATE_UNCONFIGURED",
    });
    expect(client.sendTransactionalTemplate).not.toHaveBeenCalled();
  });

  it("treats a message with no logical event as unsupported", () => {
    const provider = new MetaCloudWhatsAppProvider(
      clientStub() as never,
      config({ configured: stayConfirmed }),
    );
    const { metaEvent: _omit, ...withoutEvent } = transactional;
    void _omit;
    expect(provider.supportsTransactional(withoutEvent)).toBe(false);
  });

  it("sends the configured template with ordered, flattened parameters", async () => {
    const client = clientStub();
    const provider = new MetaCloudWhatsAppProvider(
      client as never,
      config({ configured: stayConfirmed }),
    );

    expect(provider.supportsTransactional(transactional)).toBe(true);
    await provider.sendMessage(transactional);

    expect(client.sendAuthenticationTemplate).not.toHaveBeenCalled();
    const [, template] = client.sendTransactionalTemplate.mock.calls[0];
    expect(template).toMatchObject({
      name: "tirvona_stay_confirmed",
      language: "en",
      parameterFormat: "positional",
    });
    expect(template.parameters.map((p: { text: string }) => p.text)).toEqual([
      "Asha Verma",
      "Kashi Ashram",
      "TRV-1001",
      "Sat, 10 Jan 2026",
      "Mon, 12 Jan 2026",
      "2",
      "₹2,400",
      // No check-in code was supplied: a dash, never an empty parameter.
      "-",
    ]);
  });

  it("does not call Meta during a dry run", async () => {
    const client = clientStub();
    const provider = new MetaCloudWhatsAppProvider(
      client as never,
      config({ dryRun: true, configured: stayConfirmed }),
    );
    await expect(provider.sendMessage(transactional)).resolves.toMatchObject({
      status: "skipped",
      reason: "dry_run",
    });
    expect(client.sendTransactionalTemplate).not.toHaveBeenCalled();
  });
});

describe("metaParameterText", () => {
  it.each([
    [undefined, "-"],
    ["", "-"],
    ["   ", "-"],
    ["line one\nline two", "line one line two"],
    ["tab\tseparated", "tab separated"],
    ["too      many spaces", "too   many spaces"],
    [3, "3"],
  ])("renders %p as %p", (value, expected) => {
    expect(metaParameterText(value as never)).toBe(expected);
  });
});
