/**
 * Provider / Pandit API service — calls the real backend v2 endpoints.
 *
 * Rules enforced here:
 * 1. Every function calls the real backend. There are NO localStorage fallbacks.
 * 2. Errors are re-thrown as-is so callers can distinguish 401, 403, 404,
 *    validation errors and network failures and present them correctly.
 * 3. All writes are idempotent-keyed at the controller layer (backend),
 *    so duplicate submissions are safe without client-side guards.
 *
 * API base: /api/v2/  (the backend mounts all v2 provider routes under
 *   GET/POST /api/v2/providers              — public directory
 *   GET/POST /api/v2/provider/profile       — self profile
 *   GET/POST /api/v2/provider/offerings     — self offerings
 *   GET/PUT  /api/v2/provider/availability-rules
 *   GET/POST /api/v2/provider/calendar-blocks
 *   GET/POST /api/v2/verification-cases
 *   GET/POST /api/v2/bookings               — puja bookings
 *   GET/POST /api/v2/rituals                — public ritual catalogue
 */

import api from "../../../lib/api";
import type {
  ProviderProfile,
  CreateProviderProfileInput,
  UpdateProviderProfileInput,
  Offering,
  CreateOfferingInput,
  UpdateOfferingInput,
  AvailabilityRules,
  CalendarBlock,
  CreateCalendarBlockInput,
  VerificationCase,
  OpenVerificationCaseInput,
  AddEvidenceInput,
  DecideVerificationInput,
  ProviderBooking,
  Ritual,
  ProviderSearchParams,
} from "../types/provider.types";

const V2 = "/v2";

// ── Public provider directory ─────────────────────────────────────────────────

export const providerPublicService = {
  /**
   * Search the public provider directory.
   * Backend: GET /api/v2/providers
   */
  search: (params: ProviderSearchParams = {}) =>
    api.get<any>(`${V2}/providers`, { params }),

  /**
   * Get a single provider's public profile by ID or slug.
   * Backend: GET /api/v2/providers/:providerId
   */
  getById: (providerId: string) =>
    api.get<any>(`${V2}/providers/${encodeURIComponent(providerId)}`),

  /**
   * List a provider's public offerings.
   * Backend: GET /api/v2/providers/:providerId/offerings
   */
  offeringsOf: (
    providerId: string,
    params: { fulfilmentType?: string; ritualVariantId?: string } = {},
  ) =>
    api.get<any>(`${V2}/providers/${encodeURIComponent(providerId)}/offerings`, { params }),

  /**
   * Get available time windows for a provider (authenticated).
   * Backend: GET /api/v2/providers/:providerId/availability
   */
  availabilityOf: (
    providerId: string,
    params: { from: string; to?: string; durationMinutes?: number },
  ) =>
    api.get<any>(
      `${V2}/providers/${encodeURIComponent(providerId)}/availability`,
      { params },
    ),

  /**
   * Get 30-day calendar availability for a provider (rolling 30 days, shifts, travel radius).
   * Backend: GET /api/v2/providers/:providerId/calendar-30-days
   */
  calendar30DaysOf: (
    providerId: string,
    params: { from?: string; to?: string; city?: string } = {},
  ) =>
    api.get<any>(
      `${V2}/providers/${encodeURIComponent(providerId)}/calendar-30-days`,
      { params },
    ),
};

// ── Provider self-management ──────────────────────────────────────────────────

