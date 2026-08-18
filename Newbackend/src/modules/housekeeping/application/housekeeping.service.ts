import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams, isAshramOwner } from "../../../common/auth/ashram-access";
import type { UpdateHousekeepingDto } from "../presentation/housekeeping.dto";

@Injectable()
export class HousekeepingService {
  constructor(
    @InjectModel("HousekeepingUnit") private readonly units: Model<any>,
    @InjectModel("Room") private readonly rooms: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("BookingAuditLog") private readonly audits: Model<any>,
  ) {}
  private async scope(user: AuthenticatedUser): Promise<string[] | null> {
    if (canManageAllAshrams(user)) return null;
    if (isAshramOwner(user))
      return (
        await this.ashrams.find({ ownerId: user.id }).select("_id").lean()
      ).map((a: any) => String(a._id));
    return [
      ...new Set([
        ...(user.scopedAshramIds ?? []),
        ...(user.employerAshramId ? [user.employerAshramId] : []),
      ]),
    ];
  }
  async board(user: AuthenticatedUser, requested?: string): Promise<any[]> {
    const scope = await this.scope(user);
    if (requested && scope && !scope.includes(requested))
      throw new ForbiddenException("Not authorized for this ashram");
    const ids = requested
      ? [requested]
      : (scope ??
        (await this.ashrams.find().select("_id").lean()).map((a: any) =>
          String(a._id),
        ));
    for (const ashramId of ids) {
      const rooms = await this.rooms.find({ ashramId, deletedAt: null }).lean();
      for (const room of rooms as any[]) {
        const operations = [];
        for (let i = 1; i <= room.totalInventory; i++)
          operations.push({
            updateOne: {
              filter: {
                ashramId,
                unitNumber: `${room.name.slice(0, 3).toUpperCase()}-${String(i).padStart(2, "0")}`,
              },
              update: { $setOnInsert: { roomId: room._id, status: "clean" } },
              upsert: true,
            },
          });
        if (operations.length)
          await this.units.bulkWrite(operations, { ordered: false });
      }
    }
    return this.units
      .find({ ashramId: { $in: ids } })
      .populate("roomId", "name type acType")
      .populate("assignedTo", "name")
      .sort({ unitNumber: 1 })
      .lean();
  }
  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateHousekeepingDto,
  ): Promise<any> {
    const unit = await this.units.findById(id);
    if (!unit) throw new NotFoundException("Room unit not found");
    const scope = await this.scope(user);
    if (scope && !scope.includes(String(unit.ashramId)))
      throw new ForbiddenException("Not authorized for this ashram");
    unit.status = dto.status;
    if (dto.notes !== undefined) unit.notes = dto.notes;
    if (dto.status === "cleaning") unit.assignedTo = user.id;
    if (dto.status === "clean") unit.lastCleanedAt = new Date();
    unit.version = Number(unit.version ?? 0) + 1;
    await unit.save();
    await this.audits.create({
      userId: user.id,
      action: "HOUSEKEEPING_STATUS_UPDATE",
      ashramId: unit.ashramId,
      details: {
        unitId: unit._id,
        unitNumber: unit.unitNumber,
        status: dto.status,
      },
    });
    return unit.populate([
      { path: "roomId", select: "name type acType" },
      { path: "assignedTo", select: "name" },
    ]);
  }
}
