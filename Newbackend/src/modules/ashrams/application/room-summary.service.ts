import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  assertAshramInScope,
  isUnrestricted,
  resolveAshramScope,
  type AshramScope,
} from "../../../common/auth/ashram-scope";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { escapeRegex } from "../../../common/utils/escape-regex";
import type { RoomSummaryQueryDto } from "../presentation/dtos/room-summary.dto";

/**
 * A Room row is a *category* holding a unit count, not one physical room, and
 * the platform runs two separate pools against it:
 *
 *  - the online pool, Room.totalInventory, which Tirvona sells; and
 *  - the offline pool, OfflineRoom.totalUnits, which the desk keeps back for
 *    walk-ins and which only becomes sellable once the owner transfers units
 *    across, at which point the transfer *adds* to that day's totalInventory.
 *
 * The two therefore never overlap, so the estate total is their sum. Every
 * occupancy figure below is a property of one night rather than of the estate,
 * and is read from the BookingInventory row for that night using the same
 * formula the availability calendar uses.
 */

const DAY_MS = 86_400_000;

export interface RoomSummaryRow {
  roomId: string;
  name: string;
  ashramId: string;
  ashramName: string;
  type: string;
  acType: string;
  guestCapacity: number;
  status: string;
  registeredUnits: number;
  capacity: number;
  booked: number;
  held: number;
  maintenance: number;
  occupied: number;
  blocked: number;
  available: number;
  isClosed: boolean;
  transferredFromOffline: number;
  offlineTotal: number;
  offlineBlocked: number;
  offlineTransferred: number;
  offlineAvailable: number;
  hasInventoryRow: boolean;
}

export interface RoomSummaryTotals {
  roomCategories: number;
  registeredRooms: number;
  offlineRooms: number;
  totalRooms: number;
  onlineRooms: number;
  bookedRooms: number;
  heldRooms: number;
  occupiedRooms: number;
  blockedRooms: number;
  availableRooms: number;
  occupancyRate: number;
}

export interface RoomSummary {
  date: string;
  filters: { ashrams: { id: string; name: string }[]; unrestricted: boolean };
  totals: RoomSummaryTotals;
  rooms: RoomSummaryRow[];
}

const midnight = (value: string): Date => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()))
    throw new BadRequestException("Invalid date supplied");
  return date;
};

const today = (): Date => midnight(new Date().toISOString().slice(0, 10));

const count = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

@Injectable()
export class RoomSummaryService {
  constructor(
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("Room") private readonly rooms: Model<any>,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("BookingInventory") private readonly inventory: Model<any>,
    @InjectModel("OfflineRoom") private readonly offlineRooms: Model<any>,
  ) {}

  async summary(
    user: AuthenticatedUser,
    query: RoomSummaryQueryDto,
  ): Promise<RoomSummary> {
    const scope = await resolveAshramScope(user, this.ashrams);
    if (query.ashramId) assertAshramInScope(scope, query.ashramId);

    const date = query.date ? midnight(query.date) : today();
    const ashramFilter = this.ashramFilter(scope, query.ashramId);

    const rooms = await this.rooms
      .find({ ...ashramFilter, ...this.roomFilter(query) })
      .populate("ashramId", "name")
      .sort({ name: 1 })
      .lean();

    const visibleAshrams = await this.ashrams
      .find({ ...this.ashramFilter(scope), deletedAt: null })
      .select("name")
      .sort({ name: 1 })
      .lean();

    const roomIds = (rooms as any[]).map((room) => room._id);
    const [inventoryRows, offlineRows, occupiedByRoom] = await Promise.all([
      roomIds.length
        ? this.inventory.find({ roomId: { $in: roomIds }, date }).lean()
        : Promise.resolve([]),
      roomIds.length
        ? this.offlineRooms
            .find({ roomId: { $in: roomIds }, deletedAt: null })
            .lean()
        : Promise.resolve([]),
      this.occupiedUnits(ashramFilter, date),
    ]);

    const inventoryByRoom = new Map(
      (inventoryRows as any[]).map((row) => [String(row.roomId), row]),
    );
    const offlineByRoom = new Map<string, any[]>();
    for (const row of offlineRows as any[]) {
      const key = String(row.roomId);
      offlineByRoom.set(key, [...(offlineByRoom.get(key) ?? []), row]);
    }

    const summarised = (rooms as any[]).map((room) =>
      this.buildRow(
        room,
        inventoryByRoom.get(String(room._id)),
        offlineByRoom.get(String(room._id)) ?? [],
        occupiedByRoom.get(String(room._id)) ?? 0,
      ),
    );

    return {
      date: date.toISOString().slice(0, 10),
      filters: {
        ashrams: (visibleAshrams as any[]).map((row) => ({
          id: String(row._id),
          name: String(row.name ?? ""),
        })),
        unrestricted: isUnrestricted(scope),
      },
      totals: this.totals(summarised),
      rooms: summarised,
    };
  }

