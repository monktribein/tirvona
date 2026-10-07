import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ExternalLink, Search, Store } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../../shared/components/EnterpriseModal";
import { useAuth } from "../../../contexts/AuthContext";
import { marketplaceAdminApi } from "../../../services/marketplace.service";
import {
  Chips, Empty, Field, Panel, PanelState, Pager, Pill, ResponsiveTable, Stat, askReason, inputClass, inr, shortDate, useAction, useRemote,
} from "../../../modules/marketplace/ui";
import { humanizeLabel } from "../../../utils/labels";

const FILTERS = [
  { value: "", label: "All" },
  { value: "awaiting", label: "Awaiting approval" },
  { value: "pending_verification", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
];

/** Admin actions allowed from each status (mirrors the backend VENDOR_TRANSITIONS). */
/** "Approve" puts the shop live immediately; documents and bank details are optional. */
const ACTIONS: Record<string, Array<"start_review" | "approve" | "reject" | "suspend" | "reactivate">> = {
  draft: ["approve", "reject"],
  pending_verification: ["start_review", "approve", "reject"],
  under_review: ["approve", "reject"],
  rejected: ["approve"],
  approved: ["approve", "suspend"],
  active: ["suspend"],
  suspended: ["reactivate"],
};

interface VendorRow {
  _id: string;
  storeName: string;
  slug: string;
  status: string;
  businessType?: string;
  userId?: { name?: string; email?: string; phone?: string };
  address?: { city?: string; state?: string };
  submittedAt?: string;
  createdAt: string;
}

export const useMarketplaceRoles = () => {
  const { user } = useAuth();
  const role = user?.role ?? "";
  return {
    isSuper: role === "super_admin",
    canOperate: ["super_admin", "marketplace_manager"].includes(role),
    canFinance: ["super_admin", "finance_manager"].includes(role),
  };
};

export const MarketplaceVendorsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const openId = params.get("open") ?? "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, meta, state, error, reload } = useRemote<VendorRow[]>(
    () => marketplaceAdminApi.vendors({ status, search: search.trim(), page, limit: 20 }),
    [status, search, page],
  );
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next);
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Marketplace vendors" subtitle="Verify seller applications, manage store status and commission." icon={<Store size={20} />} />
      <Panel>
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="flex-1 min-w-0">
              <Chips value={status} options={FILTERS} onChange={(v) => { setPage(1); setParam("status", v); }} />
            </div>
            <div className="relative lg:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className={`${inputClass} pl-9`} placeholder="Search stores" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>
          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !data?.length ? (
            <Empty title="No vendors found" />
          ) : (
            <>
              <ResponsiveTable
                rows={data}
                rowKey={(v) => v._id}
                onRowClick={(v) => setParam("open", v._id)}
                columns={[
                  { header: "Store", cell: (v) => <span className="font-extrabold">{v.storeName}</span> },
                  { header: "Owner", cell: (v) => <span className="text-gray-500">{v.userId?.name ?? v.userId?.email ?? "—"}</span>, hideOnMobile: true },
                  { header: "Location", cell: (v) => [v.address?.city, v.address?.state].filter(Boolean).join(", ") || "—", hideOnMobile: true },
                  { header: "Submitted", cell: (v) => shortDate(v.submittedAt ?? v.createdAt) },
                  { header: "Status", cell: (v) => <Pill status={v.status} /> },
                ]}
              />
              <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
      <EnterpriseModal isOpen={Boolean(openId)} onClose={() => setParam("open", "")} title="Vendor details" maxWidth="3xl">
        {openId && <VendorDetail id={openId} onChanged={reload} />}
      </EnterpriseModal>
    </div>
  );
};

