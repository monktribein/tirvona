import api from "../lib/api";

export const authService = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: unknown) => api.post("/auth/register", data),
  verifyRegistrationOtp: (otpToken: string, otp: string) =>
    api.post("/auth/register/verify-otp", { otpToken, otp }),
  verifyLoginOtp: (otpToken: string, otp: string) =>
    api.post("/auth/login/verify-otp", { otpToken, otp }),
  resendOtp: (otpToken: string) => api.post("/auth/resend-otp", { otpToken }),
  sendOtp: (phone: string) => api.post("/auth/otp/send", { phone }),
  verifyOtp: (phone: string, otp: string) =>
    api.post("/auth/otp/verify", { phone, otp }),
  google: (credential: string) => api.post("/auth/google", { credential }),
  googleVerifyOtp: (googleToken: string, otp: string) =>
    api.post("/auth/google/verify-otp", { googleToken, otp }),
  googleResendOtp: (googleToken: string) =>
    api.post("/auth/google/resend-otp", { googleToken }),
  googleComplete: (googleToken: string, name: string, phone: string) =>
    api.post("/auth/google/complete", { googleToken, name, phone }),
  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),
  verifyResetToken: (token: string) => api.get(`/auth/reset-password/${token}`),
  resetPassword: (token: string, newPassword: string) =>
    api.post("/auth/reset-password", { token, newPassword }),
  me: () => api.get("/auth/me"),
  updateMe: (data: { name?: string; phone?: string }) =>
    api.put("/auth/me", data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put("/auth/me/password", { currentPassword, newPassword }),
};

export const ashramService = {
  search: (params: Record<string, string> = {}) =>
    api.get("/ashrams", { params }),
  getById: (id: string) => api.get(`/ashrams/${id}`),
  getBySlug: (city: string, slug: string) =>
    api.get(`/ashrams/by-slug/${encodeURIComponent(city)}/${encodeURIComponent(slug)}`),
  getManagedById: (id: string) => api.get(`/ashrams/manage/${id}`),
  myListings: () => api.get("/ashrams/my-listings/all"),
  ownerParking: () => api.get("/ashrams/owner-parking"),
  onboardOwnerParking: (data: unknown) =>
    api.post("/ashrams/owner-parking", data),
  create: (data: unknown) => api.post("/ashrams", data),
  update: (id: string, data: unknown) => api.put(`/ashrams/${id}`, data),
  uploadDocuments: (id: string, data: unknown) =>
    api.post(`/ashrams/${id}/documents`, data),
  destinations: () => api.get("/ashrams/destinations"),
  byDestination: (city: string) =>
    api.get(`/ashrams/destinations/${encodeURIComponent(city)}`),
  getAddOns: (ashramId: string) => api.get(`/ashrams/${ashramId}/add-ons`),
  createAddOn: (ashramId: string, data: unknown) =>
    api.post(`/ashrams/${ashramId}/add-ons`, data),
  updateAddOn: (ashramId: string, serviceId: string, data: unknown) =>
    api.put(`/ashrams/${ashramId}/add-ons/${serviceId}`, data),
  deleteAddOn: (ashramId: string, serviceId: string) =>
    api.delete(`/ashrams/${ashramId}/add-ons/${serviceId}`),
};

// ── Temples ─────────────────────────────────────────────────────────────────
export const templeService = {
  list: (params: Record<string, string | number | boolean> = {}) =>
    api.get("/temples", { params }),
  getBySlug: (slug: string) => api.get(`/temples/${encodeURIComponent(slug)}`),
  nearby: (id: string, radius = 5) => api.get(`/temples/${id}/nearby`, { params: { radius } }),
  nearbyByCoordinates: (lat: number, lng: number, radius = 5) =>
    api.get("/temples/nearby", { params: { lat, lng, radius } }),
  adminList: (params: Record<string, string | number | boolean> = {}) =>
    api.get("/temples/admin/all", { params }),
  /** Load exactly one temple by id for the admin editor. */
  getAdminById: (id: string) => api.get(`/temples/admin/${id}`),
  create: (data: unknown) => api.post("/temples/admin", data),
  update: (id: string, data: unknown) => api.patch(`/temples/admin/${id}`, data),
  setStatus: (id: string, status: "draft" | "published" | "archived") =>
    api.patch(`/temples/admin/${id}`, { status }),
  remove: (id: string) => api.delete(`/temples/admin/${id}`),
  aartis: (id: string) => api.get(`/temples/admin/${id}/aartis`),
  addAarti: (id: string, data: unknown) => api.post(`/temples/admin/${id}/aartis`, data),
  updateAarti: (id: string, aartiId: string, data: unknown) => api.patch(`/temples/admin/${id}/aartis/${aartiId}`, data),
  removeAarti: (id: string, aartiId: string) => api.delete(`/temples/admin/${id}/aartis/${aartiId}`),
  festivals: (id: string) => api.get(`/temples/admin/${id}/festivals`),
  addFestival: (id: string, data: unknown) => api.post(`/temples/admin/${id}/festivals`, data),
  updateFestival: (id: string, festivalId: string, data: unknown) => api.patch(`/temples/admin/${id}/festivals/${festivalId}`, data),
  removeFestival: (id: string, festivalId: string) => api.delete(`/temples/admin/${id}/festivals/${festivalId}`),
};

