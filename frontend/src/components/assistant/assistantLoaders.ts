/**
 * Read-only loaders for the Tirvona assistant. Every record comes from an
 * existing service in `src/services` or `src/modules/*`, which means the same
 * authenticated API calls the pages use. Nothing here writes, pays, cancels or
 * books; each result either shows data or links to the page that does the work.
 */
import { ashramService, bookingService, offerService, templeService } from "../../services";
import { foodService } from "../../services/food.service";
import { supportApi, supportAdminApi } from "../../services/support.service";
import { walletService } from "../../services/wallet.service";
import { volunteerService } from "../../services/volunteer.service";
import {
  checkoutApi,
  marketplaceAdminApi,
  storeApi,
  toStoreProduct,
  vendorApi,
} from "../../services/marketplace.service";
import {
  consultationService,
  providerPublicService,
  pujaBookingService,
  ritualCatalogService,
} from "../../modules/pandit";
import { eventDiscoveryService, eventRegistrationService } from "../../modules/events/services/event.service";
import {
  aartiBookingService,
  aartiDiscoveryService,
  livePoojaService,
} from "../../modules/aarti/services/aarti.service";
import {
  parkingBookingService,
  parkingDiscoveryService,
} from "../../modules/parking/services/parking.service";
import { pilgrimageDiscoveryService } from "../../modules/pilgrimage/services/pilgrimage.service";
import api from "../../lib/api";
import { ashramUrl, bookingUrl } from "../../lib/urls";
import { formatCurrency } from "../../utils/format";
import type { Loader, ResultItem, ResultSet } from "./assistantTypes";

const PAGE = 8;

/**
 * Filter choices (destinations, categories, cities...) change rarely and are asked for every time a
 * screen opens, so they are kept for a minute. Results are never cached: they are read fresh each time.
 * A failed read is not remembered.
 */
const OPTIONS_TTL_MS = 60_000;
const optionCache = new Map<string, { at: number; value: Promise<any> }>();
export const freshOptions = <T>(key: string, read: () => Promise<T>): Promise<T> => {
  const hit = optionCache.get(key);
  if (hit && Date.now() - hit.at < OPTIONS_TTL_MS) return hit.value;
  const value = read().catch((err) => {
    optionCache.delete(key);
    throw err;
  });
  optionCache.set(key, { at: Date.now(), value });
  return value;
};

const inr = (amount: unknown) => formatCurrency(Number(amount ?? 0), "INR");
const paise = (amount: unknown) => inr(Number(amount ?? 0) / 100);

