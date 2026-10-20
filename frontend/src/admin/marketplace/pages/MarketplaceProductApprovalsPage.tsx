import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardCheck, ExternalLink, Flame, Search } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../../shared/components/EnterpriseModal";
import { marketplaceAdminApi } from "../../../services/marketplace.service";
import { Chips, Empty, Panel, PanelState, Pager, Pill, ResponsiveTable, askReason, inputClass, inr, shortDate, useAction, useRemote } from "../../../modules/marketplace/ui";
import { humanizeLabel } from "../../../utils/labels";
import { useMarketplaceRoles } from "./MarketplaceVendorsPage";

const FILTERS = [
  { value: "pending", label: "Awaiting approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "not_submitted", label: "Drafts" },
  { value: "", label: "All" },
  { value: "pandit_pages", label: "On pandit pages" },
];

interface AdminProduct {
  _id: string;
  name: string;
  slug: string;
  sku?: string;
  price: number;
  salePrice?: number;
  stock: number;
  images?: string[];
  approvalStatus: string;
  listingStatus: string;
  status: string;
  adminDisabled?: boolean;
  showOnPanditPages?: boolean;
  submittedAt?: string;
  updatedAt: string;
  vendorId?: { _id: string; storeName: string; slug: string; status: string } | null;
}

/** Product approval queue. A product is public only after approval here. */
export const MarketplaceProductApprovalsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "pending";
  const openId = params.get("open") ?? "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { isSuper } = useMarketplaceRoles();
  const { busy, run } = useAction();
  const { data, meta, state, error, reload } = useRemote<AdminProduct[]>(
    () =>
      marketplaceAdminApi.products(
        status === "pandit_pages"
          ? { panditPages: true, search: search.trim(), page, limit: 20 }
          : { approvalStatus: status, search: search.trim(), page, limit: 20 },
      ),
    [status, search, page],
  );
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    if (!v && k === "open") next.delete(k);
    setParams(next);
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Product approvals"
        subtitle="Vendor products stay hidden until approved. Use the Pandit pages switch to show a product to devotees on pandit pages."
        icon={<ClipboardCheck size={20} />}
      />
      <Panel>
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="flex-1 min-w-0">
              <Chips value={status} options={FILTERS} onChange={(v) => { setPage(1); setParam("status", v); }} />
            </div>
            <div className="relative lg:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className={`${inputClass} pl-9`} placeholder="Search products" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>
          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !data?.length ? (
            <Empty title="No products found" text={status === "pending" ? "Nothing is waiting for approval." : undefined} />
          ) : (
            <>
              <ResponsiveTable
                rows={data}
                rowKey={(p) => p._id}
                onRowClick={(p) => setParam("open", p._id)}
                columns={[
                  { header: "Product", cell: (p) => <span className="font-extrabold">{p.name}</span> },
                  { header: "Store", cell: (p) => p.vendorId?.storeName ?? "—" },
                  { header: "Price", cell: (p) => inr(p.salePrice ?? p.price), hideOnMobile: true },
                  { header: "Submitted", cell: (p) => shortDate(p.submittedAt ?? p.updatedAt), hideOnMobile: true },
                  {
                    header: "Status",
                    cell: (p) => (
                      <span className="flex flex-wrap gap-1 justify-end md:justify-start">
                        <Pill status={p.approvalStatus} />
                        {p.adminDisabled && <Pill status="disabled" />}
                      </span>
                    ),
                  },
                  {
                    header: "Pandit pages",
                    cell: (p) => (
                      <PanditPagesSwitch
                        on={Boolean(p.showOnPanditPages)}
                        disabled={!isSuper}
                        busy={busy === `pandit-${p._id}`}
                        onChange={(next) =>
                          run(
                            `pandit-${p._id}`,
                            () => marketplaceAdminApi.setPanditPages(p._id, next),
                            reload,
                            next ? "Now shown on pandit pages" : "Removed from pandit pages",
                          )
                        }
                      />
                    ),
                  },
                ]}
              />
              <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
      <EnterpriseModal isOpen={Boolean(openId)} onClose={() => setParam("open", "")} title="Product review" maxWidth="3xl">
        {openId && <ProductReview id={openId} onChanged={reload} />}
      </EnterpriseModal>
    </div>
  );
};

