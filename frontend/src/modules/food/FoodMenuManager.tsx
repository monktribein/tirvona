import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Power, UtensilsCrossed } from "lucide-react";
import { EnterpriseButton } from "../../admin/shared/components/EnterpriseButton";
import { toast } from "../../lib/toast";
import { Chips, Empty, Field, Panel, PanelState, Pill, inputClass } from "../marketplace/ui";
import type { LoadState } from "../marketplace/ui";
import { foodPartnerService } from "../../services/foodPartner.service";
import type {
  FoodMenuItem,
  FoodMenuItemInput,
  FoodPartnerOutlet,
  FoodScope,
} from "../../services/foodPartner.service";
import { DIETARY_TAGS, FAMILIES, rupees } from "./foodUi";

type Draft = {
  label: string;
  family: string;
  price: string; // rupees as typed
  contents: string;
  description: string;
  dietaryTags: string[];
  prepMinutes: string;
  portion: string;
  dailyCapacity: string;
  cutOffTime: string;
  imageUrl: string;
  isAvailable: boolean;
};

const blank = (): Draft => ({
  label: "",
  family: "THALI",
  price: "",
  contents: "",
  description: "",
  dietaryTags: ["vegetarian"],
  prepMinutes: "20",
  portion: "",
  dailyCapacity: "50",
  cutOffTime: "",
  imageUrl: "",
  isAvailable: true,
});

const fromItem = (m: FoodMenuItem): Draft => ({
  label: m.label,
  family: m.family,
  price: String(m.pricePaise / 100),
  contents: m.contents,
  description: m.description,
  dietaryTags: m.dietaryTags,
  prepMinutes: String(m.prepMinutes ?? ""),
  portion: m.portion,
  dailyCapacity: String(m.dailyCapacity ?? ""),
  cutOffTime: m.cutOffTime,
  imageUrl: m.imageUrl,
  isAvailable: m.isAvailable,
});

/** Blank optional fields are omitted: the API rejects empty times and numbers. */
const toPayload = (d: Draft): FoodMenuItemInput => {
  const payload: FoodMenuItemInput = {
    label: d.label.trim(),
    family: d.family,
    pricePaise: Math.round(Number(d.price) * 100),
    dietaryTags: d.dietaryTags,
    isAvailable: d.isAvailable,
  };
  if (d.contents.trim()) payload.contents = d.contents.trim();
  if (d.description.trim()) payload.description = d.description.trim();
  if (d.portion.trim()) payload.portion = d.portion.trim();
  if (d.imageUrl.trim()) payload.imageUrl = d.imageUrl.trim();
  if (d.cutOffTime) payload.cutOffTime = d.cutOffTime;
  if (d.prepMinutes) payload.prepMinutes = Number(d.prepMinutes);
  if (d.dailyCapacity !== "") payload.dailyCapacity = Number(d.dailyCapacity);
  return payload;
};

