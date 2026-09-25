import React, { useEffect, useState } from "react";
import { Clock, Loader2, Plus, Trash2, X } from "lucide-react";
import { dayStayService } from "../../../services";
import { getErrorMessage } from "../../../lib/api";

type Product = {
  productCode: string;
  productType: "freshen_up" | "day_rest";
  durationMinutes: number;
  price: number;
  discountPrice?: number;
  enabled?: boolean;
};

type RoomRow = {
  _id: string;
  name?: string;
  type?: string;
  totalInventory?: number;
  count?: number;
  enabled: boolean;
  allocatedInventory: number;
  products: Product[];
};

const DEFAULT_PRODUCTS: Product[] = [
  { productCode: "DAY_REST_4H", productType: "day_rest", durationMinutes: 240, price: 699, enabled: true },
  { productCode: "DAY_REST_6H", productType: "day_rest", durationMinutes: 360, price: 1199, enabled: true },
];

const unwrap = (res: any) => res?.data?.data ?? res?.data;

const inputCls =
  "w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-[#0B192C] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40";

interface Props {
  ashram: { _id: string; name?: string };
  onClose: () => void;
  onSaved?: (enabled: boolean) => void;
}

/** Lets an admin (or owner) turn Short Stay / Day Stay on for a property and set up its rooms. */
export const DayStayManagerModal: React.FC<Props> = ({ ashram, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("20:00");
  const [grace, setGrace] = useState(15);
  const [buffer, setBuffer] = useState(45);
  const [rooms, setRooms] = useState<RoomRow[]>([]);

  useEffect(() => {
    let active = true;
    dayStayService
      .getConfig(ashram._id)
      .then((res) => {
        if (!active) return;
        const data = unwrap(res);
        const cfg = data?.dayStayConfig ?? {};
        setEnabled(Boolean(cfg.enabled));
        setStart(cfg.operatingHours?.start ?? "06:00");
        setEnd(cfg.operatingHours?.end ?? "20:00");
        setGrace(cfg.defaultGraceMinutes ?? 15);
        setBuffer(cfg.defaultHousekeepingBufferMinutes ?? 45);
        setRooms(
          (data?.rooms ?? []).map((r: any) => ({
            _id: String(r._id),
            name: r.name,
            type: r.type,
            totalInventory: r.totalInventory ?? r.count,
            enabled: Boolean(r.dayStayConfig?.enabled),
            allocatedInventory: r.dayStayConfig?.allocatedInventory ?? 0,
            products: r.dayStayConfig?.products?.length ? r.dayStayConfig.products : [],
          })),
        );
      })
      .catch((err) => active && setError(getErrorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ashram._id]);

  const updateRoom = (id: string, patch: Partial<RoomRow>) =>
    setRooms((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));

  const updateProduct = (roomId: string, idx: number, patch: Partial<Product>) =>
    setRooms((rs) =>
      rs.map((r) =>
        r._id === roomId
          ? { ...r, products: r.products.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }
          : r,
      ),
    );

  const save = async () => {
    setError("");
    if (enabled && !rooms.some((r) => r.enabled && r.allocatedInventory > 0)) {
      setError("Enable at least one room with 1 or more units for Short Stay.");
      return;
    }
    setSaving(true);
    try {
      await dayStayService.updateConfig(ashram._id, {
        enabled,
        operatingHours: { start, end },
        defaultGraceMinutes: Number(grace),
        defaultHousekeepingBufferMinutes: Number(buffer),
        rooms: rooms.map((r) => ({
          roomId: r._id,
          enabled: r.enabled,
          allocatedInventory: Number(r.allocatedInventory),
          // Empty list = room sells the standard platform catalog.
          products: r.products.map((p) => ({
            ...p,
            productCode: p.productCode.trim().toUpperCase(),
            durationMinutes: Number(p.durationMinutes),
            price: Number(p.price),
            discountPrice: Number(p.discountPrice) || 0,
          })),
        })),
      });
      onSaved?.(enabled);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#0B192C]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[#F28C28]" />
            <div>
              <h3 className="text-base font-black text-[#0B192C] dark:text-white">Short Stay settings</h3>
              <p className="text-[11px] font-semibold text-gray-400">{ashram.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-[#F28C28]" />
            </div>
          ) : (
            <>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 p-3 dark:border-slate-800">
                <div>
                  <div className="text-sm font-extrabold text-[#0B192C] dark:text-white">Offer Short Stay at this property</div>
                  <div className="text-[11px] text-gray-400">Guests can book hourly rest / freshen-up slots.</div>
                </div>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-5 w-5 accent-[#F28C28]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Opens (IST)">
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Closes (IST)">
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Grace (min)">
                  <input type="number" min={0} max={120} value={grace} onChange={(e) => setGrace(Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Cleaning buffer (min)">
                  <input type="number" min={0} max={180} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} className={inputCls} />
                </Field>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">Rooms</h4>
                {rooms.length === 0 && (
                  <p className="text-xs text-gray-400">This property has no rooms yet. Add rooms first.</p>
                )}
                {rooms.map((r) => (
                  <div key={r._id} className="space-y-3 rounded-xl border border-gray-100 p-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) =>
                            updateRoom(r._id, {
                              enabled: e.target.checked,
                              allocatedInventory:
                                e.target.checked && r.allocatedInventory === 0 ? 1 : r.allocatedInventory,
                            })
                          }
                          className="h-4 w-4 accent-[#F28C28]"
                        />
                        <span className="text-sm font-bold text-[#0B192C] dark:text-white">{r.name || r.type || "Room"}</span>
                        {r.totalInventory != null && (
                          <span className="text-[11px] text-gray-400">({r.totalInventory} total)</span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-500">Short Stay units</span>
                        <input
                          type="number"
                          min={0}
                          max={r.totalInventory ?? undefined}
                          value={r.allocatedInventory}
                          disabled={!r.enabled}
                          onChange={(e) => updateRoom(r._id, { allocatedInventory: Number(e.target.value) })}
                          className={`${inputCls} w-20`}
                        />
                      </div>
                    </div>

                    {r.enabled && (
                      <div className="space-y-2">
                        {r.products.length === 0 ? (
                          <p className="text-[11px] text-gray-400">
                            Uses the standard packages (4h / 6h) at default prices.{" "}
                            <button
                              type="button"
                              onClick={() => updateRoom(r._id, { products: DEFAULT_PRODUCTS.map((p) => ({ ...p })) })}
                              className="font-bold text-[#F28C28] hover:underline"
                            >
                              Customise packages
                            </button>
                          </p>
                        ) : (
                          <>
                            {r.products.map((p, i) => (
                              <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto_auto]">
                                <Field label="Code">
                                  <input value={p.productCode} onChange={(e) => updateProduct(r._id, i, { productCode: e.target.value })} className={inputCls} />
                                </Field>
                                <Field label="Type">
                                  <select
                                    value={p.productType}
                                    onChange={(e) => updateProduct(r._id, i, { productType: e.target.value as Product["productType"] })}
                                    className={inputCls}
                                  >
                                    <option value="day_rest">Day rest</option>
                                    <option value="freshen_up">Freshen-up</option>
                                  </select>
                                </Field>
                                <Field label="Minutes">
                                  <input type="number" min={30} step={30} value={p.durationMinutes} onChange={(e) => updateProduct(r._id, i, { durationMinutes: Number(e.target.value) })} className={inputCls} />
                                </Field>
                                <Field label="Price ₹">
                                  <input type="number" min={0} value={p.price} onChange={(e) => updateProduct(r._id, i, { price: Number(e.target.value) })} className={inputCls} />
                                </Field>
                                <Field label="Offer ₹">
                                  <input type="number" min={0} value={p.discountPrice || ""} onChange={(e) => updateProduct(r._id, i, { discountPrice: Number(e.target.value) })} className={inputCls} />
                                </Field>
                                <label className="flex items-center gap-1 pb-2 text-[11px] font-semibold text-gray-500">
                                  <input type="checkbox" checked={p.enabled !== false} onChange={(e) => updateProduct(r._id, i, { enabled: e.target.checked })} className="accent-[#F28C28]" />
                                  On
                                </label>
                                <button
                                  type="button"
                                  onClick={() => updateRoom(r._id, { products: r.products.filter((_, j) => j !== i) })}
                                  className="pb-2 text-rose-500 hover:text-rose-700"
                                  aria-label="Remove package"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                updateRoom(r._id, {
                                  products: [
                                    ...r.products,
                                    { productCode: "", productType: "day_rest", durationMinutes: 180, price: 599, enabled: true },
                                  ],
                                })
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F28C28] hover:underline"
                            >
                              <Plus size={13} /> Add package
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:bg-rose-950/40">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#F28C28] px-5 py-2 text-xs font-extrabold text-white hover:bg-[#d9781c] disabled:opacity-50"
          >
            {saving && <Loader2 size={13} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
    {children}
  </label>
);

export default DayStayManagerModal;