const text = (...values: unknown[]): string => {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const humanize = (value: unknown) =>
  String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

const day = (value: unknown) => {
  if (!value) return "";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const dayRange = (from: unknown, to: unknown) => {
  const a = day(from);
  const b = day(to);
  return a && b && a !== b ? `${a} – ${b}` : a || b;
};

const place = (...parts: unknown[]) => parts.map((p) => text(p)).filter(Boolean).join(", ");

const compact = (items: Array<string | undefined | false | null>): string[] =>
  items.filter((v): v is string => Boolean(v));

/** The list inside the many envelopes the API uses: `[]`, `{data: []}`, `{data: {data: []}}`, `{items: []}`. */
const rowsOf = (body: any, depth = 0): any[] => {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object" || depth > 2) return [];
  for (const key of ["data", "items", "results", "rows", "outlets", "meals", "sessions", "events", "circuits"]) {
    const inner = body[key];
    if (Array.isArray(inner)) return inner;
    if (inner && typeof inner === "object") {
      const nested = rowsOf(inner, depth + 1);
      if (nested.length) return nested;
    }
  }
  return [];
};

const totalOf = (body: any, fallback: number): number => {
  const candidates = [body?.total, body?.meta?.total, body?.data?.total, body?.pagination?.total];
  const found = candidates.find((v) => typeof v === "number" && Number.isFinite(v));
  return typeof found === "number" ? found : fallback;
};

const queryString = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

const result = (items: ResultItem[], body: any, rest: Partial<ResultSet> = {}): ResultSet => ({
  items,
  total: totalOf(body, items.length),
  ...rest,
});


// ── Stays & ashrams ──────────────────────────────────────────────────────────

const stayItem = (a: any, search: Record<string, string | undefined>): ResultItem => {
  const price = a.lowestNightPrice;
  const rating = Number(a.rating?.average);
  return {
    id: String(a._id ?? a.id),
    title: text(a.name, "Stay"),
    subtitle: place(a.address?.city, a.address?.state),
    meta: compact([
      a.type ? humanize(a.type) : undefined,
      price != null ? `From ${inr(price)}/night` : undefined,
      rating > 0 ? `${rating.toFixed(1)} ★` : undefined,
    ]),
    to: ashramUrl(a, queryString(search)),
  };
};

export const findStays: Loader = async (_ctx, v) => {
  const params: Record<string, string> = { verified: "true", limit: String(PAGE) };
  if (v.destination) params.destination = v.destination;
  if (v.type) params.type = v.type;
  if (v.checkIn) params.checkIn = v.checkIn;
  if (v.checkOut) params.checkOut = v.checkOut;
  if (v.guests) params.guests = v.guests;
  const res = await ashramService.search(params);
  const rows = rowsOf(res.data);
  const link = queryString({
    destination: v.destination,
    type: v.type,
    checkIn: v.checkIn,
    checkOut: v.checkOut,
    guests: v.guests,
  });
  return result(
    rows.slice(0, PAGE).map((a) => stayItem(a, { checkIn: v.checkIn, checkOut: v.checkOut, guests: v.guests })),
    res.data,
    {
      emptyText: v.checkIn
        ? "No stays have rooms for those dates. Try other dates or another destination."
        : "No stays found for this selection.",
      links: [{ label: "See all matching stays", to: `/stays${link}` }],
      note: v.checkIn ? "Open a stay to see its rooms and live availability for your dates." : undefined,
    },
  );
};

export const stayDestinations: Loader = async () => {
  const res = await ashramService.destinations();
  const rows = rowsOf(res.data);
  return {
    items: rows.map((d) => ({
      id: String(d.city),
      title: text(d.city),
      subtitle: text(d.state),
      meta: [`${Number(d.count ?? 0)} stays`],
      to: `/ashrams/${slugify(text(d.city))}`,
    })),
    total: rows.length,
    emptyText: "No destinations are listed yet.",
  };
};

export const myStayBookings: Loader = async () => {
  const res = await bookingService.history();
  const rows = rowsOf(res.data);
  return {
    items: rows.slice(0, PAGE).map((b) => {
      const ashram = b.ashramId && typeof b.ashramId === "object" ? b.ashramId : null;
      return {
        id: String(b._id),
        title: text(ashram?.name, "Stay booking"),
        subtitle: dayRange(b.checkInDate, b.checkOutDate),
        meta: compact([
          text(b.bookingId),
          b.pricing?.totalAmount != null ? inr(b.pricing.totalAmount) : undefined,
          b.paymentStatus ? `Payment ${humanize(b.paymentStatus)}` : undefined,
        ]),
        badge: humanize(b.status),
        to: bookingUrl(b),
      };
    }),
    total: rows.length,
    emptyText: "You have no stay bookings yet.",
    links: [{ label: "All my bookings", to: "/profile/bookings" }],
  };
};

export const ownerProperties: Loader = async () => {
  const res = await ashramService.myListings();
  const rows = rowsOf(res.data);
  return {
    items: rows.map((a) => ({
      id: String(a._id ?? a.id),
      title: text(a.name, "Property"),
      subtitle: place(a.address?.city, a.address?.state),
      meta: compact([a.type ? humanize(a.type) : undefined]),
      badge: a.status ? humanize(a.status) : undefined,
    })),
    total: rows.length,
    emptyText: "No properties are linked to your account.",
  };
};

// ── Pandit services ──────────────────────────────────────────────────────────

export const ritualOptions = () => freshOptions("rituals", readRituals);
const readRituals = async () => {
  const res = await ritualCatalogService.list({ page: 1 });
  return rowsOf(res.data).map((r: any) => ({
    value: String(r.id),
    label: text(r.titles?.en, Object.values(r.titles ?? {})[0], r.name, r.slug),
  }));
};

export const findPandits: Loader = async (_ctx, v) => {
  const res = await providerPublicService.search({
    q: v.q || undefined,
    ritual: v.ritual || undefined,
    city: v.city || undefined,
    limit: PAGE,
    page: 1,
  });
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((p) => ({
      id: String(p.id),
      title: text(p.displayName, "Pandit"),
      subtitle: place(p.homeCity, p.homeState),
      meta: compact([
        p.experienceYears ? `${p.experienceYears} yrs experience` : undefined,
        Array.isArray(p.languages) && p.languages.length ? p.languages.slice(0, 3).join(", ") : undefined,
        p.offerings?.minFeeMinor != null ? `From ${paise(p.offerings.minFeeMinor)}` : undefined,
      ]),
      badge: p.verificationLevel ? humanize(p.verificationLevel) : undefined,
      to: `/pandit/${p.slug || p.id}`,
    })),
    res.data?.meta ?? res.data,
    {
      emptyText: "No pandits match this selection.",
      links: [{ label: "Open the full directory", to: `/pandits${queryString({ q: v.q, ritual: v.ritual, city: v.city })}` }],
    },
  );
};

export const pujaServices: Loader = async (_ctx, v) => {
  const res = await ritualCatalogService.list({ q: v.q || undefined, page: 1 });
  const rows = rowsOf(res.data);
  return {
    items: rows.slice(0, PAGE).map((r) => ({
      id: String(r.id),
      title: text(r.titles?.en, Object.values(r.titles ?? {})[0], r.name, r.slug, "Puja"),
      subtitle: text(r.category) ? humanize(r.category) : undefined,
      meta: Array.isArray(r.variants) && r.variants.length ? [`${r.variants.length} options`] : undefined,
      to: `/pandits?ritual=${encodeURIComponent(String(r.id))}`,
    })),
    total: totalOf(res.data, rows.length),
    emptyText: "No puja services are published yet.",
    note: "Choose a service to see the pandits who perform it.",
  };
};

const pujaBookingItem = (b: any): ResultItem => {
  const snap = b.serviceSnapshot ?? {};
  const offering = b.offering ?? snap.offering;
  const ritual = b.ritual ?? snap.ritual;
  const provider = b.provider ?? snap.provider;
  const totalMinor = (b.pricing ?? snap.pricing)?.totalMinor;
  return {
    id: String(b.id ?? b._id),
    title: text(offering?.title, ritual?.titles?.en, "Vedic puja"),
    subtitle: text(provider?.displayName),
    meta: compact([
      b.bookingNumber ? String(b.bookingNumber) : undefined,
      day(b.scheduledStartAt),
      totalMinor != null ? paise(totalMinor) : undefined,
    ]),
    badge: humanize(b.status),
  };
};

export const myPujaBookings: Loader = async () => {
  const res = await pujaBookingService.listMine();
  const rows = rowsOf(res.data);
  return {
    items: rows.slice(0, PAGE).map((b) => ({ ...pujaBookingItem(b), to: "/profile/bookings" })),
    total: rows.length,
    emptyText: "You have not booked a puja yet.",
  };
};

export const myConsultations: Loader = async () => {
  const res = await consultationService.mine({ limit: PAGE });
  const rows = rowsOf(res.data);
  return {
    items: rows.slice(0, PAGE).map((c) => ({
      id: String(c.id ?? c._id),
      title: text(c.provider?.displayName, c.providerName, "Consultation"),
      subtitle: day(c.scheduledStartAt ?? c.startAt ?? c.createdAt),
      badge: c.status ? humanize(c.status) : undefined,
    })),
    total: totalOf(res.data, rows.length),
    emptyText: "You have no consultations.",
  };
};

export const providerBookings: Loader = async () => {
  const res = await pujaBookingService.list({ role: "provider" });
  const rows = rowsOf(res.data);
  return {
    items: rows.slice(0, PAGE).map((b) => ({ ...pujaBookingItem(b), to: "/provider/bookings" })),
    total: rows.length,
    emptyText: "No puja requests for your profile yet.",
    note: "Only bookings made with your own pandit profile are returned.",
  };
};

// ── Marketplace ──────────────────────────────────────────────────────────────

const flatCategories = (tree: any[]): any[] => tree.flatMap((c) => [c, ...flatCategories(c.children ?? [])]);

const categoryTree = () => freshOptions("market-categories", async () => rowsOf((await storeApi.categories()).data));

export const marketCategoryOptions = async () => {
  return (await categoryTree()).map((c: any) => ({ value: String(c._id), label: text(c.name) }));
};

/** Sub-categories of the chosen category: a dependent dropdown fed by the same category tree. */
export const marketSubCategoryOptions = async (_ctx: unknown, v: Record<string, string>) => {
  if (!v.category) return [];
  const parent = flatCategories(await categoryTree()).find((c) => String(c._id) === v.category);
  return (parent?.children ?? []).map((c: any) => ({ value: String(c._id), label: text(c.name) }));
};

export const browseProducts: Loader = async (_ctx, v) => {
  const res = await storeApi.products({
    categoryId: v.subCategory || v.category || undefined,
    search: v.q || undefined,
    limit: PAGE,
    page: 1,
  });
  const rows = rowsOf(res.data).map(toStoreProduct);
  return result(
    rows.slice(0, PAGE).map((p) => ({
      id: p._id,
      title: p.name,
      subtitle: p.vendor?.name,
      meta: compact([
        inr(p.sellingPrice),
        p.price > p.sellingPrice ? `MRP ${inr(p.price)}` : undefined,
        p.categoryName,
      ]),
      badge: p.inStock ? undefined : "Out of stock",
      to: `/marketplace/products/${p.slug || p._id}`,
    })),
    res.data,
    { emptyText: "No products match this selection.", links: [{ label: "Open the marketplace", to: "/marketplace" }] },
  );
};

export const marketCategories: Loader = async () => {
  const res = await storeApi.categories();
  const rows = rowsOf(res.data);
  return {
    items: rows.map((c) => ({
      id: String(c._id),
      title: text(c.name),
      subtitle: text(c.description),
      meta: Array.isArray(c.children) && c.children.length ? [`${c.children.length} sub-categories`] : undefined,
      to: `/marketplace/category/${c.slug}`,
    })),
    total: rows.length,
    emptyText: "No categories are published yet.",
  };
};

export const cartContents: Loader = async (ctx) => {
  const lines = ctx.cart;
  if (!lines.length) {
    return { items: [], emptyText: "Your cart is empty.", links: [{ label: "Browse products", to: "/marketplace" }] };
  }
  const subtotal = lines.reduce((sum, l) => sum + l.displayPrice * l.quantity, 0);
  return {
    items: lines.map((l) => ({
      id: l.productId,
      title: l.name,
      meta: [`Qty ${l.quantity}`, inr(l.displayPrice * l.quantity)],
    })),
    stats: [{ label: "Subtotal (before shipping and tax)", value: inr(subtotal) }],
    note: "Final prices are confirmed at checkout.",
    links: [{ label: "Open my cart", action: "openCart" }],
  };
};

export const myMarketOrders: Loader = async () => {
  const res = await checkoutApi.orders({ limit: PAGE });
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((o) => ({
      id: String(o._id),
      title: text(o.orderNumber, "Order"),
      subtitle: day(o.createdAt),
      meta: compact([
        o.pricing?.totalAmount != null ? inr(o.pricing.totalAmount) : undefined,
        o.paymentStatus ? `Payment ${humanize(o.paymentStatus)}` : undefined,
      ]),
      badge: humanize(o.status),
      to: "/profile/orders",
    })),
    res.data,
    { emptyText: "You have not placed a marketplace order yet." },
  );
};

