import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  PILGRIMAGE_DEFAULTS,
  PILGRIMAGE_MODEL,
} from "../domain/pilgrimage.constants";
import { PilgrimageException } from "../domain/pilgrimage.errors";
import {
  circuitSlug,
  groupStopsByDay,
  totalDistance,
} from "../domain/pilgrimage.utils";
import {
  PilgrimageAccessService,
  type PilgrimageAccess,
} from "./pilgrimage-access.service";
import type {
  ApproveCircuitDto,
  CircuitListQueryDto,
  CreateCircuitDto,
  CreateStopDto,
  ReorderStopsDto,
  UpdateCircuitDto,
  UpdateStopDto,
  UpsertPilgrimageSettingDto,
} from "../presentation/dtos/pilgrimage.dto";

@Injectable()
export class PilgrimageManagementService {
  constructor(
    private readonly accessService: PilgrimageAccessService,
    @InjectModel(PILGRIMAGE_MODEL.Circuit) private readonly circuits: Model<any>,
    @InjectModel(PILGRIMAGE_MODEL.Stop) private readonly stops: Model<any>,
    @InjectModel(PILGRIMAGE_MODEL.Setting) private readonly settings: Model<any>,
    @InjectModel(PILGRIMAGE_MODEL.Itinerary)
    private readonly itineraries: Model<any>,
    @InjectModel(PILGRIMAGE_MODEL.AshramRef)
    private readonly ashrams: Model<any>,
  ) {}

  private async assertOwned(
    access: PilgrimageAccess,
    circuitId: string,
  ): Promise<any> {
    const circuit = await this.circuits.findById(circuitId);
    if (!circuit) throw new PilgrimageException("Circuit not found.", 404);
    this.accessService.assertCircuit(access, circuit);
    return circuit;
  }

  private async resolveLimits(
    ashramId?: string,
    circuitId?: string,
  ): Promise<Record<string, any>> {
    const or: Record<string, unknown>[] = [{ scope: "platform" }];
    if (ashramId) or.push({ scope: "ashram", ashramId });
    if (circuitId) or.push({ scope: "circuit", circuitId });
    const rows = await this.settings.find({ $or: or }).lean();
    const result: Record<string, any> = { ...PILGRIMAGE_DEFAULTS };
    for (const scope of ["platform", "ashram", "circuit"]) {
      const row = rows.find((candidate) => candidate.scope === scope);
      if (!row) continue;
      for (const key of Object.keys(PILGRIMAGE_DEFAULTS)) {
        if (row[key] !== null && row[key] !== undefined) result[key] = row[key];
      }
    }
    return result;
  }

  listAshrams(access: PilgrimageAccess): Promise<any[]> {
    const filter =
      access.isPlatformAdmin || access.scopeAllAshrams
        ? {}
        : { _id: { $in: access.ashramIds } };
    return this.ashrams
      .find(filter)
      .select("name ashramCode address.city address.state ownerId status")
      .sort({ name: 1 })
      .limit(500)
      .lean();
  }

