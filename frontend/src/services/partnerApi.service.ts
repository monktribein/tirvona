import api from "../lib/api";

export interface Partner {
  _id: string;
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone?: string;
  description?: string;
  environment: "sandbox" | "production";
  status: "active" | "suspended" | "revoked";
  allowedPermissions: string[];
  scopedAshramIds?: string[];
  rateLimitPerMinute: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyItem {
  _id: string;
  partnerId: string;
  name: string;
  keyPrefix: string;
  environment: "sandbox" | "production";
  permissions: string[];
  status: "active" | "revoked";
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyResponse {
  key: ApiKeyItem;
  rawSecret: string;
}

export interface WebhookItem {
  _id: string;
  partnerId: string;
  url: string;
  description?: string;
  subscribedEvents: string[];
  status: "active" | "inactive";
  secretLast4: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookResponse {
  webhook: WebhookItem;
  signingSecret: string;
}

export interface WebhookDeliveryLog {
  _id: string;
  eventId: string;
  webhookId: string;
  partnerId: string;
  url: string;
  eventType: string;
  status: "success" | "failed" | "pending";
  attemptNumber: number;
  responseStatusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number;
  deliveredAt: string;
}

export const partnerApiService = {
  // Partners
  async listPartners(): Promise<Partner[]> {
    const res = await api.get<{ success: boolean; data: Partner[] }>("/partners");
    return res.data.data;
  },

  async createPartner(payload: {
    name: string;
    slug: string;
    contactEmail: string;
    contactPhone?: string;
    description?: string;
    environment: "sandbox" | "production";
    allowedPermissions: string[];
  }): Promise<Partner> {
    const res = await api.post<{ success: boolean; data: Partner }>("/partners", payload);
    return res.data.data;
  },

  async updatePartner(partnerId: string, payload: Partial<Partner>): Promise<Partner> {
    const res = await api.patch<{ success: boolean; data: Partner }>(`/partners/${partnerId}`, payload);
    return res.data.data;
  },

  // API Keys
  async listApiKeys(partnerId: string): Promise<ApiKeyItem[]> {
    const res = await api.get<{ success: boolean; data: ApiKeyItem[] }>(`/partners/${partnerId}/keys`);
    return res.data.data;
  },

  async createApiKey(
    partnerId: string,
    payload: {
      name: string;
      environment: "sandbox" | "production";
      permissions: string[];
      expiresAt?: string;
    },
  ): Promise<CreateApiKeyResponse> {
    const res = await api.post<{ success: boolean; data: CreateApiKeyResponse }>(
      `/partners/${partnerId}/keys`,
      payload,
    );
    return res.data.data;
  },

  async revokeApiKey(keyId: string): Promise<ApiKeyItem> {
    const res = await api.post<{ success: boolean; data: ApiKeyItem }>(`/partners/keys/${keyId}/revoke`);
    return res.data.data;
  },

  async rotateApiKey(keyId: string): Promise<CreateApiKeyResponse> {
    const res = await api.post<{ success: boolean; data: CreateApiKeyResponse }>(`/partners/keys/${keyId}/rotate`);
    return res.data.data;
  },

  // Webhooks
  async listWebhooks(partnerId?: string): Promise<WebhookItem[]> {
    const res = await api.get<{ success: boolean; data: WebhookItem[] }>(
      `/partners/webhooks${partnerId ? `?partnerId=${partnerId}` : ""}`,
    );
    return res.data.data;
  },

  async createWebhook(
    partnerId: string,
    payload: {
      url: string;
      description?: string;
      subscribedEvents: string[];
    },
  ): Promise<CreateWebhookResponse> {
    const res = await api.post<{ success: boolean; data: CreateWebhookResponse }>(
      `/partners/${partnerId}/webhooks`,
      payload,
    );
    return res.data.data;
  },

  async updateWebhook(webhookId: string, payload: Partial<WebhookItem>): Promise<WebhookItem> {
    const res = await api.patch<{ success: boolean; data: WebhookItem }>(
      `/partners/webhooks/${webhookId}`,
      payload,
    );
    return res.data.data;
  },

  async deleteWebhook(webhookId: string): Promise<void> {
    await api.delete(`/partners/webhooks/${webhookId}`);
  },

  async rotateWebhookSecret(webhookId: string): Promise<CreateWebhookResponse> {
    const res = await api.post<{ success: boolean; data: CreateWebhookResponse }>(
      `/partners/webhooks/${webhookId}/rotate-secret`,
    );
    return res.data.data;
  },

  // Deliveries
  async listDeliveries(params?: {
    webhookId?: string;
    partnerId?: string;
    status?: string;
  }): Promise<WebhookDeliveryLog[]> {
    const query = new URLSearchParams();
    if (params?.webhookId) query.set("webhookId", params.webhookId);
    if (params?.partnerId) query.set("partnerId", params.partnerId);
    if (params?.status) query.set("status", params.status);

    const res = await api.get<{ success: boolean; data: WebhookDeliveryLog[] }>(
      `/partners/deliveries?${query.toString()}`,
    );
    return res.data.data;
  },

  async retryDelivery(deliveryId: string): Promise<{ success: boolean; eventId: string }> {
    const res = await api.post<{ success: boolean; data: { success: boolean; eventId: string } }>(
      `/partners/deliveries/${deliveryId}/retry`,
    );
    return res.data.data;
  },
};
