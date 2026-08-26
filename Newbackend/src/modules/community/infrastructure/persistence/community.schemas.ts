import { Schema, SchemaTypes } from "mongoose";
const loose = (collection: string, fields: any = {}): Schema =>
  new Schema(fields, { strict: false, timestamps: true, collection });
export const COMMUNITY_MODELS = [
  {
    name: "UserMemory",
    schema: loose("usermemories", {
      userId: { type: SchemaTypes.ObjectId, ref: "User" },
      sessionId: { type: String },
    }),
  },
  {
    name: "VolunteerJob",
    schema: loose("volunteerjobs", {
      ownerId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
      ashramId: { type: SchemaTypes.ObjectId, ref: "Ashram", index: true },
      // Public URLs use this instead of the database id.
      slug: { type: String, sparse: true, unique: true, index: true },
    }),
  },
  {
    name: "VolunteerApplication",
    schema: loose("volunteerapplications", {
      jobId: { type: SchemaTypes.ObjectId, ref: "VolunteerJob", index: true },
      userId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
    }),
  },
  {
    name: "VisitorArticle",
    schema: loose("visitorarticles", {
      visitorId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
      bookingId: {
        type: SchemaTypes.ObjectId,
        ref: "CommunityBooking",
        index: true,
      },
      ashramId: {
        type: SchemaTypes.ObjectId,
        ref: "CommunityAshram",
        index: true,
      },
      ownerId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
      slug: { type: String, unique: true, index: true },
    }),
  },
  {
    name: "VisitorArticleComment",
    schema: loose("visitorarticlecomments", {
      articleId: {
        type: SchemaTypes.ObjectId,
        ref: "VisitorArticle",
        index: true,
      },
      userId: { type: SchemaTypes.ObjectId, ref: "User" },
    }),
  },
  {
    name: "VisitorArticleLike",
    schema: loose("visitorarticlelikes", {
      articleId: {
        type: SchemaTypes.ObjectId,
        ref: "VisitorArticle",
        index: true,
      },
      userId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
    }),
  },
  {
    name: "VisitorArticleStatusHistory",
    schema: loose("visitorarticlestatushistories", {
      articleId: {
        type: SchemaTypes.ObjectId,
        ref: "VisitorArticle",
        index: true,
      },
      actionBy: { type: SchemaTypes.ObjectId, ref: "User" },
    }),
  },
  {
    name: "CommunityNotification",
    schema: loose("notifications", {
      recipientId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
      userId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
    }),
  },
  {
    name: "CommunityBooking",
    schema: loose("bookings", {
      customerId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
      ashramId: { type: SchemaTypes.ObjectId, ref: "CommunityAshram" },
    }),
  },
  {
    name: "CommunityAshram",
    schema: loose("ashrams", {
      ownerId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
    }),
  },
];
COMMUNITY_MODELS[0].schema.index({ userId: 1 }, { unique: true, sparse: true });
COMMUNITY_MODELS[0].schema.index(
  { sessionId: 1 },
  { unique: true, sparse: true },
);
COMMUNITY_MODELS[3].schema.index({ status: 1, createdAt: -1 });
COMMUNITY_MODELS[5].schema.index({ articleId: 1, userId: 1 }, { unique: true });
