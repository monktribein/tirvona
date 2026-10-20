import api from "../lib/api";

export interface FoodZone {
  _id: string;
  zoneCode: string;
  name: string;
  description: string;
  active: boolean;
  deliveryFeePaise: number;
  minOrderPaise: number;
}

export interface FoodOutlet {
  id: string;
  brandName: string;
  address: string;
  openTime: string;
  closeTime: string;
  serviceZoneCodes: string[];
  fulfilmentModes: string[];
  rating: number;
  ratingCount: number;
  avgPrepMinutes: number;
  minOrderPaise: number;
  imageUrl?: string;
  description?: string;
  isPaused?: boolean;
}

export interface FoodMeal {
  id: string;
  sku: string;
  label: string;
  canonicalName: string;
  family: "THALI" | "BOWL" | "COMBO";
  contents: string;
  dietaryTags: string[];
  pricePaise: number;
  priceRupees: number;
  prepMinutes: number;
  portion: string;
  imageUrl?: string;
  imageUrls?: string[];
  isAvailable: boolean;
  outlet: {
    id: string;
    brandName: string;
    address: string;
    rating: number;
    ratingCount: number;
    fulfilmentModes: string[];
    avgPrepMinutes: number;
  } | null;
}

export interface FoodDiscoveryResponse {
  zones: FoodZone[];
  outlets: FoodOutlet[];
  meals: FoodMeal[];
}

export interface FoodQuote {
  quoteId: string;
  outlet: {
    id: string;
    brandName: string;
    address: string;
  };
  items: Array<{
    variantId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPricePaise: number;
    totalPricePaise: number;
    dietaryTags?: string[];
    contents?: string;
    portion?: string;
    customerNotes?: string;
  }>;
  pricing: {
    subtotalPaise: number;
    subtotalRupees: number;
    deliveryFeePaise: number;
    deliveryFeeRupees: number;
    packagingFeePaise: number;
    packagingFeeRupees: number;
    taxPaise: number;
    taxRupees: number;
    discountPaise: number;
    discountRupees: number;
    totalPaise: number;
    totalRupees: number;
  };
  fulfilmentType: "pickup" | "vendor_delivery" | "stay_delivery";
  destinationAddress?: string;
  stayBookingId?: string;
  stayRoomNumber?: string;
  expiresAt: string;
}

export interface FoodOrder {
  _id: string;
  orderNumber: string;
  quoteId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  outletId: any;
  bookingId?: any;
  stayRoomNumber?: string;
  fulfilmentType: "pickup" | "vendor_delivery" | "stay_delivery";
  deliveryAddress?: string;
  deliveryInstructions?: string;
  orderStatus: string;
  /** PENDING | PAID | FAILED | REFUNDED. Refund progress is in orderStatus (REFUND_*) and `refund`. */
  paymentStatus: string;
  refund?: {
    status: "pending" | "processing" | "refunded" | "failed";
    amountRupees: number;
    failureReason?: string;
    resolvedAt?: string | null;
  } | null;
  rejectionReason?: string;
  subtotalPaise: number;
  subtotalRupees: number;
  deliveryFeePaise: number;
  deliveryFeeRupees: number;
  packagingFeePaise: number;
  packagingFeeRupees: number;
  taxPaise: number;
  taxRupees: number;
  totalPaise: number;
  totalRupees: number;
  vendorAcceptanceDeadline?: string;
  vendorAcceptedAt?: string;
  preparedAt?: string;
  readyAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  items: Array<{
    _id: string;
    name: string;
    sku: string;
    quantity: number;
    unitPricePaise: number;
    unitPriceRupees: number;
    totalPricePaise: number;
    totalPriceRupees: number;
    dietaryTags?: string[];
    contents?: string;
    portion?: string;
  }>;
  events?: Array<{
    _id: string;
    fromStatus?: string;
    toStatus: string;
    actorType: string;
    reason?: string;
    createdAt: string;
  }>;
}