export const sellerSummary: Loader = async () => {
  const res = await vendorApi.dashboard();
  const d = res.data?.data;
  if (!d?.store) return { emptyText: "No seller store is linked to your account.", links: [{ label: "Become a seller", to: "/vendor/onboarding" }] };
  return {
    note: `${text(d.store.storeName)} · ${humanize(d.store.status)}`,
    stats: [
      { label: "Orders today", value: String(d.orders?.today ?? 0) },
      { label: "Orders pending", value: String(d.orders?.pending ?? 0) },
      { label: "Live products", value: String(d.products?.live ?? 0) },
      { label: "Low stock", value: String(d.products?.lowStock ?? 0) },
      { label: "Gross sales", value: inr(d.sales?.gross) },
      { label: "Wallet available", value: inr(d.wallet?.available) },
    ],
    links: [{ label: "Open seller dashboard", to: "/vendor/dashboard" }],
  };
};

export const sellerProducts: Loader = async () => {
  const res = await vendorApi.products({ limit: PAGE });
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((p) => ({
      id: String(p._id),
      title: text(p.name),
      meta: compact([
        p.sellingPrice != null ? inr(p.sellingPrice) : undefined,
        p.stock != null ? `Stock ${p.stock}` : undefined,
      ]),
      badge: p.status ? humanize(p.status) : undefined,
      to: `/vendor/products/${p._id}`,
    })),
    res.data,
    { emptyText: "You have no products yet.", links: [{ label: "Manage products", to: "/vendor/products" }] },
  );
};

