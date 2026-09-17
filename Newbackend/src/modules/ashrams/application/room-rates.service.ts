import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams } from "../../../common/auth/ashram-access";
import { assignedAshramIds } from "../../../common/auth/ashram-scope";
import { roundMoney } from "../../bookings/domain/booking.utils";
import type {
  BulkRoomRatesDto,
  UpsertRoomRateDto,
} from "../presentation/dtos/room-rate.dto";

export interface ResolvedRate {
  roomId: string;
  roomName: string;
  roomType: string;
  acType: string;
  capacity: number;
  totalInventory: number;
  mrp: number;
  discountPercent: number;
  discountAmount: number;
  sellingPrice: number;
  isDiscountActive: boolean;
  status: string;
  updatedAt?: Date;
  updatedBy?: string;
  notes?: string;
}

@Injectable()
export class RoomRatesService {
  constructor(
    @InjectModel("RoomRate") private readonly roomRates: Model<any>,
    @InjectModel("Room") private readonly rooms: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("AuditLog") private readonly audits: Model<any>,
  ) {}

  private assertScope(user: AuthenticatedUser, ashram: any): void {
    if (!ashram) throw new NotFoundException("Stay not found");
    if (canManageAllAshrams(user)) return;
    if (String(ashram.ownerId) === user.id) return;
    if (assignedAshramIds(user).includes(String(ashram._id))) return;
    throw new ForbiddenException("You do not have access to this stay.");
  }

  private calculateRate(
    rawMrp: number,
    rawDiscountPercent: number,
    isDiscountActive: boolean,
  ): {
    mrp: number;
    discountPercent: number;
    discountAmount: number;
    sellingPrice: number;
  } {
    const mrp = roundMoney(Math.max(0, Number(rawMrp) || 0));
    const discountPercent = Math.min(
      90,
      Math.max(0, Number(rawDiscountPercent) || 0),
    );
    const active = isDiscountActive && discountPercent > 0;
    const discountAmount = active
      ? roundMoney((mrp * discountPercent) / 100)
      : 0;
    const sellingPrice = Math.max(0, roundMoney(mrp - discountAmount));
    return { mrp, discountPercent, discountAmount, sellingPrice };
  }

  async listByStay(
    user: AuthenticatedUser,
    ashramId: string,
  ): Promise<{ ashram: any; rates: ResolvedRate[] }> {
    const ashram = await this.ashrams
      .findOne({ _id: ashramId, deletedAt: null })
      .lean();
    if (!ashram) throw new NotFoundException("Stay not found");
    this.assertScope(user, ashram);

    const [rooms, rates] = await Promise.all([
      this.rooms.find({ ashramId, deletedAt: null }).lean(),
      this.roomRates.find({ ashramId }).lean(),
    ]);

    const rateMap = new Map<string, any>();
    for (const r of rates) {
      rateMap.set(String(r.roomId), r);
    }

    const resolved: ResolvedRate[] = rooms.map((room: any) => {
      const rate = rateMap.get(String(room._id));
      const isDiscountActive =
        rate?.isDiscountActive ?? room.isDiscountActive ?? true;
      const rawDiscount =
        rate?.discountPercent ?? room.discountPercent ?? 0;
      const rawMrp = rate?.mrp ?? room.basePrice ?? 0;

      const calc = this.calculateRate(rawMrp, rawDiscount, isDiscountActive);

      return {
        roomId: String(room._id),
        roomName: room.name,
        roomType: room.type,
        acType: room.acType,
        capacity: room.capacity,
        totalInventory: room.totalInventory,
        mrp: calc.mrp,
        discountPercent: calc.discountPercent,
        discountAmount: calc.discountAmount,
        sellingPrice: calc.sellingPrice,
        isDiscountActive,
        status: room.status,
        updatedAt: rate?.updatedAt ?? room.updatedAt,
        updatedBy: rate?.updatedBy ? String(rate.updatedBy) : undefined,
        notes: rate?.notes ?? "",
      };
    });

    return { ashram, rates: resolved };
  }

  async getByRoom(
    user: AuthenticatedUser,
    roomId: string,
  ): Promise<ResolvedRate> {
    const room = await this.rooms.findOne({ _id: roomId, deletedAt: null }).lean();
    if (!room) throw new NotFoundException("Room category not found");

    const ashram = await this.ashrams.findById(room.ashramId).lean();
    this.assertScope(user, ashram);

    const rate = await this.roomRates.findOne({ roomId }).lean();
    const isDiscountActive =
      rate?.isDiscountActive ?? room.isDiscountActive ?? true;
    const rawDiscount = rate?.discountPercent ?? room.discountPercent ?? 0;
    const rawMrp = rate?.mrp ?? room.basePrice ?? 0;

    const calc = this.calculateRate(rawMrp, rawDiscount, isDiscountActive);

    return {
      roomId: String(room._id),
      roomName: room.name,
      roomType: room.type,
      acType: room.acType,
      capacity: room.capacity,
      totalInventory: room.totalInventory,
      mrp: calc.mrp,
      discountPercent: calc.discountPercent,
      discountAmount: calc.discountAmount,
      sellingPrice: calc.sellingPrice,
      isDiscountActive,
      status: room.status,
      updatedAt: rate?.updatedAt ?? room.updatedAt,
      updatedBy: rate?.updatedBy ? String(rate.updatedBy) : undefined,
      notes: rate?.notes ?? "",
    };
  }

