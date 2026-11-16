import { buildYatraMessage } from "./whatsapp-message.builder";

describe("buildYatraMessage", () => {
  const full = buildYatraMessage({
    guestName: "Asha Verma",
    reference: "YTR-1001",
    ticketCode: "K7M2QX",
    tourTitle: "Char Dham Yatra",
    route: "Delhi → Kedarnath",
    departAt: "2026-12-01T01:30:00.000Z",
    seats: ["12", "13"],
    passengers: [{ name: "Asha Verma", seat: "12" }, { name: "Ravi Verma", seat: "13" }],
    boardingName: "Kashmere Gate",
    droppingName: "Haridwar",
    amountPaid: 3015,
    protectionFee: 30,
    refundLines: ["3 days or more before departure: 90% of the fare refunded"],
    ruleLines: ["Alcohol policy: Not allowed."],
    ticketUrl: "https://tirvona.com/profile/journeys/1",
    appUrl: "https://play.google.com/store/apps/details?id=com.tirvona.app",
  });

  it("carries the seats, details, rules, refund policy and the app link", () => {
    expect(full).toContain("*Seat no.:* 12, 13");
    expect(full).toContain("Ravi Verma – Seat 13");
    expect(full).toContain("*Boarding point:* Kashmere Gate");
    expect(full).toContain("includes ₹30 cancellation protection");
    expect(full).toContain("*Bus rules & policies*");
    expect(full).toContain("*Cancellation & refund policy*");
    expect(full).toContain("https://play.google.com/store/apps/details?id=com.tirvona.app");
  });

  it("still reads well for a thin booking", () => {
    const thin = buildYatraMessage({ reference: "YTR-2" });
    expect(thin).toContain("*Booking ID:* YTR-2");
    expect(thin).not.toContain("undefined");
    expect(thin).not.toContain("Passengers");
  });
});
