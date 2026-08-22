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
export type CircuitType = (typeof CIRCUIT_TYPES)[number];

export const CIRCUIT_TYPE_META: Record<CircuitType, { label: string }> = {
  char_dham: { label: "Char Dham" },
  jyotirlinga: { label: "Jyotirlinga" },
  shakti_peeth: { label: "Shakti Peeth" },
  ganga_yatra: { label: "Ganga Yatra" },
  krishna_bhoomi: { label: "Krishna Bhoomi" },
  ram_path: { label: "Ram Path" },
  buddhist: { label: "Buddhist Circuit" },
  jain: { label: "Jain Circuit" },
  sikh: { label: "Sikh Circuit" },
  temple_trail: { label: "Temple Trail" },
  other: { label: "Pilgrimage Circuit" },
};

export const CIRCUIT_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "suspended",
  "archived",
] as const;

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

export const CIRCUIT_DIFFICULTIES = [
  "easy",
  "moderate",
  "strenuous",
] as const;

export const CIRCUIT_SEASONS = [
  "spring",
  "summer",
  "monsoon",
  "autumn",
  "winter",
  "year_round",
] as const;

export const PILGRIMAGE_CAPABILITIES = {
  MANAGE_CIRCUIT: "manage_circuit",
  MANAGE_STOPS: "manage_stops",
  VIEW_REPORTS: "view_reports",
  APPROVE_CIRCUIT: "approve_circuit",
  MANAGE_SETTINGS: "manage_settings",
} as const;

const C = PILGRIMAGE_CAPABILITIES;

export const PILGRIMAGE_ASHRAM_OWNER_CAPABILITIES: string[] = [
  C.MANAGE_CIRCUIT,
  C.MANAGE_STOPS,
  C.VIEW_REPORTS,
];

export const PILGRIMAGE_ASHRAM_ADMIN_CAPABILITIES: string[] = [
  ...PILGRIMAGE_ASHRAM_OWNER_CAPABILITIES,
];

export const PILGRIMAGE_DEFAULTS = {
  maxDurationDays: 30,
  maxStopsPerCircuit: 60,
  defaultPaceStopsPerDay: 3,
};

export const PILGRIMAGE_MODEL = {
  Circuit: "PilgrimageCircuitListing",
  Stop: "PilgrimageStop",
  Itinerary: "PilgrimageItinerary",
  Setting: "PilgrimageSetting",
  AshramRef: "PilgrimageAshramRef",
} as const;
