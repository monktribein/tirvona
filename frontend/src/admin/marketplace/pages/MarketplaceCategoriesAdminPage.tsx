import React, { useState } from "react";
import { Tags, Pencil, Plus } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../../shared/components/EnterpriseModal";
import { FileUploader } from "../../../components/FileUploader";
import { marketplaceAdminApi } from "../../../services/marketplace.service";
import { Empty, Field, Panel, PanelState, Pill, inputClass, useAction, useRemote } from "../../../modules/marketplace/ui";

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  status?: string;
  sortOrder?: number;
  commissionPercent?: number | null;
  children?: Category[];
}

const flatten = (tree: Category[], depth = 0): Array<Category & { depth: number }> =>
  tree.flatMap((c) => [{ ...c, depth }, ...flatten(c.children ?? [], depth + 1)]);

export const MarketplaceCategoriesAdminPage: React.FC = () => {
  const { data, state, error, reload } = useRemote<Category[]>(() => marketplaceAdminApi.categories(), []);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const { busy, run } = useAction();
  const rows = flatten(data ?? []);

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Marketplace categories"
        subtitle="Categories vendors list products under. Commission set here applies to the category and its sub-categories unless overridden."
        icon={<Tags size={20} />}
        actions={
          <EnterpriseButton icon={<Plus size={14} />} onClick={() => setEditing("new")}>
            New category
          </EnterpriseButton>
        }
      />
      <Panel>
        {state !== "ready" ? (
          <PanelState state={state} error={error} onRetry={reload} />
        ) : !rows.length ? (
          <Empty title="No categories yet" text="Create the first category so vendors can list products." />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800 -my-2">
            {rows.map((c) => (
              <li key={c._id} className="py-2.5 flex flex-wrap items-center gap-2 text-xs" style={{ paddingLeft: `${c.depth * 20}px` }}>
                <span className="font-extrabold text-[#0B192C] dark:text-white">{c.name}</span>
                <span className="text-gray-400">/{c.slug}</span>
                <Pill status={c.status === "inactive" ? "inactive" : "active"} />
                {c.commissionPercent != null && <Pill tone="saffron" label={`${c.commissionPercent}% commission`} />}
                <span className="ml-auto flex gap-1.5">
                  <EnterpriseButton size="sm" variant="outline" icon={<Pencil size={12} />} onClick={() => setEditing(c)}>
                    Edit
                  </EnterpriseButton>
                  <EnterpriseButton
                    size="sm"
                    variant="ghost"
                    loading={busy === c._id}
                    onClick={() =>
                      run(
                        c._id,
                        () => marketplaceAdminApi.updateCategory(c._id, { status: c.status === "inactive" ? "active" : "inactive" }),
                        reload,
                        c.status === "inactive" ? "Category reactivated" : "Category deactivated",
                      )
                    }
                  >
                    {c.status === "inactive" ? "Reactivate" : "Deactivate"}
                  </EnterpriseButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {editing && (
        <CategoryForm
          category={editing === "new" ? null : editing}
          options={rows}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
};

const CategoryForm: React.FC<{
  category: Category | null;
  options: Array<Category & { depth: number }>;
  onClose: () => void;
  onSaved: () => void;
}> = ({ category, options, onClose, onSaved }) => {
  const [f, setF] = useState({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    image: category?.image ?? "",
    parentId: category?.parentId ? String(category.parentId) : "",
    sortOrder: category?.sortOrder != null ? String(category.sortOrder) : "",
    commissionPercent: category?.commissionPercent != null ? String(category.commissionPercent) : "",
  });
  const { busy, run } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = () => {
    const payload: Record<string, unknown> = {
      name: f.name.trim(),
      description: f.description.trim() || undefined,
      image: f.image || undefined,
      sortOrder: f.sortOrder === "" ? undefined : Number(f.sortOrder),
      commissionPercent: f.commissionPercent === "" ? undefined : Number(f.commissionPercent),
    };
    if (f.slug.trim()) payload.slug = f.slug.trim().toLowerCase();
    if (category) payload.parentId = f.parentId || null;
    else if (f.parentId) payload.parentId = f.parentId;
    run(
      "save",
      () => (category ? marketplaceAdminApi.updateCategory(category._id, payload) : marketplaceAdminApi.createCategory(payload)),
      onSaved,
      category ? "Category updated" : "Category created",
    );
  };

  return (
    <EnterpriseModal
      isOpen
      onClose={onClose}
      title={category ? "Edit category" : "New category"}
      maxWidth="xl"
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton loading={busy === "save"} disabled={f.name.trim().length < 2} onClick={save}>
            Save
          </EnterpriseButton>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name" required>
          <input className={inputClass} value={f.name} onChange={set("name")} maxLength={80} />
        </Field>
        <Field label="Slug" hint="Lowercase words with hyphens. Generated when blank.">
          <input className={inputClass} value={f.slug} onChange={set("slug")} />
        </Field>
        <Field label="Parent category">
          <select className={inputClass} value={f.parentId} onChange={set("parentId")}>
            <option value="">None (top level)</option>
            {options
              .filter((o) => o._id !== category?._id)
              .map((o) => (
                <option key={o._id} value={o._id}>
                  {"— ".repeat(o.depth)}
                  {o.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Sort order">
          <input className={inputClass} type="number" min={0} value={f.sortOrder} onChange={set("sortOrder")} />
        </Field>
        <Field label="Commission %" hint="Blank = inherit from parent / global default.">
          <input className={inputClass} type="number" min={0} max={100} step="0.1" value={f.commissionPercent} onChange={set("commissionPercent")} />
        </Field>
        <Field label="Image">
          <FileUploader folder="marketplace/categories" currentUrl={f.image || undefined} onUploaded={(url) => setF((x) => ({ ...x, image: url }))} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea className={inputClass} rows={3} value={f.description} onChange={set("description")} maxLength={1000} />
        </Field>
      </div>
    </EnterpriseModal>
  );
};

export default MarketplaceCategoriesAdminPage;
