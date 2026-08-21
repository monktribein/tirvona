import type {
  SmartContactBrand,
  SmartContactCategory,
  SmartContactDeviceType,
  SmartContactEventType,
  SmartContactQrFormat,
  SmartContactQrSource,
  SmartContactStatus,
} from "./smart-contact.constants";

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
  inactiveNotice?: {
    message: string;
    contactEmail: string;
  };
}

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
  funnel: { stage: string; count: number; conversionFromPrevious: number }[];
}