// ── Rooms ────────────────────────────────────────────────────────────────────
export const roomService = {
  create: (data: unknown) => api.post("/rooms", data),
  update: (id: string, data: unknown) => api.put(`/rooms/${id}`, data),
  remove: (id: string) => api.delete(`/rooms/${id}`),
  setAvailability: (id: string, data: unknown) =>
    api.post(`/rooms/${id}/availability`, data),
  calendar: (id: string, startDate: string, endDate: string) =>
    api.get(`/rooms/${id}/calendar`, { params: { startDate, endDate } }),
  availabilityCalendar: (id: string, startDate: string, endDate: string) =>
    api.get(`/rooms/${id}/availability-calendar`, {
      params: { startDate, endDate },
    }),
};

export const offlineInventoryService = {
  rooms: (params: Record<string, string> = {}) =>
    api.get("/offline-inventory/rooms", { params }),
  summary: (ashramId?: string) =>
    api.get("/offline-inventory/summary", {
      params: ashramId ? { ashramId } : {},
    }),
  transfers: (params: Record<string, string> = {}) =>
    api.get("/offline-inventory/transfers", { params }),
  create: (data: unknown) => api.post("/offline-inventory/rooms", data),
  update: (id: string, data: unknown) =>
    api.put(`/offline-inventory/rooms/${id}`, data),
  remove: (id: string) => api.delete(`/offline-inventory/rooms/${id}`),
  transfer: (id: string, data: unknown) =>
    api.post(`/offline-inventory/rooms/${id}/transfer`, data),
};

export const selfBookingService = {
  ashrams: () => api.get("/bookings/self/ashrams"),
  availability: (params: {
    ashramId: string;
    checkInDate: string;
    checkOutDate: string;
  }) => api.get("/bookings/self/availability", { params }),
  create: (data: unknown) => api.post("/bookings/self", data),
  receipt: (id: string) => api.get(`/bookings/self/${id}/receipt`),
  receiptQr: async (id: string): Promise<string> => {
    const res = await api.get(`/bookings/self/${id}/qr.svg`, {
      responseType: "text",
    });
    return typeof res.data === "string" ? res.data : "";
  },
};

export const bookingService = {
  quote: (data: unknown) =>
    api.post("/bookings/quote", data, { skipToast: true }),
  create: (data: unknown) => api.post("/bookings/create", data),
  getById: (id: string) => api.get(`/bookings/${id}`),
  createPaymentOrder: (id: string) =>
    api.post(`/bookings/${id}/payment/order`, {}),
  pay: (id: string, data: unknown) => api.post(`/bookings/${id}/payment`, data),
  history: () => api.get("/bookings/history"),
  dashboard: (params: Record<string, string> = {}) =>
    api.get("/bookings/dashboard", { params }),
  checkin: (id: string, checkInCode: string) =>
    api.post(`/bookings/${id}/checkin`, { checkInCode }),
  checkout: (id: string) => api.post(`/bookings/${id}/checkout`, {}),
  cancel: (id: string, reason: string) =>
    api.post(`/bookings/${id}/cancel`, { reason }),
  assignRoomNumber: (id: string, roomNumber: string) =>
    api.put(`/bookings/${id}/room-number`, { roomNumber }),
  updateStatus: (id: string, status: string) =>
    api.put(`/bookings/${id}/status`, { status }),
};

