export const CIRCUIT_TYPES = [
  "char_dham",
  "jyotirlinga",
  "shakti_peeth",
  "ganga_yatra",
  "krishna_bhoomi",
  "ram_path",
  "buddhist",
  "jain",
  "sikh",
  "temple_trail",
  "other",
] as const;
export type CircuitTypeCode = (typeof CIRCUIT_TYPES)[number];

export const CIRCUIT_TYPE_LABELS: Record<CircuitTypeCode, string> = {
  char_dham: "Char Dham",
  jyotirlinga: "Jyotirlinga",
  shakti_peeth: "Shakti Peeth",
  ganga_yatra: "Ganga Yatra",
  krishna_bhoomi: "Krishna Bhoomi",
  ram_path: "Ram Path",
  buddhist: "Buddhist Circuit",
  jain: "Jain Circuit",
  sikh: "Sikh Circuit",
  temple_trail: "Temple Trail",
  other: "Pilgrimage Circuit",
};

export const STOP_TYPES = [
  "temple",
  "ghat",
  "ashram",
  "math",
  "gurudwara",
  "monastery",
  "viewpoint",
  "sangam",
  "transit",
  "rest",
] as const;
export type StopType = (typeof STOP_TYPES)[number];

export const CIRCUIT_DIFFICULTIES = ["easy", "moderate", "strenuous"] as const;
export type CircuitDifficulty = (typeof CIRCUIT_DIFFICULTIES)[number];

export const CIRCUIT_SEASONS = [
  "spring",
  "summer",
  "monsoon",
  "autumn",
  "winter",
  "year_round",
] as const;
export type CircuitSeason = (typeof CIRCUIT_SEASONS)[number];

export type CircuitStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "archived";

export interface CircuitStop {
  _id: string;
  circuitId?: string;
  ashramId?: string;
  dayNumber: number;
  order: number;
  name: string;
  stopType: StopType;
  templeSlug?: string;
  linkedAshramId?: string | null;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  distanceFromPreviousKm?: number;
  travelMinutes?: number;
  suggestedDurationMinutes?: number;
  arrivalTime?: string;
  notes?: string;
  images?: string[];
  isOvernightStop?: boolean;
}

export interface CircuitDay {
  dayNumber: number;
  date?: string | null;
  title?: string;
  distanceKm?: number;
  stops: CircuitStop[];
}

export interface PilgrimageCircuit {
  _id: string;
  ashramId?: string | { _id: string; name?: string; ashramCode?: string };
  ownerId?: string;
  name: string;
  slug: string;
  circuitType: CircuitTypeCode;
  circuitTypeLabel?: string;
  summary?: string;
  description?: string;
  highlights?: string[];
  images?: string[];
  coverImage?: string;
  startCity?: string;
  endCity?: string;
  state?: string;
  region?: string;
  durationDays: number;
  totalDistanceKm?: number;
  difficulty?: CircuitDifficulty;
  difficultyLabel?: string;
  bestSeasons?: CircuitSeason[];
  idealFor?: string[];
  travelTips?: string;
  usableAsPlannerTemplate?: boolean;
  isFeatured?: boolean;
  status: CircuitStatus;
  rejectionReason?: string;
  stopCount?: number;
  viewCount?: number;
  stops?: CircuitStop[];
  days?: CircuitDay[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GeneratedItinerary {
  circuit: {
    _id: string;
    name: string;
    slug: string;
    circuitType: CircuitTypeCode;
    coverImage?: string;
    durationDays: number;
    totalDistanceKm?: number;
    difficulty?: CircuitDifficulty;
  };
  travellers: number;
  pace: string;
  durationDays: number;
  shortened: boolean;
  days: CircuitDay[];
}

export interface SavedItinerary {
  _id: string;
  userId?: string;
  circuitId?: string | { _id: string; name?: string; coverImage?: string };
  title: string;
  startDate?: string | null;
  travellers?: number;
  pace?: string;
  days?: CircuitDay[];
  notes?: string;
  status?: string;
  createdAt?: string;
}

export interface CircuitSearchFilters {
  q?: string;
  circuitType?: CircuitTypeCode | "";
  difficulty?: CircuitDifficulty | "";
  season?: CircuitSeason | "";
  state?: string;
  duration?: string;
  sort?: "recommended" | "duration_short" | "duration_long" | "newest";
  page?: number;
  limit?: number;
}

export interface PilgrimageAccess {
  isPlatformAdmin: boolean;
  scopeAllAshrams: boolean;
  roles: string[];
  capabilities: string[];
  ashramIds: string[];
}

export interface PilgrimageDashboard {
  circuits: {
    approved: number;
    pendingReview: number;
    drafts: number;
    templates: number;
  };
  topCircuits: {
    _id: string;
    name?: string;
    slug?: string;
    startCity?: string;
    durationDays?: number;
    stopCount?: number;
    viewCount?: number;
  }[];
  savedItineraries: number;
}
