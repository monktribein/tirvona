/* oxlint-disable react/only-export-components -- page plus its product status helper */
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, Eye, EyeOff, Package, Pencil, Plus, Search, Send } from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { Chips, Empty, Panel, PanelState, Pager, Pill, ResponsiveTable, inputClass, inr, useAction, useRemote } from "../ui";
import { RequireStore, VendorStatusBanner } from "./VendorShared";

export interface VendorProduct {
  _id: string;
  name: string;
  slug?: string;
  sku?: string;
  images?: string[];
  price: number;
  salePrice?: number;
  stock: number;
  categoryId?: string;
  approvalStatus: "not_submitted" | "pending" | "approved" | "rejected";
  listingStatus: "draft" | "active" | "inactive" | "out_of_stock" | "archived";
  status?: string;
  rejectionReason?: string;
  adminDisabled?: boolean;
  adminDisabledReason?: string;
  inventory?: { trackInventory?: boolean; reserved?: number; sold?: number; lowStockThreshold?: number };
  updatedAt?: string;
}

/** One human status for a product, derived from the backend's approval + listing fields. */
export const productState = (p: VendorProduct): { status: string; label: string; detail?: string } => {
  if (p.listingStatus === "archived") return { status: "archived", label: "Archived" };
  if (p.adminDisabled) return { status: "disabled", label: "Disabled by Tirvona", detail: p.adminDisabledReason };
  if (p.approvalStatus === "not_submitted") return { status: "draft", label: "Draft" };
  if (p.approvalStatus === "pending") return { status: "pending", label: "Waiting for approval" };
  if (p.approvalStatus === "rejected") return { status: "rejected", label: "Rejected", detail: p.rejectionReason };
  if (p.status === "active") return { status: "active", label: "Live" };
  if (p.listingStatus === "inactive") return { status: "inactive", label: "Hidden by you" };
  return { status: "approved", label: "Approved (not visible)", detail: "Visible once your store is active." };
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "approval:not_submitted", label: "Drafts" },
  { value: "approval:pending", label: "Awaiting approval" },
  { value: "approval:approved", label: "Approved" },
  { value: "approval:rejected", label: "Rejected" },
  { value: "listing:inactive", label: "Hidden" },
  { value: "listing:archived", label: "Archived" },
];

export const VendorProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { busy, run } = useAction();

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(term.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [term]);

  const [kind, value] = filter.split(":");
  const { data, meta, state, error, reload } = useRemote<VendorProduct[]>(
    () =>
      vendorApi.products({
        page,
        limit: 20,
        search,
        approvalStatus: kind === "approval" ? value : undefined,
        listingStatus: kind === "listing" ? value : undefined,
      }),
    [page, search, filter],
  );

  const actions = (p: VendorProduct) => {
    if (p.listingStatus === "archived") return null;
    const canSubmit = ["not_submitted", "rejected"].includes(p.approvalStatus);
    return (
      <div className="flex flex-wrap justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        <EnterpriseButton variant="ghost" size="sm" icon={<Pencil size={12} />} onClick={() => navigate(`/vendor/products/${p._id}`)}>
          Edit
        </EnterpriseButton>
        {canSubmit && (
          <EnterpriseButton
            size="sm"
            icon={<Send size={12} />}
            loading={busy === `s${p._id}`}
            onClick={() => run(`s${p._id}`, () => vendorApi.submitProduct(p._id), reload, "Sent to Tirvona for approval")}
          >
            {p.approvalStatus === "rejected" ? "Resubmit" : "Submit"}
          </EnterpriseButton>
        )}
        {p.approvalStatus === "approved" && !p.adminDisabled && (
          <EnterpriseButton
            variant="outline"
            size="sm"
            icon={p.listingStatus === "active" ? <EyeOff size={12} /> : <Eye size={12} />}
            loading={busy === `l${p._id}`}
            onClick={() =>
              run(
                `l${p._id}`,
                () => vendorApi.setListing(p._id, p.listingStatus === "active" ? "inactive" : "active"),
                reload,
                p.listingStatus === "active" ? "Product hidden from customers" : "Product listed again",
              )
            }
          >
            {p.listingStatus === "active" ? "Hide" : "Show"}
          </EnterpriseButton>
        )}
        <EnterpriseButton
          variant="ghost"
          size="sm"
          icon={<Archive size={12} />}
          loading={busy === `a${p._id}`}
          onClick={() => {
            if (window.confirm(`Archive "${p.name}"? It is removed from sale permanently and can no longer be edited.`))
              run(`a${p._id}`, () => vendorApi.setListing(p._id, "archived"), reload, "Product archived");
          }}
        >
          Archive
        </EnterpriseButton>
      </div>
    );
  };

  return (
    <RequireStore>
      {(vendor) => (
        <div className="space-y-5">
          <EnterprisePageHeader
            title="Products"
            subtitle="Create products, send them for approval and control what is on sale."
            icon={<Package size={20} />}
            actions={
              <Link
                to="/vendor/products/new"
                className="px-4 py-2 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <Plus size={13} /> Add product
              </Link>
            }
          />
          {vendor.status !== "active" && <VendorStatusBanner vendor={vendor} />}
          <Panel padded>
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative md:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className={`${inputClass} pl-9`}
                    placeholder="Search your products"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    aria-label="Search products"
                  />
                </div>
                <Chips
                  value={filter}
                  options={FILTERS}
                  onChange={(v) => {
                    setFilter(v);
                    setPage(1);
                  }}
                />
              </div>
              {state !== "ready" ? (
                <PanelState state={state} error={error} onRetry={reload} />
              ) : !data?.length ? (
                <Empty
                  title={search || filter ? "No products found" : "No products yet"}
                  text={search || filter ? "Try another filter." : "Add your first product. It stays a draft until you submit it for approval."}
                />
              ) : (
                <>
                  <ResponsiveTable
                    rows={data}
                    rowKey={(p) => p._id}
                    onRowClick={(p) => p.listingStatus !== "archived" && navigate(`/vendor/products/${p._id}`)}
                    columns={[
                      {
                        header: "Product",
                        cell: (p) => (
                          <span className="flex items-center gap-2.5 min-w-0">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 hidden md:block" />
                            ) : null}
                            <span className="min-w-0">
                              <span className="block font-bold truncate max-w-[220px]">{p.name}</span>
                              {p.sku && <span className="text-[10px] text-gray-400 font-mono">{p.sku}</span>}
                            </span>
                          </span>
                        ),
                      },
                      { header: "Price", cell: (p) => <span className="tabular-nums font-bold">{inr(p.salePrice ?? p.price)}</span> },
                      {
                        header: "Stock",
                        cell: (p) => (p.inventory?.trackInventory === false ? <span className="text-gray-400">Not tracked</span> : <span className="tabular-nums">{p.stock}</span>),
                      },
                      {
                        header: "Status",
                        cell: (p) => {
                          const s = productState(p);
                          return (
                            <span className="inline-flex flex-col items-end md:items-start gap-0.5">
                              <Pill status={s.status} label={s.label} />
                              {s.detail && <span className="text-[10px] text-rose-600 max-w-[220px]">{s.detail}</span>}
                            </span>
                          );
                        },
                      },
                      { header: "Actions", cell: actions, className: "text-right" },
                    ]}
                  />
                  <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
                </>
              )}
            </div>
          </Panel>
        </div>
      )}
    </RequireStore>
  );
};

export default VendorProductsPage;
