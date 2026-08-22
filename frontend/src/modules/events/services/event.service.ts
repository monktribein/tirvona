import api from "../../../lib/api";
import type { EventSearchFilters } from "../types/event.types";

const clean = (params: Record<string, unknown>) => {
  const out: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      if (value.length) out[key] = value.join(",");
      return;
    }
    if (typeof value === "boolean") {
      if (value) out[key] = "true";
      return;
    }
    out[key] = String(value);
  });
  return out;
};

export const eventDiscoveryService = {
  search: (filters: EventSearchFilters = {}) =>
    api.get("/events", { params: clean(filters as Record<string, unknown>) }),
  getDetail: (idOrSlug: string) => api.get(`/events/${idOrSlug}`),
  getDays: (idOrSlug: string) => api.get(`/events/${idOrSlug}/days`),
  getFilterOptions: () => api.get("/events/filters"),
  getCities: () => api.get("/events/cities"),
};

export const eventRegistrationService = {
  register: (payload: {
    eventId: string;
    attendDate: string;
    seats: number;
    attendees?: { name: string; age?: number }[];
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
  }) => api.post("/events/registrations", payload),

  list: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get("/events/registrations", { params: clean(params) }),

  get: (id: string) => api.get(`/events/registrations/${id}`),

  getPass: (id: string, format: "png" | "svg" = "png") =>
    api.get(`/events/registrations/${id}/pass`, { params: { format } }),

  reissuePass: (id: string, format: "png" | "svg" = "png") =>
    api.post(
      `/events/registrations/${id}/pass/reissue`,
      {},
      { params: { format } },
    ),

  cancel: (id: string, reason?: string) =>
    api.post(`/events/registrations/${id}/cancel`, { reason }),

  notifications: (page = 1, limit = 20) =>
    api.get("/events/registrations/notifications", { params: { page, limit } }),

  markNotificationsRead: () =>
    api.post("/events/registrations/notifications/read-all", {}),
};

export const eventGateService = {
  access: () => api.get("/events/scan/me", { skipToast: true }),
  scan: (payload: {
    token?: string;
    displayCode?: string;
    eventId?: string;
    action?: "entry" | "verify";
    admitCount?: number;
    deviceInfo?: string;
  }) => api.post("/events/scan", payload, { skipToast: true }),
  manualCheckIn: (payload: {
    registrationReference: string;
    admitCount?: number;
    note?: string;
  }) => api.post("/events/scan/manual-check-in", payload),
  roster: (eventId: string, date: string) =>
    api.get("/events/scan/roster", { params: { eventId, date } }),
};

export const eventOwnerService = {
  access: () => api.get("/events/owner/me", { skipToast: true }),
  ashrams: () => api.get("/events/owner/ashrams", { skipToast: true }),
  dashboard: (days = 30) =>
    api.get("/events/owner/dashboard", { params: { days }, skipToast: true }),

  listEvents: (
    params: {
      q?: string;
      status?: string;
      ashramId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) => api.get("/events/owner/events", { params: clean(params) }),

  getEvent: (id: string) => api.get(`/events/owner/events/${id}`),
  createEvent: (payload: Record<string, unknown>) =>
    api.post("/events/owner/events", payload),
  updateEvent: (id: string, payload: Record<string, unknown>) =>
    api.put(`/events/owner/events/${id}`, payload),
  submitEvent: (id: string) => api.post(`/events/owner/events/${id}/submit`, {}),
  deleteEvent: (id: string) => api.delete(`/events/owner/events/${id}`),

  days: (id: string) => api.get(`/events/owner/events/${id}/days`),
  blockDay: (payload: {
    eventId: string;
    date: string;
    totalCapacity?: number;
    blockedCount?: number;
    isClosed?: boolean;
    note?: string;
  }) => api.post("/events/owner/availability", payload),

  listRegistrations: (
    params: {
      eventId?: string;
      status?: string;
      date?: string;
      q?: string;
      page?: number;
      limit?: number;
    } = {},
  ) => api.get("/events/owner/registrations", { params: clean(params) }),
  cancelRegistration: (id: string, reason?: string) =>
    api.post(`/events/owner/registrations/${id}/cancel`, { reason }),

  listStaff: (ashramId?: string) =>
    api.get("/events/owner/staff", { params: clean({ ashramId }) }),
  createStaff: (payload: {
    userId: string;
    ashramId: string;
    eventRole: string;
    eventIds?: string[];
    employeeCode?: string;
    phone?: string;
    shift?: string;
  }) => api.post("/events/owner/staff", payload),
  setStaffStatus: (id: string, status: string) =>
    api.patch(`/events/owner/staff/${id}/status`, { status }),

  listSettings: () => api.get("/events/owner/settings", { skipToast: true }),
  upsertSetting: (payload: Record<string, unknown>) =>
    api.post("/events/owner/settings", payload),
};

export const eventAdminService = {
  dashboard: (days = 30) =>
    api.get("/events/admin/dashboard", { params: { days }, skipToast: true }),
  approvals: (limit = 50) =>
    api.get("/events/admin/approvals", { params: { limit }, skipToast: true }),
  listEvents: (params: Record<string, unknown> = {}) =>
    api.get("/events/admin/events", { params: clean(params) }),
  reviewEvent: (id: string, decision: "approve" | "reject", reason?: string) =>
    api.post(`/events/admin/events/${id}/review`, { decision, reason }),
  setStatus: (id: string, status: string) =>
    api.patch(`/events/admin/events/${id}/status`, { status }),
  setFeatured: (id: string, value: boolean) =>
    api.patch(`/events/admin/events/${id}/featured`, { value }),
  listRegistrations: (params: Record<string, unknown> = {}) =>
    api.get("/events/admin/registrations", { params: clean(params) }),
  scanLogs: (page = 1, limit = 25) =>
    api.get("/events/admin/scan-logs", { params: { page, limit } }),
  listSettings: () => api.get("/events/admin/settings", { skipToast: true }),
  upsertSetting: (payload: Record<string, unknown>) =>
    api.post("/events/admin/settings", payload),
};
