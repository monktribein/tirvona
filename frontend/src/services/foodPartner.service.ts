import api from "../lib/api";

export interface FoodVendor {
  _id: string;
  businessName: string;
  status: "pending_verification" | "active" | "suspended" | "rejected";
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  fssaiReference?: string;
  /** Sent only when changing the account; reads return bankAccountLast4 instead. */
  bankAccountNumber?: string;
  bankAccountLast4?: string;
  hasBankDetails?: boolean;
  bankIfscCode?: string;
  bankAccountHolderName?: string;
  bankName?: string;
  outletCount?: number;
  /** Login of the owner account, when the restaurant has one. */
  owner?: { name?: string; email?: string; phone?: string } | null;
  createdAt?: string;
}

export interface FoodPartnerOutlet {
  _id: string;
  vendorId: string;
  brandName: string;
  address: string;
  serviceZoneCodes: string[];
  fulfilmentModes: string[];
  openTime: string;
  closeTime: string;
  contactPhone?: string;
  minOrderPaise: number;
  avgPrepMinutes: number;
  capacityPerHour: number;
  description?: string;
  imageUrl?: string;
  isPaused: boolean;
  status: string;
  commissionRateBps?: number;
}

export interface FoodPartnerProfile {
  vendor: FoodVendor;
  outlets: FoodPartnerOutlet[];
  owner?: { name?: string; email?: string; phone?: string; status?: string } | null;
}

export interface FoodOutletInput {
  brandName: string;
  address: string;
  serviceZoneCodes: string[];
  fulfilmentModes?: string[];
  openTime?: string;
  closeTime?: string;
  contactPhone?: string;
  minOrderPaise?: number;
  avgPrepMinutes?: number;
  capacityPerHour?: number;
  description?: string;
  imageUrl?: string;
}

export interface RegisterFoodVendorInput {
  businessName: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  fssaiReference?: string;
  outlet?: FoodOutletInput;
}

export interface AdminCreateFoodVendorInput extends RegisterFoodVendorInput {
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  approve?: boolean;
}

export interface FoodMenuItem {
  id: string;
  outletId: string;
  sku: string;
  label: string;
  family: "THALI" | "BOWL" | "COMBO";
  description: string;
  contents: string;
  dietaryTags: string[];
  pricePaise: number;
  prepMinutes: number;
  portion: string;
  dailyCapacity: number;
  cutOffTime: string;
  imageUrl: string;
  isAvailable: boolean;
}

export type FoodMenuItemInput = Partial<
  Omit<FoodMenuItem, "id" | "outletId" | "sku" | "family">
> & { label: string; family: string; pricePaise: number };

/** Owner routes act on the caller's own restaurant; admin routes act on any. */
export type FoodScope = "owner" | "admin";

const base = (scope: FoodScope) =>
  scope === "admin" ? "/v1/food/admin" : "/v1/food/vendor";

export const foodPartnerService = {
  // ---- Owner
  /** The caller's restaurant, or null when they have not registered one. */
  async myProfile(): Promise<FoodPartnerProfile | null> {
    const res = await api.get("/v1/food/vendor/profile");
    return res.data && res.data.vendor ? (res.data as FoodPartnerProfile) : null;
  },

  async register(input: RegisterFoodVendorInput): Promise<FoodPartnerProfile> {
    const res = await api.post("/v1/food/vendor/register", input);
    return res.data;
  },

  async updateMyVendor(input: Partial<FoodVendor>): Promise<FoodPartnerProfile> {
    const res = await api.patch("/v1/food/vendor/profile", input);
    return res.data;
  },

  // ---- Shared by owner and admin
  async addOutlet(
    scope: FoodScope,
    vendorId: string,
    input: FoodOutletInput,
  ): Promise<FoodPartnerOutlet> {
    const url =
      scope === "admin"
        ? `/v1/food/admin/vendors/${vendorId}/outlets`
        : "/v1/food/vendor/outlets";
    const res = await api.post(url, input);
    return res.data;
  },

  async updateOutlet(
    scope: FoodScope,
    outletId: string,
    input: Partial<FoodOutletInput>,
  ): Promise<FoodPartnerOutlet> {
    const res = await api.patch(`${base(scope)}/outlets/${outletId}`, input);
    return res.data;
  },

  async setOutletPaused(
    scope: FoodScope,
    outletId: string,
    isPaused: boolean,
  ): Promise<FoodPartnerOutlet> {
    const url =
      scope === "admin"
        ? `/v1/food/admin/outlets/${outletId}/pause`
        : `/v1/food/vendor/outlets/${outletId}/status`;
    const res = await api.patch(url, { isPaused });
    return res.data;
  },

  async listMenu(scope: FoodScope, outletId: string): Promise<FoodMenuItem[]> {
    const res = await api.get(`${base(scope)}/outlets/${outletId}/menu`);
    return res.data;
  },

  async createMenuItem(
    scope: FoodScope,
    outletId: string,
    input: FoodMenuItemInput,
  ): Promise<FoodMenuItem> {
    const res = await api.post(`${base(scope)}/outlets/${outletId}/menu`, input);
    return res.data;
  },

  async updateMenuItem(
    scope: FoodScope,
    id: string,
    input: Partial<FoodMenuItemInput>,
  ): Promise<FoodMenuItem> {
    const res = await api.patch(`${base(scope)}/menu/${id}`, input);
    return res.data;
  },

  async deleteMenuItem(
    scope: FoodScope,
    id: string,
  ): Promise<{ deleted: boolean; hidden: boolean }> {
    const res = await api.delete(`${base(scope)}/menu/${id}`);
    return res.data;
  },

  // ---- Super Admin
  async listVendors(params: { status?: string; search?: string }): Promise<FoodVendor[]> {
    const res = await api.get("/v1/food/admin/vendors", { params });
    return res.data;
  },

  async getVendor(id: string): Promise<FoodPartnerProfile> {
    const res = await api.get(`/v1/food/admin/vendors/${id}`);
    return res.data;
  },

  async createVendor(input: AdminCreateFoodVendorInput): Promise<FoodPartnerProfile> {
    const res = await api.post("/v1/food/admin/vendors", input);
    return res.data;
  },

  async updateVendor(id: string, input: Partial<FoodVendor>): Promise<FoodPartnerProfile> {
    const res = await api.patch(`/v1/food/admin/vendors/${id}`, input);
    return res.data;
  },

  async createOwnerLogin(
    id: string,
    input: { ownerName: string; email: string; phone: string; password: string },
  ): Promise<FoodPartnerProfile> {
    const res = await api.post(`/v1/food/admin/vendors/${id}/owner-login`, input);
    return res.data;
  },

  async setOwnerPassword(id: string, password: string): Promise<void> {
    await api.post(`/v1/food/admin/vendors/${id}/owner-password`, { password });
  },

  async setVendorStatus(
    id: string,
    status: FoodVendor["status"],
    reason?: string,
  ): Promise<FoodPartnerProfile> {
    const res = await api.post(`/v1/food/admin/vendors/${id}/status`, { status, reason });
    return res.data;
  },
};
