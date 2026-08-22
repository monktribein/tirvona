import api from "../../../lib/api";
import type {
  AartiSearchFilters,
  AartiStreamProvider,
} from "../types/aarti.types";

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

export const aartiDiscoveryService = {
  search: (filters: AartiSearchFilters = {}) =>
    api.get("/aarti/sessions", {
      params: clean(filters as Record<string, unknown>),
    }),

  getDetail: (idOrSlug: string, date?: string) =>
    api.get(`/aarti/sessions/${idOrSlug}`, { params: clean({ date }) }),

  getPasses: (sessionId: string, date?: string) =>
    api.get(`/aarti/sessions/${sessionId}/passes`, { params: clean({ date }) }),

  getCalendar: (sessionId: string, fromDate: string, toDate: string) =>
    api.get(`/aarti/sessions/${sessionId}/calendar`, {
      params: { fromDate, toDate },
    }),

  getReviews: (sessionId: string, page = 1, limit = 10) =>
    api.get(`/aarti/sessions/${sessionId}/reviews`, { params: { page, limit } }),

  getQuote: (payload: {
    sessionId: string;
    passTypeId: string;
    sessionDate: string;
    passCount: number;
    donationAmount?: number;
  }) => api.post("/aarti/quote", payload, { skipToast: true }),

  getFilterOptions: () => api.get("/aarti/filters"),

  getCities: () => api.get("/aarti/cities"),
};

export const livePoojaService = {
  wall: (
    params: {
      q?: string;
      city?: string;
      ashramId?: string;
      liveOnly?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ) => api.get("/aarti/live", { params: clean(params) }),

  detail: (slug: string) => api.get(`/aarti/live/${slug}`),
};

export const aartiBookingService = {
  create: (payload: {
    sessionId: string;
    passTypeId: string;
    sessionDate: string;
    passCount: number;
    donationAmount?: number;
    devotees?: { name: string; age?: number; gotra?: string }[];
    sankalpName?: string;
    sankalpGotra?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
  }) => api.post("/aarti/bookings", payload),

  list: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get("/aarti/bookings", { params: clean(params) }),

  get: (id: string) => api.get(`/aarti/bookings/${id}`),

  createPaymentOrder: (id: string) =>
    api.post(`/aarti/bookings/${id}/payment/order`, {}),

  confirmPayment: (
    id: string,
    payload: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      method?: string;
    },
  ) => api.post(`/aarti/bookings/${id}/payment`, payload),

  getPass: (id: string, format: "png" | "svg" = "png") =>
    api.get(`/aarti/bookings/${id}/pass`, { params: { format } }),

  reissuePass: (id: string, format: "png" | "svg" = "png") =>
    api.post(`/aarti/bookings/${id}/pass/reissue`, {}, { params: { format } }),

  refundPreview: (id: string) =>
    api.get(`/aarti/bookings/${id}/refund-preview`, { skipToast: true }),

  cancel: (id: string, reason?: string) =>
    api.post(`/aarti/bookings/${id}/cancel`, { reason }),

  review: (
    id: string,
    payload: {
      rating: number;
      arrangement?: number;
      cleanliness?: number;
      staff?: number;
      valueForMoney?: number;
      comment?: string;
    },
  ) => api.post(`/aarti/bookings/${id}/review`, payload),

  notifications: (page = 1, limit = 20) =>
    api.get("/aarti/bookings/notifications", { params: { page, limit } }),

  markNotificationsRead: () =>
    api.post("/aarti/bookings/notifications/read-all", {}),
};

export const aartiGateService = {
  access: () => api.get("/aarti/scan/me", { skipToast: true }),

  scan: (payload: {
    token?: string;
    displayCode?: string;
    sessionId?: string;
    action?: "entry" | "verify";
    admitCount?: number;
    deviceInfo?: string;
  }) => api.post("/aarti/scan", payload, { skipToast: true }),

  manualCheckIn: (payload: {
    bookingReference: string;
    admitCount?: number;
    note?: string;
  }) => api.post("/aarti/scan/manual-check-in", payload),

  roster: (sessionId: string, date: string) =>
    api.get("/aarti/scan/roster", { params: { sessionId, date } }),
};

