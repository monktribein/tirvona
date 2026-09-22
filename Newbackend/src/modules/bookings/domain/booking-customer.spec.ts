import {
  actorFromResolvedIdentity,
  actorFromUser,
  actorFromWhatsAppCustomer,
  bookingBelongsTo,
  bookingCustomerView,
  bookingOwnerFilter,
  withBookingCustomer,
  withBookingCustomers,
  type WhatsAppResolvedIdentity,
} from "./booking-customer";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";

const websiteUser = {
  _id: "user-1",
  id: "user-1",
  name: "Asha Verma",
  email: "asha@example.com",
  phone: "919876543210",
  role: "customer",
  status: "active",
  permissions: [],
  scopedAshramIds: [],
  scopedTempleIds: [],
} as AuthenticatedUser;

const accountBooking = {
  bookingId: "TRV-1",
  bookingSource: "tirvona",
  channel: "website",
  customerId: {
    _id: "user-1",
    name: "Asha Verma",
    email: "asha@example.com",
    phone: "919876543210",
  },
  whatsappCustomerId: null,
};

const whatsappBooking = {
  bookingId: "TRV-2",
  bookingSource: "tirvona",
  channel: "whatsapp",
  customerId: null,
  whatsappCustomerId: {
    _id: "wa-1",
    wappId: "WAPP1000001",
    name: "Ramesh Kumar",
    phone: "919812345678",
  },
};

describe("actors", () => {
  it("builds a website actor that carries the principal", () => {
    const actor = actorFromUser(websiteUser);
    expect(actor).toMatchObject({
      userId: "user-1",
      whatsappCustomerId: null,
      channel: "website",
    });
    expect(actor.principal).toBe(websiteUser);
  });

  it("builds a WhatsApp actor with no principal at all", () => {
    // No principal means no role to check: a WhatsApp guest can never reach
    // the staff branch of an authorization check.
    const actor = actorFromWhatsAppCustomer({
      id: "wa-1",
      name: "Ramesh",
      phone: "919812345678",
    });
    expect(actor).toMatchObject({
      userId: null,
      whatsappCustomerId: "wa-1",
      channel: "whatsapp",
      role: "whatsapp_customer",
    });
    expect(actor.principal).toBeUndefined();
  });
});

describe("actorFromResolvedIdentity", () => {
  const accountIdentity: WhatsAppResolvedIdentity = {
    kind: "account",
    userId: "user-1",
    whatsappCustomerId: null,
    displayId: null,
    name: "Priya Sharma",
    phone: "919876543210",
    role: "customer",
    language: null,
    status: "active",
  };

  const guestIdentity: WhatsAppResolvedIdentity = {
    kind: "guest",
    userId: null,
    whatsappCustomerId: "wa-1",
    displayId: "WAPP-20260916-ABC123",
    name: "Ramesh Kumar",
    phone: "919812345678",
    role: "whatsapp_customer",
    language: "hinglish",
    status: "active",
  };

  it("books an existing website account under its own userId, not a WAPP id", () => {
    // This is what makes a WhatsApp booking from a known number show up in
    // that customer's normal website booking history: the booking's
    // customerId is their real account id, exactly as if they had booked on
    // the website.
    const actor = actorFromResolvedIdentity(accountIdentity);
    expect(actor).toMatchObject({
      userId: "user-1",
      whatsappCustomerId: null,
      channel: "whatsapp",
      role: "customer",
      name: "Priya Sharma",
      phone: "919876543210",
    });
  });

  it("never gives an account-matched actor a staff principal", () => {
    // This actor was matched by phone number alone, not by signing in, so it
    // must never be treated as an authenticated staff principal — that would
    // let assertCanManage's staff branch run for someone who never logged in.
    const actor = actorFromResolvedIdentity(accountIdentity);
    expect(actor.principal).toBeUndefined();
  });

  it("falls back to the generic customer role when the account has none", () => {
    const actor = actorFromResolvedIdentity({ ...accountIdentity, role: "" });
    expect(actor.role).toBe("customer");
  });

  it("books a genuinely new number under its own WhatsApp customer id", () => {
    const actor = actorFromResolvedIdentity(guestIdentity);
    expect(actor).toMatchObject({
      userId: null,
      whatsappCustomerId: "wa-1",
      channel: "whatsapp",
      role: "whatsapp_customer",
      name: "Ramesh Kumar",
    });
    expect(actor.principal).toBeUndefined();
  });

  it("produces mutually exclusive identity fields for the two kinds", () => {
    // Exactly one of userId/whatsappCustomerId must be set — this is what the
    // Booking schema's pre-validate hook also enforces at the database layer.
    const account = actorFromResolvedIdentity(accountIdentity);
    const guest = actorFromResolvedIdentity(guestIdentity);
    expect(Boolean(account.userId)).not.toBe(Boolean(account.whatsappCustomerId));
    expect(Boolean(guest.userId)).not.toBe(Boolean(guest.whatsappCustomerId));
  });
});

describe("customer view", () => {
  it("reads a website account", () => {
    expect(bookingCustomerView(accountBooking)).toMatchObject({
      name: "Asha Verma",
      email: "asha@example.com",
      kind: "account",
    });
  });

  it("reads a WhatsApp guest", () => {
    expect(bookingCustomerView(whatsappBooking)).toMatchObject({
      name: "Ramesh Kumar",
      phone: "919812345678",
      kind: "whatsapp",
      wappId: "WAPP1000001",
    });
  });

  it("falls back to the WAPP id when the guest never gave a name", () => {
    // An owner still needs something readable to identify the booking by.
    expect(
      bookingCustomerView({
        ...whatsappBooking,
        whatsappCustomerId: { ...whatsappBooking.whatsappCustomerId, name: "" },
      })?.name,
    ).toBe("WAPP1000001");
  });

  it("returns nothing for a row whose customer was not populated", () => {
    expect(bookingCustomerView({ customerId: "user-1" })).toBeNull();
    expect(bookingCustomerView({})).toBeNull();
  });
});

