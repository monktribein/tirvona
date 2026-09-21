import type { Connection, Model} from "mongoose";
import { createConnection } from "mongoose";
import { AshramSchema, RoomSchema } from "../../../ashrams/infrastructure/persistence/ashram.schemas";
import { BookingSchema } from "../../../bookings/infrastructure/persistence/booking.schemas";
import { DayStayProductSchema } from "../../../day-stay/infrastructure/persistence/day-stay-product.schemas";

describe("DAYSTAY-001 Schema & Domain Foundations", () => {
  let conn: Connection;
  let AshramModel: Model<any>;
  let RoomModel: Model<any>;
  let BookingModel: Model<any>;
  let DayStayProductModel: Model<any>;

  beforeAll(() => {
    // Create an offline dummy connection to compile models and validate schema rules without a live DB
    conn = createConnection();
    AshramModel = conn.model("Ashram", AshramSchema);
    RoomModel = conn.model("Room", RoomSchema);
    BookingModel = conn.model("Booking", BookingSchema);
    DayStayProductModel = conn.model("DayStayProduct", DayStayProductSchema);
  });

  afterAll(async () => {
    await conn.close();
  });

  describe("1. Backward Compatibility — Existing Overnight Records", () => {
    it("validates existing overnight booking without dayStayDetails", () => {
      const doc = new BookingModel({
        bookingId: "BK-OVERNIGHT-001",
        reservationNumber: "RES-1001",
        customerId: "660000000000000000000001",
        ashramId: "660000000000000000000002",
        rooms: [
          {
            roomId: "660000000000000000000003",
            units: 1,
            sellingPrice: 1200,
          },
        ],
        checkInDate: new Date("2026-10-01"),
        checkOutDate: new Date("2026-10-02"),
        guestsCount: 2,
        roomsBookedCount: 1,
        status: "confirmed",
        pricing: {
          basePrice: 1200,
          totalAmount: 1200,
        },
        checkInCode: "123456",
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.bookingType).toBe("overnight");
    });

    it("defaults bookingType to overnight when omitted", () => {
      const doc = new BookingModel({
        bookingId: "BK-DEFAULT-TYPE",
        customerId: "660000000000000000000001",
        ashramId: "660000000000000000000002",
        rooms: [{ roomId: "660000000000000000000003", units: 1 }],
        checkInDate: new Date("2026-10-01"),
        checkOutDate: new Date("2026-10-02"),
        guestsCount: 1,
        roomsBookedCount: 1,
        pricing: { basePrice: 800, totalAmount: 800 },
        checkInCode: "654321",
      });

      expect(doc.bookingType).toBe("overnight");
    });
  });

  describe("2. Day Stay Booking Models", () => {
    it("validates DAY_REST booking with valid time slots and product", () => {
      const startTime = new Date("2026-10-01T08:00:00.000Z");
      const endTime = new Date("2026-10-01T11:00:00.000Z");

      const doc = new BookingModel({
        bookingId: "BK-DAYREST-001",
        customerId: "660000000000000000000001",
        ashramId: "660000000000000000000002",
        bookingType: "day_rest",
        dayStayDetails: {
          productCode: "DAY_REST_3H",
          productType: "day_rest",
          slotStartTime: startTime,
          slotEndTime: endTime,
          durationMinutes: 180,
          graceMinutes: 15,
          housekeepingBufferMinutes: 45,
        },
        rooms: [{ roomId: "660000000000000000000003", units: 1 }],
        checkInDate: startTime,
        checkOutDate: endTime,
        guestsCount: 2,
        roomsBookedCount: 1,
        pricing: { basePrice: 650, totalAmount: 650 },
        checkInCode: "987654",
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.bookingType).toBe("day_rest");
      expect(doc.dayStayDetails.durationMinutes).toBe(180);
    });

    it("validates DAY_REST_4H booking with 240 minute duration", () => {
      const startTime = new Date("2026-10-01T09:00:00.000Z");
      const endTime = new Date("2026-10-01T13:00:00.000Z");

      const doc = new BookingModel({
        bookingId: "BK-DAYREST4H-001",
        customerId: "660000000000000000000001",
        ashramId: "660000000000000000000002",
        bookingType: "day_rest",
        dayStayDetails: {
          productCode: "DAY_REST_4H",
          productType: "day_rest",
          slotStartTime: startTime,
          slotEndTime: endTime,
          durationMinutes: 240,
          graceMinutes: 15,
          housekeepingBufferMinutes: 45,
        },
        rooms: [{ roomId: "660000000000000000000003", units: 1 }],
        checkInDate: startTime,
        checkOutDate: endTime,
        guestsCount: 1,
        roomsBookedCount: 1,
        pricing: { basePrice: 699, totalAmount: 699 },
        checkInCode: "332211",
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.bookingType).toBe("day_rest");
      expect(doc.dayStayDetails.durationMinutes).toBe(240);
    });
  });

  describe("3. DayStayProduct Configuration & Validation", () => {
    it("allows dynamic configuration of product durations", () => {
      const dayRest4h = new DayStayProductModel({
        productCode: "DAY_REST_4H",
        productType: "day_rest",
        displayName: "Pilgrim 4 Hours Stay",
        durationMinutes: 240,
        sortOrder: 1,
      });
      const dayRest6h = new DayStayProductModel({
        productCode: "DAY_REST_6H",
        productType: "day_rest",
        displayName: "Pilgrim 6 Hours Stay",
        durationMinutes: 360,
        sortOrder: 2,
      });

      expect(dayRest4h.validateSync()).toBeUndefined();
      expect(dayRest6h.validateSync()).toBeUndefined();
      expect(dayRest4h.durationMinutes).toBe(240);
      expect(dayRest6h.durationMinutes).toBe(360);
    });

    it("rejects duration <= 0", () => {
      const invalid = new DayStayProductModel({
        productCode: "INVALID_ZERO",
        productType: "freshen_up",
        displayName: "Invalid Duration Product",
        durationMinutes: 0,
      });

      const err = invalid.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors["durationMinutes"]).toBeDefined();
    });

    it("rejects invalid product type enum", () => {
      const invalid = new DayStayProductModel({
        productCode: "INVALID_TYPE",
        productType: "hourly_hotel_invalid",
        displayName: "Invalid Type",
        durationMinutes: 60,
      });

      const err = invalid.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors["productType"]).toBeDefined();
    });
  });

  describe("4. Property Day Stay Configuration", () => {
    it("defaults dayStayConfig.enabled to false", () => {
      const ashram = new AshramModel({
        ownerId: "660000000000000000000001",
        name: "Sri Vrindavan Ashram",
        description: "Peaceful ashram in Raman Reti",
        address: {
          street: "Parikrama Marg",
          city: "Vrindavan",
          district: "Mathura",
          state: "Uttar Pradesh",
          pincode: "281121",
        },
      });

      expect(ashram.dayStayConfig.enabled).toBe(false);
      expect(ashram.dayStayConfig.defaultGraceMinutes).toBe(15);
      expect(ashram.dayStayConfig.defaultHousekeepingBufferMinutes).toBe(45);
      expect(ashram.dayStayConfig.operatingHours.start).toBe("06:00");
      expect(ashram.dayStayConfig.operatingHours.end).toBe("20:00");
    });

    it("supports full Day Stay enablement and verification parameters", () => {
      const ashram = new AshramModel({
        ownerId: "660000000000000000000001",
        name: "Sri Radhe Kripa Ashram",
        description: "Pilgrim sanctuary",
        address: {
          street: "Vidyapeeth Chauraha",
          city: "Vrindavan",
          district: "Mathura",
          state: "Uttar Pradesh",
          pincode: "281121",
        },
        dayStayConfig: {
          enabled: true,
          verificationStatus: "verified",
          verificationData: {
            verifiedAt: new Date(),
            verifiedBy: "660000000000000000000099",
            bathroomConditionScore: 5,
            roomConditionScore: 5,
            linenAndTowelsConfirmed: true,
            hotWaterConfirmed: true,
            familySuitabilityConfirmed: true,
            kycProcessConfirmed: true,
            bathroomPhotos: ["https://cdn.tirvona.com/bathroom-1.jpg"],
            notes: "Verified spotless private bathroom and working geyser.",
          },
          operatingHours: { start: "07:00", end: "19:30" },
          defaultGraceMinutes: 20,
          defaultHousekeepingBufferMinutes: 30,
          policy: {
            towelProvided: true,
            hotWaterAvailable: true,
            attachedBathroom: true,
            parkingInfo: { type: "partner", indicativePrice: 50 },
            luggageInfo: { available: true, included: true, price: 0 },
          },
        },
      });

      const err = ashram.validateSync();
      expect(err).toBeUndefined();
      expect(ashram.dayStayConfig.enabled).toBe(true);
      expect(ashram.dayStayConfig.verificationStatus).toBe("verified");
    });
  });

  describe("5. Room Allocation & Day Stay Pricing", () => {
    it("allows allocating specific inventory to Day Stay while keeping totalInventory for property", () => {
      const room = new RoomModel({
        ashramId: "660000000000000000000001",
        name: "Deluxe AC Family Room",
        type: "family_room",
        acType: "AC",
        capacity: 4,
        totalInventory: 15,
        basePrice: 2000,
        dayStayConfig: {
          eligible: true,
          enabled: true,
          allocatedInventory: 3, // 3 out of 15 allocated to Day Stay
          products: [
            {
              productCode: "DAY_REST_4H",
              productType: "day_rest",
              durationMinutes: 240,
              price: 699,
              discountPrice: 599,
              enabled: true,
            },
            {
              productCode: "DAY_REST_6H",
              productType: "day_rest",
              durationMinutes: 360,
              price: 1199,
              discountPrice: 999,
              enabled: true,
            },
          ],
          bathroomType: "attached_private",
          hasHotWater: true,
          hasTowels: true,
        },
      });

      const err = room.validateSync();
      expect(err).toBeUndefined();
      expect(room.totalInventory).toBe(15);
      expect(room.dayStayConfig.allocatedInventory).toBe(3);
      expect(room.dayStayConfig.products).toHaveLength(2);
    });

    it("allows a room to remain overnight-only with dayStayConfig disabled", () => {
      const room = new RoomModel({
        ashramId: "660000000000000000000001",
        name: "Standard Non-AC Room",
        type: "private_room",
        acType: "Non-AC",
        capacity: 2,
        totalInventory: 10,
        basePrice: 600,
      });

      const err = room.validateSync();
      expect(err).toBeUndefined();
      expect(room.dayStayConfig.enabled).toBe(false);
      expect(room.dayStayConfig.allocatedInventory).toBe(0);
    });
  });
});