export const sellerOrders: Loader = async () => {
  const res = await vendorApi.orders({ limit: PAGE });
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((o) => ({
      id: String(o._id),
      title: text(o.vendorOrderNumber, "Store order"),
      subtitle: day(o.createdAt),
      meta: compact([o.total != null ? inr(o.total) : undefined]),
      badge: o.fulfillmentStatus ? humanize(o.fulfillmentStatus) : undefined,
      to: "/vendor/orders",
    })),
    res.data,
    { emptyText: "No orders for your store yet." },
  );
};

// ── Food ─────────────────────────────────────────────────────────────────────

export const foodZoneOptions = () => freshOptions("food-zones", readZones);
const readZones = async () => {
  const zones = await foodService.getZones();
  return (Array.isArray(zones) ? zones : []).map((z: any) => ({
    value: text(z.code, z.id),
    label: text(z.name, z.label, z.code),
  }));
};

export const foodOutlets: Loader = async (_ctx, v) => {
  const d = await foodService.getDiscovery({ zoneCode: v.zone || undefined, search: v.q || undefined });
  const rows = Array.isArray(d?.outlets) ? d.outlets : [];
  return {
    items: rows.slice(0, PAGE).map((o: any) => ({
      id: o.id,
      title: text(o.brandName, "Restaurant"),
      subtitle: text(o.address),
      meta: compact([
        o.rating ? `${Number(o.rating).toFixed(1)} ★` : undefined,
        o.avgPrepMinutes ? `~${o.avgPrepMinutes} min` : undefined,
        o.minOrderPaise ? `Min order ${paise(o.minOrderPaise)}` : undefined,
        text(o.openTime) && text(o.closeTime) ? `${o.openTime} – ${o.closeTime}` : undefined,
      ]),
      badge: o.isPaused ? "Paused" : undefined,
      to: "/food",
    })),
    total: rows.length,
    emptyText: "No restaurants serve this area right now.",
    links: [{ label: "Open Tirvona Bhojan", to: "/food" }],
  };
};

