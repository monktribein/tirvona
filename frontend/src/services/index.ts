import api from '../lib/api';

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authService = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: unknown) => api.post('/auth/register', data),
  // OTP challenge (Guest Visitors). `otpToken` identifies the pending challenge.
  verifyRegistrationOtp: (otpToken: string, otp: string) =>
    api.post('/auth/register/verify-otp', { otpToken, otp }),
  verifyLoginOtp: (otpToken: string, otp: string) => api.post('/auth/login/verify-otp', { otpToken, otp }),
  resendOtp: (otpToken: string) => api.post('/auth/resend-otp', { otpToken }),
  // Legacy passwordless phone-OTP login, still used by the "Login with OTP" tab.
  sendOtp: (phone: string) => api.post('/auth/otp/send', { phone }),
  verifyOtp: (phone: string, otp: string) => api.post('/auth/otp/verify', { phone, otp }),
  // Google Sign-In. `credential` is the ID token from Google Identity Services.
  google: (credential: string) => api.post('/auth/google', { credential }),
  googleVerifyOtp: (googleToken: string, otp: string) => api.post('/auth/google/verify-otp', { googleToken, otp }),
  googleResendOtp: (googleToken: string) => api.post('/auth/google/resend-otp', { googleToken }),
  googleComplete: (googleToken: string, name: string, phone: string) =>
    api.post('/auth/google/complete', { googleToken, name, phone }),
  // Password reset by emailed link.
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  verifyResetToken: (token: string) => api.get(`/auth/reset-password/${token}`),
  resetPassword: (token: string, newPassword: string) => api.post('/auth/reset-password', { token, newPassword }),
  me: () => api.get('/auth/me'),
};

// ── Ashrams ──────────────────────────────────────────────────────────────────
export const ashramService = {
  search: (params: Record<string, string> = {}) =>
    api.get('/ashrams', { params }),
  getById: (id: string) => api.get(`/ashrams/${id}`),
  myListings: () => api.get('/ashrams/my-listings/all'),
  create: (data: unknown) => api.post('/ashrams', data),
  update: (id: string, data: unknown) => api.put(`/ashrams/${id}`, data),
  uploadDocuments: (id: string, data: unknown) => api.post(`/ashrams/${id}/documents`, data),
  getAddOns: (ashramId: string) => api.get(`/ashrams/${ashramId}/add-ons`),
  createAddOn: (ashramId: string, data: unknown) => api.post(`/ashrams/${ashramId}/add-ons`, data),
  updateAddOn: (ashramId: string, serviceId: string, data: unknown) => api.put(`/ashrams/${ashramId}/add-ons/${serviceId}`, data),
  deleteAddOn: (ashramId: string, serviceId: string) => api.delete(`/ashrams/${ashramId}/add-ons/${serviceId}`),
};

// ── Rooms ────────────────────────────────────────────────────────────────────
export const roomService = {
  create: (data: unknown) => api.post('/rooms', data),
  update: (id: string, data: unknown) => api.put(`/rooms/${id}`, data),
  setAvailability: (id: string, data: unknown) => api.post(`/rooms/${id}/availability`, data),
  calendar: (id: string, startDate: string, endDate: string) =>
    api.get(`/rooms/${id}/calendar`, { params: { startDate, endDate } }),
};

// ── Bookings ─────────────────────────────────────────────────────────────────
export const bookingService = {
  create: (data: unknown) => api.post('/bookings/create', data),
  createPaymentOrder: (id: string) => api.post(`/bookings/${id}/payment/order`, {}),
  pay: (id: string, data: unknown) => api.post(`/bookings/${id}/payment`, data),
  history: () => api.get('/bookings/history'),
  dashboard: (params: Record<string, string> = {}) => api.get('/bookings/dashboard', { params }),
  checkin: (id: string, checkInCode: string) => api.post(`/bookings/${id}/checkin`, { checkInCode }),
  checkout: (id: string) => api.post(`/bookings/${id}/checkout`, {}),
  cancel: (id: string, reason: string) => api.post(`/bookings/${id}/cancel`, { reason }),
};

