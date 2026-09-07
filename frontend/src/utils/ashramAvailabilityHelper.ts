// Helper for Ashram Availability management across Mathura and Vrindavan

const AVAILABILITY_STORAGE_KEY = "tirvona_ashram_manual_availability";
const SUPER_ADMIN_REQUESTS_KEY = "tirvona_super_admin_availability_requests";

// Stays that are explicitly kept AVAILABLE in Mathura & Vrindavan:
// 1. Sukhram Dham
// 2. Sukhram Dham(A) / Sukhram Dham (A)
// 3. Hotel Dwarika Palace
const ALWAYS_AVAILABLE_NAMES = [
  "sukhram dham",
  "sukhram dham(a)",
  "sukhram dham (a)",
  "hotel dwarika palace",
  "dwarika palace",
];

export interface AvailabilityRequest {
  id: string;
  ashramId: string;
  ashramName: string;
  ownerId?: string;
  ownerName?: string;
  requestedState: "available" | "unavailable";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export const isMathuraOrVrindavan = (ashram: any): boolean => {
  if (!ashram) return false;
  const city = String(ashram.address?.city || ashram.city || "").toLowerCase();
  const district = String(ashram.address?.district || ashram.district || "").toLowerCase();
  const state = String(ashram.address?.state || ashram.state || "").toLowerCase();
  const name = String(ashram.name || "").toLowerCase();
  const locationText = `${city} ${district} ${state} ${name}`;

  return (
    locationText.includes("mathura") ||
    locationText.includes("vrindavan") ||
    locationText.includes("vrindaban")
  );
};

export const isAshramAlwaysAvailable = (name: string): boolean => {
  const norm = String(name || "").toLowerCase().trim();
  return ALWAYS_AVAILABLE_NAMES.some((target) => norm.includes(target) || target.includes(norm));
};

export const getManualAvailabilityMap = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(AVAILABILITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const setManualAshramAvailability = (ashramId: string, isAvailable: boolean) => {
  try {
    const current = getManualAvailabilityMap();
    current[ashramId] = isAvailable;
    localStorage.setItem(AVAILABILITY_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error("Failed to save manual availability:", e);
  }
};

export const getSuperAdminAvailabilityRequests = (): AvailabilityRequest[] => {
  try {
    const raw = localStorage.getItem(SUPER_ADMIN_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const submitAvailabilityApprovalRequest = (request: Omit<AvailabilityRequest, "id" | "createdAt" | "status">) => {
  try {
    const requests = getSuperAdminAvailabilityRequests();
    const newReq: AvailabilityRequest = {
      ...request,
      id: "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    requests.unshift(newReq);
    localStorage.setItem(SUPER_ADMIN_REQUESTS_KEY, JSON.stringify(requests));
    return newReq;
  } catch (e) {
    console.error("Failed to submit request to super admin:", e);
    return null;
  }
};

export const approveAvailabilityRequest = (requestId: string) => {
  try {
    const requests = getSuperAdminAvailabilityRequests();
    const req = requests.find((r) => r.id === requestId);
    if (req) {
      req.status = "approved";
      setManualAshramAvailability(req.ashramId, req.requestedState === "available");
      localStorage.setItem(SUPER_ADMIN_REQUESTS_KEY, JSON.stringify(requests));
    }
  } catch (e) {
    console.error("Failed to approve request:", e);
  }
};

export const rejectAvailabilityRequest = (requestId: string) => {
  try {
    const requests = getSuperAdminAvailabilityRequests();
    const req = requests.find((r) => r.id === requestId);
    if (req) {
      req.status = "rejected";
      localStorage.setItem(SUPER_ADMIN_REQUESTS_KEY, JSON.stringify(requests));
    }
  } catch (e) {
    console.error("Failed to reject request:", e);
  }
};

/**
 * Determines whether an ashram has bookings available.
 * Rule:
 * For Mathura & Vrindavan stays:
 * - Only Sukhram Dham, Sukhram Dham(A), and Hotel Dwarika Palace are available (unless manually overridden / approved).
 * - All other Mathura/Vrindavan ashrams are NOT AVAILABLE.
 * - Non-Mathura/Vrindavan ashrams (e.g. Rishikesh, Haridwar) are unaffected.
 */
export const checkAshramBookingAvailable = (ashram: any): boolean => {
  if (!ashram) return true;

  const ashramId = String(ashram._id || ashram.id || "");
  const manualMap = getManualAvailabilityMap();

  if (ashramId && manualMap[ashramId] !== undefined) {
    return manualMap[ashramId];
  }

  const name = String(ashram.name || "");
  if (isMathuraOrVrindavan(ashram)) {
    return isAshramAlwaysAvailable(name);
  }

  // Unaffected destinations (Rishikesh, Haridwar, Ayodhya, etc.)
  if (ashram.discovery?.bookingAvailability?.checkedForDates) {
    return Boolean(ashram.discovery.bookingAvailability.available);
  }
  return true;
};
