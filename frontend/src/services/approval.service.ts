import api from '../lib/api';

export interface ApprovalRequestPayload {
  module:
    | 'ashram'
    | 'room_category'
    | 'room'
    | 'amenities'
    | 'pricing'
    | 'offer'
    | 'gallery'
    | 'volunteer'
    | 'marketplace'
    | 'service'
    | 'blog'
    | 'event'
    | 'temple'
    | 'banner'
    | 'other';
  entityType?: string;
  entityId?: string;
  ashramId?: string;
  title: string;
  requestedData: any;
  currentData?: any;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface ApprovalRequestItem {
  _id: string;
  requestId: string;
  module: string;
  entityType?: string;
  ashramId?: {
    _id: string;
    name: string;
    address?: { city?: string; state?: string };
  };
  stayAdminId?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  title: string;
  requestedData: any;
  categoryData?: any;
  currentData?: any;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'needs_changes' | 'needs_modification' | 'expired' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reviewComment?: string;
  comments?: Array<{
    userId?: { _id: string; name: string; avatarUrl?: string };
    userName?: string;
    text: string;
    timestamp: string;
  }>;
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  history?: Array<{
    status: string;
    comment?: string;
    updatedBy?: string;
    timestamp: string;
  }>;
  isLegacy?: boolean;
}

export type RoomCategoryRequestItem = ApprovalRequestItem;

export interface ApprovalStatsData {
  totalPending: number;
  underReview: number;
  needsChanges: number;
  highPriority: number;
  approvedToday: number;
  rejectedToday: number;
  totalCount: number;
  avgApprovalTimeHours: number;
}

export const approvalService = {
  // Submit new generic approval request
  submitRequest: async (payload: ApprovalRequestPayload) => {
    const res = await api.post<{ success: boolean; message: string; data: ApprovalRequestItem }>('/approvals/requests', payload);
    return res.data;
  },

  // Get master requests list with filters
  getRequests: async (params?: { module?: string; status?: string; ashramId?: string; priority?: string; search?: string }) => {
    const res = await api.get<{ success: boolean; count: number; data: ApprovalRequestItem[] }>('/approvals/requests', { params });
    return res.data;
  },

  // Get Approval Center KPI stats
  getStats: async () => {
    const res = await api.get<{ success: boolean; data: ApprovalStatsData }>('/approvals/requests/stats');
    return res.data;
  },

  // Get single request details
  getRequestById: async (id: string) => {
    const res = await api.get<{ success: boolean; data: ApprovalRequestItem }>(`/approvals/requests/${id}`);
    return res.data;
  },

  // Review request (Super Admin)
  reviewRequest: async (id: string, action: 'approve' | 'reject' | 'request_changes' | 'under_review', reviewComment?: string) => {
    const res = await api.put<{ success: boolean; message: string; data: ApprovalRequestItem }>(`/approvals/requests/${id}/review`, {
      action,
      reviewComment,
    });
    return res.data;
  },

  // Add comment to approval thread
  addComment: async (id: string, text: string) => {
    const res = await api.post<{ success: boolean; message: string; data: any }>(`/approvals/requests/${id}/comment`, { text });
    return res.data;
  },

  // Legacy room category specific helpers
  submitRoomCategoryRequest: async (payload: any) => {
    const res = await api.post<{ success: boolean; message: string; data: ApprovalRequestItem }>('/approvals/room-categories', payload);
    return res.data;
  },
  getRoomCategoryRequests: async (params?: { status?: string; ashramId?: string }) => {
    const res = await api.get<{ success: boolean; count: number; data: ApprovalRequestItem[] }>('/approvals/room-categories', { params });
    return res.data;
  },
  reviewRoomCategoryRequest: async (id: string, action: 'approve' | 'reject' | 'request_changes', reviewComment?: string) => {
    const res = await api.put<{ success: boolean; message: string; data: ApprovalRequestItem }>(`/approvals/room-categories/${id}/review`, {
      action,
      reviewComment,
    });
    return res.data;
  },
  resubmitRoomCategoryRequest: async (id: string, payload: any) => {
    const res = await api.put<{ success: boolean; message: string; data: ApprovalRequestItem }>(`/approvals/room-categories/${id}/resubmit`, payload);
    return res.data;
  },
};

export default approvalService;