export const providerSelfService = {
  // ── Profile ──────────────────────────────────────────────────────────────

  /**
   * Fetch own provider profile.
   * Backend: GET /api/v2/provider/profile
   * 404 = provider record not created yet (show onboarding).
   */
  getProfile: (options: { silent?: boolean } = {}) =>
    api.get<{ success: boolean; data: ProviderProfile }>(`${V2}/provider/profile`, { skipToast: options.silent }),

  /**
   * Create the provider profile (first-time onboarding).
   * Backend: POST /api/v2/provider/profile
   */
  createProfile: (data: CreateProviderProfileInput) =>
    api.post<{ success: boolean; data: ProviderProfile }>(`${V2}/provider/profile`, data),

  /**
   * Update own provider profile.
   * Backend: PATCH /api/v2/provider/profile
   */
  updateProfile: (data: UpdateProviderProfileInput) =>
    api.patch<{ success: boolean; data: ProviderProfile }>(`${V2}/provider/profile`, data),

  /**
   * Set own status (ACTIVE | INACTIVE). Verification required before ACTIVE.
   * Backend: PATCH /api/v2/provider/profile/status
   */
  setStatus: (status: "ACTIVE" | "INACTIVE") =>
    api.patch<any>(`${V2}/provider/profile/status`, { status }),

  /**
   * "Live online available" switch: devotees can book a live video katha / puja.
   * Backend: PATCH /api/v2/provider/profile/live
   */
  setLiveOnline: (enabled: boolean, youtubeUrl?: string) =>
    api.patch<any>(`${V2}/provider/profile/live`, youtubeUrl ? { enabled, youtubeUrl } : { enabled }),

  // ── Offerings ────────────────────────────────────────────────────────────

  /**
   * List own offerings, optionally filtered by status.
   * Backend: GET /api/v2/provider/offerings
   */
  listOfferings: (status?: string) =>
    api.get<{ success: boolean; data: Offering[] }>(`${V2}/provider/offerings`, {
      params: status ? { status } : undefined,
    }),

  /**
   * Get one own offering by ID.
   * Backend: GET /api/v2/provider/offerings/:offeringId
   */
  getOffering: (offeringId: string) =>
    api.get<{ success: boolean; data: Offering }>(`${V2}/provider/offerings/${offeringId}`),

  /**
   * Create a new offering.
   * Backend: POST /api/v2/provider/offerings
   */
  createOffering: (data: CreateOfferingInput) =>
    api.post<{ success: boolean; data: Offering }>(`${V2}/provider/offerings`, data),

  /**
   * Update an offering.
   * Backend: PATCH /api/v2/provider/offerings/:offeringId
   */
  updateOffering: (offeringId: string, data: UpdateOfferingInput) =>
    api.patch<{ success: boolean; data: Offering }>(
      `${V2}/provider/offerings/${offeringId}`,
      data,
    ),

  // ── Availability ──────────────────────────────────────────────────────────

  /**
   * Get own weekly availability rules.
   * Backend: GET /api/v2/provider/availability-rules
   */
  getAvailabilityRules: () =>
    api.get<{ success: boolean; data: AvailabilityRules }>(`${V2}/provider/availability-rules`),

  /**
   * Replace own weekly availability rules (full PUT).
   * Backend: PUT /api/v2/provider/availability-rules
   */
  putAvailabilityRules: (data: AvailabilityRules) =>
    api.put<{ success: boolean; data: AvailabilityRules }>(
      `${V2}/provider/availability-rules`,
      data,
    ),

  /**
   * List own calendar blocks.
   * Backend: GET /api/v2/provider/calendar-blocks
   */
  listCalendarBlocks: (params: { from?: string; to?: string; page?: number } = {}) =>
    api.get<{ success: boolean; data: CalendarBlock[] }>(
      `${V2}/provider/calendar-blocks`,
      { params },
    ),

  /**
   * Create a calendar block (blocked dates).
   * Backend: POST /api/v2/provider/calendar-blocks
   */
  createCalendarBlock: (data: CreateCalendarBlockInput) =>
    api.post<{ success: boolean; data: CalendarBlock }>(
      `${V2}/provider/calendar-blocks`,
      data,
    ),

  /**
   * Release (delete) a calendar block.
   * Backend: DELETE /api/v2/provider/calendar-blocks/:blockId
   */
  deleteCalendarBlock: (blockId: string) =>
    api.delete<any>(`${V2}/provider/calendar-blocks/${blockId}`),

  // ── Bookings summary ──────────────────────────────────────────────────────

  /**
   * Booking counters and the next booking.
   * Backend: GET /api/v2/provider/bookings/summary
   */
  bookingSummary: () =>
    api.get<any>(`${V2}/provider/bookings/summary`),

  // ── Consultations queue ───────────────────────────────────────────────────

  /**
   * List incoming consultation requests (provider view).
   * Backend: GET /api/v2/provider/consultations
   */
  listConsultations: (params: { status?: string; page?: number } = {}) =>
    api.get<any>(`${V2}/provider/consultations`, { params }),

  /**
   * Get own 30-day rolling calendar with shifts, holds, and bookings.
   * Backend: GET /api/v2/provider/calendar-30-days
   */
  getThirtyDayCalendar: (params: { from?: string; to?: string } = {}) =>
    api.get<any>(`${V2}/provider/calendar-30-days`, { params }),
};

