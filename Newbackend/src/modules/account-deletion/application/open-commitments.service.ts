import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import type { Model } from "mongoose";

export interface DeletionBlocker {
  code: string;
  message: string;
  count: number;
}

interface Commitment {
  code: string;
  model: string;
  userField: string;
  statusField: string;
  openStatuses: string[];
  message: (count: number) => string;
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Everything that must be settled before an account can be erased. Deleting
 * the account does not cancel anything, so a guest with a stay, parking slot,
 * pass or parcel on the way — or money still sitting in the wallet — has to
 * finish or cancel that first.
 */
const COMMITMENTS: Commitment[] = [
  {
    code: "OPEN_STAY_BOOKINGS",
    model: "Booking",
    userField: "customerId",
    statusField: "status",
    openStatuses: ["pending", "confirmed", "checked_in"],
    message: (n) =>
      `${plural(n, "stay or day-stay booking is", "stay or day-stay bookings are")} still active. Cancel or complete ${n === 1 ? "it" : "them"} first.`,
  },
  {
    code: "OPEN_PARKING_BOOKINGS",
    model: "ParkingBooking",
    userField: "customerId",
    statusField: "status",
    openStatuses: ["pending", "upcoming", "checked_in"],
    message: (n) =>
      `${plural(n, "parking booking is", "parking bookings are")} still active.`,
  },
  {
    code: "OPEN_AARTI_BOOKINGS",
    model: "AartiBooking",
    userField: "customerId",
    statusField: "status",
    openStatuses: ["pending", "upcoming", "checked_in"],
    message: (n) =>
      `${plural(n, "aarti pass is", "aarti passes are")} still active.`,
  },
  {
    code: "OPEN_STORE_ORDERS",
    model: "MarketplaceOrderRecord",
    userField: "customerId",
    statusField: "orderStatus",
    openStatuses: ["confirmed", "packed", "shipped"],
    message: (n) =>
      `${plural(n, "store order is", "store orders are")} still on the way.`,
  },
  {
    code: "OPEN_MARKETPLACE_ORDERS",
    model: "MpMasterOrder",
    userField: "customerId",
    statusField: "status",
    openStatuses: ["confirmed", "partially_fulfilled"],
    message: (n) =>
      `${plural(n, "marketplace order is", "marketplace orders are")} still being fulfilled.`,
  },
  {
    code: "OPEN_REFUNDS",
    model: "RefundRequest",
    userField: "customerId",
    statusField: "status",
    openStatuses: ["pending", "under_review", "approved", "processing"],
    message: (n) =>
      `${plural(n, "refund is", "refunds are")} still being processed. Wait until ${n === 1 ? "it is" : "they are"} paid out.`,
  },
  {
    code: "OPEN_WITHDRAWALS",
    model: "PilgrimWalletWithdrawal",
    userField: "userId",
    statusField: "status",
    openStatuses: ["pending", "approved"],
    message: (n) =>
      `${plural(n, "wallet withdrawal is", "wallet withdrawals are")} still being processed.`,
  },
];

@Injectable()
export class OpenCommitmentsService {
  constructor(private readonly modules: ModuleRef) {}

  /**
   * Models live in other feature modules, so they are resolved by name at
   * call time. A missing model is a deployment fault, and it fails closed:
   * skipping a check would let someone erase an account with money or a
   * booking attached.
   */
  private model(name: string): Model<any> {
    try {
      return this.modules.get(getModelToken(name), { strict: false });
    } catch {
      throw new InternalServerErrorException(
        "Account deletion is temporarily unavailable. Please try again later.",
      );
    }
  }

  async blockers(userId: string): Promise<DeletionBlocker[]> {
    const found: DeletionBlocker[] = [];
    const counts = await Promise.all(
      COMMITMENTS.map((c) =>
        this.model(c.model).countDocuments({
          [c.userField]: userId,
          [c.statusField]: { $in: c.openStatuses },
        }),
      ),
    );
    COMMITMENTS.forEach((c, index) => {
      const count = Number(counts[index] ?? 0);
      if (count > 0)
        found.push({ code: c.code, message: c.message(count), count });
    });

    const wallet = await this.model("PilgrimWallet")
      .findOne({ userId })
      .lean<{
        balance?: number;
        heldAmount?: number;
        pendingWithdrawal?: number;
      }>();
    const balance = Number(wallet?.balance ?? 0);
    const held = Number(wallet?.heldAmount ?? 0);
    if (balance > 0 || held > 0) {
      found.push({
        code: "WALLET_NOT_EMPTY",
        message:
          "Your Tirvona wallet still holds money. Withdraw it to your bank or UPI, or spend it, before deleting your account.",
        count: 1,
      });
    }
    return found;
  }
}
