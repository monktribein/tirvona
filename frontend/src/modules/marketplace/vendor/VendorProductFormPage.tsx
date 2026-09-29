import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Package, Plus, Save, Send, Trash2 } from "lucide-react";
import { flattenCategories, storeApi, vendorApi, type StoreCategory } from "../../../services/marketplace.service";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { ImageUploadGrid } from "../../../components/shared/ImageUploadGrid";
import { toast } from "../../../lib/toast";
import { Field, Panel, PanelState, Pill, inputClass, useRemote } from "../ui";
import { RequireStore } from "./VendorShared";
import { productState, type VendorProduct } from "./VendorProductsPage";

interface FormState {
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  sku: string;
  price: string;
  salePrice: string;
  gstPercent: string;
  images: string[];
  specifications: Array<{ key: string; value: string }>;
  weight: string;
  length: string;
  width: string;
  height: string;
  unit: string;
  templeSource: string;
  authenticityCertificate: string;
  stock: string;
  trackInventory: boolean;
  lowStockThreshold: string;
}

const EMPTY: FormState = {
  name: "",
  categoryId: "",
  shortDescription: "",
  description: "",
  sku: "",
  price: "",
  salePrice: "",
  gstPercent: "",
  images: [],
  specifications: [],
  weight: "",
  length: "",
  width: "",
  height: "",
  unit: "cm",
  templeSource: "",
  authenticityCertificate: "",
  stock: "0",
  trackInventory: true,
  lowStockThreshold: "5",
};

const fromProduct = (p: any): FormState => ({
  name: p.name ?? "",
  categoryId: p.categoryId ? String(p.categoryId) : "",
  shortDescription: p.shortDescription ?? "",
  description: p.description ?? "",
  sku: p.sku ?? "",
  price: p.price != null ? String(p.price) : "",
  salePrice: p.salePrice != null ? String(p.salePrice) : "",
  gstPercent: p.gstPercent != null ? String(p.gstPercent) : "",
  images: p.images ?? [],
  specifications: (p.specifications ?? []).map((s: any) => ({ key: s.key ?? "", value: s.value ?? "" })),
  weight: p.weight ?? "",
  length: p.dimensions?.length != null ? String(p.dimensions.length) : "",
  width: p.dimensions?.width != null ? String(p.dimensions.width) : "",
  height: p.dimensions?.height != null ? String(p.dimensions.height) : "",
  unit: p.dimensions?.unit ?? "cm",
  templeSource: p.templeSource ?? "",
  authenticityCertificate: p.authenticityCertificate ?? "",
  stock: String(p.stock ?? 0),
  trackInventory: p.inventory?.trackInventory !== false,
  lowStockThreshold: String(p.inventory?.lowStockThreshold ?? 5),
});

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

/** Builds the exact CreateProductDto / UpdateProductDto body the backend validates. */
const toPayload = (f: FormState) => {
  const dims = { length: num(f.length), width: num(f.width), height: num(f.height) };
  const hasDims = Object.values(dims).some((v) => v !== undefined);
  return {
    name: f.name.trim(),
    categoryId: f.categoryId,
    shortDescription: f.shortDescription.trim() || undefined,
    description: f.description.trim() || undefined,
    sku: f.sku.trim() || undefined,
    price: Number(f.price),
    salePrice: num(f.salePrice),
    gstPercent: num(f.gstPercent),
    images: f.images,
    specifications: f.specifications.filter((s) => s.key.trim() && s.value.trim()).map((s) => ({ key: s.key.trim(), value: s.value.trim() })),
    weight: f.weight.trim() || undefined,
    dimensions: hasDims ? { ...dims, unit: f.unit } : undefined,
    templeSource: f.templeSource.trim() || undefined,
    authenticityCertificate: f.authenticityCertificate.trim() || undefined,
    stock: f.trackInventory ? Number(f.stock || 0) : undefined,
    trackInventory: f.trackInventory,
    lowStockThreshold: f.trackInventory ? Number(f.lowStockThreshold || 0) : undefined,
  };
};