// ── Reviews ──────────────────────────────────────────────────────────────────
export const reviewService = {
  create: (data: unknown) => api.post('/reviews', data),
  forAshram: (ashramId: string) => api.get(`/reviews/ashram/${ashramId}`),
  recent: () => api.get('/reviews/recent'),
};

// ── Support ──────────────────────────────────────────────────────────────────
export const supportService = {
  create: (data: unknown) => api.post('/support', data),
  list: () => api.get('/support'),
  addMessage: (id: string, text: string) => api.post(`/support/${id}/message`, { text }),
  resolve: (id: string) => api.post(`/support/${id}/resolve`, {}),
};

// ── Analytics / Verification / Users ─────────────────────────────────────────
export const analyticsService = {
  dashboard: (params: Record<string, string> = {}) => api.get('/analytics/dashboard', { params }),
  system: () => api.get('/analytics/system'),
  auditLogs: (params: Record<string, string> = {}) => api.get('/analytics/audit-logs', { params }),
};

export const verificationService = {
  pending: () => api.get('/verify/pending'),
  schedule: (id: string, date: string) => api.post(`/verify/${id}/schedule`, { date }),
  updateStatus: (id: string, data: unknown) => api.post(`/verify/${id}/status`, data),
};

export const userService = {
  list: (params: Record<string, string> = {}) => api.get('/users', { params }),
  createAccount: (data: unknown) => api.post('/users/create-account', data),
  updateStatus: (id: string, status: string) => api.patch(`/users/${id}/status`, { status }),
  suspend: (id: string, data: unknown) => api.patch(`/users/${id}/suspend`, data),
  reactivate: (id: string) => api.patch(`/users/${id}/reactivate`, {}),
  changeRole: (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
  updatePermissions: (id: string, permissions: string[]) => api.patch(`/users/${id}/permissions`, { permissions }),
  resetPassword: (id: string, password?: string) => api.post(`/users/${id}/reset-password`, { password }),
  softDelete: (id: string) => api.delete(`/users/${id}/soft-delete`),
  permanentDelete: (id: string, data: unknown) => api.delete(`/users/${id}/permanent-delete`, { data }),
  restore: (id: string) => api.patch(`/users/${id}/restore`, {}),
  // Staff management (owners)
  listStaff: () => api.get('/users/staff'),
  createStaff: (data: unknown) => api.post('/users/staff', data),
  removeStaff: (id: string) => api.delete(`/users/staff/${id}`),
};

// ── Housekeeping ─────────────────────────────────────────────────────────────
export const housekeepingService = {
  board: (ashramId?: string) => api.get('/housekeeping', { params: ashramId ? { ashramId } : {} }),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/housekeeping/${id}`, { status, notes }),
};

// ── Uploads (Cloudinary) ─────────────────────────────────────────────────────
export const uploadService = {
  // Uploads a single File and resolves to the secure Cloudinary URL.
  file: async (file: File, folder = 'uploads'): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    // Let axios set the multipart Content-Type with the correct boundary.
    const res = await api.post('/uploads', form);
    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Upload failed');
    }
    return res.data.data.url as string;
  },
};

// ── Offers ──────────────────────────────────────────────────────────────────
export const offerService = {
  validatePromo: (data: { promoCode: string; bookingAmount?: number; ashramId?: string }) =>
    api.post('/offers/validate-promo', data),
  getPublicOffers: () => api.get('/offers/public/all'),
  getById: (id: string) => api.get(`/offers/public/${id}`),
};

// ── Platform Settings ────────────────────────────────────────────────────────
export const platformSettingsService = {
  getSettings: () => api.get('/platform-settings'),
  updateSettings: (data: unknown) => api.put('/platform-settings', data),
};

export { serviceEcosystemService } from './service.service';
export { marketplaceService } from './marketplace.service';
export { enterpriseNotificationService } from './enterpriseNotification.service';



