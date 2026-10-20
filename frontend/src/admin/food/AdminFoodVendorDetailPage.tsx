import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Store } from "lucide-react";
import { EnterprisePageHeader } from "../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { toast } from "../../lib/toast";
import { Chips, Field, Panel, PanelState, askReason, inputClass } from "../../modules/marketplace/ui";
import type { LoadState } from "../../modules/marketplace/ui";
import { foodPartnerService } from "../../services/foodPartner.service";
import type { FoodPartnerProfile, FoodVendor } from "../../services/foodPartner.service";
import { FoodMenuManager } from "../../modules/food/FoodMenuManager";
import { FoodWalletView } from "../../modules/food/FoodWalletView";
import { VendorStatusPill } from "../../modules/food/foodUi";
import { VendorWorkspace } from "../../modules/food/VendorWorkspace";

const MOVES: Record<FoodVendor["status"], Array<{ to: FoodVendor["status"]; label: string; reason?: boolean; primary?: boolean }>> = {
  pending_verification: [
    { to: "active", label: "Approve", primary: true },
    { to: "rejected", label: "Reject", reason: true },
  ],
  active: [{ to: "suspended", label: "Suspend", reason: true }],
  suspended: [{ to: "active", label: "Reactivate", primary: true }],
  rejected: [{ to: "active", label: "Approve", primary: true }],
};

/**
 * The owner's details for review. Owners choose their own password when they register, so
 * the admin only reviews and approves; the one exception is a restaurant with no owner at
 * all (e.g. seeded data), where the admin can attach a login.
 */
const OwnerLoginPanel: React.FC<{ profile: FoodPartnerProfile; onChanged: () => void | Promise<unknown> }> = ({ profile, onChanged }) => {
  const { vendor, owner } = profile;
  const [form, setForm] = useState({ ownerName: vendor.contactName ?? "", email: vendor.contactEmail ?? "", phone: vendor.contactPhone ?? "", password: "" });
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await onChanged();
      return true;
    } catch {
      return false; // shown by the API layer
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast.success("Copied"), () => undefined);
  };

  return (
    <Panel title={owner ? "Owner details" : "Owner login"}>
      {owner ? (
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-black text-gray-400">Owner</p>
            <p className="font-bold">{owner.name || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-black text-gray-400">Email</p>
            <p className="font-bold break-all">
              {owner.email || "—"}
              {owner.email && <button type="button" className="text-[#F28C28] ml-1" onClick={() => copy(owner.email ?? "")}>Copy</button>}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-black text-gray-400">Mobile</p>
            <p className="font-bold">{owner.phone || "—"}</p>
          </div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => foodPartnerService.createOwnerLogin(vendor._id, form), "Owner login created");
          }}
        >
          <p className="text-xs text-amber-700 font-bold">This restaurant has no owner login yet. Create one so the owner can sign in and manage it.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Owner name" required><input className={inputClass} required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></Field>
            <Field label="Mobile number" required><input className={inputClass} required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+\s-]/g, "") })} /></Field>
            <Field label="Email" required><input type="email" className={inputClass} required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Password" required hint="Any password works, with no rules."><input className={inputClass} required autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          </div>
          <EnterpriseButton type="submit" size="sm" loading={busy} disabled={busy}>Create owner login</EnterpriseButton>
        </form>
      )}
    </Panel>
  );
};

/** One restaurant as the Super Admin sees it: status, owner login, kitchens, menu and inventory. */
export const AdminFoodVendorDetailPage: React.FC = () => {
  const { vendorId = "" } = useParams();
  const [params] = useSearchParams();
  const [profile, setProfile] = useState<FoodPartnerProfile | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  // The wallet list links here with ?tab=wallet.
  const [tab, setTab] = useState(params.get("tab") === "wallet" ? "wallet" : "menu");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await foodPartnerService.getVendor(vendorId));
      setState("ready");
    } catch (err: any) {
      setState(err?.response?.status === 404 ? "missing" : "error");
    }
  }, [vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state !== "ready" || !profile)
    return <PanelState state={state} onRetry={load} missingText="This restaurant no longer exists." />;

  const { vendor, owner } = profile;

  const move = async (to: FoodVendor["status"], needsReason?: boolean) => {
    let reason: string | undefined;
    if (needsReason) {
      reason = askReason(`Reason to ${to === "rejected" ? "reject" : "suspend"} "${vendor.businessName}":`) ?? undefined;
      if (!reason) return;
    }
    setBusy(true);
    try {
      await foodPartnerService.setVendorStatus(vendor._id, to, reason);
      toast.success("Status updated");
      await load();
    } catch {
      /* shown by the API layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/admin/food/vendors" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#F28C28]">
        <ArrowLeft size={13} /> All restaurants
      </Link>

      <EnterprisePageHeader
        title={vendor.businessName}
        subtitle={owner ? `Owner: ${owner.name ?? "—"} · ${owner.email ?? ""} · ${owner.phone ?? ""}` : "No owner account is attached to this restaurant."}
        icon={<Store size={20} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <VendorStatusPill status={vendor.status} />
            {MOVES[vendor.status]?.map((m) => (
              <EnterpriseButton key={m.to} size="sm" variant={m.primary ? "primary" : "outline"} disabled={busy} onClick={() => move(m.to, m.reason)}>
                {m.label}
              </EnterpriseButton>
            ))}
          </div>
        }
      />

      <OwnerLoginPanel profile={profile} onChanged={load} />

      <Chips
        value={tab}
        onChange={setTab}
        options={[
          { value: "menu", label: "Menu & Inventory" },
          { value: "profile", label: "Details & Kitchens" },
          { value: "wallet", label: "Wallet & Payments" },
        ]}
      />

      {tab === "menu" ? (
        <FoodMenuManager scope="admin" outlets={profile.outlets} />
      ) : tab === "wallet" ? (
        <FoodWalletView scope="admin" vendorId={vendor._id} />
      ) : (
        <VendorWorkspace scope="admin" profile={profile} onChanged={load} />
      )}

      {vendor.status !== "active" && (
        <Panel>
          <p className="text-xs text-gray-500">
            Customers cannot see or order from this restaurant while its status is “{vendor.status.replace(/_/g, " ")}”. You can still edit everything here.
          </p>
        </Panel>
      )}
    </div>
  );
};

export default AdminFoodVendorDetailPage;