export const foodMenu: Loader = async (_ctx, v) => {
  const d = await foodService.getDiscovery({
    zoneCode: v.zone || undefined,
    family: v.family || undefined,
    dietaryTag: v.diet || undefined,
    search: v.q || undefined,
  });
  const rows = Array.isArray(d?.meals) ? d.meals : [];
  return {
    items: rows.slice(0, PAGE).map((m: any) => ({
      id: m.id,
      title: text(m.label, m.canonicalName, "Meal"),
      subtitle: text(m.contents),
      meta: compact([
        m.priceRupees != null ? inr(m.priceRupees) : m.pricePaise != null ? paise(m.pricePaise) : undefined,
        m.family ? humanize(m.family) : undefined,
        m.prepMinutes ? `${m.prepMinutes} min` : undefined,
        Array.isArray(m.dietaryTags) && m.dietaryTags.length ? m.dietaryTags.map(humanize).join(", ") : undefined,
      ]),
      badge: m.isAvailable === false ? "Unavailable" : undefined,
      to: "/food",
    })),
    total: rows.length,
    emptyText: "No meals match this selection.",
    links: [{ label: "Order on Tirvona Bhojan", to: "/food" }],
  };
};

export const myFoodOrders: Loader = async () => {
  const rows = await foodService.getCustomerOrders();
  const list = Array.isArray(rows) ? rows : [];
  return {
    items: list.slice(0, PAGE).map((o: any) => ({
      id: String(o._id),
      title: text(o.orderNumber, "Food order"),
      subtitle: text(o.outletId?.brandName),
      meta: compact([
        day(o.createdAt),
        o.totalRupees != null ? inr(o.totalRupees) : o.totalPaise != null ? paise(o.totalPaise) : undefined,
        o.paymentStatus ? `Payment ${humanize(o.paymentStatus)}` : undefined,
      ]),
      badge: humanize(o.orderStatus),
      to: `/food/orders/${o._id}`,
    })),
    total: list.length,
    emptyText: "You have not placed a food order yet.",
  };
};

export const restaurantSummary: Loader = async () => {
  const [stats, outlets] = await Promise.all([
    foodService.getVendorStats().catch(() => null),
    foodService.getVendorOutlets().catch(() => null),
  ]);
  const list = Array.isArray(outlets) ? outlets : [];
  if (!list.length && !stats) {
    return { emptyText: "No restaurant is linked to your account.", links: [{ label: "Restaurant console", to: "/restaurant/dashboard" }] };
  }
  const s = stats ?? {};
  return {
    note: list.length ? list.map((o: any) => text(o.brandName)).filter(Boolean).join(", ") : undefined,
    stats: compact([
      s.pendingAcceptanceCount != null ? `Awaiting acceptance|${s.pendingAcceptanceCount}` : undefined,
      s.preparingCount != null ? `Preparing|${s.preparingCount}` : undefined,
      s.totalSalesRupees != null ? `Total sales|${inr(s.totalSalesRupees)}` : undefined,
      s.estimatedSettlementRupees != null ? `Estimated settlement|${inr(s.estimatedSettlementRupees)}` : undefined,
    ]).map((pair) => {
      const [label, value] = pair.split("|");
      return { label, value };
    }),
    links: [{ label: "Open restaurant console", to: "/restaurant/dashboard" }],
  };
};

