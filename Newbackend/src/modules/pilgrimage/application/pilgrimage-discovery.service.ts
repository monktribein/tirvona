import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  CIRCUIT_DIFFICULTIES,
  CIRCUIT_SEASONS,
  CIRCUIT_TYPES,
  CIRCUIT_TYPE_META,
  PILGRIMAGE_MODEL,
} from "../domain/pilgrimage.constants";
import { groupStopsByDay } from "../domain/pilgrimage.utils";
import type { CircuitSearchDto } from "../presentation/dtos/pilgrimage.dto";

const PUBLIC_CIRCUIT_FIELDS =
  "name slug circuitType summary description highlights images coverImage startCity endCity state region durationDays totalDistanceKm difficulty bestSeasons idealFor travelTips usableAsPlannerTemplate isFeatured stopCount viewCount ashramId status";

const label = (value: string): string =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

@Injectable()
export class PilgrimageDiscoveryService {
  constructor(
    @InjectModel(PILGRIMAGE_MODEL.Circuit) private readonly circuits: Model<any>,
    @InjectModel(PILGRIMAGE_MODEL.Stop) private readonly stops: Model<any>,
  ) {}

  filters(): Record<string, unknown> {
    return {
      circuitTypes: CIRCUIT_TYPES.map((type) => ({
        value: type,
        label: CIRCUIT_TYPE_META[type].label,
      })),
      difficulties: CIRCUIT_DIFFICULTIES.map((value) => ({
        value,
        label: label(value),
      })),
      seasons: CIRCUIT_SEASONS.map((value) => ({
        value,
        label: label(value),
      })),
      durations: [
        { value: "1-3", label: "1 – 3 days" },
        { value: "4-7", label: "4 – 7 days" },
        { value: "8-14", label: "8 – 14 days" },
        { value: "15-60", label: "15+ days" },
      ],
      sort: [
        { value: "recommended", label: "Recommended" },
        { value: "duration_short", label: "Shortest first" },
        { value: "duration_long", label: "Longest first" },
        { value: "newest", label: "Recently added" },
      ],
    };
  }

  async search(query: CircuitSearchDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 12, 50);
    const filter: Record<string, unknown> = { status: "approved" };

    if (query.circuitType) filter.circuitType = query.circuitType;
    if (query.difficulty) filter.difficulty = query.difficulty;
    if (query.season) filter.bestSeasons = query.season;
    if (query.state)
      filter.state = new RegExp(`^${escapeRegex(query.state)}$`, "i");
    if (query.ashramId) filter.ashramId = query.ashramId;
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), "i");
      filter.$or = [
        { name: pattern },
        { summary: pattern },
        { startCity: pattern },
        { state: pattern },
      ];
    }
    if (query.duration) {
      const [from, to] = query.duration.split("-").map(Number);
      if (Number.isFinite(from) && Number.isFinite(to))
        filter.durationDays = { $gte: from, $lte: to };
    }

    const sort: Record<string, 1 | -1> =
      query.sort === "duration_short"
        ? { durationDays: 1 }
        : query.sort === "duration_long"
          ? { durationDays: -1 }
          : query.sort === "newest"
            ? { createdAt: -1 }
            : { isFeatured: -1, viewCount: -1, createdAt: -1 };

    const [rows, total] = await Promise.all([
      this.circuits
        .find(filter)
        .select(PUBLIC_CIRCUIT_FIELDS)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.circuits.countDocuments(filter),
    ]);

    return {
      success: true,
      count: rows.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data: rows.map((row) => this.decorate(row)),
    };
  }

  private decorate(circuit: any): any {
    return {
      ...circuit,
      circuitTypeLabel:
        CIRCUIT_TYPE_META[circuit.circuitType as keyof typeof CIRCUIT_TYPE_META]
          ?.label ?? "Pilgrimage Circuit",
      difficultyLabel: label(String(circuit.difficulty ?? "moderate")),
    };
  }

  async detail(idOrSlug: string): Promise<any | null> {
    const filter = /^[0-9a-f]{24}$/i.test(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug.toLowerCase() };
    const circuit = await this.circuits
      .findOne({ ...filter, status: "approved" })
      .select(PUBLIC_CIRCUIT_FIELDS)
      .lean();
    if (!circuit) return null;

    await this.circuits.updateOne(
      { _id: circuit._id },
      { $inc: { viewCount: 1 } },
    );

    const stops = await this.stops
      .find({ circuitId: circuit._id })
      .sort({ dayNumber: 1, order: 1 })
      .lean();

    return {
      ...this.decorate(circuit),
      stops,
      days: groupStopsByDay(stops, Number(circuit.durationDays ?? 1)),
    };
  }

  /**
   * The planner's source list: approved circuits their ashram opted into
   * template use, trimmed to what the picker needs.
   */
  templates(query: { q?: string; durationDays?: number }): Promise<any[]> {
    const filter: Record<string, unknown> = {
      status: "approved",
      usableAsPlannerTemplate: true,
    };
    if (query.durationDays) filter.durationDays = { $lte: query.durationDays };
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), "i");
      filter.$or = [{ name: pattern }, { startCity: pattern }, { state: pattern }];
    }
    return this.circuits
      .find(filter)
      .select(
        "name slug circuitType summary coverImage startCity endCity state durationDays difficulty stopCount totalDistanceKm",
      )
      .sort({ isFeatured: -1, durationDays: 1 })
      .limit(60)
      .lean();
  }
}
