import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConversationService } from "./conversation.service";
import type { InboundMessage } from "./whatsapp-webhook.service";

/**
 * End-to-end tests for the WhatsApp parking flow, in the same style as
 * `conversation.service.spec.ts`'s stay tests: a fake session store, reply
 * service and actions layer, driving `ConversationService.handle` message by
 * message. Every figure shown comes from the mocked action, never computed
 * here — the same discipline the real `WhatsAppActionsService` enforces.
 */

const PHONE = "919876543210";

const guest = {
  kind: "guest" as const,
  userId: null,
  whatsappCustomerId: "wa-1",
  displayId: "WAPP-20260916-ABC123",
  phone: PHONE,
  name: "Ramesh",
  role: "whatsapp_customer",
  language: "hinglish" as const,
  status: "active" as const,
};

const message = (overrides: Partial<InboundMessage> = {}): InboundMessage => ({
  messageId: `wamid.${Math.random()}`,
  phone: PHONE,
  profileName: "Ramesh",
  messageType: overrides.replyId ? "interactive" : "text",
  text: "",
  replyId: "",
  sentAt: new Date(),
  ...overrides,
});

const LOCATION = {
  _id: "loc-1",
  name: "Prem Mandir Parking",
  address: { city: "Vrindavan" },
  availability: { availableCount: 5 },
};

const BAY = {
  slotTypeId: "slot-1",
  name: "Covered Bay",
  isCovered: true,
  availableCount: 3,
  isAvailable: true,
  pricing: { totalAmount: 100 },
};

const paged = (rows: any[], page = 1, totalPages = 1) =>
  Object.assign(rows, { page, totalPages });

const quoteOk = (totalAmount = 100) => ({
  ok: true as const,
  quote: { baseFee: 50, durationAmount: 30, subtotal: 80, taxAmount: 20, totalAmount },
});

const build = (actionOverrides: Record<string, any> = {}, identity = guest) => {
  let stored: any = null;
  const sessions = {
    get: jest.fn(async () => stored),
    save: jest.fn(async (s: any) => {
      stored = s;
    }),
    clear: jest.fn(async () => {
      stored = null;
    }),
    start: jest.fn((input: any) => ({
      ...input,
      flow: null,
      step: null,
      data: {},
      lastInboundAt: Date.now(),
      startedAt: Date.now(),
      messageCount: 0,
    })),
    withinRateLimit: jest.fn(async () => true),
    acquireLock: jest.fn(async () => async () => undefined),
    seed: (session: any) => {
      stored = session;
    },
    current: () => stored,
  };
  const reply = {
    text: jest.fn(async (..._a: any[]) => undefined),
    buttons: jest.fn(async (..._a: any[]) => undefined),
    list: jest.fn(async (..._a: any[]) => undefined),
    withinWindow: jest.fn(() => true),
  };
  const identityService = {
    normalize: jest.fn((value: string) => value.replace(/\D/g, "")),
    resolveIdentity: jest.fn(async () => identity),
    setLanguage: jest.fn(async () => undefined),
    setName: jest.fn(async () => undefined),
  };
  const actions: Record<string, jest.Mock> = {
    searchStays: jest.fn(async () => []),
    roomsFor: jest.fn(async () => []),
    topDestinations: jest.fn(async () => []),
    searchParking: jest.fn(async () => paged([LOCATION])),
    parkingLocationDetail: jest.fn(async () => ({
      name: LOCATION.name,
      address: LOCATION.address,
      slotTypes: [BAY],
    })),
    quoteParking: jest.fn(async () => quoteOk()),
    createParkingBooking: jest.fn(async () => ({
      booking: {
        _id: "pbooking-1",
        bookingReference: "TVN-PKG-1",
        reservationExpiresAt: new Date(Date.now() + 600_000),
      },
    })),
    createParkingPaymentLink: jest.fn(async () => ({
      url: "https://tirvona.com/parking/pay/TOKEN",
      amount: 100,
      reference: "TVN-PKG-1",
      expiresAt: new Date(Date.now() + 600_000),
    })),
    myParkingBookings: jest.fn(async () => ({ items: [], total: 0 })),
    getParkingBooking: jest.fn(async () => null),
    previewParkingCancellation: jest.fn(async () => ({ refundAmount: 50 })),
    cancelParkingBooking: jest.fn(async () => ({
      booking: { bookingReference: "TVN-PKG-1" },
      refund: { refundAmount: 50 },
    })),
    ...actionOverrides,
  };
  const config = { get: jest.fn(() => "https://tirvona.com") };
  const service = new ConversationService(
    identityService as any,
    sessions as any,
    reply as any,
    actions as any,
    config as any,
  );
  return { service, sessions, reply, actions };
};

