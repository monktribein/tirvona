// ─────────────────────────────────────────────────────────────────────────────
// usePanditProvider — custom hook for loading the current provider's profile
// Pattern matches useMyBookings.ts in the existing codebase
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { panditService } from "../services/pandit.service";
import type {
  ProviderProfile,
  Offering,
  VerificationCase,
  ProviderAvailability,
  CalendarBlock,
} from "../types/pandit.types";
import { getErrorMessage } from "@/lib/api";

export interface UsePanditProfileResult {
  profile: ProviderProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Load the authenticated provider's own profile.
 * Returns null profile + error string if the backend call fails.
 */
export function usePanditProfile(enabled = true): UsePanditProfileResult {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await panditService.getMyProfile();
      if (res.data?.success) {
        setProfile(res.data.data);
      } else {
        setError(res.data?.message || "Failed to load provider profile.");
        setProfile(null);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        // Provider has not created their profile yet: render empty profile creation state
        setProfile(null);
        setError(null);
      } else {
        setError(getErrorMessage(err, "Failed to load provider profile."));
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { profile, loading, error, refresh: fetch };
}

// ─── Offerings hook ───────────────────────────────────────────────────────────

export interface UsePanditOfferingsResult {
  offerings: Offering[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePanditOfferings(enabled = true): UsePanditOfferingsResult {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await panditService.getMyOfferings();
      if (res.data?.success) {
        setOfferings(res.data.data || []);
      } else {
        setError(res.data?.message || "Failed to load offerings.");
        setOfferings([]);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setOfferings([]);
        setError(null);
      } else {
        setError(getErrorMessage(err, "Failed to load offerings."));
        setOfferings([]);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { offerings, loading, error, refresh: fetch };
}

// ─── Verification hook ────────────────────────────────────────────────────────

export interface UsePanditVerificationResult {
  cases: VerificationCase[];
  latestCase: VerificationCase | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePanditVerification(
  enabled = true,
): UsePanditVerificationResult {
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await panditService.getVerificationCases();
      if (res.data?.success) {
        const data = res.data.data || [];
        setCases(data);
      } else {
        setError(res.data?.message || "Failed to load verification cases.");
        setCases([]);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setCases([]);
        setError(null);
      } else {
        setError(getErrorMessage(err, "Failed to load verification cases."));
        setCases([]);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const latestCase =
    cases.length > 0
      ? cases.sort(
          (a, b) =>
            new Date(b.submittedAt || 0).getTime() -
            new Date(a.submittedAt || 0).getTime(),
        )[0]
      : null;

  return { cases, latestCase, loading, error, refresh: fetch };
}

// ─── Availability hook ────────────────────────────────────────────────────────

export interface UsePanditAvailabilityResult {
  availability: ProviderAvailability | null;
  calendarBlocks: CalendarBlock[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePanditAvailability(
  providerId: string | null,
  enabled = true,
): UsePanditAvailabilityResult {
  const [availability, setAvailability] =
    useState<ProviderAvailability | null>(null);
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlock[]>([]);
  const [loading, setLoading] = useState(Boolean(providerId && enabled));
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!providerId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [availRes, blocksRes] = await Promise.allSettled([
        panditService.getAvailability(providerId),
        panditService.getCalendarBlocks(),
      ]);

      if (
        availRes.status === "fulfilled" &&
        availRes.value.data?.success
      ) {
        setAvailability(availRes.value.data.data);
      }

      if (
        blocksRes.status === "fulfilled" &&
        blocksRes.value.data?.success
      ) {
        setCalendarBlocks(blocksRes.value.data.data || []);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load availability."));
    } finally {
      setLoading(false);
    }
  }, [providerId, enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { availability, calendarBlocks, loading, error, refresh: fetch };
}

// ─── Bookings hook ────────────────────────────────────────────────────────────

export interface UsePanditBookingsResult {
  bookings: any[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePanditBookings(enabled = true): UsePanditBookingsResult {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await panditService.getBookings();
      if (res.data?.success) {
        setBookings(res.data.data || []);
      } else {
        setBookings([]);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setBookings([]);
        setError(null);
      } else {
        setError(getErrorMessage(err, "Failed to load bookings."));
        setBookings([]);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { bookings, loading, error, refresh: fetch };
}

// ─── Consultations hook ───────────────────────────────────────────────────────

export interface UsePanditConsultationsResult {
  consultations: any[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePanditConsultations(enabled = true): UsePanditConsultationsResult {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      // In the API contract consultations can be queried via general endpoints or filtered
      setConsultations([]);
    } catch (err: any) {
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { consultations, loading, error, refresh: fetch };
}


