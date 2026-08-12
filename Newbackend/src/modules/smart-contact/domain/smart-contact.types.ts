import type {
  SmartContactBrand,
  SmartContactCategory,
  SmartContactDeviceType,
  SmartContactEventType,
  SmartContactQrFormat,
  SmartContactQrSource,
  SmartContactStatus,
} from "./smart-contact.constants";

/**
 * The shape a Smart Contact profile takes once it leaves the persistence
 * layer. Declared independently of the Mongoose document so the services and
 * controllers never depend on the storage engine — the specification's §45
 * assumes PostgreSQL, and this module runs on Mongo, which only stays a
 * detail if nothing above `infrastructure/` knows either way.
 */
export interface SmartContactProfileView {
  id: string;
  uuid: string;
  employeeId: string;
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  organization: string;
  designation: string;
  department: string;
  roleLine: string;
  primaryPhone: string;
  secondaryPhone: string;
  whatsappPhone: string;
  email: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  postalCode: string;
  country: string;
  photoUrl: string;
  photoAssetId: string;
  brandId: SmartContactBrand;
  category: SmartContactCategory;
  status: SmartContactStatus;
  profileUrl: string;
  createdBy: ActorRef | null;
  updatedBy: ActorRef | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The public projection (spec §34). A strict subset of the admin view: no
 * actor identities, no timestamps, no internal ids. Privacy (spec §38) is
 * enforced by what this interface omits, not by what the page chooses to
 * render.
 */
export interface SmartContactPublicView {
  slug: string;
  displayName: string;
  organization: string;
  designation: string;
  department: string;
  roleLine: string;
  primaryPhone: string;
  secondaryPhone: string;
  whatsappPhone: string;
  email: string;
  website: string;
  officeAddress: string;
  city: string;
  state: string;
  country: string;
  photoUrl: string;
  brandId: SmartContactBrand;
  status: SmartContactStatus;
  isActive: boolean;
  profileUrl: string;
  vcardUrl: string;
  /** Present only when the profile is not ACTIVE (spec §22). */
  inactiveNotice?: {
    message: string;
    contactEmail: string;
  };
}

/** A platform identity, denormalised. Never a ref — see the schema comment. */
export interface ActorRef {
  id: string;
  name: string;
}

export interface SmartContactQrView {
  id: string;
  profileId: string;
  qrIdentifier: string;
  destinationUrl: string;
  source: SmartContactQrSource;
  formats: SmartContactQrFormat[];
  status: string;
  downloadUrls: Record<SmartContactQrFormat, string>;
  createdBy: ActorRef | null;
  createdAt: string;
}

/** Context derived from the request for one analytics event (spec §26, §27). */
export interface EventContext {
  sessionHash: string;
  deviceType: SmartContactDeviceType;
  browser: string;
  os: string;
  country: string;
  state: string;
  city: string;
  referrer: string;
  source: string;
  ip: string;
}

export interface AnalyticsTotals {
  profileViews: number;
  qrScans: number;
  uniqueVisitors: number;
  saveContactClicks: number;
  vcardDownloads: number;
  callClicks: number;
  whatsappClicks: number;
  emailClicks: number;
  websiteClicks: number;
  directionsClicks: number;
  /** saveContact / profileViews × 100, per spec §24. */
  conversionRate: number;
}

export interface AnalyticsSeriesPoint {
  date: string;
  qrScans: number;
  profileViews: number;
  saveContacts: number;
}

export interface AnalyticsBreakdownRow {
  key: string;
  count: number;
}

export interface SmartContactAnalyticsView {
  range: { from: string; to: string; preset: string };
  totals: AnalyticsTotals;
  series: AnalyticsSeriesPoint[];
  actionDistribution: Record<SmartContactEventType, number>;
  devices: AnalyticsBreakdownRow[];
  geography: AnalyticsBreakdownRow[];
  sources: AnalyticsBreakdownRow[];
  referrers: AnalyticsBreakdownRow[];
  /** Funnel stages per spec §51, each with conversion from the previous. */
  funnel: { stage: string; count: number; conversionFromPrevious: number }[];
}