const texts = (e: ReturnType<typeof build>) =>
  e.reply.text.mock.calls.map((c: any[]) => c[2]).join("\n");
const lastRows = (e: ReturnType<typeof build>) =>
  (e.reply.list.mock.calls.at(-1) as any[])[4] as { id: string; description?: string }[];

/** Drives the flow through every required slot up to (and including) picking a bay. */
const toVehicleNumberStep = async (e: ReturnType<typeof build>) => {
  await e.service.handle(message({ text: "parking chahiye" }));
  await e.service.handle(message({ text: "Vrindavan" }));
  await e.service.handle(message({ text: "kal" }));
  await e.service.handle(message({ text: "4 baje" }));
  await e.service.handle(message({ text: "agle din" }));
  await e.service.handle(message({ text: "11 baje" }));
  await e.service.handle(message({ text: "car" }));
  await e.service.handle(message({ replyId: "parkinglocation:loc-1" }));
  await e.service.handle(message({ replyId: "parkingbay:slot-1" }));
};

describe("parking slot filling", () => {
  it("asks for each missing slot in order, one at a time", async () => {
    const e = build();
    await e.service.handle(message({ text: "parking chahiye" }));
    expect(texts(e)).toMatch(/city|jagah|शहर/i);
    await e.service.handle(message({ text: "Vrindavan" }));
    expect(texts(e)).toMatch(/entry.*date|date.*entry|प्रवेश/i);
  });

  it("reads a full sentence with both entry and exit in one message", async () => {
    const e = build();
    await e.service.handle(message({ text: "parking chahiye" }));
    await e.service.handle(message({ text: "Vrindavan" }));
    await e.service.handle(
      message({ text: "kal 4 baje se agle din 11 baje tak" }),
    );
    await e.service.handle(message({ text: "car" }));
    expect(e.actions.searchParking).toHaveBeenCalledWith(
      expect.objectContaining({ place: "Vrindavan", vehicleType: "car" }),
    );
    const call = e.actions.searchParking.mock.calls[0][0];
    expect(call.entryAt).toContain("T16:00:00+05:30");
    expect(call.exitAt).toContain("T11:00:00+05:30");
  });

  it("does not read 'parking' itself as the destination", async () => {
    const e = build();
    await e.service.handle(message({ text: "parking chahiye" }));
    // Still asking for a place, not silently treating "parking" as one.
    expect(texts(e)).toMatch(/city|jagah|शहर/i);
    expect(e.sessions.current().data.location).toBeUndefined();
  });

  it("shows real search results and lets the guest pick one", async () => {
    const e = build();
    await toVehicleNumberStep(e);
    expect(e.actions.searchParking).toHaveBeenCalled();
    expect(e.actions.parkingLocationDetail).toHaveBeenCalledWith(
      "loc-1",
      expect.objectContaining({ vehicleType: "car" }),
    );
  });

  it("tells the guest plainly when no parking matches, without inventing one", async () => {
    const e = build({ searchParking: jest.fn(async () => paged([])) });
    await e.service.handle(message({ text: "parking chahiye" }));
    await e.service.handle(message({ text: "Nowhereland" }));
    await e.service.handle(message({ text: "kal" }));
    await e.service.handle(message({ text: "4 baje" }));
    await e.service.handle(message({ text: "agle din" }));
    await e.service.handle(message({ text: "11 baje" }));
    await e.service.handle(message({ text: "car" }));
    expect(texts(e)).toMatch(/nahi mili|not find|नहीं मिली/i);
    expect(e.actions.searchParking).toHaveBeenCalled();
  });
});

