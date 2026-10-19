import { Paginated } from "../../components/shared/Pagination";
import React, { useState, useEffect } from "react";
import {
  Key,
  Webhook,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Send,
  AlertTriangle,
} from "lucide-react";
import { EnterprisePageHeader } from "../shared/components/EnterprisePageHeader";
import { IntegrationGuide } from "./IntegrationGuide";
import {
  partnerApiService,
  type Partner,
  type ApiKeyItem,
  type WebhookItem,
  type WebhookDeliveryLog,
} from "../../services/partnerApi.service";

export const DeveloperApiPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Status alerts & action states
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // Modals & Secrets
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Partner Modal
  const [showCreatePartner, setShowCreatePartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerSlug, setNewPartnerSlug] = useState("");
  const [newPartnerEmail, setNewPartnerEmail] = useState("");
  const [newPartnerEnv, setNewPartnerEnv] = useState<"sandbox" | "production">("sandbox");
  const [newPartnerPermissions, setNewPartnerPermissions] = useState<string[]>([
    "bookings.read",
    "inventory.read",
    "payments.read",
  ]);

  // New API Key Modal
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<"sandbox" | "production">("sandbox");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([
    "bookings.read",
    "inventory.read",
    "payments.read",
  ]);
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);

  // New Webhook Modal
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([
    "booking.created",
    "booking.status_changed",
    "booking.cancelled",
    "payment.succeeded",
    "payment.failed",
  ]);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);

  // Filters
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | "success" | "failed">("all");

  const loadData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const pList = await partnerApiService.listPartners();
      setPartners(pList);
      if (pList.length > 0) {
        const defaultPartner = selectedPartner || pList[0];
        setSelectedPartner(defaultPartner);
        const [kList, wList, dList] = await Promise.all([
          partnerApiService.listApiKeys(defaultPartner._id),
          partnerApiService.listWebhooks(defaultPartner._id),
          partnerApiService.listDeliveries({ partnerId: defaultPartner._id }),
        ]);
        setApiKeys(kList);
        setWebhooks(wList);
        setDeliveries(dList);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to load partner developer data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPartner = async (p: Partner) => {
    setSelectedPartner(p);
    setActionError(null);
    try {
      const [kList, wList, dList] = await Promise.all([
        partnerApiService.listApiKeys(p._id),
        partnerApiService.listWebhooks(p._id),
        partnerApiService.listDeliveries({ partnerId: p._id }),
      ]);
      setApiKeys(kList);
      setWebhooks(wList);
      setDeliveries(dList);
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to load partner details");
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreatePartner = async () => {
    if (!newPartnerName.trim() || !newPartnerSlug.trim() || !newPartnerEmail.trim()) {
      setActionError("Organization name, slug, and contact email are required.");
      return;
    }
    if (newPartnerPermissions.length === 0) {
      setActionError("Please select at least one permission for the partner.");
      return;
    }
    setActionError(null);
    try {
      const created = await partnerApiService.createPartner({
        name: newPartnerName.trim(),
        slug: newPartnerSlug.trim().toLowerCase(),
        contactEmail: newPartnerEmail.trim().toLowerCase(),
        environment: newPartnerEnv,
        allowedPermissions: newPartnerPermissions,
      });
      setPartners([created, ...partners]);
      setSelectedPartner(created);
      setShowCreatePartner(false);
      setNewPartnerName("");
      setNewPartnerSlug("");
      setNewPartnerEmail("");
      setActionSuccess(`Partner "${created.name}" created successfully.`);
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to create partner");
    }
  };

  const handleCreateKey = async () => {
    if (!selectedPartner || !newKeyName.trim()) {
      setActionError("Key name/description is required.");
      return;
    }
    if (newKeyPermissions.length === 0) {
      setActionError("Please select at least one permission for the API key.");
      return;
    }
    setActionError(null);
    try {
      const res = await partnerApiService.createApiKey(selectedPartner._id, {
        name: newKeyName.trim(),
        environment: newKeyEnv,
        permissions: newKeyPermissions,
      });
      setApiKeys([res.key, ...apiKeys]);
      setCreatedKeySecret(res.rawSecret);
      setNewKeyName("");
      setActionSuccess(`API Key "${res.key.name}" generated.`);
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to create API key");
    }
  };

  const handleRevokeKey = async (id: string) => {
    setActionError(null);
    try {
      const updated = await partnerApiService.revokeApiKey(id);
      setApiKeys(apiKeys.map((k) => (k._id === id ? updated : k)));
      setActionSuccess("API key revoked successfully.");
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to revoke API key");
    }
  };

  const handleRotateKey = async (id: string) => {
    setActionError(null);
    try {
      const res = await partnerApiService.rotateApiKey(id);
      setApiKeys([res.key, ...apiKeys.filter((k) => k._id !== id)]);
      setCreatedKeySecret(res.rawSecret);
      setShowCreateKey(true);
      setActionSuccess("API key rotated. Save the new secret immediately.");
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to rotate API key");
    }
  };

  const handleCreateWebhook = async () => {
    if (!selectedPartner || !newWebhookUrl.trim()) {
      setActionError("Webhook HTTPS callback URL is required.");
      return;
    }
    if (newWebhookEvents.length === 0) {
      setActionError("Please subscribe to at least one event.");
      return;
    }
    setActionError(null);
    try {
      const res = await partnerApiService.createWebhook(selectedPartner._id, {
        url: newWebhookUrl.trim(),
        subscribedEvents: newWebhookEvents,
      });
      setWebhooks([res.webhook, ...webhooks]);
      setCreatedWebhookSecret(res.signingSecret);
      setNewWebhookUrl("");
      setActionSuccess("Webhook registered successfully. Save the signing secret.");
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to register webhook");
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    setActionError(null);
    try {
      await partnerApiService.deleteWebhook(id);
      setWebhooks(webhooks.filter((w) => w._id !== id));
      setActionSuccess("Webhook endpoint deleted.");
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to delete webhook");
    }
  };

  const refreshDeliveries = async (partnerId: string) => {
    setDeliveries(await partnerApiService.listDeliveries({ partnerId }));
  };

  const handleTestWebhook = async (id: string) => {
    setTestingWebhookId(id);
    setActionError(null);
    try {
      await partnerApiService.testWebhook(id);
      setActionSuccess("Test event queued. Its result appears in Webhook Deliveries in a few seconds.");
      if (selectedPartner) {
        // the worker delivers asynchronously: look again shortly after
        setTimeout(() => void refreshDeliveries(selectedPartner._id).catch(() => undefined), 2500);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to send test event");
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleToggleWebhook = async (w: WebhookItem) => {
    setActionError(null);
    try {
      const updated = await partnerApiService.updateWebhook(w._id, {
        status: w.status === "active" ? "inactive" : "active",
      });
      setWebhooks(webhooks.map((x) => (x._id === w._id ? updated : x)));
      setActionSuccess(`Webhook ${updated.status === "active" ? "activated" : "paused"}.`);
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to update webhook");
    }
  };

  const handleRotateWebhookSecret = async (id: string) => {
    setActionError(null);
    try {
      const res = await partnerApiService.rotateWebhookSecret(id);
      setWebhooks(webhooks.map((w) => (w._id === id ? res.webhook : w)));
      setCreatedWebhookSecret(res.signingSecret);
      setShowCreateWebhook(true);
      setActionSuccess("Webhook secret rotated. Update your receiver signature verification.");
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to rotate webhook secret");
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    setRetryingDeliveryId(deliveryId);
    setActionError(null);
    try {
      const res = await partnerApiService.retryDelivery(deliveryId);
      setActionSuccess(`Webhook delivery retry queued successfully (Event ID: ${res.eventId.slice(0, 10)}...).`);
      if (selectedPartner) {
        const dList = await partnerApiService.listDeliveries({ partnerId: selectedPartner._id });
        setDeliveries(dList);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to retry webhook delivery");
    } finally {
      setRetryingDeliveryId(null);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      Active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
      active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
      success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
      Inactive: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700",
      inactive: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700",
      revoked: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
      failed: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
      pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${map[s] ?? map.Inactive}`}
      >
        {s === "active" || s === "success" ? (
          <CheckCircle2 size={11} />
        ) : s === "failed" || s === "revoked" ? (
          <XCircle size={11} />
        ) : (
          <Clock size={11} />
        )}
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    );
  };

  const filteredDeliveries =
    deliveryFilter === "all"
      ? deliveries
      : deliveries.filter((d) => d.status === deliveryFilter);

  return (
    <div className="space-y-6 pb-10">
      <EnterprisePageHeader
        title="Developer API & Webhooks"
        subtitle="Manage partner credentials, API keys, webhook endpoints, and event delivery"
        icon={<Key size={22} />}
        badgeText="Super Admin"
      />

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Partner Selector Banner */}
      <div className="bg-white dark:bg-[#0B192C] rounded-[22px] border border-gray-100 dark:border-slate-800 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F28C28]/10 text-[#F28C28] flex items-center justify-center border border-[#F28C28]/15">
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Partner</span>
              {selectedPartner && statusBadge(selectedPartner.status)}
            </div>
            <select
              value={selectedPartner?._id || ""}
              onChange={(e) => {
                const found = partners.find((p) => p._id === e.target.value);
                if (found) handleSelectPartner(found);
              }}
              className="mt-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-[#0B192C] dark:text-white outline-none focus:border-[#F28C28]"
            >
              {partners.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.environment})
                </option>
              ))}
              {partners.length === 0 && <option value="">No partners found</option>}
            </select>
          </div>
        </div>

        <button
          onClick={() => setShowCreatePartner(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F28C28] text-white text-xs font-bold hover:bg-[#e07d1e] transition-colors shadow-sm"
        >
          <Plus size={14} /> Add Partner
        </button>
      </div>

      {/* ─── Top cards: API Keys & Webhooks ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* API Keys Card */}
        <div className="bg-white dark:bg-[#0B192C] rounded-[22px] border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#F28C28]/10 text-[#F28C28] flex items-center justify-center border border-[#F28C28]/15">
                <Key size={17} />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0B192C] dark:text-white">API Keys</h3>
                <p className="text-[11px] text-gray-400 font-semibold">Scoped to {selectedPartner?.name || "Partner"}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setCreatedKeySecret(null);
                setShowCreateKey(true);
              }}
              disabled={!selectedPartner}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F28C28] text-white text-xs font-bold hover:bg-[#e07d1e] transition-colors disabled:opacity-50"
            >
              <Plus size={13} /> Generate Key
            </button>
          </div>

          <div className="space-y-3">
            {apiKeys.map((k) => (
              <div
                key={k._id}
                className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0B192C] dark:text-white">{k.name}</span>
                  {statusBadge(k.status)}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-[11px] font-mono text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-gray-100 dark:border-slate-700 flex-1 truncate">
                    {k.keyPrefix}••••••••••••••••••••••••
                  </code>
                  <div className="flex items-center gap-1">
                    {k.status === "active" && (
                      <>
                        <button
                          onClick={() => handleRotateKey(k._id)}
                          title="Rotate key"
                          className="p-1 rounded text-gray-400 hover:text-amber-500 transition-colors"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          onClick={() => handleRevokeKey(k._id)}
                          title="Revoke key"
                          className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                  <span>Env: {k.environment}</span>
                  <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {apiKeys.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4 font-medium">No API keys generated yet.</p>
            )}
          </div>
        </div>

        {/* Webhooks Card */}
        <div className="bg-white dark:bg-[#0B192C] rounded-[22px] border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/15">
                <Webhook size={17} />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0B192C] dark:text-white">Webhooks</h3>
                <p className="text-[11px] text-gray-400 font-semibold">HTTPS callbacks with HMAC signatures</p>
              </div>
            </div>
            <button
              onClick={() => {
                setCreatedWebhookSecret(null);
                setShowCreateWebhook(true);
              }}
              disabled={!selectedPartner}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Plus size={13} /> Add Webhook
            </button>
          </div>

          <div className="space-y-3">
            {webhooks.map((w) => (
              <div
                key={w._id}
                className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#0B192C] dark:text-white truncate max-w-[240px]">
                    {w.url}
                  </span>
                  {statusBadge(w.status)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {w.subscribedEvents.map((evt) => (
                    <span
                      key={evt}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60"
                    >
                      {evt}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                  <span>Signing Secret: ••••{w.secretLast4}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTestWebhook(w._id)}
                      disabled={w.status !== "active" || testingWebhookId === w._id}
                      title={w.status === "active" ? "Send a signed test event" : "Activate the webhook to send a test"}
                      className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 text-[11px] font-bold text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50 dark:bg-purple-950/40 dark:text-purple-300"
                    >
                      <Send size={11} className={testingWebhookId === w._id ? "animate-pulse" : ""} /> Send test
                    </button>
                    <button
                      onClick={() => handleToggleWebhook(w)}
                      className="rounded-lg px-2 py-1 text-[11px] font-bold text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                      {w.status === "active" ? "Pause" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleRotateWebhookSecret(w._id)}
                      title="Rotate signing secret"
                      className="p-1 rounded text-gray-400 hover:text-amber-500 transition-colors"
                    >
                      <RefreshCw size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(w._id)}
                      title="Delete webhook"
                      className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {webhooks.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4 font-medium">No webhooks registered yet.</p>
            )}
          </div>
        </div>
      </div>

      <IntegrationGuide />

      {/* ─── Webhook Deliveries List ─── */}
      <div className="bg-white dark:bg-[#0B192C] rounded-[22px] border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/15">
              <Send size={17} />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#0B192C] dark:text-white">Webhook Deliveries</h3>
              <p className="text-[11px] text-gray-400 font-semibold">Delivery logs & status for {selectedPartner?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900 p-1 rounded-xl border border-gray-100 dark:border-slate-800">
            {(["all", "success", "failed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setDeliveryFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  deliveryFilter === f
                    ? "bg-white dark:bg-slate-800 text-[#0B192C] dark:text-white shadow-xs"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <Paginated items={filteredDeliveries} pageSize={15}>
          {(pageItems) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 font-bold">
                  <th className="pb-3">Event</th>
                  <th className="pb-3">Destination</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">HTTP Code</th>
                  <th className="pb-3">Latency</th>
                  <th className="pb-3">Delivered At</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50 font-medium">
                {pageItems.map((d) => (
                  <tr key={d._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-900/30">
                    <td className="py-3 font-mono font-bold text-[#0B192C] dark:text-white">{d.eventType}</td>
                    <td className="py-3 text-gray-500 truncate max-w-[200px]">{d.url}</td>
                    <td className="py-3">{statusBadge(d.status)}</td>
                    <td className="py-3 font-mono">{d.responseStatusCode ?? "—"}</td>
                    <td className="py-3 text-gray-400">{d.durationMs}ms</td>
                    <td className="py-3 text-gray-400">{new Date(d.deliveredAt).toLocaleTimeString()}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleRetryDelivery(d._id)}
                        disabled={retryingDeliveryId === d._id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F28C28]/10 hover:bg-[#F28C28]/20 text-[#F28C28] dark:bg-[#F28C28]/15 dark:text-[#F28C28] text-[11px] font-bold transition-all disabled:opacity-50"
                        title="Retry webhook delivery"
                      >
                        <RefreshCw size={11} className={retryingDeliveryId === d._id ? "animate-spin" : ""} />
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-400">
                      No delivery logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </Paginated>
      </div>

      {/* ─── Modal: Create Partner ─── */}
      {showCreatePartner && (
        <div className="tv-drawer-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="tv-drawer-panel bg-white dark:bg-[#0B192C] rounded-[24px] border border-gray-100 dark:border-slate-800 p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-black text-[#0B192C] dark:text-white">Add New Partner</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-500 block mb-1">Partner Organization Name</label>
                <input
                  type="text"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  placeholder="e.g. Cleartrip Global"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-gray-500 block mb-1">Slug (Identifier)</label>
                <input
                  type="text"
                  value={newPartnerSlug}
                  onChange={(e) => setNewPartnerSlug(e.target.value)}
                  placeholder="e.g. cleartrip"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-gray-500 block mb-1">Contact Email</label>
                <input
                  type="email"
                  value={newPartnerEmail}
                  onChange={(e) => setNewPartnerEmail(e.target.value)}
                  placeholder="api@partner.com"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-gray-500 block mb-1">Environment</label>
                <select
                  value={newPartnerEnv}
                  onChange={(e) => setNewPartnerEnv(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-gray-500 block mb-1">Allowed Permissions</label>
                <div className="space-y-1.5 pt-1">
                  {[
                    { id: "bookings.read", label: "bookings.read — Query booking lists & details" },
                    { id: "inventory.read", label: "inventory.read — Check room availability & pricing" },
                    { id: "payments.read", label: "payments.read — Query payment transaction status" },
                  ].map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPartnerPermissions.includes(perm.id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewPartnerPermissions([...newPartnerPermissions, perm.id]);
                          else setNewPartnerPermissions(newPartnerPermissions.filter((x) => x !== perm.id));
                        }}
                        className="rounded text-[#F28C28] focus:ring-[#F28C28]"
                      />
                      <span className="text-[11px] text-[#0B192C] dark:text-white font-medium">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreatePartner(false)}
                className="px-4 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePartner}
                className="px-4 py-2 rounded-xl bg-[#F28C28] text-white font-bold hover:bg-[#e07d1e] text-xs"
              >
                Create Partner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Create API Key ─── */}
      {showCreateKey && (
        <div className="tv-drawer-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="tv-drawer-panel bg-white dark:bg-[#0B192C] rounded-[24px] border border-gray-100 dark:border-slate-800 p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-black text-[#0B192C] dark:text-white">
              {createdKeySecret ? "API Key Secret" : "Generate API Key"}
            </h3>

            {createdKeySecret ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Copy this key secret now. <strong>It will never be shown again.</strong>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={createdKeySecret}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 font-mono text-xs font-bold select-all pr-10"
                  />
                  <button
                    onClick={() => handleCopy(createdKeySecret, "new-secret")}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {copiedId === "new-secret" ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setCreatedKeySecret(null);
                      setShowCreateKey(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#F28C28] text-white font-bold hover:bg-[#e07d1e]"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-500 block mb-1">Key Name / Description</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Sync Worker Server"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-500 block mb-1">Environment</label>
                  <select
                    value={newKeyEnv}
                    onChange={(e) => setNewKeyEnv(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 font-semibold"
                  >
                    <option value="sandbox">Sandbox (tv_test_...)</option>
                    <option value="production">Production (tv_live_...)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-500 block mb-1">Key Permissions</label>
                  <div className="space-y-1.5 pt-1">
                    {(selectedPartner?.allowedPermissions || ["bookings.read", "inventory.read", "payments.read"]).map((perm) => (
                      <label key={perm} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newKeyPermissions.includes(perm)}
                          onChange={(e) => {
                            if (e.target.checked) setNewKeyPermissions([...newKeyPermissions, perm]);
                            else setNewKeyPermissions(newKeyPermissions.filter((x) => x !== perm));
                          }}
                          className="rounded text-[#F28C28] focus:ring-[#F28C28]"
                        />
                        <span className="font-mono text-[11px] text-[#0B192C] dark:text-white font-medium">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCreateKey(false)}
                    className="px-4 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateKey}
                    className="px-4 py-2 rounded-xl bg-[#F28C28] text-white font-bold hover:bg-[#e07d1e]"
                  >
                    Generate
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal: Create Webhook ─── */}
      {showCreateWebhook && (
        <div className="tv-drawer-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="tv-drawer-panel bg-white dark:bg-[#0B192C] rounded-[24px] border border-gray-100 dark:border-slate-800 p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-black text-[#0B192C] dark:text-white">
              {createdWebhookSecret ? "Webhook Signing Secret" : "Add Webhook Endpoint"}
            </h3>

            {createdWebhookSecret ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200 flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Copy this signing secret now. Use it to verify incoming <code>X-Tirvona-Signature</code> headers.
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={createdWebhookSecret}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 font-mono text-xs font-bold select-all pr-10"
                  />
                  <button
                    onClick={() => handleCopy(createdWebhookSecret, "wh-secret")}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {copiedId === "wh-secret" ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setCreatedWebhookSecret(null);
                      setShowCreateWebhook(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-500 block mb-1">HTTPS Callback URL</label>
                  <input
                    type="url"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    placeholder="https://api.partner.com/webhooks/tirvona"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-500 block mb-1">Subscribed Events</label>
                  <div className="space-y-1.5 pt-1">
                    {[
                      "booking.created",
                      "booking.status_changed",
                      "booking.cancelled",
                      "payment.succeeded",
                      "payment.failed",
                    ].map((evt) => (
                      <label key={evt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newWebhookEvents.includes(evt)}
                          onChange={(e) => {
                            if (e.target.checked) setNewWebhookEvents([...newWebhookEvents, evt]);
                            else setNewWebhookEvents(newWebhookEvents.filter((x) => x !== evt));
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-mono text-[11px] text-[#0B192C] dark:text-white">{evt}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCreateWebhook(false)}
                    className="px-4 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateWebhook}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700"
                  >
                    Register Webhook
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperApiPage;
