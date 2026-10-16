import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { createHash, randomBytes } from "crypto";

export interface CreateQuoteDto {
  outletId: string;
  items: Array<{
    variantId: string;
    quantity: number;
    customerNotes?: string;
  }>;
  fulfilmentType: "pickup" | "vendor_delivery" | "stay_delivery";
  destinationAddress?: string;
  stayBookingId?: string;
  stayRoomNumber?: string;
  customerId?: string;
  sessionId?: string;
  zoneCode?: string;
}

@Injectable()
export class FoodQuoteService {
  constructor(
    @InjectModel("FoodQuote") private readonly quoteModel: Model<any>,
    @InjectModel("FoodOutlet") private readonly outletModel: Model<any>,
    @InjectModel("FoodVendor") private readonly vendorModel: Model<any>,
    @InjectModel("FoodProductVariant")
    private readonly variantModel: Model<any>,
    @InjectModel("FoodServiceZone") private readonly zoneModel: Model<any>,
  ) {}

  /**
   * Generates a server-authoritative checkout quote.
   * Revalidates price, outlet, variant availability, zone and minimum order.
   */
  async generateQuote(dto: CreateQuoteDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException("Quote must contain at least one item");
    }

    const outlet = await this.outletModel.findById(dto.outletId);
    if (!outlet) {
      throw new NotFoundException("Selected restaurant outlet not found");
    }

    const vendor = await this.vendorModel.findById(outlet.vendorId);
    if (!vendor || vendor.status !== "active") {
      throw new BadRequestException(
        "This restaurant is not open for orders on Tirvona right now",
      );
    }

    if (outlet.status !== "active" || outlet.isPaused) {
      throw new BadRequestException(
        "This outlet is currently not accepting new orders (paused or closed)",
      );
    }

    if (
      dto.fulfilmentType !== "pickup" &&
      outlet.fulfilmentModes &&
      !outlet.fulfilmentModes.includes(dto.fulfilmentType)
    ) {
      throw new BadRequestException(
        `Selected outlet does not support ${dto.fulfilmentType}`,
      );
    }

    // Verify all variants belong to this outlet and are available
    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await this.variantModel.find({
      _id: { $in: variantIds },
    });

    const variantMap = new Map(variants.map((v: any) => [v._id.toString(), v]));

    let subtotalPaise = 0;
    const itemSnapshots: any[] = [];

    for (const item of dto.items) {
      const v = variantMap.get(item.variantId);
      if (!v) {
        throw new BadRequestException(
          `Meal variant ${item.variantId} not found in catalog`,
        );
      }

      if (v.outletId.toString() !== dto.outletId) {
        throw new BadRequestException(
          "All items in the cart must belong to the same fulfilling outlet",
        );
      }

      if (!v.isAvailable) {
        throw new BadRequestException(
          `Item "${v.label}" is currently unavailable or sold out`,
        );
      }

      if (!item.quantity || item.quantity <= 0) {
        throw new BadRequestException("Item quantity must be at least 1");
      }
      const qty = Math.floor(item.quantity);
      const lineTotalPaise = v.pricePaise * qty;
      subtotalPaise += lineTotalPaise;

      itemSnapshots.push({
        variantId: v._id.toString(),
        sku: v.sku,
        name: v.label,
        quantity: qty,
        unitPricePaise: v.pricePaise,
        totalPricePaise: lineTotalPaise,
        dietaryTags: v.dietaryTags,
        contents: v.contents,
        portion: v.portion,
        customerNotes: item.customerNotes || "",
      });
    }

    if (outlet.minOrderPaise && subtotalPaise < outlet.minOrderPaise) {
      throw new BadRequestException(
        `Minimum food order for this outlet is ₹${outlet.minOrderPaise / 100}`,
      );
    }

    // Delivery fee calculation
    let deliveryFeePaise = 0;
    if (dto.fulfilmentType !== "pickup") {
      let zoneFee = 3500; // default ₹35
      if (dto.zoneCode) {
        const zone = await this.zoneModel.findOne({
          zoneCode: dto.zoneCode,
          active: true,
        });
        if (zone?.deliveryFeePaise) {
          zoneFee = zone.deliveryFeePaise;
        }
      }
      deliveryFeePaise = zoneFee;
    }

    // Eco-friendly satvik meal container packaging
    const packagingFeePaise = 1500; // ₹15 flat

    // 5% GST on food subtotal
    const taxPaise = Math.round(subtotalPaise * 0.05);

    const discountPaise = 0;
    const totalPaise =
      subtotalPaise + deliveryFeePaise + packagingFeePaise + taxPaise - discountPaise;

    const quoteId = `QUO-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min SLA

    // Quote cryptographic hash for integrity check
    const rawPayload = `${quoteId}:${dto.outletId}:${subtotalPaise}:${totalPaise}:${expiresAt.getTime()}`;
    const quoteHash = createHash("sha256").update(rawPayload).digest("hex");

    const createdQuote = await this.quoteModel.create({
      quoteId,
      quoteHash,
      customerId: dto.customerId || null,
      sessionId: dto.sessionId || null,
      outletId: outlet._id,
      items: itemSnapshots,
      subtotalPaise,
      deliveryFeePaise,
      packagingFeePaise,
      taxPaise,
      discountPaise,
      totalPaise,
      fulfilmentType: dto.fulfilmentType,
      destinationAddress: dto.destinationAddress || "",
      stayBookingId: dto.stayBookingId || "",
      stayRoomNumber: dto.stayRoomNumber || "",
      expiresAt,
    });

    return {
      quoteId: createdQuote.quoteId,
      outlet: {
        id: outlet._id,
        brandName: outlet.brandName,
        address: outlet.address,
      },
      items: itemSnapshots,
      pricing: {
        subtotalPaise,
        subtotalRupees: subtotalPaise / 100,
        deliveryFeePaise,
        deliveryFeeRupees: deliveryFeePaise / 100,
        packagingFeePaise,
        packagingFeeRupees: packagingFeePaise / 100,
        taxPaise,
        taxRupees: taxPaise / 100,
        discountPaise,
        discountRupees: discountPaise / 100,
        totalPaise,
        totalRupees: totalPaise / 100,
      },
      fulfilmentType: dto.fulfilmentType,
      destinationAddress: dto.destinationAddress,
      stayBookingId: dto.stayBookingId,
      stayRoomNumber: dto.stayRoomNumber,
      expiresAt: createdQuote.expiresAt,
    };
  }

  /**
   * Validates quote existence, unexpired status, and matching total amount.
   */
  async validateQuote(quoteId: string, expectedTotalPaise?: number) {
    const quote = await this.quoteModel.findOne({ quoteId });
    if (!quote) {
      throw new NotFoundException("Quote not found or invalid");
    }

    if (new Date() > new Date(quote.expiresAt)) {
      throw new BadRequestException("Quote has expired. Please refresh checkout.");
    }

    if (
      expectedTotalPaise !== undefined &&
      quote.totalPaise !== expectedTotalPaise
    ) {
      throw new BadRequestException(
        "Quote price mismatch. Pricing has been updated.",
      );
    }

    return quote;
  }
}
