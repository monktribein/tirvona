import api from '../lib/api';

export interface VolunteerJobItem {
  _id: string;
  ashramId: string;
  ashramName: string;
  city: string;
  state: string;
  title: string;
  department: string;
  type: string;
  openingsCount: number;
  duration: string;
  accommodation: 'free_ashram_stay' | 'paid' | 'none';
  food: 'satvik_free_3_meals' | 'paid' | 'none';
  stipend: string;
  certificateProvided: boolean;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  contactPerson: {
    name: string;
    phone: string;
    email: string;
  };
  deadline: string;
  status: 'open' | 'closing_soon' | 'closed';
  isGovtVerified: boolean;
}

export interface ApplicationPayload {
  jobId: string;
  applicantName: string;
  email: string;
  phone: string;
  city: string;
  education?: string;
  skills?: string;
  languages?: string;
  availability?: string;
  motivation: string;
}

export const volunteerService = {
  getJobs: async (params?: {
    category?: string;
    city?: string;
    type?: string;
    department?: string;
    accommodation?: string;
    food?: string;
    search?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }) => {
    return api.get('/volunteer/jobs', { params });
  },

  getJobById: async (id: string) => {
    return api.get(`/volunteer/jobs/${id}`);
  },

  applyJob: async (payload: ApplicationPayload) => {
    return api.post('/volunteer/apply', payload);
  },

  createJob: async (data: Partial<VolunteerJobItem>) => {
    return api.post('/volunteer/jobs', data);
  },

  updateJob: async (id: string, data: Partial<VolunteerJobItem>) => {
    return api.put(`/volunteer/jobs/${id}`, data);
  },

  deleteJob: async (id: string) => {
    return api.delete(`/volunteer/jobs/${id}`);
  },

  getApplications: async (params?: { jobId?: string; status?: string }) => {
    return api.get('/volunteer/applications', { params });
  },
};

export default volunteerService;
