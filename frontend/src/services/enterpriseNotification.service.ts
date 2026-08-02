import api from "../lib/api";

export const enterpriseNotificationService = {
  getStats: () => api.get("/enterprise-notifications/stats"),
  getActivities: (params?: Record<string, any>) =>
    api.get("/enterprise-notifications/activities", { params }),
  getNotifications: (params?: Record<string, any>) =>
    api.get("/enterprise-notifications/notifications", { params }),
  markRead: (id: string) =>
    api.patch(`/enterprise-notifications/notifications/${id}/read`),
  deleteNotification: (id: string) =>
    api.delete(`/enterprise-notifications/notifications/${id}`),
  bulkAction: (
    ids: string[],
    action: "delete" | "mark_read" | "mark_unread" | "archive",
  ) =>
    api.post("/enterprise-notifications/notifications/bulk", { ids, action }),
  seedTelemetry: () => api.post("/enterprise-notifications/seed"),
};
