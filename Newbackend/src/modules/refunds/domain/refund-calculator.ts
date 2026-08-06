/**
 * Refund arithmetic, kept free of Nest and Mongoose so it can be reasoned
 * about and tested as pure functions. Nothing here reads the database or the
 * clock; every input is passed in.
 */

/** Round to paise. Mirrors `roundMoney` in the booking domain deliberately —
 *  a refund that disagrees with the charge by a paise will not reconcile. */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export interface RefundPolicyInput {
  cancellationWindows?: {
    label?: string;
    hoursBefore: number;
    refundPercent: number;
  }[];
  defaultRefundPercent?: number;
  processingFee?: {
    type?: "none" | "flat" | "percent";
    value?: number;
    maxAmount?: number;
  };
  refundPlatformFee?: boolean;
  refundGst?: boolean;
  refundAddOns?: boolean;
  refundDonation?: boolean;
  claimWindowHours?: number;
}

export interface RefundSourceInput {
  amountPaid: number;
  baseAmount: number;
  addOnsAmount?: number;
  donationAmount?: number;
  platformFee?: number;
  gstAmount?: number;
  /** When the stay/parking/service is due. Null for goods, which have none. */
  serviceDate?: Date | null;
}

export interface RefundBreakdown {
  hoursBeforeService: number;
  appliedWindow: {
    label: string;
    hoursBefore: number;
    refundPercent: number;
  } | null;
  refundPercent: number;
  refundableComponents: {
    base: number;
    addOns: number;
    donation: number;
    platformFee: number;
    gst: number;
  };
  grossRefundable: number;
  processingFee: number;
  netRefundable: number;
  nonRefundableAmount: number;
  notes: string[];
}

