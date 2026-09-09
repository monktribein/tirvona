import { useCallback, useEffect, useState } from "react";
import { analyticsService } from "../../../services";

export interface SectionTile {
  label: string;
  value: number;
  format: "number" | "currency";
}

export interface SectionSummary {
  key: string;
  label: string;
  tiles: SectionTile[];
}

/**
 * One fetch serves both consumers: the strip above each sidebar section, and
 * the aggregated block on the Executive Dashboard. The result is cached for
 * the lifetime of the tab so moving between sections does not re-query, and a
 * caller can force a refresh after it changes something.
 */
let cache: { at: number; data: SectionSummary[] } | null = null;
let inFlight: Promise<SectionSummary[]> | null = null;
const CACHE_MS = 60_000;

const fetchSections = (force = false): Promise<SectionSummary[]> => {
  if (!force && cache && Date.now() - cache.at < CACHE_MS)
    return Promise.resolve(cache.data);
  if (!force && inFlight) return inFlight;

  inFlight = analyticsService
    .sections()
    .then((response) => {
      const data: SectionSummary[] = response?.data?.data ?? [];
      cache = { at: Date.now(), data };
      return data;
    })
    .catch(() => {
      // A summary strip is decoration around the real page; if it cannot load,
      // the section still works and simply renders nothing.
      cache = { at: Date.now(), data: [] };
      return [];
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

export const useSectionSummaries = (): {
  sections: SectionSummary[];
  loading: boolean;
  refresh: () => void;
} => {
  const [sections, setSections] = useState<SectionSummary[]>(
    () => cache?.data ?? [],
  );
  const [loading, setLoading] = useState(!cache);

  const run = useCallback((force: boolean) => {
    let live = true;
    setLoading(!cache || force);
    void fetchSections(force).then((data) => {
      if (live) {
        setSections(data);
        setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => run(false), [run]);

  return { sections, loading, refresh: () => run(true) };
};

/**
 * Every sidebar link resolves to the sections describing *its own* module.
 * There is deliberately no group-level fallback: a link with no entry here
 * renders nothing rather than borrowing another module's cards, so a Room
 * subsection can never show Booking totals and vice versa.
 *
 * Longest matching prefix wins, so "/admin/manage/rooms/availability" beats
 * "/admin/manage/rooms".
 */
const PATH_SECTIONS: Record<string, string[]> = {
  // Room & Inventory — one block per subsection.
  "/admin/approvals/room-categories": ["roomApprovals"],
  "/admin/manage/rooms/all": ["roomCategories"],
  "/admin/manage/rooms/availability": ["roomAvailability"],
  "/admin/manage/rooms/pricing": ["roomPricing"],
  "/admin/manage/rooms/inventory": ["roomInventory"],
  "/admin/offline-inventory": ["offlineRooms"],

  // Users, institutions, temples.
  "/admin/manage/users": ["users"],
  "/admin/manage/institution": ["institution"],
  "/admin/manage/institution_contacts": ["institutionContacts"],
  "/admin/manage/institution_locations": ["institutionLocations"],
  "/admin/manage/institution_audits": ["institutionAudits"],
  "/admin/temples": ["temples", "templeAartis", "templeFestivals"],

  // Stays, bookings, offers.
  "/admin/manage/ashrams": ["stays"],
  "/admin/verifications": ["stays"],
  "/admin/manage/bookings": ["bookings"],
  "/admin/bookings/front-desk": ["bookings"],
  "/admin/manage/offers": ["offers"],

  // Aarti and live pooja.
  "/admin/manage/aarti_sessions": ["aartiSessions"],
  "/admin/manage/aarti_streams": ["livePooja"],
  "/admin/manage/aarti_pass_types": ["aartiPassTypes"],
  "/admin/manage/aarti_payments": ["aartiPayments"],
  "/admin/manage/aarti_reviews": ["aartiReviews"],
  "/admin/manage/aarti_staff": ["aartiStaff"],
  "/admin/aarti/bookings": ["aarti"],
  "/admin/aarti/approvals/aarti": ["aartiSessions"],
  "/admin/aarti/approvals/live-pooja": ["livePooja"],

  // Events.
  "/admin/manage/event_festivals": ["events"],
  "/admin/manage/event_registrations": ["eventRegistrations"],
  "/admin/manage/event_staff": ["eventStaff"],
  "/admin/events/approvals": ["events"],
  "/admin/events/registrations": ["eventRegistrations"],

  // Pilgrimage.
  "/admin/manage/pilgrimage_circuits": ["pilgrimage"],
  "/admin/manage/pilgrimage_itineraries": ["itineraries"],
  "/admin/manage/pilgrimage_stops": ["pilgrimageStops"],
  "/admin/manage/planner/circuits": ["pilgrimage"],
  "/admin/manage/planner/itineraries": ["itineraries"],
  "/admin/circuits/approvals": ["pilgrimage"],

  // Parking.
  "/admin/manage/parking_bookings": ["parking"],
  "/admin/manage/parking_partners": ["parkingPartners"],
  "/admin/manage/parking_locations": ["parkingLocations"],
  "/admin/manage/parking_slots": ["parkingSlots"],
  "/admin/manage/parking_transactions": ["parkingTransactions"],
  "/admin/manage/parking_reviews": ["parkingReviews"],

  // Content, marketplace, local services.
  "/admin/manage/blogs/all": ["content"],
  "/admin/manage/blogs/authors": ["blogAuthors"],
  "/admin/manage/blogs/categories": ["content"],
  "/admin/articles": ["community"],
  "/admin/manage/banner": ["banners"],
  "/admin/manage/featured_banner": ["banners"],
  "/admin/manage/local": ["localServices", "serviceProviders"],
  "/admin/manage/marketplace/orders": ["marketplace"],
  "/admin/manage/marketplace/products": ["marketplaceProducts"],
  "/admin/manage/marketplace/categories": ["marketplaceCategories"],
  "/admin/manage/marketplace/waitlist": ["marketplaceWaitlist"],

  // Money, governance, audit.
  "/admin/refunds/policies": ["refunds"],
  "/admin/audit-logs": ["audit"],
  "/admin/manage/reports": ["audit"],
  "/admin/volunteer": ["volunteer", "volunteerApplications"],
  "/admin/smart-contacts/analytics": ["smartContact"],

  // Owner-side routes, across all three of its base paths.
  "/owner/rooms": ["roomCategories"],
  "/ashram-admin/rooms": ["roomCategories"],
  "/ashram-owner/rooms": ["roomCategories"],
  "/owner/calendar": ["roomAvailability"],
  "/ashram-admin/calendar": ["roomAvailability"],
  "/ashram-owner/calendar": ["roomAvailability"],
  "/owner/bookings": ["bookings"],
  "/ashram-admin/bookings": ["bookings"],
  "/ashram-owner/bookings": ["bookings"],
  "/owner/ashrams": ["stays"],
  "/ashram-admin/ashrams": ["stays"],
  "/ashram-owner/ashrams": ["stays"],
  "/owner/offers": ["offers"],
  "/ashram-admin/offers": ["offers"],
  "/ashram-owner/offers": ["offers"],
  "/owner/aarti": ["aartiSessions", "aarti"],
  "/ashram-admin/aarti": ["aartiSessions", "aarti"],
  "/ashram-owner/aarti": ["aartiSessions", "aarti"],
  "/owner/events": ["events", "eventRegistrations"],
  "/ashram-admin/events": ["events", "eventRegistrations"],
  "/ashram-owner/events": ["events", "eventRegistrations"],
  "/owner/live-pooja": ["livePooja"],
  "/ashram-admin/live-pooja": ["livePooja"],
  "/ashram-owner/live-pooja": ["livePooja"],
  "/owner/volunteer": ["volunteer", "volunteerApplications"],
  "/ashram-admin/volunteer": ["volunteer", "volunteerApplications"],
  "/ashram-owner/volunteer": ["volunteer", "volunteerApplications"],
};

/**
 * Pages that already build their own summary from richer, page-specific data.
 * Adding a strip above them would show the same numbers twice, so these opt
 * out entirely — Total Rooms above all, which is the whole-estate summary and
 * is meant to stay the one place that reports it.
 */
const SELF_SUMMARISING_PATHS = [
  "/admin/manage/rooms/total",
  "/owner/total-rooms",
  "/ashram-admin/total-rooms",
  "/ashram-owner/total-rooms",
  "/admin/refunds",
  "/admin/payouts",
  "/owner/payouts",
  "/ashram-admin/payouts",
  "/ashram-owner/payouts",
  "/admin/parking/control",
  "/admin/aarti/control",
  "/admin/events/control",
  "/admin/circuits/control",
  "/admin/lead-collection/leads",
  "/admin/smart-contacts",
  "/admin/enterprise-notifications",
  "/owner/offline-inventory",
  "/ashram-admin/offline-inventory",
  "/ashram-owner/offline-inventory",
];

const matches = (pathname: string, path: string): boolean =>
  pathname === path || pathname.startsWith(path + "/");

const ownsItsSummary = (pathname: string): boolean =>
  SELF_SUMMARISING_PATHS.some((path) => matches(pathname, path));

/**
 * The sections belonging to this exact link. A page that summarises itself, or
 * one with no module of its own, gets none — never another module's cards.
 */
export const sectionKeysFor = (pathname: string): string[] => {
  if (ownsItsSummary(pathname)) return [];

  const match = Object.keys(PATH_SECTIONS)
    .filter((path) => matches(pathname, path))
    .sort((a, b) => b.length - a.length)[0];

  return match ? PATH_SECTIONS[match] : [];
};

/**
 * Column counts that divide the tile count exactly, so a row is never left
 * with a gap or a stretched orphan. Only divisors are used: five tiles go
 * one-then-five rather than three-then-two, because 3+2 leaves a hole on the
 * second row. Cards fill the full width evenly at every breakpoint.
 */
const GRID_BY_COUNT: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 md:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
};

export const gridClassFor = (count: number): string =>
  GRID_BY_COUNT[count] ?? "grid-cols-2 md:grid-cols-3 xl:grid-cols-6";
