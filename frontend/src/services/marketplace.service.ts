import api from "../lib/api";

export interface MarketplaceProductItem {
  _id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  price: number;
  salePrice?: number;
  stock: number;
  templeSource: string;
  authenticityCertificate: string;
  weight: string;
  images: string[];
  vendor: {
    name: string;
    type: string;
    location: string;
    isVerified: boolean;
  };
  rating: number;
  reviewCount: number;
  specifications: Array<{ key: string; value: string }>;
  isFeatured: boolean;
  status: string;
}

export const marketplaceService = {
  getProducts: async (params?: Record<string, any>) => {
    return api.get("/marketplace/products", { params });
  },

  getBySlug: async (idOrSlug: string) => {
    return api.get(`/marketplace/products/${idOrSlug}`);
  },

  createProduct: async (data: Record<string, any>) => {
    return api.post("/marketplace/products", data);
  },

  updateProduct: async (id: string, data: Record<string, any>) => {
    return api.put(`/marketplace/products/${id}`, data);
  },

  deleteProduct: async (id: string) => {
    return api.delete(`/marketplace/products/${id}`);
  },

  quote: async (items: { productId: string; quantity: number }[]) =>
    api.post("/marketplace/cart/quote", { items }),

  createOrder: async (payload: {
    items: { productId: string; quantity: number }[];
    addressId?: string;
    address?: Record<string, unknown>;
    saveAddress?: boolean;
    paymentMode?: "online" | "cod";
    notes?: string;
  }) => api.post("/marketplace/orders", payload),

  myOrders: async (params: Record<string, unknown> = {}) =>
    api.get("/marketplace/orders", { params }),

  getOrder: async (id: string) => api.get(`/marketplace/orders/${id}`),

  cancelOrder: async (id: string, reason: string) =>
    api.post(`/marketplace/orders/${id}/cancel`, { reason }),

  paymentOrder: async (id: string) =>
    api.post(`/marketplace/orders/${id}/payment/order`, {}),

  confirmPayment: async (id: string, payload: Record<string, string>) =>
    api.post(`/marketplace/orders/${id}/payment`, payload),

  addresses: async () => api.get("/marketplace/addresses"),
  addAddress: async (data: Record<string, unknown>) =>
    api.post("/marketplace/addresses", data),
  updateAddress: async (id: string, data: Record<string, unknown>) =>
    api.put(`/marketplace/addresses/${id}`, data),
  deleteAddress: async (id: string) =>
    api.delete(`/marketplace/addresses/${id}`),
};

export default marketplaceService;
