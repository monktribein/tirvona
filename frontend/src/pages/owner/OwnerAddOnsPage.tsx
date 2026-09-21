import React, { useState, useEffect, useCallback, useRef } from "react";
import { ashramService } from "../../services";
import { useNotifications } from "../../contexts/NotificationContext";
import { formatCurrency } from "../../utils/format";
import {
  useAshramSelection,
  ALL_ASHRAMS,
} from "../../hooks/useAshramSelection";
import {
  Sparkles,
  Plus,
  Edit3,
  Trash2,
  X,
  ToggleLeft,
  ToggleRight,
  Building2,
  BedDouble,
  Utensils,
  Package,
  Car,
  Lock,
  Layers,
} from "lucide-react";

export interface AddOnServiceItem {
  _id?: string;
  name: string;
  category?: "bed" | "meals" | "prasad" | "parking" | "locker" | "general" | string;
  price: number;
  unit:
    | "per_day"
    | "per_meal"
    | "per_person"
    | "one_time"
    | "per_box"
    | "per_bed"
    | "per_night";
  unitLabel: string;
  maxQuantity: number;
  enabled: boolean;
  iconUrl?: string;
  description?: string;
  ashramId?: string;
  ashramName?: string;
}

const PRESET_TEMPLATES = [
  {
    key: "bed",
    label: "Add-on Bed",
    icon: BedDouble,
    defaultPrice: 250,
    data: {
      name: "Add-on Bed",
      category: "bed",
      price: 250,
      unit: "per_day" as const,
      unitLabel: "Bed / Day",
      maxQuantity: 5,
      enabled: true,
      description:
        "Comfortable extra bed / mattress with clean bedding set for additional guests.",
    },
  },
  {
    key: "meals",
    label: "Satvik Meals",
    icon: Utensils,
    defaultPrice: 120,
    data: {
      name: "Satvik Meals (Pure Veg)",
      category: "meals",
      price: 120,
      unit: "per_meal" as const,
      unitLabel: "Meal",
      maxQuantity: 10,
      enabled: true,
      description:
        "Pure sattvic vegetarian breakfast, lunch, or dinner prepared in temple kitchen.",
    },
  },
  {
    key: "prasad",
    label: "Prasad Box",
    icon: Package,
    defaultPrice: 50,
    data: {
      name: "Sacred Prasad Box",
      category: "prasad",
      price: 50,
      unit: "per_box" as const,
      unitLabel: "Box",
      maxQuantity: 10,
      enabled: true,
      description: "Freshly packed blessed temple prasad and dry sweets.",
    },
  },
  {
    key: "parking",
    label: "Parking Slot",
    icon: Car,
    defaultPrice: 80,
    data: {
      name: "Parking Slot (Car/Bus)",
      category: "parking",
      price: 80,
      unit: "per_day" as const,
      unitLabel: "Day",
      maxQuantity: 2,
      enabled: true,
      description: "Secure dedicated parking space inside ashram premises.",
    },
  },
  {
    key: "locker",
    label: "Personal Locker",
    icon: Lock,
    defaultPrice: 30,
    data: {
      name: "Personal Locker Access",
      category: "locker",
      price: 30,
      unit: "per_day" as const,
      unitLabel: "Day",
      maxQuantity: 3,
      enabled: true,
      description: "Secure digital locker unit for pilgrim luggage and valuables.",
    },
  },
];

