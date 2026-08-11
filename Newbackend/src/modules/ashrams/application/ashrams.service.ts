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

/**
 * Inline base64 media belongs to no listing. One such image makes its ashram
 * roughly twenty times larger than the rest and pushes a listing query past
 * the client's request timeout, so media references must be links.
 */
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
    /** Read-only: guards a room category against removal while it is in use. */
    @InjectModel("Booking") readonly bookings: Model<any>,
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

  /**
   * The distinct destinations that currently hold at least one live ashram.
   *
   * Aggregated from `address.city` instead of a hard-coded list so the picker
   * can never offer a destination with nothing bookable in it. Grouped
   * case-insensitively — "haridwar" and "Haridwar" are one destination — while
   * the label keeps the spelling the listings actually use.
   */
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

  /**
   * The ashrams in one destination, projected to what a picker needs.
   *
   * Matched case-insensitively and anchored, so "Haridwar" cannot also pull in
   * a differently-cased or partially-matching city.
   */
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

  /**
   * Every ashram the caller may operate on. Staff reach ashrams through either
   * `scopedAshramIds` or the single `employerAshramId`, so both are honoured —
   * the same pair `assertScope` accepts on a write.
   */
  async listForUser(user: AuthenticatedUser): Promise<any[]> {
    if (user.role === "super_admin")
      return this.ashrams.find({ deletedAt: null }).sort({ createdAt: -1 });
    if (user.role === "owner")
      return this.ashrams
        .find({ ownerId: user.id, deletedAt: null })
        .sort({ createdAt: -1 });
    const ids = [
      ...new Set([
        ...(user.scopedAshramIds ?? []),
        ...(user.employerAshramId ? [user.employerAshramId] : []),
      ]),
    ];
    if (!ids.length) return [];
    return this.ashrams
      .find({ _id: { $in: ids }, deletedAt: null })
      .sort({ createdAt: -1 });
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
    assertNoInlineMedia(dto);
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
    assertNoInlineMedia(dto);
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

  /**
   * Storing KYC documents also re-opens a rejected application: the government
   * queue only lists `pending_docs` / `pending_inspection`, so without this a
   * rejected ashram could never be reviewed again.
   */
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
    // `ashramId` is never taken from the payload: a room's availability,
    // bookings and inventory are all keyed to its ashram, so re-parenting it
    // would orphan them. Everything else is applied as sent.
    const { ashramId: _ignored, ...patch } = dto;
    void _ignored;
    Object.assign(room, patch);
    await room.save();
    return room;
  }

  /**
   * Retire a room category.
   *
   * Soft delete, because bookings, inventory rows and availability records
   * carry a required reference to the room and a printed invoice must still
   * resolve what was booked. The room leaves every listing either way.
   *
   * Refused while a stay is still live against it — a guest holding a
   * confirmed reservation would otherwise find their room category gone.
   */
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

  /**
   * The same calendar a visitor may see, without the operational breakdown.
   *
   * A pilgrim needs the nightly price and whether a room is free; how that
   * splits between held, booked and maintenance is the owner's business. This
   * exists because the detail page has no other readable source — the
   * owner-only `calendar()` 403s for a visitor — and without it the page fell
   * back to a calendar generated with Math.random(), which showed genuinely
   * free nights as "Sold Out".
   */
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
