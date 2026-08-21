import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import {
  MAX_PROPERTY_SEQUENCE,
  MAX_VISITOR_SEQUENCE,
  formatIdentityCode,
  formatPropertyCode,
  propertyCounterKey,
  resolveClusterCode,
  resolvePropertyTypeCode,
  visitorCounterKey,
  type PropertyTypeCode,
} from "../domain/identity-code";

export interface PropertyIdentity {
  ashramId: string;
  clusterCode: string;
  propertyTypeCode: PropertyTypeCode;
  propertySequence: number;
  propertyCode: string;
  issuedAt: Date;
}

const DUPLICATE_KEY = 11_000;

const isDuplicateKey = (error: unknown): boolean =>
  (error as { code?: number })?.code === DUPLICATE_KEY;

@Injectable()
export class BookingIdentityService {
  constructor(
    @InjectModel("BookingIdentityProperty")
    private readonly properties: Model<any>,
    @InjectModel("BookingIdentityCounter")
    private readonly counters: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
  ) {}

  private async nextSequence(
    key: string,
    session?: ClientSession,
  ): Promise<number> {
    const row = await this.counters.findOneAndUpdate(
      { _id: key },
      { $inc: { sequence: 1 } },
      {
        new: true,
        upsert: true,
        session,
        projection: { sequence: 1 },
        lean: true,
      },
    );
    return Number(row?.sequence ?? 0);
  }

  private toIdentity(row: any): PropertyIdentity {
    return {
      ashramId: String(row.ashramId),
      clusterCode: row.clusterCode,
      propertyTypeCode: row.propertyTypeCode as PropertyTypeCode,
      propertySequence: row.propertySequence,
      propertyCode: row.propertyCode,
      issuedAt: row.issuedAt,
    };
  }

  async findPropertyIdentity(
    ashramId: string,
  ): Promise<PropertyIdentity | null> {
    const row = await this.properties.findOne({ ashramId }).lean();
    return row ? this.toIdentity(row) : null;
  }

  async ensurePropertyIdentity(ashramId: string): Promise<PropertyIdentity> {
    const existing = await this.findPropertyIdentity(ashramId);
    if (existing) return existing;

    const ashram = await this.ashrams
      .findById(ashramId)
      .select("ashramType address.city address.district")
      .lean();
    if (!ashram)
      throw new NotFoundException(
        "That ashram does not exist, so no identity code can be registered for it.",
      );

    const clusterCode = resolveClusterCode((ashram as any).address ?? {});
    const propertyTypeCode = resolvePropertyTypeCode(
      (ashram as any).ashramType,
    );
    const propertySequence = await this.nextSequence(
      propertyCounterKey(clusterCode, propertyTypeCode),
    );
    if (propertySequence > MAX_PROPERTY_SEQUENCE)
      throw new ConflictException(
        `The ${clusterCode}/${propertyTypeCode} register is full at ${MAX_PROPERTY_SEQUENCE} properties. A new cluster code is required.`,
      );

    try {
      const created = await this.properties.create({
        ashramId,
        clusterCode,
        propertyTypeCode,
        propertySequence,
        propertyCode: formatPropertyCode(
          clusterCode,
          propertyTypeCode,
          propertySequence,
        ),
        registeredCity: (ashram as any).address?.city,
        registeredDistrict: (ashram as any).address?.district,
        registeredPropertyType: (ashram as any).ashramType,
      });
      return this.toIdentity(created.toObject());
    } catch (error: unknown) {
      if (!isDuplicateKey(error)) throw error;
      const winner = await this.findPropertyIdentity(ashramId);
      if (winner) return winner;
      throw error;
    }
  }

  async issueForBooking(
    ashramId: string,
    session?: ClientSession,
  ): Promise<string> {
    const property = await this.ensurePropertyIdentity(ashramId);
    const visitorSequence = await this.nextSequence(
      visitorCounterKey(property.propertyCode),
      session,
    );
    if (visitorSequence > MAX_VISITOR_SEQUENCE)
      throw new ConflictException(
        `Property ${property.propertyCode} has issued all ${MAX_VISITOR_SEQUENCE} identity codes available to it.`,
      );
    return formatIdentityCode(property.propertyCode, visitorSequence);
  }
}
