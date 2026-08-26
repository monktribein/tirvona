import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams } from "../../../common/auth/ashram-access";
import { citySlug } from "../../../common/slug/slug.util";
import { AshramSlugService } from "./ashram-slug.service";
import {
  assignedAshramIds,
  isUnrestricted,
  resolveAshramScope,
} from "../../../common/auth/ashram-scope";
import { PARKING_MODEL } from "../../parking/domain/parking.constants";
import { parkingPartnerCode } from "../../parking/domain/parking.utils";
import type {
  AshramDocumentsDto,
  AshramQueryDto,
  CreateRoomDto,
  RoomAvailabilityDto,
  SaveAddOnDto,
  SaveAshramDto,
  UpdateAddOnDto,
} from "../presentation/dtos/ashram.dto";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const round2 = (value: number): number => Math.round(value * 100) / 100;

const assertNoInlineMedia = (dto: {
  images?: string[];
  documents?: Record<string, any>;
}): void => {
  const isInline = (value: unknown): boolean =>
    typeof value === "string" && value.trim().toLowerCase().startsWith("data:");
  if ((dto.images ?? []).some(isInline))
    throw new BadRequestException(
      "Images must be uploaded first and referenced by URL, not embedded in the request",
    );
  if (Object.values(dto.documents ?? {}).some(isInline))
    throw new BadRequestException(
      "Documents must be uploaded first and referenced by URL, not embedded in the request",
    );
};


const normalizeAshramAddress = (
  address: Record<string, any> = {},
  legacy: Record<string, any> = {},
): Record<string, any> => {
  const text = (...values: unknown[]): string =>
    String(values.find((value) => value !== undefined && value !== null && String(value).trim()) ?? "").trim();
  return {
    ...address,
    street: text(
      address.street,
      address.streetAddress,
      address.addressLine,
      legacy.street,
      legacy.streetAddress,
      legacy.addressLine,
    ),
    city: text(address.city, legacy.city),
    district: text(address.district, legacy.district),
    state: text(address.state, legacy.state),
    pincode: text(
      address.pincode,
      address.pinCode,
      address.postalCode,
      address.zipCode,
      legacy.pincode,
      legacy.pinCode,
      legacy.postalCode,
      legacy.zipCode,
    ),
  };
};

const assertCompleteAddress = (address: Record<string, any>): void => {
  const missing = ["street", "city", "district", "state", "pincode"].filter(
    (field) => !String(address[field] ?? "").trim(),
  );
  if (missing.length)
    throw new BadRequestException(
      `Ashram address is missing: ${missing.join(", ")}`,
    );
};

@Injectable()
export class AshramsService {
  constructor(
    @InjectModel("Ashram") readonly ashrams: Model<any>,
    @InjectModel("Room") readonly rooms: Model<any>,
    @InjectModel("Booking") readonly bookings: Model<any>,
    @InjectModel("BookingInventory") readonly inventory: Model<any>,
    @InjectModel("BookingAddon") readonly addons: Model<any>,
    @InjectModel(PARKING_MODEL.Partner) readonly parkingPartners: Model<any>,
    @InjectModel(PARKING_MODEL.Staff) readonly parkingStaff: Model<any>,
    private readonly slugs: AshramSlugService,
  ) { }

  private async parkingEligibleAshrams(
    user: AuthenticatedUser,
  ): Promise<any[]> {
    const scope = await resolveAshramScope(user, this.ashrams);
    return this.ashrams
      .find({
        ...(isUnrestricted(scope) ? {} : { _id: { $in: scope } }),
        deletedAt: null,
      })
      .select("_id name address")
      .sort({ name: 1 })
      .lean();
  }

  async ownerParking(user: AuthenticatedUser): Promise<any> {
    const partner = await this.parkingPartners
      .findOne({ userId: user.id })
      .select("-bankAccount.accountNumber")
      .lean();
    const grant = partner
      ? await this.parkingStaff
          .findOne({
            userId: user.id,
            partnerId: partner._id,
            parkingRole: "parking_partner",
          })
          .lean()
      : null;
    return {
      partner,
      grant,
      ashrams: await this.parkingEligibleAshrams(user),
    };
  }

