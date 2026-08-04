import { Schema, SchemaTypes } from "mongoose";
const loose = (collection: string, fields: any = {}): Schema =>
  new Schema(fields, { strict: false, timestamps: true, collection });
export const GOVERNANCE_MODELS = [
  {
    name: "ApprovalRequest",
    schema: loose("approval_requests", {
      requestId: { type: String, unique: true, index: true },
      ashramId: { type: SchemaTypes.ObjectId, ref: "GovernanceAshram" },
      stayAdminId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
      reviewedBy: { type: SchemaTypes.ObjectId, ref: "User" },
    }),
  },
  {
    name: "RoomCategoryRequest",
    schema: loose("room_category_requests", {
      requestId: { type: String, unique: true, index: true },
      ashramId: { type: SchemaTypes.ObjectId, ref: "GovernanceAshram" },
      stayAdminId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
      reviewedBy: { type: SchemaTypes.ObjectId, ref: "User" },
    }),
  },
  {
    name: "ActivityLog",
    schema: loose("activitylogs", {
      activityId: { type: String, unique: true, index: true },
      userId: { type: SchemaTypes.ObjectId, ref: "User" },
      timestamp: { type: Date, default: Date.now, index: true },
    }),
  },
  {
    name: "EnterpriseNotification",
    schema: loose("notifications", {
      recipientId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
    }),
  },
  { name: "InstitutionMaster", schema: loose("institutionmasters") },
  {
    name: "InstitutionContact",
    schema: loose("institutioncontacts", {
      institutionId: {
        type: SchemaTypes.ObjectId,
        ref: "InstitutionMaster",
        index: true,
      },
    }),
  },
  {
    name: "InstitutionLocation",
    schema: loose("institutionlocations", {
      institutionId: {
        type: SchemaTypes.ObjectId,
        ref: "InstitutionMaster",
        index: true,
      },
    }),
  },
  {
    name: "InstitutionQualityAudit",
    schema: loose("institutionqualityaudits", {
      institutionId: {
        type: SchemaTypes.ObjectId,
        ref: "InstitutionMaster",
        index: true,
      },
    }),
  },
  {
    name: "GovernanceAshram",
    schema: loose("ashrams", {
      ownerId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
    }),
  },
  { name: "GovernanceRoom", schema: loose("rooms") },
  { name: "GovernanceOffer", schema: loose("offers") },
];
const ADMIN_COLLECTIONS: Record<string, string> = {
  users: "users",
  ashrams: "ashrams",
  rooms: "rooms",
  bookings: "booking_bookings",
  offers: "booking_coupons",
  blogs: "blogposts",
  authors: "blogauthors",
  comments: "blogcomments",
  banner: "banners",
  marketplace: "marketplaceproducts",
  categories: "marketplacecategories",
  orders: "marketplaceorders",
  waitlist: "marketplacewaitlists",
  local: "localserviceitems",
  guides: "sacreddirectoryitems",
  circuits: "pilgrimagecircuits",
  itineraries: "tripitineraries",
  templates: "plannertemplates",
  temples: "temples",
  events: "eventfestivals",
  support: "booking_support_tickets",
  reports: "booking_reports",
  volunteer: "volunteerjobs",
  volunteer_applications: "volunteerapplications",
  reviews: "booking_reviews",
  payments: "booking_payments",
  service_bookings: "servicebookings",
  providers: "serviceproviders",
  // Parking. The module owns its own typed models and a capability-guarded API;
  // these entries only expose the same collections to the read/search/edit
  // console so a Super Admin can see parking data alongside everything else.
  // Anything that moves money or state (partner approval, commission
  // settlement, refunds) stays on /parking/admin, which enforces the workflow.
  parking_partners: "parking_partners",
  parking_locations: "parking_locations",
  parking_bookings: "parking_bookings",
  parking_slot_types: "parking_slot_types",
  parking_slots: "parking_slots",
  parking_pricing: "parking_pricing",
  parking_staff: "parking_staff",
  parking_commissions: "parking_commissions",
  parking_transactions: "parking_transactions",
  parking_scan_logs: "parking_scan_logs",
  parking_reviews: "parking_reviews",
};
/**
 * Foreign keys the console resolves to a readable label.
 *
 * The generic `Admin_*` models are schemaless, so an ObjectId field has no ref
 * for Mongoose to follow and the table renders a bare id. Parking rows are
 * almost entirely joins — a booking names neither its location nor its
 * customer — so the handful of columns a human reads are typed here. Targets
 * stay inside the `Admin_*` family to keep this module self-contained.
 */
const LOCATION = { ref: "Admin_parking_locations", select: "name slug" };
const PARTNER = {
  ref: "Admin_parking_partners",
  select: "businessName partnerCode",
};
const SLOT_TYPE = { ref: "Admin_parking_slot_types", select: "name code" };
const BOOKING = {
  ref: "Admin_parking_bookings",
  select: "bookingReference status",
};
// `Admin_users` is schemaless, so the real User schema's `select: false` on
// passwordHash does not apply here. redact() strips it on the way out either
// way, but an explicit projection keeps it out of the query to begin with.
const ACCOUNT = { ref: "Admin_users", select: "name email phone role" };

export const ADMIN_REFS: Record<
  string,
  Record<string, { ref: string; select: string }>
> = {
  parking_locations: { partnerId: PARTNER },
  parking_bookings: {
    locationId: LOCATION,
    partnerId: PARTNER,
    customerId: ACCOUNT,
    slotTypeId: SLOT_TYPE,
  },
  parking_slot_types: { locationId: LOCATION },
  parking_slots: { locationId: LOCATION, slotTypeId: SLOT_TYPE },
  parking_pricing: { locationId: LOCATION, slotTypeId: SLOT_TYPE },
  parking_staff: {
    userId: ACCOUNT,
    partnerId: PARTNER,
    locationIds: LOCATION,
  },
  parking_commissions: {
    partnerId: PARTNER,
    locationId: LOCATION,
    bookingId: BOOKING,
  },
  parking_transactions: { partnerId: PARTNER, locationId: LOCATION },
  parking_scan_logs: {
    locationId: LOCATION,
    bookingId: BOOKING,
    scannedByUserId: ACCOUNT,
  },
  parking_reviews: { locationId: LOCATION, customerId: ACCOUNT },
};

/** Logical admin-console module keys that map to a real collection. */
export const ADMIN_MODULE_KEYS = Object.keys(ADMIN_COLLECTIONS);
for (const [key, collection] of Object.entries(ADMIN_COLLECTIONS)) {
  const refs = ADMIN_REFS[key] ?? {};
  const fields = Object.fromEntries(
    Object.entries(refs).map(([path, { ref }]) => [
      path,
      // A plural `…Ids` path holds an array of references (a staff grant is
      // scoped to several locations); everything else is a single id.
      path.endsWith("Ids")
        ? [{ type: SchemaTypes.ObjectId, ref }]
        : { type: SchemaTypes.ObjectId, ref },
    ]),
  );
  GOVERNANCE_MODELS.push({
    name: `Admin_${key}`,
    schema: loose(collection, fields),
  });
}
GOVERNANCE_MODELS[0].schema.index({ module: 1, status: 1, createdAt: -1 });
GOVERNANCE_MODELS[3].schema.index({ isRead: 1, createdAt: -1 });