  async upsertRate(
    user: AuthenticatedUser,
    dto: UpsertRoomRateDto,
  ): Promise<ResolvedRate> {
    const room = await this.rooms.findOne({
      _id: dto.roomId,
      ashramId: dto.ashramId,
      deletedAt: null,
    });
    if (!room) {
      throw new NotFoundException("Room category not found in this stay");
    }

    const ashram = await this.ashrams.findById(dto.ashramId).lean();
    this.assertScope(user, ashram);

    const isDiscountActive = dto.isDiscountActive !== false;
    const calc = this.calculateRate(
      dto.mrp,
      dto.discountPercent,
      isDiscountActive,
    );

    const before = await this.roomRates.findOne({ roomId: dto.roomId }).lean();

    const updatedRate = await this.roomRates.findOneAndUpdate(
      { roomId: dto.roomId },
      {
        $set: {
          ashramId: dto.ashramId,
          roomId: dto.roomId,
          mrp: calc.mrp,
          discountPercent: calc.discountPercent,
          discountAmount: calc.discountAmount,
          sellingPrice: calc.sellingPrice,
          isDiscountActive,
          isActive: true,
          notes: dto.notes ?? "",
          updatedBy: user.id,
        },
        $setOnInsert: {
          createdBy: user.id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Keep Room document in sync for seamless discovery, search, and quotes
    await this.rooms.updateOne(
      { _id: dto.roomId },
      {
        $set: {
          basePrice: calc.mrp,
          discountPercent: calc.discountPercent,
          discountAmount: calc.discountAmount,
          sellingPrice: calc.sellingPrice,
          isDiscountActive,
        },
      },
    );

    // Audit log
    await this.audits.create({
      userId: user.id,
      action: "room_rate.update",
      module: "rate_management",
      details: {
        ashramId: dto.ashramId,
        ashramName: ashram.name,
        roomId: dto.roomId,
        roomName: room.name,
        mrp: calc.mrp,
        discountPercent: calc.discountPercent,
        discountAmount: calc.discountAmount,
        sellingPrice: calc.sellingPrice,
        isDiscountActive,
      },
      before: before
        ? {
            mrp: before.mrp,
            discountPercent: before.discountPercent,
            discountAmount: before.discountAmount,
            sellingPrice: before.sellingPrice,
            isDiscountActive: before.isDiscountActive,
          }
        : null,
      after: {
        mrp: calc.mrp,
        discountPercent: calc.discountPercent,
        discountAmount: calc.discountAmount,
        sellingPrice: calc.sellingPrice,
        isDiscountActive,
      },
      timestamp: new Date(),
    });

    return {
      roomId: String(room._id),
      roomName: room.name,
      roomType: room.type,
      acType: room.acType,
      capacity: room.capacity,
      totalInventory: room.totalInventory,
      mrp: calc.mrp,
      discountPercent: calc.discountPercent,
      discountAmount: calc.discountAmount,
      sellingPrice: calc.sellingPrice,
      isDiscountActive,
      status: room.status,
      updatedAt: updatedRate.updatedAt,
      updatedBy: user.id,
      notes: updatedRate.notes,
    };
  }

  async toggleDiscount(
    user: AuthenticatedUser,
    roomId: string,
    isDiscountActive: boolean,
  ): Promise<ResolvedRate> {
    const room = await this.rooms.findOne({ _id: roomId, deletedAt: null });
    if (!room) throw new NotFoundException("Room category not found");

    const ashram = await this.ashrams.findById(room.ashramId).lean();
    this.assertScope(user, ashram);

    const currentRate = await this.roomRates.findOne({ roomId }).lean();
    const mrp = currentRate?.mrp ?? room.basePrice ?? 0;
    const discountPercent =
      currentRate?.discountPercent ?? room.discountPercent ?? 0;

    const calc = this.calculateRate(mrp, discountPercent, isDiscountActive);

    const updatedRate = await this.roomRates.findOneAndUpdate(
      { roomId },
      {
        $set: {
          ashramId: room.ashramId,
          roomId,
          mrp: calc.mrp,
          discountPercent: calc.discountPercent,
          discountAmount: calc.discountAmount,
          sellingPrice: calc.sellingPrice,
          isDiscountActive,
          updatedBy: user.id,
        },
        $setOnInsert: {
          createdBy: user.id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await this.rooms.updateOne(
      { _id: roomId },
      {
        $set: {
          basePrice: calc.mrp,
          discountPercent: calc.discountPercent,
          discountAmount: calc.discountAmount,
          sellingPrice: calc.sellingPrice,
          isDiscountActive,
        },
      },
    );

    await this.audits.create({
      userId: user.id,
      action: "room_rate.toggle_discount",
      module: "rate_management",
      details: {
        ashramId: String(room.ashramId),
        roomId,
        roomName: room.name,
        isDiscountActive,
        sellingPrice: calc.sellingPrice,
      },
      before: currentRate
        ? { isDiscountActive: currentRate.isDiscountActive }
        : null,
      after: { isDiscountActive },
      timestamp: new Date(),
    });

    return {
      roomId: String(room._id),
      roomName: room.name,
      roomType: room.type,
      acType: room.acType,
      capacity: room.capacity,
      totalInventory: room.totalInventory,
      mrp: calc.mrp,
      discountPercent: calc.discountPercent,
      discountAmount: calc.discountAmount,
      sellingPrice: calc.sellingPrice,
      isDiscountActive,
      status: room.status,
      updatedAt: updatedRate.updatedAt,
      updatedBy: user.id,
    };
  }

  async bulkUpdate(
    user: AuthenticatedUser,
    dto: BulkRoomRatesDto,
  ): Promise<{ updatedCount: number; rates: ResolvedRate[] }> {
    if (!dto.roomIds?.length) {
      throw new BadRequestException("Please select at least one room category.");
    }

    const ashram = await this.ashrams
      .findOne({ _id: dto.ashramId, deletedAt: null })
      .lean();
    if (!ashram) throw new NotFoundException("Stay not found");
    this.assertScope(user, ashram);

    const rooms = await this.rooms
      .find({
        _id: { $in: dto.roomIds },
        ashramId: dto.ashramId,
        deletedAt: null,
      })
      .lean();

    if (rooms.length !== dto.roomIds.length) {
      throw new NotFoundException(
        "One or more room categories do not belong to this stay",
      );
    }

    const existingRates = await this.roomRates
      .find({ roomId: { $in: dto.roomIds } })
      .lean();
    const rateMap = new Map<string, any>(
      existingRates.map((r) => [String(r.roomId), r]),
    );

    const isDiscountActive = dto.isDiscountActive !== false;
    const results: ResolvedRate[] = [];

    for (const room of rooms) {
      const existing = rateMap.get(String(room._id));
      const mrp = existing?.mrp ?? room.basePrice ?? 0;
      const calc = this.calculateRate(
        mrp,
        dto.discountPercent,
        isDiscountActive,
      );

      await this.roomRates.updateOne(
        { roomId: room._id },
        {
          $set: {
            ashramId: dto.ashramId,
            roomId: room._id,
            mrp: calc.mrp,
            discountPercent: calc.discountPercent,
            discountAmount: calc.discountAmount,
            sellingPrice: calc.sellingPrice,
            isDiscountActive,
            updatedBy: user.id,
          },
          $setOnInsert: {
            createdBy: user.id,
          },
        },
        { upsert: true },
      );

      await this.rooms.updateOne(
        { _id: room._id },
        {
          $set: {
            basePrice: calc.mrp,
            discountPercent: calc.discountPercent,
            discountAmount: calc.discountAmount,
            sellingPrice: calc.sellingPrice,
            isDiscountActive,
          },
        },
      );

      results.push({
        roomId: String(room._id),
        roomName: room.name,
        roomType: room.type,
        acType: room.acType,
        capacity: room.capacity,
        totalInventory: room.totalInventory,
        mrp: calc.mrp,
        discountPercent: calc.discountPercent,
        discountAmount: calc.discountAmount,
        sellingPrice: calc.sellingPrice,
        isDiscountActive,
        status: room.status,
      });
    }

    await this.audits.create({
      userId: user.id,
      action: "room_rate.bulk_update",
      module: "rate_management",
      details: {
        ashramId: dto.ashramId,
        roomCount: rooms.length,
        discountPercent: dto.discountPercent,
        isDiscountActive,
      },
      timestamp: new Date(),
    });

    return { updatedCount: results.length, rates: results };
  }

  async getPublicEffectiveRate(roomId: string): Promise<{
    roomId: string;
    mrp: number;
    discountPercent: number;
    discountAmount: number;
    sellingPrice: number;
    isDiscountActive: boolean;
  }> {
    const room = await this.rooms.findOne({ _id: roomId, deletedAt: null }).lean();
    if (!room) throw new NotFoundException("Room category not found");

    const rate = await this.roomRates.findOne({ roomId }).lean();
    const isDiscountActive =
      rate?.isDiscountActive ?? room.isDiscountActive ?? true;
    const rawDiscount = rate?.discountPercent ?? room.discountPercent ?? 0;
    const rawMrp = rate?.mrp ?? room.basePrice ?? 0;

    const calc = this.calculateRate(rawMrp, rawDiscount, isDiscountActive);

    return {
      roomId: String(room._id),
      mrp: calc.mrp,
      discountPercent: calc.discountPercent,
      discountAmount: calc.discountAmount,
      sellingPrice: calc.sellingPrice,
      isDiscountActive,
    };
  }
}
