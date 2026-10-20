import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Power, UtensilsCrossed, Image as ImageIcon, Star, ArrowLeft, ArrowRight, X, Camera, Upload, Loader2 } from "lucide-react";
import { EnterpriseButton } from "../../admin/shared/components/EnterpriseButton";
import { CameraCaptureModal } from "../../components/shared/CameraCaptureModal";
import { getErrorMessage } from "../../lib/api";
import { toast } from "../../lib/toast";
import { uploadService } from "../../services";
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

/** The API accepts at most this many photos per dish. */
const MAX_PHOTOS = 5;

const isImageFile = (file: File) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name);

const photoButtonClass =
  "flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[#F28C28]/40 bg-[#F28C28]/5 hover:bg-[#F28C28]/10 text-[#F28C28] text-xs font-extrabold transition-colors cursor-pointer";

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
  imageUrls: string[];
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
  imageUrls: [],
  isAvailable: true,
});

const fromItem = (m: FoodMenuItem): Draft => {
  const images = m.imageUrls && m.imageUrls.length > 0
    ? [...m.imageUrls]
    : m.imageUrl ? [m.imageUrl] : [];
  return {
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
    imageUrl: images[0] || m.imageUrl || "",
    imageUrls: images,
    isAvailable: m.isAvailable,
  };
};

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
  const cleanedImages = (d.imageUrls || []).map((u) => u.trim()).filter(Boolean).slice(0, MAX_PHOTOS);
  if (cleanedImages.length > 0) {
    payload.imageUrls = cleanedImages;
    payload.imageUrl = cleanedImages[0];
  } else if (d.imageUrl.trim()) {
    payload.imageUrl = d.imageUrl.trim();
    payload.imageUrls = [d.imageUrl.trim()];
  } else {
    // No photos left: say so, otherwise the previous gallery would silently stay.
    payload.imageUrls = [];
  }
  if (d.cutOffTime) payload.cutOffTime = d.cutOffTime;
  if (d.prepMinutes) payload.prepMinutes = Number(d.prepMinutes);
  if (d.dailyCapacity !== "") payload.dailyCapacity = Number(d.dailyCapacity);
  return payload;
};

