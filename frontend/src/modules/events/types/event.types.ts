export const EVENT_TYPES = [
  "festival",
  "snan",
  "mahotsav",
  "jayanti",
  "yatra",
  "katha",
  "bhandara",
  "satsang",
  "cultural",
  "other",
] as const;
export type EventTypeCode = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventTypeCode, string> = {
  festival: "Festival",
  snan: "Snan",
  mahotsav: "Mahotsav",
  jayanti: "Jayanti",
  yatra: "Yatra",
  katha: "Katha",
  bhandara: "Bhandara",
  satsang: "Satsang",
  cultural: "Cultural Programme",
  other: "Event",
};

export const EVENT_FACILITIES = [
  "seating",
  "prasad",
  "bhandara",
  "parking",
  "drinking_water",
  "medical_camp",
  "shoe_stand",
  "wheelchair_access",
  "cloak_room",
  "live_stream",
  "photography",
  "volunteer_support",
] as const;
export type EventFacility = (typeof EVENT_FACILITIES)[number];

export type EventStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "archived";

export type RegistrationStatus =
  | "confirmed"
  | "checked_in"
  | "attended"
  | "cancelled"
  | "no_show";

export interface EventVenue {
  name?: string;
  line1?: string;
  landmark?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export interface EventScheduleItem {
  label: string;
  startTime?: string;
  note?: string;
}

export interface EventDay {
  date: string;
  startsAt: string;
  totalCapacity: number;
  seatsRemaining: number | null;
  isClosed: boolean;
  registrationOpen: boolean;
  note?: string;
}

export interface EventPolicy {
  allowRegistration: boolean;
  allowCancellation: boolean;
  maxSeatsPerRegistration: number;
  gateOpensBeforeMinutes: number;
  registrationClosesBeforeMinutes: number;
}

export interface EventFestival {
  _id: string;
  ashramId?: string | { _id: string; name?: string; ashramCode?: string };
  ownerId?: string;
  name: string;
  slug: string;
  eventType: EventTypeCode;
  eventTypeLabel?: string;
  deity?: string;
  tagline?: string;
  description?: string;
  highlights?: string[];
  dressCode?: string;
  instructions?: string;
  termsAndConditions?: string;
  images?: string[];
  coverImage?: string;
  venue?: EventVenue;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  durationMinutes?: number;
  timezone?: string;
  dailySchedule?: EventScheduleItem[];
  facilities?: EventFacility[];
  contactPhone?: string;
  contactEmail?: string;
  requiresRegistration?: boolean;
  dailyCapacity?: number;
  maxSeatsPerRegistration?: number;
  isFeatured?: boolean;
  status: EventStatus;
  rejectionReason?: string;
  viewCount?: number;
  isOnNow?: boolean;
  hasEnded?: boolean;
  dayCount?: number;
  startsAt?: string;
  days?: EventDay[];
  policy?: EventPolicy;
  registrationCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EventAttendee {
  name: string;
  age?: number;
}

export interface EventRegistration {
  _id: string;
  registrationReference: string;
  customerId?: string | { name?: string; phone?: string; email?: string };
  eventId?: string | EventFestival;
  ashramId?: string;
  attendDate: string;
  startsAt: string;
  endsAt: string;
  seats: number;
  attendees?: EventAttendee[];
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  checkedInAt?: string;
  checkedInCount?: number;
  status: RegistrationStatus;
  cancellation?: { reason?: string; cancelledAt?: string };
  createdAt?: string;
}

export interface EventPass {
  format: string;
  image: string;
  token?: string;
  displayCode: string;
  validFrom: string;
  validUntil: string;
  registrationReference: string;
  seats: number;
  startsAt: string;
}

export interface EventSearchFilters {
  q?: string;
  city?: string;
  state?: string;
  eventType?: EventTypeCode | "";
  ashramId?: string;
  date?: string;
  includePast?: boolean;
  facilities?: EventFacility[];
  sort?: "upcoming" | "recommended" | "newest";
  page?: number;
  limit?: number;
}

export interface EventAccess {
  isPlatformAdmin: boolean;
  scopeAllAshrams: boolean;
  roles: string[];
  capabilities: string[];
  ashramIds: string[];
  eventIds: string[];
  staffIds: string[];
}

export interface EventDashboard {
  windowDays: number;
  events: { approved: number; pendingReview: number; runningNow: number };
  totals: { registrations: number; seats: number; admitted: number };
  byStatus: Record<string, number>;
  trend: { _id: string; registrations: number; seats: number }[];
  topEvents: {
    _id: string;
    name?: string;
    slug?: string;
    city?: string;
    startDate?: string;
    registrations: number;
    seats: number;
  }[];
  gateResults: Record<string, number>;
}
