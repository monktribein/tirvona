import api from "../../../lib/api";

/** Drops empty values so the API sees only the filters actually chosen. */
const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

const quiet = { skipToast: true } as const;

/** Public pages: search, departure pages, links and payment links. */
export const yatraPublic = {
  config: () => api.get("/v1/yatra/config", quiet),
  search: (params: Record<string, unknown>) => api.get("/v1/yatra/search", { params: clean(params) }),
  filters: () => api.get("/v1/yatra/filters"),
  departure: (code: string) => api.get(`/v1/yatra/departures/${code}`),
  seats: (code: string) => api.get(`/v1/yatra/departures/${code}/seats`),
  link: (code: string) => api.get(`/v1/yatra/links/${code}`, quiet),
  paymentLink: (token: string) => api.get(`/v1/yatra/payment-links/${encodeURIComponent(token)}`, quiet),
};

export interface RazorpayProof {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature?: string;
}

/** The signed-in pilgrim. */
export const yatraCustomer = {
  rating: (bookingId: string) => api.get(`/v1/yatra/bookings/${bookingId}/rating`, quiet),
  requestCharter: (body: Record<string, unknown>) => api.post("/v1/yatra/charter-requests", body),
  charterRequests: () => api.get("/v1/yatra/charter-requests"),
  cancelCharter: (id: string) => api.post(`/v1/yatra/charter-requests/${id}/cancel`),
  tracking: (bookingId: string) => api.get(`/v1/yatra/bookings/${bookingId}/tracking`, quiet),
  rate: (bookingId: string, body: { stars: number; comment?: string; tags?: string[] }) => api.post(`/v1/yatra/bookings/${bookingId}/rating`, body),
  createBooking: (body: Record<string, unknown>) => api.post("/v1/yatra/bookings", body),
  bookings: (params: Record<string, unknown> = {}) => api.get("/v1/yatra/bookings", { params: clean(params) }),
  booking: (id: string) => api.get(`/v1/yatra/bookings/${id}`),
  paymentOrder: (id: string) => api.post(`/v1/yatra/bookings/${id}/payment-order`, {}, quiet),
  confirmPayment: (id: string, proof: RazorpayProof) => api.post(`/v1/yatra/bookings/${id}/confirm-payment`, proof, quiet),
  release: (id: string) => api.post(`/v1/yatra/bookings/${id}/release`),
  ticket: (id: string) => api.get(`/v1/yatra/bookings/${id}/ticket`),
  refundPreview: (id: string) => api.get(`/v1/yatra/bookings/${id}/refund-preview`),
  requestCancellation: (id: string, reason: string) => api.post(`/v1/yatra/bookings/${id}/cancel-request`, { reason }),
  linkOrder: (token: string) => api.post(`/v1/yatra/payment-links/${encodeURIComponent(token)}/order`, {}, quiet),
  linkConfirm: (token: string, proof: RazorpayProof) => api.post(`/v1/yatra/payment-links/${encodeURIComponent(token)}/confirm`, proof, quiet),
  journeys: () => api.get("/v1/yatra/journeys"),
  journey: (id: string) => api.get(`/v1/yatra/journeys/${id}`),
  linkable: (id: string) => api.get(`/v1/yatra/journeys/${id}/linkable`),
  addLink: (id: string, module: string, refId: string) => api.post(`/v1/yatra/journeys/${id}/links`, { module, refId }),
  removeLink: (id: string, linkId: string) => api.delete(`/v1/yatra/journeys/${id}/links/${linkId}`),
  createRequest: (journeyId: string, body: Record<string, unknown>) => api.post(`/v1/yatra/journeys/${journeyId}/requests`, body),
  cancelRequest: (id: string, reason: string) => api.post(`/v1/yatra/requests/${id}/cancel`, { reason }),
  requestOrder: (id: string) => api.post(`/v1/yatra/requests/${id}/payment-order`, {}, quiet),
  requestConfirm: (id: string, proof: RazorpayProof) => api.post(`/v1/yatra/requests/${id}/confirm-payment`, proof, quiet),
  foodSuppliers: () => api.get("/v1/yatra/suppliers/food"),
  pujaProviders: (city?: string) => api.get("/v1/yatra/suppliers/puja", { params: clean({ city }) }),
};