// ── Sacred destinations & events ─────────────────────────────────────────────

export const templeList: Loader = async (_ctx, v) => {
  const res = await templeService.list({ q: v.q || undefined, limit: PAGE } as any);
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((t) => ({
      id: String(t._id ?? t.id ?? t.slug),
      title: text(t.name, "Temple"),
      subtitle: place(t.address?.city, t.address?.state),
      meta: compact([text(t.deity), text(t.shortDescription).slice(0, 90)]),
      badge: t.isVerified ? "Verified" : undefined,
      to: `/temples/${t.slug}`,
    })),
    res.data?.data ?? res.data,
    { emptyText: "No temples match this search.", links: [{ label: "All temples", to: "/temples" }] },
  );
};

export const eventCityOptions = () => freshOptions("event-cities", readEventCities);
const readEventCities = async () => {
  const res = await eventDiscoveryService.getCities();
  return rowsOf(res.data).map((c: any) => {
    const name = typeof c === "string" ? c : text(c.city, c.name, c.value);
    return { value: name, label: name };
  });
};

export const eventList: Loader = async (_ctx, v) => {
  const res = await eventDiscoveryService.search({
    q: v.q || undefined,
    city: v.city || undefined,
    date: v.date || undefined,
    limit: PAGE,
  } as any);
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((e) => ({
      id: String(e._id ?? e.id ?? e.slug),
      title: text(e.name, "Event"),
      subtitle: text(e.venue?.name, typeof e.venue === "string" ? e.venue : "", e.venue?.city),
      meta: compact([dayRange(e.startDate, e.endDate), text(e.eventTypeLabel), e.isOnNow ? "On now" : undefined]),
      to: `/events/${e.slug}`,
    })),
    res.data,
    { emptyText: "No events match this selection.", links: [{ label: "All events", to: "/events" }] },
  );
};

export const aartiCityOptions = () => freshOptions("aarti-cities", readAartiCities);
const readAartiCities = async () => {
  const res = await aartiDiscoveryService.getCities();
  return rowsOf(res.data).map((c: any) => {
    const name = typeof c === "string" ? c : text(c.city, c.name, c.value);
    return { value: name, label: name };
  });
};

export const aartiList: Loader = async (_ctx, v) => {
  const res = await aartiDiscoveryService.search({ q: v.q || undefined, city: v.city || undefined, limit: PAGE } as any);
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((s) => ({
      id: String(s._id ?? s.id ?? s.slug),
      title: text(s.name, "Aarti"),
      subtitle: text(s.venue?.name, typeof s.venue === "string" ? s.venue : "", s.venue?.city),
      meta: compact([
        text(s.kindLabel),
        text(s.startTime) ? `Starts ${s.startTime}` : undefined,
        s.fromPrice != null ? `From ${inr(s.fromPrice)}` : undefined,
      ]),
      to: `/aarti/${s.slug || s._id}`,
    })),
    res.data,
    { emptyText: "No aarti sessions match this selection.", links: [{ label: "All aarti sessions", to: "/aarti" }] },
  );
};

export const livePoojaList: Loader = async () => {
  const res = await livePoojaService.wall({ limit: PAGE });
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((s) => ({
      id: String(s._id ?? s.id),
      title: text(s.title, "Live pooja"),
      subtitle: text(s.venueName, place(s.city, s.state)),
      meta: compact([text(s.deity), day(s.startsAt), Number(s.viewCount) > 0 ? `${s.viewCount} views` : undefined]),
      badge: s.isLiveNow ? "Live now" : undefined,
      to: "/live-pooja",
    })),
    res.data,
    { emptyText: "No live pooja is scheduled right now.", links: [{ label: "Open live pooja", to: "/live-pooja" }] },
  );
};

export const circuitList: Loader = async (_ctx, v) => {
  const res = await pilgrimageDiscoveryService.search({ q: v.q || undefined, limit: PAGE } as any);
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((c) => ({
      id: String(c._id ?? c.id ?? c.slug),
      title: text(c.name, "Circuit"),
      subtitle: text(c.summary).slice(0, 110),
      meta: compact([
        text(c.state),
        c.durationDays ? `${c.durationDays} days` : undefined,
        c.stopCount ? `${c.stopCount} stops` : undefined,
        c.totalDistanceKm ? `${c.totalDistanceKm} km` : undefined,
      ]),
      to: `/pilgrimage-circuits/${c.slug}`,
    })),
    res.data,
    { emptyText: "No pilgrimage circuits match this search.", links: [{ label: "All circuits", to: "/pilgrimage-circuits" }] },
  );
};

