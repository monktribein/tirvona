import api from '../../../lib/api';
import type { ParkingSearchFilters, ParkingVehicleTypeCode } from '../types/parking.types';

// Parking System — API client.
//
// Uses the app's existing axios instance, so the bearer token, base URL and 401
// handling behave exactly as they do everywhere else. No interceptor is added
// or changed here.

/** Drop empty values so the query string carries only real filters. */
const clean = (params: Record<string, unknown>) => {
  const out: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length) out[key] = value.join(',');
      return;
    }
    if (typeof value === 'boolean') {
      if (value) out[key] = 'true';
      return;
    }
    out[key] = String(value);
  });
  return out;
};

// ── Public discovery ────────────────────────────────────────────────────────

export const parkingDiscoveryService = {
  search: (filters: ParkingSearchFilters & { page?: number; limit?: number } = {}) =>
    api.get('/parking/locations', { params: clean(filters as Record<string, unknown>) }),

  getDetail: (
    idOrSlug: string,
    params: { entryAt?: string; exitAt?: string; vehicleType?: string; latitude?: number; longitude?: number } = {},
  ) => api.get(`/parking/locations/${idOrSlug}`, { params: clean(params) }),

  getAvailability: (locationId: string, params: { entryAt: string; exitAt: string; vehicleType?: string }) =>
    api.get(`/parking/locations/${locationId}/availability`, { params: clean(params) }),

  getReviews: (locationId: string, page = 1, limit = 10) =>
    api.get(`/parking/locations/${locationId}/reviews`, { params: { page, limit } }),

  getQuote: (payload: {
    locationId: string;
    slotTypeId: string;
    vehicleType: ParkingVehicleTypeCode;
    entryAt: string;
    exitAt: string;
  }) => api.post('/parking/quote', payload),

  getVehicleTypes: () => api.get('/parking/vehicle-types'),

  getFilterOptions: () => api.get('/parking/filters'),
};

// ── Visitor bookings ────────────────────────────────────────────────────────

export const parkingBookingService = {
  create: (payload: {
    locationId: string;
    slotTypeId: string;
    vehicleType: ParkingVehicleTypeCode;
    vehicleNumber: string;
    entryAt: string;
    exitAt: string;
    vehicleModel?: string;
    driverName?: string;
    driverPhone?: string;
  }) => api.post('/parking/bookings', payload),

  list: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get('/parking/bookings', { params: clean(params) }),

  get: (id: string) => api.get(`/parking/bookings/${id}`),

  createPaymentOrder: (id: string) => api.post(`/parking/bookings/${id}/payment/order`, {}),

  confirmPayment: (
    id: string,
    payload: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      method?: string;
    },
  ) => api.post(`/parking/bookings/${id}/payment`, payload),

  getQr: (id: string, format: 'png' | 'svg' = 'png') => api.get(`/parking/bookings/${id}/qr`, { params: { format } }),

  previewRefund: (id: string) => api.get(`/parking/bookings/${id}/refund-preview`),

  cancel: (id: string, reason?: string) => api.post(`/parking/bookings/${id}/cancel`, { reason }),

  review: (
    id: string,
    payload: {
      rating: number;
      comment?: string;
      safety?: number;
      cleanliness?: number;
      staff?: number;
      valueForMoney?: number;
    },
  ) => api.post(`/parking/bookings/${id}/review`, payload),

  notifications: (params: { page?: number; limit?: number } = {}) =>
    api.get('/parking/bookings/notifications', { params: clean(params) }),

  markNotificationsRead: () => api.post('/parking/bookings/notifications/read-all', {}),
};

// ── Security guard panel ────────────────────────────────────────────────────

export const parkingScanService = {
  myLocations: () => api.get('/parking/scan/my-locations'),

  verify: (token: string, locationId: string) => api.post('/parking/scan/verify', { token, locationId }),

  checkIn: (token: string, locationId: string) => api.post('/parking/scan/check-in', { token, locationId }),

  checkOut: (token: string, locationId: string, overstayPaymentMethod = 'cash') =>
    api.post('/parking/scan/check-out', { token, locationId, overstayPaymentMethod }),

  lookupVehicle: (vehicleNumber: string, locationId: string) =>
    api.post('/parking/scan/lookup', { vehicleNumber, locationId }),

  logs: (
    params: { locationId?: string; result?: string; from?: string; to?: string; page?: number; limit?: number } = {},
  ) => api.get('/parking/scan/logs', { params: clean(params) }),
};

// ── Partner & manager ───────────────────────────────────────────────────────

