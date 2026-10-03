import api from "../lib/api";

/** Product as the multi-vendor storefront returns it, flattened for the UI. */
export interface StoreProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  category?: string;
  categoryId?: string;
  categoryName?: string;
  price: number;
  salePrice?: number;
  sellingPrice: number;
  /** undefined = stock is not tracked for this product. */
  stock?: number;
  inStock: boolean;
  templeSource?: string;
  authenticityCertificate?: string;
  weight?: string;
  gstPercent?: number;
  images: string[];
  rating?: number;
  reviewCount?: number;
  specifications?: Array<{ key: string; value: string }>;
  isFeatured?: boolean;
  vendor?: {
    id?: string;
    name: string;
    slug?: string;
    logoUrl?: string;
    location?: string;
    isVerified: boolean;
  };
}

export interface StoreCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  children?: StoreCategory[];
}

/**
 * The public API populates `vendorId` / `categoryId`. Only ACTIVE (approved,
 * KYC-verified) stores are ever returned by it, so every vendor it returns is
 * a verified seller.
 */
export const toStoreProduct = (raw: any): StoreProduct => {
  const vendor = raw?.vendorId && typeof raw.vendorId === "object" ? raw.vendorId : null;
  const category = raw?.categoryId && typeof raw.categoryId === "object" ? raw.categoryId : null;
  const location = [vendor?.address?.city, vendor?.address?.state].filter(Boolean).join(", ");
  return {
    ...raw,
    categoryId: category ? String(category._id) : raw?.categoryId ? String(raw.categoryId) : undefined,
    categoryName: category?.name,
    sellingPrice: Number(raw?.sellingPrice ?? raw?.salePrice ?? raw?.price ?? 0),
    stock: raw?.stock === null || raw?.stock === undefined ? undefined : Number(raw.stock),
    inStock: raw?.inStock !== false,
    images: Array.isArray(raw?.images) ? raw.images : [],
    vendor: vendor
      ? {
          id: String(vendor._id),
          name: vendor.storeName,
          slug: vendor.slug,
          logoUrl: vendor.logoUrl,
          location: location || undefined,
          isVerified: true,
        }
      : undefined,
  };
};

/** Flattens the category tree into `[{_id, name, depth}]` for pickers. */
export const flattenCategories = (
  tree: StoreCategory[],
  depth = 0,
): Array<StoreCategory & { depth: number }> =>
  tree.flatMap((c) => [{ ...c, depth }, ...flattenCategories(c.children ?? [], depth + 1)]);

type Query = Record<string, unknown>;
const clean = (params: Query = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null));

export const marketplaceService = {
  // ----------------------------------------------------- address book
  addresses: async () => api.get("/marketplace/addresses"),
  addAddress: async (data: Record<string, unknown>) =>
    api.post("/marketplace/addresses", data),
  updateAddress: async (id: string, data: Record<string, unknown>) =>
    api.put(`/marketplace/addresses/${id}`, data),
  deleteAddress: async (id: string) =>
    api.delete(`/marketplace/addresses/${id}`),
};

/** Public multi-vendor storefront (`/api/marketplace/store`). */
export const storeApi = {
  categories: () => api.get("/marketplace/store/categories", { skipToast: true }),
  products: (params: Query = {}) =>
    api.get("/marketplace/store/products", { params: clean(params), skipToast: true }),
  product: (idOrSlug: string) =>
    api.get(`/marketplace/store/products/${encodeURIComponent(idOrSlug)}`, { skipToast: true }),
  reviews: (productId: string, params: Query = {}) =>
    api.get(`/marketplace/store/products/${productId}/reviews`, { params: clean(params), skipToast: true }),
  vendor: (slug: string) =>
    api.get(`/marketplace/store/vendors/${encodeURIComponent(slug)}`, { skipToast: true }),
  /** Server-priced cart, split per store. Guests may call it. */
  quote: (items: { productId: string; quantity: number }[]) =>
    api.post("/marketplace/store/cart/quote", { items }, { skipToast: true }),
};