/** Restaurants and pandits answering Yatra add-on requests. */
export const yatraSupplier = {
  requests: (status?: string) => api.get("/v1/yatra/supplier/requests", { params: clean({ status }), skipToast: true }),
  respond: (id: string, body: Record<string, unknown>) => api.post(`/v1/yatra/supplier/requests/${id}/respond`, body),
  fulfil: (id: string) => api.post(`/v1/yatra/supplier/requests/${id}/fulfil`),
};

const op = (path: string) => `/v1/yatra/operator${path}`;

/** The partner console. Every call is scoped to the caller's own partner by the API. */
export const yatraOperator = {
  me: () => api.get(op("/me")),
  register: (body: Record<string, unknown>) => api.post(op("/register"), body),
  updateProfile: (body: Record<string, unknown>) => api.patch(op("/profile"), body),
  setPayout: (body: Record<string, unknown>) => api.put(op("/payout"), body),
  submit: () => api.post(op("/submit"), { acceptTerms: true }),
  staff: () => api.get(op("/staff")),
  addStaff: (body: Record<string, unknown>) => api.post(op("/staff"), body),
  updateStaff: (id: string, role: string) => api.patch(op(`/staff/${id}`), { role }),
  removeStaff: (id: string) => api.delete(op(`/staff/${id}`)),
  documents: () => api.get(op("/documents")),
  uploadDocument: (form: FormData) => api.post(op("/documents"), form, { headers: { "Content-Type": "multipart/form-data" } }),
  documentLink: (id: string) => api.get(op(`/documents/${id}/link`)),
  deleteDocument: (id: string) => api.delete(op(`/documents/${id}`)),
  vehicles: () => api.get(op("/vehicles")),
  createVehicle: (body: Record<string, unknown>) => api.post(op("/vehicles"), body),
  updateVehicle: (id: string, body: Record<string, unknown>) => api.patch(op(`/vehicles/${id}`), body),
  submitVehicle: (id: string) => api.post(op(`/vehicles/${id}/submit`)),
  circuitTemplates: (q?: string) => api.get(op("/circuit-templates"), { params: clean({ q }) }),
  circuitTemplate: (id: string) => api.get(op(`/circuit-templates/${id}`)),
  tours: (status?: string) => api.get(op("/tours"), { params: clean({ status }) }),
  tour: (id: string) => api.get(op(`/tours/${id}`)),
  createTour: (body: Record<string, unknown>) => api.post(op("/tours"), body),
  updateTour: (id: string, body: Record<string, unknown>) => api.patch(op(`/tours/${id}`), body),
  submitTour: (id: string) => api.post(op(`/tours/${id}/submit`)),
  departures: (params: Record<string, unknown> = {}) => api.get(op("/departures"), { params: clean(params) }),
  departure: (id: string) => api.get(op(`/departures/${id}`)),
  createDeparture: (body: Record<string, unknown>) => api.post(op("/departures"), body),
  updateDeparture: (id: string, body: Record<string, unknown>) => api.patch(op(`/departures/${id}`), body),
  openDeparture: (id: string) => api.post(op(`/departures/${id}/open`)),
  closeSales: (id: string) => api.post(op(`/departures/${id}/close-sales`)),
  reopenSales: (id: string) => api.post(op(`/departures/${id}/reopen-sales`)),
  seats: (id: string) => api.get(op(`/departures/${id}/seats`)),
  manifest: (id: string) => api.get(op(`/departures/${id}/manifest`)),
  manifestCsv: (id: string) => api.get(op(`/departures/${id}/manifest.csv`), { responseType: "blob" }),
  checkIn: (id: string, body: Record<string, unknown>) => api.post(op(`/departures/${id}/check-in`), body),
  bookings: (params: Record<string, unknown> = {}) => api.get(op("/bookings"), { params: clean(params) }),
  booking: (id: string) => api.get(op(`/bookings/${id}`)),
  createBooking: (body: Record<string, unknown>) => api.post(op("/bookings"), body),
  reissueLink: (id: string) => api.post(op(`/bookings/${id}/payment-link`)),
  releaseBooking: (id: string) => api.post(op(`/bookings/${id}/release`)),
  requestCancellation: (id: string, reason: string) => api.post(op(`/bookings/${id}/cancel-request`), { reason }),
  links: () => api.get(op("/links")),
  createLink: (body: Record<string, unknown>) => api.post(op("/links"), body),
  linkQr: (id: string) => api.get(op(`/links/${id}/qr`)),
  setLinkActive: (id: string, active: boolean) => api.patch(op(`/links/${id}`), { active }),
  earnings: (params: Record<string, unknown> = {}) => api.get(op("/earnings"), { params: clean(params) }),
  payouts: () => api.get(op("/payouts")),
  reports: () => api.get(op("/reports")),
};