  async onboardOwnerParking(
    user: AuthenticatedUser,
    body: Record<string, any>,
  ): Promise<any> {
    const businessName = String(body.businessName ?? "").trim();
    if (!businessName)
      throw new BadRequestException("A parking business name is required");

    const ownedAshrams = await this.parkingEligibleAshrams(user);
    if (!ownedAshrams.length)
      throw new ForbiddenException(
        "Create an ashram listing before adding its parking facility",
      );

    let partner = await this.parkingPartners.findOne({ userId: user.id });
    if (!partner) {
      partner = await this.parkingPartners.create({
        userId: user.id,
        partnerCode: parkingPartnerCode(),
        businessName,
        contactPerson: String(body.contactPerson ?? user.name ?? "").trim(),
        contactEmail: String(body.contactEmail ?? "").trim().toLowerCase(),
        contactPhone: String(body.contactPhone ?? "").trim(),
        address: body.address ?? {},
        status: "pending",
        isVerified: false,
        notes: "Self-service application from Ashram Owner portal",
      });
    } else if (["pending", "rejected"].includes(partner.status)) {
      partner.businessName = businessName;
      partner.contactPerson = String(
        body.contactPerson ?? partner.contactPerson ?? "",
      ).trim();
      partner.contactEmail = String(
        body.contactEmail ?? partner.contactEmail ?? "",
      )
        .trim()
        .toLowerCase();
      partner.contactPhone = String(
        body.contactPhone ?? partner.contactPhone ?? "",
      ).trim();
      partner.address = body.address ?? partner.address;
      partner.status = "pending";
      partner.rejectionReason = "";
      await partner.save();
    }

    const grant = await this.parkingStaff.findOneAndUpdate(
      {
        userId: user.id,
        partnerId: partner._id,
        parkingRole: "parking_partner",
      },
      {
        $set: {
          status: "active",
          locationIds: [],
          assignedBy: user.id,
          phone: String(body.contactPhone ?? "").trim(),
        },
        $setOnInsert: {
          userId: user.id,
          partnerId: partner._id,
          parkingRole: "parking_partner",
        },
      },
      { upsert: true, new: true },
    );
    return { partner, grant, ashrams: ownedAshrams };
  }

