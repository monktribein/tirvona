import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import {
  LAUNCH_BOWLS,
  LAUNCH_COMBOS,
  PILOT_SERVICE_ZONES,
  THALI_VARIANTS,
} from "../domain/food.constants";

@Injectable()
export class FoodCatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FoodCatalogService.name);

  constructor(
    @InjectModel("FoodVendor") private readonly vendorModel: Model<any>,
    @InjectModel("FoodOutlet") private readonly outletModel: Model<any>,
    @InjectModel("FoodProduct") private readonly productModel: Model<any>,
    @InjectModel("FoodProductVariant")
    private readonly variantModel: Model<any>,
    @InjectModel("FoodServiceZone") private readonly zoneModel: Model<any>,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.seedPilotDataIfEmpty();
    } catch (err: any) {
      this.logger.warn(`Could not seed food pilot catalogue: ${err.message}`);
    }
  }

  /**
   * Seeds the pilot zones, verified launch vendors, outlets, canonical products
   * and the exact documented catalogue (4 Thalis, 6 Bowls, 11 Combos) if not already seeded.
   */
  async seedPilotDataIfEmpty() {
    const zoneCount = await this.zoneModel.countDocuments();
    if (zoneCount === 0) {
      this.logger.log("Seeding pilot food service zones...");
      for (const z of PILOT_SERVICE_ZONES) {
        await this.zoneModel.create({
          zoneCode: z.zoneCode,
          name: z.name,
          description: z.description,
          active: z.active,
          deliveryFeePaise: z.deliveryFeePaise,
          minOrderPaise: z.minOrderPaise,
        });
      }
    }

    const vendorCount = await this.vendorModel.countDocuments();
    if (vendorCount === 0) {
      this.logger.log("Seeding launch food vendors and outlets...");
      // 1. Tirvona Bhojan Kitchen (Tirvona Branded / Pilot Partner)
      const tirvonaVendor = await this.vendorModel.create({
        businessName: "Tirvona Bhojan Kitchens",
        fssaiReference: "10022051000142",
        complianceStatus: "active",
        ownerUserId: null, // platform-owned until a real owner account is attached
        contactName: "Pt. Ramesh Sharma",
        contactPhone: "+91 98765 43210",
        contactEmail: "bhojan@tirvona.com",
        status: "active",
      });

      const vrindavanOutlet = await this.outletModel.create({
        vendorId: tirvonaVendor._id,
        brandName: "Tirvona Bhojan — Raman Reti Kitchen",
        address: "Opp. Prem Mandir, Raman Reti Road, Vrindavan, UP 281121",
        lat: 27.5706,
        lng: 77.7007,
        openTime: "07:30",
        closeTime: "22:30",
        serviceZoneCodes: ["VRINDAVAN_CORE", "CHATIKARA"],
        status: "active",
        fulfilmentModes: ["pickup", "vendor_delivery", "stay_delivery"],
        contactPhone: "+91 98765 43210",
        capacityPerHour: 60,
        commissionRateBps: 1250, // 12.5%
        minOrderPaise: 9900,
        avgPrepMinutes: 18,
        isPaused: false,
        rating: 4.9,
        ratingCount: 88,
        imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
        description: "100% Satvik, pure desi ghee preparations crafted with pilgrimage sanctity in Vrindavan.",
      });

      // 2. Mathura Partner Outlet (Brijwasi Satvik Rasoi)
      const brijwasiVendor = await this.vendorModel.create({
        businessName: "Brijwasi Heritage Foods",
        fssaiReference: "10023051000981",
        complianceStatus: "active",
        ownerUserId: null,
        contactName: "Gopal Das Agarwal",
        contactPhone: "+91 98222 11334",
        contactEmail: "orders@brijwasifoods.in",
        status: "active",
      });

      const mathuraOutlet = await this.outletModel.create({
        vendorId: brijwasiVendor._id,
        brandName: "Brijwasi Satvik Rasoi — Janmabhoomi Marg",
        address: "Near Janmabhoomi Gate 3, Deeg Gate, Mathura, UP 281001",
        lat: 27.4924,
        lng: 77.6737,
        openTime: "08:00",
        closeTime: "22:00",
        serviceZoneCodes: ["MATHURA_CITY"],
        status: "active",
        fulfilmentModes: ["pickup", "vendor_delivery"],
        contactPhone: "+91 98222 11334",
        capacityPerHour: 45,
        commissionRateBps: 1200, // 12%
        minOrderPaise: 9900,
        avgPrepMinutes: 20,
        isPaused: false,
        rating: 4.7,
        ratingCount: 52,
        imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
        description: "Authentic Braj flavours, fresh bedmi pooris, and traditional Mathura combos.",
      });

      // Seed Products & Variants for Tirvona Bhojan Raman Reti Outlet
      await this.seedCatalogueForOutlet(vrindavanOutlet);
      await this.seedCatalogueForOutlet(mathuraOutlet);
    }
  }

  private async seedCatalogueForOutlet(outlet: any) {
    // 1. Thali Family
    let thaliProduct = await this.productModel.findOne({
      family: "THALI",
      canonicalName: "Tirvona Thali",
    });
    if (!thaliProduct) {
      thaliProduct = await this.productModel.create({
        family: "THALI",
        canonicalName: "Tirvona Thali",
        description: "Complete nutritious pilgrimage thali: 4 phulkas, seasonal vegetable, yellow daal, rice, raita/curd, roasted papad, and sweet.",
        defaultImageUrl: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        approvedStatus: "approved",
        skuFamily: "THALI",
      });
    }

    // 4 Configurable Thali Variants
    const thaliPrices = [18900, 18900, 19900, 19900]; // ₹189, ₹189, ₹199, ₹199
    for (let i = 0; i < THALI_VARIANTS.length; i++) {
      const tv = THALI_VARIANTS[i];
      await this.variantModel.create({
        outletId: outlet._id,
        productId: thaliProduct._id,
        sku: `${tv.sku}-${outlet._id.toString().slice(-4)}`,
        label: tv.label,
        contents: "4 Soft Phulkas, Paneer Subji, Dal Tadka, Jeera Rice, Curd, Salad, Papad, Sweet",
        dietaryTags: [...tv.tags],
        pricePaise: thaliPrices[i],
        prepMinutes: 15,
        portion: "Full Thali (Serves 1)",
        isAvailable: true,
        dailyCapacity: 80,
        imageUrl: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
      });
    }

    // 2. Six Launch Bowls
    for (const bwl of LAUNCH_BOWLS) {
      let bwlProduct = await this.productModel.findOne({
        family: "BOWL",
        canonicalName: bwl.canonicalName,
      });
      if (!bwlProduct) {
        bwlProduct = await this.productModel.create({
          family: "BOWL",
          canonicalName: bwl.canonicalName,
          description: bwl.contents,
          defaultImageUrl: this.getImageForDish(bwl.canonicalName),
          approvedStatus: "approved",
          skuFamily: bwl.sku,
        });
      }

      await this.variantModel.create({
        outletId: outlet._id,
        productId: bwlProduct._id,
        sku: `${bwl.sku}-${outlet._id.toString().slice(-4)}`,
        label: bwl.label,
        contents: bwl.contents,
        dietaryTags: [...bwl.tags],
        pricePaise: bwl.defaultPricePaise,
        prepMinutes: bwl.prepMinutes,
        portion: bwl.portion,
        isAvailable: true,
        dailyCapacity: 60,
        imageUrl: this.getImageForDish(bwl.canonicalName),
      });
    }

    // 3. Eleven Launch Combos
    for (const cmb of LAUNCH_COMBOS) {
      let cmbProduct = await this.productModel.findOne({
        family: "COMBO",
        canonicalName: cmb.canonicalName,
        skuFamily: cmb.sku,
      });
      if (!cmbProduct) {
        cmbProduct = await this.productModel.create({
          family: "COMBO",
          canonicalName: cmb.canonicalName,
          description: cmb.contents,
          defaultImageUrl: this.getImageForDish(cmb.canonicalName),
          approvedStatus: "approved",
          skuFamily: cmb.sku,
        });
      }

      await this.variantModel.create({
        outletId: outlet._id,
        productId: cmbProduct._id,
        sku: `${cmb.sku}-${outlet._id.toString().slice(-4)}`,
        label: cmb.label,
        contents: cmb.contents,
        dietaryTags: [...cmb.tags],
        pricePaise: cmb.defaultPricePaise,
        prepMinutes: cmb.prepMinutes,
        portion: cmb.portion,
        isAvailable: true,
        dailyCapacity: 50,
        imageUrl: this.getImageForDish(cmb.canonicalName),
      });
    }
  }

  private getImageForDish(name: string): string {
    const map: Record<string, string> = {
      "Rajma Chawal": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
      "Kadhi Chawal": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
      "Chhole Chawal": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
      "Daal Chawal": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
      "Paneer Chawal": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
      "Khichdi": "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=800&q=80",
      "Chhole Bhature": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
      "Poori Sabji": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
      "Idli Sambhar": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
      "Dosa Sambhar": "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80",
      "Vada Sambhar": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
    };
    return map[name] || "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80";
  }

  /**
   * Discovery query: Returns active outlets and approved meals matching criteria.
   * Only outlets serving the selected zone are shown!
   */
  async getDiscovery(query: {
    zoneCode?: string;
    family?: string;
    dietaryTag?: string;
    search?: string;
    outletId?: string;
  }) {
    const outletFilter: any = {
      status: "active",
      isPaused: false,
    };

    // Only approved restaurants are visible; pending, rejected and suspended ones are not.
    const liveVendors = await this.vendorModel
      .find({ status: "active" })
      .select("_id")
      .lean();
    outletFilter.vendorId = { $in: liveVendors.map((v: any) => v._id) };

    if (query.zoneCode) {
      outletFilter.serviceZoneCodes = query.zoneCode;
    }

    if (query.outletId) {
      outletFilter._id = query.outletId;
    }

    const outlets = await this.outletModel.find(outletFilter).lean();
    if (!outlets.length) {
      return {
        outlets: [],
        meals: [],
        zones: await this.zoneModel.find({ active: true }).lean(),
      };
    }

    const outletIds = outlets.map((o: any) => o._id);

    // Query active variants belonging to these outlets
    const variantFilter: any = {
      outletId: { $in: outletIds },
      isAvailable: true,
    };

    if (query.dietaryTag && query.dietaryTag !== "all") {
      variantFilter.dietaryTags = query.dietaryTag;
    }

    let variants = await this.variantModel
      .find(variantFilter)
      .populate("productId")
      .lean();

    // Filter by family if requested
    if (query.family && query.family !== "ALL") {
      variants = variants.filter(
        (v: any) => v.productId && v.productId.family === query.family,
      );
    }

    // Filter by text search if requested
    if (query.search && query.search.trim()) {
      const q = query.search.toLowerCase().trim();
      variants = variants.filter(
        (v: any) =>
          v.label.toLowerCase().includes(q) ||
          (v.contents && v.contents.toLowerCase().includes(q)) ||
          (v.productId && v.productId.canonicalName.toLowerCase().includes(q)),
      );
    }

    // Attach outlet metadata to each variant card
    const outletMap = new Map(outlets.map((o: any) => [o._id.toString(), o]));

    const enrichedMeals = variants.map((v: any) => {
      const outlet = outletMap.get(v.outletId.toString());
      return {
        id: v._id,
        sku: v.sku,
        label: v.label,
        canonicalName: v.productId?.canonicalName || v.label,
        family: v.productId?.family || "BOWL",
        contents: v.contents,
        dietaryTags: v.dietaryTags || [],
        pricePaise: v.pricePaise,
        priceRupees: v.pricePaise / 100,
        prepMinutes: v.prepMinutes,
        portion: v.portion,
        imageUrl: v.imageUrl || v.productId?.defaultImageUrl || (v.imageUrls?.[0] || v.productId?.imageUrls?.[0] || ""),
        imageUrls: v.imageUrls?.length
          ? v.imageUrls
          : (v.productId?.imageUrls?.length
              ? v.productId.imageUrls
              : [v.imageUrl || v.productId?.defaultImageUrl].filter(Boolean)),
        isAvailable: v.isAvailable,
        outlet: outlet
          ? {
              id: outlet._id,
              brandName: outlet.brandName,
              address: outlet.address,
              rating: outlet.rating,
              ratingCount: outlet.ratingCount,
              fulfilmentModes: outlet.fulfilmentModes,
              avgPrepMinutes: outlet.avgPrepMinutes,
            }
          : null,
      };
    });

    const activeZones = await this.zoneModel.find({ active: true }).lean();

    return {
      zones: activeZones,
      outlets: outlets.map((o: any) => ({
        id: o._id,
        brandName: o.brandName,
        address: o.address,
        openTime: o.openTime,
        closeTime: o.closeTime,
        serviceZoneCodes: o.serviceZoneCodes,
        fulfilmentModes: o.fulfilmentModes,
        rating: o.rating,
        ratingCount: o.ratingCount,
        avgPrepMinutes: o.avgPrepMinutes,
        minOrderPaise: o.minOrderPaise,
        imageUrl: o.imageUrl,
        description: o.description,
      })),
      meals: enrichedMeals,
    };
  }

  /**
   * Retrieves full menu and outlet details for a specific outlet
   */
  async getOutletMenu(outletId: string) {
    const outlet = await this.outletModel.findById(outletId).lean();
    if (!outlet) {
      throw new Error("Outlet not found");
    }

    const variants = await this.variantModel
      .find({ outletId: outlet._id })
      .populate("productId")
      .lean();

    const grouped: Record<string, any[]> = {
      THALI: [],
      BOWL: [],
      COMBO: [],
    };

    for (const v of variants) {
      const fam = v.productId?.family || "BOWL";
      if (!grouped[fam]) grouped[fam] = [];
      grouped[fam].push({
        id: v._id,
        sku: v.sku,
        label: v.label,
        contents: v.contents,
        dietaryTags: v.dietaryTags,
        pricePaise: v.pricePaise,
        priceRupees: v.pricePaise / 100,
        prepMinutes: v.prepMinutes,
        portion: v.portion,
        imageUrl: v.imageUrl || v.productId?.defaultImageUrl || (v.imageUrls?.[0] || v.productId?.imageUrls?.[0] || ""),
        imageUrls: v.imageUrls?.length
          ? v.imageUrls
          : (v.productId?.imageUrls?.length
              ? v.productId.imageUrls
              : [v.imageUrl || v.productId?.defaultImageUrl].filter(Boolean)),
      });
    }

    return {
      outlet: {
        id: outlet._id,
        brandName: outlet.brandName,
        address: outlet.address,
        openTime: outlet.openTime,
        closeTime: outlet.closeTime,
        status: outlet.status,
        isPaused: outlet.isPaused,
        serviceZoneCodes: outlet.serviceZoneCodes,
        fulfilmentModes: outlet.fulfilmentModes,
        contactPhone: outlet.contactPhone,
        rating: outlet.rating,
        ratingCount: outlet.ratingCount,
        minOrderPaise: outlet.minOrderPaise,
        avgPrepMinutes: outlet.avgPrepMinutes,
        imageUrl: outlet.imageUrl,
      },
      categories: grouped,
    };
  }

  async getServiceZones() {
    return this.zoneModel.find({ active: true }).lean();
  }
}