const MenuItemForm: React.FC<{
  draft: Draft;
  editing: boolean;
  busy: boolean;
  onChange: (d: Draft) => void;
  onSubmit: () => void;
  onCancel: () => void;
}> = ({ draft, editing, busy, onChange, onSubmit, onCancel }) => {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => onChange({ ...draft, [key]: value });
  const priceOk = Number(draft.price) >= 1;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Dish name" required>
          <input className={inputClass} required minLength={2} maxLength={120} value={draft.label} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Satvik Brij Thali" />
        </Field>
        <Field label="Type" required>
          <select className={inputClass} value={draft.family} onChange={(e) => set("family", e.target.value)}>
            {FAMILIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price (₹)" required hint="Minimum ₹1.">
          <input type="number" min={1} step="0.5" required className={inputClass} value={draft.price} onChange={(e) => set("price", e.target.value)} />
        </Field>
        <Field label="Portion" hint="e.g. 1 person, 450 g">
          <input className={inputClass} maxLength={60} value={draft.portion} onChange={(e) => set("portion", e.target.value)} />
        </Field>
      </div>
      <Field label="What is included" hint="Roti, dal, sabzi, rice, sweet…">
        <textarea className={inputClass} rows={2} maxLength={1000} value={draft.contents} onChange={(e) => set("contents", e.target.value)} />
      </Field>
      <Field label="Diet &amp; spice tags">
        <div className="flex flex-wrap gap-2">
          {DIETARY_TAGS.map(([v, l]) => {
            const on = draft.dietaryTags.includes(v);
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => set("dietaryTags", on ? draft.dietaryTags.filter((t) => t !== v) : [...draft.dietaryTags, v])}
                className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition-all ${on ? "bg-[#F28C28] border-[#F28C28] text-white" : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:border-[#F28C28]"}`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Prep time (min)">
          <input type="number" min={1} max={240} className={inputClass} value={draft.prepMinutes} onChange={(e) => set("prepMinutes", e.target.value)} />
        </Field>
        <Field label="Daily stock" hint="Portions you can make per day.">
          <input type="number" min={0} max={100000} className={inputClass} value={draft.dailyCapacity} onChange={(e) => set("dailyCapacity", e.target.value)} />
        </Field>
        <Field label="Order cut-off" hint="Optional.">
          <input type="time" className={inputClass} value={draft.cutOffTime} onChange={(e) => set("cutOffTime", e.target.value)} />
        </Field>
        <Field label="Photo URL" hint="Optional.">
          <input className={inputClass} maxLength={500} value={draft.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
        <input type="checkbox" checked={draft.isAvailable} onChange={(e) => set("isAvailable", e.target.checked)} />
        Available to order right now
      </label>
      <div className="flex justify-end gap-2">
        <EnterpriseButton variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </EnterpriseButton>
        <EnterpriseButton type="submit" size="sm" loading={busy} disabled={busy || !draft.label.trim() || !priceOk}>
          {editing ? "Save dish" : "Add dish"}
        </EnterpriseButton>
      </div>
    </form>
  );
};

/** Menu and inventory of one restaurant: add, edit, price, stock, availability, remove. */
export const FoodMenuManager: React.FC<{
  scope: FoodScope;
  outlets: FoodPartnerOutlet[];
}> = ({ scope, outlets }) => {
  const [outletId, setOutletId] = useState(outlets[0]?._id ?? "");
  const [items, setItems] = useState<FoodMenuItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [family, setFamily] = useState("ALL");
  const [editor, setEditor] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!outlets.some((o) => o._id === outletId)) setOutletId(outlets[0]?._id ?? "");
  }, [outlets, outletId]);

  const load = useCallback(async () => {
    if (!outletId) return;
    setState((s) => (s === "ready" ? s : "loading"));
    try {
      setItems(await foodPartnerService.listMenu(scope, outletId));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [scope, outletId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => items.filter((m) => family === "ALL" || m.family === family),
    [items, family],
  );

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await load();
      return true;
    } catch {
      return false; // the API layer already showed the error
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    if (!editor) return;
    const payload = toPayload(editor.draft);
    const ok = await run(
      "save",
      () =>
        editor.id
          ? foodPartnerService.updateMenuItem(scope, editor.id, payload)
          : foodPartnerService.createMenuItem(scope, outletId, payload),
      editor.id ? "Dish updated" : "Dish added",
    );
    if (ok) setEditor(null);
  };

  const remove = async (m: FoodMenuItem) => {
    if (!window.confirm(`Remove "${m.label}" from the menu?`)) return;
    setBusy(`del-${m.id}`);
    try {
      const res = await foodPartnerService.deleteMenuItem(scope, m.id);
      toast.success(
        res.hidden
          ? "This dish has past orders, so it was hidden instead of deleted."
          : "Dish removed",
      );
      await load();
    } catch {
      /* shown by the API layer */
    } finally {
      setBusy("");
    }
  };

  if (!outlets.length)
    return (
      <Panel>
        <Empty
          icon={<UtensilsCrossed size={28} className="text-gray-300" />}
          title="Add a kitchen first"
          text="Your menu belongs to a kitchen. Add your first outlet in Restaurant Profile, then come back to add dishes."
        />
      </Panel>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {outlets.length > 1 && (
          <select className={`${inputClass} !w-auto`} value={outletId} onChange={(e) => setOutletId(e.target.value)} aria-label="Kitchen">
            {outlets.map((o) => (
              <option key={o._id} value={o._id}>
                {o.brandName}
              </option>
            ))}
          </select>
        )}
        <Chips
          value={family}
          onChange={setFamily}
          options={[{ value: "ALL", label: `All (${items.length})` }, ...FAMILIES.map(([v, l]) => ({ value: v, label: `${l.split(" ")[0]} (${items.filter((m) => m.family === v).length})` }))]}
        />
        <div className="ml-auto">
          <EnterpriseButton size="sm" icon={<Plus size={14} />} onClick={() => setEditor({ id: null, draft: blank() })}>
            Add dish
          </EnterpriseButton>
        </div>
      </div>

      {editor && (
        <Panel title={editor.id ? "Edit dish" : "New dish"}>
          <MenuItemForm
            draft={editor.draft}
            editing={Boolean(editor.id)}
            busy={busy === "save"}
            onChange={(draft) => setEditor({ ...editor, draft })}
            onSubmit={save}
            onCancel={() => setEditor(null)}
          />
        </Panel>
      )}

      {state !== "ready" ? (
        <PanelState state={state} onRetry={load} />
      ) : visible.length === 0 ? (
        <Panel>
          <Empty
            icon={<UtensilsCrossed size={28} className="text-gray-300" />}
            title={items.length ? "No dishes in this type" : "No dishes yet"}
            text={items.length ? undefined : "Add your first thali, bowl or combo so customers can order it."}
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((m) => (
            <div key={m.id} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[20px] p-4 shadow-sm flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#0B192C] dark:text-white truncate">{m.label}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{m.family}</p>
                </div>
                <p className="text-sm font-black text-[#F28C28] tabular-nums shrink-0">{rupees(m.pricePaise)}</p>
              </div>
              {m.contents && <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">{m.contents}</p>}
              <div className="flex flex-wrap gap-1">
                {m.dietaryTags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-[9px] font-bold text-gray-600 dark:text-gray-300">
                    {t.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>
                  Stock/day: <strong className="text-[#0B192C] dark:text-white">{m.dailyCapacity}</strong> · {m.prepMinutes} min
                </span>
                <Pill label={m.isAvailable ? "Available" : "Hidden"} tone={m.isAvailable ? "green" : "gray"} />
              </div>
              <div className="flex items-center gap-2 pt-1 mt-auto">
                <EnterpriseButton
                  variant="outline"
                  size="sm"
                  icon={<Power size={12} />}
                  loading={busy === `av-${m.id}`}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    run(`av-${m.id}`, () => foodPartnerService.updateMenuItem(scope, m.id, { isAvailable: !m.isAvailable }), m.isAvailable ? "Dish hidden" : "Dish is available")
                  }
                >
                  {m.isAvailable ? "Mark sold out" : "Make available"}
                </EnterpriseButton>
                <button type="button" aria-label={`Edit ${m.label}`} onClick={() => setEditor({ id: m.id, draft: fromItem(m) })} className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 hover:border-[#F28C28] hover:text-[#F28C28]">
                  <Pencil size={13} />
                </button>
                <button type="button" aria-label={`Remove ${m.label}`} disabled={busy === `del-${m.id}`} onClick={() => remove(m)} className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 hover:border-rose-400 hover:text-rose-500 disabled:opacity-50">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
