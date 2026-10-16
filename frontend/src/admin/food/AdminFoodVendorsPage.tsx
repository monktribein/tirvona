import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Store, UserPlus } from "lucide-react";
import { EnterprisePageHeader } from "../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { toast } from "../../lib/toast";
import {
  Chips, Field, Panel, PanelState, ResponsiveTable, askReason, inputClass, shortDate,
} from "../../modules/marketplace/ui";
import type { LoadState } from "../../modules/marketplace/ui";
import { foodPartnerService } from "../../services/foodPartner.service";
import type { FoodOutletInput, FoodVendor } from "../../services/foodPartner.service";
import { OutletForm, VendorStatusPill } from "../../modules/food/foodUi";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending_verification", label: "Awaiting approval" },
  { value: "active", label: "Live" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
];

/** Status moves offered from each state; reject and suspend ask for a reason. */
const ACTIONS: Record<FoodVendor["status"], Array<{ to: FoodVendor["status"]; label: string; reason?: boolean; primary?: boolean }>> = {
  pending_verification: [
    { to: "active", label: "Approve", primary: true },
    { to: "rejected", label: "Reject", reason: true },
  ],
  active: [{ to: "suspended", label: "Suspend", reason: true }],
  suspended: [{ to: "active", label: "Reactivate", primary: true }],
  rejected: [{ to: "active", label: "Approve", primary: true }],
};

