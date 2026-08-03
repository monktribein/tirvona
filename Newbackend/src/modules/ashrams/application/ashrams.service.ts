import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type {
  AshramQueryDto,
  CreateRoomDto,
  RoomAvailabilityDto,
  SaveAshramDto,
} from "../presentation/dtos/ashram.dto";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "ashram";

@Injectable()
export class AshramsService {
  constructor(
    @InjectModel("Ashram") readonly ashrams: Model<any>,
    @InjectModel("Room") readonly rooms: Model<any>,
    @InjectModel("BookingInventory") readonly inventory: Model<any>,
    @InjectModel("BookingAddon") readonly addons: Model<any>,
  ) { }

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
      const value = { $regex: escapeRegex(query.type), $options: "i" };
      filter.$and = [
        ...(filter.$and ?? []),
        {
          $or: [{ ashramType: value }, { name: value }, { description: value }],
        },
      ];
    }
    if (query.amenities)
      filter.amenities = {
        $all: query.amenities
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      };
    if (query.rating != null) filter["rating.average"] = { $gte: query.rating };
    let candidates = await this.ashrams
      .find(filter)
      .sort({ "rating.average": -1 })
      .lean();
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
                day.totalInventory -
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
        candidates = candidates
          .filter((a: any) => available.has(String(a._id)))
          .map((a: any) => ({
            ...a,
            lowestNightPrice: available.get(String(a._id)),
          }));
      }
    }
    // For candidates without a date-derived price (the common browse case),
    // attach the lowest active-room basePrice so listings show a real
    // per-night price instead of the default pricing.lowestNightPrice (often 0).
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
    const total = candidates.length;
    const data = candidates.slice(
      (query.page - 1) * query.limit,
      query.page * query.limit,
    );
    return {
      success: true,
      count: data.length,
      total,
      page: query.page,
      totalPages: Math.ceil(total / query.limit),
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
        // New owner-managed records are authoritative. Embedded records remain
        // available for ashrams created before the catalog was introduced.
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

  assertScope(user: AuthenticatedUser, ashram: any): void {
    if (!ashram) throw new NotFoundException("Ashram not found");
    if (user.role === "super_admin") return;
    if (String(ashram.ownerId) === user.id) return;
    if (
      user.employerAshramId === String(ashram._id) ||
      user.scopedAshramIds.includes(String(ashram._id))
    )
      return;
    throw new ForbiddenException("You do not have access to this ashram.");
  }

  async create(user: AuthenticatedUser, dto: SaveAshramDto): Promise<any> {
    const { rooms = [], ...payload } = dto;
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
    const ashram = await this.ashrams.create({
      ...payload,
      description:
        payload.description?.trim() ||
        "Spiritual Ashram lodging & accommodation.",
      ownerId: user.id,
      createdBy: user.id,
      ashramCode: `ASH-${suffix}`,
      slug: `${slugify(payload.name)}-${suffix.toLowerCase()}`,
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
    const ashram = await this.ashrams.findById(id);
    if (!ashram) throw new NotFoundException("Ashram not found");
    this.assertScope(user, ashram);
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
    Object.assign(ashram, payload, { updatedBy: user.id });
    await ashram.save();
    return ashram;
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
    const room = await this.rooms.findById(id);
    if (!room) throw new NotFoundException("Room not found");
    const ashram = await this.ashrams.findById(room.ashramId);
    this.assertScope(user, ashram);
    Object.assign(room, dto);
    await room.save();
    return room;
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
    return this.inventory.findOneAndUpdate(
      { roomId, date },
      {
        $set: {
          maintenanceCount: dto.maintenanceCount,
          customPrice: dto.customPrice,
        },
        $setOnInsert: {
          ashramId: room.ashramId,
          roomId,
          date,
          totalInventory: room.totalInventory,
          heldCount: 0,
          bookedCount: 0,
        },
      },
      { upsert: true, new: true },
    );
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
      calendar.push({
        date: key,
        price,
        booked,
        held,
        maintenance,
        available: Math.max(
          0,
          room.totalInventory - booked - held - maintenance,
        ),
        isClosed: Boolean(row?.isClosed),
      });
    }
    return calendar;
  }
}
