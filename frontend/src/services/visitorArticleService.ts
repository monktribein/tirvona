import api from "../lib/api";

export interface EligibleBooking {
  _id: string;
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  ashram: {
    _id: string;
    name: string;
    address?: { city?: string; state?: string };
    images?: string[];
  };
  hasSubmittedArticle: boolean;
  existingArticleStatus?: string | null;
}

export interface VisitorArticle {
  _id: string;
  uuid: string;
  visitorId: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
  bookingId: EligibleBooking;
  ashramId: {
    _id: string;
    name: string;
    address?: { city?: string; state?: string };
    images?: string[];
  };
  ownerId: string;
  title: string;
  slug: string;
  category: string;
  shortDescription: string;
  content: string;
  featuredImage: string;
  /** Optional uploaded clip, shown above the article body. */
  videoUrl?: string;
  galleryImages: string[];
  tags: string[];
  language: string;
  status: "draft" | "pending" | "approved" | "rejected";
  rejectionReason?: string;
  isVerifiedStay: boolean;
  visitDate: string;
  visitMonth?: string;
  publishedAt?: string;
  viewsCount: number;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
}

export const visitorArticleService = {
  // Visitor APIs
  getEligibleBookings: () =>
    api.get<{ success: boolean; count: number; data: EligibleBooking[] }>(
      "/visitor-articles/visitor/eligible-bookings",
    ),
  getMyArticles: (status?: string) =>
    api.get<{
      success: boolean;
      counts: Record<string, number>;
      data: VisitorArticle[];
    }>(
      `/visitor-articles/visitor/my-articles${status ? `?status=${status}` : ""}`,
    ),
  createArticle: (
    data: Omit<Partial<VisitorArticle>, "bookingId"> & { bookingId: string },
  ) =>
    api.post<{ success: boolean; message: string; data: VisitorArticle }>(
      "/visitor-articles",
      data,
    ),
  updateArticle: (id: string, data: Partial<VisitorArticle>) =>
    api.put<{ success: boolean; message: string; data: VisitorArticle }>(
      `/visitor-articles/${id}`,
      data,
    ),

  // Owner APIs
  getOwnerArticles: (status?: string) =>
    api.get<{
      success: boolean;
      counts: Record<string, number>;
      data: VisitorArticle[];
    }>(`/visitor-articles/owner/list${status ? `?status=${status}` : ""}`),
  reviewArticle: (
    id: string,
    action: "approve" | "reject",
    rejectionReason?: string,
  ) =>
    api.post<{ success: boolean; message: string; data: VisitorArticle }>(
      `/visitor-articles/${id}/review`,
      { action, rejectionReason },
    ),
  /**
   * Administrator copy-edit. Narrower than the visitor's own edit: the booking
   * that proves the stay and the review status are not editable here.
   */
  adminUpdateArticle: (
    id: string,
    payload: {
      title?: string;
      category?: string;
      shortDescription?: string;
      content?: string;
      featuredImage?: string;
      videoUrl?: string;
      galleryImages?: string[];
      tags?: string[];
    },
  ) =>
    api.put<{ success: boolean; message: string; data: VisitorArticle }>(
      `/visitor-articles/admin/${id}`,
      payload,
    ),
  deleteArticle: (id: string) =>
    api.delete<{ success: boolean; message: string }>(
      `/visitor-articles/${id}`,
    ),

  // Public APIs
  getPublicArticles: (params?: {
    category?: string;
    ashramId?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<{
      success: boolean;
      count: number;
      total: number;
      data: VisitorArticle[];
    }>("/visitor-articles/public", { params }),
  getPublicArticleBySlug: (slug: string) =>
    api.get<{
      success: boolean;
      data: {
        article: VisitorArticle;
        comments: any[];
        relatedArticles: VisitorArticle[];
      };
    }>(`/visitor-articles/public/${slug}`),
  toggleLike: (id: string) =>
    api.post<{ success: boolean; liked: boolean; likesCount: number }>(
      `/visitor-articles/${id}/like`,
    ),
  /** `parentId` turns the comment into a reply. Threads are one level deep. */
  addComment: (id: string, comment: string, parentId?: string) =>
    api.post<{ success: boolean; message: string; data: any }>(
      `/visitor-articles/${id}/comments`,
      { comment, ...(parentId ? { parentId } : {}) },
    ),
};

export default visitorArticleService;
