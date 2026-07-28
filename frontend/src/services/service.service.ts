import api from '../lib/api';

export interface ServiceProviderItem {
  _id: string;
  name: string;
  category: string;
  subcategory: string;
  tagline?: string;
  description?: string;
  city: string;
  state: string;
  address?: string;
  pricing: {
    amount: number;
    unit: string;
    currency: string;
  };
  specifications: {
    pureVeg?: boolean;
    jainFood?: boolean;
    noOnionGarlic?: boolean;
    govtVerified?: boolean;
    wheelchairAccessible?: boolean;
    languages?: string[];
    vehicleType?: string;
    available24x7?: boolean;
  };
  contactPhone: string;
  whatsappNumber?: string;
  rating: number;
  reviewCount: number;
  images: string[];
  isVerified: boolean;
  status: string;
}

export const serviceEcosystemService = {
  getAll: async (params?: Record<string, any>) => {
    return api.get('/enterprise-services', { params });
  },

  getById: async (id: string) => {
    return api.get(`/enterprise-services/${id}`);
  },

  book: async (bookingData: Record<string, any>) => {
    return api.post('/enterprise-services/book', bookingData);
  },

  create: async (data: Record<string, any>) => {
    return api.post('/enterprise-services', data);
  },

  update: async (id: string, data: Record<string, any>) => {
    return api.put(`/enterprise-services/${id}`, data);
  },

  delete: async (id: string) => {
    return api.delete(`/enterprise-services/${id}`);
  },
};

export default serviceEcosystemService;
