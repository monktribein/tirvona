import {
  META_LIMITS,
  buildConversationalPayload,
} from "./meta-cloud-whatsapp.client";

const TO = "919876543210";

describe("text messages", () => {
  it("builds a plain text payload", () => {
    expect(
      buildConversationalPayload(TO, { kind: "text", body: "Namaste 🙏" }),
    ).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: TO,
      type: "text",
      text: { body: "Namaste 🙏", preview_url: false },
    });
  });

  it("enables link previews only when asked", () => {
    const payload: any = buildConversationalPayload(TO, {
      kind: "text",
      body: "https://tirvona.com/pay",
      previewUrl: true,
    });
    expect(payload.text.preview_url).toBe(true);
  });

  it("clips a body past Meta's limit rather than being rejected", () => {
    const payload: any = buildConversationalPayload(TO, {
      kind: "text",
      body: "x".repeat(META_LIMITS.bodyText + 500),
    });
    expect(payload.text.body.length).toBe(META_LIMITS.bodyText);
    expect(payload.text.body.endsWith("…")).toBe(true);
  });
});

describe("reply buttons", () => {
  const buttons = [
    { id: "confirm:yes", title: "Haan" },
    { id: "confirm:no", title: "Nahi" },
  ];

  it("builds an interactive button payload", () => {
    const payload: any = buildConversationalPayload(TO, {
      kind: "buttons",
      body: "Shall I hold this?",
      buttons,
    });
    expect(payload.type).toBe("interactive");
    expect(payload.interactive.type).toBe("button");
    expect(payload.interactive.action.buttons).toEqual([
      { type: "reply", reply: { id: "confirm:yes", title: "Haan" } },
      { type: "reply", reply: { id: "confirm:no", title: "Nahi" } },
    ]);
  });

  it("never sends more than three buttons", () => {
    // Meta rejects a fourth outright, which in a chat means the guest gets
    // nothing at all.
    const payload: any = buildConversationalPayload(TO, {
      kind: "buttons",
      body: "Pick",
      buttons: Array.from({ length: 6 }, (_, index) => ({
        id: `b:${index}`,
        title: `Option ${index}`,
      })),
    });
    expect(payload.interactive.action.buttons).toHaveLength(
      META_LIMITS.buttonCount,
    );
  });

  it("clips a button title to twenty characters", () => {
    const payload: any = buildConversationalPayload(TO, {
      kind: "buttons",
      body: "Pick",
      buttons: [{ id: "b:1", title: "A very long button label indeed" }],
    });
    expect(
      payload.interactive.action.buttons[0].reply.title.length,
    ).toBeLessThanOrEqual(META_LIMITS.buttonTitle);
  });

  it("omits an absent header and footer entirely", () => {
    const payload: any = buildConversationalPayload(TO, {
      kind: "buttons",
      body: "Pick",
      buttons,
    });
    expect(payload.interactive.header).toBeUndefined();
    expect(payload.interactive.footer).toBeUndefined();
  });
});

describe("interactive lists", () => {
  const rows = [
    { id: "menu:stay", title: "Book a stay", description: "Rooms" },
    { id: "menu:parking", title: "Parking" },
  ];

  it("builds a list payload with one section", () => {
    const payload: any = buildConversationalPayload(TO, {
      kind: "list",
      body: "How can I help?",
      button: "View options",
      rows,
    });
    expect(payload.interactive.type).toBe("list");
    expect(payload.interactive.action.button).toBe("View options");
    expect(payload.interactive.action.sections[0].rows).toEqual([
      { id: "menu:stay", title: "Book a stay", description: "Rooms" },
      { id: "menu:parking", title: "Parking" },
    ]);
  });

  it("never sends more than ten rows", () => {
    // The main menu has eight items, but a search result list is built from
    // whatever the domain returned and has to be capped.
    const payload: any = buildConversationalPayload(TO, {
      kind: "list",
      body: "Stays",
      button: "View",
      rows: Array.from({ length: 25 }, (_, index) => ({
        id: `stay:${index}`,
        title: `Stay ${index}`,
      })),
    });
    expect(payload.interactive.action.sections[0].rows).toHaveLength(
      META_LIMITS.listRows,
    );
  });

  it("clips row titles and descriptions to Meta's limits", () => {
    const payload: any = buildConversationalPayload(TO, {
      kind: "list",
      body: "Stays",
      button: "View",
      rows: [
        {
          id: "stay:1",
          title: "A property with an extremely long name that will not fit",
          description: "d".repeat(200),
        },
      ],
    });
    const row = payload.interactive.action.sections[0].rows[0];
    expect(row.title.length).toBeLessThanOrEqual(META_LIMITS.listRowTitle);
    expect(row.description.length).toBeLessThanOrEqual(
      META_LIMITS.listRowDescription,
    );
  });

  it("keeps the reply id intact so routing still works after clipping", () => {
    // Titles may be truncated for display, but the id is what routes the tap.
    const payload: any = buildConversationalPayload(TO, {
      kind: "list",
      body: "Stays",
      button: "View",
      rows: [
        {
          id: "stay:64b8f2c1e4b0a1d2c3e4f5a6",
          title: "A property with an extremely long name that will not fit",
        },
      ],
    });
    expect(payload.interactive.action.sections[0].rows[0].id).toBe(
      "stay:64b8f2c1e4b0a1d2c3e4f5a6",
    );
  });

  it("clips the list button label", () => {
    const payload: any = buildConversationalPayload(TO, {
      kind: "list",
      body: "Stays",
      button: "An extremely long button label",
      rows,
    });
    expect(payload.interactive.action.button.length).toBeLessThanOrEqual(
      META_LIMITS.listButton,
    );
  });
});

describe("every conversational payload", () => {
  it("addresses exactly one recipient as an individual", () => {
    for (const message of [
      { kind: "text" as const, body: "hi" },
      { kind: "buttons" as const, body: "hi", buttons: [{ id: "a", title: "A" }] },
      { kind: "list" as const, body: "hi", button: "Go", rows: [{ id: "a", title: "A" }] },
    ]) {
      const payload: any = buildConversationalPayload(TO, message);
      expect(payload.messaging_product).toBe("whatsapp");
      expect(payload.recipient_type).toBe("individual");
      expect(payload.to).toBe(TO);
    }
  });

  it("is never a template", () => {
    // These are session messages inside the 24-hour window. Template sends
    // stay on their own approved path so the transactional pipeline is
    // unaffected by anything the conversation does.
    for (const message of [
      { kind: "text" as const, body: "hi" },
      { kind: "list" as const, body: "hi", button: "Go", rows: [{ id: "a", title: "A" }] },
    ]) {
      const payload: any = buildConversationalPayload(TO, message);
      expect(payload.type).not.toBe("template");
      expect(payload.template).toBeUndefined();
    }
  });
});
