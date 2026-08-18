import api from "../lib/api";

/**
 * Super-admin console client for the Lead Collection subsystem.
 *
 * Every call here goes through the platform's own bearer token — these are
 * Tirvona staff routes. The field agents' own token never touches this file;
 * it lives entirely inside the leadTirvona app.
 */

export type LeadStatus = "pending" | "approved" | "rejected" | "converted";
export type LeadInterest =
  | "Interested"
  | "Not Interested"
  | "Follow-up Required";

export interface Lead {
  _id: string;
  name: string;
  location: {
    address?: string;
    city?: string;
    district?: string;
    state?: string;
    coordinates?: { lat: number | null; lng: number | null };
  };
  roomInventory?: {
    totalRooms?: number | null;
    roomPrice?: number | null;
    onlineRooms?: number | null;
    offlineRooms?: number | null;
  };
  contact?: { ownerName?: string; phone?: string };
  notes?: string;
  interest?: LeadInterest;
  meeting?: { requested?: boolean; time?: string; mode?: string };
  images?: string[];
  status: LeadStatus;
  capturedBy?: string | null;
  capturedByName?: string;
  capturedAt?: string;
  reviewedByAdminName?: string;
  reviewedAt?: string | null;
  reviewNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadUser {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: "field_agent" | "field_supervisor" | "lead_executive";
  status: "active" | "suspended";
  region?: string;
  state?: string;
  district?: string;
  employeeCode?: string;
  notes?: string;
  lastLoginAt?: string | null;
  leadCount?: number;
  createdByAdminId?: string;
  createdByAdminName?: string;
  createdAt?: string;
}

export interface LeadStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  converted: number;
  interested: number;
  meetingsRequested: number;
  capturedLast7Days: number;
}

export interface LeadRegion {
  state: string;
  district: string;
  source: "tirvona" | "custom";
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

const BASE = "/lead-collection/admin";

export const leadCollectionService = {
  // ── Leads ──
  listLeads: (params: Record<string, string | number> = {}) =>
    api.get<{ data: Paged<Lead> }>(`${BASE}/leads`, { params }),
  leadStats: () => api.get<{ data: LeadStats }>(`${BASE}/leads/stats`),
  getLead: (id: string) => api.get<{ data: Lead }>(`${BASE}/leads/${id}`),
  createLead: (data: unknown) => api.post(`${BASE}/leads`, data),
  updateLead: (id: string, data: unknown) =>
    api.put(`${BASE}/leads/${id}`, data),
  approveLead: (id: string, note?: string) =>
    api.post(`${BASE}/leads/${id}/approve`, { note }),
  rejectLead: (id: string, note?: string) =>
    api.post(`${BASE}/leads/${id}/reject`, { note }),
  /** Bookkeeping only — the ashram listing itself is still created by hand. */
  convertLead: (id: string, note?: string) =>
    api.post(`${BASE}/leads/${id}/convert`, { note }),
  reopenLead: (id: string, note?: string) =>
    api.post(`${BASE}/leads/${id}/reopen`, { note }),
  deleteLead: (id: string) => api.delete(`${BASE}/leads/${id}`),

  // ── Field agents (lead_users) ──
  listRegions: () => api.get<{ data: LeadRegion[] }>(`${BASE}/regions`),
  addRegion: (state: string, district: string) =>
    api.post(`${BASE}/regions`, { state, district }),
  deleteRegion: (state: string, district: string) =>
    api.delete(`${BASE}/regions`, { params: { state, district } }),
  listUsers: (params: Record<string, string | number> = {}) =>
    api.get<{ data: Paged<LeadUser> }>(`${BASE}/users`, { params }),
  createUser: (data: unknown) => api.post(`${BASE}/users`, data),
  updateUser: (id: string, data: unknown) =>
    api.put(`${BASE}/users/${id}`, data),
  resetUserPassword: (id: string, password: string) =>
    api.post(`${BASE}/users/${id}/reset-password`, { password }),
  deleteUser: (id: string) => api.delete(`${BASE}/users/${id}`),
};
