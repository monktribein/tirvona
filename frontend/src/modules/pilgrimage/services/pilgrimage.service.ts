import api from "../../../lib/api";
import type { CircuitSearchFilters } from "../types/pilgrimage.types";

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

export const pilgrimageDiscoveryService = {
  search: (filters: CircuitSearchFilters = {}) =>
    api.get("/pilgrimage/circuits", {
      params: clean(filters as Record<string, unknown>),
    }),
  getDetail: (idOrSlug: string) => api.get(`/pilgrimage/circuits/${idOrSlug}`),
  getFilterOptions: () => api.get("/pilgrimage/filters"),
  templates: (params: { q?: string; durationDays?: number } = {}) =>
    api.get("/pilgrimage/templates", { params: clean(params) }),
};

export const plannerService = {
  generate: (payload: {
    circuitId: string;
    startDate?: string;
    durationDays?: number;
    travellers?: number;
    pace?: string;
  }) => api.post("/pilgrimage/planner/generate", payload, { skipToast: true }),

  listMine: (page = 1, limit = 20) =>
    api.get("/pilgrimage/itineraries", { params: { page, limit } }),

  get: (id: string) => api.get(`/pilgrimage/itineraries/${id}`),

  save: (payload: {
    title: string;
    circuitId?: string;
    startDate?: string;
    travellers?: number;
    pace?: string;
    days?: unknown[];
    notes?: string;
  }) => api.post("/pilgrimage/itineraries", payload),

  remove: (id: string) => api.delete(`/pilgrimage/itineraries/${id}`),
};

export const pilgrimageOwnerService = {
  access: () => api.get("/pilgrimage/owner/me", { skipToast: true }),
  ashrams: () => api.get("/pilgrimage/owner/ashrams", { skipToast: true }),
  dashboard: () => api.get("/pilgrimage/owner/dashboard", { skipToast: true }),

  listCircuits: (
    params: {
      q?: string;
      status?: string;
      ashramId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) => api.get("/pilgrimage/owner/circuits", { params: clean(params) }),

  getCircuit: (id: string) => api.get(`/pilgrimage/owner/circuits/${id}`),
  createCircuit: (payload: Record<string, unknown>) =>
    api.post("/pilgrimage/owner/circuits", payload),
  updateCircuit: (id: string, payload: Record<string, unknown>) =>
    api.put(`/pilgrimage/owner/circuits/${id}`, payload),
  submitCircuit: (id: string) =>
    api.post(`/pilgrimage/owner/circuits/${id}/submit`, {}),
  deleteCircuit: (id: string) => api.delete(`/pilgrimage/owner/circuits/${id}`),

  addStop: (payload: Record<string, unknown>) =>
    api.post("/pilgrimage/owner/stops", payload),
  updateStop: (id: string, payload: Record<string, unknown>) =>
    api.put(`/pilgrimage/owner/stops/${id}`, payload),
  deleteStop: (id: string) => api.delete(`/pilgrimage/owner/stops/${id}`),
  reorderStops: (payload: {
    circuitId: string;
    stops: { _id: string; dayNumber: number; order?: number }[];
  }) => api.post("/pilgrimage/owner/stops/reorder", payload),

  listSettings: () => api.get("/pilgrimage/owner/settings", { skipToast: true }),
  upsertSetting: (payload: Record<string, unknown>) =>
    api.post("/pilgrimage/owner/settings", payload),
};

export const pilgrimageAdminService = {
  dashboard: () => api.get("/pilgrimage/admin/dashboard", { skipToast: true }),
  approvals: (limit = 50) =>
    api.get("/pilgrimage/admin/approvals", {
      params: { limit },
      skipToast: true,
    }),
  listCircuits: (params: Record<string, unknown> = {}) =>
    api.get("/pilgrimage/admin/circuits", { params: clean(params) }),
  reviewCircuit: (id: string, decision: "approve" | "reject", reason?: string) =>
    api.post(`/pilgrimage/admin/circuits/${id}/review`, { decision, reason }),
  setStatus: (id: string, status: string) =>
    api.patch(`/pilgrimage/admin/circuits/${id}/status`, { status }),
  setFeatured: (id: string, value: boolean) =>
    api.patch(`/pilgrimage/admin/circuits/${id}/featured`, { value }),
  savedItineraries: (page = 1, limit = 25) =>
    api.get("/pilgrimage/admin/itineraries", { params: { page, limit } }),
  listSettings: () => api.get("/pilgrimage/admin/settings", { skipToast: true }),
  upsertSetting: (payload: Record<string, unknown>) =>
    api.post("/pilgrimage/admin/settings", payload),
};
