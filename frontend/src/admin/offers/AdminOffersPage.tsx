import React, { useState, useEffect } from "react";
import api, { getErrorMessage } from "../../lib/api";
import {
  Tag,
  Plus,
  Search,
  Calendar,
  Edit3,
  Trash2,
  Copy as DuplicateIcon,
  CheckCircle2,
  TrendingUp,
  X,
  Clock,
  Sparkles,
  ShieldCheck,
  Eye,
  Check,
  AlertCircle,
  Percent,
  Layers,
} from "lucide-react";
import { useNotifications } from "../../contexts/NotificationContext";
import FileUploader from "../../components/FileUploader";
import { CouponVoucherCard } from "../../components/CouponVoucherCard";

export const TARGET_ROUTES = [
  { value: "all", label: "All Routes (Global)" },
  { value: "homepage", label: "Homepage (Exclusive Offers)" },
  { value: "stays", label: "Ashram Stays" },
  { value: "darshan", label: "Darshan & Seva" },
  { value: "services", label: "Tirvona Services" },
  { value: "marketplace", label: "Marketplace" },
  { value: "parking", label: "Parking" },
];

export const OFFER_TYPES = [
  "MAHAKUMBH OFFER",
  "FESTIVAL OFFER",
  "WEEKEND OFFER",
  "SPECIAL OFFER",
  "SEASONAL DEAL",
  "YATRA PACKAGE",
  "VIP ACCESS",
];

