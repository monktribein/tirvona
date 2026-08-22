import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { PILGRIMAGE_MODEL } from "../domain/pilgrimage.constants";
import { PilgrimageException } from "../domain/pilgrimage.errors";
import { addDays, groupStopsByDay } from "../domain/pilgrimage.utils";
import type {
  GenerateItineraryDto,
  SaveItineraryDto,
} from "../presentation/dtos/pilgrimage.dto";

const PACE_FACTOR: Record<string, number> = {
  relaxed: 0.7,
  balanced: 1,
  packed: 1.4,
};

@Injectable()
export class PilgrimagePlannerService {
  constructor(
    @InjectModel(PILGRIMAGE_MODEL.Circuit) private readonly circuits: Model<any>,
    @InjectModel(PILGRIMAGE_MODEL.Stop) private readonly stops: Model<any>,
    @InjectModel(PILGRIMAGE_MODEL.Itinerary)
    private readonly itineraries: Model<any>,
  ) {}

  /**
   * Builds a day-by-day plan from an approved circuit.
   *
   * The circuit's own day assignment is the ashram's expert routing, so it is
   * preserved whenever the requested trip is at least as long. Only a shorter
   * trip re-buckets the stops, and pace then decides how many are kept per day
   * rather than dropping the tail of the route.
   */
  async generate(dto: GenerateItineraryDto): Promise<any> {
    const circuit = await this.circuits
      .findOne({
        ...(/^[0-9a-f]{24}$/i.test(dto.circuitId)
          ? { _id: dto.circuitId }
          : { slug: dto.circuitId.toLowerCase() }),
        status: "approved",
      })
      .lean();
    if (!circuit)
      throw new PilgrimageException(
        "That pilgrimage circuit is not available.",
        404,
        "CIRCUIT_NOT_FOUND",
      );

    const stops = await this.stops
      .find({ circuitId: circuit._id })
      .sort({ dayNumber: 1, order: 1 })
      .lean();
    if (!stops.length)
      throw new PilgrimageException(
        "This circuit has no stops published yet.",
        400,
        "NO_STOPS",
      );

    const circuitDays = Number(circuit.durationDays ?? 1);
    const requestedDays = Math.max(1, dto.durationDays ?? circuitDays);
    const pace = PACE_FACTOR[dto.pace ?? "balanced"] ?? 1;

    const days =
      requestedDays >= circuitDays
        ? groupStopsByDay(stops, requestedDays)
        : this.compress(stops, requestedDays, pace);

    const startDate = dto.startDate ? new Date(dto.startDate) : null;

    return {
      circuit: {
        _id: circuit._id,
        name: circuit.name,
        slug: circuit.slug,
        circuitType: circuit.circuitType,
        coverImage: circuit.coverImage,
        durationDays: circuitDays,
        totalDistanceKm: circuit.totalDistanceKm,
        difficulty: circuit.difficulty,
      },
      travellers: dto.travellers ?? 1,
      pace: dto.pace ?? "balanced",
      durationDays: requestedDays,
      shortened: requestedDays < circuitDays,
      days: days.map((day) => ({
        dayNumber: day.dayNumber,
        date: startDate ? addDays(startDate, day.dayNumber - 1) : null,
        title:
          day.stops[0]?.city ||
          circuit.startCity ||
          `Day ${day.dayNumber}`,
        distanceKm: Math.round(
          day.stops.reduce(
            (sum, stop) => sum + Number(stop.distanceFromPreviousKm ?? 0),
            0,
          ),
        ),
        stops: day.stops,
      })),
    };
  }

  private compress(
    stops: any[],
    days: number,
    pace: number,
  ): { dayNumber: number; stops: any[] }[] {
    const perDay = Math.max(1, Math.ceil((stops.length / days) * pace));
    const buckets: { dayNumber: number; stops: any[] }[] = [];
    for (let day = 1; day <= days; day += 1) {
      buckets.push({
        dayNumber: day,
        stops: stops.slice((day - 1) * perDay, day * perDay),
      });
    }
    // Anything that did not fit joins the final day rather than vanishing.
    const placed = perDay * days;
    if (stops.length > placed)
      buckets[buckets.length - 1].stops.push(...stops.slice(placed));
    return buckets;
  }

  async save(
    user: AuthenticatedUser,
    dto: SaveItineraryDto,
  ): Promise<any> {
    return this.itineraries.create({
      userId: user.id,
      circuitId: dto.circuitId ?? null,
      title: dto.title,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      travellers: dto.travellers ?? 1,
      pace: dto.pace ?? "balanced",
      days: dto.days ?? [],
      notes: dto.notes ?? "",
      status: "saved",
    });
  }

  async listMine(userId: string, page: number, limit: number): Promise<any> {
    const filter = { userId, status: { $ne: "archived" } };
    const [data, total] = await Promise.all([
      this.itineraries
        .find(filter)
        .populate("circuitId", "name slug coverImage")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.itineraries.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  async getMine(id: string, userId: string): Promise<any> {
    const itinerary = await this.itineraries
      .findOne({ _id: id, userId })
      .populate("circuitId", "name slug coverImage circuitType")
      .lean();
    if (!itinerary)
      throw new PilgrimageException("Itinerary not found.", 404);
    return itinerary;
  }

  async removeMine(id: string, userId: string): Promise<any> {
    const itinerary = await this.itineraries.findOne({ _id: id, userId });
    if (!itinerary)
      throw new PilgrimageException("Itinerary not found.", 404);
    itinerary.status = "archived";
    await itinerary.save();
    return { archived: true, _id: id };
  }
}
