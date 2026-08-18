import type { Document, Types } from "mongoose";
import type { LeadStatus, LeadUserRole } from "./lead-collection.constants";

/** A signed-in field agent, as the lead guard attaches it to the request. */
export interface AuthenticatedLeadUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: LeadUserRole;
  status: string;
  region: string;
  state: string;
  district: string;
}

/** Payload carried by a lead-scope JWT. */
export interface LeadTokenPayload {
  sub: string;
  scope: "lead";
  role: LeadUserRole;
  tv: number;
}

/** A `lead_users` row as stored, without Mongoose document machinery. */
export interface LeadUserRecord {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  email: string;
  passwordHash?: string;
  role: LeadUserRole;
  status: string;
  region: string;
  state: string;
  district: string;
  employeeCode: string;
  notes: string;
  lastLoginAt: Date | null;
  tokenVersion: number;
  createdByAdminId: string;
  createdByAdminName: string;
}

/** The same row hydrated by Mongoose (what `Model<T>` is parameterised on). */
export type LeadUserDocument = LeadUserRecord & Document<Types.ObjectId>;

/** A lead user row as the admin console consumes it. */
export type LeadUserListRow = LeadUserRecord & { leadCount: number };

export interface LeadCoordinates {
  lat: number | null;
  lng: number | null;
}

/** A `leads` row as stored. */
export interface LeadRecord {
  _id: Types.ObjectId;
  name: string;
  location: {
    address: string;
    city: string;
    district: string;
    state: string;
    coordinates: LeadCoordinates;
  };
  geo?: { type: "Point"; coordinates: number[] };
  roomInventory: {
    totalRooms: number | null;
    roomPrice: number | null;
    onlineRooms: number | null;
    offlineRooms: number | null;
  };
  contact: { ownerName: string; phone: string };
  notes: string;
  interest: string;
  meeting: { requested: boolean; time: string; mode: string };
  images: string[];
  status: LeadStatus;
  capturedBy: Types.ObjectId | null;
  capturedByName: string;
  capturedAt: Date;
  assignedAgentId?: Types.ObjectId | null;
  assignedAgentName?: string;
  assignedAgentCode?: string;
  reviewedByAdminId: string;
  reviewedByAdminName: string;
  reviewedAt: Date | null;
  reviewNote: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type LeadDocument = LeadRecord & Document<Types.ObjectId>;
