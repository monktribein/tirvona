import { BadRequestException } from "@nestjs/common";
import { AshramsService } from "./ashrams.service";
import type { AshramQueryDto } from "../presentation/dtos/ashram.dto";

const query = (overrides: Partial<AshramQueryDto> = {}): AshramQueryDto =>
  ({ page: 1, limit: 20, radiusKm: 100, ...overrides }) as AshramQueryDto;

describe("AshramsService location discovery", () => {
  const nearby = {
    _id: "nearby",
    name: "Nearby Ashram",
    status: "approved",
    deletedAt: null,
    lowestNightPrice: 500,
    distanceMeters: 2450,
    address: { city: "Vrindavan", district: "Mathura", state: "Uttar Pradesh" },
    amenities: ["Parking", "Pure Vegetarian Food"],
    activities: ["Morning Aarti", "Yoga"],
    dailySchedule: "Aarti 6:00 am; Darshan 7:00 am",
    food: { foodType: "Satvik" },
  };
  const remaining = {
    _id: "remaining",
    name: "Other Ashram",
    status: "approved",
    deletedAt: null,
    lowestNightPrice: 700,
    address: { city: "Haridwar", state: "Uttarakhand" },
    amenities: [],
  };

  const createService = () => {
    const aggregate = jest.fn().mockResolvedValue([nearby]);
    const ashramFindLean = jest.fn().mockResolvedValue([remaining]);
    const ashrams = {
      aggregate,
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: ashramFindLean }),
      }),
    };
    const roomFindLean = jest.fn().mockResolvedValue([
      {
        _id: "room-1",
        ashramId: "nearby",
        name: "Double Room",
        type: "private_room",
        acType: "AC",
        totalInventory: 3,
        amenities: ["Attached Bathroom"],
      },
    ]);
    const rooms = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: roomFindLean }),
      }),
    };
    const inventory = { find: jest.fn() };
    const emptyModel = {};
    const service = new AshramsService(
      ashrams as any,
      rooms as any,
      emptyModel as any,
      inventory as any,
      emptyModel as any,
      emptyModel as any,
      emptyModel as any,
    );
    return { service, ashrams, aggregate };
  };

  it("ranks geospatial matches first and keeps the remaining catalogue", async () => {
    const { service, aggregate } = createService();

    const result = await service.publicList(
      query({ latitude: 27.58, longitude: 77.7 }),
    );

    expect(aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $geoNear: expect.objectContaining({
            near: { type: "Point", coordinates: [77.7, 27.58] },
            maxDistance: 100_000,
            spherical: true,
          }),
        }),
      ]),
    );
    expect(result.data.map((row: any) => row._id)).toEqual([
      "nearby",
      "remaining",
    ]);
    expect(result.discovery).toEqual(
      expect.objectContaining({
        locationApplied: true,
        nearbyCount: 1,
        radiusKm: 100,
        detectedArea: expect.objectContaining({ city: "Vrindavan" }),
      }),
    );
    expect(result.data[0].discovery).toEqual(
      expect.objectContaining({
        distanceKm: 2.45,
        isNearby: true,
        rooms: expect.objectContaining({ totalInventory: 3, hasAc: true }),
        parking: { available: true },
        food: expect.objectContaining({ available: true, type: "Satvik" }),
      }),
    );
    expect(result.data[1].discovery.isNearby).toBe(false);
  });

  it("rejects a partial coordinate pair", async () => {
    const { service } = createService();
    await expect(service.publicList(query({ latitude: 27.58 }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
