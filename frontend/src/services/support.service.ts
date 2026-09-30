import api from "../lib/api";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_FOR_USER" | "RESOLVED" | "CLOSED" | "REOPENED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED", "REOPENED"];
export const TICKET_PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export interface SupportAttachment {
  _id?: string;
  attachmentId?: string;
  url: string;
  fileName: string;
  mimeType: string;
  bytes: number;
}

export interface SupportCategory {
  _id: string;
  key: string;
  label: string;
  description?: string;
  defaultPriority: TicketPriority;
  entityTypes: string[];
  handlerRoles?: string[];
  isActive?: boolean;
  sortOrder?: number;
  ticketCount?: number;
}

/** What a customer sees of their ticket. */
export interface CustomerTicket {
  _id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  categoryLabel: string;
  status: TicketStatus;
  relatedEntity: { type: string; reference: string; label: string } | null;
  attachments: SupportAttachment[];
  hasAgent: boolean;
  messageCount: number;
  unread: number;
  lastActivityAt: string;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  canReply: boolean;
  canClose: boolean;
  canReopen: boolean;
}

export interface CustomerMessage {
  _id: string;
  senderType: "user" | "staff" | "system";
  mine: boolean;
  senderName: string;
  body: string;
  attachments: SupportAttachment[];
  readAt: string | null;
  createdAt: string;
}

export interface CustomerTicketDetail extends CustomerTicket {
  messages: CustomerMessage[];
  activity: Array<{ _id: string; action: string; from: string; to: string; note: string; createdAt: string }>;
}

export interface PersonRef {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

/** A ticket as staff see it. */
export interface StaffTicket {
  _id: string;
  ticketNumber: string;
  userId: PersonRef | string;
  createdBy?: PersonRef | string | null;
  source: "web" | "admin";
  subject: string;
  description: string;
  category: string;
  categoryLabel: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: PersonRef | string | null;
  assignedAt?: string | null;
  isEscalated: boolean;
  escalation?: { at?: string; by?: string; reason?: string };
  relatedEntity?: { type?: string; entityId?: string; reference?: string; label?: string };
  attachments: SupportAttachment[];
  messageCount: number;
  unreadForStaff: number;
  lastActivityAt: string;
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  firstResponseAt?: string | null;
  firstResponseMinutes?: number | null;
  resolvedAt?: string | null;
  resolutionMinutes?: number | null;
  closedAt?: string | null;
  reopenedCount: number;
  createdAt: string;
  sla: { firstResponseOverdue: boolean; resolutionOverdue: boolean; breached: boolean };
}

export interface StaffMessage {
  _id: string;
  senderId?: string;
  senderRole: string;
  senderName: string;
  senderType: "user" | "staff" | "system";
  internal: boolean;
  body: string;
  attachments: SupportAttachment[];
  readAt: string | null;
  createdAt: string;
}

export interface EntitySummary {
  type: string;
  typeLabel: string;
  entityId: string | null;
  reference: string;
  title: string;
  exists: boolean;
  fields: Array<{ label: string; value: string | number | null; kind?: "money" | "date" | "status" | "text" }>;
}

export interface StaffTicketDetail {
  ticket: StaffTicket;
  messages: StaffMessage[];
  activity: Array<{ _id: string; action: string; from: string; to: string; note: string; actorName: string; actorRole: string; createdAt: string }>;
  relatedEntity: EntitySummary | null;
  customer: PersonRef & { status?: string; createdAt?: string; totalTickets: number; openTickets: number };
  permissions: { canAssignOthers: boolean; isSupervisor: boolean; transitions: TicketStatus[] };
}

export interface SupportStaffMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  isSupervisor: boolean;
  openTickets: number;
}

export interface LinkableRecord {
  entityId: string;
  reference: string;
  title: string;
  status: string;
  createdAt: string | null;
}