const ad = (path: string) => `/v1/yatra/admin${path}`;

/** Super Admin console. */
export const yatraAdmin = {
  overview: () => api.get(ad("/overview")),
  operators: (params: Record<string, unknown> = {}) => api.get(ad("/operators"), { params: clean(params) }),
  operator: (id: string) => api.get(ad(`/operators/${id}`)),
  createOrganiser: (body: Record<string, unknown>) => api.post(ad("/operators"), body),
  reviewOperator: (id: string, action: string, note?: string) => api.post(ad(`/operators/${id}/review`), { action, note }),
  documents: (params: Record<string, unknown> = {}) => api.get(ad("/documents"), { params: clean(params) }),
  documentLink: (id: string) => api.get(ad(`/documents/${id}/link`)),
  reviewDocument: (id: string, decision: string, note?: string) => api.post(ad(`/documents/${id}/review`), { decision, note }),
  vehicles: (params: Record<string, unknown> = {}) => api.get(ad("/vehicles"), { params: clean(params) }),
  reviewVehicle: (id: string, action: string, note?: string) => api.post(ad(`/vehicles/${id}/review`), { action, note }),
  tours: (params: Record<string, unknown> = {}) => api.get(ad("/tours"), { params: clean(params) }),
  tour: (id: string) => api.get(ad(`/tours/${id}`)),
  reviewTour: (id: string, action: string, note?: string) => api.post(ad(`/tours/${id}/review`), { action, note }),
  departures: (params: Record<string, unknown> = {}) => api.get(ad("/departures"), { params: clean(params) }),
  departure: (id: string) => api.get(ad(`/departures/${id}`)),
  closeSales: (id: string) => api.post(ad(`/departures/${id}/close-sales`)),
  reopenSales: (id: string) => api.post(ad(`/departures/${id}/reopen-sales`)),
  cancelDeparture: (id: string, reason: string) => api.post(ad(`/departures/${id}/cancel`), { reason }),
  blockSeats: (id: string, seatNos: string[], blocked: boolean) => api.post(ad(`/departures/${id}/seats`), { seatNos, blocked }),
  bookings: (params: Record<string, unknown> = {}) => api.get(ad("/bookings"), { params: clean(params) }),
  booking: (id: string) => api.get(ad(`/bookings/${id}`)),
  decideCancellation: (id: string, body: Record<string, unknown>) => api.post(ad(`/bookings/${id}/cancellation`), body),
  cancelBooking: (id: string, body: Record<string, unknown>) => api.post(ad(`/bookings/${id}/cancel`), body),
  serviceRequests: (params: Record<string, unknown> = {}) => api.get(ad("/service-requests"), { params: clean(params) }),
  assignSupplier: (id: string, body: Record<string, unknown>) => api.post(ad(`/service-requests/${id}/assign`), body),
  respondRequest: (id: string, body: Record<string, unknown>) => api.post(ad(`/service-requests/${id}/respond`), body),
  fulfilRequest: (id: string) => api.post(ad(`/service-requests/${id}/fulfil`)),
  cancelRequest: (id: string, reason: string) => api.post(ad(`/service-requests/${id}/cancel`), { reason }),
  finance: (params: Record<string, unknown> = {}) => api.get(ad("/finance"), { params: clean(params) }),
  ledger: (params: Record<string, unknown> = {}) => api.get(ad("/ledger"), { params: clean(params) }),
  audit: (params: Record<string, unknown> = {}) => api.get(ad("/audit"), { params: clean(params) }),
  settings: () => api.get(ad("/settings")),
  saveSettings: (body: Record<string, unknown>) => api.put(ad("/settings"), body),
};

