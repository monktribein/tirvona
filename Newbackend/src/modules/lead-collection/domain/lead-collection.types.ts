import type { Document, Types } from "mongoose";
import type { LeadStatus, LeadUserRole } from "./lead-collection.constants";

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
  employeeCode?: string;
}

export interface LeadTokenPayload {
  sub: string;
  scope: "lead";
  role: LeadUserRole;
  tv: number;
}

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

export type LeadUserDocument = LeadUserRecord & Document<Types.ObjectId>;

export type LeadUserListRow = LeadUserRecord & { leadCount: number };

export interface LeadCoordinates {
  lat: number | null;
  lng: number | null;
}

export interface LeadRecord {
  _id: Types.ObjectId;
  name: string;
  location: {
    address: string;
    googleMapsUrl?: string;
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
  agentNotes?: string;
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
  fieldVerified?: boolean;
  fieldVerifiedAt?: Date | null;
  fieldVerifiedByName?: string;
  fieldVerifiedById?: Types.ObjectId | null;
  lastUpdatedByName?: string;
  lastUpdatedByRole?: string;
  reviewedByAdminId: string;
  reviewedByAdminName: string;
  reviewedAt: Date | null;
  reviewNote: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type LeadDocument = LeadRecord & Document<Types.ObjectId>;