const ProductForm: React.FC<{ id?: string; vendorStatus: string }> = ({ id, vendorStatus }) => {
  const navigate = useNavigate();
  const isNew = !id;
  const product = useRemote<VendorProduct>(() => (id ? vendorApi.product(id) : Promise.resolve({ data: { data: null } })), [id]);
  const categories = useRemote<StoreCategory[]>(() => storeApi.categories(), []);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState<"" | "draft" | "submit">("");

  useEffect(() => {
    if (product.data) setForm(fromProduct(product.data));
  }, [product.data]);

  if (id && product.state !== "ready") return <PanelState state={product.state} error={product.error} onRetry={product.reload} missingText="This product does not exist in your store." />;

  const p = product.data;
  const archived = p?.listingStatus === "archived";
  const canSubmit = isNew || (p && ["not_submitted", "rejected"].includes(p.approvalStatus));
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (submit: boolean) => {
    if (!form.name.trim() || !form.categoryId || !(Number(form.price) > 0)) {
      toast.error("Name, category and a price above ₹0 are required.");
      return;
    }
    if (submit && (!form.images.length || !form.description.trim())) {
      toast.error("Add at least one image and a description before submitting for approval.");
      return;
    }
    setSaving(submit ? "submit" : "draft");
    try {
      const payload = toPayload(form);
      const res = isNew ? await vendorApi.createProduct(payload) : await vendorApi.updateProduct(id!, payload);
      const saved = res.data?.data;
      if (submit && saved?._id) await vendorApi.submitProduct(saved._id);
      toast.success(submit ? "Saved and sent to Tirvona for approval" : isNew ? "Draft saved" : "Product saved");
      if (isNew && saved?._id) navigate(`/vendor/products/${saved._id}`, { replace: true });
      else product.reload();
    } catch {
      // The API client shows the backend's validation message.
    } finally {
      setSaving("");
    }
  };

  const flatCategories = flattenCategories(categories.data ?? []);
  const status = p ? productState(p) : null;
  const locked = archived || ["suspended", "deactivated"].includes(vendorStatus);

  return (
    <div className="space-y-5 max-w-5xl">
      <EnterprisePageHeader
        title={isNew ? "Add product" : p?.name ?? "Edit product"}
        subtitle={
          isNew
            ? "Products start as drafts. Tirvona reviews each product before customers can see it."
            : "Changing the name, description, images, category or specifications sends an approved product back for review. Price and stock changes do not."
        }
        icon={<Package size={20} />}
        actions={
          <Link to="/vendor/products" className="px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5">
            <ArrowLeft size={13} /> Products
          </Link>
        }
      />

      {status && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          Status <Pill status={status.status} label={status.label} />
          {status.detail && <span className="text-rose-600 font-semibold">{status.detail}</span>}
        </div>
      )}
      {p?.approvalStatus === "rejected" && p.rejectionReason && (
        <p className="text-xs rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300 p-3">
          <strong>Why it was rejected:</strong> {p.rejectionReason}. Fix it below and resubmit.
        </p>
      )}

      <fieldset disabled={locked || saving !== ""} className="space-y-5">
        <Panel title="Basic details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Product name" required className="sm:col-span-2">
              <input className={inputClass} value={form.name} onChange={set("name")} minLength={3} maxLength={150} />
            </Field>
            <Field label="Category" required>
              <select className={inputClass} value={form.categoryId} onChange={set("categoryId")}>
                <option value="">{categories.state === "loading" ? "Loading categories..." : "Select a category"}</option>
                {flatCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {"  ".repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="SKU" hint="Your own product code, unique within your store.">
              <input className={`${inputClass} uppercase`} value={form.sku} onChange={set("sku")} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_\-]{1,39}" />
            </Field>
            <Field label="Short description" className="sm:col-span-2">
              <input className={inputClass} value={form.shortDescription} onChange={set("shortDescription")} maxLength={300} />
            </Field>
            <Field label="Description" required className="sm:col-span-2" hint="Required before submitting for approval.">
              <textarea className={inputClass} rows={5} value={form.description} onChange={set("description")} maxLength={5000} />
            </Field>
            <Field label="Temple / source">
              <input className={inputClass} value={form.templeSource} onChange={set("templeSource")} maxLength={160} />
            </Field>
            <Field label="Authenticity certificate">
              <input className={inputClass} value={form.authenticityCertificate} onChange={set("authenticityCertificate")} maxLength={300} />
            </Field>
          </div>
        </Panel>

        <Panel title="Images">
          <ImageUploadGrid
            value={form.images}
            onChange={(images) => setForm((f) => ({ ...f, images }))}
            folder="marketplace/products"
            max={10}
            onError={(title, message) => toast.error(message, { title })}
          />
          <p className="text-[10px] text-gray-400 mt-2">At least one image is required before submitting. The first image is the cover.</p>
        </Panel>

        <Panel title="Pricing">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Price / MRP (₹)" required>
              <input type="number" min={1} step="0.01" className={inputClass} value={form.price} onChange={set("price")} />
            </Field>
            <Field label="Sale price (₹)" hint="Optional. Must not be above the price.">
              <input type="number" min={1} step="0.01" className={inputClass} value={form.salePrice} onChange={set("salePrice")} />
            </Field>
            <Field label="GST rate" hint="Leave on default to use the marketplace rate.">
              <select className={inputClass} value={form.gstPercent} onChange={set("gstPercent")}>
                <option value="">Marketplace default</option>
                {[0, 5, 12, 18, 28].map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Panel>

        <Panel title="Inventory">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="flex items-center gap-2 text-xs font-bold sm:col-span-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#F28C28] w-4 h-4"
                checked={form.trackInventory}
                onChange={(e) => setForm((f) => ({ ...f, trackInventory: e.target.checked }))}
              />
              Track stock for this product
            </label>
            {form.trackInventory && (
              <>
                <Field label="Available stock">
                  <input type="number" min={0} step={1} className={inputClass} value={form.stock} onChange={set("stock")} />
                </Field>
                <Field label="Low-stock alert at">
                  <input type="number" min={0} step={1} className={inputClass} value={form.lowStockThreshold} onChange={set("lowStockThreshold")} />
                </Field>
              </>
            )}
          </div>
        </Panel>

        <Panel title="Shipping and specifications">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Field label="Weight" className="col-span-2 sm:col-span-1">
              <input className={inputClass} value={form.weight} onChange={set("weight")} maxLength={40} placeholder="500 g" />
            </Field>
            <Field label="Length">
              <input type="number" min={0} className={inputClass} value={form.length} onChange={set("length")} />
            </Field>
            <Field label="Width">
              <input type="number" min={0} className={inputClass} value={form.width} onChange={set("width")} />
            </Field>
            <Field label="Height">
              <input type="number" min={0} className={inputClass} value={form.height} onChange={set("height")} />
            </Field>
            <Field label="Unit">
              <select className={inputClass} value={form.unit} onChange={set("unit")}>
                <option value="cm">cm</option>
                <option value="mm">mm</option>
                <option value="in">in</option>
              </select>
            </Field>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300">Specifications</p>
            {form.specifications.map((spec, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="e.g. Material"
                  value={spec.key}
                  maxLength={60}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, specifications: f.specifications.map((s, j) => (j === i ? { ...s, key: e.target.value } : s)) }))
                  }
                />
                <input
                  className={inputClass}
                  placeholder="e.g. Brass"
                  value={spec.value}
                  maxLength={300}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, specifications: f.specifications.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)) }))
                  }
                />
                <button
                  type="button"
                  aria-label="Remove specification"
                  onClick={() => setForm((f) => ({ ...f, specifications: f.specifications.filter((_, j) => j !== i) }))}
                  className="p-2 text-gray-400 hover:text-rose-500 cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {form.specifications.length < 30 && (
              <EnterpriseButton
                variant="ghost"
                size="sm"
                icon={<Plus size={12} />}
                onClick={() => setForm((f) => ({ ...f, specifications: [...f.specifications, { key: "", value: "" }] }))}
              >
                Add specification
              </EnterpriseButton>
            )}
          </div>
        </Panel>
      </fieldset>

      {!locked && (
        <div className="sticky bottom-0 z-10 -mx-1 px-1 py-3 bg-[#F8FAFC]/95 dark:bg-[#070F1B]/95 backdrop-blur flex flex-wrap justify-end gap-2 border-t border-gray-100 dark:border-slate-800">
          <EnterpriseButton variant="outline" icon={<Save size={13} />} loading={saving === "draft"} disabled={saving !== ""} onClick={() => save(false)}>
            {isNew ? "Save draft" : "Save changes"}
          </EnterpriseButton>
          {canSubmit && (
            <EnterpriseButton
              icon={<Send size={13} />}
              loading={saving === "submit"}
              disabled={saving !== "" || vendorStatus !== "active"}
              title={vendorStatus !== "active" ? "Your store must be active to submit products" : undefined}
              onClick={() => save(true)}
            >
              Save and submit for approval
            </EnterpriseButton>
          )}
        </div>
      )}
      {vendorStatus !== "active" && !locked && (
        <p className="text-[11px] text-gray-500 text-right">You can save drafts now and submit them once your store is active.</p>
      )}
    </div>
  );
};

export const VendorProductFormPage: React.FC = () => {
  const { id } = useParams();
  return <RequireStore>{(vendor) => <ProductForm id={id === "new" ? undefined : id} vendorStatus={vendor.status} />}</RequireStore>;
};

export default VendorProductFormPage;