// ============================================================================ P5
/** Pilgrim rides and issue reports in the Journey Hub. */
export const yatraRides = {
  partners: (city: string) => api.get("/v1/yatra/ride-partners", { params: { city } }),
  list: (journeyId: string) => api.get(`/v1/yatra/journeys/${journeyId}/rides`),
  request: (journeyId: string, body: Record<string, unknown>) => api.post(`/v1/yatra/journeys/${journeyId}/rides`, body),
  cancel: (rideId: string, reason: string) => api.post(`/v1/yatra/rides/${rideId}/cancel`, { reason }),
  order: (rideId: string) => api.post(`/v1/yatra/rides/${rideId}/payment-order`, {}, quiet),
  confirm: (rideId: string, proof: RazorpayProof) => api.post(`/v1/yatra/rides/${rideId}/confirm-payment`, proof, quiet),
  reportRideIssue: (rideId: string, body: Record<string, unknown>) => api.post(`/v1/yatra/rides/${rideId}/issues`, body),
  reportJourneyIssue: (journeyId: string, body: Record<string, unknown>) => api.post(`/v1/yatra/journeys/${journeyId}/issues`, body),
};

const rp = (path: string) => `/v1/yatra/ride-partner${path}`;
/** Ride partner console. Every call is scoped to the caller's own partner account. */
export const yatraRidePartner = {
  me: () => api.get(rp("/me")),
  register: (body: Record<string, unknown>) => api.post(rp("/register"), body),
  updateProfile: (body: Record<string, unknown>) => api.patch(rp("/profile"), body),
  setVehicles: (vehicles: unknown[]) => api.put(rp("/vehicles"), { vehicles }),
  setPayout: (body: Record<string, unknown>) => api.put(rp("/payout"), body),
  submit: () => api.post(rp("/submit"), { acceptTerms: true }),
  documents: () => api.get(rp("/documents")),
  uploadDocument: (form: FormData) => api.post(rp("/documents"), form, { headers: { "Content-Type": "multipart/form-data" } }),
  documentLink: (id: string) => api.get(rp(`/documents/${id}/link`)),
  deleteDocument: (id: string) => api.delete(rp(`/documents/${id}`)),
  requests: (tab?: string) => api.get(rp("/requests"), { params: clean({ tab }) }),
  accept: (id: string, body: Record<string, unknown>) => api.post(rp(`/requests/${id}/accept`), body),
  reject: (id: string, reason: string) => api.post(rp(`/requests/${id}/reject`), { reason }),
  start: (id: string) => api.post(rp(`/requests/${id}/start`)),
  complete: (id: string) => api.post(rp(`/requests/${id}/complete`)),
  cancel: (id: string, reason: string) => api.post(rp(`/requests/${id}/cancel`), { reason }),
  reportIssue: (id: string, body: Record<string, unknown>) => api.post(rp(`/requests/${id}/issues`), body),
  earnings: (params: Record<string, unknown> = {}) => api.get(rp("/earnings"), { params: clean(params) }),
  payouts: () => api.get(rp("/payouts")),
  requestPayout: (amount: number, note?: string) => api.post(rp("/payouts"), { amount, note }),
  cancelPayout: (id: string) => api.post(rp(`/payouts/${id}/cancel`)),
  payoutProof: (id: string) => api.get(rp(`/payouts/${id}/proof`)),
};

/** Partner payout requests. */
export const yatraOperatorPayouts = {
  request: (amount: number, note?: string) => api.post("/v1/yatra/operator/payouts", { amount, note }),
  cancel: (id: string) => api.post(`/v1/yatra/operator/payouts/${id}/cancel`),
  proof: (id: string) => api.get(`/v1/yatra/operator/payouts/${id}/proof`),
};