export interface SupportDashboard {
  scope: "all" | "own_queue";
  totals: Record<
    | "total" | "open" | "inProgress" | "waitingForUser" | "reopened" | "resolved" | "closed"
    | "urgentOpen" | "escalatedOpen" | "unassignedOpen" | "overdueOpen" | "resolvedToday" | "createdToday",
    number
  >;
  averages: { firstResponse: { minutes: number | null; sample: number }; resolution: { minutes: number | null; sample: number } };
  byStatus: Array<{ key: TicketStatus; count: number }>;
  byPriority: Array<{ key: TicketPriority; count: number }>;
  byCategory: Array<{ key: string; label: string; count: number }>;
  workload: Array<{ userId: string; name: string; role: string; open: number }>;
}

/** Record types a ticket can be linked to (mirrors the backend's LINKABLE_ENTITIES). */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  booking: "Stay booking",
  payment: "Payment",
  refund: "Refund",
  marketplace_order: "Marketplace order",
  marketplace_vendor_order: "Marketplace store order",
  aarti_booking: "Aarti / Pooja booking",
  parking_booking: "Parking booking",
  event_registration: "Event registration",
  ashram: "Hotel / Stay property",
  temple: "Temple",
  other: "Other (enter a reference)",
};

type RelatedInput = { type: string; entityId?: string; reference?: string };

export const supportApi = {
  categories: () => api.get("/support/categories"),
  linkable: (type: string) => api.get("/support/linkable", { params: { type }, skipToast: true }),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/support/attachments", form, { skipToast: true, timeout: 120_000 });
  },
  myTickets: (params: { page?: number; limit?: number; status?: string; search?: string }) =>
    api.get("/support/tickets", { params }),
  create: (data: { subject: string; description: string; category: string; relatedEntity?: RelatedInput; attachmentIds?: string[] }) =>
    api.post("/support/tickets", data),
  ticket: (id: string) => api.get(`/support/tickets/${id}`),
  reply: (id: string, body: string, attachmentIds?: string[]) =>
    api.post(`/support/tickets/${id}/messages`, { body, attachmentIds }, { skipToast: true }),
  close: (id: string) => api.post(`/support/tickets/${id}/close`, {}),
  reopen: (id: string, reason?: string) => api.post(`/support/tickets/${id}/reopen`, { reason }),
};

export const supportAdminApi = {
  dashboard: () => api.get("/support/admin/dashboard"),
  tickets: (params: Record<string, unknown>) => api.get("/support/admin/tickets", { params }),
  ticket: (id: string) => api.get(`/support/admin/tickets/${id}`),
  create: (data: Record<string, unknown>) => api.post("/support/admin/tickets", data),
  update: (id: string, data: { status?: string; priority?: string; category?: string; note?: string }) =>
    api.patch(`/support/admin/tickets/${id}`, data),
  assign: (id: string, assigneeId: string | null) => api.post(`/support/admin/tickets/${id}/assign`, { assigneeId }),
  escalate: (id: string, reason: string) => api.post(`/support/admin/tickets/${id}/escalate`, { reason }),
  reply: (id: string, data: { body: string; internal?: boolean; status?: string; attachmentIds?: string[] }) =>
    api.post(`/support/admin/tickets/${id}/messages`, data),
  link: (id: string, relatedEntity?: RelatedInput) => api.put(`/support/admin/tickets/${id}/related-entity`, { relatedEntity }),
  staff: () => api.get("/support/admin/staff"),
  customers: (search: string) => api.get("/support/admin/customers", { params: { search } }),
  customerLinkable: (userId: string, type: string) =>
    api.get(`/support/admin/customers/${userId}/linkable`, { params: { type }, skipToast: true }),
  categories: () => api.get("/support/admin/categories"),
  createCategory: (data: Partial<SupportCategory>) => api.post("/support/admin/categories", data),
  updateCategory: (id: string, data: Partial<SupportCategory>) => api.put(`/support/admin/categories/${id}`, data),
};
