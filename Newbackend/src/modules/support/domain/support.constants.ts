/**
 * Support Management — shared vocabulary for tickets, categories, linked
 * entities, access and SLA. Categories are data (`support_categories`), not
 * an enum: the list below only seeds the defaults on first boot.
 */

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Statuses that still need staff attention. */
export const ACTIVE_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "REOPENED"];
export const FINISHED_STATUSES: TicketStatus[] = ["RESOLVED", "CLOSED"];

/** Status changes staff may make. REOPENED is only reachable from a finished ticket. */
export const STAFF_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "WAITING_FOR_USER", "RESOLVED", "CLOSED"],
  WAITING_FOR_USER: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"],
};

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
/** Stored on the ticket so lists can sort by severity. */
export const PRIORITY_RANK: Record<TicketPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };

/** SLA targets in hours, by priority. */
export const SLA_HOURS: Record<TicketPriority, { firstResponse: number; resolution: number }> = {
  URGENT: { firstResponse: 1, resolution: 8 },
  HIGH: { firstResponse: 4, resolution: 24 },
  MEDIUM: { firstResponse: 12, resolution: 72 },
  LOW: { firstResponse: 24, resolution: 120 },
};

/** A customer may reopen a finished ticket for this long after it was resolved/closed. */
export const REOPEN_WINDOW_DAYS = 30;

/** Roles that can work tickets. super_admin always can (RolesGuard lets it through everywhere). */
export const SUPPORT_AGENT_ROLE = "support";
export const SUPPORT_HANDLER_ROLES = [
  "support",
  "national_admin",
  "marketplace_manager",
  "finance_manager",
  "service_manager",
] as const;
/** Grants a support agent supervisor access: every ticket, assigning others, the full dashboard. */
export const SUPPORT_MANAGE_ALL_PERMISSION = "support.manage_all";

/**
 * Entities a ticket can point at. Each is read live from its own collection
 * (nothing copied) — the ticket keeps only the id, reference and a short
 * label, so history survives if the record is later changed or deleted.
 */
export interface LinkableEntityDef {
  label: string;
  collection: string;
  /** Human reference fields, tried in order when looking up by reference. */
  referenceFields: string[];
  /** Field(s) naming the owning user, used to stop customers linking other people's records. */
  ownerFields: string[];
}

export const LINKABLE_ENTITIES: Record<string, LinkableEntityDef> = {
  booking: {
    label: "Stay booking",
    collection: "booking_bookings",
    referenceFields: ["bookingId", "reservationNumber", "identityCode"],
    ownerFields: ["customerId", "bookedBy"],
  },
  payment: {
    label: "Payment",
    collection: "booking_payments",
    referenceFields: ["transactionId", "gateway.paymentId", "gateway.orderId"],
    ownerFields: ["userId"],
  },
  refund: {
    label: "Refund",
    collection: "refund_requests",
    referenceFields: ["refundNumber"],
    ownerFields: ["customerId", "requestedBy"],
  },
  marketplace_order: {
    label: "Marketplace order",
    collection: "marketplace_master_orders",
    referenceFields: ["orderNumber"],
    ownerFields: ["customerId"],
  },
  marketplace_vendor_order: {
    label: "Marketplace store order",
    collection: "marketplace_vendor_orders",
    referenceFields: ["vendorOrderNumber"],
    ownerFields: ["customerId"],
  },
  aarti_booking: {
    label: "Aarti / Pooja booking",
    collection: "aarti_bookings",
    referenceFields: ["bookingReference"],
    ownerFields: ["customerId"],
  },
  parking_booking: {
    label: "Parking booking",
    collection: "parking_bookings",
    referenceFields: ["bookingReference"],
    ownerFields: ["customerId"],
  },
  event_registration: {
    label: "Event registration",
    collection: "event_registrations",
    referenceFields: ["registrationReference"],
    ownerFields: ["customerId"],
  },
  ashram: {
    label: "Hotel / Stay property",
    collection: "ashrams",
    referenceFields: ["slug", "name"],
    ownerFields: [],
  },
  temple: {
    label: "Temple",
    collection: "temples",
    referenceFields: ["slug", "name"],
    ownerFields: [],
  },
};
export const LINKABLE_ENTITY_TYPES = [...Object.keys(LINKABLE_ENTITIES), "other"];
/** Public places anyone may reference; everything else must belong to the customer. */
export const PUBLIC_ENTITY_TYPES = ["ashram", "temple"];

