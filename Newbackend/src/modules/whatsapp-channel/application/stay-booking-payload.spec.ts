import {
  buildBookingDto,
  roomsBookedCountFor,
  totalUnits,
} from "./stay-booking-payload";
import { CreateBookingDto } from "../../bookings/presentation/dtos/booking.dto";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

const base = () => ({
  ashramId: "507f1f77bcf86cd799439011",
  rooms: [{ roomId: "507f1f77bcf86cd799439021", units: 1 }],
  checkIn: new Date("2030-10-01T00:00:00.000Z"),
  checkOut: new Date("2030-10-03T00:00:00.000Z"),
  guests: 2,
});

describe("buildBookingDto mirrors the website's request", () => {
  it("carries the rooms list, its total in roomsBookedCount and the first room as roomId", () => {
    const dto = buildBookingDto({
      ...base(),
      rooms: [
        { roomId: "507f1f77bcf86cd799439021", units: 2 },
        { roomId: "507f1f77bcf86cd799439022", units: 1 },
      ],
      guests: 5,
    });
    expect(dto.rooms).toEqual([
      { roomId: "507f1f77bcf86cd799439021", units: 2 },
      { roomId: "507f1f77bcf86cd799439022", units: 1 },
    ]);
    expect(dto.roomsBookedCount).toBe(3);
    expect(dto.roomId).toBe("507f1f77bcf86cd799439021");
    expect(dto.guestsCount).toBe(5);
  });

  it("does not hard-code one unit", () => {
    const dto = buildBookingDto({
      ...base(),
      rooms: [{ roomId: "507f1f77bcf86cd799439021", units: 4 }],
    });
    expect(dto.rooms[0].units).toBe(4);
    expect(dto.roomsBookedCount).toBe(4);
  });

  it("always sends the full services object in the website's shape", () => {
    const dto = buildBookingDto(base());
    expect(dto.services).toEqual({
      selectedAddOns: [],
      prasad: { ordered: false },
      meals: { ordered: false },
      parking: { ordered: false },
      locker: { ordered: false },
    });
  });

  it("carries chosen add-ons and flat services", () => {
    const dto = buildBookingDto({
      ...base(),
      addOns: [{ serviceId: "add-1", quantity: 2 }],
      services: { parking: true, meals: true },
    });
    expect(dto.services.selectedAddOns).toEqual([
      { serviceId: "add-1", quantity: 2 },
    ]);
    expect(dto.services.parking).toEqual({ ordered: true });
    expect(dto.services.meals).toEqual({ ordered: true });
    expect(dto.services.prasad).toEqual({ ordered: false });
  });

  it("carries the coupon, uppercased, and omits it when there is none", () => {
    expect(buildBookingDto({ ...base(), promoCode: " save20 " }).promoCode).toBe(
      "SAVE20",
    );
    expect("promoCode" in buildBookingDto(base())).toBe(false);
    expect("appliedOfferId" in buildBookingDto(base())).toBe(false);
  });

  it("carries the requested arrival/departure times as special requests", () => {
    const dto = buildBookingDto({
      ...base(),
      specialRequests: "Requested check-in 16:00 (via WhatsApp)",
    });
    expect(dto.specialRequests).toContain("16:00");
  });

  it("sends dates as ISO strings the pricing service parses", () => {
    const dto = buildBookingDto(base());
    expect(dto.checkInDate).toBe("2030-10-01T00:00:00.000Z");
    expect(dto.checkOutDate).toBe("2030-10-03T00:00:00.000Z");
  });

  it("never exceeds the backend's roomsBookedCount ceiling", () => {
    const rooms = [
      { roomId: "507f1f77bcf86cd799439021", units: 20 },
      { roomId: "507f1f77bcf86cd799439022", units: 20 },
    ];
    expect(totalUnits(rooms)).toBe(40);
    expect(roomsBookedCountFor(rooms)).toBe(20);
  });

  it("produces a payload the booking DTO's own validation accepts", () => {
    const dto = plainToInstance(
      CreateBookingDto,
      buildBookingDto({
        ...base(),
        rooms: [
          { roomId: "507f1f77bcf86cd799439021", units: 2 },
          { roomId: "507f1f77bcf86cd799439022", units: 1 },
        ],
        guests: 4,
        promoCode: "SAVE20",
        addOns: [{ serviceId: "add-1", quantity: 1 }],
        services: { prasad: true },
      }),
    );
    expect(validateSync(dto, { whitelist: false })).toEqual([]);
  });

  it("carries no price of its own — nothing in the payload is an amount", () => {
    const dto = buildBookingDto({ ...base(), promoCode: "SAVE20" });
    const keys = JSON.stringify(dto);
    expect(keys).not.toMatch(/totalAmount|discountAmount|price/i);
  });
});