  private ashramFilter(
    scope: AshramScope,
    ashramId?: string,
  ): Record<string, unknown> {
    if (ashramId) return { ashramId };
    return isUnrestricted(scope) ? {} : { ashramId: { $in: scope } };
  }

  private roomFilter(query: RoomSummaryQueryDto): Record<string, unknown> {
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.type && query.type !== "all") filter.type = query.type;
    if (query.acType && query.acType !== "all") filter.acType = query.acType;
    if (query.status && query.status !== "all") filter.status = query.status;
    const search = query.search?.trim();
    if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };
    return filter;
  }

  /**
   * Units belonging to guests physically in-house on this night. A stay counts
   * from its check-in date up to, but not including, its check-out date, so a
   * guest leaving on the selected morning no longer holds a room that night.
   */
  private async occupiedUnits(
    ashramFilter: Record<string, unknown>,
    date: Date,
  ): Promise<Map<string, number>> {
    const rows = await this.bookings
      .find({
        ...ashramFilter,
        status: "checked_in",
        checkInDate: { $lt: new Date(date.getTime() + DAY_MS) },
        checkOutDate: { $gt: date },
      })
      .select("rooms")
      .lean();

    const occupied = new Map<string, number>();
    for (const booking of rows as any[])
      for (const room of booking.rooms ?? []) {
        const key = String(room.roomId);
        occupied.set(key, (occupied.get(key) ?? 0) + count(room.units));
      }
    return occupied;
  }

  private buildRow(
    room: any,
    inventory: any,
    offline: any[],
    occupied: number,
  ): RoomSummaryRow {
    const registeredUnits = count(room.totalInventory);
    // The booking engine reserves against the day's own totalInventory, which
    // already carries any units transferred across from the offline pool, so
    // reading room.totalInventory here would under-report that capacity.
    const capacity = inventory
      ? count(inventory.totalInventory)
      : registeredUnits;
    const booked = count(inventory?.bookedCount);
    const held = count(inventory?.heldCount);
    const maintenance = count(inventory?.maintenanceCount);
    const isClosed = Boolean(inventory?.isClosed);
    const underMaintenance = room.status === "under_maintenance";
    const sellsNothing = isClosed || underMaintenance;

    const activeOffline = offline.filter((row) => row.status === "active");
    const offlineTotal = activeOffline.reduce(
      (sum, row) => sum + count(row.totalUnits),
      0,
    );
    const offlineBlocked = activeOffline.reduce(
      (sum, row) => sum + count(row.blockedUnits),
      0,
    );
    const offlineTransferred = activeOffline.reduce(
      (sum, row) => sum + count(row.transferredUnits),
      0,
    );

    // A category closed for the night, or flagged under maintenance, sells
    // nothing at all, so its whole capacity reads as blocked rather than free.
    return {
      roomId: String(room._id),
      name: String(room.name ?? ""),
      ashramId: String(room.ashramId?._id ?? room.ashramId ?? ""),
      ashramName: String(room.ashramId?.name ?? ""),
      type: String(room.type ?? ""),
      acType: String(room.acType ?? ""),
      guestCapacity: count(room.capacity),
      status: String(room.status ?? "active"),
      registeredUnits,
      capacity,
      booked,
      held,
      maintenance,
      occupied,
      blocked: sellsNothing
        ? capacity + offlineBlocked
        : maintenance + offlineBlocked,
      available: sellsNothing
        ? 0
        : Math.max(0, capacity - booked - held - maintenance),
      isClosed,
      transferredFromOffline: count(inventory?.transferredFromOfflineCount),
      offlineTotal,
      offlineBlocked,
      offlineTransferred,
      offlineAvailable: Math.max(
        0,
        offlineTotal - offlineTransferred - offlineBlocked,
      ),
      hasInventoryRow: Boolean(inventory),
    };
  }

  private totals(rows: RoomSummaryRow[]): RoomSummaryTotals {
    const sum = (pick: (row: RoomSummaryRow) => number): number =>
      rows.reduce((total, row) => total + pick(row), 0);

    const registeredRooms = sum((row) => row.registeredUnits);
    const offlineRooms = sum((row) => row.offlineTotal);
    const onlineRooms = sum((row) =>
      row.isClosed || row.status === "under_maintenance" ? 0 : row.capacity,
    );
    const bookedRooms = sum((row) => row.booked);

    return {
      roomCategories: rows.length,
      registeredRooms,
      offlineRooms,
      totalRooms: registeredRooms + offlineRooms,
      onlineRooms,
      bookedRooms,
      heldRooms: sum((row) => row.held),
      occupiedRooms: sum((row) => row.occupied),
      blockedRooms: sum((row) => row.blocked),
      availableRooms: sum((row) => row.available),
      occupancyRate: onlineRooms
        ? Math.round((bookedRooms / onlineRooms) * 1000) / 10
        : 0,
    };
  }
}