// ── Puja bookings (/api/v2/bookings) ─────────────────────────────────────────

export const pujaBookingService = {
  /**
   * List bookings for the caller.
   * Pass role=provider to get the provider view.
   * Backend: GET /api/v2/bookings
   */
  list: (params: { role?: "provider" | "customer"; status?: string; page?: number } = {}) =>
    api.get<{ success: boolean; data: ProviderBooking[] }>(`${V2}/bookings`, { params }),

  /**
   * Convenience alias to list caller's own bookings as a customer/devotee.
   * Backend: GET /api/v2/bookings
   */
  listMine: (params: { status?: string; page?: number } = {}) =>
    api.get<{ success: boolean; data: ProviderBooking[] }>(`${V2}/bookings`, { params }),

  /**
   * Get one booking (as customer or provider, resolved on server).
   * Backend: GET /api/v2/bookings/:bookingId
   */
  getById: (bookingId: string) =>
    api.get<{ success: boolean; data: ProviderBooking }>(`${V2}/bookings/${bookingId}`),

  /**
   * Create a new puja booking.
   * Backend: POST /api/v2/bookings
   */
  create: (data: unknown) =>
    api.post<{ success: boolean; data: ProviderBooking }>(`${V2}/bookings`, data),

  /**
   * Submit a multi-pandit booking request (up to 5 candidate pandits).
   * Backend: POST /api/v2/bookings/multi-request
   */
  createMultiRequest: (data: unknown) =>
    api.post<any>(`${V2}/bookings/multi-request`, data),

  /**
   * Accept an incoming booking request (Pandit action).
   * Starts the 1-hour payment countdown.
   * Backend: POST /api/v2/bookings/:bookingId/accept-request
   */
  acceptRequest: (bookingId: string, data: { note?: string } = {}) =>
    api.post<any>(`${V2}/bookings/${bookingId}/accept-request`, data),

  /**
   * Decline an incoming booking request (Pandit action).
   * Backend: POST /api/v2/bookings/:bookingId/decline-request
   */
  declineRequest: (bookingId: string, data: { reasonCode?: string } = {}) =>
    api.post<any>(`${V2}/bookings/${bookingId}/decline-request`, data),

  /**
   * Create a payment order for a puja booking (wallet split or Razorpay order).
   * Backend: POST /api/v2/bookings/:bookingId/payment/order
   */
  createPaymentOrder: (bookingId: string, options: { useWallet?: boolean } = {}) =>
    api.post<any>(`${V2}/bookings/${bookingId}/payment/order`, options),

  /**
   * Confirm payment after Razorpay checkout signature verification.
   * Backend: POST /api/v2/bookings/:bookingId/payment
   */
  confirmPayment: (
    bookingId: string,
    data: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) =>
    api.post<any>(`${V2}/bookings/${bookingId}/payment`, data),

  transition: (
    bookingId: string,
    data: { command?: string; transition?: string; reasonCode?: string; note?: string },
  ) =>
    api.post<any>(`${V2}/bookings/${bookingId}/transitions`, {
      command: data.command || data.transition,
      reasonCode: data.reasonCode || data.note,
    }),

  /**
   * Cancel a booking with a reason code.
   * Backend: POST /api/v2/bookings/:bookingId:cancel
   */
  cancel: (bookingId: string, reasonCode: string) =>
    api.post<any>(`${V2}/bookings/${bookingId}:cancel`, { reasonCode }),

  /**
   * Create or start Zoom meeting session for an eligible booking.
   * Backend: POST /api/v2/bookings/:bookingId:zoom:create
   */
  createZoomMeeting: (bookingId: string) =>
    api.post<any>(`${V2}/bookings/${bookingId}:zoom:create`, {}),

  /**
   * Get authorized Zoom meeting session details.
   * Backend: GET /api/v2/bookings/:bookingId/zoom
   */
  /** Pandit sets the YouTube live link devotees watch. Backend: POST /api/v2/bookings/:id/live-stream */
  setLiveStream: (bookingId: string, youtubeUrl: string) =>
    api.post<any>(`${V2}/bookings/${bookingId}/live-stream`, { youtubeUrl }),

  getZoomMeeting: (bookingId: string) =>
    api.get<any>(`${V2}/bookings/${bookingId}/zoom`),
};