  async listCircuits(
    access: PilgrimageAccess,
    query: CircuitListQueryDto,
  ): Promise<any> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const filter: Record<string, unknown> = {
      ...this.accessService.scopeFilter(access),
    };
    if (query.status) filter.status = query.status;
    if (query.ashramId) filter.ashramId = query.ashramId;
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), "i");
      filter.$or = [{ name: pattern }, { slug: pattern }, { startCity: pattern }];
    }
    const [data, total] = await Promise.all([
      this.circuits
        .find(filter)
        .populate("ashramId", "name ashramCode")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.circuits.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  async getCircuit(access: PilgrimageAccess, id: string): Promise<any> {
    const circuit = await this.assertOwned(access, id);
    const stops = await this.stops
      .find({ circuitId: circuit._id })
      .sort({ dayNumber: 1, order: 1 })
      .lean();
    return {
      circuit,
      stops,
      days: groupStopsByDay(stops, Number(circuit.durationDays ?? 1)),
      savedItineraryCount: await this.itineraries.countDocuments({
        circuitId: circuit._id,
      }),
    };
  }

  async createCircuit(
    user: AuthenticatedUser,
    access: PilgrimageAccess,
    dto: CreateCircuitDto,
  ): Promise<any> {
    this.accessService.assertAshram(access, dto.ashramId);
    const ashram = await this.ashrams.findById(dto.ashramId).lean();
    if (!ashram) throw new PilgrimageException("Ashram not found.", 404);
    const limits = await this.resolveLimits(dto.ashramId);
    if (dto.durationDays > Number(limits.maxDurationDays))
      throw new PilgrimageException(
        `A circuit can run for at most ${limits.maxDurationDays} days.`,
        400,
        "TOO_LONG",
      );
    return this.circuits.create({
      ...dto,
      ownerId: ashram.ownerId ?? user.id,
      slug: circuitSlug(dto.name, dto.startCity ?? ""),
      status: "draft",
    });
  }

  async updateCircuit(
    access: PilgrimageAccess,
    id: string,
    dto: UpdateCircuitDto,
  ): Promise<any> {
    const circuit = await this.assertOwned(access, id);
    // Renaming or re-routing an approved circuit sends it back through review.
    const rereviewFields = ["name", "circuitType", "durationDays", "startCity"];
    const needsReview =
      circuit.status === "approved" &&
      rereviewFields.some((field) => (dto as any)[field] !== undefined);
    Object.assign(circuit, dto);
    if (needsReview && !access.isPlatformAdmin) {
      circuit.status = "pending";
      circuit.submittedAt = new Date();
    }
    await circuit.save();
    return circuit;
  }

  async submitCircuit(access: PilgrimageAccess, id: string): Promise<any> {
    const circuit = await this.assertOwned(access, id);
    if (!["draft", "rejected"].includes(circuit.status))
      throw new PilgrimageException(
        "Only a draft or rejected circuit can be submitted for review.",
        400,
      );
    if (!(await this.stops.exists({ circuitId: circuit._id })))
      throw new PilgrimageException(
        "Add at least one stop before submitting this circuit for review.",
        400,
      );
    circuit.status = "pending";
    circuit.submittedAt = new Date();
    circuit.rejectionReason = "";
    await circuit.save();
    return circuit;
  }

  async reviewCircuit(
    user: AuthenticatedUser,
    id: string,
    dto: ApproveCircuitDto,
  ): Promise<any> {
    const circuit = await this.circuits.findById(id);
    if (!circuit) throw new PilgrimageException("Circuit not found.", 404);
    if (dto.decision === "approve") {
      circuit.status = "approved";
      circuit.approvedAt = new Date();
      circuit.approvedBy = user.id;
      circuit.rejectionReason = "";
    } else {
      circuit.status = "rejected";
      circuit.rejectionReason = dto.reason || "Not approved";
    }
    await circuit.save();
    return circuit;
  }

  async setStatus(id: string, status: string): Promise<any> {
    const circuit = await this.circuits.findById(id);
    if (!circuit) throw new PilgrimageException("Circuit not found.", 404);
    circuit.status = status;
    await circuit.save();
    return circuit;
  }

  async setFeatured(id: string, isFeatured: boolean): Promise<any> {
    const circuit = await this.circuits.findById(id);
    if (!circuit) throw new PilgrimageException("Circuit not found.", 404);
    circuit.isFeatured = isFeatured;
    await circuit.save();
    return circuit;
  }

  async deleteCircuit(access: PilgrimageAccess, id: string): Promise<any> {
    const circuit = await this.assertOwned(access, id);
    if (await this.itineraries.exists({ circuitId: circuit._id }))
      throw new PilgrimageException(
        "This circuit is used by an itinerary and cannot be deleted.",
        409,
      );
    await Promise.all([
      this.stops.deleteMany({ circuitId: circuit._id }),
      this.settings.deleteMany({ circuitId: circuit._id }),
    ]);
    await this.circuits.deleteOne({ _id: circuit._id });
    return { deleted: true, _id: circuit._id };
  }

  async addStop(access: PilgrimageAccess, dto: CreateStopDto): Promise<any> {
    const circuit = await this.assertOwned(access, dto.circuitId);
    const limits = await this.resolveLimits(
      String(circuit.ashramId),
      String(circuit._id),
    );
    const count = await this.stops.countDocuments({ circuitId: circuit._id });
    if (count >= Number(limits.maxStopsPerCircuit))
      throw new PilgrimageException(
        `A circuit can hold at most ${limits.maxStopsPerCircuit} stops.`,
        400,
        "TOO_MANY_STOPS",
      );
    if (dto.dayNumber > Number(circuit.durationDays))
      throw new PilgrimageException(
        `This circuit runs for ${circuit.durationDays} day(s). Extend it before adding a day ${dto.dayNumber} stop.`,
        400,
        "DAY_OUT_OF_RANGE",
      );

    const order =
      dto.order ??
      (await this.stops.countDocuments({
        circuitId: circuit._id,
        dayNumber: dto.dayNumber,
      }));
    const stop = await this.stops.create({
      ...dto,
      order,
      ashramId: circuit.ashramId,
    });
    await this.syncCircuitTotals(String(circuit._id));
    return stop;
  }

  async updateStop(
    access: PilgrimageAccess,
    id: string,
    dto: UpdateStopDto,
  ): Promise<any> {
    const stop = await this.stops.findById(id);
    if (!stop) throw new PilgrimageException("Stop not found.", 404);
    const circuit = await this.assertOwned(access, String(stop.circuitId));
    if (dto.dayNumber && dto.dayNumber > Number(circuit.durationDays))
      throw new PilgrimageException(
        `This circuit runs for ${circuit.durationDays} day(s).`,
        400,
        "DAY_OUT_OF_RANGE",
      );
    Object.assign(stop, dto);
    await stop.save();
    await this.syncCircuitTotals(String(stop.circuitId));
    return stop;
  }

  async deleteStop(access: PilgrimageAccess, id: string): Promise<any> {
    const stop = await this.stops.findById(id);
    if (!stop) throw new PilgrimageException("Stop not found.", 404);
    await this.assertOwned(access, String(stop.circuitId));
    const circuitId = String(stop.circuitId);
    await stop.deleteOne();
    await this.syncCircuitTotals(circuitId);
    return { deleted: true, _id: id };
  }

  /** Persists a drag-and-drop reorder as one pass over the affected stops. */
  async reorderStops(
    access: PilgrimageAccess,
    dto: ReorderStopsDto,
  ): Promise<any> {
    const circuit = await this.assertOwned(access, dto.circuitId);
    for (const [index, entry] of dto.stops.entries()) {
      if (entry.dayNumber > Number(circuit.durationDays))
        throw new PilgrimageException(
          `This circuit runs for ${circuit.durationDays} day(s).`,
          400,
          "DAY_OUT_OF_RANGE",
        );
      await this.stops.updateOne(
        { _id: entry._id, circuitId: circuit._id },
        { $set: { dayNumber: entry.dayNumber, order: entry.order ?? index } },
      );
    }
    await this.syncCircuitTotals(String(circuit._id));
    return this.stops
      .find({ circuitId: circuit._id })
      .sort({ dayNumber: 1, order: 1 })
      .lean();
  }

  /**
   * `stopCount` and `totalDistanceKm` are denormalised onto the circuit so the
   * public list can render them without loading every stop.
   */
  private async syncCircuitTotals(circuitId: string): Promise<void> {
    const stops = await this.stops.find({ circuitId }).lean();
    await this.circuits.updateOne(
      { _id: circuitId },
      {
        $set: {
          stopCount: stops.length,
          totalDistanceKm: totalDistance(stops),
        },
      },
    );
  }

  async dashboard(access: PilgrimageAccess): Promise<any> {
    const scope = this.accessService.scopeFilter(access);
    const [approved, pending, drafts, templates, topCircuits, savedPlans] =
      await Promise.all([
        this.circuits.countDocuments({ ...scope, status: "approved" }),
        this.circuits.countDocuments({ ...scope, status: "pending" }),
        this.circuits.countDocuments({ ...scope, status: "draft" }),
        this.circuits.countDocuments({
          ...scope,
          status: "approved",
          usableAsPlannerTemplate: true,
        }),
        this.circuits
          .find({ ...scope, status: "approved" })
          .select("name slug viewCount durationDays stopCount startCity")
          .sort({ viewCount: -1 })
          .limit(10)
          .lean(),
        this.itineraries.countDocuments({}),
      ]);
    return {
      circuits: { approved, pendingReview: pending, drafts, templates },
      topCircuits,
      savedItineraries: savedPlans,
    };
  }

  async listSettings(access: PilgrimageAccess): Promise<any[]> {
    const or: Record<string, unknown>[] = [{ scope: "platform" }];
    if (!access.isPlatformAdmin && !access.scopeAllAshrams)
      or.push({ scope: "ashram", ashramId: { $in: access.ashramIds } });
    else or.push({ scope: "ashram" }, { scope: "circuit" });
    return this.settings.find({ $or: or }).lean();
  }

  async upsertSetting(
    user: AuthenticatedUser,
    access: PilgrimageAccess,
    dto: UpsertPilgrimageSettingDto,
  ): Promise<any> {
    if (dto.scope === "platform" && !access.isPlatformAdmin)
      throw new PilgrimageException(
        "Only the platform can change platform-wide pilgrimage settings.",
        403,
      );
    if (dto.scope === "circuit" && dto.circuitId)
      await this.assertOwned(access, dto.circuitId);
    if (dto.scope === "ashram" && dto.ashramId)
      this.accessService.assertAshram(access, dto.ashramId);
    const filter = {
      scope: dto.scope,
      ashramId: dto.ashramId ?? null,
      circuitId: dto.circuitId ?? null,
    };
    return this.settings.findOneAndUpdate(
      filter,
      { $set: { ...dto, ...filter, updatedBy: user.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}