export const bookingFinanceService = {
  summary: (ashramId?: string) =>
    api.get("/booking-finance/summary", {
      params: ashramId ? { ashramId } : {},
    }),
  payments: (ashramId?: string) =>
    api.get("/booking-finance/payments", {
      params: ashramId ? { ashramId } : {},
    }),
  settlements: (ashramId?: string) =>
    api.get("/booking-finance/settlements", {
      params: ashramId ? { ashramId } : {},
    }),
  refunds: (ashramId?: string) =>
    api.get("/booking-finance/refunds", {
      params: ashramId ? { ashramId } : {},
    }),
};

export const payoutService = {
  ashrams: () => api.get("/payouts/ashrams"),
  summary: (ashramId?: string) =>
    api.get("/payouts/summary", { params: ashramId ? { ashramId } : {} }),
  list: (params: Record<string, string | number> = {}) =>
    api.get("/payouts", { params }),
  get: (id: string) => api.get(`/payouts/${id}`),
  bankAccount: (ashramId: string) =>
    api.get(`/payouts/bank-account/${ashramId}`),
  bankAccounts: () => api.get("/payouts/bank-accounts"),
  saveBankAccount: (ashramId: string, data: unknown) =>
    api.put(`/payouts/bank-account/${ashramId}`, data),
  request: (data: unknown) => api.post("/payouts/requests", data),
  providerStatus: () => api.get("/payouts/provider-status"),
  process: (id: string) => api.post(`/payouts/${id}/process`, {}),
  reconcile: (id: string) => api.post(`/payouts/${id}/reconcile`, {}),
  revealManualBankDetails: (id: string, reason: string) =>
    api.post(`/payouts/${id}/manual-bank-details`, { reason }),
  recordManualPayment: (id: string, data: unknown) =>
    api.post(`/payouts/${id}/manual-payment`, data),
};

export const reviewService = {
  create: (data: {
    ashramId: string;
    rating: { overall: number } & Record<string, number>;
    comment: string;
    bookingId?: string;
  }) => api.post("/reviews", data),
  forAshram: (ashramId: string) => api.get(`/reviews/ashram/${ashramId}`),
  recent: () => api.get("/reviews/recent"),
  eligibility: (ashramId: string) =>
    api.get(`/reviews/eligibility/${ashramId}`),
  remove: (id: string) => api.delete(`/reviews/${id}`),
};

export const refundService = {
  list: (params: Record<string, unknown> = {}) =>
    api.get("/refunds", { params }),
  summary: () => api.get("/refunds/summary"),
  get: (id: string) => api.get(`/refunds/${id}`),
  create: (data: {
    module: string;
    sourceId: string;
    reason: string;
    customerNote?: string;
  }) => api.post("/refunds", data),
  review: (id: string, note = "") =>
    api.post(`/refunds/${id}/review`, { note }),
  approve: (id: string, note = "") =>
    api.post(`/refunds/${id}/approve`, { note }),
  reject: (id: string, reason: string) =>
    api.post(`/refunds/${id}/reject`, { reason }),
  cancel: (id: string, note = "") =>
    api.post(`/refunds/${id}/cancel`, { note }),
  process: (id: string) => api.post(`/refunds/${id}/process`, {}),
};

