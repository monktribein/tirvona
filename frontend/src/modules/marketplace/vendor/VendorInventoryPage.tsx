import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Boxes } from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { Chips, Empty, Panel, PanelState, Pager, Pill, ResponsiveTable, inputClass, useAction, useRemote } from "../ui";
import { RequireStore } from "./VendorShared";
import type { VendorProduct } from "./VendorProductsPage";

const stockState = (p: VendorProduct) => {
  if (p.inventory?.trackInventory === false) return { status: "in_stock", label: "Not tracked" };
  if (p.stock <= 0) return { status: "out_of_stock", label: "Out of stock" };
  if (p.stock <= (p.inventory?.lowStockThreshold ?? 5)) return { status: "low_stock", label: "Low stock" };
  return { status: "in_stock", label: "In stock" };
};

/** Inline stock editor: every change is a PATCH to the backend, never local-only. */
const StockEditor: React.FC<{ product: VendorProduct; onSaved: () => void }> = ({ product, onSaved }) => {
  const [stock, setStock] = useState(String(product.stock ?? 0));
  const [threshold, setThreshold] = useState(String(product.inventory?.lowStockThreshold ?? 5));
  const { busy, run } = useAction();
  const dirty = stock !== String(product.stock ?? 0) || threshold !== String(product.inventory?.lowStockThreshold ?? 5);
  if (product.inventory?.trackInventory === false || product.listingStatus === "archived") return <span className="text-gray-400">—</span>;
  return (
    <form
      className="flex items-center justify-end gap-1.5"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        run("save", () => vendorApi.setStock(product._id, Number(stock), Number(threshold)), onSaved, `Stock updated for ${product.name}`);
      }}
    >
      <input
        type="number"
        min={0}
        step={1}
        aria-label={`Available stock for ${product.name}`}
        className={`${inputClass} !w-20 !py-1.5`}
        value={stock}
        onChange={(e) => setStock(e.target.value)}
      />
      <input
        type="number"
        min={0}
        step={1}
        aria-label={`Low-stock level for ${product.name}`}
        title="Low-stock alert level"
        className={`${inputClass} !w-16 !py-1.5`}
        value={threshold}
        onChange={(e) => setThreshold(e.target.value)}
      />
      <EnterpriseButton type="submit" size="sm" disabled={!dirty} loading={busy === "save"}>
        Save
      </EnterpriseButton>
    </form>
  );
};

export const VendorInventoryPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter") ?? "";
  const [page, setPage] = useState(1);

  const all = useRemote<VendorProduct[]>(
    () => (filter ? Promise.resolve({ data: { data: [] } }) : vendorApi.products({ page, limit: 25 })),
    [filter, page],
  );
  const low = useRemote<VendorProduct[]>(() => (filter ? vendorApi.lowStock() : Promise.resolve({ data: { data: [] } })), [filter]);

  const source = filter ? low : all;
  const rows = (source.data ?? []).filter((p) => (filter === "out" ? p.stock <= 0 : true)).filter((p) => p.listingStatus !== "archived");
  const reload = () => {
    all.reload();
    low.reload();
  };

  return (
    <RequireStore>
      {() => (
        <div className="space-y-5">
          <EnterprisePageHeader
            title="Inventory"
            subtitle="Available stock is what customers can buy. Reserved units are held by orders awaiting payment."
            icon={<Boxes size={20} />}
          />
          <Panel>
            <div className="space-y-3">
              <Chips
                value={filter}
                onChange={(v) => {
                  setPage(1);
                  setParams(v ? { filter: v } : {});
                }}
                options={[
                  { value: "", label: "All stock" },
                  { value: "low", label: "Low stock" },
                  { value: "out", label: "Out of stock" },
                ]}
              />
              {source.state !== "ready" ? (
                <PanelState state={source.state} error={source.error} onRetry={source.reload} />
              ) : rows.length === 0 ? (
                <Empty
                  title={filter ? "Nothing needs restocking" : "No products yet"}
                  text={filter ? "Every tracked product is above its low-stock level." : "Add products to manage their stock here."}
                />
              ) : (
                <>
                  <ResponsiveTable
                    rows={rows}
                    rowKey={(p) => p._id}
                    columns={[
                      { header: "Product", cell: (p) => <span className="font-bold block truncate max-w-[220px]">{p.name}</span> },
                      { header: "SKU", cell: (p) => <span className="font-mono text-[11px]">{p.sku || "—"}</span>, hideOnMobile: true },
                      { header: "Available", cell: (p) => <span className="tabular-nums font-black">{p.inventory?.trackInventory === false ? "∞" : p.stock}</span> },
                      { header: "Reserved", cell: (p) => <span className="tabular-nums">{p.inventory?.reserved ?? 0}</span> },
                      { header: "Sold", cell: (p) => <span className="tabular-nums">{p.inventory?.sold ?? 0}</span> },
                      {
                        header: "Status",
                        cell: (p) => {
                          const s = stockState(p);
                          return <Pill status={s.status} label={s.label} />;
                        },
                      },
                      {
                        header: "Update stock · alert level",
                        cell: (p) => <StockEditor key={`${p._id}:${p.stock}`} product={p} onSaved={reload} />,
                        className: "text-right",
                      },
                    ]}
                  />
                  {!filter && <Pager page={all.meta.page} limit={all.meta.limit} total={all.meta.total} onPage={setPage} />}
                </>
              )}
            </div>
          </Panel>
          <p className="text-[11px] text-gray-400">
            Stock history is not available yet: the backend records each change in the audit log but does not expose it to
            stores.
          </p>
        </div>
      )}
    </RequireStore>
  );
};

export default VendorInventoryPage;