export const parkingList: Loader = async (_ctx, v) => {
  const res = await parkingDiscoveryService.search({ destination: v.destination || undefined, limit: PAGE } as any);
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((p) => ({
      id: String(p._id ?? p.id ?? p.slug),
      title: text(p.name, "Parking"),
      subtitle: place(p.address?.landmark, p.address?.city),
      meta: compact([
        p.availability?.isConfigured && p.availability?.availableCount != null
          ? `${p.availability.availableCount} spaces free`
          : undefined,
        Number(p.rating?.average) > 0 ? `${Number(p.rating.average).toFixed(1)} ★` : undefined,
      ]),
      badge: p.isVerified ? "Verified" : undefined,
      to: `/parking/${p.slug}`,
    })),
    res.data,
    { emptyText: "No parking found for this destination.", links: [{ label: "All parking", to: "/parking" }] },
  );
};

export const volunteerJobs: Loader = async (_ctx, v) => {
  const res = await volunteerService.getJobs({ city: v.city || undefined, search: v.q || undefined, limit: PAGE });
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((j) => ({
      id: String(j._id),
      title: text(j.title, "Volunteer role"),
      subtitle: text(j.ashramName),
      meta: compact([place(j.city, j.state), text(j.duration), j.accommodation ? "Accommodation" : undefined]),
      to: `/volunteer/job/${j._id}`,
    })),
    res.data,
    { emptyText: "No volunteer roles are open right now.", links: [{ label: "All volunteer roles", to: "/volunteer" }] },
  );
};

// ── Offers & content ─────────────────────────────────────────────────────────

export const publicOffers: Loader = async () => {
  const res = await offerService.getPublicOffers();
  const rows = rowsOf(res.data);
  return {
    items: rows.slice(0, PAGE).map((o) => ({
      id: String(o._id ?? o.id ?? o.promoCode),
      title: text(o.title, o.name, o.promoCode, "Offer"),
      subtitle: text(o.description).slice(0, 110),
      meta: compact([o.promoCode ? `Code ${o.promoCode}` : undefined]),
      to: o.promoCode ? `/offers/${encodeURIComponent(o.promoCode)}` : "/offers",
    })),
    total: rows.length,
    emptyText: "There are no active offers right now.",
    links: [{ label: "All offers", to: "/offers" }],
  };
};

export const blogPosts: Loader = async (_ctx, v) => {
  const res = await api.get("/blog/posts", { params: v.q ? { search: v.q } : {}, skipToast: true } as any);
  const rows = rowsOf(res.data);
  return {
    items: rows.slice(0, PAGE).map((p) => ({
      id: String(p._id ?? p.slug),
      title: text(p.title, "Article"),
      subtitle: text(p.excerpt).slice(0, 120),
      meta: compact([text(p.category), day(p.createdAt)]),
      to: `/blog/${p.slug}`,
    })),
    total: rows.length,
    emptyText: "No articles match this search.",
    links: [{ label: "Open the blog", to: "/blog" }],
  };
};

// ── Wallet, payments & my records ────────────────────────────────────────────

export const walletOverview: Loader = async () => {
  const res = await walletService.summary();
  const w = res.data?.data?.wallet;
  if (!w) return { emptyText: "Your wallet could not be loaded." };
  const recent = res.data?.data?.recent ?? [];
  return {
    stats: [
      { label: "Balance", value: inr(w.balance) },
      { label: "On hold", value: inr(w.heldAmount) },
      { label: "Total credited", value: inr(w.totalCredited) },
      { label: "Total spent", value: inr(w.totalSpent) },
    ],
    items: recent.slice(0, 5).map((t: any) => ({
      id: String(t._id),
      title: text(t.description, humanize(t.category)),
      subtitle: day(t.createdAt),
      meta: [`${t.type === "credit" ? "+" : "−"}${inr(t.amount)}`, humanize(t.module)],
      to: "/profile/wallet",
    })),
    links: [{ label: "Open my wallet", to: "/profile/wallet" }],
  };
};

export const myParkingBookings: Loader = async () => {
  const res = await parkingBookingService.list({ limit: PAGE } as any);
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((b) => {
      const loc = b.locationId && typeof b.locationId === "object" ? b.locationId : null;
      return {
        id: String(b._id),
        title: text(loc?.name, "Parking booking"),
        subtitle: dayRange(b.entryAt, b.exitAt),
        meta: compact([text(b.bookingReference), text(b.vehicleNumber), b.pricing?.totalAmount != null ? inr(b.pricing.totalAmount) : undefined]),
        badge: humanize(b.status),
        to: `/parking/booking/${b._id}`,
      };
    }),
    res.data,
    { emptyText: "You have no parking bookings." },
  );
};

