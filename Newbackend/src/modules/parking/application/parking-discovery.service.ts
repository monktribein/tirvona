import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  PARKING_AMENITIES,
  PARKING_MODEL,
  PARKING_VEHICLE_META,
  PARKING_VEHICLE_TYPES,
} from "../domain/parking.constants";
import { datesInSpan } from "../domain/parking.utils";
import { ParkingPricingService } from "./parking-pricing.service";
import type { ParkingSearchDto } from "../presentation/dtos/parking.dto";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

@Injectable()
export class ParkingDiscoveryService {
  constructor(
    @InjectModel(PARKING_MODEL.Location) private readonly locations: Model<any>,
    @InjectModel(PARKING_MODEL.SlotType) private readonly slotTypes: Model<any>,
    @InjectModel(PARKING_MODEL.Availability)
    private readonly availability: Model<any>,
    @InjectModel(PARKING_MODEL.Review) private readonly reviews: Model<any>,
    @InjectModel(PARKING_MODEL.VehicleType)
    private readonly vehicleTypes: Model<any>,
    private readonly pricing: ParkingPricingService,
  ) {}

  private async summary(
    locationId: string,
    entryAt?: string,
    exitAt?: string,
  ): Promise<any> {
    const types = await this.slotTypes
      .find({ locationId, isActive: true })
      .lean();
    const dates = datesInSpan(
      entryAt ?? new Date(),
      exitAt ?? new Date(Date.now() + 3_600_000),
    );
    const rows = await this.availability
      .find({ locationId, date: { $in: dates } })
      .lean();
    const totalCapacity = types.reduce(
      (sum, type) => sum + Number(type.totalCapacity),
      0,
    );
    let availableCount = 0;
    for (const type of types) {
      const typeRows = rows.filter(
        (row) => String(row.slotTypeId) === String(type._id),
      );
      const free = typeRows.length
        ? Math.min(
            ...typeRows.map((row) =>
              row.isClosed
                ? 0
                : Math.max(
                    0,
                    row.totalCapacity - row.bookedCount - row.blockedCount,
                  ),
            ),
          )
        : type.totalCapacity;
      availableCount += free;
    }
    return {
      totalCapacity,
      availableCount,
      occupancyPercent: totalCapacity
        ? Number(
            (((totalCapacity - availableCount) / totalCapacity) * 100).toFixed(
              1,
            ),
          )
        : 0,
    };
  }

