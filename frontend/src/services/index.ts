import api from "../lib/api";

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authService = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: unknown) => api.post("/auth/register", data),
  // Email OTP challenge for new-account verification.
  verifyRegistrationOtp: (otpToken: string, otp: string) =>
    api.post("/auth/register/verify-otp", { otpToken, otp }),
  verifyLoginOtp: (otpToken: string, otp: string) =>
    api.post("/auth/login/verify-otp", { otpToken, otp }),
  resendOtp: (otpToken: string) => api.post("/auth/resend-otp", { otpToken }),
  // Legacy passwordless phone-OTP login, still used by the "Login with OTP" tab.
  sendOtp: (phone: string) => api.post("/auth/otp/send", { phone }),
  verifyOtp: (phone: string, otp: string) =>
    api.post("/auth/otp/verify", { phone, otp }),
  // Google Sign-In. `credential` is the ID token from Google Identity Services.
  google: (credential: string) => api.post("/auth/google", { credential }),
  googleVerifyOtp: (googleToken: string, otp: string) =>
    api.post("/auth/google/verify-otp", { googleToken, otp }),
  googleResendOtp: (googleToken: string) =>
    api.post("/auth/google/resend-otp", { googleToken }),
  googleComplete: (googleToken: string, name: string, phone: string) =>
    api.post("/auth/google/complete", { googleToken, name, phone }),
  // Password reset by emailed link.
  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),
  verifyResetToken: (token: string) => api.get(`/auth/reset-password/${token}`),
  resetPassword: (token: string, newPassword: string) =>
    api.post("/auth/reset-password", { token, newPassword }),
  me: () => api.get("/auth/me"),
  /** Update the signed-in user's own name / phone. */
  updateMe: (data: { name?: string; phone?: string }) =>
    api.put("/auth/me", data),
};