export const myAartiBookings: Loader = async () => {
  const res = await aartiBookingService.list({ limit: PAGE } as any);
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((b) => ({
      id: String(b._id),
      title: text(b.sessionName, b.session?.name, "Aarti booking"),
      subtitle: day(b.bookingDate ?? b.date),
      meta: compact([text(b.bookingReference)]),
      badge: b.status ? humanize(b.status) : undefined,
      to: `/aarti/booking/${b.bookingReference || b._id}`,
    })),
    res.data,
    { emptyText: "You have no aarti bookings.", links: [{ label: "My aarti bookings", to: "/profile/aarti" }] },
  );
};

export const myEventPasses: Loader = async () => {
  const res = await eventRegistrationService.list({ limit: PAGE } as any);
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((r) => ({
      id: String(r._id ?? r.id),
      title: text(r.eventName, r.event?.name, "Event pass"),
      subtitle: dayRange(r.event?.startDate, r.event?.endDate),
      badge: r.status ? humanize(r.status) : undefined,
      to: "/profile/events",
    })),
    res.data,
    { emptyText: "You have no event passes.", links: [{ label: "My event passes", to: "/profile/events" }] },
  );
};

export const myVolunteerApplications: Loader = async () => {
  const res = await volunteerService.getMyApplications();
  const rows = rowsOf(res.data);
  return {
    items: rows.slice(0, PAGE).map((a) => ({
      id: String(a._id),
      title: text(a.jobId?.title, "Volunteer application"),
      subtitle: day(a.createdAt),
      badge: a.status ? humanize(a.status) : undefined,
      to: "/profile/volunteer",
    })),
    total: rows.length,
    emptyText: "You have not applied for a volunteer role.",
  };
};

// ── Support ──────────────────────────────────────────────────────────────────

export const myTickets: Loader = async (_ctx, v) => {
  const res = await supportApi.myTickets({ limit: PAGE, status: v.status || undefined });
  const rows = rowsOf(res.data);
  return result(
    rows.slice(0, PAGE).map((t) => ({
      id: String(t._id),
      title: text(t.subject, "Support ticket"),
      subtitle: text(t.categoryLabel),
      meta: compact([text(t.ticketNumber), day(t.updatedAt ?? t.createdAt)]),
      badge: humanize(t.status),
      to: `/profile/support/${t._id}`,
    })),
    res.data,
    { emptyText: "You have no support tickets.", links: [{ label: "Raise a new ticket", to: "/profile/support/new" }] },
  );
};

export const supportOverview: Loader = async () => {
  const res = await supportAdminApi.dashboard();
  const t = res.data?.data?.totals;
  if (!t) return { emptyText: "The support summary is not available for your role." };
  return {
    note: res.data?.data?.scope === "own_queue" ? "Your tickets and the unassigned queue." : "All tickets across Tirvona.",
    stats: [
      { label: "Open", value: String(t.open ?? 0) },
      { label: "In progress", value: String(t.inProgress ?? 0) },
      { label: "Urgent open", value: String(t.urgentOpen ?? 0) },
      { label: "Unassigned", value: String(t.unassignedOpen ?? 0) },
      { label: "Overdue", value: String(t.overdueOpen ?? 0) },
      { label: "Resolved today", value: String(t.resolvedToday ?? 0) },
    ],
    links: [{ label: "Open support console", to: "/admin/support" }],
  };
};

// ── Platform / admin ─────────────────────────────────────────────────────────

export const marketplaceOverview: Loader = async () => {
  const res = await marketplaceAdminApi.overview();
  const o = res.data?.data;
  if (!o) return { emptyText: "The marketplace summary is not available for your role." };
  return {
    stats: [
      { label: "Vendors", value: String(o.vendors?.total ?? 0) },
      { label: "Pending sellers", value: String((o.vendors?.pending ?? 0) + (o.vendors?.draft ?? 0)) },
      { label: "Pending products", value: String(o.products?.pending ?? 0) },
      { label: "Paid orders", value: String(o.orders?.paid ?? 0) },
      { label: "Gross sales", value: inr(o.sales?.gross) },
      { label: "Net commission", value: inr(o.commission?.netCommission) },
      { label: "Pending payouts", value: inr(o.payouts?.pendingAmount) },
    ],
    links: [{ label: "Open marketplace admin", to: "/admin/manage/marketplace" }],
  };
};