describe("parking bay selection and pricing", () => {
  it("shows the bay list with live pricing and availability from the domain", async () => {
    const e = build();
    await toVehicleNumberStep(e);
    // The bay was already picked in toVehicleNumberStep; verify the earlier
    // list call carried the real pricing figure, not an invented one.
    const bayListCall = e.reply.list.mock.calls.find((c: any[]) =>
      c[4].some((r: any) => r.id === "parkingbay:slot-1"),
    );
    expect(bayListCall![4][0].description).toContain("100");
  });

  it("tells the guest plainly when no bay is open for the window/vehicle", async () => {
    const e = build({
      parkingLocationDetail: jest.fn(async () => ({
        name: LOCATION.name,
        address: LOCATION.address,
        slotTypes: [{ ...BAY, isAvailable: false }],
      })),
    });
    await e.service.handle(message({ text: "parking chahiye" }));
    await e.service.handle(message({ text: "Vrindavan" }));
    await e.service.handle(message({ text: "kal" }));
    await e.service.handle(message({ text: "4 baje" }));
    await e.service.handle(message({ text: "agle din" }));
    await e.service.handle(message({ text: "11 baje" }));
    await e.service.handle(message({ text: "car" }));
    await e.service.handle(message({ replyId: "parkinglocation:loc-1" }));
    expect(texts(e)).toMatch(/no bay|koi bay|कोई बे/i);
  });

  it("asks for the vehicle number after a bay is chosen, then shows the priced summary", async () => {
    const e = build();
    await toVehicleNumberStep(e);
    expect(texts(e)).toMatch(/vehicle number|UP32AB1234/i);
    await e.service.handle(message({ text: "UP32AB1234" }));
    expect(e.actions.quoteParking).toHaveBeenCalledWith({
      locationId: "loc-1",
      slotTypeId: "slot-1",
      vehicleType: "car",
      entryAt: expect.stringContaining("T16:00:00+05:30"),
      exitAt: expect.stringContaining("T11:00:00+05:30"),
    });
    expect(texts(e)).toContain("₹100");
    expect(e.reply.buttons).toHaveBeenCalled();
  });
});

describe("parking confirm never books on a stale price", () => {
  const atConfirm = async (e: ReturnType<typeof build>) => {
    await toVehicleNumberStep(e);
    await e.service.handle(message({ text: "UP32AB1234" }));
  };

  it("re-prices before holding and shows the new total instead of booking at the old one", async () => {
    const quoteParking = jest
      .fn()
      .mockResolvedValueOnce(quoteOk(100))
      .mockResolvedValueOnce(quoteOk(150))
      .mockResolvedValue(quoteOk(150));
    const e = build({ quoteParking });
    await atConfirm(e);
    await e.service.handle(message({ replyId: "parkingconfirm:yes" }));
    expect(e.actions.createParkingBooking).not.toHaveBeenCalled();
    expect(texts(e)).toMatch(/100[\s\S]*150|150/);
    expect(e.sessions.current().data.quotedTotal).toBe(150);
    await e.service.handle(message({ replyId: "parkingconfirm:yes" }));
    expect(e.actions.createParkingBooking).toHaveBeenCalledTimes(1);
  });

  it("ignores a stray confirm outside the flow", async () => {
    const e = build();
    e.sessions.seed({
      phone: PHONE,
      userId: null,
      whatsappCustomerId: "wa-1",
      displayId: "WAPP-1",
      flow: null,
      step: null,
      language: "hinglish",
      data: {},
      lastInboundAt: Date.now(),
      startedAt: Date.now(),
      messageCount: 1,
    });
    await e.service.handle(message({ replyId: "parkingconfirm:yes" }));
    expect(e.actions.createParkingBooking).not.toHaveBeenCalled();
  });

  it("offers what is open now when the bay went between summary and hold", async () => {
    const e = build({
      createParkingBooking: jest.fn(async () => {
        throw new ConflictException("This bay was just taken.");
      }),
    });
    await atConfirm(e);
    await e.service.handle(message({ replyId: "parkingconfirm:yes" }));
    expect(e.actions.createParkingPaymentLink).not.toHaveBeenCalled();
    expect(texts(e)).toContain("This bay was just taken.");
    expect(e.sessions.current().data.slotTypeId).toBeUndefined();
  });

  it("sends a payment link and no confirmation of its own", async () => {
    const e = build();
    await atConfirm(e);
    await e.service.handle(message({ replyId: "parkingconfirm:yes" }));
    expect(e.actions.createParkingBooking).toHaveBeenCalled();
    expect(e.actions.createParkingPaymentLink).toHaveBeenCalledWith(
      guest,
      "pbooking-1",
    );
    expect(texts(e)).toContain("https://tirvona.com/parking/pay/TOKEN");
    expect(texts(e)).not.toMatch(/confirmed|पुष्टि/i);
  });

  it("clears the flow after booking so the next message starts fresh", async () => {
    const e = build();
    await atConfirm(e);
    await e.service.handle(message({ replyId: "parkingconfirm:yes" }));
    expect(e.sessions.current().flow).toBeNull();
    expect(e.sessions.current().paging).toBeUndefined();
  });

  it("still apologises generically for an unexpected failure, exposing nothing", async () => {
    const e = build({
      createParkingBooking: jest.fn(async () => {
        throw new Error("MongoServerError: connection pool closed at 10.0.0.4");
      }),
    });
    await atConfirm(e);
    await e.service.handle(message({ replyId: "parkingconfirm:yes" }));
    const text = texts(e);
    expect(text).not.toContain("MongoServerError");
    expect(text).not.toContain("10.0.0.4");
  });
});