export const foodService = {
  // Discovery & Catalogue
  async getDiscovery(params?: {
    zoneCode?: string;
    family?: string;
    dietaryTag?: string;
    search?: string;
    outletId?: string;
  }): Promise<FoodDiscoveryResponse> {
    const res = await api.get<FoodDiscoveryResponse>("/v1/food/discovery", {
      params,
    });
    return res.data;
  },

  async getZones(): Promise<FoodZone[]> {
    const res = await api.get<FoodZone[]>("/v1/food/zones");
    return res.data;
  },

  async getOutletMenu(outletId: string): Promise<any> {
    const res = await api.get(`/v1/food/outlets/${outletId}/menu`);
    return res.data;
  },

  // Authoritative Checkout Quotes
  async createQuote(dto: {
    outletId: string;
    items: Array<{
      variantId: string;
      quantity: number;
      customerNotes?: string;
    }>;
    fulfilmentType: "pickup" | "vendor_delivery" | "stay_delivery";
    destinationAddress?: string;
    stayBookingId?: string;
    stayRoomNumber?: string;
    zoneCode?: string;
  }): Promise<FoodQuote> {
    const res = await api.post<FoodQuote>("/v1/food/quotes", dto);
    return res.data;
  },

  // Orders
  async createOrder(dto: {
    quoteId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryAddress?: string;
    deliveryInstructions?: string;
    stayBookingId?: string;
    stayRoomNumber?: string;
    idempotencyKey?: string;
  }): Promise<FoodOrder> {
    const idempotencyKey =
      dto.idempotencyKey || `IDEM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const res = await api.post<FoodOrder>("/v1/food/orders", dto, {
      headers: { "x-idempotency-key": idempotencyKey },
    });
    return res.data;
  },

  async getOrder(id: string): Promise<FoodOrder> {
    const res = await api.get<FoodOrder>(`/v1/food/orders/${id}`);
    return res.data;
  },

  async cancelOrder(id: string, reason?: string): Promise<FoodOrder> {
    const res = await api.post<FoodOrder>(`/v1/food/orders/${id}/cancel`, {
      reason,
    });
    return res.data;
  },

  async createPaymentCheckout(orderId: string): Promise<any> {
    const res = await api.post(`/v1/food/payments/${orderId}/checkout`);
    return res.data;
  },

  /** Sends the Razorpay checkout result to the server, which verifies its signature. */
  async confirmPayment(
    orderId: string,
    payment: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature?: string;
    },
  ): Promise<any> {
    const res = await api.post(`/v1/food/payments/${orderId}/confirm`, payment);
    return res.data;
  },

  async getCustomerOrders(): Promise<FoodOrder[]> {
    const res = await api.get<FoodOrder[]>("/v1/food/customer/orders");
    return res.data;
  },

  // Restaurant Owner / Vendor Operations
  async getVendorOrders(status?: string): Promise<FoodOrder[]> {
    const res = await api.get<FoodOrder[]>("/v1/food/vendor/orders", {
      params: { status },
    });
    return res.data;
  },

  async vendorAcceptOrder(id: string): Promise<FoodOrder> {
    const res = await api.post<FoodOrder>(`/v1/food/vendor/orders/${id}/accept`);
    return res.data;
  },

  async vendorRejectOrder(id: string, reason: string): Promise<FoodOrder> {
    const res = await api.post<FoodOrder>(`/v1/food/vendor/orders/${id}/reject`, {
      reason,
    });
    return res.data;
  },

  async vendorUpdateStatus(id: string, status: string): Promise<FoodOrder> {
    const res = await api.patch<FoodOrder>(`/v1/food/vendor/orders/${id}/status`, {
      status,
    });
    return res.data;
  },

  async getVendorOutlets(): Promise<any[]> {
    const res = await api.get("/v1/food/vendor/outlets/mine");
    return res.data;
  },

  async toggleOutletPause(id: string, isPaused: boolean): Promise<any> {
    const res = await api.patch(`/v1/food/vendor/outlets/${id}/status`, {
      isPaused,
    });
    return res.data;
  },

  async toggleVariantAvailability(
    id: string,
    isAvailable: boolean,
  ): Promise<any> {
    const res = await api.patch(`/v1/food/vendor/variants/${id}/availability`, {
      isAvailable,
    });
    return res.data;
  },

  async getVendorStats(): Promise<any> {
    const res = await api.get("/v1/food/vendor/stats");
    return res.data;
  },

  async getVendorSettlements(): Promise<any[]> {
    const res = await api.get("/v1/food/vendor/settlements");
    return res.data;
  },

  // Food Admin & Finance
  async getAdminOrders(status?: string): Promise<FoodOrder[]> {
    const res = await api.get<FoodOrder[]>("/v1/food/admin/orders", {
      params: { status },
    });
    return res.data;
  },

  async getAdminExceptions(): Promise<any> {
    const res = await api.get("/v1/food/admin/exceptions");
    return res.data;
  },

  async approveProduct(productId: string): Promise<any> {
    const res = await api.post("/v1/food/admin/products/approve", {
      productId,
    });
    return res.data;
  },

  async updateOutletCommission(
    outletId: string,
    commissionRateBps: number,
    reason: string,
  ): Promise<any> {
    const res = await api.patch(
      `/v1/food/admin/outlets/${outletId}/commission`,
      { commissionRateBps, reason },
    );
    return res.data;
  },

  async getFinanceSettlements(outletId?: string): Promise<any[]> {
    const res = await api.get("/v1/food/finance/settlements", {
      params: { outletId },
    });
    return res.data;
  },

  async generateFinanceSettlements(from: string, to: string): Promise<{ created: number }> {
    const res = await api.post("/v1/food/finance/settlements/generate", { from, to });
    return res.data;
  },

  /** Tirvona sends the money to the restaurant bank account through RazorpayX. */
  async payFinanceSettlementViaProvider(id: string): Promise<any> {
    const res = await api.post(`/v1/food/finance/settlements/${id}/pay-provider`);
    return res.data;
  },

  async syncFinancePayouts(): Promise<{ synced: number }> {
    const res = await api.post("/v1/food/finance/settlements/sync");
    return res.data;
  },

  async approveFinanceSettlement(id: string): Promise<any> {
    const res = await api.post(`/v1/food/finance/settlements/${id}/approve`);
    return res.data;
  },

  async payFinanceSettlement(
    id: string,
    payoutReference: string,
  ): Promise<any> {
    const res = await api.post(`/v1/food/finance/settlements/${id}/pay`, {
      payoutReference,
    });
    return res.data;
  },
};
