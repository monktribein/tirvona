import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

/**
 * Creates the marketplace indexes. Production runs with autoIndex off, so run
 * `npx ts-node src/modules/marketplace/scripts/create-marketplace-indexes.ts`
 * once after deploying (safe to repeat).
 */
@Injectable()
export class MarketplaceIndexService {
  private readonly logger = new Logger(MarketplaceIndexService.name);

  constructor(
    @InjectModel("MpVendor") private readonly vendors: Model<any>,
    @InjectModel("MpCategory") private readonly categories: Model<any>,
    @InjectModel("MpProduct") private readonly products: Model<any>,
    @InjectModel("MpVendorDocument") private readonly documents: Model<any>,
    @InjectModel("MpVendorBankAccount") private readonly bankAccounts: Model<any>,
    @InjectModel("MpMasterOrder") private readonly masterOrders: Model<any>,
    @InjectModel("MpVendorOrder") private readonly vendorOrders: Model<any>,
    @InjectModel("MpLedgerEntry") private readonly ledger: Model<any>,
    @InjectModel("MpPayout") private readonly payouts: Model<any>,
    @InjectModel("MpSettings") private readonly settings: Model<any>,
    @InjectModel("MpReview") private readonly reviews: Model<any>,
  ) {}

  async ensureIndexes(): Promise<{ created: string[]; failed: string[] }> {
    const created: string[] = [];
    const failed: string[] = [];
    for (const model of [
      this.vendors, this.documents, this.bankAccounts, this.masterOrders, this.vendorOrders,
      this.ledger, this.payouts, this.settings, this.reviews, this.products, this.categories,
    ]) {
      try {
        await model.createIndexes();
        created.push(model.collection.name);
      } catch (err: any) {
        // Shared collections may hold old data that violates a new index; report, don't abort.
        this.logger.error(`Index creation failed for ${model.collection.name}: ${err?.message}`);
        failed.push(model.collection.name);
      }
    }
    return { created, failed };
  }
}