describe("owner and admin views", () => {
  it("leaves a website booking exactly as it was", () => {
    const decorated = withBookingCustomer(accountBooking);
    expect(decorated.customerId).toBe(accountBooking.customerId);
    expect(decorated).not.toHaveProperty("whatsappCustomer");
  });

  it("renders a WhatsApp guest in the shape existing views already read", () => {
    // The owner Booking Centre reads booking.customerId.name; filling it from
    // the real guest record is what lets a WhatsApp booking display with no
    // UI change. This is the guest's real name and number, not placeholder data.
    const decorated: any = withBookingCustomer(whatsappBooking);
    expect(decorated.customerId).toMatchObject({
      name: "Ramesh Kumar",
      phone: "919812345678",
    });
  });

  it("exposes the WAPP id for admin and support", () => {
    const decorated: any = withBookingCustomer(whatsappBooking);
    expect(decorated.whatsappCustomer).toMatchObject({
      wappId: "WAPP1000001",
    });
    expect(decorated.customerKind).toBe("whatsapp");
  });

  it("keeps bookingSource as tirvona so the owner's default filter still shows it", () => {
    // This is the regression that would hide WhatsApp bookings from owners:
    // the Booking Centre filters on bookingSource, not on channel.
    const decorated: any = withBookingCustomer(whatsappBooking);
    expect(decorated.bookingSource).toBe("tirvona");
    expect(decorated.channel).toBe("whatsapp");
  });

  it("shows the registered customer's own details for a WhatsApp booking made by a matched account", () => {
    // Requirement: when the number belongs to an existing website user, the
    // Admin/Owner dashboards must show that customer's real registered
    // name and phone — not a WhatsApp-only identity — while still recording
    // that the booking arrived through WhatsApp.
    const accountBookingViaWhatsApp = {
      bookingId: "TRV-3",
      bookingSource: "tirvona",
      channel: "whatsapp",
      customerId: {
        _id: "user-1",
        name: "Priya Sharma",
        email: "priya@example.com",
        phone: "919876543210",
      },
      whatsappCustomerId: null,
    };
    const decorated: any = withBookingCustomer(accountBookingViaWhatsApp);
    expect(decorated.customerId).toMatchObject({
      name: "Priya Sharma",
      email: "priya@example.com",
      phone: "919876543210",
    });
    expect(decorated.customerKind).toBe("account");
    // No WhatsApp-only identity is attached, because there isn't one.
    expect(decorated).not.toHaveProperty("whatsappCustomer");
    // Still visible under the owner's default Tirvona filter, and still
    // reportable as a WhatsApp-originated booking.
    expect(decorated.bookingSource).toBe("tirvona");
    expect(decorated.channel).toBe("whatsapp");
  });

  it("decorates a mixed list without dropping anything", () => {
    const rows = withBookingCustomers([accountBooking, whatsappBooking]);
    expect(rows).toHaveLength(2);
    expect((rows[0] as any).customerId.name).toBe("Asha Verma");
    expect((rows[1] as any).customerId.name).toBe("Ramesh Kumar");
  });
});

describe("ownership", () => {
  it("filters by the right field for each identity", () => {
    expect(bookingOwnerFilter({ userId: "user-1" })).toEqual({
      customerId: "user-1",
    });
    expect(bookingOwnerFilter({ whatsappCustomerId: "wa-1" })).toEqual({
      whatsappCustomerId: "wa-1",
    });
  });

  it("refuses to build a filter with no identity", () => {
    // An empty filter would return every customer's bookings to one caller.
    expect(() => bookingOwnerFilter({})).toThrow();
    expect(() => bookingOwnerFilter({ userId: null })).toThrow();
  });

  it("matches a booking to the identity that made it", () => {
    expect(bookingBelongsTo(accountBooking, { userId: "user-1" })).toBe(true);
    expect(
      bookingBelongsTo(whatsappBooking, { whatsappCustomerId: "wa-1" }),
    ).toBe(true);
  });

  it("never matches one identity's booking to the other kind", () => {
    // A WhatsApp customer id must not match a website booking even if the
    // string happened to be the same value.
    expect(
      bookingBelongsTo(accountBooking, { whatsappCustomerId: "user-1" }),
    ).toBe(false);
    expect(bookingBelongsTo(whatsappBooking, { userId: "wa-1" })).toBe(false);
  });

  it("does not match someone else's booking", () => {
    expect(bookingBelongsTo(accountBooking, { userId: "user-2" })).toBe(false);
    expect(
      bookingBelongsTo(whatsappBooking, { whatsappCustomerId: "wa-2" }),
    ).toBe(false);
  });

  it("does not match when the caller has no identity", () => {
    expect(bookingBelongsTo(accountBooking, {})).toBe(false);
    expect(bookingBelongsTo(whatsappBooking, {})).toBe(false);
  });

  it("matches an unpopulated reference as well as a populated one", () => {
    expect(
      bookingBelongsTo({ customerId: "user-1" }, { userId: "user-1" }),
    ).toBe(true);
    expect(
      bookingBelongsTo(
        { whatsappCustomerId: "wa-1" },
        { whatsappCustomerId: "wa-1" },
      ),
    ).toBe(true);
  });
});
