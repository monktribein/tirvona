import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  smartContactService,
  type SmartContactProfile,
  type SmartContactQr,
} from "../../../services/smartContact.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  EnterpriseButton,
  EnterprisePageHeader,
  EnterpriseStatusBadge,
} from "../../shared";
import { ProfileFormModal } from "../components/ProfileFormModal";
import { QrPanel } from "../components/QrPanel";
import { AnalyticsPanel } from "../components/AnalyticsPanel";
import { AuditPanel } from "../components/AuditPanel";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ContactRound,
  Copy,
  ExternalLink,
  Archive,
  Loader2,
  Pencil,
} from "lucide-react";

type Tab = "overview" | "qr" | "analytics" | "audit";

const badgeStatus = (status: string): string =>
  status === "ACTIVE"
    ? "active"
    : status === "DRAFT"
      ? "pending"
      : status === "SUSPENDED"
        ? "suspended"
        : "archived";

const DetailRow: React.FC<{ label: string; value?: string }> = ({
  label,
  value,
}) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 dark:border-slate-800/60 last:border-0">
    <span className="text-[11px] font-black uppercase tracking-wide text-gray-400 shrink-0">
      {label}
    </span>
    <span className="text-xs font-bold text-[#0B192C] dark:text-white text-right break-words">
      {value || "—"}
    </span>
  </div>
);

export const SmartContactProfileDetailPage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<SmartContactProfile | null>(null);
  const [qrCodes, setQrCodes] = useState<SmartContactQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>(() =>
    window.location.hash === "#qr" ? "qr" : "overview",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await smartContactService.get(id);
      setProfile(res.data.data.profile);
      setQrCodes(res.data.data.qrCodes ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load this profile."));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (
    action: "activate" | "disable" | "archive",
  ): Promise<void> => {
    setBusy(true);
    try {
      const res = await smartContactService[action](id);
      toast.success(
        (res.data as { message?: string }).message ?? "Profile updated",
      );
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not change the profile status."));
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(profile.profileUrl);
      toast.success("Profile URL copied");
    } catch {
      toast.error("Could not copy the URL.");
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/smart-contacts"
          className="inline-flex items-center gap-2 text-xs font-black text-[#0A4DA6]"
        >
          <ArrowLeft size={14} /> Back to Smart Contacts
        </Link>
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300">
          {error || "Profile not found."}
        </div>
      </div>
    );
  }

  const address = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.state,
    profile.postalCode,
    profile.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-5">
      <Link
        to="/admin/smart-contacts"
        className="inline-flex items-center gap-2 text-xs font-black text-[#0A4DA6] hover:underline"
      >
        <ArrowLeft size={14} /> Back to Smart Contacts
      </Link>

      <EnterprisePageHeader
        title={profile.displayName}
        subtitle={
          [profile.designation, profile.roleLine].filter(Boolean).join(" · ") ||
          "Smart Contact profile"
        }
        icon={<ContactRound size={20} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <EnterpriseStatusBadge status={badgeStatus(profile.status)} />
            <EnterpriseButton variant="outline" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit
            </EnterpriseButton>
            {profile.status !== "ACTIVE" ? (
              <EnterpriseButton
                variant="success"
                disabled={busy}
                onClick={() => void changeStatus("activate")}
              >
                <CheckCircle2 size={14} /> Activate
              </EnterpriseButton>
            ) : (
              <EnterpriseButton
                variant="warning"
                disabled={busy}
                onClick={() => void changeStatus("disable")}
              >
                <Ban size={14} /> Disable
              </EnterpriseButton>
            )}
            {profile.status !== "ARCHIVED" && (
              <EnterpriseButton
                variant="danger"
                disabled={busy}
                onClick={() => void changeStatus("archive")}
              >
                <Archive size={14} /> Archive
              </EnterpriseButton>
            )}
          </div>
        }
      />

      <div className="bg-[#0B192C] text-white rounded-[24px] p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
            Permanent profile URL
          </p>
          <p className="text-sm font-bold truncate">{profile.profileUrl}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void copyUrl()}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-black inline-flex items-center gap-1.5"
          >
            <Copy size={13} /> Copy
          </button>
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-black inline-flex items-center gap-1.5"
          >
            <ExternalLink size={13} /> Open
          </a>
        </div>
      </div>

      {profile.status !== "ACTIVE" && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs font-bold text-amber-800 dark:text-amber-300">
          {profile.status === "DRAFT"
            ? "This profile is a draft. Its URL returns 404 until you activate it."
            : "This profile is not active. Its URL still resolves and shows the “no longer active” notice, so printed cards never become dead links."}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["qr", "QR Codes"],
            ["analytics", "Analytics"],
            ["audit", "Audit Trail"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`px-4 py-2 rounded-xl text-xs font-black border transition-colors ${
              tab === value
                ? "bg-[#0A4DA6] text-white border-[#0A4DA6]"
                : "bg-white dark:bg-[#0B192C] text-[#0B192C] dark:text-white border-gray-200 dark:border-slate-800 hover:border-[#0A4DA6]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-sm flex flex-col items-center text-center gap-3">
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={profile.displayName}
                className="w-28 h-28 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] grid place-items-center text-2xl font-black">
                {profile.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-base font-black text-[#0B192C] dark:text-white">
                {profile.displayName}
              </p>
              <p className="text-xs font-bold text-[#0A4DA6]">
                {profile.designation || "—"}
              </p>
              <p className="text-[11px] text-gray-500">{profile.roleLine}</p>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-sm">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A4DA6] mb-2">
              Contact details
            </h4>
            <DetailRow label="Slug" value={profile.slug} />
            <DetailRow label="Employee ID" value={profile.employeeId} />
            <DetailRow label="Company" value={profile.organization} />
            <DetailRow label="Department" value={profile.department} />
            <DetailRow label="Primary mobile" value={profile.primaryPhone} />
            <DetailRow label="Secondary mobile" value={profile.secondaryPhone} />
            <DetailRow label="WhatsApp" value={profile.whatsappPhone} />
            <DetailRow label="Email" value={profile.email} />
            <DetailRow label="Website" value={profile.website} />
            <DetailRow label="Office address" value={address} />
            <DetailRow label="Audience" value={profile.category} />
            <DetailRow
              label="Last updated by"
              value={profile.updatedBy?.name ?? "—"}
            />
          </div>
        </div>
      )}

      {tab === "qr" && (
        <QrPanel
          profile={profile}
          qrCodes={qrCodes}
          onChanged={() => void load()}
        />
      )}

      {tab === "analytics" && <AnalyticsPanel profileId={profile.id} />}

      {tab === "audit" && <AuditPanel profileId={profile.id} />}

      {editing && (
        <ProfileFormModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}
    </div>
  );
};

export default SmartContactProfileDetailPage;