describe("parking pages through the database instead of dropping rows", () => {
  const locations = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      _id: `loc${from + i}`,
      name: `Parking ${from + i}`,
      address: { city: "Vrindavan" },
      availability: { availableCount: 1 },
    }));

  it("adds a next-page row when the search has more results, and fetches page 2 on 'next'", async () => {
    const searchParking = jest
      .fn()
      .mockResolvedValueOnce(paged(locations(1, 8), 1, 2))
      .mockResolvedValueOnce(paged(locations(9, 3), 2, 2));
    const e = build({ searchParking });
    await e.service.handle(message({ text: "parking chahiye" }));
    await e.service.handle(message({ text: "Vrindavan" }));
    await e.service.handle(message({ text: "kal" }));
    await e.service.handle(message({ text: "4 baje" }));
    await e.service.handle(message({ text: "agle din" }));
    await e.service.handle(message({ text: "11 baje" }));
    await e.service.handle(message({ text: "car" }));
    const first = lastRows(e);
    expect(first.at(-1)!.id).toBe("page:parking_locations:next");

    await e.service.handle(message({ text: "next" }));
    expect(searchParking).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
    expect(lastRows(e).map((r) => r.id)).toEqual([
      "parkinglocation:loc9",
      "parkinglocation:loc10",
      "parkinglocation:loc11",
      "page:parking_locations:prev",
    ]);
  });

  it("pages through bay categories too", async () => {
    const bays = Array.from({ length: 10 }, (_, i) => ({
      slotTypeId: `slot${i}`,
      name: `Bay ${i}`,
      isAvailable: true,
      availableCount: 2,
      pricing: { totalAmount: 100 + i },
    }));
    const e = build({
      parkingLocationDetail: jest.fn(async () => ({
        name: LOCATION.name,
        address: LOCATION.address,
        slotTypes: bays,
      })),
    });
    await e.service.handle(message({ text: "parking chahiye" }));
    await e.service.handle(message({ text: "Vrindavan" }));
    await e.service.handle(message({ text: "kal" }));
    await e.service.handle(message({ text: "4 baje" }));
    await e.service.handle(message({ text: "agle din" }));
    await e.service.handle(message({ text: "11 baje" }));
    await e.service.handle(message({ text: "car" }));
    await e.service.handle(message({ replyId: "parkinglocation:loc-1" }));
    const first = lastRows(e);
    expect(first.filter((r) => r.id.startsWith("parkingbay:"))).toHaveLength(8);
    expect(first.at(-1)!.id).toBe("page:parking_bays:next");
    await e.service.handle(message({ text: "aur dikhao" }));
    expect(lastRows(e).map((r) => r.id)).toEqual([
      "parkingbay:slot8",
      "parkingbay:slot9",
      "page:parking_bays:prev",
    ]);
  });
});