// ── Consultation Service ───────────────────────────────────────────────────────

export const consultationService = {
  /**
   * List customer's consultations or provider's consultations.
   * Backend: GET /api/v2/consultations
   */
  list: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get<any>(`${V2}/consultations`, { params }),

  /**
   * Caller's consultations as customer.
   * Backend: GET /api/v2/consultations
   */
  mine: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get<any>(`${V2}/consultations`, { params }),

  /**
   * Get single consultation details.
   * Backend: GET /api/v2/consultations/:id
   */
  getById: (consultationId: string) =>
    api.get<any>(`${V2}/consultations/${consultationId}`),

  /**
   * Request/create a consultation with a Pandit or Jyotishi.
   * Backend: POST /api/v2/consultations
   */
  create: (data: {
    consultationType: "PANDIT" | "JYOTISHI";
    expertProviderId: string;
    channel: "VIDEO" | "PHONE" | "CHAT" | "IN_PERSON";
    scheduledStartAt: string;
    durationMinutes?: number;
    questionSummary?: string;
    bookingId?: string;
  }) => api.post<any>(`${V2}/consultations`, data),

  /**
   * List persistent two-way chat messages for a consultation.
   * Backend: GET /api/v2/consultations/:id/messages
   */
  getMessages: (consultationId: string) =>
    api.get<{ success: boolean; data: any[] }>(`${V2}/consultations/${consultationId}/messages`),

  /**
   * Send a chat message in a consultation thread.
   * Backend: POST /api/v2/consultations/:id/messages
   */
  sendMessage: (
    consultationId: string,
    data: { content: string; attachments?: any[] },
  ) => api.post<any>(`${V2}/consultations/${consultationId}/messages`, data),

  /**
   * Expert confirms or reschedules requested consultation.
   * Backend: POST /api/v2/consultations/:id:schedule
   */
  schedule: (
    consultationId: string,
    data: { scheduledStartAt?: string; durationMinutes?: number } = {},
  ) => api.post<any>(`${V2}/consultations/${consultationId}:schedule`, data),

  /**
   * Expert starts a scheduled consultation.
   * Backend: POST /api/v2/consultations/:id:start
   */
  start: (consultationId: string) => api.post<any>(`${V2}/consultations/${consultationId}:start`, {}),

  /**
   * Expert marks consultation completed.
   * Backend: POST /api/v2/consultations/:id:complete
   */
  complete: (
    consultationId: string,
    data: { expertNotes?: string; noShow?: boolean } = {},
  ) => api.post<any>(`${V2}/consultations/${consultationId}:complete`, data),

  /**
   * Cancel consultation.
   * Backend: POST /api/v2/consultations/:id:cancel
   */
  cancel: (consultationId: string, reasonCode: string) =>
    api.post<any>(`${V2}/consultations/${consultationId}:cancel`, { reasonCode }),
};

