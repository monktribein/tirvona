import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  isLocationScopedUser,
  withLocation,
  type LocationScope,
} from "../../../common/auth/location-scope";
import { HrLocationService } from "../../hr/application/hr-location.service";

/** Outlet address fields an HR login's office area is matched against. */
export const FOOD_OUTLET_LOCATION_FIELDS = ["address"];

/**
 * The food console's location rule for an `hr` login. Only outlets carry an
 * address, so a restaurant is in an HR login's area when one of its outlets
 * is, and orders, menu items, settlements and payments follow their outlet
 * or restaurant. Everything outside the area is reported as not found.
 *
 * Every method is a no-op for other roles (scope null).
 */
@Injectable()
export class FoodLocationService {
  constructor(
    @InjectModel("FoodOutlet") private readonly outlets: Model<any>,
    @InjectModel("FoodProductVariant") private readonly variants: Model<any>,
    @InjectModel("FoodSettlement") private readonly settlements: Model<any>,
    @InjectModel("FoodVendorPayment") private readonly payments: Model<any>,
    @Optional() private readonly hrLocation?: HrLocationService,
  ) {}

  async scopeFor(user: AuthenticatedUser): Promise<LocationScope> {
    if (!isLocationScopedUser(user)) return null;
    return this.hrLocation ? this.hrLocation.scopeFor(user) : { city: "", officeName: "", terms: [] };
  }

  private async outletRows(scope: LocationScope): Promise<any[]> {
    return (await this.outlets
      .find(withLocation({}, scope, FOOD_OUTLET_LOCATION_FIELDS))
      .select("_id vendorId")
      .lean()) as any[];
  }

  /** Outlets in the area; null when unrestricted. */
  async outletIds(scope: LocationScope): Promise<string[] | null> {
    if (scope === null) return null;
    return (await this.outletRows(scope)).map((o) => String(o._id));
  }

  /** Restaurants with at least one outlet in the area; null when unrestricted. */
  async vendorIds(scope: LocationScope): Promise<string[] | null> {
    if (scope === null) return null;
    return [...new Set((await this.outletRows(scope)).map((o) => String(o.vendorId)))];
  }

  async assertVendor(scope: LocationScope, vendorId: string): Promise<void> {
    const ids = await this.vendorIds(scope);
    if (ids && !ids.includes(String(vendorId))) throw new NotFoundException("Restaurant not found");
  }

  async assertOutlet(scope: LocationScope, outletId: string): Promise<void> {
    const ids = await this.outletIds(scope);
    if (ids && !ids.includes(String(outletId))) throw new NotFoundException("Outlet not found");
  }

  async assertMenuItem(scope: LocationScope, variantId: string): Promise<void> {
    if (scope === null) return;
    const variant = (await this.variants.findById(variantId).select("outletId").lean()) as any;
    if (!variant) throw new NotFoundException("Menu item not found");
    await this.assertOutlet(scope, String(variant.outletId));
  }

  /** A catalogue product is in the area when it is on the menu of an outlet there. */
  async assertProduct(scope: LocationScope, productId: string): Promise<void> {
    const ids = await this.outletIds(scope);
    if (!ids) return;
    const onMenu = await this.variants.exists({ productId, outletId: { $in: ids } });
    if (!onMenu) throw new NotFoundException("Product not found");
  }

  async assertSettlement(scope: LocationScope, settlementId: string): Promise<void> {
    if (scope === null) return;
    const settlement = (await this.settlements.findById(settlementId).select("outletId").lean()) as any;
    if (!settlement) throw new NotFoundException("Settlement not found");
    await this.assertOutlet(scope, String(settlement.outletId));
  }

  async assertPayment(scope: LocationScope, paymentId: string): Promise<void> {
    if (scope === null) return;
    const payment = (await this.payments.findById(paymentId).select("vendorId").lean()) as any;
    if (!payment) throw new NotFoundException("Payment not found");
    await this.assertVendor(scope, String(payment.vendorId));
  }

  /** Settlements in the area with a bank transfer still to sync. */
  async syncableSettlementIds(scope: LocationScope): Promise<string[]> {
    const outletIds = (await this.outletIds(scope)) ?? [];
    return (
      (await this.settlements
        .find({ outletId: { $in: outletIds }, status: "approved", payoutReference: { $regex: "^pout_" } })
        .select("_id")
        .lean()) as any[]
    ).map((s) => String(s._id));
  }
}
