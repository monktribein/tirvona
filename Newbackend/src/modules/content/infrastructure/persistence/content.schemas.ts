import { Schema, SchemaTypes } from "mongoose";

const schema = (collection: string): Schema =>
  new Schema({}, { strict: false, timestamps: true, collection });

export const CONTENT_MODELS = [
  {
    name: "BlogPost",
    schema: new Schema(
      { authorId: { type: SchemaTypes.ObjectId, ref: "BlogAuthor" } },
      { strict: false, timestamps: true, collection: "blogposts" },
    ),
  },
  { name: "BlogAuthor", schema: schema("blogauthors") },
  {
    name: "BlogComment",
    schema: new Schema(
      { postId: { type: SchemaTypes.ObjectId, ref: "BlogPost", index: true } },
      { strict: false, timestamps: true, collection: "blogcomments" },
    ),
  },
  {
    name: "ContentChangeRequest",
    schema: new Schema(
      {
        userId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
        approvedBy: { type: SchemaTypes.ObjectId, ref: "User" },
        rejectedBy: { type: SchemaTypes.ObjectId, ref: "User" },
      },
      { strict: false, timestamps: true, collection: "contentchangerequests" },
    ),
  },
  { name: "Banner", schema: schema("banners") },
  { name: "FeaturedBanner", schema: schema("featured_banners") },
  { name: "ContentAuditLog", schema: schema("auditlogs") },
  { name: "PilgrimageCircuit", schema: schema("pilgrimagecircuits") },
  { name: "Temple", schema: schema("temples") },
  { name: "EventFestival", schema: schema("eventfestivals") },
  { name: "SacredDirectoryItem", schema: schema("sacreddirectoryitems") },
  { name: "PlannerTemplate", schema: schema("plannertemplates") },
  { name: "TripItinerary", schema: schema("tripitineraries") },
  { name: "LocalServiceItem", schema: schema("localserviceitems") },
];

CONTENT_MODELS[0].schema.index({ status: 1, category: 1, createdAt: -1 });
CONTENT_MODELS[2].schema.index({ postId: 1, status: 1, createdAt: -1 });
CONTENT_MODELS[3].schema.index({ status: 1, userId: 1, createdAt: -1 });
CONTENT_MODELS[7].schema.index({ status: 1, circuitType: 1 });
CONTENT_MODELS[8].schema.index({ status: 1, city: 1, rating: -1 });
CONTENT_MODELS[13].schema.index({ status: 1, city: 1, category: 1 });
