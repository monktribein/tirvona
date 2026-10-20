/**
 * The money rules of a kitchen's wallet, as pure functions. Amounts are integer paise.
 *
 * A customer pays Tirvona. For every order the kitchen has handed over, Tirvona owes it the food value
 * minus its commission and the GST on that commission. Tirvona pays the kitchen outside the app and
 * records each payment; what is still owed is what was earned minus what was received.
 */

/** GST Tirvona charges on its commission. Settlements use the same rate and the same rounding. */
export const FOOD_GST_ON_COMMISSION_RATE = 0.18;

export const gstOnCommissionPaise = (commissionPaise: number): number =>
  Math.round(commissionPaise * FOOD_GST_ON_COMMISSION_RATE);

export interface FoodEarning {
  foodValuePaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  /** What Tirvona owes the kitchen for the order. */
  netPaise: number;
}

/**
 * What one order earns the kitchen.
 *
 * The commission is the one Tirvona booked when the customer paid (`vendorCreditPaise` is the food value
 * left for the kitchen after it), so a later change of the outlet's commission rate never rewrites
 * orders that were already earned. Orders without that ledger entry fall back to the outlet's rate.
 */
export function earningOf(
  subtotalPaise: number,
  vendorCreditPaise: number | undefined,
  commissionRateBps: number,
): FoodEarning {
  const commissionPaise = Math.max(
    0,
    vendorCreditPaise === undefined
      ? Math.round((subtotalPaise * commissionRateBps) / 10000)
      : subtotalPaise - vendorCreditPaise,
  );
  const gst = gstOnCommissionPaise(commissionPaise);
  return {
    foodValuePaise: subtotalPaise,
    commissionPaise,
    gstOnCommissionPaise: gst,
    netPaise: subtotalPaise - commissionPaise - gst,
  };
}