const ProductReview: React.FC<{ id: string; onChanged: () => void }> = ({ id, onChanged }) => {
  const { data: p, state, error, reload } = useRemote<any>(() => marketplaceAdminApi.product(id), [id]);
  const { busy, run } = useAction();
  const { canOperate, isSuper } = useMarketplaceRoles();
  if (state !== "ready" || !p) return <PanelState state={state} error={error} onRetry={reload} />;
  const refresh = async () => {
    await reload();
    onChanged();
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-black">{p.name}</span>
        <Pill status={p.approvalStatus} />
        <Pill status={p.listingStatus} />
        {p.status === "active" && (
          <a href={`/marketplace/products/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#F28C28] font-bold">
            Live page <ExternalLink size={11} />
          </a>
        )}
      </div>
      {p.images?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {p.images.map((src: string) => (
            <img key={src} src={src} alt="" className="w-24 h-24 rounded-xl object-cover bg-gray-100 shrink-0" loading="lazy" decoding="async" />
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {[
          ["Store", `${p.vendorId?.storeName ?? "—"} (${humanizeLabel(p.vendorId?.status ?? "")})`],
          ["Category", p.categoryId?.name ?? "—"],
          ["Price", `${inr(p.price)}${p.salePrice ? ` · sale ${inr(p.salePrice)}` : ""}`],
          ["GST", p.gstPercent != null ? `${p.gstPercent}%` : "Marketplace default"],
          ["SKU", p.sku ?? "—"],
          ["Stock", p.inventory?.trackInventory === false ? "Not tracked" : String(p.stock)],
          ["Temple / source", p.templeSource ?? "—"],
          ["Weight", p.weight ?? "—"],
        ].map(([k, v]) => (
          <p key={k}>
            <span className="text-gray-400 font-bold">{k}: </span>
            {v}
          </p>
        ))}
      </div>
      {p.shortDescription && <p className="font-bold">{p.shortDescription}</p>}
      {p.description && <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">{p.description}</p>}
      {p.specifications?.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {p.specifications.map((s: any) => (
            <li key={s.key}>
              <span className="text-gray-400 font-bold">{s.key}: </span>
              {s.value}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-3 dark:border-slate-800">
        <div>
          <p className="flex items-center gap-1.5 font-black text-[#0B192C] dark:text-white">
            <Flame size={13} className="text-[#F28C28]" /> Show on pandit pages
          </p>
          <p className="text-gray-500">Devotees see it as puja samagri on pandit profiles. Only while the product is approved and live.</p>
        </div>
        <PanditPagesSwitch
          on={Boolean(p.showOnPanditPages)}
          disabled={!isSuper}
          busy={busy === "pandit"}
          onChange={(next) => run("pandit", () => marketplaceAdminApi.setPanditPages(id, next), refresh, next ? "Now shown on pandit pages" : "Removed from pandit pages")}
        />
      </div>
      {p.rejectionReason && <p className="text-rose-600 font-bold">Rejected: {p.rejectionReason}</p>}
      {p.adminDisabledReason && <p className="text-rose-600 font-bold">Disabled: {p.adminDisabledReason}</p>}

      {canOperate && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
          {p.approvalStatus === "pending" && (
            <>
              <EnterpriseButton size="sm" variant="success" loading={busy === "approve"} onClick={() => run("approve", () => marketplaceAdminApi.reviewProduct(id, "approve"), refresh, "Product approved")}>
                Approve
              </EnterpriseButton>
              <EnterpriseButton
                size="sm"
                variant="danger"
                loading={busy === "reject"}
                onClick={() => {
                  const reason = askReason("Why is this product rejected? (shown to the vendor)");
                  if (reason) run("reject", () => marketplaceAdminApi.reviewProduct(id, "reject", reason), refresh, "Product rejected");
                }}
              >
                Reject
              </EnterpriseButton>
            </>
          )}
          {p.adminDisabled ? (
            <EnterpriseButton size="sm" variant="outline" loading={busy === "enable"} onClick={() => run("enable", () => marketplaceAdminApi.disableProduct(id, false), refresh, "Product re-enabled")}>
              Re-enable
            </EnterpriseButton>
          ) : (
            <EnterpriseButton
              size="sm"
              variant="warning"
              loading={busy === "disable"}
              onClick={() => {
                const reason = askReason("Why is this product being deactivated?");
                if (reason) run("disable", () => marketplaceAdminApi.disableProduct(id, true, reason), refresh, "Product deactivated");
              }}
            >
              Deactivate
            </EnterpriseButton>
          )}
        </div>
      )}
    </div>
  );
};

/** On/off switch; only a super admin may flip it. */
const PanditPagesSwitch: React.FC<{ on: boolean; disabled?: boolean; busy?: boolean; onChange: (next: boolean) => void }> = ({
  on,
  disabled,
  busy,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label="Show on pandit pages"
    title={disabled ? "Only a super admin can change this" : on ? "Shown on pandit pages" : "Not shown on pandit pages"}
    disabled={disabled || busy}
    onClick={(e) => {
      e.stopPropagation(); // the row opens the review dialog
      onChange(!on);
    }}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] disabled:cursor-not-allowed disabled:opacity-60 ${on ? "bg-[#F28C28]" : "bg-gray-300 dark:bg-slate-600"}`}
  >
    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
  </button>
);

export default MarketplaceProductApprovalsPage;