// ── Verification cases ────────────────────────────────────────────────────────

export const verificationCaseService = {
  /**
   * Open a new verification case (provider) or for a specific provider (reviewer/ops).
   * Backend: POST /api/v2/verification-cases
   */
  open: (data: OpenVerificationCaseInput = {}) =>
    api.post<{ success: boolean; data: VerificationCase }>(
      `${V2}/verification-cases`,
      data,
    ),

  /**
   * List own cases (provider) or the review queue (reviewer role).
   * Backend: GET /api/v2/verification-cases
   */
  list: (params: { status?: string; verificationType?: string; assignedToMe?: boolean; page?: number; limit?: number } = {}) =>
    api.get<{ success: boolean; data: VerificationCase[] }>(
      `${V2}/verification-cases`,
      { params },
    ),

  /**
   * Get one verification case.
   * Backend: GET /api/v2/verification-cases/:caseId
   */
  getById: (caseId: string) =>
    api.get<{ success: boolean; data: VerificationCase }>(
      `${V2}/verification-cases/${caseId}`,
    ),

  /**
   * Add evidence (metadata only; the file upload goes through /api/uploads).
   * Backend: POST /api/v2/verification-cases/:caseId/evidence
   */
  addEvidence: (caseId: string, data: AddEvidenceInput) =>
    api.post<{ success: boolean; data: VerificationCase }>(
      `${V2}/verification-cases/${caseId}/evidence`,
      data,
    ),

  /**
   * Provider submits case to the review queue.
   * Backend: POST /api/v2/verification-cases/:caseId:submit
   */
  submit: (caseId: string) =>
    api.post<{ success: boolean; data: VerificationCase }>(
      `${V2}/verification-cases/${caseId}:submit`,
      {},
    ),

  /**
   * Provider opens a fresh case after a rejection that allows it.
   * Backend: POST /api/v2/verification-cases/:caseId:resubmit
   */
  resubmit: (caseId: string) =>
    api.post<{ success: boolean; data: VerificationCase }>(
      `${V2}/verification-cases/${caseId}:resubmit`,
      {},
    ),

  /**
   * Reviewer claims the case.
   * Backend: POST /api/v2/verification-cases/:caseId:claim
   */
  claim: (caseId: string) =>
    api.post<{ success: boolean; data: VerificationCase }>(
      `${V2}/verification-cases/${caseId}:claim`,
      {},
    ),

  /**
   * Reviewer approves or rejects.
   * Backend: POST /api/v2/verification-cases/:caseId:decide
   */
  decide: (caseId: string, data: DecideVerificationInput) =>
    api.post<{ success: boolean; data: VerificationCase }>(
      `${V2}/verification-cases/${caseId}:decide`,
      data,
    ),
};

// ── Admin provider management ─────────────────────────────────────────────────