/** Signed-in customer: multi-vendor checkout and orders. */
export const checkoutApi = {
  placeOrder: (payload: {
    items: { productId: string; quantity: number }[];
    addressId?: string;
    address?: Record<string, unknown>;
    notes?: string;
    idempotencyKey?: string;
    useWallet?: boolean;
  }) => api.post("/marketplace/checkout/orders", payload),
  confirmPayment: (id: string, payload: Record<string, string>) =>
    api.post(`/marketplace/checkout/orders/${id}/payment`, payload),
  orders: (params: Query = {}) =>
    api.get("/marketplace/checkout/orders", { params: clean(params), skipToast: true }),
  order: (id: string) => api.get(`/marketplace/checkout/orders/${id}`, { skipToast: true }),
  cancel: (id: string, reason: string) =>
    api.post(`/marketplace/checkout/orders/${id}/cancel`, { reason }),
  requestReturn: (vendorOrderId: string, reason: string) =>
    api.post(`/marketplace/checkout/vendor-orders/${vendorOrderId}/return`, { reason }),
  review: (payload: { vendorOrderId: string; productId: string; rating: number; title?: string; comment?: string }) =>
    api.post("/marketplace/checkout/reviews", payload),
};

/** Seller console: every route is scoped to the caller's own store by the backend. */
export const vendorApi = {
  dashboard: () => api.get("/marketplace/vendor/dashboard", { skipToast: true }),
  profile: () => api.get("/marketplace/vendor/profile", { skipToast: true }),
  createProfile: (data: Query) => api.post("/marketplace/vendor/profile", data),
  updateProfile: (data: Query) => api.put("/marketplace/vendor/profile", data),
  submit: () => api.post("/marketplace/vendor/profile/submit", {}),
  activate: () => api.post("/marketplace/vendor/profile/activate", {}),
  deactivate: () => api.post("/marketplace/vendor/profile/deactivate", {}),
  addDocument: (data: { type: string; fileUrl: string; fileName?: string; documentNumberMasked?: string }) =>
    api.post("/marketplace/vendor/documents", data),
  removeDocument: (id: string) => api.delete(`/marketplace/vendor/documents/${id}`),
  bankAccounts: () => api.get("/marketplace/vendor/bank-accounts", { skipToast: true }),
  addBankAccount: (data: Query) => api.post("/marketplace/vendor/bank-accounts", data),
  setDefaultBankAccount: (id: string) => api.post(`/marketplace/vendor/bank-accounts/${id}/default`, {}),
  removeBankAccount: (id: string) => api.delete(`/marketplace/vendor/bank-accounts/${id}`),

  products: (params: Query = {}) =>
    api.get("/marketplace/vendor/products", { params: clean(params), skipToast: true }),
  lowStock: () => api.get("/marketplace/vendor/products/low-stock", { skipToast: true }),
  product: (id: string) => api.get(`/marketplace/vendor/products/${id}`, { skipToast: true }),
  createProduct: (data: Query) => api.post("/marketplace/vendor/products", data),
  updateProduct: (id: string, data: Query) => api.put(`/marketplace/vendor/products/${id}`, data),
  submitProduct: (id: string) => api.post(`/marketplace/vendor/products/${id}/submit`, {}),
  setListing: (id: string, listingStatus: "active" | "inactive" | "archived") =>
    api.patch(`/marketplace/vendor/products/${id}/listing`, { listingStatus }),
  setStock: (id: string, stock: number, lowStockThreshold?: number) =>
    api.patch(`/marketplace/vendor/products/${id}/stock`, clean({ stock, lowStockThreshold })),

  orders: (params: Query = {}) =>
    api.get("/marketplace/vendor/orders", { params: clean(params), skipToast: true }),
  order: (id: string) => api.get(`/marketplace/vendor/orders/${id}`, { skipToast: true }),
  updateFulfillment: (id: string, data: { status: string; note?: string; tracking?: Query }) =>
    api.patch(`/marketplace/vendor/orders/${id}/fulfillment`, data),

  wallet: () => api.get("/marketplace/vendor/wallet", { skipToast: true }),
  ledger: (params: Query = {}) =>
    api.get("/marketplace/vendor/ledger", { params: clean(params), skipToast: true }),
  payouts: (params: Query = {}) =>
    api.get("/marketplace/vendor/payouts", { params: clean(params), skipToast: true }),
  requestPayout: (data: { amount: number; bankAccountId?: string; mode?: string }) =>
    api.post("/marketplace/vendor/payouts", data),
  cancelPayout: (id: string) => api.post(`/marketplace/vendor/payouts/${id}/cancel`, {}),
  reviews: (params: Query = {}) =>
    api.get("/marketplace/vendor/reviews", { params: clean(params), skipToast: true }),
};

