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
  bookings: "bookings",
  offers: "offers",
  blogs: "blogposts",
  authors: "blogauthors",
  comments: "blogcomments",
  banner: "banners",
  marketplace: "marketplaceproducts",
  categories: "marketplacecategories",
  waitlist: "marketplacewaitlists",
  local: "localserviceitems",
  guides: "sacreddirectoryitems",
  circuits: "pilgrimagecircuits",
  temples: "temples",
  events: "eventfestivals",
  support: "supporttickets",
  reports: "auditlogs",
  volunteer: "volunteerjobs",
  volunteer_applications: "volunteerapplications",
  reviews: "reviews",
  payments: "payments",
  service_bookings: "servicebookings",
  providers: "serviceproviders",
};
for (const [key, collection] of Object.entries(ADMIN_COLLECTIONS))
  GOVERNANCE_MODELS.push({ name: `Admin_${key}`, schema: loose(collection) });
GOVERNANCE_MODELS[0].schema.index({ module: 1, status: 1, createdAt: -1 });
GOVERNANCE_MODELS[3].schema.index({ isRead: 1, createdAt: -1 });
