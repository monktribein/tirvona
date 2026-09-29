import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

export interface StockLine {
  productId: unknown;
  quantity: number;
  name?: string;
  /** False for products that don't track inventory (unlimited). */
  inventoryTracked?: boolean;
}

/**
 * Stock movements. Every change is a single conditional `findOneAndUpdate`
 * on the product document, so it is atomic without a transaction and can
 * never drive a counter negative:
 *
 *   reserve : stock -q, reserved +q   (only if stock >= q)
 *   release : stock +q, reserved -q   (only if reserved >= q)
 *   commit  : reserved -q, sold +q    (only if reserved >= q)
 *   restock : stock +q, sold -q       (only if sold >= q)
 *
 * `stock` is the available quantity and is shared with the legacy checkout.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(@InjectModel("MpProduct") private readonly products: Model<any>) {}

  /** Reserves every line or none: on any shortage, already-reserved lines are released. */
  async reserveAll(lines: StockLine[]): Promise<void> {
    const done: StockLine[] = [];
    try {
      for (const line of lines) {
        if (line.inventoryTracked === false) continue;
        const updated = await this.products.findOneAndUpdate(
          { _id: line.productId, "inventory.trackInventory": { $ne: false }, stock: { $gte: line.quantity } },
          { $inc: { stock: -line.quantity, "inventory.reserved": line.quantity } },
          { new: true },
        );
        if (!updated) throw new ConflictException(`${line.name ?? "An item"} does not have enough stock`);
        done.push(line);
      }
    } catch (err) {
      await this.releaseAll(done);
      throw err;
    }
  }

  async releaseAll(lines: StockLine[]): Promise<void> {
    for (const line of lines) {
      if (line.inventoryTracked === false) continue;
      const res = await this.products.updateOne(
        { _id: line.productId, "inventory.reserved": { $gte: line.quantity } },
        { $inc: { stock: line.quantity, "inventory.reserved": -line.quantity } },
      );
      if (!res.modifiedCount) this.logger.error(`Release mismatch for product ${String(line.productId)} x${line.quantity}`);
    }
  }

  async commitAll(lines: StockLine[]): Promise<void> {
    for (const line of lines) {
      if (line.inventoryTracked === false) {
        await this.products.updateOne({ _id: line.productId }, { $inc: { "inventory.sold": line.quantity } });
        continue;
      }
      const res = await this.products.updateOne(
        { _id: line.productId, "inventory.reserved": { $gte: line.quantity } },
        { $inc: { "inventory.reserved": -line.quantity, "inventory.sold": line.quantity } },
      );
      if (!res.modifiedCount) this.logger.error(`Commit mismatch for product ${String(line.productId)} x${line.quantity}`);
    }
  }

  /** Puts sold units back on sale (cancellation / return of a paid order). */
  async restockAll(lines: StockLine[]): Promise<void> {
    for (const line of lines) {
      const inc: Record<string, number> = { "inventory.sold": -line.quantity };
      if (line.inventoryTracked !== false) inc.stock = line.quantity;
      await this.products.updateOne({ _id: line.productId, "inventory.sold": { $gte: line.quantity } }, { $inc: inc });
    }
  }

  /** Vendor sets the on-hand available quantity (reservations are unaffected). */
  async setAvailable(productFilter: Record<string, unknown>, available: number, extra: Record<string, unknown> = {}): Promise<any> {
    if (!Number.isInteger(available) || available < 0) {
      throw new BadRequestException("Stock must be a whole number of 0 or more");
    }
    const updated = await this.products.findOneAndUpdate(
      productFilter,
      { $set: { stock: available, ...extra } },
      { new: true },
    );
    if (!updated) throw new NotFoundException("Product not found");
    return updated;
  }
}