/** Super Admin / marketplace manager / finance manager console. */
export const marketplaceAdminApi = {
  overview: () => api.get("/marketplace/admin/overview", { skipToast: true }),

  vendors: (params: Query = {}) =>
    api.get("/marketplace/admin/vendors", { params: clean(params), skipToast: true }),
  vendor: (id: string) => api.get(`/marketplace/admin/vendors/${id}`, { skipToast: true }),
  vendorAction: (id: string, action: string, reason?: string) =>
    api.post(`/marketplace/admin/vendors/${id}/status`, clean({ action, reason })),
  vendorCommission: (id: string, commissionPercent: number | null) =>
    api.put(`/marketplace/admin/vendors/${id}/commission`, { commissionPercent }),
  reviewDocument: (id: string, status: "verified" | "rejected", note?: string) =>
    api.patch(`/marketplace/admin/documents/${id}`, clean({ status, note })),
  verifyBankAccount: (id: string, status: "verified" | "rejected") =>
    api.patch(`/marketplace/admin/bank-accounts/${id}`, { status }),
  vendorWallet: (id: string) => api.get(`/marketplace/admin/vendors/${id}/wallet`, { skipToast: true }),

  products: (params: Query = {}) =>
    api.get("/marketplace/admin/products", { params: clean(params), skipToast: true }),
  product: (id: string) => api.get(`/marketplace/admin/products/${id}`, { skipToast: true }),
  reviewProduct: (id: string, decision: "approve" | "reject", reason?: string) =>
    api.post(`/marketplace/admin/products/${id}/review`, clean({ decision, reason })),
  disableProduct: (id: string, disabled: boolean, reason?: string) =>
    api.post(`/marketplace/admin/products/${id}/disable`, clean({ disabled, reason })),

  categories: () => api.get("/marketplace/admin/categories", { skipToast: true }),
  createCategory: (data: Query) => api.post("/marketplace/admin/categories", data),
  updateCategory: (id: string, data: Query) => api.put(`/marketplace/admin/categories/${id}`, data),

  orders: (params: Query = {}) =>
    api.get("/marketplace/admin/orders", { params: clean(params), skipToast: true }),
  order: (id: string) => api.get(`/marketplace/admin/orders/${id}`, { skipToast: true }),
  vendorOrders: (params: Query = {}) =>
    api.get("/marketplace/admin/vendor-orders", { params: clean(params), skipToast: true }),
  updateFulfillment: (id: string, data: { status: string; note?: string }) =>
    api.patch(`/marketplace/admin/vendor-orders/${id}/fulfillment`, data),
  resolveReturn: (id: string, approve: boolean, note?: string) =>
    api.post(`/marketplace/admin/vendor-orders/${id}/return`, clean({ approve, note })),
  retryRefund: (id: string) => api.post(`/marketplace/admin/vendor-orders/${id}/retry-refund`, {}),

  commission: () => api.get("/marketplace/admin/finance/commission", { skipToast: true }),
  payouts: (params: Query = {}) =>
    api.get("/marketplace/admin/payouts", { params: clean(params), skipToast: true }),
  approvePayout: (id: string) => api.post(`/marketplace/admin/payouts/${id}/approve`, {}),
  syncPayout: (id: string) => api.post(`/marketplace/admin/payouts/${id}/sync`, {}),
  markPayoutPaid: (id: string, utr: string) => api.post(`/marketplace/admin/payouts/${id}/mark-paid`, { utr }),
  markPayoutFailed: (id: string, reason: string) =>
    api.post(`/marketplace/admin/payouts/${id}/mark-failed`, { reason }),

  reviews: (params: Query = {}) =>
    api.get("/marketplace/admin/reviews", { params: clean(params), skipToast: true }),
  setReviewStatus: (id: string, status: "published" | "hidden") =>
    api.patch(`/marketplace/admin/reviews/${id}`, { status }),

  settings: () => api.get("/marketplace/admin/settings", { skipToast: true }),
  updateSettings: (data: Query) => api.put("/marketplace/admin/settings", data),
};

export default marketplaceService;