/** Whole hours between now and the service date. Negative once it has passed. */
export const hoursUntil = (serviceDate: Date | null | undefined, now: Date) =>
  serviceDate ? (serviceDate.getTime() - now.getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;

/**
 * The refund percentage the policy grants at this distance from the service.
 *
 * Windows are evaluated most-generous-first so overlapping definitions resolve
 * predictably: "48h → 100%" and "24h → 50%" gives 100% at 72h out, 50% at 30h.
 */
export const resolveWindow = (
  policy: RefundPolicyInput,
  hoursBefore: number,
): { label: string; hoursBefore: number; refundPercent: number } | null => {
  const windows = [...(policy.cancellationWindows ?? [])].sort(
    (a, b) => b.hoursBefore - a.hoursBefore,
  );
  for (const window of windows) {
    if (hoursBefore >= window.hoursBefore)
      return {
        label: window.label ?? `${window.hoursBefore}h before`,
        hoursBefore: window.hoursBefore,
        refundPercent: window.refundPercent,
      };
  }
  return null;
};

/**
 * Work out what comes back.
 *
 * The percentage applies only to the components the policy says are
 * refundable — it is never applied to the gross paid amount, because a
 * non-refundable donation must not be scaled down and partially returned.
 * Every component is capped at what was actually collected, so a partially
 * paid booking can never refund more than it took.
 */
export const calculateRefund = (
  policy: RefundPolicyInput,
  source: RefundSourceInput,
  now: Date,
): RefundBreakdown => {
  const notes: string[] = [];
  const amountPaid = Math.max(0, roundMoney(source.amountPaid));
  const hoursBefore = hoursUntil(source.serviceDate ?? null, now);

  const window = resolveWindow(policy, hoursBefore);
  const refundPercent = window
    ? window.refundPercent
    : (policy.defaultRefundPercent ?? 0);

  notes.push(
    window
      ? `Window "${window.label}" applied at ${Math.floor(hoursBefore)}h before service — ${refundPercent}%.`
      : `No cancellation window matched at ${Math.floor(hoursBefore)}h before service — default ${refundPercent}%.`,
  );

  // A claim window that has closed overrides everything: nothing is refundable.
  const claimWindow = policy.claimWindowHours ?? 0;
  if (claimWindow > 0 && hoursBefore < -claimWindow) {
    notes.push(
      `Claim window of ${claimWindow}h after the service date has closed.`,
    );
    return {
      hoursBeforeService: roundMoney(hoursBefore),
      appliedWindow: window,
      refundPercent: 0,
      refundableComponents: {
        base: 0,
        addOns: 0,
        donation: 0,
        platformFee: 0,
        gst: 0,
      },
      grossRefundable: 0,
      processingFee: 0,
      netRefundable: 0,
      nonRefundableAmount: amountPaid,
      notes,
    };
  }

  const factor = Math.min(100, Math.max(0, refundPercent)) / 100;
  const base = roundMoney(Math.max(0, source.baseAmount) * factor);

  const addOnsEligible = policy.refundAddOns !== false;
  const addOns = addOnsEligible
    ? roundMoney(Math.max(0, source.addOnsAmount ?? 0) * factor)
    : 0;
  if (!addOnsEligible && (source.addOnsAmount ?? 0) > 0)
    notes.push("Add-on services are non-refundable under this policy.");

  const donationEligible = policy.refundDonation === true;
  const donation = donationEligible
    ? roundMoney(Math.max(0, source.donationAmount ?? 0) * factor)
    : 0;
  if (!donationEligible && (source.donationAmount ?? 0) > 0)
    notes.push("Donations are non-refundable under this policy.");

  // The platform fee is Tirvona's own service charge; it is returned only when
  // the policy says so, and never scaled by the cancellation percentage —
  // either the service fee is refunded or it is not.
  const platformFeeEligible = policy.refundPlatformFee === true;
  const platformFee = platformFeeEligible
    ? roundMoney(Math.max(0, source.platformFee ?? 0))
    : 0;
  if (!platformFeeEligible && (source.platformFee ?? 0) > 0)
    notes.push("Platform fee is retained under this policy.");

  // GST was charged on the platform fee and remitted onward. It can only come
  // back with the fee it was levied on — refunding tax on a fee the platform
  // kept would be a loss with no offsetting credit.
  const gstEligible = policy.refundGst === true && platformFeeEligible;
  const gst = gstEligible ? roundMoney(Math.max(0, source.gstAmount ?? 0)) : 0;
  if (!gstEligible && (source.gstAmount ?? 0) > 0)
    notes.push(
      policy.refundGst === true
        ? "GST is retained because the platform fee it was charged on is retained."
        : "GST on the platform fee is retained under this policy.",
    );

  let gross = roundMoney(base + addOns + donation + platformFee + gst);

  // Never return more than was taken. A partially paid booking is the usual
  // cause; without this the platform would refund money it never received.
  if (gross > amountPaid) {
    notes.push(
      `Refundable total capped at the amount actually collected (₹${amountPaid}).`,
    );
    gross = amountPaid;
  }

  const feeConfig = policy.processingFee ?? {};
  let processingFee = 0;
  if (feeConfig.type === "flat") processingFee = Math.max(0, feeConfig.value ?? 0);
  else if (feeConfig.type === "percent")
    processingFee = roundMoney((gross * Math.max(0, feeConfig.value ?? 0)) / 100);
  if (feeConfig.maxAmount && feeConfig.maxAmount > 0)
    processingFee = Math.min(processingFee, feeConfig.maxAmount);
  // The fee comes out of the refund, so it can never exceed it and turn the
  // payout negative.
  processingFee = roundMoney(Math.min(processingFee, gross));
  if (processingFee > 0)
    notes.push(`Processing fee of ₹${processingFee} deducted.`);

  const net = roundMoney(gross - processingFee);

  return {
    hoursBeforeService: Number.isFinite(hoursBefore)
      ? roundMoney(hoursBefore)
      : 0,
    appliedWindow: window,
    refundPercent,
    refundableComponents: { base, addOns, donation, platformFee, gst },
    grossRefundable: gross,
    processingFee,
    netRefundable: net,
    nonRefundableAmount: roundMoney(Math.max(0, amountPaid - net)),
    notes,
  };
};