export const refundPolicyService = {
  list: (module?: string) =>
    api.get("/refund-policies", { params: module ? { module } : {} }),
  get: (id: string) => api.get(`/refund-policies/${id}`),
  create: (data: Record<string, unknown>) => api.post("/refund-policies", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/refund-policies/${id}`, data),
  remove: (id: string) => api.delete(`/refund-policies/${id}`),
};

export const supportService = {
  create: (data: unknown) => api.post("/support", data),
  list: () => api.get("/support"),
  addMessage: (id: string, text: string) =>
    api.post(`/support/${id}/message`, { text }),
  resolve: (id: string) => api.post(`/support/${id}/resolve`, {}),
};

export const analyticsService = {
  dashboard: (params: Record<string, string> = {}) =>
    api.get("/analytics/dashboard", { params }),
  system: () => api.get("/analytics/system"),
  overview: (range: "daily" | "weekly" | "monthly" | "yearly" = "daily") =>
    api.get("/analytics/overview", { params: { range } }),
  recentBookings: (limit = 10) =>
    api.get("/analytics/recent-bookings", { params: { limit } }),
  auditLogs: (params: Record<string, string> = {}) =>
    api.get("/analytics/audit-logs", { params }),
};

export const searchService = {
  global: (q: string, perType = 5, signal?: AbortSignal) =>
    api.get("/search", { params: { q, perType }, signal }),
};

export const verificationService = {
  pending: () => api.get("/verify/pending"),
  schedule: (id: string, date: string) =>
    api.post(`/verify/${id}/schedule`, { date }),
  updateStatus: (id: string, data: unknown) =>
    api.post(`/verify/${id}/status`, data),
};

export const userService = {
  list: (params: Record<string, string> = {}) => api.get("/users", { params }),
  createAccount: (data: unknown) => api.post("/users/create-account", data),
  assignableAshrams: (search?: string) =>
    api.get("/users/assignable-ashrams", {
      params: search ? { search } : undefined,
    }),
  updateAccount: (id: string, data: unknown) => api.patch(`/users/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/users/${id}/status`, { status }),
  suspend: (id: string, data: unknown) =>
    api.patch(`/users/${id}/suspend`, data),
  reactivate: (id: string) => api.patch(`/users/${id}/reactivate`, {}),
  changeRole: (
    id: string,
    data: { role: string; aadhaarCardUrl?: string; panCardUrl?: string },
  ) => api.patch(`/users/${id}/role`, data),
  updatePermissions: (id: string, permissions: string[]) =>
    api.patch(`/users/${id}/permissions`, { permissions }),
  resetPassword: (id: string, password?: string) =>
    api.post(`/users/${id}/reset-password`, { password }),
  softDelete: (id: string) => api.delete(`/users/${id}/soft-delete`),
  bulkSoftDelete: (ids: string[]) =>
    api.delete("/users/bulk/soft-delete", { data: { ids } }),
  permanentDelete: (id: string, data: unknown) =>
    api.delete(`/users/${id}/permanent-delete`, { data }),
  restore: (id: string) => api.patch(`/users/${id}/restore`, {}),
  listStaff: () => api.get("/users/staff"),
  createStaff: (data: unknown) => api.post("/users/staff", data),
  removeStaff: (id: string) => api.delete(`/users/staff/${id}`),
};

export const housekeepingService = {
  board: (ashramId?: string) =>
    api.get("/housekeeping", { params: ashramId ? { ashramId } : {} }),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/housekeeping/${id}`, { status, notes }),
};

const UPLOAD_IMAGE_LIMIT_BYTES = 10 * 1024 * 1024;
const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

export const uploadService = {
  file: async (file: File, folder = "uploads"): Promise<string> => {
    const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    const isImage = file.type.startsWith("image/");
    const limit = isImage ? UPLOAD_IMAGE_LIMIT_BYTES : UPLOAD_MAX_BYTES;
    if (file.size > limit)
      throw new Error(
        `That ${isImage ? "image" : "file"} is ${megabytes(file.size)}. The limit is ${megabytes(limit)}.`,
      );

    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    try {
      const res = await api.post("/uploads", form);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Upload failed");
      }
      return res.data.data.url as string;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 413 || (!status && err?.message === "Network Error"))
        throw new Error(
          `Upload rejected — the file may be too large for the server to accept (${megabytes(file.size)}). ` +
            "If it is well under the limit, check your connection and try again.",
        );
      throw err;
    }
  },
};

export const offerService = {
  validatePromo: (data: {
    promoCode: string;
    bookingAmount?: number;
    ashramId?: string;
  }) => api.post("/offers/validate-promo", data),
  getPublicOffers: (params: Record<string, string> = {}) =>
    api.get("/offers/public/all", { params }),
  getById: (id: string) => api.get(`/offers/public/${id}`),

  mine: () => api.get("/offers/my-offers"),
  manageById: (id: string) => api.get(`/offers/manage/${id}`),
  create: (data: unknown) => api.post("/offers", data),
  update: (id: string, data: unknown) => api.put(`/offers/${id}`, data),
  setStatus: (id: string, status: string) =>
    api.patch(`/offers/${id}/status`, { status }),
  duplicate: (id: string) => api.post(`/offers/${id}/duplicate`, {}),
  remove: (id: string) => api.delete(`/offers/${id}`),
};

export const platformSettingsService = {
  getSettings: () => api.get("/platform-settings"),
  updateSettings: (data: unknown) => api.put("/platform-settings", data),
};

export { serviceEcosystemService } from "./service.service";
export { marketplaceService } from "./marketplace.service";
export { enterpriseNotificationService } from "./enterpriseNotification.service";
export { approvalService } from "./approval.service";
export { leadCollectionService } from "./leadCollection.service";
