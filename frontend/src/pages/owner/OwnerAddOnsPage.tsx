import React, { useState, useEffect } from "react";
import { ashramService } from "../../services";
import { useNotifications } from "../../contexts/NotificationContext";
import {
  Sparkles,
  Plus,
  Edit3,
  Trash2,
  X,
  Info,
  Tag,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface AddOnServiceItem {
  _id?: string;
  name: string;
  price: number;
  unit: "per_day" | "per_meal" | "per_person" | "one_time" | "per_box";
  unitLabel: string;
  maxQuantity: number;
  enabled: boolean;
  iconUrl?: string;
  description?: string;
}

export const OwnerAddOnsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [myAshrams, setMyAshrams] = useState<any[]>([]);
  const [selectedAshramId, setSelectedAshramId] = useState<string>("");
  const [addOns, setAddOns] = useState<AddOnServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AddOnServiceItem | null>(null);
  const [formData, setFormData] = useState<AddOnServiceItem>({
    name: "",
    price: 50,
    unit: "per_day",
    unitLabel: "Day",
    maxQuantity: 10,
    enabled: true,
    description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAshrams();
  }, []);

  useEffect(() => {
    if (selectedAshramId) {
      fetchAddOns(selectedAshramId);
    }
  }, [selectedAshramId]);

  const fetchAshrams = async () => {
    setLoading(true);
    try {
      const res = await ashramService.myListings();
      if (
        res.data?.success &&
        Array.isArray(res.data.data) &&
        res.data.data.length > 0
      ) {
        setMyAshrams(res.data.data);
        setSelectedAshramId(res.data.data[0]._id);
      }
    } catch (err) {
      console.error("Fetch ashrams error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAddOns = async (ashramId: string) => {
    setLoading(true);
    try {
      const res = await ashramService.getAddOns(ashramId);
      if (res.data?.success) {
        setAddOns(res.data.data);
      }
    } catch (err) {
      console.error("Fetch add-ons error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      price: 50,
      unit: "per_day",
      unitLabel: "Day",
      maxQuantity: 10,
      enabled: true,
      description: "",
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: AddOnServiceItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAshramId) return;
    if (!formData.name.trim() || formData.price < 0) {
      addNotification("Please enter a valid service name and price.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingItem?._id) {
        const res = await ashramService.updateAddOn(
          selectedAshramId,
          editingItem._id,
          formData,
        );
        if (res.data?.success) {
          setAddOns(res.data.data);
          addNotification("Add-On service updated successfully.", "success");
        }
      } else {
        const res = await ashramService.createAddOn(selectedAshramId, formData);
        if (res.data?.success) {
          setAddOns(res.data.data);
          addNotification("Add-On service created successfully.", "success");
        }
      }
      setModalOpen(false);
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
    if (!selectedAshramId || !item._id) return;
    try {
      const updated = { ...item, enabled: !item.enabled };
      const res = await ashramService.updateAddOn(selectedAshramId, item._id, {
        enabled: !item.enabled,
      });
      if (res.data?.success) {
        setAddOns(res.data.data);
        addNotification(
          `Service ${!item.enabled ? "enabled" : "disabled"}`,
          "info",
        );
      }
    } catch (err) {
      console.error("Toggle enable error:", err);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!selectedAshramId || !serviceId) return;
    if (!window.confirm("Are you sure you want to delete this add-on service?"))
      return;

    try {
      const res = await ashramService.deleteAddOn(selectedAshramId, serviceId);
      if (res.data?.success) {
        setAddOns(res.data.data);
        addNotification("Add-On service deleted.", "success");
      }
    } catch (err: any) {
      console.error("Delete add-on error:", err);
      addNotification(
        err.response?.data?.message || "Error deleting add-on service.",
        "error",
      );
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0B192C] p-6 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-[#0B192C] dark:text-white">
            Add-On Services Management
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-semibold">
            Manage custom services, pricing units, and daily limits for your
            ashram guests.
          </p>
        </div>

        {/* Ashram Dropdown & Add Button */}
        <div className="flex items-center gap-3">
          {myAshrams.length > 0 && (
            <div className="relative">
              <select
                value={selectedAshramId}
                onChange={(e) => setSelectedAshramId(e.target.value)}
                className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none cursor-pointer"
              >
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
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus size={15} /> Add Service
          </button>
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
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
            Click "Add Service" to offer Prasad, Meals, Parking, or VIP passes
            to your pilgrims.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {addOns.map((item) => (
            <div
              key={item._id}
              className={`bg-white dark:bg-[#0B192C] border rounded-[24px] p-5 shadow-sm space-y-4 transition-all relative ${
                item.enabled
                  ? "border-gray-100 dark:border-slate-800"
                  : "border-gray-200 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-tight">
                    {item.name}
                  </h3>
                  <span className="text-[10px] font-extrabold text-[#0A4DA6] bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md mt-1 inline-block">
                    ₹{item.price} / {item.unitLabel || "Unit"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleEnable(item)}
                  title={item.enabled ? "Click to Disable" : "Click to Enable"}
                  className="text-gray-400 hover:text-[#0A4DA6] transition-colors cursor-pointer"
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
                <span>Max Qty: {item.maxQuantity}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(item)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-600 dark:text-gray-300 transition-all cursor-pointer"
                  >
                    <Edit3 size={14} />
                  </button>
                  {item._id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteService(item._id!)}
                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-rose-500 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] max-w-md w-full p-6 shadow-2xl space-y-5 text-left">
            <div className="flex justify-between items-center border-b border-gray-50 dark:border-slate-850 pb-3">
              <h3 className="font-black text-sm text-[#0B192C] dark:text-white">
                {editingItem ? "Edit Add-On Service" : "New Add-On Service"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSaveService}
              className="space-y-4 text-xs font-semibold"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-gray-400">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sacred Prasad Box"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-gray-400">
                    Price (₹) *
                  </label>
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
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-gray-400">
                    Pricing Unit *
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => {
                      const u = e.target.value as any;
                      const labels: Record<string, string> = {
                        per_day: "Day",
                        per_meal: "Meal",
                        per_person: "Person",
                        one_time: "One Time",
                        per_box: "Box",
                      };
                      setFormData((p) => ({
                        ...p,
                        unit: u,
                        unitLabel: labels[u] || "Unit",
                      }));
                    }}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="per_day">Per Day (/ Day)</option>
                    <option value="per_meal">Per Meal (/ Meal)</option>
                    <option value="per_person">Per Person (/ Person)</option>
                    <option value="per_box">Per Box (/ Box)</option>
                    <option value="one_time">One Time (/ Stay)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-gray-400">
                    Unit Label
                  </label>
                  <input
                    type="text"
                    value={formData.unitLabel}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, unitLabel: e.target.value }))
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-gray-400">
                    Max Quantity
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
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-gray-400">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Short service description for pilgrims..."
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, description: e.target.value }))
                  }
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-bold rounded-xl transition-all shadow cursor-pointer"
                >
                  {saving ? "Saving…" : "Save Service"}
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