const VendorDetail: React.FC<{ id: string; onChanged: () => void }> = ({ id, onChanged }) => {
  const { data: v, state, error, reload } = useRemote<any>(() => marketplaceAdminApi.vendor(id), [id]);
  const wallet = useRemote<any>(() => marketplaceAdminApi.vendorWallet(id), [id]);
  const { busy, run } = useAction();
  const roles = useMarketplaceRoles();
  const [commission, setCommission] = useState<string | null>(null);
  const refresh = async () => {
    await reload();
    onChanged();
  };

  if (state !== "ready" || !v) return <PanelState state={state} error={error} onRetry={reload} />;

  const act = (action: string) => {
    let reason: string | undefined;
    if (action === "reject" || action === "suspend") {
      const r = askReason(`Reason to ${action} "${v.storeName}" (shown to the vendor):`);
      if (!r) return;
      reason = r;
    }
    run(action, () => marketplaceAdminApi.vendorAction(id, action, reason), refresh, `Vendor ${humanizeLabel(action).toLowerCase()}`);
  };

  return (
    <div className="space-y-5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-black">{v.storeName}</span>
        <Pill status={v.status} />
        {v.status === "active" && (
          <a href={`/marketplace/store/${v.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#F28C28] font-bold">
            Public store <ExternalLink size={11} />
          </a>
        )}
      </div>
      {(v.rejectionReason || v.suspensionReason) && <p className="text-rose-600 font-bold">Reason: {v.suspensionReason ?? v.rejectionReason}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {[
          ["Owner", `${v.userId?.name ?? "—"} · ${v.userId?.email ?? ""}`],
          ["Contact", `${v.contactPhone ?? "—"} · ${v.contactEmail ?? ""}`],
          ["Legal name", v.legalBusinessName ?? "—"],
          ["Business type", humanizeLabel(v.businessType ?? "")],
          ["GSTIN", v.gstin ?? "—"],
          ["Address", [v.address?.line1, v.address?.city, v.address?.state, v.address?.pincode].filter(Boolean).join(", ") || "—"],
          ["Products", Object.entries(v.productCounts ?? {}).map(([k, n]) => `${n} ${humanizeLabel(k).toLowerCase()}`).join(", ") || "None"],
          ["Commission", v.commissionPercent == null ? "Category / global default" : `${v.commissionPercent}% (override)`],
        ].map(([k, val]) => (
          <p key={k}>
            <span className="text-gray-400 font-bold">{k}: </span>
            {val}
          </p>
        ))}
      </div>
      {v.description && <p className="text-gray-600 dark:text-gray-300">{v.description}</p>}

      {roles.canOperate && ACTIONS[v.status] && (
        <div className="flex flex-wrap gap-2">
          {ACTIONS[v.status].map((a) => (
            <EnterpriseButton
              key={a}
              size="sm"
              variant={a === "reject" || a === "suspend" ? "danger" : a === "approve" || a === "reactivate" ? "success" : "outline"}
              loading={busy === a}
              disabled={Boolean(busy)}
              onClick={() => act(a)}
            >
              {humanizeLabel(a)}
            </EnterpriseButton>
          ))}
        </div>
      )}

      <Panel title="KYC documents">
        {!v.documents?.length ? (
          <p className="text-gray-500">No documents uploaded.</p>
        ) : (
          <ul className="space-y-2">
            {v.documents.map((d: any) => (
              <li key={d._id} className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{humanizeLabel(d.type)}</span>
                <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-[#F28C28] font-bold inline-flex items-center gap-1">
                  Open <ExternalLink size={11} />
                </a>
                <Pill status={d.status} />
                {d.reviewNote && <span className="text-gray-500">{d.reviewNote}</span>}
                {roles.canOperate && d.status === "pending" && (
                  <span className="ml-auto flex gap-1.5">
                    <EnterpriseButton size="sm" variant="success" loading={busy === `dv${d._id}`} onClick={() => run(`dv${d._id}`, () => marketplaceAdminApi.reviewDocument(d._id, "verified"), refresh)}>
                      Verify
                    </EnterpriseButton>
                    <EnterpriseButton
                      size="sm"
                      variant="danger"
                      loading={busy === `dr${d._id}`}
                      onClick={() => {
                        const note = askReason("Why is this document rejected? (shown to the vendor)");
                        if (note) run(`dr${d._id}`, () => marketplaceAdminApi.reviewDocument(d._id, "rejected", note), refresh);
                      }}
                    >
                      Reject
                    </EnterpriseButton>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Bank accounts">
        {!v.bankAccounts?.length ? (
          <p className="text-gray-500">No bank account added.</p>
        ) : (
          <ul className="space-y-2">
            {v.bankAccounts.map((b: any) => (
              <li key={b._id} className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{b.accountHolderName}</span>
                <span className="text-gray-500">
                  {b.bankName ? `${b.bankName} · ` : ""}
                  {b.accountNumberMasked} · {b.ifsc}
                </span>
                {b.isDefault && <Pill status="active" label="Default" />}
                <Pill status={b.verificationStatus} />
                {roles.canFinance && b.verificationStatus === "pending" && (
                  <span className="ml-auto flex gap-1.5">
                    <EnterpriseButton size="sm" variant="success" loading={busy === `bv${b._id}`} onClick={() => run(`bv${b._id}`, () => marketplaceAdminApi.verifyBankAccount(b._id, "verified"), refresh)}>
                      Verify
                    </EnterpriseButton>
                    <EnterpriseButton size="sm" variant="danger" loading={busy === `br${b._id}`} onClick={() => run(`br${b._id}`, () => marketplaceAdminApi.verifyBankAccount(b._id, "rejected"), refresh)}>
                      Reject
                    </EnterpriseButton>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {wallet.state === "ready" && wallet.data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Available" value={inr(wallet.data.available)} />
          <Stat label="Pending" value={inr(wallet.data.pending)} />
          <Stat label="Lifetime earnings" value={inr(wallet.data.lifetimeEarnings)} />
          <Stat label="Paid out" value={inr(wallet.data.paidOut)} />
        </div>
      )}

      {roles.isSuper && (
        <Panel title="Commission override">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Commission % (blank = use category / global)" className="flex-1 min-w-[12rem]">
              <input
                className={inputClass}
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={commission ?? (v.commissionPercent ?? "")}
                onChange={(e) => setCommission(e.target.value)}
              />
            </Field>
            <EnterpriseButton
              size="sm"
              loading={busy === "commission"}
              disabled={commission === null}
              onClick={() =>
                run(
                  "commission",
                  () => marketplaceAdminApi.vendorCommission(id, commission === "" || commission === null ? null : Number(commission)),
                  async () => {
                    setCommission(null);
                    await refresh();
                  },
                  "Commission updated",
                )
              }
            >
              Save
            </EnterpriseButton>
          </div>
        </Panel>
      )}
    </div>
  );
};

export default MarketplaceVendorsPage;
