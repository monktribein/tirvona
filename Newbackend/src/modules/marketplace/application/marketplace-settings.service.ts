import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { omit } from "../domain/omit";
import { resolveCommissionPercent } from "../domain/pricing";
import { MarketplaceAuditService } from "./marketplace-audit.service";

export interface MarketplaceSettings {
  defaultCommissionPercent: number;
  settlementHoldDays: number;
  returnWindowDays: number;
  defaultGstPercent: number;
  shippingFee: number;
  freeShippingAbove: number;
  reservationMinutes: number;
  minimumPayoutAmount: number;
}

const envNumber = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Initial values used only until a Super Admin saves settings. They mirror
 * the legacy checkout (5% GST, ₹60 shipping, free above ₹999). Commission and
 * settlement hold default to 0 on purpose: the business must set them.
 */
export const defaultSettings = (): MarketplaceSettings => ({
  defaultCommissionPercent: envNumber("MARKETPLACE_DEFAULT_COMMISSION_PERCENT", 0),
  settlementHoldDays: envNumber("MARKETPLACE_SETTLEMENT_HOLD_DAYS", 0),
  returnWindowDays: envNumber("MARKETPLACE_RETURN_WINDOW_DAYS", 0),
  defaultGstPercent: 5,
  shippingFee: 60,
  freeShippingAbove: 999,
  reservationMinutes: 15,
  minimumPayoutAmount: 100,
});

const LIMITS: Record<keyof MarketplaceSettings, [number, number]> = {
  defaultCommissionPercent: [0, 100],
  settlementHoldDays: [0, 90],
  returnWindowDays: [0, 90],
  defaultGstPercent: [0, 28],
  shippingFee: [0, 100000],
  freeShippingAbove: [0, 10000000],
  reservationMinutes: [5, 60],
  minimumPayoutAmount: [1, 10000000],
};

@Injectable()
export class MarketplaceSettingsService {
  constructor(
    @InjectModel("MpSettings") private readonly settings: Model<any>,
    @InjectModel("MpCategory") private readonly categories: Model<any>,
    private readonly audit: MarketplaceAuditService,
  ) {}

  async get(): Promise<MarketplaceSettings> {
    const doc = await this.settings.findOne({ key: "default" }).lean();
    return { ...defaultSettings(), ...(doc ? stripMeta(doc) : {}) };
  }

  async update(patch: Partial<MarketplaceSettings>, actor: AuthenticatedUser): Promise<MarketplaceSettings> {
    const before = await this.get();
    const clean: Partial<MarketplaceSettings> = {};
    for (const [k, v] of Object.entries(patch) as [keyof MarketplaceSettings, unknown][]) {
      if (!(k in LIMITS) || v === undefined) continue;
      const n = Number(v);
      const [min, max] = LIMITS[k];
      if (!Number.isFinite(n) || n < min || n > max) {
        throw new BadRequestException(`${k} must be between ${min} and ${max}`);
      }
      clean[k] = n;
    }
    await this.settings.updateOne(
      { key: "default" },
      { $set: { ...clean, updatedBy: actor.id }, $setOnInsert: { key: "default" } },
      { upsert: true },
    );
    const after = await this.get();
    await this.audit.log(actor, "settings.updated", "MpSettings", "default", { before, after });
    return after;
  }

  /** Commission % for a product: vendor override > category chain > global. */
  async commissionFor(vendor: { commissionPercent?: number | null }, categoryId?: unknown): Promise<number> {
    const settings = await this.get();
    const chain: Array<number | null> = [];
    let current = categoryId ? String(categoryId) : null;
    for (let depth = 0; current && depth < 10; depth++) {
      const cat: any = await this.categories.findById(current).select("commissionPercent parentId").lean();
      if (!cat) break;
      chain.push(cat.commissionPercent ?? null);
      current = cat.parentId ? String(cat.parentId) : null;
    }
    return resolveCommissionPercent({
      vendorOverride: vendor.commissionPercent,
      categoryChain: chain,
      globalDefault: settings.defaultCommissionPercent,
    });
  }
}

function stripMeta(doc: any): Partial<MarketplaceSettings> {
  return omit(doc, ["_id", "__v", "key", "createdAt", "updatedAt", "updatedBy"]) as Partial<MarketplaceSettings>;
}
