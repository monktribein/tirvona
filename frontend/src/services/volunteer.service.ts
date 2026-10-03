import api from "../lib/api";

export interface VolunteerCategoryDef {
  id: string;
  label: string;
  description: string;
  popularRoles: string;
}

export const VOLUNTEER_CATEGORIES: readonly VolunteerCategoryDef[] = [
  {
    id: "volunteer",
    label: "Volunteer Seva",
    description: "Daily temple & ashram seva, devotee assistance, garden care, and sacred campus support.",
    popularRoles: "Devotee Assistance, Ashram Maintenance, Seva Lead",
  },
  {
    id: "internship",
    label: "Internship / Fellowship",
    description: "Structured ashram management internships, cultural preservation, and youth fellowships.",
    popularRoles: "Hospitality Management, Project Fellow, Research",
  },
  {
    id: "kitchen_seva",
    label: "Kitchen Seva",
    description: "Satvik food preparation, Prasad distribution, Bhandara service, and Annakshetra management.",
    popularRoles: "Prasad Distribution, Annakshetra Cook, Bhandara Support",
  },
  {
    id: "event_coordinator",
    label: "Ganga Aarti & Events",
    description: "Coordination of holy evening Aarti ceremonies, festivals, pilgrim crowd guidance, and special poojas.",
    popularRoles: "Aarti Coordinator, Festival Organizer, Crowd Guide",
  },
  {
    id: "digital_marketing",
    label: "Digital Marketing",
    description: "Photography, videography, social media outreach, website management, and spiritual stories.",
    popularRoles: "Content Creator, Social Media Manager, Media Fellow",
  },
  {
    id: "temple_guide",
    label: "Pilgrim Guide",
    description: "Helping pilgrims and tourists explore sacred shrines, spiritual history, ghats, and local heritage.",
    popularRoles: "Ghat Guide, Heritage Walk Host, Temple Interpreter",
  },
] as const;

export const getVolunteerCategoryLabel = (type?: string): string => {
  if (!type) return "Volunteer Seva";
  const found = VOLUNTEER_CATEGORIES.find((c) => c.id === type);
  return found ? found.label : type;
};

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
  accommodation: "free_ashram_stay" | "paid" | "none";
  food: "satvik_free_3_meals" | "paid" | "none";
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
  status: "open" | "closing_soon" | "closed";
  isGovtVerified: boolean;
}

export type VolunteerJobPayload = Pick<
  VolunteerJobItem,
  "ashramId" | "ashramName" | "city" | "title" | "department"
> &
  Partial<
    Pick<
      VolunteerJobItem,
      | "state"
      | "type"
      | "openingsCount"
      | "duration"
      | "accommodation"
      | "food"
      | "stipend"
      | "certificateProvided"
      | "responsibilities"
      | "requirements"
      | "benefits"
      | "contactPerson"
      | "deadline"
      | "status"
    >
  >;

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

export interface VolunteerApplicationItem
  extends Omit<ApplicationPayload, "jobId"> {
  _id: string;
  userId: string;
  status: "applied" | "shortlisted" | "interviewed" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
  jobId: VolunteerJobItem | string;
  interviewSchedule?: { notes?: string };
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
    return api.get("/volunteer/jobs", { params });
  },

  getJobById: async (id: string) => {
    return api.get(`/volunteer/jobs/${id}`);
  },

  getManagedJobs: async (params?: { page?: number; limit?: number }) => {
    return api.get("/volunteer/owner/jobs", { params });
  },

  applyJob: async (payload: ApplicationPayload) => {
    return api.post("/volunteer/apply", payload);
  },

  getMyApplications: async (params?: { jobId?: string; status?: string }) => {
    return api.get("/volunteer/applications/mine", {
      params,
      skipToast: true,
    });
  },

  createJob: async (data: VolunteerJobPayload) => {
    return api.post("/volunteer/jobs", data);
  },

  updateJob: async (id: string, data: Partial<VolunteerJobPayload>) => {
    return api.put(`/volunteer/jobs/${id}`, data);
  },

  deleteJob: async (id: string) => {
    return api.delete(`/volunteer/jobs/${id}`);
  },

  getApplications: async (params?: { jobId?: string; status?: string }) => {
    return api.get("/volunteer/applications", { params });
  },

  updateApplicationStatus: async (
    id: string,
    status: string,
    notes?: string,
  ) => {
    return api.put(`/volunteer/applications/${id}/status`, { status, notes });
  },
};

export default volunteerService;
