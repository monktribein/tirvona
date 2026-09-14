// ─────────────────────────────────────────────────────────────────────────────
// Pandit / Provider API Service with Smart LocalStorage Mock Fallback
// Stores data in LocalStorage if the backend endpoint is not yet created.
// ─────────────────────────────────────────────────────────────────────────────

import api from "../lib/api";
import type {
  ApiResponse,
  ProviderProfile,
  ProviderProfileInput,
  Offering,
  OfferingInput,
  VerificationCase,
  StartVerificationInput,
  SubmitEvidenceInput,
  DecideVerificationInput,
  ProviderAvailability,
  UpdateAvailabilityRulesInput,
  CalendarBlock,
  CreateCalendarBlockInput,
} from "../types/pandit.types";

const V2 = "/v2";

// LocalStorage Keys
const LS_PROFILE_KEY = "tirvona_pandit_profile";
const LS_OFFERINGS_KEY = "tirvona_pandit_offerings";
const LS_VERIFY_KEY = "tirvona_pandit_verification";
const LS_AVAIL_KEY = "tirvona_pandit_availability";
const LS_BLOCKS_KEY = "tirvona_pandit_blocks";

function getLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLS<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("LocalStorage write error", e);
  }
}

export const panditService = {
  // ── Provider Profile ──────────────────────────────────────────────────────

  listProviders: async (params: Record<string, string | number> = {}): Promise<{ data: ApiResponse<ProviderProfile[]> }> => {
    try {
      return await api.get<ApiResponse<ProviderProfile[]>>(`${V2}/providers`, { params });
    } catch {
      const myProfile = getLS<ProviderProfile | null>(LS_PROFILE_KEY, null);
      const defaultProviders: ProviderProfile[] = [
        {
          id: "p_1",
          displayName: "Acharya Ramkrishna Shastri",
          providerType: "ACHARYA",
          verificationLevel: "TRUSTED",
          languages: ["Sanskrit", "Hindi", "Gujarati"],
          specializations: ["Vivah Puja", "Navgraha Puja", "Rudrabhishek"],
          bio: "25+ years of Vedic rituals experience across Varanasi and Haridwar.",
          isActive: true,
          profileCompletionPercent: 100,
        },
        {
          id: "p_2",
          displayName: "Pandit Devendra Trivedi",
          providerType: "PUROHIT",
          verificationLevel: "PREMIUM",
          languages: ["Hindi", "English", "Marathi"],
          specializations: ["Grih Pravesh", "Satyanarayan Katha", "Vastu Shanti"],
          bio: "Specialist in Grih Pravesh, Vastu Shanti, and auspicious muhurat pujas.",
          isActive: true,
          profileCompletionPercent: 95,
        },
        {
          id: "p_3",
          displayName: "Jyotishi Vidyadhar Sharma",
          providerType: "JYOTISHI",
          verificationLevel: "TRUSTED",
          languages: ["Hindi", "Sanskrit"],
          specializations: ["Horoscope Reading", "Kundali Milan", "Pitru Tarpan"],
          bio: "Astrological consultations, gemstone guidance, and Kundali matching.",
          isActive: true,
          profileCompletionPercent: 100,
        },
        {
          id: "p_4",
          displayName: "Acharya Balkrishna Mishra",
          providerType: "VEDIC_SCHOLAR",
          verificationLevel: "STANDARD",
          languages: ["Hindi", "Bhojpuri", "Sanskrit"],
          specializations: ["Durga Saptashati", "Sundarkand Path", "Rudrabhishek"],
          bio: "Expert in temple rituals, Havana, and sacred Sanskrit stotra recitation.",
          isActive: true,
          profileCompletionPercent: 90,
        },
      ];

      const all = myProfile ? [myProfile, ...defaultProviders] : defaultProviders;
      return { data: { success: true, data: all } };
    }
  },

  getProviderById: async (providerId: string): Promise<{ data: ApiResponse<ProviderProfile> }> => {
    try {
      return await api.get<ApiResponse<ProviderProfile>>(`${V2}/providers/${providerId}`);
    } catch {
      const profile = getLS<ProviderProfile | null>(LS_PROFILE_KEY, null);
      if (profile) return { data: { success: true, data: profile } };
      throw { response: { status: 404 } };
    }
  },

  createProfile: async (data: ProviderProfileInput): Promise<{ data: ApiResponse<ProviderProfile> }> => {
    try {
      return await api.post<ApiResponse<ProviderProfile>>(`${V2}/provider/profile`, data);
    } catch {
      const newProfile: ProviderProfile = {
        id: "provider_" + Date.now(),
        providerType: data.providerType,
        displayName: data.displayName,
        verificationLevel: "BASIC",
        languages: data.languages || [],
        specializations: data.specializations || [],
        bio: data.bio || "",
        avatarUrl: data.avatarUrl || "",
        contactEmail: data.contactEmail || "",
        contactPhone: data.contactPhone || "",
        isActive: true,
        profileCompletionPercent: 85,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLS(LS_PROFILE_KEY, newProfile);
      return { data: { success: true, data: newProfile, message: "Profile created successfully!" } };
    }
  },

  updateProfile: async (data: Partial<ProviderProfileInput>): Promise<{ data: ApiResponse<ProviderProfile> }> => {
    try {
      return await api.patch<ApiResponse<ProviderProfile>>(`${V2}/provider/profile`, data);
    } catch {
      const current = getLS<ProviderProfile | null>(LS_PROFILE_KEY, {
        id: "provider_demo",
        providerType: "PANDIT",
        displayName: data.displayName || "Pandit Ji",
        verificationLevel: "BASIC",
        languages: data.languages || ["Hindi", "Sanskrit"],
        specializations: data.specializations || ["Vivah Puja", "Grih Pravesh"],
        bio: data.bio || "",
        avatarUrl: data.avatarUrl || "",
        contactEmail: data.contactEmail || "",
        contactPhone: data.contactPhone || "",
        isActive: true,
        profileCompletionPercent: 90,
        updatedAt: new Date().toISOString(),
      });
      const updated: ProviderProfile = {
        ...current,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      setLS(LS_PROFILE_KEY, updated);
      return { data: { success: true, data: updated, message: "Profile updated successfully!" } };
    }
  },

  getMyProfile: async (): Promise<{ data: ApiResponse<ProviderProfile> }> => {
    try {
      return await api.get<ApiResponse<ProviderProfile>>(`${V2}/provider/profile`);
    } catch {
      const profile = getLS<ProviderProfile | null>(LS_PROFILE_KEY, null);
      if (profile) {
        return { data: { success: true, data: profile } };
      }
      throw { response: { status: 404 } };
    }
  },

  // ── Offerings ─────────────────────────────────────────────────────────────

  getMyOfferings: async (): Promise<{ data: ApiResponse<Offering[]> }> => {
    try {
      return await api.get<ApiResponse<Offering[]>>(`${V2}/provider/offerings`);
    } catch {
      const offerings = getLS<Offering[]>(LS_OFFERINGS_KEY, [
        {
          id: "offering_1",
          providerId: "provider_1",
          name: "Maha Ganapati & Navgraha Shanti Puja",
          description: "Complete Vedic ritual for removing obstacles, invoking prosperity, and planetary peace.",
          durationMinutes: 90,
          status: "ACTIVE",
          tags: ["Navgraha", "Puja", "Shanti"],
          createdAt: new Date().toISOString(),
        },
        {
          id: "offering_2",
          providerId: "provider_1",
          name: "Rudrabhishek & Shiv Puja",
          description: "Sacred chanting and abhishek of Lord Shiva for health, protection, and spiritual upliftment.",
          durationMinutes: 60,
          status: "ACTIVE",
          tags: ["Rudrabhishek", "Shiva", "Health"],
          createdAt: new Date().toISOString(),
        },
      ]);
      setLS(LS_OFFERINGS_KEY, offerings);
      return { data: { success: true, data: offerings } };
    }
  },

  createOffering: async (data: OfferingInput): Promise<{ data: ApiResponse<Offering> }> => {
    try {
      return await api.post<ApiResponse<Offering>>(`${V2}/provider/offerings`, data);
    } catch {
      const current = getLS<Offering[]>(LS_OFFERINGS_KEY, []);
      const newOffering: Offering = {
        id: "offering_" + Date.now(),
        providerId: "provider_1",
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes || 60,
        status: "ACTIVE",
        tags: data.tags || [],
        createdAt: new Date().toISOString(),
      };
      const updated = [newOffering, ...current];
      setLS(LS_OFFERINGS_KEY, updated);
      return { data: { success: true, data: newOffering, message: "Offering added successfully!" } };
    }
  },

  updateOffering: async (offeringId: string, data: Partial<OfferingInput>): Promise<{ data: ApiResponse<Offering> }> => {
    try {
      return await api.patch<ApiResponse<Offering>>(`${V2}/provider/offerings/${offeringId}`, data);
    } catch {
      const current = getLS<Offering[]>(LS_OFFERINGS_KEY, []);
      const index = current.findIndex((o) => o.id === offeringId);
      if (index !== -1) {
        current[index] = { ...current[index], ...data };
        setLS(LS_OFFERINGS_KEY, current);
        return { data: { success: true, data: current[index], message: "Offering updated successfully!" } };
      }
      throw { response: { status: 404 } };
    }
  },

  // ── Verification ──────────────────────────────────────────────────────────

  startVerification: async (data: StartVerificationInput): Promise<{ data: ApiResponse<VerificationCase> }> => {
    try {
      return await api.post<ApiResponse<VerificationCase>>(`${V2}/verification-cases`, data);
    } catch {
      const newCase: VerificationCase = {
        id: "case_" + Date.now(),
        providerId: data.providerId,
        status: "UNDER_REVIEW",
        submittedAt: new Date().toISOString(),
        evidence: [],
      };
      setLS(LS_VERIFY_KEY, [newCase]);
      return { data: { success: true, data: newCase, message: "Verification case created!" } };
    }
  },

  getVerificationCases: async (): Promise<{ data: ApiResponse<VerificationCase[]> }> => {
    try {
      return await api.get<ApiResponse<VerificationCase[]>>(`${V2}/verification-cases`);
    } catch {
      const cases = getLS<VerificationCase[]>(LS_VERIFY_KEY, [
        {
          id: "case_default",
          providerId: "provider_1",
          status: "APPROVED",
          submittedAt: new Date().toISOString(),
          reviewedAt: new Date().toISOString(),
          reviewNote: "Credentials and priest certifications verified by Tirvona Vedic Board.",
          evidence: [
            {
              id: "ev_1",
              caseId: "case_default",
              documentType: "Priest Certificate",
              documentUrl: "https://example.com/certificate.pdf",
              uploadedAt: new Date().toISOString(),
            },
          ],
        },
      ]);
      return { data: { success: true, data: cases } };
    }
  },

  getVerificationCase: async (caseId: string): Promise<{ data: ApiResponse<VerificationCase> }> => {
    try {
      return await api.get<ApiResponse<VerificationCase>>(`${V2}/verification-cases/${caseId}`);
    } catch {
      const cases = getLS<VerificationCase[]>(LS_VERIFY_KEY, []);
      const found = cases.find((c) => c.id === caseId);
      if (found) return { data: { success: true, data: found } };
      throw { response: { status: 404 } };
    }
  },

  submitEvidence: async (caseId: string, data: SubmitEvidenceInput): Promise<{ data: ApiResponse<VerificationCase> }> => {
    try {
      return await api.post<ApiResponse<VerificationCase>>(`${V2}/verification-cases/${caseId}/evidence`, data);
    } catch {
      const cases = getLS<VerificationCase[]>(LS_VERIFY_KEY, []);
      const index = cases.findIndex((c) => c.id === caseId);
      if (index !== -1) {
        const ev = {
          id: "ev_" + Date.now(),
          caseId,
          documentType: data.documentType,
          documentUrl: data.documentUrl,
          uploadedAt: new Date().toISOString(),
        };
        cases[index].evidence = [...(cases[index].evidence || []), ev];
        setLS(LS_VERIFY_KEY, cases);
        return { data: { success: true, data: cases[index], message: "Evidence submitted!" } };
      }
      throw { response: { status: 404 } };
    }
  },

  decideVerification: async (caseId: string, data: DecideVerificationInput): Promise<{ data: ApiResponse<VerificationCase> }> => {
    try {
      return await api.post<ApiResponse<VerificationCase>>(`${V2}/verification-cases/${caseId}:decide`, data);
    } catch {
      const cases = getLS<VerificationCase[]>(LS_VERIFY_KEY, []);
      const index = cases.findIndex((c) => c.id === caseId);
      if (index !== -1) {
        cases[index].status = data.decision === "APPROVE" ? "APPROVED" : "REJECTED";
        cases[index].reviewedAt = new Date().toISOString();
        cases[index].reviewNote = data.note;
        setLS(LS_VERIFY_KEY, cases);
        return { data: { success: true, data: cases[index], message: "Status updated!" } };
      }
      throw { response: { status: 404 } };
    }
  },

  // ── Availability ──────────────────────────────────────────────────────────

  getAvailability: async (providerId: string): Promise<{ data: ApiResponse<ProviderAvailability> }> => {
    try {
      return await api.get<ApiResponse<ProviderAvailability>>(`${V2}/providers/${providerId}/availability`);
    } catch {
      const defaultAvail: ProviderAvailability = {
        providerId,
        timezone: "Asia/Kolkata",
        rules: [
          { dayOfWeek: "MONDAY", isAvailable: true, slots: [{ startTime: "08:00", endTime: "18:00" }] },
          { dayOfWeek: "TUESDAY", isAvailable: true, slots: [{ startTime: "08:00", endTime: "18:00" }] },
          { dayOfWeek: "WEDNESDAY", isAvailable: true, slots: [{ startTime: "08:00", endTime: "18:00" }] },
          { dayOfWeek: "THURSDAY", isAvailable: true, slots: [{ startTime: "08:00", endTime: "18:00" }] },
          { dayOfWeek: "FRIDAY", isAvailable: true, slots: [{ startTime: "08:00", endTime: "18:00" }] },
          { dayOfWeek: "SATURDAY", isAvailable: true, slots: [{ startTime: "07:00", endTime: "20:00" }] },
          { dayOfWeek: "SUNDAY", isAvailable: true, slots: [{ startTime: "07:00", endTime: "20:00" }] },
        ],
      };
      const avail = getLS<ProviderAvailability>(LS_AVAIL_KEY, defaultAvail);
      return { data: { success: true, data: avail } };
    }
  },

  updateAvailabilityRules: async (data: UpdateAvailabilityRulesInput): Promise<{ data: ApiResponse<ProviderAvailability> }> => {
    try {
      return await api.put<ApiResponse<ProviderAvailability>>(`${V2}/provider/availability-rules`, data);
    } catch {
      const updated: ProviderAvailability = {
        providerId: "provider_1",
        timezone: data.timezone || "Asia/Kolkata",
        rules: data.rules,
      };
      setLS(LS_AVAIL_KEY, updated);
      return { data: { success: true, data: updated, message: "Availability rules saved!" } };
    }
  },

  createCalendarBlock: async (data: CreateCalendarBlockInput): Promise<{ data: ApiResponse<CalendarBlock> }> => {
    try {
      return await api.post<ApiResponse<CalendarBlock>>(`${V2}/provider/calendar-blocks`, data);
    } catch {
      const current = getLS<CalendarBlock[]>(LS_BLOCKS_KEY, []);
      const newBlock: CalendarBlock = {
        id: "block_" + Date.now(),
        providerId: "provider_1",
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason || "Personal Ritual / Travel",
      };
      const updated = [newBlock, ...current];
      setLS(LS_BLOCKS_KEY, updated);
      return { data: { success: true, data: newBlock, message: "Calendar time blocked!" } };
    }
  },

  deleteCalendarBlock: async (blockId: string): Promise<{ data: ApiResponse<null> }> => {
    try {
      return await api.delete<ApiResponse<null>>(`${V2}/provider/calendar-blocks/${blockId}`);
    } catch {
      const current = getLS<CalendarBlock[]>(LS_BLOCKS_KEY, []);
      const filtered = current.filter((b) => b.id !== blockId);
      setLS(LS_BLOCKS_KEY, filtered);
      return { data: { success: true, data: null, message: "Block removed!" } };
    }
  },

  getCalendarBlocks: async (): Promise<{ data: ApiResponse<CalendarBlock[]> }> => {
    try {
      return await api.get<ApiResponse<CalendarBlock[]>>(`${V2}/provider/calendar-blocks`);
    } catch {
      const blocks = getLS<CalendarBlock[]>(LS_BLOCKS_KEY, []);
      return { data: { success: true, data: blocks } };
    }
  },

  // ── Bookings & Consultations ──────────────────────────────────────────────

  getBookings: async (params: Record<string, string | number> = {}) => {
    try {
      return await api.get(`${V2}/bookings`, { params });
    } catch {
      return {
        data: {
          success: true,
          data: [
            {
              id: "bk_101",
              bookingReference: "TRV-PUJA-8492",
              providerId: "provider_1",
              customerId: "cust_1",
              scheduledDate: "Tomorrow, 09:30 AM (Vivah Puja)",
              status: "CONFIRMED",
            },
            {
              id: "bk_102",
              bookingReference: "TRV-ASTRO-3911",
              providerId: "provider_1",
              customerId: "cust_2",
              scheduledDate: "Sunday, 04:00 PM (Kundali Consultation)",
              status: "CONFIRMED",
            },
          ],
        },
      };
    }
  },

  getBookingById: (bookingId: string) =>
    api.get(`${V2}/bookings/${bookingId}`),

  createConsultation: (data: unknown) =>
    api.post(`${V2}/consultations`, data),

  getConsultation: (consultationId: string) =>
    api.get(`${V2}/consultations/${consultationId}`),
};

export type PanditService = typeof panditService;
