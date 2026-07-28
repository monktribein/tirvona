import api from '../lib/api';

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
    return api.get('/marketplace/products', { params });
  },

  getBySlug: async (idOrSlug: string) => {
    return api.get(`/marketplace/products/${idOrSlug}`);
  },

  createOrder: async (orderData: Record<string, any>) => {
    return api.post('/marketplace/order', orderData);
  },

  createProduct: async (data: Record<string, any>) => {
    return api.post('/marketplace/products', data);
  },

  updateProduct: async (id: string, data: Record<string, any>) => {
    return api.put(`/marketplace/products/${id}`, data);
  },

  deleteProduct: async (id: string) => {
    return api.delete(`/marketplace/products/${id}`);
  },
};

export default marketplaceService;
