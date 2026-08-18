import api, { API_BASE_URL, TOKEN_KEY } from "../lib/api";

/**
 * Super-admin console client for Smart Contact QR.
 *
 * Everything here goes through the platform's own bearer token — these are
 * Tirvona staff routes. The public contact page has its own tiny client inside
 * the `SmarID/` app and shares nothing with this file.
 */

export type SmartContactStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SUSPENDED"
  | "ARCHIVED";

export type SmartContactCategory =
  | "employee"
  | "partner"
  | "district-partner"
  | "other";

export type SmartContactQrSource =
  | "business-card"
  | "id-card"
  | "brochure"
  | "exhibition"
  | "event"
  | "poster"
  | "digital"
  | "other";

export type SmartContactQrFormat = "svg" | "png" | "pdf";

export interface SmartContactProfile {
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
  brandId: string;
  category: SmartContactCategory;
  status: SmartContactStatus;
  profileUrl: string;
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  /** Joined in by the list endpoint only. */
  metrics?: SmartContactMetrics;
}

export interface SmartContactMetrics {
  profileViews: number;
  qrScans: number;
  saveContacts: number;
  conversionRate: number;
}

export interface SmartContactQr {
  id: string;
  profileId: string;
  qrIdentifier: string;
  destinationUrl: string;
  source: SmartContactQrSource;
  formats: SmartContactQrFormat[];
  status: string;
  downloadUrls: Record<SmartContactQrFormat, string>;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface SmartContactAuditEntry {
  id: string;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
  actor: { id: string; name: string } | null;
  ip: string;
  createdAt: string;
}

export interface SmartContactAnalytics {
  range: { from: string; to: string; preset: string };
  totals: {
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
  };
  series: {
    date: string;
    qrScans: number;
    profileViews: number;
    saveContacts: number;
  }[];
  actionDistribution: Record<string, number>;
  devices: { key: string; count: number }[];
  geography: { key: string; count: number }[];
  sources: { key: string; count: number }[];
  referrers: { key: string; count: number }[];
  funnel: { stage: string; count: number; conversionFromPrevious: number }[];
}

export interface SmartContactStats {
  profiles: Record<string, number>;
  events: Record<string, number>;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

const BASE = "/v1/admin/smart-contacts";

/**
 * QR artwork comes back as binary, not JSON, and the routes are behind the
 * admin bearer token — so a plain `<a href>` cannot fetch it (the browser
 * sends no Authorization header on a navigation). These helpers pull the bytes
 * through the authenticated client and hand the caller a blob URL to click.
 */
const downloadBlob = async (url: string, filename: string): Promise<void> => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` },
  });
  if (!response.ok) throw new Error("Could not download the QR artwork.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in Safari; one tick is enough.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

/**
 * `qr` renders the bare symbol, for dropping into an existing card design.
 * `card` renders the finished 88×55mm contact card with the identity laid out
 * around it — SVG and PDF only, since flattening that layout to PNG would need
 * a server-side SVG rasteriser.
 */
export type QrLayout = "qr" | "card";

export interface QrRenderOptions {
  layout?: QrLayout;
  size?: number;
  caption?: string;
  frame?: boolean;
  logo?: boolean;
  photo?: boolean;
}

export const qrQuery = (options: QrRenderOptions): string => {
  const params = new URLSearchParams();
  if (options.layout === "card") params.set("layout", "card");
  if (options.size) params.set("size", String(options.size));
  if (options.caption) params.set("caption", options.caption);
  if (options.frame) params.set("frame", "true");
  if (options.logo) params.set("logo", "true");
  if (options.photo) params.set("photo", "true");
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const smartContactService = {
  // ── Profiles ──
  list: (params: Record<string, string | number> = {}) =>
    api.get<{ data: Paged<SmartContactProfile> }>(BASE, { params }),
  stats: () => api.get<{ data: SmartContactStats }>(`${BASE}/stats`),
  get: (id: string) =>
    api.get<{ data: { profile: SmartContactProfile; qrCodes: SmartContactQr[] } }>(
      `${BASE}/${id}`,
    ),
  create: (data: unknown) => api.post(BASE, data),
  update: (id: string, data: unknown) => api.put(`${BASE}/${id}`, data),

  // ── Lifecycle. Archive is the normal end state: spec §22 keeps a profile
  //    resolving for as long as its printed cards are circulating. ──
  activate: (id: string) => api.post(`${BASE}/${id}/activate`),
  disable: (id: string) => api.post(`${BASE}/${id}/disable`),
  archive: (id: string) => api.post(`${BASE}/${id}/archive`),

  /**
   * Permanent bulk deletion — super-admin only, and the one call here that
   * really removes a profile. A freed slug stops resolving, so any printed QR
   * carrying it dies; the response reports how many QR assets that affected.
   */
  bulkDelete: (ids: string[]) =>
    api.post<{
      message: string;
      data: {
        deleted: number;
        requested: number;
        printedQrCodes: number;
        slugs: string[];
      };
    }>(`${BASE}/bulk-delete`, { ids }),

  // ── QR assets ──
  listQr: (id: string) => api.get<{ data: SmartContactQr[] }>(`${BASE}/${id}/qr`),
  generateQr: (
    id: string,
    data: { source?: string; formats?: string[]; label?: string },
  ) => api.post<{ data: SmartContactQr }>(`${BASE}/${id}/qr`, data),
  retireQr: (id: string, qrId: string) =>
    api.post(`${BASE}/${id}/qr/${qrId}/retire`),

  /** Inline preview markup for the console, without registering an asset. */
  previewQrUrl: (id: string, format: SmartContactQrFormat = "svg") =>
    `${API_BASE_URL}/api${BASE}/${id}/qr-preview/${format}`,

  downloadPreview: (
    id: string,
    format: SmartContactQrFormat,
    filename: string,
    options: QrRenderOptions = {},
  ) =>
    downloadBlob(
      `${API_BASE_URL}/api${BASE}/${id}/qr-preview/${format}${qrQuery(options)}`,
      `${filename}.${format}`,
    ),

  downloadAsset: (
    id: string,
    qrId: string,
    format: SmartContactQrFormat,
    filename: string,
    options: QrRenderOptions = {},
  ) =>
    downloadBlob(
      `${API_BASE_URL}/api${BASE}/${id}/qr/${qrId}/download/${format}${qrQuery(options)}`,
      `${filename}.${format}`,
    ),

  // ── Analytics & audit ──
  analytics: (id: string, params: Record<string, string> = {}) =>
    api.get<{ data: SmartContactAnalytics }>(`${BASE}/${id}/analytics`, { params }),
  audit: (id: string) =>
    api.get<{ data: SmartContactAuditEntry[] }>(`${BASE}/${id}/audit`),
  vcardPreview: (id: string) =>
    api.get<{ data: { vcard: string } }>(`${BASE}/${id}/vcard-preview`),
};
