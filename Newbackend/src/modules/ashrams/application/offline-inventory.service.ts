import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { randomBytes } from "node:crypto";
import { TransactionService } from "../../../common/database/transaction.service";
import {
  assertAshramInScope,
  isUnrestricted,
  resolveAshramScope,
  type AshramScope,
} from "../../../common/auth/ashram-scope";
import { canManageAllAshrams } from "../../../common/auth/ashram-access";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type {
  OfflineRoomQueryDto,
  OfflineTransferHistoryQueryDto,
  SaveOfflineRoomDto,
  TransferOfflineInventoryDto,
  UpdateOfflineRoomDto,
} from "../presentation/dtos/offline-inventory.dto";

const MANAGING_ROLES = ["ashram_owner", "owner", "manager"];

const eachNight = (start: Date, end: Date): Date[] => {
  const dates: Date[] = [];
  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor = new Date(cursor.getTime() + 86_400_000)
  )
    dates.push(new Date(cursor));
  return dates;
};

const midnight = (value: string): Date => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()))
    throw new BadRequestException("Invalid date supplied");
  return date;
};

export const offlineTransferReference = (): string =>
  `OFT-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;

@Injectable()
export class OfflineInventoryService {
  private readonly logger = new Logger(OfflineInventoryService.name);

  constructor(
    private readonly transactions: TransactionService,
    @InjectModel("OfflineRoom") private readonly offlineRooms: Model<any>,
    @InjectModel("OfflineInventoryTransfer")
    private readonly transfers: Model<any>,
    @InjectModel("BookingInventory") private readonly inventory: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("Room") private readonly rooms: Model<any>,
  ) {}

  private scope(user: AuthenticatedUser): Promise<AshramScope> {
    return resolveAshramScope(user, this.ashrams);
  }

  /**
   * Super Admin and Ashram Admin get a read-only window on to this data.
   * Only the ashram's own owner-side roles may create, edit or transfer.
   */
  canManageOfflineRooms(user: AuthenticatedUser): boolean {
    if (canManageAllAshrams(user)) return false;
    return MANAGING_ROLES.includes(user.role);
  }

  private assertCanManage(user: AuthenticatedUser): void {
    if (!this.canManageOfflineRooms(user))
      throw new ForbiddenException(
        "Offline rooms are managed by the ashram owner. You have read-only access.",
      );
  }

  private available(row: any): number {
    return Math.max(
      0,
      Number(row.totalUnits ?? 0) -
        Number(row.transferredUnits ?? 0) -
        Number(row.blockedUnits ?? 0),
    );
  }

  private decorate(row: any): any {
    return {
      ...row,
      availableUnits: this.available(row),
    };
  }

  async list(
    user: AuthenticatedUser,
    query: OfflineRoomQueryDto,
  ): Promise<any[]> {
    const scope = await this.scope(user);
    if (query.ashramId) assertAshramInScope(scope, query.ashramId);

    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.ashramId) filter.ashramId = query.ashramId;
    else if (!isUnrestricted(scope)) filter.ashramId = { $in: scope };
    if (query.roomId) filter.roomId = query.roomId;
    if (query.status && query.status !== "all") filter.status = query.status;

    const rows = await this.offlineRooms
      .find(filter)
      .populate("roomId", "name type totalInventory")
      .populate("ashramId", "name")
      .sort({ createdAt: -1 })
      .lean();
    return (rows as any[]).map((row) => this.decorate(row));
  }

  async summary(user: AuthenticatedUser, ashramId?: string): Promise<any> {
    const rows = await this.list(user, { ashramId } as OfflineRoomQueryDto);
    return {
      offlineRooms: rows.length,
      totalUnits: rows.reduce((sum, row) => sum + Number(row.totalUnits ?? 0), 0),
      availableUnits: rows.reduce(
        (sum, row) => sum + Number(row.availableUnits ?? 0),
        0,
      ),
      transferredUnits: rows.reduce(
        (sum, row) => sum + Number(row.transferredUnits ?? 0),
        0,
      ),
      blockedUnits: rows.reduce(
        (sum, row) => sum + Number(row.blockedUnits ?? 0),
        0,
      ),
      canManage: this.canManageOfflineRooms(user),
    };
  }

  async create(
    user: AuthenticatedUser,
    dto: SaveOfflineRoomDto,
  ): Promise<any> {
    this.assertCanManage(user);
    assertAshramInScope(await this.scope(user), dto.ashramId);

    const room = await this.rooms
      .findOne({ _id: dto.roomId, ashramId: dto.ashramId, deletedAt: null })
      .lean();
    if (!room)
      throw new BadRequestException(
        "That room type does not belong to this ashram",
      );
    if (Number(dto.blockedUnits ?? 0) > Number(dto.totalUnits))
      throw new BadRequestException(
        "Blocked units cannot exceed the total units",
      );

    const created = await this.offlineRooms.create({
      ashramId: dto.ashramId,
      roomId: dto.roomId,
      label: dto.label.trim(),
      totalUnits: dto.totalUnits,
      blockedUnits: dto.blockedUnits ?? 0,
      status: dto.status ?? "active",
      notes: dto.notes ?? "",
      createdBy: user.id,
      updatedBy: user.id,
    });
    return this.decorate(created.toObject());
  }

  private async ownedRoom(
    user: AuthenticatedUser,
    id: string,
    scope: AshramScope,
  ): Promise<any> {
    const row = await this.offlineRooms.findOne({ _id: id, deletedAt: null });
    if (!row) throw new NotFoundException("Offline room not found");
    assertAshramInScope(
      scope,
      row.ashramId,
      "You do not have access to this offline room.",
    );
    return row;
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateOfflineRoomDto,
  ): Promise<any> {
    this.assertCanManage(user);
    const row = await this.ownedRoom(user, id, await this.scope(user));

    const nextTotal = dto.totalUnits ?? row.totalUnits;
    const nextBlocked = dto.blockedUnits ?? row.blockedUnits;
    if (nextTotal < Number(row.transferredUnits ?? 0))
      throw new BadRequestException(
        `Total units cannot drop below the ${row.transferredUnits} already transferred to Tirvona`,
      );
    if (Number(nextBlocked) + Number(row.transferredUnits ?? 0) > nextTotal)
      throw new BadRequestException(
        "Blocked and transferred units together cannot exceed the total",
      );

    if (dto.label !== undefined) row.label = dto.label.trim();
    if (dto.totalUnits !== undefined) row.totalUnits = dto.totalUnits;
    if (dto.blockedUnits !== undefined) row.blockedUnits = dto.blockedUnits;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.notes !== undefined) row.notes = dto.notes;
    row.updatedBy = user.id;
    await row.save();
    return this.decorate(row.toObject());
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    this.assertCanManage(user);
    const row = await this.ownedRoom(user, id, await this.scope(user));
    if (Number(row.transferredUnits ?? 0) > 0)
      throw new BadRequestException(
        "This offline room has units transferred to Tirvona and cannot be removed",
      );
    row.deletedAt = new Date();
    row.updatedBy = user.id;
    await row.save();
  }

  async transferToTirvona(
    user: AuthenticatedUser,
    id: string,
    dto: TransferOfflineInventoryDto,
  ): Promise<any> {
    this.assertCanManage(user);
    const scope = await this.scope(user);
    const row = await this.ownedRoom(user, id, scope);

    if (row.status !== "active")
      throw new BadRequestException(
        "Only an active offline room can be transferred to Tirvona",
      );

    const available = this.available(row);
    if (dto.units > available)
      throw new BadRequestException(
        `Only ${available} offline unit(s) are available to transfer`,
      );

    const from = midnight(dto.fromDate);
    const to = midnight(dto.toDate);
    if (to < from)
      throw new BadRequestException("The end date must not precede the start date");
    const dates = eachNight(from, to);
    if (dates.length > 180)
      throw new BadRequestException("A transfer may span at most 180 nights");

    const room = await this.rooms.findById(row.roomId).lean();
    if (!room) throw new NotFoundException("Room type not found");

    return this.transactions.run(async (session) => {
      for (const date of dates) {
        await this.inventory.updateOne(
          { roomId: row.roomId, date },
          {
            $setOnInsert: {
              ashramId: row.ashramId,
              roomId: row.roomId,
              date,
              totalInventory: Number((room as any).totalInventory ?? 0),
              heldCount: 0,
              bookedCount: 0,
              maintenanceCount: 0,
            },
          },
          { upsert: true, session },
        );
        await this.inventory.updateOne(
          { roomId: row.roomId, date },
          {
            $inc: {
              totalInventory: dto.units,
              transferredFromOfflineCount: dto.units,
            },
          },
          { session },
        );
      }

      const before = available;
      row.transferredUnits = Number(row.transferredUnits ?? 0) + dto.units;
      row.updatedBy = user.id;
      await row.save({ session });
      const after = this.available(row);

      const [transfer] = await this.transfers.create(
        [
          {
            reference: offlineTransferReference(),
            ashramId: row.ashramId,
            offlineRoomId: row._id,
            roomId: row.roomId,
            units: dto.units,
            fromDate: from,
            toDate: to,
            datesCovered: dates.length,
            reason: dto.reason ?? "",
            performedBy: user.id,
            performedByRole: user.role,
            offlineAvailableBefore: before,
            offlineAvailableAfter: after,
          },
        ],
        { session },
      );

      this.logger.log(
        JSON.stringify({
          event: "inventory.offline_transferred_to_tirvona",
          reference: transfer.reference,
          ashramId: String(row.ashramId),
          offlineRoomId: String(row._id),
          units: dto.units,
          nights: dates.length,
          actorId: user.id,
        }),
      );

      return { transfer, offlineRoom: this.decorate(row.toObject()) };
    });
  }

  async history(
    user: AuthenticatedUser,
    query: OfflineTransferHistoryQueryDto,
  ): Promise<any[]> {
    const scope = await this.scope(user);
    if (query.ashramId) assertAshramInScope(scope, query.ashramId);

    const filter: Record<string, unknown> = {};
    if (query.ashramId) filter.ashramId = query.ashramId;
    else if (!isUnrestricted(scope)) filter.ashramId = { $in: scope };
    if (query.offlineRoomId) filter.offlineRoomId = query.offlineRoomId;

    return this.transfers
      .find(filter)
      .populate("offlineRoomId", "label")
      .populate("roomId", "name type")
      .populate("ashramId", "name")
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(query.limit ?? 50)
      .lean();
  }
}
