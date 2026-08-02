import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Schema, SchemaTypes } from "mongoose";

export const AuditLogSchema = new Schema(
  {
    userId: { type: SchemaTypes.ObjectId, ref: "User" },
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    details: SchemaTypes.Mixed,
    before: SchemaTypes.Mixed,
    after: SchemaTypes.Mixed,
    ipAddress: String,
    userAgent: String,
    requestId: String,
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: "audit_logs", optimisticConcurrency: true },
);
AuditLogSchema.index({ module: 1, action: 1, timestamp: -1 });

@Module({
  imports: [
    MongooseModule.forFeature([{ name: "AuditLog", schema: AuditLogSchema }]),
  ],
  exports: [MongooseModule],
})
export class AuditModule {}
