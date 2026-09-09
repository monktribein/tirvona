import api from "../lib/api";

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
  role: "field_agent" | "field_supervisor" | "lead_executive" | "document_verifier" | "field_executive";
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


export interface TrackingPoint {
  lat: number;
  lng: number;
  recordedAt: string;
}

export interface TrackingLeg {
  kind: "move" | "stop";
  startedAt: string;
  endedAt: string;
  minutes: number;
  km: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

export interface TrackingVisit {
  lat: number;
  lng: number;
  arrivedAt: string;
  leftAt: string;
  minutes: number;
  fixes: number;
}

export interface TrackingDay {
  date: string;
  fixes: number;
  totalKm: number;
  movingMinutes: number;
  idleMinutes: number;
  trackedMinutes: number;
  startedAt: string | null;
  endedAt: string | null;
  startLocation: { lat: number; lng: number } | null;
  endLocation: { lat: number; lng: number } | null;
  latest: TrackingPoint | null;
  route: TrackingPoint[];
  timeline: TrackingLeg[];
  visited: TrackingVisit[];
}

export interface TrackingAgent {
  id: string;
  name: string;
  phone?: string;
  state?: string;
  district?: string;
  consent: {
    granted: boolean;
    grantedAt: string | null;
    revokedAt: string | null;
    deviceLabel: string;
  };
}

export interface TrackingLivePosition {
  agentId: string;
  agentName: string;
  lat: number;
  lng: number;
  recordedAt: string;
  minutesAgo: number;
}

export interface TrackingHistoryRow {
  date: string;
  fixes: number;
  totalKm: number;
  firstAt: string;
  lastAt: string;
}

const BASE = "/lead-collection/admin";

export const leadCollectionService = {
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
  convertLead: (id: string, note?: string) =>
    api.post(`${BASE}/leads/${id}/convert`, { note }),
  reopenLead: (id: string, note?: string) =>
    api.post(`${BASE}/leads/${id}/reopen`, { note }),
  deleteLead: (id: string) => api.delete(`${BASE}/leads/${id}`),

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

  getAttendanceSummary: () =>
    api.get<{ data: { summaryMap: Record<string, any>; todayMap: Record<string, any> } }>(
      `${BASE}/attendance/summary`,
    ),
  getAgentAttendance: (agentId: string, params: Record<string, string | number> = {}) =>
    api.get<{
      data: {
        agent: any;
        stats: { totalDaysPresent: number; totalHoursWorked: string; totalMinutesWorked: number; totalRecords: number };
        items: any[];
        total: number;
        page: number;
        pages: number;
      };
    }>(`${BASE}/attendance/agent/${agentId}`, { params }),

  /** Movement tracking. Scope is enforced server-side by the admin guard. */
  getAgentTracking: (agentId: string, date?: string) =>
    api.get<{ data: { agent: TrackingAgent; day: TrackingDay } }>(
      `${BASE}/agents/${agentId}/tracking`,
      { params: date ? { date } : {} },
    ),
  getAgentTrackingHistory: (
    agentId: string,
    params: Record<string, string> = {},
  ) =>
    api.get<{ data: TrackingHistoryRow[] }>(
      `${BASE}/agents/${agentId}/tracking/history`,
      { params },
    ),
  getLiveTracking: () =>
    api.get<{ data: TrackingLivePosition[] }>(`${BASE}/tracking/live`),
};