export const OwnerAddOnsPage: React.FC = () => {
  const { addNotification, confirmAction } = useNotifications();
  const [addOns, setAddOns] = useState<AddOnServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AddOnServiceItem | null>(null);
  const [formData, setFormData] = useState<AddOnServiceItem>({
    name: "Add-on Bed",
    category: "bed",
    price: 250,
    unit: "per_day",
    unitLabel: "Bed / Day",
    maxQuantity: 5,
    enabled: true,
    description:
      "Comfortable extra bed / mattress with clean bedding set for additional guests.",
  });
  const [formAshramId, setFormAshramId] = useState("");
  const [saving, setSaving] = useState(false);

  const notifyRef = useRef(addNotification);
  notifyRef.current = addNotification;

  const {
    ashrams: myAshrams,
    selectedAshramId,
    setSelectedAshramId,
    loadingAshrams,
    targetAshrams,
    isAllSelected,
  } = useAshramSelection({
    storageKey: "tirvona:addons-ashram-filter",
    allowAll: true,
    onError: () =>
      notifyRef.current("Unable to load your ashrams.", "error"),
  });

  const targetsRef = useRef<any[]>([]);
  targetsRef.current = targetAshrams;

  const fetchAddOns = useCallback(async () => {
    setLoading(true);
    try {
      const targets = targetsRef.current;
      const results = await Promise.allSettled(
        targets.map((a: any) => ashramService.getAddOns(a._id)),
      );
      const merged: AddOnServiceItem[] = [];
      let failures = 0;
      results.forEach((result, index) => {
        if (result.status !== "fulfilled" || !result.value.data?.success) {
          failures += 1;
          return;
        }
        const owner = targets[index];
        (result.value.data.data || []).forEach((item: AddOnServiceItem) =>
          merged.push({
            ...item,
            ashramId: owner._id,
            ashramName: owner.name,
          }),
        );
      });
      setAddOns(merged);
      if (failures > 0)
        notifyRef.current(
          `Could not load add-on services for ${failures} ashram(s).`,
          "error",
        );
    } catch (err) {
      console.error("Fetch add-ons error:", err);
      setAddOns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedAshramId) {
      setAddOns([]);
      setLoading(false);
      return;
    }
    fetchAddOns();
  }, [selectedAshramId, fetchAddOns]);

  const handleOpenAddModal = (presetKey?: string) => {
    setEditingItem(null);
    const selectedOwner =
      selectedAshramId && selectedAshramId !== ALL_ASHRAMS
        ? selectedAshramId
        : myAshrams[0]?._id || "";
    setFormAshramId(selectedOwner);

    const preset = PRESET_TEMPLATES.find((p) => p.key === presetKey) || PRESET_TEMPLATES[0];
    setFormData({ ...preset.data });
    setModalOpen(true);
  };

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setFormData((prev) => ({
      ...prev,
      ...preset.data,
    }));
  };

  const handleOpenEditModal = (item: AddOnServiceItem) => {
    setEditingItem(item);
    setFormAshramId(String(item.ashramId || selectedAshramId || ""));
    setFormData({
      ...item,
      category:
        item.category ||
        (/bed/i.test(item.name)
          ? "bed"
          : /meal/i.test(item.name)
            ? "meals"
            : /prasad/i.test(item.name)
              ? "prasad"
              : /parking/i.test(item.name)
                ? "parking"
                : /locker/i.test(item.name)
                  ? "locker"
                  : "general"),
    });
    setModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAshramId && !formAshramId) return;
    if (!formData.name.trim() || formData.price < 0) {
      addNotification("Please enter a valid service name and price.", "error");
      return;
    }

    setSaving(true);
    try {
      const ashramIdToUse = formAshramId || selectedAshramId;
      if (editingItem?._id) {
        const res = await ashramService.updateAddOn(
          ashramIdToUse,
          editingItem._id,
          formData,
        );
        if (res.data?.success)
          addNotification("Add-On service updated successfully.", "success");
      } else {
        const res = await ashramService.createAddOn(ashramIdToUse, formData);
        if (res.data?.success)
          addNotification("Add-On service created successfully.", "success");
      }
      setModalOpen(false);
      if (
        !editingItem &&
        selectedAshramId !== ALL_ASHRAMS &&
        formAshramId &&
        formAshramId !== selectedAshramId
      )
        setSelectedAshramId(formAshramId);
      else fetchAddOns();
    } catch (err: any) {
      console.error("Save add-on error:", err);
      addNotification(
        err.response?.data?.message || "Error saving add-on service.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnable = async (item: AddOnServiceItem) => {
    const ownerId = item.ashramId || selectedAshramId;
    if (!ownerId || ownerId === ALL_ASHRAMS || !item._id) return;
    try {
      const res = await ashramService.updateAddOn(ownerId, item._id, {
        enabled: !item.enabled,
      });
      if (res.data?.success) {
        addNotification(
          `Service ${!item.enabled ? "enabled" : "disabled"}`,
          "info",
        );
        fetchAddOns();
      }
    } catch (err) {
      console.error("Toggle enable error:", err);
    }
  };

  const handleDeleteService = async (item: AddOnServiceItem) => {
    const ownerId = item.ashramId || selectedAshramId;
    if (!ownerId || ownerId === ALL_ASHRAMS || !item._id) return;
    if (
      !(await confirmAction({
        title: "Delete add-on service?",
        message: "Visitors will no longer be able to select this service.",
        confirmLabel: "Delete Service",
        tone: "danger",
      }))
    )
      return;

    try {
      const res = await ashramService.deleteAddOn(ownerId, item._id);
      if (res.data?.success) {
        addNotification("Add-On service deleted.", "success");
        fetchAddOns();
      }
    } catch (err: any) {
      console.error("Delete add-on error:", err);
      addNotification(
        err.response?.data?.message || "Error deleting add-on service.",
        "error",
      );
    }
  };

  const getItemIcon = (item: AddOnServiceItem) => {
    const cat = item.category?.toLowerCase() || "";
    const name = item.name.toLowerCase();
    if (cat === "bed" || name.includes("bed") || name.includes("mattress")) {
      return <BedDouble size={18} className="text-[#F28C28] shrink-0" />;
    }
    if (cat === "meals" || name.includes("meal") || name.includes("food")) {
      return <Utensils size={18} className="text-emerald-600 shrink-0" />;
    }
    if (cat === "prasad" || name.includes("prasad")) {
      return <Package size={18} className="text-amber-600 shrink-0" />;
    }
    if (cat === "parking" || name.includes("parking")) {
      return <Car size={18} className="text-blue-600 shrink-0" />;
    }
    if (cat === "locker" || name.includes("locker")) {
      return <Lock size={18} className="text-indigo-600 shrink-0" />;
    }
    return <Sparkles size={18} className="text-[#F28C28] shrink-0" />;
  };

  const isBedItem = (item: AddOnServiceItem) => {
    const cat = item.category?.toLowerCase() || "";
    const name = item.name.toLowerCase();
    return cat === "bed" || name.includes("bed") || name.includes("mattress");
  };

  return (
    <div className="space-y-6 text-left w-full">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0B192C] p-6 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black text-[#0B192C] dark:text-white">
              Add-On Services (Dynamic Pricing)
            </h1>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-[#F28C28] dark:bg-blue-950 dark:text-amber-300">
              Extra Beds & Guest Services
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 font-semibold">
            Configure extra beds, meals, prasad, and services with custom pricing for your stay guests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {myAshrams.length > 0 && (
            <div className="relative">
              <select
                value={selectedAshramId}
                onChange={(e) => setSelectedAshramId(e.target.value)}
                aria-label="Select stay"
                className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none cursor-pointer"
              >
                {myAshrams.length > 1 && (
                  <option value={ALL_ASHRAMS}>
                    All Stays ({myAshrams.length})
                  </option>
                )}
                {myAshrams.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleOpenAddModal("bed")}
            className="px-4 py-2.5 bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus size={15} /> Add Service
          </button>
        </div>
      </div>

      {/* Quick Add Presets Bar */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={13} /> Quick Add Categories:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_TEMPLATES.map((preset) => {
              const IconComp = preset.icon;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleOpenAddModal(preset.key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 hover:border-[#F28C28] text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:-translate-y-0.5"
                >
                  <IconComp size={13} className="text-[#F28C28]" />
                  <span>{preset.label}</span>
                  <span className="text-[10px] font-extrabold text-[#F28C28] bg-[#FFF4E5]/60 px-1.5 py-0.2 rounded">
                    ₹{preset.defaultPrice}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Services Grid */}
      {loadingAshrams || loading ? (
        <div className="h-64 bg-gray-50 dark:bg-slate-900 rounded-3xl animate-pulse" />
      ) : addOns.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-12 text-center space-y-3 shadow-sm">
          <Sparkles
            size={40}
            className="mx-auto text-gray-300 dark:text-slate-600"
          />
          <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white">
            No Add-On Services Configured
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Click "Add Service" or select a quick template above to offer Add-on Beds, Satvik Meals, Prasad Boxes, or Parking to your guests.
          </p>
          <button
            type="button"
            onClick={() => handleOpenAddModal("bed")}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#F28C28] text-white text-xs font-bold rounded-xl shadow cursor-pointer hover:bg-[#B45309]"
          >
            <BedDouble size={14} /> Add First Extra Bed / Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {addOns.map((item) => {
            const isBed = isBedItem(item);
            return (
              <div
                key={item._id}
                className={`bg-white dark:bg-[#0B192C] border rounded-[24px] p-5 shadow-sm space-y-4 transition-all relative ${
                  isBed
                    ? "border-blue-200 dark:border-blue-900/50 ring-1 ring-blue-100 dark:ring-blue-950"
                    : item.enabled
                      ? "border-gray-100 dark:border-slate-800"
                      : "border-gray-200 dark:border-slate-800 opacity-60"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#FFF4E5]/60 flex items-center justify-center shrink-0">
                      {getItemIcon(item)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-tight">
                          {item.name}
                        </h3>
                        {isBed && (
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            Bed Category
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-extrabold text-[#F28C28] bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md mt-1 inline-block">
                        {formatCurrency(item.price)} / {item.unitLabel || "Unit"}
                      </span>
                      {isAllSelected && item.ashramName && (
                        <span className="mt-1 flex items-center gap-1 text-[9px] font-bold text-gray-400">
                          <Building2 size={10} /> {item.ashramName}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleEnable(item)}
                    title={item.enabled ? "Click to Disable" : "Click to Enable"}
                    className="text-gray-400 hover:text-[#F28C28] transition-colors cursor-pointer"
                  >
                    {item.enabled ? (
                      <ToggleRight size={26} className="text-emerald-500" />
                    ) : (
                      <ToggleLeft
                        size={26}
                        className="text-gray-300 dark:text-slate-600"
                      />
                    )}
                  </button>
                </div>

                {item.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                )}

                <div className="pt-3 border-t border-gray-50 dark:border-slate-850 flex justify-between items-center text-[10px] text-gray-400 font-bold">
                  <span>Max Limit: {item.maxQuantity} per booking</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-600 dark:text-gray-300 transition-all cursor-pointer"
                      title="Edit Service & Rate"
                    >
                      <Edit3 size={14} />
                    </button>
                    {item._id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteService(item)}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-rose-500 transition-all cursor-pointer"
                        title="Delete Service"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Service Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 text-left my-auto relative z-[101]">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-[#F28C28]" />
                  {editingItem ? "Edit Add-On Service" : "Add Service / Extra Bed"}
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                  Set custom nightly or per-unit pricing for this stay.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Template Selector inside Modal */}
            {!editingItem && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                  Preset Category Template
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => handleApplyPreset(tpl)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
                        formData.category === tpl.key
                          ? "bg-[#F28C28] text-white border-[#F28C28]"
                          : "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-[#F28C28]"
                      }`}
                    >
                      <tpl.icon size={12} />
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handleSaveService}
              className="space-y-4 text-xs font-semibold"
            >
              {/* Target Ashram Selector */}
              <div className="space-y-1">
                <label
                  htmlFor="addon-ashram"
                  className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider"
                >
                  Stay / Ashram *
                </label>
                <select
                  id="addon-ashram"
                  value={formAshramId}
                  onChange={(e) => setFormAshramId(e.target.value)}
                  disabled={!!editingItem}
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {myAshrams.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Add-on Bed"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Category Type *
                  </label>
                  <select
                    value={formData.category || "general"}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        category: e.target.value,
                      }))
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none cursor-pointer dark:text-white"
                  >
                    <option value="bed">Add-on Bed / Mattress</option>
                    <option value="meals">Satvik Meals</option>
                    <option value="prasad">Sacred Prasad</option>
                    <option value="parking">Parking Slot</option>
                    <option value="locker">Locker & Storage</option>
                    <option value="general">General Add-on Service</option>
                  </select>
                </div>
              </div>

              {/* Price & Pricing Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Price (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      required
                      value={formData.price}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          price: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full pl-8 pr-3.5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Pricing Unit *
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => {
                      const u = e.target.value as any;
                      const labels: Record<string, string> = {
                        per_day: "Day",
                        per_bed: "Bed / Day",
                        per_night: "Night",
                        per_meal: "Meal",
                        per_person: "Person",
                        per_box: "Box",
                        one_time: "One Time",
                      };
                      setFormData((p) => ({
                        ...p,
                        unit: u,
                        unitLabel: labels[u] || "Unit",
                      }));
                    }}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none cursor-pointer dark:text-white"
                  >
                    <option value="per_day">Per Day (/ Day)</option>
                    <option value="per_bed">Per Bed (/ Bed / Day)</option>
                    <option value="per_night">Per Night (/ Night)</option>
                    <option value="per_meal">Per Meal (/ Meal)</option>
                    <option value="per_person">Per Person (/ Person)</option>
                    <option value="per_box">Per Box (/ Box)</option>
                    <option value="one_time">One Time (/ Stay)</option>
                  </select>
                </div>
              </div>

              {/* Unit Label & Max Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Display Unit Label
                  </label>
                  <input
                    type="text"
                    value={formData.unitLabel}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, unitLabel: e.target.value }))
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Max Qty Per Booking
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formData.maxQuantity}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        maxQuantity: parseInt(e.target.value, 10) || 1,
                      }))
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none dark:text-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Short service description for pilgrims..."
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, description: e.target.value }))
                  }
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none dark:text-white"
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-bold rounded-xl transition-all shadow cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Service"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerAddOnsPage;