// ── Ashrams ──────────────────────────────────────────────────────────────────
export const ashramService = {
  search: (params: Record<string, string> = {}) =>
    api.get("/ashrams", { params }),
  getById: (id: string) => api.get(`/ashrams/${id}`),
  getManagedById: (id: string) => api.get(`/ashrams/manage/${id}`),
  myListings: () => api.get("/ashrams/my-listings/all"),
  create: (data: unknown) => api.post("/ashrams", data),
  update: (id: string, data: unknown) => api.put(`/ashrams/${id}`, data),
  uploadDocuments: (id: string, data: unknown) =>
    api.post(`/ashrams/${id}/documents`, data),
  /** Destinations that hold at least one live ashram, with counts. */
  destinations: () => api.get("/ashrams/destinations"),
  /** The ashrams in one destination, slimmed for a picker. */
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

// ── Rooms ────────────────────────────────────────────────────────────────────
export const roomService = {
  create: (data: unknown) => api.post("/rooms", data),
  update: (id: string, data: unknown) => api.put(`/rooms/${id}`, data),
  setAvailability: (id: string, data: unknown) =>
    api.post(`/rooms/${id}/availability`, data),
  calendar: (id: string, startDate: string, endDate: string) =>
    api.get(`/rooms/${id}/calendar`, { params: { startDate, endDate } }),
  /** Public availability for the detail page: price + free count per night. */
  availabilityCalendar: (id: string, startDate: string, endDate: string) =>
    api.get(`/rooms/${id}/availability-calendar`, {
      params: { startDate, endDate },
    }),
};

// ── Bookings ─────────────────────────────────────────────────────────────────
export const bookingService = {
  /**
   * Price a booking without creating it — the authoritative total.
   *
   * Returns the same figures `create` and the payment order use, so what a
   * guest is shown is what the gateway charges. Toasts are suppressed because
   * this fires as the form is edited, and an incomplete selection is not an
   * error worth interrupting anyone over.
   */
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

// ── Reviews ──────────────────────────────────────────────────────────────────
export const reviewService = {
  /**
   * `bookingId` is optional: quoting a completed stay ties the review to it,
   * omitting it posts a visitor review. Either way the server decides the
   * verified-stay badge from the caller's own booking history.
   */
  create: (data: {
    ashramId: string;
    rating: { overall: number } & Record<string, number>;
    comment: string;
    bookingId?: string;
  }) => api.post("/reviews", data),
  forAshram: (ashramId: string) => api.get(`/reviews/ashram/${ashramId}`),
  recent: () => api.get("/reviews/recent"),
  /** Whether the signed-in caller may review this ashram. */
  eligibility: (ashramId: string) =>
    api.get(`/reviews/eligibility/${ashramId}`),
  remove: (id: string) => api.delete(`/reviews/${id}`),
};

// ── Refunds ──────────────────────────────────────────────────────────────────
/**
 * Refund management.
 *
 * The server decides what each caller may see and do — a pilgrim, an ashram
 * owner and a finance admin all hit these same URLs and get different estates
 * back — so nothing here filters by role. The `status`/`module` filters are the
 * only ones the list endpoint understands; anything finer is refined on the
 * client over the loaded page.
 */
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
  /** Releases money. Finance and platform roles only, enforced server-side. */
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

// ── Support ──────────────────────────────────────────────────────────────────
export const supportService = {
  create: (data: unknown) => api.post("/support", data),
  list: () => api.get("/support"),
  addMessage: (id: string, text: string) =>
    api.post(`/support/${id}/message`, { text }),
  resolve: (id: string) => api.post(`/support/${id}/resolve`, {}),
};

// ── Analytics / Verification / Users ─────────────────────────────────────────
export const analyticsService = {
  dashboard: (params: Record<string, string> = {}) =>
    api.get("/analytics/dashboard", { params }),
  system: () => api.get("/analytics/system"),
  /** Time series, channel split, status breakdown and top ashrams in one call. */
  overview: (range: "daily" | "weekly" | "monthly" | "yearly" = "daily") =>
    api.get("/analytics/overview", { params: { range } }),
  /**
   * Latest bookings across the caller's jurisdiction. Distinct from
   * `bookingService.history`, which is the signed-in pilgrim's own stays only
   * and answers 403 for an admin.
   */
  recentBookings: (limit = 10) =>
    api.get("/analytics/recent-bookings", { params: { limit } }),
  auditLogs: (params: Record<string, string> = {}) =>
    api.get("/analytics/audit-logs", { params }),
};

/**
 * Cross-domain lookup behind the admin console's global search bar. What comes
 * back is scoped server-side to what the caller may see, so an owner and a
 * district officer hit the same URL and get different estates.
 */
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
  updateStatus: (id: string, status: string) =>
    api.patch(`/users/${id}/status`, { status }),
  suspend: (id: string, data: unknown) =>
    api.patch(`/users/${id}/suspend`, data),
  reactivate: (id: string) => api.patch(`/users/${id}/reactivate`, {}),
  changeRole: (id: string, role: string) =>
    api.patch(`/users/${id}/role`, { role }),
  updatePermissions: (id: string, permissions: string[]) =>
    api.patch(`/users/${id}/permissions`, { permissions }),
  resetPassword: (id: string, password?: string) =>
    api.post(`/users/${id}/reset-password`, { password }),
  softDelete: (id: string) => api.delete(`/users/${id}/soft-delete`),
  permanentDelete: (id: string, data: unknown) =>
    api.delete(`/users/${id}/permanent-delete`, { data }),
  restore: (id: string) => api.patch(`/users/${id}/restore`, {}),
  // Staff management (owners)
  listStaff: () => api.get("/users/staff"),
  createStaff: (data: unknown) => api.post("/users/staff", data),
  removeStaff: (id: string) => api.delete(`/users/staff/${id}`),
};

// ── Housekeeping ─────────────────────────────────────────────────────────────
export const housekeepingService = {
  board: (ashramId?: string) =>
    api.get("/housekeeping", { params: ashramId ? { ashramId } : {} }),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/housekeeping/${id}`, { status, notes }),
};

// ── Uploads (Cloudinary) ─────────────────────────────────────────────────────
export const uploadService = {
  // Uploads a single File and resolves to the secure Cloudinary URL.
  file: async (file: File, folder = "uploads"): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    // Let axios set the multipart Content-Type with the correct boundary.
    const res = await api.post("/uploads", form);
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Upload failed");
    }
    return res.data.data.url as string;
  },
};

// ── Offers ──────────────────────────────────────────────────────────────────
export const offerService = {
  validatePromo: (data: {
    promoCode: string;
    bookingAmount?: number;
    ashramId?: string;
  }) => api.post("/offers/validate-promo", data),
  getPublicOffers: () => api.get("/offers/public/all"),
  getById: (id: string) => api.get(`/offers/public/${id}`),

  // ── Administration ──
  // `mine` is scoped server-side: a Super Admin sees every offer, an owner or
  // offer manager only the ones their ashrams are in scope for.
  mine: () => api.get("/offers/my-offers"),
  /** Full record for the console. Does not count as a public view. */
  manageById: (id: string) => api.get(`/offers/manage/${id}`),
  create: (data: unknown) => api.post("/offers", data),
  update: (id: string, data: unknown) => api.put(`/offers/${id}`, data),
  /** Partial write, so flipping a status never resends the whole offer. */
  setStatus: (id: string, status: string) =>
    api.patch(`/offers/${id}/status`, { status }),
  duplicate: (id: string) => api.post(`/offers/${id}/duplicate`, {}),
  remove: (id: string) => api.delete(`/offers/${id}`),
};

// ── Platform Settings ────────────────────────────────────────────────────────
export const platformSettingsService = {
  getSettings: () => api.get("/platform-settings"),
  updateSettings: (data: unknown) => api.put("/platform-settings", data),
};

export { serviceEcosystemService } from "./service.service";
export { marketplaceService } from "./marketplace.service";
export { enterpriseNotificationService } from "./enterpriseNotification.service";
export { approvalService } from "./approval.service";
export { leadCollectionService } from "./leadCollection.service";
