import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export const USER_ROLES = [
  "super_admin",
  "national_admin",
  "state_admin",
  "govt_admin",
  "government_admin",
  "district_officer",
  "ashram_admin",
  "ashram_owner",
  // Legacy values remain accepted until the idempotent role migration has
  // upgraded every deployed database.
  "stay_admin",
  "owner",
  "manager",
  "reception",
  "housekeeping",
  "content_manager",
  "offer_manager",
  "blog_manager",
  "local_manager",
  "marketplace_manager",
  "service_manager",
  "finance_manager",
  "support",
  "inspector",
  "staff",
  "volunteer",
  "customer",
] as const;

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: "users", optimisticConcurrency: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true }) name: string;
  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  })
  email: string;
  @Prop({ required: true, unique: true, trim: true, index: true })
  phone: string;
  @Prop({ select: false }) passwordHash?: string;
  @Prop({ enum: USER_ROLES, default: "customer", index: true }) role: string;
  @Prop({
    enum: [
      "active",
      "pending",
      "pending_approval",
      "suspended",
      "temp_suspended",
      "perm_suspended",
      "disabled",
      "deleted",
      "archived",
    ],
    default: "active",
    index: true,
  })
  status: string;
  @Prop({ default: false }) isSuspended: boolean;
  @Prop({ default: "" }) suspensionReason: string;
  @Prop({ type: [String], default: [] }) permissions: string[];
  @Prop({ type: SchemaTypes.ObjectId, ref: "Ashram", default: null })
  employerAshramId?: Types.ObjectId;
  @Prop({ type: [SchemaTypes.ObjectId], ref: "Ashram", default: [] })
  scopedAshramIds: Types.ObjectId[];
  @Prop({ default: false, index: true }) isDeleted: boolean;
  @Prop({ default: true, index: true }) isVerified: boolean;
  @Prop({ default: 0 }) tokenVersion: number;
  @Prop({ default: "local", enum: ["local", "google"] }) authProvider: string;
  @Prop({ sparse: true, index: true }) googleId?: string;
  @Prop({ default: "" }) avatarUrl: string;
  @Prop({ select: false, default: "" }) aadhaarCardUrl: string;
  @Prop({ select: false, default: "" }) panCardUrl: string;
  @Prop({ default: "" }) district: string;
  @Prop({ default: "" }) state: string;
  @Prop({ default: "" }) city: string;
  @Prop({ default: "" }) designation: string;
  @Prop({ default: "" }) department: string;
  @Prop({ sparse: true, index: true }) employeeId?: string;
  @Prop({ sparse: true, index: true }) username?: string;
  @Prop({ default: "" }) govtIdType: string;
  @Prop({ select: false, default: "" }) govtIdNumber: string;
  @Prop({ default: "" }) govtIdUrl: string;
  @Prop({ default: "" }) gender: string;
  @Prop() dob?: Date;
  @Prop() joiningDate?: Date;
  @Prop({ default: "" }) remarks: string;
  @Prop({ default: "none" }) suspensionType: string;
  @Prop() suspendedAt?: Date;
  @Prop() suspensionEndDate?: Date;
  @Prop({ type: SchemaTypes.ObjectId, ref: "User" })
  suspendedBy?: Types.ObjectId;
  @Prop({ default: "" }) internalNotes: string;
  @Prop({ default: "" }) visibleMessage: string;
  @Prop() deletedAt?: Date;
  @Prop({ type: SchemaTypes.ObjectId, ref: "User" }) deletedBy?: Types.ObjectId;
  @Prop() lastLoginAt?: Date;
  @Prop({ select: false }) resetTokenHash?: string;
  @Prop({ select: false }) resetTokenExpiresAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ role: 1, status: 1, isDeleted: 1 });