  private discoveryDates(query: AshramQueryDto): Date[] {
    if (!query.checkIn || !query.checkOut) return [];
    const start = new Date(`${query.checkIn}T00:00:00.000Z`);
    const end = new Date(`${query.checkOut}T00:00:00.000Z`);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    )
      return [];
    const dates: Date[] = [];
    for (
      let cursor = start;
      cursor < end;
      cursor = new Date(cursor.getTime() + 86_400_000)
    )
      dates.push(cursor);
    return dates;
  }

  private async enrichDiscoveryRows(
    rows: any[],
    query: AshramQueryDto,
  ): Promise<any[]> {
    if (!rows.length) return [];
    const dates = this.discoveryDates(query);
    const rooms = await this.rooms
      .find({
        ashramId: { $in: rows.map((row) => row._id) },
        status: "active",
        deletedAt: null,
        ...(query.guests ? { capacity: { $gte: query.guests } } : {}),
      })
      .select(
        "ashramId name type acType capacity totalInventory basePrice amenities",
      )
      .lean();
    const inventoryRows = dates.length
      ? await this.inventory
          .find({
            roomId: { $in: rooms.map((room: any) => room._id) },
            date: { $in: dates },
          })
          .lean()
      : [];
    const inventoryByRoomAndDate = new Map(
      inventoryRows.map((entry: any) => [
        `${entry.roomId}|${new Date(entry.date).toISOString().slice(0, 10)}`,
        entry,
      ]),
    );
    const roomsByAshram = new Map<string, any[]>();
    for (const room of rooms as any[]) {
      const key = String(room.ashramId);
      roomsByAshram.set(key, [...(roomsByAshram.get(key) ?? []), room]);
    }

    return rows.map((row) => {
      const ashramRooms = roomsByAshram.get(String(row._id)) ?? [];
      const availableRooms = ashramRooms.reduce((sum, room) => {
        if (!dates.length) return sum + Number(room.totalInventory ?? 0);
        const minimum = Math.min(
          ...dates.map((date) => {
            const inventory: any = inventoryByRoomAndDate.get(
              `${room._id}|${date.toISOString().slice(0, 10)}`,
            );
            if (inventory?.isClosed) return 0;
            return Math.max(
              0,
              Number(room.totalInventory ?? 0) -
                Number(inventory?.bookedCount ?? 0) -
                Number(inventory?.heldCount ?? 0) -
                Number(inventory?.maintenanceCount ?? 0),
            );
          }),
        );
        return sum + (Number.isFinite(minimum) ? minimum : 0);
      }, 0);
      const roomTypes = [...new Set(ashramRooms.map((room) => room.type))];
      const roomAmenities = [
        ...new Set(ashramRooms.flatMap((room) => room.amenities ?? [])),
      ];
      const spiritualActivities = (row.activities ?? []).filter((activity: any) =>
        /aarti|arati|darshan|pooja|puja|prayer/i.test(String(activity)),
      );
      const foodAvailable = Boolean(
        row.food?.foodType ||
          row.food?.prasadDetails ||
          row.food?.mealTimings?.breakfast ||
          (row.amenities ?? []).some((amenity: any) =>
            /food|meal|prasad|kitchen/i.test(String(amenity)),
          ),
      );
      const parkingAvailable = Boolean(
        row.transport?.parkingAvailable ||
          (row.amenities ?? []).some((amenity: any) =>
            /parking/i.test(String(amenity)),
          ),
      );

      return {
        ...row,
        discovery: {
          distanceKm:
            row.distanceKm == null ? null : round2(Number(row.distanceKm)),
          isNearby: Boolean(row.isNearby),
          bookingAvailability: {
            checkedForDates: dates.length > 0,
            available: availableRooms > 0,
            availableRooms,
            checkIn: query.checkIn ?? null,
            checkOut: query.checkOut ?? null,
          },
          rooms: {
            categories: ashramRooms.length,
            totalInventory: ashramRooms.reduce(
              (sum, room) => sum + Number(room.totalInventory ?? 0),
              0,
            ),
            types: roomTypes,
            hasAc: ashramRooms.some((room) => room.acType === "AC"),
            amenities: roomAmenities.slice(0, 8),
          },
          parking: { available: parkingAvailable },
          food: {
            available: foodAvailable,
            type: row.food?.foodType ?? "",
            mealTimings: row.food?.mealTimings ?? {},
            prasadDetails: row.food?.prasadDetails ?? "",
          },
          spiritualSchedule: {
            dailySchedule: row.dailySchedule ?? "",
            activities: spiritualActivities.slice(0, 6),
          },
        },
      };
    });
  }

  async publicList(query: AshramQueryDto): Promise<any> {
    const filter: Record<string, any> = { status: "approved", deletedAt: null };
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
    const search =
      query.destination || query.query || query.category || query.search;
    if (search) {
      const value = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [
        { name: value },
        { description: value },
        { history: value },
        { "address.city": value },
        { "address.district": value },
        { "address.state": value },
        { amenities: value },
      ];
    }
    if (query.type) {
      const requestedTypes = [
        ...new Set(
          query.type
            .split(",")
            .map((type) => type.trim().toLowerCase())
            .map((type) => (type === "temple" ? "homestay" : type))
            .filter((type) => ["ashram", "dharamshala", "homestay"].includes(type)),
        ),
      ];
      const legacyPatterns: Record<string, RegExp> = {
        ashram: /ashram|retreat|monastery/i,
        dharamshala: /dharam|dharma/i,
        homestay: /home\s*stay|guest\s*house|rest\s*house|temple\s*trust\s*stay/i,
      };
      const patterns = requestedTypes.map((type) => legacyPatterns[type]);
      if (patterns.length) {
        filter.$and = [
          ...(filter.$and ?? []),
          {
            $or: [
              { ashramType: { $in: patterns } },
              {
                $and: [
                  { $or: [{ ashramType: { $exists: false } }, { ashramType: "" }] },
                  { name: { $in: patterns } },
                ],
              },
            ],
          },
        ];
      }
    }
    if (query.amenities)
      filter.amenities = {
        $all: query.amenities
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      };
    if (query.rating != null) filter["rating.average"] = { $gte: query.rating };
    const hasLatitude = query.latitude != null;
    const hasLongitude = query.longitude != null;
    if (hasLatitude !== hasLongitude)
      throw new BadRequestException(
        "Latitude and longitude must be provided together",
      );

    let nearbyCount = 0;
    let detectedArea: Record<string, string> | null = null;
    let candidates: any[];
    if (hasLatitude && hasLongitude) {
      const radiusKm = query.radiusKm ?? 100;
      const sentinel = [77.209, 28.613];
      const geocodedFilter = {
        $and: [
          filter,
          {
            $or: [
              { "address.coordinates.coordinates": { $ne: sentinel } },
              { "address.city": { $regex: /^(new\s+)?delhi$/i } },
            ],
          },
        ],
      };
      const nearby = await this.ashrams.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [Number(query.longitude), Number(query.latitude)],
            },
            key: "address.coordinates",
            distanceField: "distanceMeters",
            maxDistance: radiusKm * 1000,
            spherical: true,
            query: geocodedFilter,
          },
        },
        { $sort: { distanceMeters: 1, "rating.average": -1 } },
        { $limit: 500 },
      ]);
      const nearbyIds = new Set(nearby.map((row: any) => String(row._id)));
      const remaining = await this.ashrams
        .find({ ...filter, _id: { $nin: [...nearbyIds] } })
        .sort({ "rating.average": -1, "rating.count": -1, name: 1 })
        .lean();
      const rankedNearby = nearby.map((row: any) => ({
        ...row,
        distanceKm: Number(row.distanceMeters ?? 0) / 1000,
        isNearby: true,
      }));
      nearbyCount = rankedNearby.length;
      const closest = rankedNearby[0];
      if (closest?.address)
        detectedArea = {
          city: String(closest.address.city ?? ""),
          district: String(closest.address.district ?? ""),
          state: String(closest.address.state ?? ""),
        };
      candidates = [
        ...rankedNearby,
        ...remaining.map((row: any) => ({
          ...row,
          distanceKm: null,
          isNearby: false,
        })),
      ];
    } else {
      candidates = await this.ashrams
        .find(filter)
        .sort({ "rating.average": -1, "rating.count": -1, name: 1 })
        .lean();
    }
    if (query.checkIn && query.checkOut) {
      const start = new Date(query.checkIn);
      const end = new Date(query.checkOut);
      if (start < end) {
        const dates: Date[] = [];
        for (
          let cursor = new Date(`${query.checkIn}T00:00:00.000Z`);
          cursor < end;
          cursor = new Date(cursor.getTime() + 86_400_000)
        )
          dates.push(cursor);
        const rooms = await this.rooms
          .find({
            ashramId: { $in: candidates.map((a: any) => a._id) },
            status: "active",
            deletedAt: null,
            ...(query.guests ? { capacity: { $gte: query.guests } } : {}),
          })
          .lean();
        const rows = await this.inventory
          .find({
            roomId: { $in: rooms.map((r: any) => r._id) },
            date: { $in: dates },
          })
          .lean();
        const key = new Map(
          rows.map((r: any) => [
            `${r.roomId}|${new Date(r.date).toISOString().slice(0, 10)}`,
            r,
          ]),
        );
        const available = new Map<string, number>();
        for (const room of rooms as any[]) {
          let total = 0;
          let ok = true;
          for (const date of dates) {
            const day: any = key.get(
              `${room._id}|${date.toISOString().slice(0, 10)}`,
            );
            if (
              day?.isClosed ||
              (day &&
                room.totalInventory -
                day.bookedCount -
                day.heldCount -
                day.maintenanceCount <
                1)
            ) {
              ok = false;
              break;
            }
            total += day?.customPrice ?? room.basePrice;
          }
          const average = dates.length ? total / dates.length : room.basePrice;
          if (
            ok &&
            (query.minPrice == null || average >= query.minPrice) &&
            (query.maxPrice == null || average <= query.maxPrice)
          ) {
            const prior = available.get(String(room.ashramId)) ?? Infinity;
            available.set(String(room.ashramId), Math.min(prior, average));
          }
        }
        const dateFiltered = candidates
          .filter((a: any) => available.has(String(a._id)))
          .map((a: any) => ({
            ...a,
            lowestNightPrice: available.get(String(a._id)),
          }));
        if (dateFiltered.length > 0) {
          candidates = dateFiltered;
        }
      }
    }
    const missingPrice = candidates.filter(
      (a: any) => a.lowestNightPrice == null,
    );
    if (missingPrice.length) {
      const rooms = await this.rooms
        .find({
          ashramId: { $in: missingPrice.map((a: any) => a._id) },
          status: "active",
          deletedAt: null,
        })
        .select("ashramId basePrice")
        .lean();
      const cheapest = new Map<string, number>();
      for (const room of rooms as any[]) {
        const key = String(room.ashramId);
        const prior = cheapest.get(key) ?? Infinity;
        cheapest.set(key, Math.min(prior, room.basePrice));
      }
      for (const a of missingPrice as any[]) {
        const price = cheapest.get(String(a._id));
        if (price != null && Number.isFinite(price)) {
          a.lowestNightPrice = price;
        } else if (a.pricing?.lowestNightPrice) {
          a.lowestNightPrice = a.pricing.lowestNightPrice;
        }
      }
    }
    nearbyCount = candidates.filter((row: any) => row.isNearby).length;
    const total = candidates.length;
    const pageRows = candidates.slice(
      (query.page - 1) * query.limit,
      query.page * query.limit,
    );
    const data = await this.enrichDiscoveryRows(pageRows, query);
    return {
      success: true,
      count: data.length,
      total,
      page: query.page,
      totalPages: Math.ceil(total / query.limit),
      discovery: {
        locationApplied: hasLatitude && hasLongitude,
        nearbyCount,
        radiusKm:
          hasLatitude && hasLongitude ? (query.radiusKm ?? 100) : null,
        detectedArea,
      },
      data,
    };
  }

  async detail(id: string): Promise<any> {
    const ashram = await this.ashrams
      .findOne({ _id: id, status: "approved", deletedAt: null })
      .lean();
    if (!ashram) throw new NotFoundException("Ashram not found");
    const [rooms, managedAddOns] = await Promise.all([
      this.rooms
        .find({ ashramId: id, status: "active", deletedAt: null })
        .lean(),
      this.addons.find({ ashramId: id, enabled: true }).lean(),
    ]);
    return {
      ashram: {
        ...ashram,
        addOnServices: managedAddOns.length
          ? managedAddOns
          : (ashram.addOnServices ?? []),
      },
      rooms,
    };
  }

  async managedDetail(user: AuthenticatedUser, id: string): Promise<any> {
    const ashram = await this.ashrams.findOne({ _id: id, deletedAt: null });
    if (!ashram) throw new NotFoundException("Ashram not found");
    this.assertScope(user, ashram);
    const rooms = await this.rooms
      .find({ ashramId: id, deletedAt: null })
      .lean();
    return { ashram: ashram.toObject(), rooms };
  }

  async destinations(): Promise<
    { city: string; state: string; count: number }[]
  > {
    return this.ashrams.aggregate([
      {
        $match: {
          deletedAt: null,
          "address.city": { $nin: [null, ""] },
        },
      },
      {
        $group: {
          _id: { $toLower: "$address.city" },
          city: { $first: "$address.city" },
          state: { $first: "$address.state" },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, city: 1, state: 1, count: 1 } },
      { $sort: { city: 1 } },
    ]);
  }

  async byDestination(city: string): Promise<any[]> {
    const name = String(city ?? "").trim();
    if (!name) return [];
    return this.ashrams
      .find({
        deletedAt: null,
        "address.city": {
          $regex: `^${escapeRegex(name)}$`,
          $options: "i",
        },
      })
      .select("name slug address.city address.state status isVerified")
      .sort({ name: 1 })
      .lean();
  }

  async listForUser(user: AuthenticatedUser): Promise<any[]> {
    const scope = await resolveAshramScope(user, this.ashrams);
    if (isUnrestricted(scope))
      return this.ashrams.find({ deletedAt: null }).sort({ createdAt: -1 });
    if (!scope.length) return [];
    return this.ashrams
      .find({ _id: { $in: scope }, deletedAt: null })
      .sort({ createdAt: -1 });
  }

  assertScope(user: AuthenticatedUser, ashram: any): void {
    if (!ashram) throw new NotFoundException("Ashram not found");
    if (canManageAllAshrams(user)) return;
    if (String(ashram.ownerId) === user.id) return;
    if (assignedAshramIds(user).includes(String(ashram._id))) return;
    throw new ForbiddenException("You do not have access to this ashram.");
  }

  async create(user: AuthenticatedUser, dto: SaveAshramDto): Promise<any> {
    assertNoInlineMedia(dto);
    const { rooms = [], ...payload } = dto;
    payload.address = normalizeAshramAddress(payload.address, payload as any);
    assertCompleteAddress(payload.address);
    const legalIdentifiers = [
      ["trust.trustRegNo", payload.trust?.trustRegNo],
      ["trust.panNo", payload.trust?.panNo],
    ].filter(([, value]) => String(value ?? "").trim());
    for (const [field, raw] of legalIdentifiers) {
      if (
        await this.ashrams.exists({
          [field as string]: String(raw).trim(),
          deletedAt: null,
        })
      )
        throw new ConflictException(
          `${field === "trust.panNo" ? "PAN" : "Trust registration number"} is already registered`,
        );
    }
    const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const city = citySlug(payload.address?.city ?? "") || "india";
    const ashram = await this.ashrams.create({
      ...payload,
      description:
        payload.description?.trim() ||
        "Spiritual Ashram lodging & accommodation.",
      ownerId: user.id,
      createdBy: user.id,
      ashramCode: `ASH-${suffix}`,
      citySlug: city,
      slug: await this.slugs.allocate(payload.name, city),
      status: "pending_docs",
    });
    const validTypes = ["dormitory", "private_room", "family_room", "hall"];
    const roomDocs = rooms
      .filter((room: any) => room?.name?.trim())
      .map((room: any) => ({
        ashramId: ashram._id,
        name: room.name.trim(),
        type: validTypes.includes(room.type) ? room.type : "private_room",
        acType: ["ac", "a/c"].includes(String(room.acType).toLowerCase())
          ? "AC"
          : "Non-AC",
        capacity: Number.parseInt(room.capacity, 10) || 1,
        totalInventory: Number.parseInt(room.totalInventory, 10) || 1,
        basePrice: Number.parseFloat(room.basePrice) || 0,
        amenities:
          typeof room.amenities === "string"
            ? room.amenities
              .split(",")
              .map((x: string) => x.trim())
              .filter(Boolean)
            : (room.amenities ?? []),
        status: "active",
      }));
    if (roomDocs.length) await this.rooms.insertMany(roomDocs);
    return { ashram, roomsCreated: roomDocs.length };
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: Partial<SaveAshramDto>,
  ): Promise<any> {
    assertNoInlineMedia(dto);
    const ashram = await this.ashrams.findById(id);
    if (!ashram) throw new NotFoundException("Ashram not found");
    this.assertScope(user, ashram);
    const slugBefore = { name: ashram.name, city: ashram.address?.city };
    for (const [field, raw] of [
      ["trust.trustRegNo", dto.trust?.trustRegNo],
      ["trust.panNo", dto.trust?.panNo],
    ]) {
      const value = String(raw ?? "").trim();
      if (
        value &&
        (await this.ashrams.exists({
          _id: { $ne: id },
          [field as string]: value,
          deletedAt: null,
        }))
      )
        throw new ConflictException(
          `${field === "trust.panNo" ? "PAN" : "Trust registration number"} is already registered`,
        );
    }
    const payload = { ...dto };
    delete payload.rooms;
    if (payload.address) {
      payload.address = normalizeAshramAddress(
        payload.address,
        ashram.address?.toObject?.() ?? ashram.address ?? {},
      );
      assertCompleteAddress(payload.address);
    }
    Object.assign(ashram, payload, { updatedBy: user.id });
    await ashram.save();
    if (
      ashram.name !== slugBefore.name ||
      ashram.address?.city !== slugBefore.city
    )
      await this.slugs.syncSlug(ashram);
    return ashram;
  }

  async saveDocuments(
    user: AuthenticatedUser,
    id: string,
    body: AshramDocumentsDto,
  ): Promise<{ documents: any; status: string; reopened: boolean }> {
    assertNoInlineMedia({ documents: body });
    const ashram = await this.ashrams.findOne({ _id: id, deletedAt: null });
    if (!ashram) throw new NotFoundException("Ashram not found");
    this.assertScope(user, ashram);
    ashram.documents = {
      ...(ashram.documents?.toObject?.() ?? ashram.documents ?? {}),
      ...body,
    };
    const reopened = ashram.status === "rejected";
    if (reopened) {
      ashram.status = "pending_docs";
      ashram.rejectionReason = "";
    }
    ashram.updatedBy = user.id;
    await ashram.save();
    return { documents: ashram.documents, status: ashram.status, reopened };
  }

  listAddOns(ashramId: string): Promise<any[]> {
    return this.addons.find({ ashramId }).sort({ createdAt: 1 }).lean();
  }

  private async assertAddOnScope(
    user: AuthenticatedUser,
    ashramId: string,
  ): Promise<void> {
    const ashram = await this.ashrams.findOne({
      _id: ashramId,
      deletedAt: null,
    });
    this.assertScope(user, ashram);
  }

  async createAddOn(
    user: AuthenticatedUser,
    ashramId: string,
    body: SaveAddOnDto,
  ): Promise<any[]> {
    await this.assertAddOnScope(user, ashramId);
    await this.addons.create({ ...body, ashramId, createdBy: user.id });
    return this.listAddOns(ashramId);
  }

  async updateAddOn(
    user: AuthenticatedUser,
    ashramId: string,
    addonId: string,
    body: UpdateAddOnDto,
  ): Promise<any[]> {
    await this.assertAddOnScope(user, ashramId);
    const updated = await this.addons.findOneAndUpdate(
      { _id: addonId, ashramId },
      { $set: body },
      { new: true },
    );
    if (!updated) throw new NotFoundException("Add-on service not found");
    return this.listAddOns(ashramId);
  }

  async deleteAddOn(
    user: AuthenticatedUser,
    ashramId: string,
    addonId: string,
  ): Promise<any[]> {
    await this.assertAddOnScope(user, ashramId);
    const removed = await this.addons.deleteOne({ _id: addonId, ashramId });
    if (!removed.deletedCount)
      throw new NotFoundException("Add-on service not found");
    return this.listAddOns(ashramId);
  }

  async createRoom(user: AuthenticatedUser, dto: CreateRoomDto): Promise<any> {
    const ashram = await this.ashrams.findById(dto.ashramId);
    if (!ashram) throw new NotFoundException("Ashram not found");
    this.assertScope(user, ashram);
    return this.rooms.create(dto);
  }
  async updateRoom(
    user: AuthenticatedUser,
    id: string,
    dto: Partial<CreateRoomDto>,
  ): Promise<any> {
    const room = await this.rooms.findOne({ _id: id, deletedAt: null });
    if (!room) throw new NotFoundException("Room not found");
    const ashram = await this.ashrams.findById(room.ashramId);
    this.assertScope(user, ashram);
    const { ashramId: _ignored, ...received } = dto;
    void _ignored;

    const patch = Object.fromEntries(
      Object.entries(received).filter(([, value]) => value !== undefined),
    ) as Partial<CreateRoomDto>;

    if (patch.totalInventory !== undefined) {
      const inventoryDays = await this.inventory
        .find({ roomId: room._id })
        .select("bookedCount heldCount maintenanceCount")
        .lean();
      const committed = inventoryDays.reduce(
        (maximum: number, day: any) =>
          Math.max(
            maximum,
            Number(day.bookedCount ?? 0) +
              Number(day.heldCount ?? 0) +
              Number(day.maintenanceCount ?? 0),
          ),
        0,
      );
      if (patch.totalInventory < committed)
        throw new ConflictException(
          `Total units cannot be below ${committed}; that many units are already booked, held, or blocked on an inventory date.`,
        );
    }
    Object.assign(room, patch);
    await room.save();
    if (patch.totalInventory !== undefined)
      await this.inventory.updateMany(
        { roomId: room._id },
        { $set: { totalInventory: room.totalInventory } },
      );
    return room;
  }

  async deleteRoom(user: AuthenticatedUser, id: string): Promise<any> {
    const room = await this.rooms.findOne({ _id: id, deletedAt: null });
    if (!room) throw new NotFoundException("Room not found");
    const ashram = await this.ashrams.findById(room.ashramId);
    this.assertScope(user, ashram);

    const liveBookings = await this.bookings.countDocuments({
      roomId: room._id,
      status: { $in: ["pending", "confirmed", "checked_in"] },
    });
    if (liveBookings > 0)
      throw new ConflictException(
        `This room has ${liveBookings} active booking(s). Cancel or complete them before removing it.`,
      );

    room.deletedAt = new Date();
    room.status = "under_maintenance";
    await room.save();
    return { deleted: true, roomId: String(room._id) };
  }

  async setAvailability(
    user: AuthenticatedUser,
    roomId: string,
    dto: RoomAvailabilityDto,
  ): Promise<any> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException("Room not found");
    const ashram = await this.ashrams.findById(room.ashramId);
    this.assertScope(user, ashram);
    const date = new Date(`${dto.date}T00:00:00.000Z`);
    const existing = await this.inventory.findOne({ roomId, date }).lean();
    const committed =
      Number(existing?.bookedCount ?? 0) + Number(existing?.heldCount ?? 0);
    if (committed + dto.maintenanceCount > room.totalInventory)
      throw new ConflictException(
        `Only ${Math.max(0, room.totalInventory - committed)} unit(s) can be blocked; the rest are already booked or held.`,
      );
    return this.inventory.findOneAndUpdate(
      { roomId, date },
      {
        $set: {
          totalInventory: room.totalInventory,
          maintenanceCount: dto.maintenanceCount,
          customPrice: dto.customPrice,
        },
        $setOnInsert: {
          ashramId: room.ashramId,
          roomId,
          date,
          heldCount: 0,
          bookedCount: 0,
        },
      },
      { upsert: true, new: true },
    );
  }

  async publicCalendar(
    roomId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const rows = await this.buildCalendar(roomId, startDate, endDate);
    return rows.map((row) => ({
      date: row.date,
      price: row.price,
      available: row.available,
      isClosed: row.isClosed,
    }));
  }

  async calendar(
    user: AuthenticatedUser,
    roomId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException("Room not found");
    const ashram = await this.ashrams.findById(room.ashramId);
    this.assertScope(user, ashram);
    return this.buildCalendar(roomId, startDate, endDate);
  }

  private async buildCalendar(
    roomId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException("Room not found");
    const start = startDate ? new Date(startDate) : new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = endDate
      ? new Date(endDate)
      : new Date(start.getTime() + 30 * 86_400_000);
    const rows = await this.inventory
      .find({ roomId, date: { $gte: start, $lte: end } })
      .lean();
    const map = new Map(
      rows.map((row: any) => [
        new Date(row.date).toISOString().slice(0, 10),
        row,
      ]),
    );
    const calendar: any[] = [];
    for (
      let date = start;
      date <= end;
      date = new Date(date.getTime() + 86_400_000)
    ) {
      const key = date.toISOString().slice(0, 10);
      const row: any = map.get(key);
      const rule = room.pricingRules?.find(
        (r: any) =>
          date >= new Date(r.startDate) && date <= new Date(r.endDate),
      );
      const price =
        row?.customPrice ??
        rule?.overridePrice ??
        room.basePrice * (rule?.multiplier ?? 1);
      const booked = Number(row?.bookedCount ?? 0);
      const held = Number(row?.heldCount ?? 0);
      const maintenance = Number(row?.maintenanceCount ?? 0);
      const transferredFromOffline = Number(
        row?.transferredFromOfflineCount ?? 0,
      );
      // The booking engine reserves against the daily row's totalInventory, so
      // the calendar must read the same field or it under-reports capacity that
      // the owner moved across from their offline pool.
      const capacity = Number(row?.totalInventory ?? room.totalInventory ?? 0);
      calendar.push({
        date: key,
        price,
        booked,
        held,
        maintenance,
        capacity,
        baseInventory: Number(room.totalInventory ?? 0),
        transferredFromOffline,
        available: Math.max(0, capacity - booked - held - maintenance),
        isClosed: Boolean(row?.isClosed),
      });
    }
    return calendar;
  }
}