export const providerAdminService = {
  /**
   * Overview dashboard aggregate statistics for Super Admin.
   * Backend: GET /api/v2/admin/providers/overview
   */
  overview: () =>
    api.get<any>(`${V2}/admin/providers/overview`),

  /**
   * List all providers (reviewer / service_manager / super_admin).
   * Backend: GET /api/v2/admin/providers
   */
  list: (params: { q?: string; status?: string; verificationLevel?: string; page?: number } = {}) =>
    api.get<any>(`${V2}/admin/providers`, { params }),

  /**
   * Admin onboarding / creation of a provider profile.
   * Backend: POST /api/v2/admin/providers
   */
  create: (data: {
    userId?: string;
    displayName: string;
    providerType?: string;
    phone?: string;
    email?: string;
    /** Initial login password; required with email and phone when no userId is given. */
    password?: string;
    homeCity?: string;
    homeState?: string;
    bio?: string;
    experienceYears?: number;
    languages?: string[];
    specializations?: string[];
    traditions?: string[];
    status?: string;
    verificationLevel?: string;
  }) => api.post<any>(`${V2}/admin/providers`, data),

  /**
   * Update a provider's administrative and profile fields.
   * Backend: PATCH /api/v2/admin/providers/:providerId
   */
  update: (providerId: string, data: any) =>
    api.patch<any>(`${V2}/admin/providers/${providerId}`, data),

  /**
   * Get a single provider's private profile (reviewer / super_admin).
   * Backend: GET /api/v2/admin/providers/:providerId
   */
  getById: (providerId: string) =>
    api.get<any>(`${V2}/admin/providers/${providerId}`),

  /**
   * Suspend a provider.
   * Backend: POST /api/v2/admin/providers/:providerId:suspend
   */
  suspend: (providerId: string, data: { reasonCode: string; note?: string }) =>
    api.post<any>(`${V2}/admin/providers/${providerId}:suspend`, data),

  /**
   * Reinstate a suspended provider.
   * Backend: POST /api/v2/admin/providers/:providerId:reinstate
   */
  reinstate: (providerId: string, data: { reasonCode: string; note?: string }) =>
    api.post<any>(`${V2}/admin/providers/${providerId}:reinstate`, data),

  /**
   * List offerings across all providers for administration.
   * Backend: GET /api/v2/admin/offerings
   */
  listOfferings: (params: { providerId?: string; status?: string; page?: number; limit?: number } = {}) =>
    api.get<any>(`${V2}/admin/offerings`, { params }),

  /**
   * Update offering publication status.
   * Backend: PATCH /api/v2/admin/offerings/:offeringId/status
   */
  setOfferingStatus: (offeringId: string, status: "ACTIVE" | "INACTIVE") =>
    api.patch<any>(`${V2}/admin/offerings/${offeringId}/status`, { status }),

  /**
   * List bookings across all providers for operations/admin.
   * Backend: GET /api/v2/admin/provider-bookings
   */
  listBookings: (params: { status?: string; from?: string; to?: string; page?: number; limit?: number } = {}) =>
    api.get<any>(`${V2}/admin/provider-bookings`, { params }),

  /**
   * List consultations across all providers for operations/admin.
   * Backend: GET /api/v2/admin/consultations
   */
  listConsultations: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get<any>(`${V2}/admin/consultations`, { params }),
};

// ── Ritual catalogue administration (content_manager / super_admin) ───────────

export const ritualAdminService = {
  /** Backend: GET /api/v2/admin/rituals */
  list: (params: { status?: string; q?: string; page?: number; limit?: number } = {}) =>
    api.get<any>(`${V2}/admin/rituals`, { params }),
  /** Backend: GET /api/v2/admin/rituals/:id (with variants) */
  getById: (id: string) => api.get<any>(`${V2}/admin/rituals/${id}`),
  /** Backend: POST /api/v2/admin/rituals */
  create: (data: unknown) => api.post<any>(`${V2}/admin/rituals`, data),
  /** Backend: POST /api/v2/admin/rituals/:id/variants */
  createVariant: (id: string, data: unknown) => api.post<any>(`${V2}/admin/rituals/${id}/variants`, data),
  /** Puja process guide (before / during / after). Live for devotees and pandits once saved. */
  setProcess: (id: string, process: { before: unknown[]; during: unknown[]; after: unknown[] }) =>
    api.put<any>(`${V2}/admin/rituals/${id}/process`, process),
  /** Workflow: submit-review | approve | publish | revise | archive. */
  transition: (id: string, action: "submit-review" | "approve" | "publish" | "revise" | "archive", note?: string) =>
    api.post<any>(`${V2}/admin/rituals/${id}:${action}`, note ? { note } : {}),
};