describe("my parking bookings and cancellation", () => {
  it("routes 'meri parking dikhao' to the parking booking list, not the stay one", async () => {
    const myStayBookings = jest.fn(async () => []);
    const myParkingBookings = jest.fn(async () => ({
      items: [
        {
          _id: "pbk-1",
          bookingReference: "TVN-PKG-9",
          locationId: { name: "Prem Mandir Parking" },
          status: "upcoming",
          paymentStatus: "paid",
          pricing: { totalAmount: 100 },
        },
      ],
      total: 1,
    }));
    const e = build({ myStayBookings, myParkingBookings });
    await e.service.handle(message({ text: "meri parking dikhao" }));
    expect(myParkingBookings).toHaveBeenCalled();
    expect(myStayBookings).not.toHaveBeenCalled();
    expect(texts(e)).toContain("TVN-PKG-9");
  });

  it("routes a parking cancellation request to the parking cancel flow", async () => {
    const myParkingBookings = jest.fn(async () => ({
      items: [
        {
          _id: "pbk-1",
          bookingReference: "TVN-PKG-9",
          locationId: { name: "Prem Mandir Parking" },
          status: "upcoming",
        },
      ],
      total: 1,
    }));
    const e = build({ myParkingBookings });
    await e.service.handle(message({ text: "parking cancel karo" }));
    expect(myParkingBookings).toHaveBeenCalled();
    expect(e.sessions.current().flow).toBe("parking_cancellation");
    const rows = lastRows(e);
    expect(rows[0].id).toBe("parkingbooking:cancel:pbk-1");
  });

  it("previews the real refund before asking to confirm, and cancels through the domain service", async () => {
    const getParkingBooking = jest.fn(async () => ({
      _id: "pbk-1",
      bookingReference: "TVN-PKG-9",
    }));
    const previewParkingCancellation = jest.fn(async () => ({ refundAmount: 42 }));
    const e = build({ getParkingBooking, previewParkingCancellation });
    await e.service.handle(message({ replyId: "parkingbooking:cancel:pbk-1" }));
    expect(previewParkingCancellation).toHaveBeenCalledWith(guest, "pbk-1");
    expect(e.reply.buttons).toHaveBeenCalled();
    const confirmBody = (e.reply.buttons.mock.calls.at(-1) as any[])[2];
    expect(confirmBody).toContain("42");

    await e.service.handle(message({ replyId: "parkingcancel:yes" }));
    expect(e.actions.cancelParkingBooking).toHaveBeenCalledWith(
      guest,
      "pbk-1",
      expect.any(String),
    );
    expect(texts(e)).toContain("TVN-PKG-1");
  });

  it("explains a refused parking cancellation in the service's own words", async () => {
    const getParkingBooking = jest.fn(async () => ({ _id: "pbk-1", bookingReference: "TVN-PKG-9" }));
    const cancelParkingBooking = jest.fn(async () => {
      throw new BadRequestException("This booking can no longer be cancelled");
    });
    const e = build({ getParkingBooking, cancelParkingBooking });
    await e.service.handle(message({ replyId: "parkingbooking:cancel:pbk-1" }));
    await e.service.handle(message({ replyId: "parkingcancel:yes" }));
    expect(texts(e)).toContain("This booking can no longer be cancelled");
    expect(e.sessions.current().flow).toBeNull();
  });
});

describe("switching flows mid-conversation", () => {
  it("keeps what the guest already said when re-entering the parking flow mid-conversation", async () => {
    const e = build();
    await e.service.handle(message({ text: "parking chahiye" }));
    await e.service.handle(message({ text: "Vrindavan" }));
    // Saying "parking chahiye" again mid-flow must not wipe the place
    // already given — only a fresh start (menu/another flow) clears it.
    await e.service.handle(message({ text: "parking chahiye" }));
    expect(e.sessions.current().data.location).toBe("Vrindavan");
  });

  it("a guest can switch from a stay into parking without cross-talk", async () => {
    const e = build();
    await e.service.handle(message({ text: "room chahiye" }));
    await e.service.handle(message({ text: "parking chahiye" }));
    expect(e.sessions.current().flow).toBe("parking_booking");
    expect(texts(e)).toMatch(/city|jagah|शहर/i);
  });
});
