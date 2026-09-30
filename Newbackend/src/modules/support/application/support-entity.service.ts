import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Types, type Connection } from "mongoose";
import {
  LINKABLE_ENTITIES,
  PUBLIC_ENTITY_TYPES,
} from "../domain/support.constants";

export interface EntityField {
  label: string;
  value: string | number | null;
  kind?: "money" | "date" | "status" | "text";
}

export interface EntitySummary {
  type: string;
  typeLabel: string;
  entityId: string | null;
  reference: string;
  title: string;
  exists: boolean;
  fields: EntityField[];
}

export interface ResolvedEntity {
  type: string;
  entityId: Types.ObjectId | null;
  reference: string;
  label: string;
}

/** Minimal read-only view of a collection — the native driver in production, a fake in tests. */
interface ReadCollection {
  findOne(filter: any, options?: any): Promise<any>;
  find(filter: any, options?: any): { sort(s: any): any; limit(n: number): any; toArray(): Promise<any[]> };
}

const get = (obj: any, path: string): any =>
  path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const oid = (value: unknown): Types.ObjectId | null =>
  typeof value === "string" && Types.ObjectId.isValid(value) && /^[0-9a-f]{24}$/i.test(value)
    ? new Types.ObjectId(value)
    : value instanceof Types.ObjectId
      ? value
      : null;
const sameId = (a: unknown, b: string) => a != null && String(a) === b;

/**
 * Reads the records a ticket can point at straight from their own
 * collections. Nothing is copied into the ticket beyond id + reference +
 * a short label, so the support view always shows the live booking/order,
 * and a deleted record degrades to "no longer available" instead of breaking.
 */