const CreateRestaurant: React.FC<{ onCreated: (id: string) => void; onCancel: () => void }> = ({ onCreated, onCancel }) => {
  const [owner, setOwner] = useState({ ownerName: "", email: "", phone: "", password: "" });
  const [business, setBusiness] = useState({ businessName: "", fssaiReference: "" });
  const [approve, setApprove] = useState(true);
  const [busy, setBusy] = useState(false);
  const ownerOk =
    owner.ownerName.trim().length >= 2 &&
    /^\S+@\S+\.\S+$/.test(owner.email) &&
    /^\+?[0-9][0-9\s-]{6,17}$/.test(owner.phone) &&
    owner.password.length >= 1 &&
    business.businessName.trim().length >= 2;

  const create = async (outlet: FoodOutletInput) => {
    if (!ownerOk) {
      toast.warning("Fill the owner login and restaurant name first");
      return;
    }
    setBusy(true);
    try {
      const created = await foodPartnerService.createVendor({
        ownerName: owner.ownerName.trim(),
        email: owner.email.trim(),
        phone: owner.phone.trim(),
        password: owner.password,
        businessName: business.businessName.trim(),
        contactName: owner.ownerName.trim(),
        contactPhone: owner.phone.trim(),
        contactEmail: owner.email.trim(),
        ...(business.fssaiReference.trim() ? { fssaiReference: business.fssaiReference.trim() } : {}),
        approve,
        outlet,
      });
      toast.success(approve ? "Restaurant created and approved" : "Restaurant created. Approve it when ready.");
      onCreated(created.vendor._id);
    } catch {
      /* shown by the API layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Create restaurant account">
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">Owner login</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Owner name" required>
              <input className={inputClass} value={owner.ownerName} onChange={(e) => setOwner({ ...owner, ownerName: e.target.value })} />
            </Field>
            <Field label="Mobile number" required>
              <input className={inputClass} inputMode="tel" value={owner.phone} onChange={(e) => setOwner({ ...owner, phone: e.target.value.replace(/[^\d+\s-]/g, "") })} placeholder="+91 98xxx xxxxx" />
            </Field>
            <Field label="Email" required>
              <input type="email" className={inputClass} value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} />
            </Field>
            <Field label="Password" required hint="Any password works, with no rules. Share it with the owner.">
              <input className={inputClass} autoComplete="off" value={owner.password} onChange={(e) => setOwner({ ...owner, password: e.target.value })} />
            </Field>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">Restaurant</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Restaurant / business name" required>
              <input className={inputClass} value={business.businessName} onChange={(e) => setBusiness({ ...business, businessName: e.target.value })} />
            </Field>
            <Field label="FSSAI number">
              <input className={inputClass} maxLength={40} value={business.fssaiReference} onChange={(e) => setBusiness({ ...business, fssaiReference: e.target.value })} />
            </Field>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} />
          Approve immediately (untick to review it first)
        </label>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">First kitchen</p>
          <OutletForm submitLabel="Create restaurant" busy={busy} onSubmit={create} onCancel={onCancel} />
        </div>
      </div>
    </Panel>
  );
};

export const AdminFoodVendorsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get("status") || "all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<FoodVendor[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await foodPartnerService.listVendors({ status, search: query || undefined }));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [status, query]);

  useEffect(() => {
    load();
  }, [load]);

  // The sidebar links here with ?status= and ?new=1 while the page is already open.
  const statusParam = params.get("status");
  const newParam = params.get("new");
  useEffect(() => {
    setStatus(statusParam || "all");
    if (newParam === "1") setCreating(true);
  }, [statusParam, newParam]);

  const move = async (v: FoodVendor, to: FoodVendor["status"], needsReason?: boolean) => {
    let reason: string | undefined;
    if (needsReason) {
      reason = askReason(`Reason to ${to === "rejected" ? "reject" : "suspend"} "${v.businessName}":`) ?? undefined;
      if (!reason) return;
    }
    setBusy(v._id);
    try {
      await foodPartnerService.setVendorStatus(v._id, to, reason);
      toast.success("Status updated");
      await load();
    } catch {
      /* shown by the API layer */
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Food restaurants"
        subtitle="Create restaurant accounts, approve applications and manage every kitchen's menu."
        icon={<Store size={20} />}
        actions={
          !creating && (
            <EnterpriseButton icon={<UserPlus size={15} />} onClick={() => setCreating(true)}>
              Create restaurant
            </EnterpriseButton>
          )
        }
      />

      {creating && (
        <CreateRestaurant
          onCancel={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            navigate(`/admin/food/vendors/${id}`);
          }}
        />
      )}

      <Panel>
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="flex-1 min-w-0">
              <Chips value={status} options={FILTERS} onChange={setStatus} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search.trim());
              }}
              className="relative lg:w-72"
            >
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className={`${inputClass} pl-9`} placeholder="Search name, phone, email" value={search} onChange={(e) => setSearch(e.target.value)} />
            </form>
          </div>

          {state !== "ready" ? (
            <PanelState state={state} onRetry={load} />
          ) : rows.length === 0 ? (
            <PanelState state="missing" error="No restaurants match this filter." missingText="No restaurants match this filter." />
          ) : (
            <ResponsiveTable
              rows={rows}
              rowKey={(v) => v._id}
              onRowClick={(v) => navigate(`/admin/food/vendors/${v._id}`)}
              columns={[
                {
                  header: "Restaurant",
                  cell: (v) => (
                    <div className="min-w-0">
                      <p className="font-black truncate">{v.businessName}</p>
                      <p className="text-[10px] text-gray-400">{v.outletCount ?? 0} kitchen{v.outletCount === 1 ? "" : "s"}</p>
                    </div>
                  ),
                },
                {
                  header: "Contact",
                  cell: (v) => (
                    <div className="text-[11px]">
                      <p>{v.contactName || "—"}</p>
                      <p className="text-gray-400">{v.contactPhone || v.contactEmail || ""}</p>
                    </div>
                  ),
                },
                {
                  header: "Login ID",
                  cell: (v) =>
                    v.owner ? (
                      <div className="text-[11px] min-w-0">
                        <p className="truncate">{v.owner.email}</p>
                        <p className="text-gray-400">{v.owner.phone}</p>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-600">No login yet</span>
                    ),
                },
                { header: "Status", cell: (v) => <VendorStatusPill status={v.status} /> },
                { header: "Created", cell: (v) => shortDate(v.createdAt), hideOnMobile: true },
                {
                  header: "Actions",
                  cell: (v) => (
                    <div className="flex flex-wrap gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                      {ACTIONS[v.status]?.map((a) => (
                        <EnterpriseButton
                          key={a.to}
                          size="sm"
                          variant={a.primary ? "primary" : "outline"}
                          disabled={busy === v._id}
                          onClick={() => move(v, a.to, a.reason)}
                        >
                          {a.label}
                        </EnterpriseButton>
                      ))}
                      <EnterpriseButton size="sm" variant="ghost" onClick={() => navigate(`/admin/food/vendors/${v._id}`)}>
                        Manage
                      </EnterpriseButton>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      </Panel>
    </div>
  );
};

export default AdminFoodVendorsPage;