export const aartiOwnerService = {
  access: () => api.get("/aarti/owner/me", { skipToast: true }),
  ashrams: () => api.get("/aarti/owner/ashrams", { skipToast: true }),
  dashboard: (days = 30) =>
    api.get("/aarti/owner/dashboard", { params: { days }, skipToast: true }),

  listSessions: (
    params: {
      q?: string;
      status?: string;
      ashramId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) => api.get("/aarti/owner/sessions", { params: clean(params) }),

  getSession: (id: string) => api.get(`/aarti/owner/sessions/${id}`),
  createSession: (payload: Record<string, unknown>) =>
    api.post("/aarti/owner/sessions", payload),
  updateSession: (id: string, payload: Record<string, unknown>) =>
    api.put(`/aarti/owner/sessions/${id}`, payload),
  submitSession: (id: string) =>
    api.post(`/aarti/owner/sessions/${id}/submit`, {}),
  deleteSession: (id: string) => api.delete(`/aarti/owner/sessions/${id}`),

  createPassType: (payload: Record<string, unknown>) =>
    api.post("/aarti/owner/pass-types", payload),
  updatePassType: (id: string, payload: Record<string, unknown>) =>
    api.put(`/aarti/owner/pass-types/${id}`, payload),
  deletePassType: (id: string) => api.delete(`/aarti/owner/pass-types/${id}`),

  listPricing: (sessionId: string) =>
    api.get(`/aarti/owner/sessions/${sessionId}/pricing`),
  upsertPricing: (payload: Record<string, unknown>) =>
    api.post("/aarti/owner/pricing", payload),
  deletePricing: (id: string) => api.delete(`/aarti/owner/pricing/${id}`),

  listHolidays: (sessionId?: string) =>
    api.get("/aarti/owner/holidays", { params: clean({ sessionId }) }),
  upsertHoliday: (payload: Record<string, unknown>) =>
    api.post("/aarti/owner/holidays", payload),
  deleteHoliday: (id: string) => api.delete(`/aarti/owner/holidays/${id}`),

  calendar: (sessionId: string, fromDate: string, toDate: string) =>
    api.get(`/aarti/owner/sessions/${sessionId}/calendar`, {
      params: { fromDate, toDate },
    }),
  blockSeats: (payload: {
    sessionId: string;
    passTypeId: string;
    date: string;
    blockedCount?: number;
    isClosed?: boolean;
    customPrice?: number;
    note?: string;
  }) => api.post("/aarti/owner/availability", payload),

  listBookings: (
    params: {
      sessionId?: string;
      status?: string;
      date?: string;
      q?: string;
      page?: number;
      limit?: number;
    } = {},
  ) => api.get("/aarti/owner/bookings", { params: clean(params) }),
  cancelBooking: (id: string, reason?: string) =>
    api.post(`/aarti/owner/bookings/${id}/cancel`, { reason }),

  listStreams: (
    params: { q?: string; status?: string; ashramId?: string; page?: number } = {},
  ) => api.get("/aarti/owner/streams", { params: clean(params) }),
  createStream: (payload: {
    ashramId: string;
    sessionId?: string;
    title: string;
    description?: string;
    deity?: string;
    provider?: AartiStreamProvider;
    streamUrl: string;
    thumbnailUrl?: string;
    venueName?: string;
    city?: string;
    state?: string;
    startsAt?: string;
    endsAt?: string;
    recurrenceDays?: number[];
  }) => api.post("/aarti/owner/streams", payload),
  updateStream: (id: string, payload: Record<string, unknown>) =>
    api.put(`/aarti/owner/streams/${id}`, payload),
  submitStream: (id: string) => api.post(`/aarti/owner/streams/${id}/submit`, {}),
  setStreamLive: (id: string, value: boolean) =>
    api.patch(`/aarti/owner/streams/${id}/live`, { value }),
  deleteStream: (id: string) => api.delete(`/aarti/owner/streams/${id}`),

  listStaff: (ashramId?: string) =>
    api.get("/aarti/owner/staff", { params: clean({ ashramId }) }),
  createStaff: (payload: {
    userId: string;
    ashramId: string;
    aartiRole: string;
    sessionIds?: string[];
    employeeCode?: string;
    phone?: string;
    shift?: string;
  }) => api.post("/aarti/owner/staff", payload),
  setStaffStatus: (id: string, status: string) =>
    api.patch(`/aarti/owner/staff/${id}/status`, { status }),

  listSettings: () => api.get("/aarti/owner/settings", { skipToast: true }),
  upsertSetting: (payload: Record<string, unknown>) =>
    api.post("/aarti/owner/settings", payload),

  settlements: (status?: string) =>
    api.get("/aarti/owner/settlements", { params: clean({ status }) }),
  sessionReport: (id: string, fromDate: string, toDate: string) =>
    api.get(`/aarti/owner/sessions/${id}/report`, {
      params: { fromDate, toDate },
    }),
};

export const aartiAdminService = {
  dashboard: (days = 30) =>
    api.get("/aarti/admin/dashboard", { params: { days }, skipToast: true }),
  approvals: (limit = 50) =>
    api.get("/aarti/admin/approvals", { params: { limit }, skipToast: true }),
  listSessions: (params: Record<string, unknown> = {}) =>
    api.get("/aarti/admin/sessions", { params: clean(params) }),
  reviewSession: (id: string, decision: "approve" | "reject", reason?: string) =>
    api.post(`/aarti/admin/sessions/${id}/review`, { decision, reason }),
  setSessionStatus: (id: string, status: string) =>
    api.patch(`/aarti/admin/sessions/${id}/status`, { status }),
  setSessionFeatured: (id: string, value: boolean) =>
    api.patch(`/aarti/admin/sessions/${id}/featured`, { value }),

  listStreams: (params: Record<string, unknown> = {}) =>
    api.get("/aarti/admin/streams", { params: clean(params) }),
  reviewStream: (id: string, decision: "approve" | "reject", reason?: string) =>
    api.post(`/aarti/admin/streams/${id}/review`, { decision, reason }),
  setStreamFeatured: (id: string, value: boolean) =>
    api.patch(`/aarti/admin/streams/${id}/featured`, { value }),

  listBookings: (params: Record<string, unknown> = {}) =>
    api.get("/aarti/admin/bookings", { params: clean(params) }),
  settlements: (status?: string) =>
    api.get("/aarti/admin/settlements", { params: clean({ status }) }),
  scanLogs: (page = 1, limit = 25) =>
    api.get("/aarti/admin/scan-logs", { params: { page, limit } }),
  reviews: (page = 1, limit = 25) =>
    api.get("/aarti/admin/reviews", { params: { page, limit } }),
  moderateReview: (id: string, status: string, note?: string) =>
    api.patch(`/aarti/admin/reviews/${id}/status`, { status, note }),
  listSettings: () => api.get("/aarti/admin/settings", { skipToast: true }),
  upsertSetting: (payload: Record<string, unknown>) =>
    api.post("/aarti/admin/settings", payload),
};
