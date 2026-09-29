/**
 * Pure pricing / commission / order-splitting maths. All arithmetic is done
 * in integer paise and converted back to rupees (2dp) at the edges so sums
 * always reconcile exactly.
 */

export const toPaise = (rupees: number): number => Math.round(Number(rupees) * 100);
export const toRupees = (paise: number): number => Math.round(paise) / 100;

/** Percentage of an amount in paise, rounded half-up to the nearest paisa. */
export const percentOf = (paise: number, percent: number): number =>
  Math.round((paise * Number(percent)) / 100);

export interface PricingSettings {
  defaultGstPercent: number;
  shippingFee: number; // rupees, charged per vendor order
  freeShippingAbove: number; // rupees, per vendor order subtotal
}

export interface CartLineInput {
  productId: string;
  vendorId: string;
  vendorStoreName: string;
  categoryId?: string | null;
  name: string;
  slug?: string;
  sku?: string;
  image?: string;
  unitPrice: number; // rupees, selling price excl. GST
  gstPercent?: number | null;
  quantity: number;
  commissionPercent: number; // resolved for this product
}

export interface PricedLine {
  productId: string;
  categoryId?: string | null;
  name: string;
  slug?: string;
  sku?: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  gstPercent: number;
  subtotal: number;
  gstAmount: number;
  lineTotal: number;
  commissionPercent: number;
  commissionAmount: number;
}

export interface VendorSplit {
  vendorId: string;
  vendorStoreName: string;
  items: PricedLine[];
  subtotal: number;
  gstAmount: number;
  shippingFee: number;
  total: number;
  commissionAmount: number;
  /** What the vendor is owed for this vendor order: total - commission. */
  vendorEarning: number;
}

export interface SplitResult {
  vendorOrders: VendorSplit[];
  pricing: {
    itemsSubtotal: number;
    gstAmount: number;
    shippingFee: number;
    commissionAmount: number;
    totalAmount: number;
    currency: "INR";
  };
}

/**
 * Prices a cart and splits it into one group per vendor.
 *
 * - GST is charged on each line's subtotal.
 * - Commission is charged on the line subtotal (excl. GST and shipping).
 * - Shipping is charged per vendor order (each vendor ships its own parcel)
 *   and waived when that vendor's subtotal reaches `freeShippingAbove`.
 * - The vendor earns: subtotal + GST + shipping - commission.
 */
export function splitCart(lines: CartLineInput[], settings: PricingSettings): SplitResult {
  const groups = new Map<string, VendorSplit>();
  const pSubtotal = new Map<string, number>();
  const pGst = new Map<string, number>();
  const pCommission = new Map<string, number>();

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error(`Invalid quantity for ${line.name}`);
    }
    const gstPercent = line.gstPercent ?? settings.defaultGstPercent;
    const unitPaise = toPaise(line.unitPrice);
    const subtotalPaise = unitPaise * line.quantity;
    const gstPaise = percentOf(subtotalPaise, gstPercent);
    const commissionPaise = percentOf(subtotalPaise, line.commissionPercent);

    const priced: PricedLine = {
      productId: line.productId,
      categoryId: line.categoryId ?? null,
      name: line.name,
      slug: line.slug,
      sku: line.sku,
      image: line.image,
      unitPrice: toRupees(unitPaise),
      quantity: line.quantity,
      gstPercent,
      subtotal: toRupees(subtotalPaise),
      gstAmount: toRupees(gstPaise),
      lineTotal: toRupees(subtotalPaise + gstPaise),
      commissionPercent: line.commissionPercent,
      commissionAmount: toRupees(commissionPaise),
    };

    let group = groups.get(line.vendorId);
    if (!group) {
      group = {
        vendorId: line.vendorId,
        vendorStoreName: line.vendorStoreName,
        items: [],
        subtotal: 0,
        gstAmount: 0,
        shippingFee: 0,
        total: 0,
        commissionAmount: 0,
        vendorEarning: 0,
      };
      groups.set(line.vendorId, group);
    }
    group.items.push(priced);
    pSubtotal.set(line.vendorId, (pSubtotal.get(line.vendorId) ?? 0) + subtotalPaise);
    pGst.set(line.vendorId, (pGst.get(line.vendorId) ?? 0) + gstPaise);
    pCommission.set(line.vendorId, (pCommission.get(line.vendorId) ?? 0) + commissionPaise);
  }

  let totSub = 0;
  let totGst = 0;
  let totShip = 0;
  let totComm = 0;
  const vendorOrders = [...groups.values()].map((g) => {
    const sub = pSubtotal.get(g.vendorId) ?? 0;
    const gst = pGst.get(g.vendorId) ?? 0;
    const comm = pCommission.get(g.vendorId) ?? 0;
    const ship = sub >= toPaise(settings.freeShippingAbove) ? 0 : toPaise(settings.shippingFee);
    const total = sub + gst + ship;
    totSub += sub;
    totGst += gst;
    totShip += ship;
    totComm += comm;
    return {
      ...g,
      subtotal: toRupees(sub),
      gstAmount: toRupees(gst),
      shippingFee: toRupees(ship),
      total: toRupees(total),
      commissionAmount: toRupees(comm),
      vendorEarning: toRupees(total - comm),
    };
  });

  return {
    vendorOrders,
    pricing: {
      itemsSubtotal: toRupees(totSub),
      gstAmount: toRupees(totGst),
      shippingFee: toRupees(totShip),
      commissionAmount: toRupees(totComm),
      totalAmount: toRupees(totSub + totGst + totShip),
      currency: "INR",
    },
  };
}

/**
 * Commission precedence: vendor override > nearest category (walking up the
 * parent chain) > global default.
 */
export function resolveCommissionPercent(input: {
  vendorOverride?: number | null;
  categoryChain?: Array<number | null | undefined>; // nearest first
  globalDefault: number;
}): number {
  if (input.vendorOverride !== undefined && input.vendorOverride !== null) return input.vendorOverride;
  for (const pct of input.categoryChain ?? []) {
    if (pct !== undefined && pct !== null) return pct;
  }
  return input.globalDefault;
}
