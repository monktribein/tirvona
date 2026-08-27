import {
  buildParkingMessage,
  buildStayMessage,
  formatDateTime,
  formatMoney,
} from "./whatsapp-message.builder";

const stay = {
  guestName: "Ramesh Kumar Sharma",
  reference: "TRV-2026-0001",
  ashramName: "Parmarth Niketan",
  ashramCity: "Rishikesh",
  ashramState: "Uttarakhand",
  roomName: "Deluxe Ganga View",
  checkInDate: "2026-09-01T06:30:00.000Z",
  checkOutDate: "2026-09-03T06:30:00.000Z",
  guestsCount: 2,
  roomsCount: 1,
  checkInCode: "482913",
  amountPaid: 4500,
  currency: "INR",
};

describe("formatting helpers", () => {
  it("renders timestamps in Asia/Kolkata, not UTC", () => {
    // 06:30 UTC is noon in India, so the date must not roll to the day before.
    expect(formatDateTime("2026-09-01T06:30:00.000Z")).toContain("12:00 pm");
    // The locale spells the month "Sept" and punctuates its own way, so assert
    // on the parts that matter rather than the exact string.
    expect(formatDateTime("2026-09-01T06:30:00.000Z")).toMatch(
      /Tue.*1 Sept.*2026/,
    );
  });

  it("returns an empty string for a missing or unparseable date", () => {
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("not-a-date")).toBe("");
  });

  it("formats rupees with Indian digit grouping", () => {
    expect(formatMoney(125000)).toBe("\u20B91,25,000");
    expect(formatMoney(0)).toBe("\u20B90");
    expect(formatMoney(undefined)).toBe("");
  });
});

describe("stay messages", () => {
  it("carries the guest, ashram, dates and check-in code", () => {
    const body = buildStayMessage("confirmed", stay);

    expect(body).toContain("*Booking Confirmed*");
    expect(body).toContain("Namaste Ramesh,");
    expect(body).toContain("*Ashram:* Parmarth Niketan");
    expect(body).toContain("*Location:* Rishikesh, Uttarakhand");
    expect(body).toContain("*Booking ID:* TRV-2026-0001");
    expect(body).toContain("*Room:* Deluxe Ganga View");
    expect(body).toContain("*Check-in:*");
    expect(body).toContain("*Check-out:*");
    expect(body).toContain("*Guests:* 2");
    expect(body).toContain("*Amount paid:* \u20B94,500");
    expect(body).toContain("*Check-in code:* 482913");
  });

  it("keeps the blank lines between sections", () => {
    expect(buildStayMessage("confirmed", stay)).toContain("\n\n");
  });

  it("never leaves a hole where a field is missing", () => {
    const body = buildStayMessage("confirmed", {
      reference: "TRV-2026-0002",
      ashramName: "Sivananda Ashram",
    });

    expect(body).not.toMatch(/\n{3,}/);
    expect(body.startsWith("*Booking Confirmed*")).toBe(true);
    expect(body.endsWith("\n")).toBe(false);
    expect(body).toContain("Namaste,");
    expect(body).not.toContain("*Room:*");
    expect(body).not.toContain("*Check-in code:*");
  });

  it("names the ashram on every stay event", () => {
    const kinds = [
      "confirmed",
      "held",
      "expired",
      "cancelled",
      "payment_success",
      "payment_failed",
      "refund",
      "checkin_reminder",
    ] as const;

    for (const kind of kinds) {
      expect(buildStayMessage(kind, stay)).toContain("Parmarth Niketan");
    }
  });

  it("withholds the check-in code until the stay is paid for", () => {
    expect(buildStayMessage("held", stay)).not.toContain("482913");
    expect(buildStayMessage("expired", stay)).not.toContain("482913");
    expect(buildStayMessage("payment_failed", stay)).not.toContain("482913");
  });

  it("falls back to the plain notification text for an unknown kind", () => {
    const body = buildStayMessage("mystery" as never, stay, {
      title: "Update",
      message: "Something changed.",
    });
    expect(body).toContain("Update");
    expect(body).toContain("Something changed.");
  });
});

describe("parking messages", () => {
  const parking = {
    reference: "PRK-2026-0007",
    locationName: "Prem Mandir Parking",
    locationCity: "Vrindavan",
    vehicleNumber: "UP80 AB 1234",
    vehicleType: "car",
    entryAt: "2026-09-01T06:30:00.000Z",
    displayCode: "PK-9931",
    passUrl: "https://www.tirvona.com/parking/booking/PRK-2026-0007",
    amountPaid: 120,
    currency: "INR",
  };

  it("shows the gate code and a link to the QR pass", () => {
    const body = buildParkingMessage("confirmed", parking);

    expect(body).toContain("*Parking Confirmed*");
    expect(body).toContain("*Parking:* Prem Mandir Parking");
    expect(body).toContain("*Location:* Vrindavan");
    expect(body).toContain("*Vehicle:* UP80 AB 1234");
    expect(body).toContain("*Entry:*");
    expect(body).toContain("*Amount paid:* \u20B9120");
    expect(body).toContain("*Gate code:* PK-9931");
    expect(body).toContain(parking.passUrl);
  });

  it("stays readable when the pass has not been issued yet", () => {
    const rest = { ...parking };
    delete (rest as Partial<typeof parking>).displayCode;
    delete (rest as Partial<typeof parking>).passUrl;
    const body = buildParkingMessage("confirmed", rest);

    expect(body).not.toMatch(/\n{3,}/);
    expect(body).not.toContain("*Gate code:*");
    expect(body).toContain("*Parking:* Prem Mandir Parking");
  });

  it("drops the pass details once the booking is cancelled", () => {
    const body = buildParkingMessage("cancelled", parking);
    expect(body).toContain("*Parking Cancelled*");
    expect(body).not.toContain("PK-9931");
  });
});