// ── Ritual catalogue (public) ─────────────────────────────────────────────────

export const ritualCatalogService = {
  /**
   * List published rituals.
   * Backend: GET /api/v2/rituals
   */
  list: (params: { q?: string; category?: string; page?: number } = {}) =>
    api.get<{ success: boolean; data: Ritual[] }>(`${V2}/rituals`, { params }),

  /**
   * Get a single ritual with its variants.
   * Backend: GET /api/v2/rituals/:ritualId
   */
  getById: (ritualId: string) =>
    api.get<{ success: boolean; data: Ritual }>(`${V2}/rituals/${ritualId}`),

  /**
   * Get the variants of a ritual.
   * Backend: GET /api/v2/rituals/:ritualId/variants
   */
  getVariants: (ritualId: string) =>
    api.get<any>(`${V2}/rituals/${ritualId}/variants`),
};

// ── Pandit earnings wallet ────────────────────────────────────────────────────
// Devotees pay Tirvona (Razorpay checkout / UPI QR or their Tirvona wallet);
// the pandit's share lands here as pending and can be withdrawn after the hold.

export const providerWalletService = {
  /** Balances, rules, payout account, open withdrawals. Backend: GET /api/v2/provider/wallet */
  summary: () => api.get<any>(`${V2}/provider/wallet`),
  /** Statement. Backend: GET /api/v2/provider/wallet/transactions */
  transactions: (params: { type?: string; status?: string; page?: number; limit?: number } = {}) =>
    api.get<any>(`${V2}/provider/wallet/transactions`, { params }),
  /** Backend: PUT /api/v2/provider/wallet/payout-account */
  savePayoutAccount: (data: {
    method: "BANK" | "UPI";
    accountHolderName: string;
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
    upiId?: string;
  }) => api.put<any>(`${V2}/provider/wallet/payout-account`, data),
  /** Backend: GET /api/v2/provider/wallet/withdrawals */
  withdrawals: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get<any>(`${V2}/provider/wallet/withdrawals`, { params }),
  /** Backend: POST /api/v2/provider/wallet/withdrawals (amount in paise) */
  withdraw: (amountMinor: number, note?: string) =>
    api.post<any>(`${V2}/provider/wallet/withdrawals`, note ? { amountMinor, note } : { amountMinor }),
  /** Backend: POST /api/v2/provider/wallet/withdrawals/:id:cancel */
  cancelWithdrawal: (id: string) => api.post<any>(`${V2}/provider/wallet/withdrawals/${id}:cancel`, {}),
};

// ── Pandit withdrawals queue (finance_manager / service_manager / super_admin) ─

export const providerWalletAdminService = {
  /** Backend: GET /api/v2/admin/provider-wallets/overview */
  overview: () => api.get<any>(`${V2}/admin/provider-wallets/overview`),
  /** Backend: GET /api/v2/admin/provider-wallets/withdrawals */
  withdrawals: (params: { status?: string; providerId?: string; page?: number; limit?: number } = {}) =>
    api.get<any>(`${V2}/admin/provider-wallets/withdrawals`, { params }),
  /** Full bank / UPI details to make the transfer (audited). */
  revealDestination: (id: string) => api.post<any>(`${V2}/admin/provider-wallets/withdrawals/${id}/destination`, {}),
  markProcessing: (id: string) => api.post<any>(`${V2}/admin/provider-wallets/withdrawals/${id}:processing`, {}),
  markPaid: (id: string, payoutReference: string) =>
    api.post<any>(`${V2}/admin/provider-wallets/withdrawals/${id}:mark-paid`, { payoutReference }),
  reject: (id: string, reason: string) =>
    api.post<any>(`${V2}/admin/provider-wallets/withdrawals/${id}:reject`, { reason }),
};