export const AdminOffersPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const [offers, setOffers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalOffers: 0,
    activeOffers: 0,
    featuredOffers: 0,
    expiredOffers: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedRoute, setSelectedRoute] = useState("all");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editOfferId, setEditOfferId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<any>({
    offerTitle: "",
    promoCode: "",
    targetRoute: "homepage",
    offerType: "MAHAKUMBH OFFER",
    description: "",
    discountType: "Percentage",
    discountValue: 20,
    bannerImage: "",
    validFrom: new Date().toISOString().split("T")[0],
    validTill: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    status: "active",
    featured: true,
    maximumRedemptions: 500,
  });

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/offers/my-offers");
      if (res.data?.success) {
        const rows = res.data.data || [];
        setOffers(rows);

        const now = new Date();
        const active = rows.filter(
          (o: any) => o.status === "active" && new Date(o.validTill) >= now,
        ).length;
        const featured = rows.filter((o: any) => o.featured).length;
        const expired = rows.filter(
          (o: any) => o.status === "expired" || new Date(o.validTill) < now,
        ).length;

        setStats({
          totalOffers: rows.length,
          activeOffers: active,
          featuredOffers: featured,
          expiredOffers: expired,
        });
      }
    } catch (err) {
      console.error("Fetch admin offers error:", err);
      addNotification("Error", getErrorMessage(err, "Failed to load offers"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const openCreateModal = () => {
    setEditOfferId(null);
    setFormData({
      offerTitle: "",
      promoCode: "",
      targetRoute: "homepage",
      offerType: "MAHAKUMBH OFFER",
      description: "",
      discountType: "Percentage",
      discountValue: 20,
      bannerImage: "",
      validFrom: new Date().toISOString().split("T")[0],
      validTill: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      status: "active",
      featured: true,
      maximumRedemptions: 500,
    });
    setShowModal(true);
  };

  const openEditModal = (offer: any) => {
    setEditOfferId(offer._id);
    setFormData({
      offerTitle: offer.offerTitle || offer.title || "",
      promoCode: offer.promoCode || "",
      targetRoute: offer.targetRoute || offer.category || "homepage",
      offerType: offer.offerType || "MAHAKUMBH OFFER",
      description: offer.description || "",
      discountType: offer.discountType || "Percentage",
      discountValue: offer.discountValue || offer.discountPercentage || 20,
      bannerImage: offer.bannerImage || offer.image || "",
      validFrom: offer.validFrom
        ? new Date(offer.validFrom).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      validTill: offer.validTill
        ? new Date(offer.validTill).toISOString().split("T")[0]
        : new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      status: offer.status || "active",
      featured: Boolean(offer.featured),
      maximumRedemptions: offer.maximumRedemptions || 500,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.offerTitle || !formData.promoCode) {
      addNotification("Validation Error", "Please provide Offer Title and Coupon Code", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        promoCode: formData.promoCode.toUpperCase().trim(),
        discountPercentage:
          formData.discountType === "Percentage" ? Number(formData.discountValue) : undefined,
        image: formData.bannerImage,
      };

      if (editOfferId) {
        await api.put(`/offers/${editOfferId}`, payload);
        addNotification("Success", "Offer updated successfully", "success");
      } else {
        await api.post("/offers", payload);
        addNotification("Success", "Offer created successfully", "success");
      }

      setShowModal(false);
      fetchOffers();
    } catch (err) {
      console.error("Save offer error:", err);
      addNotification("Error", getErrorMessage(err, "Could not save offer"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (offerId: string) => {
    try {
      await api.post(`/offers/${offerId}/duplicate`, {});
      addNotification("Success", "Offer duplicated successfully", "success");
      fetchOffers();
    } catch (err) {
      addNotification("Error", getErrorMessage(err, "Failed to duplicate offer"), "error");
    }
  };

  const handleDelete = async (offerId: string) => {
    if (!window.confirm("Are you sure you want to delete this offer?")) return;
    try {
      await api.delete(`/offers/${offerId}`);
      addNotification("Success", "Offer deleted successfully", "success");
      fetchOffers();
    } catch (err) {
      addNotification("Error", getErrorMessage(err, "Failed to delete offer"), "error");
    }
  };

  const handleToggleStatus = async (offer: any) => {
    const nextStatus = offer.status === "active" ? "disabled" : "active";
    try {
      await api.put(`/offers/${offer._id}`, { status: nextStatus });
      addNotification("Success", `Offer marked as ${nextStatus}`, "success");
      fetchOffers();
    } catch (err) {
      addNotification("Error", getErrorMessage(err, "Failed to update status"), "error");
    }
  };

  // Filter Logic
  const filteredOffers = offers.filter((offer) => {
    const matchesSearch =
      searchQuery === "" ||
      (offer.offerTitle || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (offer.promoCode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (offer.description || "").toLowerCase().includes(searchQuery.toLowerCase());

    const isExpired =
      offer.status === "expired" ||
      (offer.validTill && new Date(offer.validTill).getTime() < Date.now());

    let matchesStatus = true;
    if (selectedStatus === "Active") matchesStatus = offer.status === "active" && !isExpired;
    else if (selectedStatus === "Featured") matchesStatus = Boolean(offer.featured);
    else if (selectedStatus === "Expired") matchesStatus = isExpired;

    let matchesRoute = true;
    if (selectedRoute !== "all") {
      matchesRoute =
        offer.targetRoute === selectedRoute ||
        offer.category === selectedRoute ||
        (!offer.targetRoute && selectedRoute === "homepage");
    }

    return matchesSearch && matchesStatus && matchesRoute;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] dark:text-blue-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Tag size={12} /> Super Admin Offers Module
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#0B192C] dark:text-white">
            Exclusive Offers & Coupon Vouchers
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Create, schedule, and assign promotional offers across Homepage, Stays, Seva, Services, and Marketplace.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-5 py-3 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold flex items-center gap-2 shadow-md cursor-pointer transition-all shrink-0 self-start sm:self-auto"
        >
          <Plus size={16} /> Create New Offer
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Offers</p>
          <p className="text-2xl font-black text-[#0B192C] dark:text-white mt-1">{stats.totalOffers}</p>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Active Offers</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.activeOffers}</p>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Featured Deals</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.featuredOffers}</p>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Expired Offers</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{stats.expiredOffers}</p>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {["All", "Active", "Featured", "Expired"].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedStatus(tab)}
                className={`px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  selectedStatus === tab
                    ? "bg-[#0A4DA6] text-white shadow-sm"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search & Route Dropdown */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-60">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search offer or coupon..."
                className="w-full pl-9 pr-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] cursor-pointer"
            >
              {TARGET_ROUTES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Offers Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="h-64 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[28px]" />
          ))}
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-12 text-center space-y-3 shadow-sm">
          <Tag size={36} className="mx-auto text-gray-300" />
          <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white">No Offers Found</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Try adjusting your search query or route filters, or create a new offer for the homepage.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold"
          >
            <Plus size={14} /> Add New Offer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredOffers.map((offer) => {
            const isExpired =
              offer.status === "expired" ||
              (offer.validTill && new Date(offer.validTill).getTime() < Date.now());

            const routeObj = TARGET_ROUTES.find(
              (r) => r.value === (offer.targetRoute || offer.category || "homepage"),
            );

            return (
              <div key={offer._id} className="relative group w-full">
                <CouponVoucherCard
                  offer={offer}
                  isCarouselItem={false}
                  className="w-full max-w-none"
                  adminToolbar={
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[10px] font-black text-[#0A4DA6] dark:text-blue-400">
                          {routeObj?.label || "Homepage"}
                        </span>

                        {isExpired ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px] font-black text-rose-600">
                            Expired
                          </span>
                        ) : offer.status === "active" ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-black text-emerald-600">
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-[10px] font-black text-gray-500">
                            {offer.status}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(offer)}
                          title="Edit Offer"
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-[#0A4DA6] cursor-pointer transition-colors"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(offer._id)}
                          title="Duplicate Offer"
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-emerald-600 cursor-pointer transition-colors"
                        >
                          <DuplicateIcon size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(offer._id)}
                          title="Delete Offer"
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-rose-600 cursor-pointer transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </>
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Offer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-[#0B192C] dark:text-white">
                  {editOfferId ? "Edit Offer" : "Create New Offer"}
                </h2>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                  Configure promotion title, discount code, validity, and category route placement.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Title */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Offer Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.offerTitle}
                    onChange={(e) => setFormData({ ...formData, offerTitle: e.target.value })}
                    placeholder="e.g. Mahakumbh Sacred Stay Special"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>

                {/* Promo Code */}
                <div>
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Coupon / Promo Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.promoCode}
                    onChange={(e) => setFormData({ ...formData, promoCode: e.target.value.toUpperCase() })}
                    placeholder="KUMBH2026"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] tracking-wider"
                  />
                </div>

                {/* Target Route / Category Dropdown */}
                <div>
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Category / Target Route <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.targetRoute}
                    onChange={(e) => setFormData({ ...formData, targetRoute: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] cursor-pointer"
                  >
                    {TARGET_ROUTES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Offer Type Badge */}
                <div>
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Badge / Offer Type
                  </label>
                  <select
                    value={formData.offerType}
                    onChange={(e) => setFormData({ ...formData, offerType: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] cursor-pointer"
                  >
                    {OFFER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Discount Type */}
                <div>
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Discount Type
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] cursor-pointer"
                  >
                    <option value="Percentage">Percentage (%)</option>
                    <option value="FixedAmount">Flat Amount (₹)</option>
                  </select>
                </div>

                {/* Discount Value */}
                <div>
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Discount Amount / Value
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>

                {/* Dates */}
                <div>
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Valid Till (Expiry) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.validTill}
                    onChange={(e) => setFormData({ ...formData, validTill: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>

                {/* Image Upload */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block">
                    Banner / Thumbnail Image
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FileUploader
                      folder="offers"
                      onUploaded={(url) => setFormData({ ...formData, bannerImage: url })}
                      label="Upload offer image"
                      currentUrl={formData.bannerImage}
                    />
                    <input
                      type="text"
                      value={formData.bannerImage}
                      onChange={(e) => setFormData({ ...formData, bannerImage: e.target.value })}
                      placeholder="Or enter image URL directly"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief details about what the offer provides..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>

                {/* Status & Featured */}
                <div>
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="draft">Draft</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-extrabold text-[#0B192C] dark:text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      className="w-4 h-4 accent-[#0A4DA6] rounded"
                    />
                    Feature this offer on Homepage banner
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold shadow-md cursor-pointer transition-all flex items-center gap-2"
                >
                  {submitting ? "Saving..." : editOfferId ? "Update Offer" : "Publish Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOffersPage;