@Injectable()
export class SupportEntityService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private collection(type: string): ReadCollection {
    const def = LINKABLE_ENTITIES[type];
    return this.connection.collection(def.collection) as unknown as ReadCollection;
  }

  /**
   * Finds the record a customer or staff member pointed at.
   * `ownerId` set → the record must belong to that user (customer tickets).
   */
  async resolve(
    type: string,
    input: { entityId?: string; reference?: string },
    ownerId?: string,
  ): Promise<ResolvedEntity> {
    const reference = (input.reference ?? "").trim().slice(0, 120);
    if (type === "other") {
      if (!reference) throw new BadRequestException("Please enter a reference for the linked record.");
      return { type, entityId: null, reference, label: reference };
    }
    const def = LINKABLE_ENTITIES[type];
    if (!def) throw new BadRequestException("Unknown linked record type.");

    const byId = oid(input.entityId) ?? oid(reference);
    const or: any[] = [];
    if (byId) or.push({ _id: byId });
    if (reference) for (const field of def.referenceFields) or.push({ [field]: reference });
    if (!or.length) throw new BadRequestException("Please choose the record this is about.");

    const doc = await this.collection(type).findOne({ $or: or });
    if (!doc) throw new BadRequestException(`We could not find that ${def.label.toLowerCase()}.`);
    if (ownerId && !PUBLIC_ENTITY_TYPES.includes(type)) {
      const owned = def.ownerFields.some((field) => sameId(get(doc, field), ownerId));
      if (!owned)
        // Same message as "not found": never confirm that someone else's record exists.
        throw new BadRequestException(`We could not find that ${def.label.toLowerCase()}.`);
    }
    const ref = this.referenceOf(type, doc);
    return { type, entityId: doc._id, reference: ref, label: `${def.label} ${ref}`.trim() };
  }

  /** The customer's own recent records of one type, for the "which booking is this about?" picker. */
  async listOwned(type: string, userId: string, limit = 20): Promise<any[]> {
    const def = LINKABLE_ENTITIES[type];
    if (!def || !def.ownerFields.length) return [];
    const owner = oid(userId);
    const filter = {
      $or: def.ownerFields.map((field) => ({ [field]: owner ?? userId })),
    };
    const rows = await this.collection(type).find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
    return rows.map((doc: any) => {
      const summary = this.describe(type, doc, null);
      return {
        entityId: String(doc._id),
        reference: summary.reference,
        title: summary.title,
        status: doc.status ?? doc.fulfillmentStatus ?? "",
        createdAt: doc.createdAt ?? null,
      };
    });
  }

  /** Live summary for the staff workspace. Missing records return the stored snapshot. */
  async summary(related: {
    type?: string;
    entityId?: unknown;
    reference?: string;
    label?: string;
  } | null | undefined): Promise<EntitySummary | null> {
    if (!related?.type) return null;
    const def = LINKABLE_ENTITIES[related.type];
    const missing: EntitySummary = {
      type: related.type,
      typeLabel: def?.label ?? "Other",
      entityId: related.entityId ? String(related.entityId) : null,
      reference: related.reference ?? "",
      title: related.label || related.reference || "",
      exists: false,
      fields: [],
    };
    if (!def || !related.entityId) return related.type === "other" ? { ...missing, exists: true } : missing;
    const doc = await this.collection(related.type).findOne({ _id: oid(String(related.entityId)) });
    if (!doc) return missing;
    const place = await this.placeName(doc.ashramId);
    return this.describe(related.type, doc, place);
  }

  private async placeName(ashramId: unknown): Promise<string | null> {
    const id = oid(ashramId ? String(ashramId) : "");
    if (!id) return null;
    const row = await (this.connection.collection("ashrams") as unknown as ReadCollection).findOne(
      { _id: id },
      { projection: { name: 1 } },
    );
    return row?.name ?? null;
  }

  private referenceOf(type: string, doc: any): string {
    const def = LINKABLE_ENTITIES[type];
    for (const field of def?.referenceFields ?? []) {
      const value = get(doc, field);
      if (value) return String(value);
    }
    return String(doc._id);
  }

  private describe(type: string, doc: any, place: string | null): EntitySummary {
    const def = LINKABLE_ENTITIES[type];
    const reference = this.referenceOf(type, doc);
    const f = (label: string, value: unknown, kind: EntityField["kind"] = "text"): EntityField => ({
      label,
      value: value === undefined || value === null || value === "" ? null : (value as any),
      kind,
    });
    let title = `${def.label} ${reference}`;
    let fields: EntityField[] = [];

    switch (type) {
      case "booking":
        title = place ? `${place} · ${reference}` : reference;
        fields = [
          f("Booking ID", reference),
          f("Status", doc.status, "status"),
          f("Payment", doc.paymentStatus, "status"),
          f("Property", place),
          f("Check-in", doc.checkInDate, "date"),
          f("Check-out", doc.checkOutDate, "date"),
          f("Guests", doc.guestsCount),
          f("Rooms", doc.roomsBookedCount),
          f("Room numbers", (doc.assignedRoomNumbers ?? []).join(", ")),
          f("Total", doc.pricing?.totalAmount, "money"),
          f("Paid", doc.pricing?.amountPaid, "money"),
          f("Booked on", doc.createdAt, "date"),
        ];
        break;
      case "payment":
        title = `Payment ${reference}`;
        fields = [
          f("Amount", doc.amount, "money"),
          f("Status", doc.status, "status"),
          f("Method", doc.method),
          f("Transaction ID", doc.transactionId),
          f("Gateway payment", doc.gateway?.paymentId),
          f("Gateway order", doc.gateway?.orderId),
          f("Paid at", doc.paidAt, "date"),
          f("Failure reason", doc.failureReason),
          f("Property", place),
        ];
        break;
      case "refund":
        title = `Refund ${reference}`;
        fields = [
          f("Refund no.", reference),
          f("Status", doc.status, "status"),
          f("For", doc.module),
          f("Source reference", doc.sourceReference),
          f("Requested amount", doc.requestedAmount, "money"),
          f("Reason", doc.reason),
          f("Requested on", doc.createdAt, "date"),
          f("Settled at", doc.settledAt, "date"),
        ];
        break;
      case "marketplace_order":
        title = `Order ${reference}`;
        fields = [
          f("Order no.", reference),
          f("Status", doc.status, "status"),
          f("Payment", doc.paymentStatus, "status"),
          f("Total", doc.pricing?.totalAmount, "money"),
          f("Paid", doc.pricing?.amountPaid, "money"),
          f("Refunded", doc.pricing?.amountRefunded, "money"),
          f("Stores", (doc.vendorOrderIds ?? []).length),
          f("Ship to", [doc.shippingAddress?.city, doc.shippingAddress?.state].filter(Boolean).join(", ")),
          f("Ordered on", doc.createdAt, "date"),
        ];
        break;
      case "marketplace_vendor_order":
        title = `Store order ${reference}`;
        fields = [
          f("Store order no.", reference),
          f("Store", doc.vendorSnapshot?.storeName),
          f("Fulfilment", doc.fulfillmentStatus, "status"),
          f("Total", doc.total, "money"),
          f("Items", (doc.items ?? []).length),
          f("Carrier", doc.tracking?.carrier),
          f("Tracking no.", doc.tracking?.trackingNumber),
          f("Shipped", doc.shippedAt, "date"),
          f("Delivered", doc.deliveredAt, "date"),
          f("Refund error", doc.refundError),
        ];
        break;
      case "aarti_booking":
        title = place ? `${place} · ${reference}` : reference;
        fields = [
          f("Booking ref.", reference),
          f("Status", doc.status, "status"),
          f("Payment", doc.paymentStatus, "status"),
          f("Place", place),
          f("Session date", doc.sessionDate, "date"),
          f("Passes", doc.passCount),
          f("Total", doc.pricing?.totalAmount, "money"),
          f("Contact", [doc.contactName, doc.contactPhone].filter(Boolean).join(" · ")),
        ];
        break;
      case "parking_booking":
        title = `Parking ${reference}`;
        fields = [
          f("Booking ref.", reference),
          f("Status", doc.status, "status"),
          f("Payment", doc.paymentStatus, "status"),
          f("Vehicle", [doc.vehicleType, doc.vehicleNumber].filter(Boolean).join(" · ")),
          f("Slot", doc.assignedSlotNumber),
          f("Entry", doc.entryAt, "date"),
          f("Exit", doc.exitAt, "date"),
          f("Total", doc.pricing?.totalAmount, "money"),
        ];
        break;
      case "event_registration":
        title = place ? `${place} · ${reference}` : reference;
        fields = [
          f("Registration ref.", reference),
          f("Status", doc.status, "status"),
          f("Place", place),
          f("Date", doc.attendDate, "date"),
          f("Seats", doc.seats),
          f("Contact", [doc.contactName, doc.contactPhone].filter(Boolean).join(" · ")),
        ];
        break;
      case "ashram":
      case "temple":
        title = doc.name ?? reference;
        fields = [
          f("Name", doc.name),
          f("Status", doc.status, "status"),
          f("City", doc.city ?? doc.location?.city ?? doc.address?.city),
          f("State", doc.state ?? doc.location?.state ?? doc.address?.state),
          f("Phone", doc.phone ?? doc.contactPhone),
        ];
        break;
    }
    return {
      type,
      typeLabel: def.label,
      entityId: String(doc._id),
      reference,
      title,
      exists: true,
      fields: fields.filter((field) => field.value !== null),
    };
  }
}