const MenuItemForm: React.FC<{
  draft: Draft;
  editing: boolean;
  busy: boolean;
  /** Takes a function too, so a photo that finishes uploading later is added to the draft as it is by then, not as it was when the upload began. */
  onChange: (d: Draft | ((prev: Draft) => Draft)) => void;
  onSubmit: () => void;
  onCancel: () => void;
}> = ({ draft, editing, busy, onChange, onSubmit, onCancel }) => {
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploading, setUploading] = useState(0); // photos still uploading
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => onChange({ ...draft, [key]: value });
  const priceOk = Number(draft.price) >= 1;

  /** Uploads the picked or captured photos and adds them to the gallery. */
  const uploadPhotos = async (files: File[]) => {
    const images = files.filter(isImageFile);
    if (!images.length) {
      toast.error("Please choose an image file (JPG, PNG or WEBP).");
      return;
    }
    const room = MAX_PHOTOS - draft.imageUrls.length - uploading;
    if (room <= 0) {
      toast.error(`You can add up to ${MAX_PHOTOS} photos per dish.`);
      return;
    }
    const picked = images.slice(0, room);
    if (images.length > room) toast.warning(`Only ${room} more photo${room === 1 ? "" : "s"} fit, so the rest were skipped.`);

    setUploading((n) => n + picked.length);
    const results = await Promise.allSettled(picked.map((file) => uploadService.file(file, "food-dishes")));
    if (!alive.current) return; // the form was closed or switched to another dish meanwhile
    setUploading((n) => n - picked.length);

    const urls = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (urls.length)
      onChange((prev) => {
        const next = [...prev.imageUrls, ...urls].slice(0, MAX_PHOTOS);
        return { ...prev, imageUrls: next, imageUrl: next[0] || "" };
      });
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed.length)
      toast.error(failed.length === 1 ? getErrorMessage(failed[0].reason, "The photo could not be uploaded.") : `${failed.length} photos could not be uploaded. Please try again.`);
  };

  const onFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); // copy before the input is reset
    e.target.value = "";
    if (files.length) void uploadPhotos(files);
  };

  /** Phones and tablets open their own camera app; desktops get the in-page camera. */
  const openCamera = () => {
    if (window.matchMedia?.("(pointer: coarse)").matches) cameraRef.current?.click();
    else setCameraOpen(true);
  };

  const handleAddImage = () => {
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;
    if (draft.imageUrls.length + uploading >= MAX_PHOTOS) {
      toast.error(`You can add up to ${MAX_PHOTOS} images per dish.`);
      return;
    }
    const nextImages = [...draft.imageUrls, trimmed];
    onChange({
      ...draft,
      imageUrls: nextImages,
      imageUrl: nextImages[0] || "",
    });
    setNewImageUrl("");
  };

  const handleRemoveImage = (idx: number) => {
    const nextImages = draft.imageUrls.filter((_, i) => i !== idx);
    onChange({
      ...draft,
      imageUrls: nextImages,
      imageUrl: nextImages[0] || "",
    });
  };

  const handleSetCover = (idx: number) => {
    if (idx === 0) return;
    const target = draft.imageUrls[idx];
    const rest = draft.imageUrls.filter((_, i) => i !== idx);
    const nextImages = [target, ...rest];
    onChange({
      ...draft,
      imageUrls: nextImages,
      imageUrl: nextImages[0] || "",
    });
  };

  const handleMoveImage = (idx: number, delta: -1 | 1) => {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= draft.imageUrls.length) return;
    const copy = [...draft.imageUrls];
    const temp = copy[idx];
    copy[idx] = copy[nextIdx];
    copy[nextIdx] = temp;
    onChange({
      ...draft,
      imageUrls: copy,
      imageUrl: copy[0] || "",
    });
  };

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Prep time (min)">
          <input type="number" min={1} max={240} className={inputClass} value={draft.prepMinutes} onChange={(e) => set("prepMinutes", e.target.value)} />
        </Field>
        <Field label="Daily stock" hint="Portions you can make per day.">
          <input type="number" min={0} max={100000} className={inputClass} value={draft.dailyCapacity} onChange={(e) => set("dailyCapacity", e.target.value)} />
        </Field>
        <Field label="Order cut-off" hint="Optional.">
          <input type="time" className={inputClass} value={draft.cutOffTime} onChange={(e) => set("cutOffTime", e.target.value)} />
        </Field>
      </div>

      {/* ── Up to 5 Product Images Gallery ── */}
      <div className="space-y-2.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/40 p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <ImageIcon size={14} className="text-[#F28C28]" />
              Dish Photos &amp; Thali Gallery
              <span className="text-[11px] font-semibold text-gray-500">
                ({draft.imageUrls.length}/{MAX_PHOTOS} photos)
              </span>
            </label>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Add up to {MAX_PHOTOS} photos. First image is the primary cover displayed on the food marketplace.
            </p>
          </div>
          {draft.imageUrls.length >= MAX_PHOTOS && (
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
              Max {MAX_PHOTOS} photos reached
            </span>
          )}
        </div>

        {/* Add photos: from the device, with the camera, or by link */}
        {draft.imageUrls.length + uploading < MAX_PHOTOS && (
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFilesChosen} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFilesChosen} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className={photoButtonClass}>
                <Upload size={15} /> Upload from device
              </button>
              <button type="button" onClick={openCamera} className={photoButtonClass}>
                <Camera size={15} /> Take photo
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                className={inputClass}
                placeholder="Or paste a photo link (https://...)"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddImage();
                  }
                }}
              />
              <EnterpriseButton
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus size={13} />}
                onClick={handleAddImage}
                disabled={!newImageUrl.trim()}
              >
                Add Photo
              </EnterpriseButton>
            </div>
          </div>
        )}
        {cameraOpen && (
          <CameraCaptureModal
            onClose={() => setCameraOpen(false)}
            onCapture={(file) => {
              setCameraOpen(false);
              void uploadPhotos([file]);
            }}
          />
        )}

        {/* Image thumbnails list */}
        {(draft.imageUrls.length > 0 || uploading > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            {draft.imageUrls.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className={`group relative rounded-xl border overflow-hidden bg-white dark:bg-slate-800 p-1 flex flex-col transition-all ${
                  idx === 0
                    ? "border-[#F28C28] ring-1 ring-[#F28C28]/40 shadow-xs"
                    : "border-gray-200 dark:border-slate-700"
                }`}
              >
                <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-900">
                  <img
                    src={url}
                    alt={`Product photo ${idx + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://placehold.co/300x200?text=Invalid+Image";
                    }}
                  />
                  {idx === 0 ? (
                    <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-md bg-[#F28C28] px-1.5 py-0.5 text-[9px] font-black text-white shadow-xs">
                      <Star size={9} fill="currentColor" /> Cover
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="Set as cover photo"
                      onClick={() => handleSetCover(idx)}
                      className="absolute top-1 left-1 rounded-md bg-black/70 hover:bg-[#F28C28] text-white px-1.5 py-0.5 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Make Cover
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remove photo"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shadow-xs"
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between px-0.5">
                  <span className="text-[9px] font-bold text-gray-500">#{idx + 1}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Move left"
                      disabled={idx === 0}
                      onClick={() => handleMoveImage(idx, -1)}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-20"
                    >
                      <ArrowLeft size={10} />
                    </button>
                    <button
                      type="button"
                      title="Move right"
                      disabled={idx === draft.imageUrls.length - 1}
                      onClick={() => handleMoveImage(idx, 1)}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-20"
                    >
                      <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <div key={`uploading-${i}`} className="rounded-xl border border-dashed border-[#F28C28]/50 bg-white dark:bg-slate-800 p-1">
                <div className="aspect-video w-full rounded-lg bg-gray-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-1 text-[#F28C28]">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-[9px] font-bold">Uploading…</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
        <input type="checkbox" checked={draft.isAvailable} onChange={(e) => set("isAvailable", e.target.checked)} />
        Available to order right now
      </label>
      <div className="flex justify-end gap-2">
        <EnterpriseButton variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </EnterpriseButton>
        <EnterpriseButton type="submit" size="sm" loading={busy} disabled={busy || uploading > 0 || !draft.label.trim() || !priceOk}>
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
  // `session` is new for every opened editor, so the form (and any photo still uploading in it) never carries over to another dish.
  const [editor, setEditor] = useState<{ id: string | null; draft: Draft; session: number } | null>(null);
  const sessions = useRef(0);
  const openEditor = (id: string | null, draft: Draft) => setEditor({ id, draft, session: ++sessions.current });
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
          <EnterpriseButton size="sm" icon={<Plus size={14} />} onClick={() => openEditor(null, blank())}>
            Add dish
          </EnterpriseButton>
        </div>
      </div>

      {editor && (
        <Panel title={editor.id ? "Edit dish" : "New dish"}>
          <MenuItemForm
            key={editor.session}
            draft={editor.draft}
            editing={Boolean(editor.id)}
            busy={busy === "save"}
            onChange={(update) =>
              setEditor((cur) => (cur ? { ...cur, draft: typeof update === "function" ? update(cur.draft) : update } : cur))
            }
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
              {(m.imageUrl || (m.imageUrls && m.imageUrls.length > 0)) && (
                <div className="relative h-28 w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-900">
                  <img
                    src={m.imageUrl || m.imageUrls?.[0]}
                    alt={m.label}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://placehold.co/300x200?text=Food+Item";
                    }}
                  />
                  {m.imageUrls && m.imageUrls.length > 1 && (
                    <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/75 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      <ImageIcon size={10} /> {m.imageUrls.length} photos
                    </span>
                  )}
                </div>
              )}
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
                <button type="button" aria-label={`Edit ${m.label}`} onClick={() => openEditor(m.id, fromItem(m))} className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 hover:border-[#F28C28] hover:text-[#F28C28]">
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
