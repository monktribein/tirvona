import { Schema, SchemaTypes } from "mongoose";
import {
  LINKABLE_ENTITY_TYPES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "../domain/support.constants";

const id = (ref: string, required = false) => ({
  type: SchemaTypes.ObjectId,
  ref,
  required,
  default: required ? undefined : null,
});
const opts = (collection: string) => ({
  timestamps: true,
  collection,
  optimisticConcurrency: true,
});

/** What a message stores about each file — copied from `support_attachments` when it is attached. */
const AttachmentRefSchema = new Schema(
  {
    attachmentId: id("SupportAttachment", true),
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    bytes: { type: Number, required: true },
  },
  { _id: false },
);

/**
 * One support ticket. The collection name predates this module's rewrite
 * (`booking_support_tickets`) and is kept so existing tickets, the admin
 * section summaries and the governance CRUD mapping keep working; older rows
 * are upgraded in place by SupportMigrationService.
 */
export const SupportTicketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, trim: true },
    userId: id("User", true),
    /** Staff member who raised it on the customer's behalf (admin-created tickets). */
    createdBy: id("User"),
    source: { type: String, enum: ["web", "admin"], default: "web" },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    category: { type: String, required: true, trim: true, index: true },
    /** Label at the time of the last category change, so history reads the same if the category is later renamed or removed. */
    categoryLabel: { type: String, default: "" },
    status: { type: String, enum: TICKET_STATUSES, default: "OPEN", index: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: "MEDIUM", index: true },
    priorityRank: { type: Number, default: 2 },
    assignedTo: id("User"),
    assignedAt: Date,
    isEscalated: { type: Boolean, default: false, index: true },
    escalation: {
      at: Date,
      by: id("User"),
      reason: String,
    },
    relatedEntity: {
      type: { type: String, enum: LINKABLE_ENTITY_TYPES },
      entityId: { type: SchemaTypes.ObjectId, default: null },
      reference: { type: String, default: "" },
      label: { type: String, default: "" },
    },
    attachments: { type: [AttachmentRefSchema], default: [] },

    // Conversation bookkeeping (kept on the ticket so lists need no joins).
    messageCount: { type: Number, default: 0 },
    unreadForUser: { type: Number, default: 0 },
    unreadForStaff: { type: Number, default: 0 },
    lastMessageAt: Date,
    lastUserMessageAt: Date,
    lastStaffMessageAt: Date,
    lastActivityAt: { type: Date, default: Date.now, index: true },

    // SLA. Durations are stored when they happen so averages are plain aggregates.
    firstResponseDueAt: Date,
    resolutionDueAt: Date,
    firstResponseAt: Date,
    firstResponseMinutes: Number,
    resolvedAt: Date,
    resolutionMinutes: Number,
    closedAt: Date,
    reopenedCount: { type: Number, default: 0 },
  },
  opts("booking_support_tickets"),
);
SupportTicketSchema.index({ userId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ assignedTo: 1, status: 1 });
SupportTicketSchema.index({ status: 1, priorityRank: -1, lastActivityAt: -1 });
SupportTicketSchema.index({ "relatedEntity.type": 1, "relatedEntity.entityId": 1 });
SupportTicketSchema.index({ resolvedAt: 1 });

/**
 * One entry in a ticket's conversation. `internal` notes are staff-only and
 * are filtered out of every customer-facing query at the database level.
 */
export const SupportMessageSchema = new Schema(
  {
    ticketId: id("SupportTicket", true),
    senderId: id("User"),
    senderRole: { type: String, default: "" },
    senderName: { type: String, default: "" },
    senderType: { type: String, enum: ["user", "staff", "system"], required: true },
    internal: { type: Boolean, default: false },
    body: { type: String, required: true, maxlength: 5000 },
    attachments: { type: [AttachmentRefSchema], default: [] },
    /** When the other side (customer for staff replies, staff for customer messages) first saw it. */
    readAt: { type: Date, default: null },
  },
  opts("support_ticket_messages"),
);
SupportMessageSchema.index({ ticketId: 1, createdAt: 1 });
SupportMessageSchema.index({ ticketId: 1, internal: 1, createdAt: 1 });

/** Audit trail of everything that happened to a ticket. `visibleToUser` rows show on the customer's timeline. */
export const SupportActivitySchema = new Schema(
  {
    ticketId: id("SupportTicket", true),
    actorId: id("User"),
    actorRole: { type: String, default: "" },
    actorName: { type: String, default: "" },
    action: { type: String, required: true },
    from: { type: String, default: "" },
    to: { type: String, default: "" },
    note: { type: String, default: "" },
    visibleToUser: { type: Boolean, default: false },
  },
  opts("support_ticket_activities"),
);
SupportActivitySchema.index({ ticketId: 1, createdAt: 1 });

/** Categories are records so new ones can be added from the admin panel without a deploy. */
export const SupportCategorySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    defaultPriority: { type: String, enum: TICKET_PRIORITIES, default: "MEDIUM" },
    /** Entity types a customer may link for this category. */
    entityTypes: { type: [String], default: [] },
    /** Non-support roles (e.g. marketplace_manager) that also work this category's tickets. */
    handlerRoles: { type: [String], default: [] },
    createdBy: id("User"),
    updatedBy: id("User"),
  },
  opts("support_categories"),
);

/**
 * A file uploaded for support. Messages reference it by id, and the backend
 * only accepts ids the same user uploaded and has not used yet, so nobody can
 * attach an arbitrary URL or somebody else's file.
 */
export const SupportAttachmentSchema = new Schema(
  {
    uploaderId: id("User", true),
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    bytes: { type: Number, required: true },
    ticketId: id("SupportTicket"),
    messageId: id("SupportMessage"),
  },
  opts("support_attachments"),
);
SupportAttachmentSchema.index({ uploaderId: 1, ticketId: 1 });

/** Atomic counter behind TIR-000001, TIR-000002, … */
export const SupportCounterSchema = new Schema(
  {
    // Always set: the upsert copies it from the filter and $setOnInsert.
    key: { type: String, unique: true },
    seq: { type: Number, default: 0 },
  },
  { collection: "support_counters", versionKey: false },
);

export const SUPPORT_MODELS = [
  { name: "SupportTicket", schema: SupportTicketSchema },
  { name: "SupportMessage", schema: SupportMessageSchema },
  { name: "SupportActivity", schema: SupportActivitySchema },
  { name: "SupportCategory", schema: SupportCategorySchema },
  { name: "SupportAttachment", schema: SupportAttachmentSchema },
  { name: "SupportCounter", schema: SupportCounterSchema },
];