export const parkingPartnerService = {
  dashboard: () => api.get('/parking/partner/dashboard'),
  reports: (params: { from?: string; to?: string } = {}) =>
    api.get('/parking/partner/reports', { params: clean(params) }),

  listLocations: () => api.get('/parking/partner/locations'),
  createLocation: (payload: unknown) => api.post('/parking/partner/locations', payload),
  updateLocation: (id: string, payload: unknown) => api.put(`/parking/partner/locations/${id}`, payload),

  listSlotTypes: (locationId: string) => api.get(`/parking/partner/locations/${locationId}/slot-types`),
  createSlotType: (locationId: string, payload: unknown) =>
    api.post(`/parking/partner/locations/${locationId}/slot-types`, payload),
  updateSlotType: (id: string, payload: unknown) => api.put(`/parking/partner/slot-types/${id}`, payload),

  listSlots: (locationId: string, params: { status?: string; slotTypeId?: string } = {}) =>
    api.get(`/parking/partner/locations/${locationId}/slots`, { params: clean(params) }),
  bulkCreateSlots: (locationId: string, payload: unknown) =>
    api.post(`/parking/partner/locations/${locationId}/slots/bulk`, payload),
  updateSlot: (id: string, payload: unknown) => api.patch(`/parking/partner/slots/${id}`, payload),

  listPricing: (locationId: string) => api.get(`/parking/partner/locations/${locationId}/pricing`),
  savePricing: (locationId: string, payload: unknown) =>
    api.post(`/parking/partner/locations/${locationId}/pricing`, payload),

  calendar: (locationId: string, params: { startDate?: string; endDate?: string } = {}) =>
    api.get(`/parking/partner/locations/${locationId}/calendar`, { params: clean(params) }),
  setAvailability: (locationId: string, payload: unknown) =>
    api.post(`/parking/partner/locations/${locationId}/availability`, payload),

  listBookings: (params: Record<string, unknown> = {}) =>
    api.get('/parking/partner/bookings', { params: clean(params) }),

  listStaff: (partnerId?: string) => api.get('/parking/partner/staff', { params: clean({ partnerId }) }),
  assignStaff: (payload: unknown) => api.post('/parking/partner/staff', payload),
  revokeStaff: (id: string) => api.delete(`/parking/partner/staff/${id}`),

  getSettings: (locationId: string) => api.get(`/parking/partner/locations/${locationId}/settings`),
  updateSettings: (locationId: string, payload: unknown) =>
    api.put(`/parking/partner/locations/${locationId}/settings`, payload),
};

// ── Super admin ─────────────────────────────────────────────────────────────

export const parkingAdminService = {
  listPartners: (params: Record<string, unknown> = {}) => api.get('/parking/admin/partners', { params: clean(params) }),
  createPartner: (payload: unknown) => api.post('/parking/admin/partners', payload),
  updatePartnerStatus: (id: string, payload: unknown) => api.patch(`/parking/admin/partners/${id}/status`, payload),

  listLocations: (params: Record<string, unknown> = {}) =>
    api.get('/parking/admin/locations', { params: clean(params) }),
  updateLocationStatus: (id: string, payload: unknown) => api.patch(`/parking/admin/locations/${id}/status`, payload),

  listBookings: (params: Record<string, unknown> = {}) => api.get('/parking/admin/bookings', { params: clean(params) }),
  refundBooking: (id: string, reason?: string) => api.post(`/parking/admin/bookings/${id}/refund`, { reason }),

  listCommissions: (params: Record<string, unknown> = {}) =>
    api.get('/parking/admin/commissions', { params: clean(params) }),
  settleCommissions: (partnerId: string, reference?: string) =>
    api.post('/parking/admin/commissions/settle', { partnerId, reference }),

  analytics: (params: { from?: string; to?: string } = {}) =>
    api.get('/parking/admin/analytics', { params: clean(params) }),
  transactions: (params: Record<string, unknown> = {}) =>
    api.get('/parking/admin/transactions', { params: clean(params) }),

  getSettings: () => api.get('/parking/admin/settings'),
  updateSettings: (payload: unknown) => api.put('/parking/admin/settings', payload),

  listHolidays: () => api.get('/parking/admin/holidays'),
  createHoliday: (payload: unknown) => api.post('/parking/admin/holidays', payload),
  deleteHoliday: (id: string) => api.delete(`/parking/admin/holidays/${id}`),

  seedVehicleTypes: () => api.post('/parking/admin/vehicle-types/seed', {}),
  runSweep: () => api.post('/parking/admin/maintenance/sweep', {}),
};

export default {
  parkingDiscoveryService,
  parkingBookingService,
  parkingScanService,
  parkingPartnerService,
  parkingAdminService,
};
