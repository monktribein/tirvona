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
  { name: "GovernanceOffer", schema: loose("booking_coupons") },
];
const ADMIN_COLLECTIONS: Record<string, string> = {
  users: "users",
  ashrams: "ashrams",
  rooms: "rooms",
  room_inventory: "booking_daily_availability",
  room_pricing: "booking_pricing",
  bookings: "booking_bookings",
  offers: "booking_coupons",
  blogs: "blogposts",
  authors: "blogauthors",
  comments: "blogcomments",
  banner: "banners",
  featured_banner: "featured_banners",
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
  aarti_sessions: "aarti_sessions",
  aarti_pass_types: "aarti_pass_types",
  aarti_pricing: "aarti_pricing",
  aarti_availability: "aarti_availability",
  aarti_holidays: "aarti_holidays",
  aarti_settings: "aarti_settings",
  aarti_staff: "aarti_staff",
  aarti_bookings: "aarti_bookings",
  aarti_payments: "aarti_payments",
  aarti_transactions: "aarti_transactions",
  aarti_commissions: "aarti_commissions",
  aarti_qr_codes: "aarti_qr_codes",
  aarti_scan_logs: "aarti_scan_logs",
  aarti_reviews: "aarti_reviews",
  aarti_notifications: "aarti_notifications",
  aarti_streams: "aarti_streams",
  event_festivals: "event_festivals",
  event_availability: "event_availability",
  event_registrations: "event_registrations",
  event_qr_codes: "event_qr_codes",
  event_scan_logs: "event_scan_logs",
  event_notifications: "event_notifications",
  event_staff: "event_staff",
  event_settings: "event_settings",
  pilgrimage_circuits: "pilgrimage_circuits",
  pilgrimage_stops: "pilgrimage_stops",
  pilgrimage_itineraries: "pilgrimage_itineraries",
  pilgrimage_settings: "pilgrimage_settings",
};
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
const AARTI_SESSION = {
  ref: "Admin_aarti_sessions",
  select: "name slug kind status",
};
const AARTI_PASS_TYPE = {
  ref: "Admin_aarti_pass_types",
  select: "name code basePrice",
};
const AARTI_BOOKING = {
  ref: "Admin_aarti_bookings",
  select: "bookingReference status",
};
const EVENT_LISTING = {
  ref: "Admin_event_festivals",
  select: "name slug eventType status",
};
const EVENT_REGISTRATION = {
  ref: "Admin_event_registrations",
  select: "registrationReference status",
};
const CIRCUIT = {
  ref: "Admin_pilgrimage_circuits",
  select: "name slug circuitType status",
};
const ACCOUNT = { ref: "Admin_users", select: "name email phone role" };
const ASHRAM = { ref: "Admin_ashrams", select: "name ashramCode" };
const ROOM = { ref: "Admin_rooms", select: "name type acType" };

export const ADMIN_REFS: Record<
  string,
  Record<string, { ref: string; select: string }>
> = {
  ashrams: { ownerId: ACCOUNT },
  rooms: { ashramId: ASHRAM },
  room_inventory: { ashramId: ASHRAM, roomId: ROOM },
  room_pricing: { ashramId: ASHRAM, roomId: ROOM },
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
  aarti_sessions: { ashramId: ASHRAM, ownerId: ACCOUNT },
  aarti_pass_types: { sessionId: AARTI_SESSION, ashramId: ASHRAM },
  aarti_pricing: { sessionId: AARTI_SESSION, passTypeId: AARTI_PASS_TYPE },
  aarti_availability: {
    sessionId: AARTI_SESSION,
    passTypeId: AARTI_PASS_TYPE,
  },
  aarti_holidays: { sessionId: AARTI_SESSION, ashramId: ASHRAM },
  aarti_settings: { sessionId: AARTI_SESSION, ashramId: ASHRAM },
  aarti_staff: { userId: ACCOUNT, ashramId: ASHRAM, sessionIds: AARTI_SESSION },
  aarti_bookings: {
    sessionId: AARTI_SESSION,
    ashramId: ASHRAM,
    passTypeId: AARTI_PASS_TYPE,
    customerId: ACCOUNT,
  },
  aarti_payments: { bookingId: AARTI_BOOKING, userId: ACCOUNT, ashramId: ASHRAM },
  aarti_transactions: {
    bookingId: AARTI_BOOKING,
    sessionId: AARTI_SESSION,
    ashramId: ASHRAM,
  },
  aarti_commissions: {
    bookingId: AARTI_BOOKING,
    sessionId: AARTI_SESSION,
    ashramId: ASHRAM,
  },
  aarti_qr_codes: {
    bookingId: AARTI_BOOKING,
    sessionId: AARTI_SESSION,
    customerId: ACCOUNT,
  },
  aarti_scan_logs: {
    bookingId: AARTI_BOOKING,
    sessionId: AARTI_SESSION,
    scannedByUserId: ACCOUNT,
  },
  aarti_reviews: { sessionId: AARTI_SESSION, customerId: ACCOUNT },
  aarti_notifications: { bookingId: AARTI_BOOKING, userId: ACCOUNT },
  aarti_streams: {
    ashramId: ASHRAM,
    ownerId: ACCOUNT,
    sessionId: AARTI_SESSION,
  },
  event_festivals: { ashramId: ASHRAM, ownerId: ACCOUNT },
  event_availability: { eventId: EVENT_LISTING, ashramId: ASHRAM },
  event_registrations: {
    eventId: EVENT_LISTING,
    ashramId: ASHRAM,
    customerId: ACCOUNT,
  },
  event_qr_codes: {
    registrationId: EVENT_REGISTRATION,
    eventId: EVENT_LISTING,
    customerId: ACCOUNT,
  },
  event_scan_logs: {
    registrationId: EVENT_REGISTRATION,
    eventId: EVENT_LISTING,
    ashramId: ASHRAM,
    scannedByUserId: ACCOUNT,
  },
  event_notifications: { registrationId: EVENT_REGISTRATION, userId: ACCOUNT },
  event_staff: { userId: ACCOUNT, ashramId: ASHRAM, eventIds: EVENT_LISTING },
  event_settings: { ashramId: ASHRAM, eventId: EVENT_LISTING },
  pilgrimage_circuits: { ashramId: ASHRAM, ownerId: ACCOUNT },
  pilgrimage_stops: {
    circuitId: CIRCUIT,
    ashramId: ASHRAM,
    linkedAshramId: ASHRAM,
  },
  pilgrimage_itineraries: { userId: ACCOUNT, circuitId: CIRCUIT },
  pilgrimage_settings: { ashramId: ASHRAM, circuitId: CIRCUIT },
};

export const ADMIN_MODULE_KEYS = Object.keys(ADMIN_COLLECTIONS);
for (const [key, collection] of Object.entries(ADMIN_COLLECTIONS)) {
  const refs = ADMIN_REFS[key] ?? {};
  const fields = Object.fromEntries(
    Object.entries(refs).map(([path, { ref }]) => [
      path,
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
