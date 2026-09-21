import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bed,
  Building2,
  Check,
  CheckCircle2,
  Edit3,
  Filter,
  Layers,
  Loader2,
  Percent,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { rateService } from "../../services";
import { formatCurrency } from "../../utils/format";
import { getErrorMessage } from "../../lib/api";
import { useNotifications } from "../../contexts/NotificationContext";
import { useAshramSelection, ALL_ASHRAMS } from "../../hooks/useAshramSelection";
import { EnterprisePageHeader } from "../../admin/shared/components/EnterprisePageHeader";

export interface RateItem {
  roomId: string;
  roomName: string;
  roomType: string;
  acType: string;
  capacity: number;
  totalInventory: number;
  mrp: number;
  discountPercent: number;
  discountAmount: number;
  sellingPrice: number;
  isDiscountActive: boolean;
  status: string;
  updatedAt?: string;
  updatedBy?: string;
  notes?: string;
  ashramId?: string;
  ashramName?: string;
}

const QUICK_DISCOUNTS = [5, 10, 15, 20, 25];

export const RateManagementPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const [rates, setRates] = useState<RateItem[]>([]);
  const [loadingRates, setLoadingRates] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Modal State
  const [editingRate, setEditingRate] = useState<RateItem | null>(null);
  const [editMrp, setEditMrp] = useState<string>("");
  const [editDiscountPercent, setEditDiscountPercent] = useState<string>("");
  const [editIsDiscountActive, setEditIsDiscountActive] = useState<boolean>(true);
  const [editNotes, setEditNotes] = useState<string>("");
  const [savingRate, setSavingRate] = useState(false);

  // Bulk Edit State
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState<string>("10");
  const [bulkIsDiscountActive, setBulkIsDiscountActive] = useState<boolean>(true);
  const [savingBulk, setSavingBulk] = useState(false);

  // Toggling specific room
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const addNotificationRef = useRef(addNotification);
  addNotificationRef.current = addNotification;
  const isFetchingRef = useRef(false);

  const handleLoadError = useCallback((err: unknown) => {
    addNotificationRef.current(
      "Load Failed",
      getErrorMessage(err, "Unable to load stays."),
      "error",
    );
  }, []);

  const {
    ashrams: myAshrams,
    selectedAshramId,
    setSelectedAshramId,
    loadingAshrams,
    targetAshrams,
  } = useAshramSelection({
    storageKey: "tirvona:rate-management-ashram",
    allowAll: true,
    onError: handleLoadError,
  });

  const fetchRates = useCallback(async () => {
    if (!targetAshrams.length) {
      setRates([]);
      setLoadingRates(false);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoadingRates(true);
    try {
      const results = await Promise.allSettled(
        targetAshrams.map(async (stay: any) => {
          const res = await rateService.getByStay(stay._id);
          const rawRates = res.data?.data?.rates || [];
          return rawRates.map((r: any) => ({
            ...r,
            ashramId: stay._id,
            ashramName: stay.name,
          }));
        }),
      );

      const allFetched: RateItem[] = [];
      results.forEach((res) => {
        if (res.status === "fulfilled") {
          allFetched.push(...res.value);
        }
      });
      setRates(allFetched);
    } catch (error) {
      addNotificationRef.current(
        "Rates Unavailable",
        getErrorMessage(error, "Could not load room rates."),
        "error",
      );
      setRates([]);
    } finally {
      isFetchingRef.current = false;
      setLoadingRates(false);
      setRefreshing(false);
    }
  }, [targetAshrams]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Live calculation for edit modal
  const livePreview = useMemo(() => {
    const mrp = Math.max(0, Number(editMrp) || 0);
    const discountPercent = Math.min(
      90,
      Math.max(0, Number(editDiscountPercent) || 0),
    );
    const active = editIsDiscountActive && discountPercent > 0;
    const discountAmount = active
      ? Math.round(((mrp * discountPercent) / 100) * 100) / 100
      : 0;
    const sellingPrice = Math.max(0, Math.round((mrp - discountAmount) * 100) / 100);
    return { mrp, discountPercent, discountAmount, sellingPrice };
  }, [editMrp, editDiscountPercent, editIsDiscountActive]);

  // Filtered rows
  const filteredRates = useMemo(() => {
    return rates.filter((r) => {
      if (typeFilter !== "all" && r.roomType !== typeFilter) return false;
      if (statusFilter === "discounted" && (!r.isDiscountActive || r.discountPercent <= 0))
        return false;
      if (statusFilter === "mrp" && r.isDiscountActive && r.discountPercent > 0)
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.roomName.toLowerCase().includes(q);
        const matchStay = (r.ashramName || "").toLowerCase().includes(q);
        if (!matchName && !matchStay) return false;
      }
      return true;
    });
  }, [rates, typeFilter, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = rates.length;
    const discounted = rates.filter((r) => r.isDiscountActive && r.discountPercent > 0).length;
    const fullMrp = total - discounted;
    const avgDiscount =
      discounted > 0
        ? Math.round(
            rates
              .filter((r) => r.isDiscountActive && r.discountPercent > 0)
              .reduce((sum, r) => sum + r.discountPercent, 0) / discounted,
          )
        : 0;
    return { total, discounted, fullMrp, avgDiscount };
  }, [rates]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRoomIds(new Set(filteredRates.map((r) => r.roomId)));
    } else {
      setSelectedRoomIds(new Set());
    }
  };

  const handleToggleSelectRoom = (roomId: string) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  // Open edit modal
  const openEditModal = (rate: RateItem) => {
    setEditingRate(rate);
    setEditMrp(String(rate.mrp || 0));
    setEditDiscountPercent(String(rate.discountPercent || 0));
    setEditIsDiscountActive(rate.isDiscountActive);
    setEditNotes(rate.notes || "");
  };

  // Save single rate
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRate || !editingRate.ashramId) return;

    const mrp = Number(editMrp);
    const discount = Number(editDiscountPercent);

    if (isNaN(mrp) || mrp < 0) {
      addNotification("Invalid Price", "MRP cannot be negative.", "error");
      return;
    }
    if (isNaN(discount) || discount < 0 || discount > 90) {
      addNotification(
        "Invalid Discount",
        "Discount must be between 0% and 90%.",
        "error",
      );
      return;
    }

    setSavingRate(true);
    try {
      const res = await rateService.upsert({
        ashramId: editingRate.ashramId,
        roomId: editingRate.roomId,
        mrp,
        discountPercent: discount,
        isDiscountActive: editIsDiscountActive,
        notes: editNotes.trim(),
      });

      if (res.data?.success) {
        addNotification(
          "Rate Updated",
          `Selling price for ${editingRate.roomName} is now ${formatCurrency(res.data.data.sellingPrice)}.`,
          "success",
        );
        setEditingRate(null);
        await fetchRates();
      }
    } catch (error) {
      addNotification(
        "Save Failed",
        getErrorMessage(error, "Could not update room rate."),
        "error",
      );
    } finally {
      setSavingRate(false);
    }
  };

  // Toggle discount enable/disable
  const handleToggleDiscount = async (rate: RateItem) => {
    setTogglingId(rate.roomId);
    try {
      const nextActive = !rate.isDiscountActive;
      const res = await rateService.toggleDiscount(rate.roomId, nextActive);
      if (res.data?.success) {
        addNotification(
          nextActive ? "Discount Enabled" : "Discount Disabled",
          `${rate.roomName} rate discount is now ${nextActive ? "active" : "disabled"}.`,
          "success",
        );
        setRates((prev) =>
          prev.map((r) =>
            r.roomId === rate.roomId
              ? {
                  ...r,
                  isDiscountActive: nextActive,
                  sellingPrice: nextActive
                    ? Math.max(0, r.mrp - r.discountAmount)
                    : r.mrp,
                }
              : r,
          ),
        );
      }
    } catch (error) {
      addNotification(
        "Action Failed",
        getErrorMessage(error, "Could not toggle discount status."),
        "error",
      );
    } finally {
      setTogglingId(null);
    }
  };

  // Bulk update
  const handleSaveBulk = async () => {
    if (!selectedRoomIds.size) return;
    const discount = Number(bulkDiscountPercent);
    if (isNaN(discount) || discount < 0 || discount > 90) {
      addNotification(
        "Invalid Discount",
        "Discount must be between 0% and 90%.",
        "error",
      );
      return;
    }

    // If "all" stays is selected, group by stay
    const selectedRooms = rates.filter((r) => selectedRoomIds.has(r.roomId));
    const roomsByStay = new Map<string, string[]>();
    for (const room of selectedRooms) {
      if (!room.ashramId) continue;
      const existing = roomsByStay.get(room.ashramId) || [];
      existing.push(room.roomId);
      roomsByStay.set(room.ashramId, existing);
    }

    setSavingBulk(true);
    try {
      for (const [ashramId, roomIds] of roomsByStay.entries()) {
        await rateService.bulkUpdate({
          ashramId,
          roomIds,
          discountPercent: discount,
          isDiscountActive: bulkIsDiscountActive,
        });
      }
      addNotification(
        "Bulk Update Successful",
        `Updated discount to ${discount}% across ${selectedRooms.length} room category(ies).`,
        "success",
      );
      setShowBulkModal(false);
      setSelectedRoomIds(new Set());
      await fetchRates();
    } catch (error) {
      addNotification(
        "Bulk Update Failed",
        getErrorMessage(error, "Could not apply bulk rates."),
        "error",
      );
    } finally {
      setSavingBulk(false);
    }
  };

  const card =
    "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px]";
  const field =
    "w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28] transition-all cursor-pointer";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans text-left">
      {/* Enterprise Header */}
      <EnterprisePageHeader
        title="Rate & Discount Management"
        subtitle="Set base prices (MRP), configure discounts, and manage live selling prices."
        icon={<Tag size={22} />}
        badgeText={stats.discounted > 0 ? `${stats.discounted} on discount` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedRoomIds.size > 0 && (
              <button
                onClick={() => setShowBulkModal(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <SlidersHorizontal size={14} />
                Bulk Set Discount ({selectedRoomIds.size})
              </button>
            )}

            <button
              onClick={() => {
                setRefreshing(true);
                fetchRates();
              }}
              disabled={refreshing || loadingRates}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-[#0B192C] dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
              title="Refresh rates"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        }
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`${card} p-4 sm:p-5 flex flex-col justify-between`}>
          <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">
            Room Categories
          </p>
          <p className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white mt-1 font-sans">
            {stats.total}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold mt-0.5">
            Across selected stay(s)
          </p>
        </div>

        <div className={`${card} p-4 sm:p-5 flex flex-col justify-between border-emerald-100 dark:border-emerald-950/40`}>
          <p className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 tracking-wider">
            Active Discounts
          </p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-sans">
            {stats.discounted}
          </p>
          <p className="text-[10px] sm:text-[11px] text-emerald-600/70 dark:text-emerald-400/70 font-semibold mt-0.5">
            Categories selling below MRP
          </p>
        </div>

        <div className={`${card} p-4 sm:p-5 flex flex-col justify-between`}>
          <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">
            Full MRP Rates
          </p>
          <p className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white mt-1 font-sans">
            {stats.fullMrp}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold mt-0.5">
            0% discount or disabled
          </p>
        </div>

        <div className={`${card} p-4 sm:p-5 flex flex-col justify-between border-blue-100 dark:border-blue-950/40`}>
          <p className="text-[10px] uppercase font-black text-[#F28C28] dark:text-amber-400 tracking-wider">
            Avg. Active Discount
          </p>
          <p className="text-2xl sm:text-3xl font-black text-[#F28C28] dark:text-amber-400 mt-1 font-sans">
            {stats.avgDiscount}%
          </p>
          <p className="text-[10px] sm:text-[11px] text-[#F28C28]/70 dark:text-amber-400/70 font-semibold mt-0.5">
            Customer savings incentive
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Stay Selector */}
          <div>
            <label className="text-[10px] uppercase font-black text-gray-400 tracking-wider block mb-1.5">
              Stay Property
            </label>
            <select
              value={selectedAshramId}
              onChange={(e) => setSelectedAshramId(e.target.value)}
              disabled={loadingAshrams}
              className={field}
            >
              {myAshrams.length > 1 && (
                <option value={ALL_ASHRAMS}>All Stays ({myAshrams.length})</option>
              )}
              {myAshrams.map((a: any) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Room Type */}
          <div>
            <label className="text-[10px] uppercase font-black text-gray-400 tracking-wider block mb-1.5">
              Category Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={field}
            >
              <option value="all">All Room Types</option>
              <option value="private_room">Private Room</option>
              <option value="family_room">Family Room</option>
              <option value="dormitory">Dormitory</option>
              <option value="hall">Hall</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] uppercase font-black text-gray-400 tracking-wider block mb-1.5">
              Discount Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={field}
            >
              <option value="all">All Statuses</option>
              <option value="discounted">Discount Active</option>
              <option value="mrp">Full MRP Only</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="text-[10px] uppercase font-black text-gray-400 tracking-wider block mb-1.5">
              Search Room
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search category name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${field} pl-9`}
              />
              <Search size={14} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Rates Container */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
              Room-wise Rate Inventory
            </h3>
            <p className="text-[11px] text-gray-400 font-semibold">
              Configure MRP base rates, promotional discounts, and live selling prices
            </p>
          </div>
          {selectedRoomIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                {selectedRoomIds.size} selected
              </span>
              <button
                onClick={() => setShowBulkModal(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer"
              >
                Bulk Discount
              </button>
            </div>
          )}
        </div>
        {loadingRates ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#F28C28] animate-spin" />
            <p className="text-xs text-gray-400 font-medium">
              Loading authoritative stay rates...
            </p>
          </div>
        ) : filteredRates.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <Bed className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-bold text-[#0B192C] dark:text-white">
              No room categories found
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Try adjusting your stay selection or search filter.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (visible on md screens and up) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead className="bg-gray-50 dark:bg-slate-900/60 text-[10px] uppercase font-black text-gray-400 tracking-wider">
                  <tr className="border-b border-gray-100 dark:border-slate-800">
                    <th className="py-3 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredRates.length > 0 &&
                          selectedRoomIds.size === filteredRates.length
                        }
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-[#F28C28] focus:ring-[#F28C28] cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Stay & Category</th>
                    <th className="py-3 px-4 text-right">MRP (Base)</th>
                    <th className="py-3 px-4 text-center">Discount</th>
                    <th className="py-3 px-4 text-right">You Save</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                  {filteredRates.map((rate) => {
                    const isDiscounted =
                      rate.isDiscountActive && rate.discountPercent > 0;
                    const isSelected = selectedRoomIds.has(rate.roomId);

                    return (
                      <tr
                        key={rate.roomId}
                        className={`hover:bg-gray-50/60 dark:hover:bg-slate-800/30 transition-colors ${
                          isSelected ? "bg-[#F28C28]/5 dark:bg-[#F28C28]/10" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRoom(rate.roomId)}
                            className="rounded border-gray-300 text-[#F28C28] focus:ring-[#F28C28] cursor-pointer"
                          />
                        </td>

                        <td className="py-3.5 px-4 min-w-[220px]">
                          <div className="font-extrabold text-xs sm:text-sm text-[#0B192C] dark:text-white flex items-center gap-2">
                            {rate.roomName}
                            {isDiscounted && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                                {rate.discountPercent}% OFF
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 font-semibold mt-0.5 flex items-center gap-1.5">
                            <span className="capitalize">{rate.roomType.replace("_", " ")}</span>
                            <span>•</span>
                            <span>{rate.acType}</span>
                            <span>•</span>
                            <span>Capacity: {rate.capacity} Guests</span>
                          </div>
                          {rate.ashramName && (
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5 font-medium">
                              <Building2 size={11} />
                              {rate.ashramName}
                            </div>
                          )}
                        </td>

                        {/* MRP */}
                        <td className="py-3.5 px-4 text-right font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-sans">
                          {isDiscounted ? (
                            <span className="line-through text-gray-400 dark:text-gray-500 font-normal">
                              {formatCurrency(rate.mrp)}
                            </span>
                          ) : (
                            formatCurrency(rate.mrp)
                          )}
                        </td>

                        {/* Discount % */}
                        <td className="py-3.5 px-4 text-center">
                          {isDiscounted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50">
                              <Percent size={10} />
                              {rate.discountPercent}%
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs font-semibold">0%</span>
                          )}
                        </td>

                        {/* You Save */}
                        <td className="py-3.5 px-4 text-right font-bold text-xs font-sans">
                          {isDiscounted ? (
                            <span className="text-rose-600 dark:text-rose-400">
                              - {formatCurrency(rate.discountAmount)}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>
                          )}
                        </td>

                        {/* Selling Price */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-black text-sm sm:text-base text-emerald-600 dark:text-emerald-400 font-sans">
                            {formatCurrency(rate.sellingPrice)}
                          </span>
                          <span className="text-[10px] text-gray-400 font-semibold block">
                            / night
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleDiscount(rate)}
                            disabled={togglingId === rate.roomId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title={
                              rate.isDiscountActive
                                ? "Click to pause discount (charges full MRP)"
                                : "Click to activate discount"
                            }
                          >
                            {togglingId === rate.roomId ? (
                              <Loader2 size={16} className="animate-spin text-gray-400" />
                            ) : rate.isDiscountActive ? (
                              <ToggleRight size={22} className="text-emerald-500" />
                            ) : (
                              <ToggleLeft size={22} className="text-gray-300 dark:text-slate-600" />
                            )}
                            <span
                              className={`text-[11px] font-black uppercase ${
                                rate.isDiscountActive
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-gray-400 dark:text-gray-500"
                              }`}
                            >
                              {rate.isDiscountActive ? "Active" : "Disabled"}
                            </span>
                          </button>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openEditModal(rate)}
                            className="px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-[#F28C28] hover:bg-[#F28C28] hover:text-white text-xs font-extrabold text-[#0B192C] dark:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Edit3 size={13} />
                            Edit Rate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (visible only on < md screens) */}
            <div className="block md:hidden divide-y divide-gray-100 dark:divide-slate-800">
              <div className="p-3.5 bg-gray-50 dark:bg-slate-900/60 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      filteredRates.length > 0 &&
                      selectedRoomIds.size === filteredRates.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-[#F28C28] focus:ring-[#F28C28]"
                  />
                  <span className="font-extrabold text-xs">Select All ({filteredRates.length})</span>
                </label>
                {selectedRoomIds.size > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">
                    {selectedRoomIds.size} Selected
                  </span>
                )}
              </div>

              {filteredRates.map((rate) => {
                const isDiscounted =
                  rate.isDiscountActive && rate.discountPercent > 0;
                const isSelected = selectedRoomIds.has(rate.roomId);

                return (
                  <div
                    key={rate.roomId}
                    className={`p-4 space-y-3 transition-colors ${
                      isSelected ? "bg-[#F28C28]/5 dark:bg-[#F28C28]/10" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRoom(rate.roomId)}
                          className="mt-1 rounded border-gray-300 text-[#F28C28] focus:ring-[#F28C28] cursor-pointer"
                        />
                        <div>
                          <h4 className="text-sm font-extrabold text-[#0B192C] dark:text-white">
                            {rate.roomName}
                          </h4>
                          <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
                            {rate.roomType.replace("_", " ")} • {rate.acType} • Capacity: {rate.capacity}
                          </p>
                          {rate.ashramName && (
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 font-medium">
                              <Building2 size={10} />
                              {rate.ashramName}
                            </p>
                          )}
                        </div>
                      </div>

                      {isDiscounted ? (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                          {rate.discountPercent}% OFF
                        </span>
                      ) : (
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-500">
                          Full MRP
                        </span>
                      )}
                    </div>

                    {/* Price summary block */}
                    <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block">
                          Base MRP
                        </span>
                        <span className={`text-xs font-bold font-sans ${isDiscounted ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-200"}`}>
                          {formatCurrency(rate.mrp)}
                        </span>
                        {isDiscounted && (
                          <span className="text-[10px] font-bold text-rose-500 block font-sans">
                            Save {formatCurrency(rate.discountAmount)}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block">
                          Selling Price
                        </span>
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-sans">
                          {formatCurrency(rate.sellingPrice)}
                          <span className="text-[10px] font-semibold text-gray-400"> /night</span>
                        </span>
                      </div>
                    </div>

                    {/* Action & Toggle row */}
                    <div className="flex items-center justify-between pt-1 gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleDiscount(rate)}
                        disabled={togglingId === rate.roomId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-extrabold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        {togglingId === rate.roomId ? (
                          <Loader2 size={14} className="animate-spin text-gray-400" />
                        ) : rate.isDiscountActive ? (
                          <ToggleRight size={20} className="text-emerald-500" />
                        ) : (
                          <ToggleLeft size={20} className="text-gray-300 dark:text-slate-600" />
                        )}
                        <span className={rate.isDiscountActive ? "text-emerald-600 font-black text-[11px] uppercase" : "text-gray-400 font-black text-[11px] uppercase"}>
                          {rate.isDiscountActive ? "Active" : "Disabled"}
                        </span>
                      </button>

                      <button
                        onClick={() => openEditModal(rate)}
                        className="px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-[#F28C28] hover:bg-[#F28C28] hover:text-white text-xs font-extrabold text-[#0B192C] dark:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Edit3 size={13} />
                        Edit Rate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Edit Single Rate Modal */}
      {editingRate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0B192C] w-full max-w-lg rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-2xl p-6 relative overflow-hidden"
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-[#0B192C] dark:text-white">
                  Configure Room Rate
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {editingRate.ashramName} • {editingRate.roomName}
                </p>
              </div>
              <button
                onClick={() => setEditingRate(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRate} className="space-y-4 pt-4">
              {/* MRP Input */}
              <div>
                <label className="text-xs font-extrabold text-[#0B192C] dark:text-white block mb-1">
                  Base Room Price / MRP (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={editMrp}
                  onChange={(e) => setEditMrp(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-black text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28]"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Original base price before any promotional discount.
                </span>
              </div>

              {/* Discount Percentage */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                    Discount Percentage (%)
                  </label>
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                    {editDiscountPercent || 0}% OFF
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="90"
                    step="1"
                    value={editDiscountPercent || 0}
                    onChange={(e) => setEditDiscountPercent(e.target.value)}
                    className="flex-1 accent-[#F28C28]"
                  />
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={editDiscountPercent}
                    onChange={(e) => setEditDiscountPercent(e.target.value)}
                    className="w-16 px-2.5 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-black text-center text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28]"
                  />
                </div>

                {/* Quick Chips */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Quick:
                  </span>
                  {QUICK_DISCOUNTS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setEditDiscountPercent(String(pct))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                        Number(editDiscountPercent) === pct
                          ? "bg-[#F28C28] text-white"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditDiscountPercent("0")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                      Number(editDiscountPercent) === 0
                        ? "bg-slate-700 text-white"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    0% (MRP)
                  </button>
                </div>
              </div>

              {/* Discount Enable Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold text-[#0B192C] dark:text-white block">
                    Enable Discount
                  </span>
                  <span className="text-[10px] text-gray-400">
                    When disabled, customer pays the full MRP without discount.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsDiscountActive(!editIsDiscountActive)}
                  className="focus:outline-none"
                >
                  {editIsDiscountActive ? (
                    <ToggleRight size={26} className="text-emerald-500" />
                  ) : (
                    <ToggleLeft size={26} className="text-gray-300 dark:text-slate-600" />
                  )}
                </button>
              </div>

              {/* Live Instant Preview Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/50 to-blue-50/30 dark:from-emerald-950/20 dark:to-blue-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400 font-bold">
                    Room MRP (Base Price):
                  </span>
                  <span className="font-extrabold text-gray-700 dark:text-gray-300">
                    {formatCurrency(livePreview.mrp)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400 font-bold">
                    Promotional Discount:
                  </span>
                  <span className="font-black text-rose-600 dark:text-rose-400">
                    {livePreview.discountPercent}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    You Save (Customer Savings):
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    - {formatCurrency(livePreview.discountAmount)}
                  </span>
                </div>

                <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-800/30 flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-[#0B192C] dark:text-white tracking-wider">
                    Customer Pays (Selling Price):
                  </span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(livePreview.sellingPrice)}
                    <span className="text-[10px] text-gray-400 font-normal"> / night</span>
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block mb-1">
                  Rate Notes (Internal / Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festival promotional rate, Weekend offer"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28]"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRate(null)}
                  disabled={savingRate}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRate}
                  className="px-5 py-2.5 rounded-xl bg-[#F28C28] hover:bg-[#B45309] text-white text-xs font-black flex items-center gap-2 shadow-sm transition-all"
                >
                  {savingRate ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Saving Rate...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Save Rate
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Rate Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0B192C] w-full max-w-lg rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-2xl p-6 relative overflow-hidden"
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-[#0B192C] dark:text-white flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-amber-500" />
                  Bulk Discount Management
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Apply uniform discount across {selectedRoomIds.size} selected category(ies).
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-extrabold text-[#0B192C] dark:text-white block mb-1">
                  Discount Percentage (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="90"
                    step="1"
                    value={bulkDiscountPercent}
                    onChange={(e) => setBulkDiscountPercent(e.target.value)}
                    className="flex-1 accent-amber-500"
                  />
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={bulkDiscountPercent}
                    onChange={(e) => setBulkDiscountPercent(e.target.value)}
                    className="w-16 px-2.5 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-black text-center text-[#0B192C] dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {QUICK_DISCOUNTS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setBulkDiscountPercent(String(pct))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                        Number(bulkDiscountPercent) === pct
                          ? "bg-amber-500 text-white"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBulkDiscountPercent("0")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-gray-100 dark:bg-slate-800 text-gray-500"
                  >
                    0% (MRP)
                  </button>
                </div>
              </div>

              {/* Affected Categories Preview */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                  Preview Affected Categories:
                </span>
                {rates
                  .filter((r) => selectedRoomIds.has(r.roomId))
                  .map((r) => {
                    const discount = Number(bulkDiscountPercent) || 0;
                    const saved = Math.round(((r.mrp * discount) / 100) * 100) / 100;
                    const newSellingPrice = Math.max(0, r.mrp - saved);

                    return (
                      <div
                        key={r.roomId}
                        className="flex items-center justify-between text-xs py-1 border-b border-gray-100/50 dark:border-slate-800/50 last:border-none"
                      >
                        <span className="font-bold text-[#0B192C] dark:text-white truncate max-w-[200px]">
                          {r.roomName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 line-through text-[11px]">
                            {formatCurrency(r.mrp)}
                          </span>
                          <ArrowRight size={10} className="text-gray-400" />
                          <span className="font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(newSellingPrice)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  disabled={savingBulk}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBulk}
                  disabled={savingBulk}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black flex items-center gap-2 shadow-sm transition-all"
                >
                  {savingBulk ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Applying Rates...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Apply to {selectedRoomIds.size} Categories
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RateManagementPage;