export interface CategorySeed {
  key: string;
  label: string;
  description: string;
  defaultPriority: TicketPriority;
  entityTypes: string[];
  handlerRoles: string[];
}

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  { key: "booking", label: "Booking", description: "Problems with a booking or reservation", defaultPriority: "MEDIUM", entityTypes: ["booking", "aarti_booking", "parking_booking", "event_registration"], handlerRoles: [] },
  { key: "hotel_stay", label: "Hotel / Stay", description: "Rooms, check-in, facilities at a stay", defaultPriority: "MEDIUM", entityTypes: ["booking", "ashram"], handlerRoles: [] },
  { key: "temple", label: "Temple", description: "Temple information, darshan, aarti", defaultPriority: "LOW", entityTypes: ["temple", "aarti_booking"], handlerRoles: [] },
  { key: "ashram", label: "Ashram", description: "Ashram services and stays", defaultPriority: "MEDIUM", entityTypes: ["ashram", "booking"], handlerRoles: [] },
  { key: "pandit_jyotish", label: "Pandit / Jyotish", description: "Pooja, pandit and astrology services", defaultPriority: "MEDIUM", entityTypes: ["aarti_booking"], handlerRoles: ["service_manager"] },
  { key: "marketplace", label: "Marketplace", description: "Products, sellers and the store", defaultPriority: "MEDIUM", entityTypes: ["marketplace_order", "marketplace_vendor_order"], handlerRoles: ["marketplace_manager"] },
  { key: "order", label: "Order", description: "Order delivery, missing or damaged items", defaultPriority: "MEDIUM", entityTypes: ["marketplace_order", "marketplace_vendor_order"], handlerRoles: ["marketplace_manager"] },
  { key: "payment", label: "Payment", description: "Failed, duplicate or pending payments", defaultPriority: "HIGH", entityTypes: ["payment", "booking", "marketplace_order"], handlerRoles: ["finance_manager"] },
  { key: "refund", label: "Refund", description: "Refund status and amounts", defaultPriority: "HIGH", entityTypes: ["refund", "booking", "marketplace_order"], handlerRoles: ["finance_manager"] },
  { key: "cancellation", label: "Cancellation", description: "Cancelling a booking or order", defaultPriority: "MEDIUM", entityTypes: ["booking", "aarti_booking", "parking_booking", "event_registration", "marketplace_order"], handlerRoles: [] },
  { key: "account", label: "Account", description: "Login, profile and account settings", defaultPriority: "MEDIUM", entityTypes: [], handlerRoles: [] },
  { key: "verification", label: "Verification", description: "KYC, documents and partner verification", defaultPriority: "MEDIUM", entityTypes: [], handlerRoles: [] },
  { key: "technical", label: "Technical Issue", description: "Errors, bugs or the site/app not working", defaultPriority: "MEDIUM", entityTypes: [], handlerRoles: [] },
  { key: "other", label: "Other", description: "Anything else", defaultPriority: "LOW", entityTypes: LINKABLE_ENTITY_TYPES, handlerRoles: [] },
];

/** Values written by the first version of this module (lower-case enums). */
export const LEGACY_STATUS: Record<string, TicketStatus> = {
  open: "OPEN",
  in_progress: "IN_PROGRESS",
  resolved: "RESOLVED",
};
export const LEGACY_PRIORITY: Record<string, TicketPriority> = { low: "LOW", medium: "MEDIUM", high: "HIGH" };
export const LEGACY_CATEGORY: Record<string, string> = {
  booking_issue: "booking",
  payment_failed: "payment",
  refund_request: "refund",
  ashram_complaint: "hotel_stay",
  other: "other",
};

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
