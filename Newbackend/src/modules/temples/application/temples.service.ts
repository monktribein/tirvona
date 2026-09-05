import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreateTempleDto, UpdateTempleDto, CreateAartiDto, CreateFestivalDto } from "../presentation/dtos/temple.dto";
import { PARKING_MODEL } from "../../parking/domain/parking.constants";

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "temple";

const distanceKm = (fromLng: number, fromLat: number, entity: any): number | undefined => {
  const coordinates = entity?.address?.coordinates?.coordinates || entity?.geo?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return undefined;
  const [toLng, toLat] = coordinates;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(toLat - fromLat);
  const dLng = radians(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(fromLat)) * Math.cos(radians(toLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};

const addDistances = (lng: number, lat: number, rows: any[]) => rows.map((row) => ({ ...row, distanceKm: distanceKm(lng, lat, row) }));

@Injectable()
export class TemplesService {
  constructor(
    @InjectModel("Temple") private readonly temples: Model<any>,
    @InjectModel("TempleAarti") private readonly aartis: Model<any>,
    @InjectModel("TempleFestival") private readonly festivals: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel(PARKING_MODEL.Location) private readonly parkingLocations: Model<any>,
    @InjectModel("LocalServiceItem") private readonly localServices: Model<any>
  ) {}

  async create(dto: CreateTempleDto, user: any) {
    if (dto.address?.coordinates) this.validateCoordinates(dto.address.coordinates);
    const baseSlug = slugify(dto.slug || `${dto.name || 'unnamed-temple'}-${dto.address?.city || 'unknown'}`);
    let slug = baseSlug;
    let counter = 1;

    while (await this.temples.exists({ slug })) {
      if (dto.slug) throw new ConflictException("Temple slug is already in use");
      slug = `${baseSlug}-${counter++}`;
    }

    const temple = await this.temples.create({
      ...dto,
      address: this.normalizeAddress(dto.address),
      slug,
      createdBy: user?.id,
      updatedBy: user?.id,
    });

    return temple;
  }

  async update(id: string, dto: UpdateTempleDto, user: any) {
    if (dto.address?.coordinates) this.validateCoordinates(dto.address.coordinates);
    if (dto.slug && await this.temples.exists({ slug: dto.slug, _id: { $ne: id }, deletedAt: null })) {
      throw new ConflictException("Temple slug is already in use");
    }
    const temple = await this.temples.findByIdAndUpdate(
      id,
      { ...dto, ...(dto.address ? { address: this.normalizeAddress(dto.address) } : {}), updatedBy: user?.id },
      { new: true }
    );
    if (!temple) throw new NotFoundException("Temple not found");
    return temple;
  }

  async delete(id: string, user: any) {
    const temple = await this.temples.findByIdAndUpdate(
      id,
      { deletedAt: new Date(), updatedBy: user?.id },
      { new: true }
    );
    if (!temple) throw new NotFoundException("Temple not found");
    return { success: true };
  }

  async findAll(query: any = {}) {
    const filter: any = { deletedAt: null };
    if (query._id || query.id) filter._id = query._id || query.id;
    if (query.city) filter["address.city"] = new RegExp(query.city, "i");
    if (query.state) filter["address.state"] = new RegExp(query.state, "i");
    if (query.status) filter.status = query.status;
    if (query.isVerified !== undefined) filter.isVerified = query.isVerified === "true";
    if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured === "true";
    if (query.isPopular !== undefined) filter.isPopular = query.isPopular === "true";
    if (query.search) {
      const pattern = new RegExp(String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: pattern }, { templeShortName: pattern }, { slug: pattern }, { deity: pattern }, { "address.city": pattern }, { "address.area": pattern }, { "address.district": pattern }, { "address.state": pattern }];
    }
    
    // For public users, only show published or active
    if (query.public) {
      filter.status = { $in: ["published", "active"] };
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.temples.find(filter).sort({ [query.sort === "name" ? "name" : "createdAt"]: query.order === "asc" ? 1 : -1 }).skip(skip).limit(limit).lean(),
      this.temples.countDocuments(filter)
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findOneBySlug(slug: string, publicOnly = false) {
    const filter: any = { slug, deletedAt: null };
    if (publicOnly) filter.status = { $in: ["published", "active"] };
    const temple = await this.temples.findOne(filter).lean();
    if (!temple) throw new NotFoundException("Temple not found");
    return temple;
  }
  
  async findOneById(id: string) {
    const temple = await this.temples.findOne({ _id: id, deletedAt: null }).lean();
    if (!temple) throw new NotFoundException("Temple not found");
    return temple;
  }

  async addAarti(templeId: string, dto: CreateAartiDto, user: any) {
    await this.requireTemple(templeId);
    return this.aartis.create({ ...dto, templeId, createdBy: user?.id, updatedBy: user?.id });
  }

  async getAartis(templeId: string, publicOnly = false) {
    const filter: any = { templeId };
    if (publicOnly) filter.isActive = { $ne: false };
    return this.aartis.find(filter).sort({ startTime: 1 }).lean();
  }

  async addFestival(templeId: string, dto: CreateFestivalDto, user: any) {
    await this.requireTemple(templeId);
    this.validateFestivalDates(dto.startDate, dto.endDate);
    return this.festivals.create({ ...dto, templeId, createdBy: user?.id, updatedBy: user?.id });
  }

  async getFestivals(templeId: string, publicOnly = true) {
    const filter: any = { templeId };
    if (publicOnly) filter.isActive = { $ne: false };
    return this.festivals.find(filter).sort({ startDate: 1 }).lean();
  }

  async updateAarti(templeId: string, aartiId: string, dto: Partial<CreateAartiDto>, user: any) {
    const aarti = await this.aartis.findOneAndUpdate({ _id: aartiId, templeId }, { ...dto, updatedBy: user?.id }, { new: true }).lean();
    if (!aarti) throw new NotFoundException("Aarti not found");
    return aarti;
  }

  async deleteAarti(templeId: string, aartiId: string, user: any) {
    const result = await this.aartis.findOneAndUpdate({ _id: aartiId, templeId }, { isActive: false, updatedBy: user?.id }, { new: true });
    if (!result) throw new NotFoundException("Aarti not found");
  }

  async updateFestival(templeId: string, festivalId: string, dto: Partial<CreateFestivalDto>, user: any) {
    if (dto.startDate != null || dto.endDate != null) {
      const current = await this.festivals.findOne({ _id: festivalId, templeId }).select("startDate endDate").lean();
      this.validateFestivalDates(dto.startDate ?? current?.startDate, dto.endDate ?? current?.endDate);
    }
    const festival = await this.festivals.findOneAndUpdate({ _id: festivalId, templeId }, { ...dto, updatedBy: user?.id }, { new: true }).lean();
    if (!festival) throw new NotFoundException("Festival not found");
    return festival;
  }

  async deleteFestival(templeId: string, festivalId: string, user: any) {
    const result = await this.festivals.findOneAndUpdate({ _id: festivalId, templeId }, { isActive: false, updatedBy: user?.id }, { new: true });
    if (!result) throw new NotFoundException("Festival not found");
  }

  private async requireTemple(id: string) {
    const temple = await this.temples.findOne({ _id: id, deletedAt: null }).select("_id").lean();
    if (!temple) throw new NotFoundException("Temple not found");
    return temple;
  }

  private normalizeAddress(address: any) {
    const coordinates = Array.isArray(address.coordinates) ? address.coordinates : address.coordinates?.coordinates;
    return { ...address, coordinates: { type: "Point", coordinates } };
  }

  private validateCoordinates(coordinates: any) {
    const values = Array.isArray(coordinates) ? coordinates : coordinates?.coordinates;
    if (!Array.isArray(values) || values.length !== 2 || values.some((value) => typeof value !== "number" || Number.isNaN(value))) {
      throw new BadRequestException("Coordinates must be [longitude, latitude]");
    }
    if (values[0] < -180 || values[0] > 180 || values[1] < -90 || values[1] > 90) {
      throw new BadRequestException("Coordinates are outside valid geographic bounds");
    }
    // [0, 0] is the Gulf-of-Guinea placeholder the admin form ships by default.
    // Persisting it silently breaks the map, directions and every nearby query.
    if (values[0] === 0 && values[1] === 0) {
      throw new BadRequestException("Set the temple location on the map before saving — coordinates cannot be 0, 0");
    }
  }

  private validateFestivalDates(startDate?: string | Date, endDate?: string | Date) {
    if (startDate == null || endDate == null) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Festival dates are invalid");
    }
    if (end < start) {
      throw new BadRequestException("Festival end date cannot be before the start date");
    }
  }

  /** Run one $nearSphere lookup, returning [] instead of throwing when the
   *  collection has no usable 2dsphere index or the query otherwise fails. */
  private async safeNear(model: Model<any>, geoField: string, lng: number, lat: number, maxMeters: number, extra: Record<string, any>, projection: string, limit: number) {
    try {
      return await model
        .find({
          ...extra,
          [geoField]: {
            $nearSphere: {
              $geometry: { type: "Point", coordinates: [lng, lat] },
              $maxDistance: maxMeters,
            },
          },
        })
        .select(projection)
        .limit(limit)
        .lean();
    } catch {
      return [];
    }
  }

  private readonly homestayPattern = /home\s*stay|guest\s*house|rest\s*house|temple\s*trust\s*stay/i;

  private async nearbyBundle(lng: number, lat: number, radiusKm: number, excludeTempleId?: any, anchorCity?: string) {
    const maxMeters = radiusKm * 1000;
    const templeFilter: Record<string, any> = { deletedAt: null, status: { $in: ["published", "active"] } };
    if (excludeTempleId) templeFilter._id = { $ne: excludeTempleId };

    const [ashramsRaw, parking, temples, prasad] = await Promise.all([
      this.safeNear(this.ashrams, "address.coordinates", lng, lat, maxMeters, { deletedAt: null, status: "approved" }, "name slug address images ashramType rating pricing", 20),
      this.safeNear(this.parkingLocations, "geo", lng, lat, maxMeters, { status: "active" }, "name slug address geo coverImage images rating totalCapacity", 10),
      this.safeNear(this.temples, "address.coordinates", lng, lat, maxMeters, templeFilter, "name slug address media.coverImage deity", 10),
      this.nearbyPrasad(anchorCity),
    ]);

    const ashrams = (ashramsRaw as any[]).filter((row) => !this.homestayPattern.test(String(row.ashramType || row.name || "")));
    const homestays = (ashramsRaw as any[]).filter((row) => this.homestayPattern.test(String(row.ashramType || row.name || "")));

    return {
      temples: addDistances(lng, lat, temples),
      ashrams: addDistances(lng, lat, ashrams),
      homestays: addDistances(lng, lat, homestays),
      parking: addDistances(lng, lat, parking),
      prasad: addDistances(lng, lat, prasad),
    };
  }

  /** Local services (prasad, pandit, etc.) carry no coordinates in the content
   *  schema, so proximity falls back to a same-city match. Best-effort only. */
  private async nearbyPrasad(city?: string) {
    try {
      if (!city) return [];
      return await this.localServices
        .find({
          city: new RegExp(`^${String(city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
          status: { $in: ["published", "active", "approved"] },
        })
        .select("name slug title city category image coverImage")
        .limit(10)
        .lean();
    } catch {
      return [];
    }
  }

  /**
   * Nearby entities for one temple, computed live from its coordinates.
   *
   * Nothing is denormalised onto the Temple document: a newly published ashram,
   * homestay, parking lot or temple in range shows up on the next request with
   * no edit to this temple. A missing/invalid coordinate pair yields empty
   * lists rather than an error, and each sub-lookup is individually guarded so
   * one collection without a geo index cannot 500 the whole response.
   */
  async findNearbyEntities(templeId: string, radiusKm: number = 5) {
    const temple = await this.temples.findById(templeId).select("address.coordinates address.city").lean();
    const coords = temple?.address?.coordinates?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2 || (coords[0] === 0 && coords[1] === 0)) {
      return { temples: [], ashrams: [], homestays: [], parking: [], prasad: [] };
    }
    const [lng, lat] = coords;
    return this.nearbyBundle(lng, lat, radiusKm, temple!._id, temple?.address?.city);
  }

  async findNearbyEntitiesByCoords(lng: number, lat: number, radiusKm: number = 10) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
      return { temples: [], ashrams: [], homestays: [], parking: [], prasad: [] };
    }
    return this.nearbyBundle(lng, lat, radiusKm);
  }
}