const fin = (path: string) => `/v1/yatra/finance${path}`;
/** Finance (Super Admin and Finance Manager). Nothing here moves money. */
export const yatraFinance = {
  dashboard: (params: Record<string, unknown> = {}) => api.get(fin("/dashboard"), { params: clean(params) }),
  report: (from: string, to: string) => api.get(fin("/report"), { params: { from, to } }),
  reportCsv: (from: string, to: string) => api.get(fin("/report.csv"), { params: { from, to }, responseType: "blob" }),
  rules: (params: Record<string, unknown> = {}) => api.get(fin("/rules"), { params: clean(params) }),
  createRule: (body: Record<string, unknown>) => api.post(fin("/rules"), body),
  retireRule: (id: string) => api.post(fin(`/rules/${id}/retire`)),
  awaitingRule: () => api.get(fin("/awaiting-rule")),
  applyRule: (bookingId: string) => api.post(fin(`/bookings/${bookingId}/apply-rule`)),
  payees: (payeeType?: string) => api.get(fin("/payees"), { params: clean({ payeeType }) }),
  payee: (type: string, id: string, params: Record<string, unknown> = {}) => api.get(fin(`/payees/${type}/${id}`), { params: clean(params) }),
  adjust: (body: Record<string, unknown>) => api.post(fin("/adjustments"), body),
  payouts: (params: Record<string, unknown> = {}) => api.get(fin("/payouts"), { params: clean(params) }),
  createPayout: (body: Record<string, unknown>) => api.post(fin("/payouts"), body),
  reviewPayout: (id: string, action: string, note?: string) => api.post(fin(`/payouts/${id}/review`), { action, note }),
  recordTransfer: (id: string, form: FormData) => api.post(fin(`/payouts/${id}/transfer`), form, { headers: { "Content-Type": "multipart/form-data" } }),
  reconcilePayout: (id: string, body: Record<string, unknown>) => api.post(fin(`/payouts/${id}/reconcile`), body),
  cancelPayout: (id: string) => api.post(fin(`/payouts/${id}/cancel`)),
  payoutProof: (id: string) => api.get(fin(`/payouts/${id}/proof`)),
  reconciliationRuns: () => api.get(fin("/reconciliation")),
  runReconciliation: (date: string) => api.post(fin("/reconciliation"), { date }),
};

/** Super Admin ride oversight. */
export const yatraRideAdmin = {
  partners: (params: Record<string, unknown> = {}) => api.get("/v1/yatra/admin/ride-partners", { params: clean(params) }),
  partner: (id: string) => api.get(`/v1/yatra/admin/ride-partners/${id}`),
  reviewPartner: (id: string, action: string, note?: string) => api.post(`/v1/yatra/admin/ride-partners/${id}/review`, { action, note }),
  documentLink: (id: string) => api.get(`/v1/yatra/admin/ride-partner-documents/${id}/link`),
  rides: (params: Record<string, unknown> = {}) => api.get("/v1/yatra/admin/rides", { params: clean(params) }),
  assign: (id: string, partnerId: string) => api.post(`/v1/yatra/admin/rides/${id}/assign`, { partnerId }),
  cancel: (id: string, reason: string, refundPercent = 100) => api.post(`/v1/yatra/admin/rides/${id}/cancel`, { reason, refundPercent }),
};

const ops = (path: string) => `/v1/yatra/ops${path}`;
/** Destination Ops (Super Admin, HR, Executive — scoped to the office city on the server). */
export const yatraOps = {
  dashboard: (params: Record<string, unknown> = {}) => api.get(ops("/dashboard"), { params: clean(params) }),
  lookup: (reference: string, city?: string) => api.get(ops("/bookings/lookup"), { params: clean({ reference, city }) }),
  passengers: (departureId: string) => api.get(ops(`/departures/${departureId}/passengers`)),
  issues: (params: Record<string, unknown> = {}) => api.get(ops("/issues"), { params: clean(params) }),
  createIssue: (body: Record<string, unknown>) => api.post(ops("/issues"), body),
  updateIssue: (id: string, body: Record<string, unknown>) => api.patch(ops(`/issues/${id}`), body),
  report: (params: Record<string, unknown>) => api.get(ops("/report"), { params: clean(params) }),
  partners: (city: string) => api.get(ops("/ride-partners"), { params: { city } }),
  assignRide: (id: string, partnerId: string) => api.post(ops(`/rides/${id}/assign`), { partnerId }),
};