  async search(query: ParkingSearchDto): Promise<any> {
    const filter: Record<string, any> = { status: "active" };
    if (query.city)
      filter["address.city"] = {
        $regex: escapeRegex(query.city),
        $options: "i",
      };
    if (query.state)
      filter["address.state"] = {
        $regex: escapeRegex(query.state),
        $options: "i",
      };
    if (query.templeSlug)
      filter["nearbyDestinations.templeSlug"] = query.templeSlug.toLowerCase();
    else if (query.destination) {
      const value = { $regex: escapeRegex(query.destination), $options: "i" };
      filter.$or = [
        { name: value },
        { "address.city": value },
        { "address.landmark": value },
        { "nearbyDestinations.name": value },
      ];
    }
    if (query.vehicleType) filter.supportedVehicleTypes = query.vehicleType;
    if (query.amenities?.length) filter.amenities = { $all: query.amenities };
    if (query.covered) filter.isCovered = true;
    if (query.evCharging) filter.hasEvCharging = true;
    if (query.minRating) filter["rating.average"] = { $gte: query.minRating };
    const sort: Record<string, 1 | -1> =
      query.sortBy === "rating"
        ? { "rating.average": -1 }
        : query.sortBy === "newest"
          ? { createdAt: -1 }
          : query.sortBy === "name"
            ? { name: 1 }
            : { isFeatured: -1, "rating.average": -1 };
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    let items: any[];
    let total: number;
    if (query.latitude != null && query.longitude != null) {
      const pipeline: any[] = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [query.longitude, query.latitude],
            },
            distanceField: "distanceMeters",
            maxDistance: (query.radiusKm ?? 10) * 1000,
            query: filter,
            spherical: true,
          },
        },
        {
          $addFields: {
            distanceKm: { $round: [{ $divide: ["$distanceMeters", 1000] }, 2] },
          },
        },
        { $sort: { distanceMeters: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ];
      items = await this.locations.aggregate(pipeline);
      total = items.length;
    } else {
      [items, total] = await Promise.all([
        this.locations
          .find(filter)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        this.locations.countDocuments(filter),
      ]);
    }
    const data = await Promise.all(
      items.map(async (item) => ({
        ...item,
        availability: await this.summary(
          String(item._id),
          query.entryAt,
          query.exitAt,
        ),
      })),
    );
    return {
      success: true,
      count: data.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async detail(
    idOrSlug: string,
    input: { entryAt?: string; exitAt?: string; vehicleType?: string },
  ): Promise<any | null> {
    const filter = /^[0-9a-f]{24}$/i.test(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug.toLowerCase() };
    const location = await this.locations
      .findOne({ ...filter, status: "active" })
      .lean();
    if (!location) return null;
    const slotTypes = await this.availabilityFor(
      location,
      input.vehicleType,
      input.entryAt ?? new Date().toISOString(),
      input.exitAt ?? new Date(Date.now() + 7_200_000).toISOString(),
    );
    const reviews = await this.reviews
      .find({ locationId: location._id, status: "approved" })
      .populate("customerId", "name avatarUrl")
      .sort({ createdAt: -1 })
      .limit(10);
    return {
      ...location,
      slotTypes,
      reviews,
      reviewCount: await this.reviews.countDocuments({
        locationId: location._id,
        status: "approved",
      }),
    };
  }

  async availabilityFor(
    location: any,
    vehicleType: string | undefined,
    entryAt: string,
    exitAt: string,
  ): Promise<any[]> {
    const types = await this.slotTypes
      .find({
        locationId: location._id,
        isActive: true,
        ...(vehicleType ? { vehicleTypes: vehicleType } : {}),
      })
      .sort({ displayOrder: 1 })
      .lean();
    const dates = datesInSpan(entryAt, exitAt);
    return Promise.all(
      types.map(async (type) => {
        const rows = await this.availability
          .find({ slotTypeId: type._id, date: { $in: dates } })
          .lean();
        const free = rows.length
          ? Math.min(
              ...rows.map((row) =>
                row.isClosed
                  ? 0
                  : Math.max(
                      0,
                      row.totalCapacity - row.bookedCount - row.blockedCount,
                    ),
              ),
            )
          : type.totalCapacity;
        const priced = vehicleType
          ? await this.pricing.quote(location, type, {
              vehicleType,
              entryAt,
              exitAt,
            })
          : null;
        return {
          slotTypeId: type._id,
          name: type.name,
          code: type.code,
          description: type.description,
          vehicleTypes: type.vehicleTypes,
          isCovered: type.isCovered,
          hasEvCharging: type.hasEvCharging,
          floorLabel: type.floorLabel,
          totalCapacity: type.totalCapacity,
          availableCount: free,
          isAvailable: free > 0,
          pricing: priced?.ok ? priced.quote : null,
        };
      }),
    );
  }

  async vehicleTypeList(): Promise<any[]> {
    const rows = await this.vehicleTypes
      .find({ isActive: true })
      .sort({ displayOrder: 1 })
      .lean();
    return rows.length
      ? rows
      : PARKING_VEHICLE_TYPES.map((code) => ({
          code,
          ...PARKING_VEHICLE_META[code],
        }));
  }

  filters(): any {
    return {
      vehicleTypes: PARKING_VEHICLE_TYPES.map((code) => ({
        code,
        label: PARKING_VEHICLE_META[code].label,
        icon: PARKING_VEHICLE_META[code].icon,
      })),
      amenities: PARKING_AMENITIES.map((key) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
      sortOptions: [
        { value: "recommended", label: "Recommended" },
        { value: "rating", label: "Top Rated" },
        { value: "newest", label: "Newest" },
        { value: "name", label: "Name (A–Z)" },
      ],
    };
  }
}
