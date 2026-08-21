import React, { useState, useEffect } from "react";
import api, { getErrorMessage } from "../lib/api";
import { formatCurrency } from "../utils/format";
import {
  Tag,
  Plus,
  Search,
  Calendar,
  Copy,
  Edit3,
  Trash2,
  Copy as DuplicateIcon,
  CheckCircle2,
  TrendingUp,
  Building,
  ArrowRight,
  ArrowLeft,
  X,
  Award,
  Clock,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import FileUploader from "../components/FileUploader";

export const OwnerOffersPage: React.FC = () => {
  const { addNotification, confirmAction } = useNotifications();

  const [offers, setOffers] = useState<any[]>([]);
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalOffers: 0,
    activeOffers: 0,
    scheduledOffers: 0,
    expiredOffers: 0,
    redeemedOffers: 0,
    revenueGenerated: 0,
  });
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");

  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editOfferId, setEditOfferId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<any>({
    offerTitle: "",
    shortTitle: "",
    subtitle: "",
    offerType: "Festival Offer",
    ashramId: "",
    applicableAshrams: [],
    description: "",
    fullHtmlDescription: "",
    highlights: "",
    termsAndConditions: "",
    promoCode: "",
    discountType: "Percentage",
    discountValue: 20,
    maximumDiscount: 500,
    minimumBookingAmount: 1000,
    bannerImage: "",
    thumbnailImage: "",
    desktopBanner: "",
    mobileBanner: "",
    galleryImages: [],
    validFrom: new Date().toISOString().split("T")[0],
    validTill: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    maximumRedemptions: 100,
    perUserLimit: 1,
    priority: 1,
    featured: false,
    status: "active",
  });

  const offerCategories = [
    "Weekend Offer",
    "Festival Offer",
    "Mahakumbh Offer",
    "Seasonal Offer",
    "Summer Offer",
    "Winter Offer",
    "New Ashram Launch",
    "Donation Campaign",
    "Room Upgrade",
    "Food Offer",
    "Family Package",
    "Senior Citizen Offer",
    "Student Offer",
    "Long Stay Offer",
    "Corporate Retreat",
    "Yoga Camp",
    "Meditation Camp",
    "Special Darshan",
    "Custom",
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/offers/my-offers");
      if (res.data.success) {
        setOffers(res.data.data);
        setStats(res.data.stats);
      }

      const ashramRes = await api.get("/ashrams/my-listings/all");
      if (ashramRes.data.success) {
        setAshrams(ashramRes.data.data);
      }
    } catch (err) {
      console.error("Fetch owner offers error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWizard = (offerToEdit?: any) => {
    if (offerToEdit) {
      setEditOfferId(offerToEdit._id);
      setFormData({
        offerTitle: offerToEdit.offerTitle || "",
        shortTitle: offerToEdit.shortTitle || "",
        subtitle: offerToEdit.subtitle || "",
        offerType: offerToEdit.offerType || "Festival Offer",
        ashramId: offerToEdit.ashramId?._id || offerToEdit.ashramId || "",
        applicableAshrams: offerToEdit.applicableAshrams || [],
        description: offerToEdit.description || "",
        fullHtmlDescription: offerToEdit.fullHtmlDescription || "",
        highlights: Array.isArray(offerToEdit.highlights)
          ? offerToEdit.highlights.join(", ")
          : offerToEdit.highlights || "",
        termsAndConditions: Array.isArray(offerToEdit.termsAndConditions)
          ? offerToEdit.termsAndConditions.join(", ")
          : offerToEdit.termsAndConditions || "",
        promoCode: offerToEdit.promoCode || "",
        discountType: offerToEdit.discountType || "Percentage",
        discountValue: offerToEdit.discountValue || 20,
        maximumDiscount: offerToEdit.maximumDiscount || 0,
        minimumBookingAmount: offerToEdit.minimumBookingAmount || 0,
        bannerImage: offerToEdit.bannerImage || "",
        thumbnailImage: offerToEdit.thumbnailImage || "",
        desktopBanner: offerToEdit.desktopBanner || "",
        mobileBanner: offerToEdit.mobileBanner || "",
        galleryImages: offerToEdit.galleryImages || [],
        validFrom: offerToEdit.validFrom
          ? new Date(offerToEdit.validFrom).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        validTill: offerToEdit.validTill
          ? new Date(offerToEdit.validTill).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        maximumRedemptions: offerToEdit.maximumRedemptions || 100,
        perUserLimit: offerToEdit.perUserLimit || 1,
        priority: offerToEdit.priority || 1,
        featured: offerToEdit.featured || false,
        status: offerToEdit.status || "active",
      });
    } else {
      setEditOfferId(null);
      setFormData({
        offerTitle: "",
        shortTitle: "",
        subtitle: "",
        offerType: "Festival Offer",
        ashramId: ashrams[0]?._id || "",
        applicableAshrams: ashrams.map((a) => a._id),
        description: "",
        fullHtmlDescription: "",
        highlights: "Free Satvik Meal, Direct Ganga View, Room Upgrade",
        termsAndConditions:
          "Valid for online bookings, Cannot be combined with other coupons",
        promoCode: `FESTIVAL_${Math.floor(100 + Math.random() * 900)}`,
        discountType: "Percentage",
        discountValue: 20,
        maximumDiscount: 500,
        minimumBookingAmount: 1000,
        bannerImage: "",
        thumbnailImage: "",
        desktopBanner: "",
        mobileBanner: "",
        galleryImages: [],
        validFrom: new Date().toISOString().split("T")[0],
        validTill: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .split("T")[0],
        maximumRedemptions: 100,
        perUserLimit: 1,
        priority: 1,
        featured: true,
        status: "active",
      });
    }
    setCurrentStep(1);
    setShowWizard(true);
  };

  const handleSaveOffer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        highlights:
          typeof formData.highlights === "string"
            ? formData.highlights
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : formData.highlights,
        termsAndConditions:
          typeof formData.termsAndConditions === "string"
            ? formData.termsAndConditions
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : formData.termsAndConditions,
      };

      let res;
      if (editOfferId) {
        res = await api.put(`/offers/${editOfferId}`, payload);
      } else {
        res = await api.post("/offers", payload);
      }

      if (res.data.success) {
        addNotification(
          "Offer Saved Successfully!",
          `Promotional offer "${formData.offerTitle}" is active.`,
          "success",
        );
        setShowWizard(false);
        fetchData();
      }
    } catch (err: any) {
      console.error("Save offer error:", err);
      addNotification(
        "Error",
        err.response?.data?.message || "Failed to save offer.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (offerId: string) => {
    try {
      const res = await api.post(`/offers/${offerId}/duplicate`, {});
      if (res.data.success) {
        addNotification(
          "Offer Duplicated!",
          "New draft offer created.",
          "success",
        );
        fetchData();
      }
    } catch (err) {
      console.error("Duplicate offer error:", err);
    }
  };

  const handleDelete = async (offerId: string) => {
    if (!(await confirmAction({ title: "Delete promotional offer?", message: "This offer will be removed and its coupon will no longer be usable.", confirmLabel: "Delete Offer", tone: "danger" }))) return;
    try {
      await api.delete(`/offers/${offerId}`);
      addNotification("Offer Deleted", "The offer has been removed.", "info");
      fetchData();
    } catch (err) {
      console.error("Delete offer error:", err);
      addNotification(
        "Could Not Delete Offer",
        getErrorMessage(err, "The offer could not be deleted. Please try again."),
        "error",
      );
    }
  };

  const filteredOffers = offers.filter((o) => {
    const matchesSearch =
      o.offerTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.promoCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      selectedStatus === "All" ||
      o.status.toLowerCase() === selectedStatus.toLowerCase();
    const matchesCat =
      selectedCategoryFilter === "All" ||
      o.offerType === selectedCategoryFilter;

    return matchesSearch && matchesStatus && matchesCat;
  });

  return (
    <div className="space-y-8 text-left w-full pb-12">
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] rounded-[28px] p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30 backdrop-blur-md">
            Enterprise Offer & Promotion Hub
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Offer & Promotion Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-200 max-w-2xl font-medium">
            Create, schedule, and manage promotional offers, rate upgrades, and
            festival discounts across all your ashrams.
          </p>
        </div>

        <button
          onClick={() => handleOpenWizard()}
          className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-full flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus size={16} /> Launch Create Offer Wizard
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-[10px] font-black text-gray-400 tracking-wider">
            Total Offers
          </div>
          <div className="text-xl font-black text-[#0B192C] dark:text-white">
            {stats.totalOffers}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-[10px] font-black text-gray-400 tracking-wider">
            Active Deals
          </div>
          <div className="text-xl font-black text-emerald-600">
            {stats.activeOffers}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-[10px] font-black text-gray-400 tracking-wider">
            Scheduled
          </div>
          <div className="text-xl font-black text-[#0A4DA6] dark:text-amber-400">
            {stats.scheduledOffers}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-[10px] font-black text-gray-400 tracking-wider">
            Expired
          </div>
          <div className="text-xl font-black text-rose-500">
            {stats.expiredOffers}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-[10px] font-black text-gray-400 tracking-wider">
            Redemptions
          </div>
          <div className="text-xl font-black text-purple-600">
            {stats.redeemedOffers}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-[10px] font-black text-gray-400 tracking-wider">
            Revenue
          </div>
          <div className="text-xl font-black text-amber-500">
            {formatCurrency(stats.revenueGenerated)}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["All", "Active", "Scheduled", "Draft", "Expired"].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black cursor-pointer whitespace-nowrap transition-all ${
                selectedStatus === st
                  ? "bg-[#0A4DA6] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search offer or promo code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl animate-pulse" />
      ) : filteredOffers.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <Tag size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-black text-[#0B192C] dark:text-white">
            No Promotional Offers Found
          </h3>
          <p className="text-xs text-gray-400">
            Click "Launch Create Offer Wizard" to create your first promotion
            deal.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOffers.map((offer) => (
            <div
              key={offer._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-video bg-black">
                  {offer.bannerImage ? (
                    <img
                      src={offer.bannerImage}
                      alt={offer.offerTitle}
                      className="w-full h-full object-cover opacity-90"
                    />
                  ) : null}
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#0A4DA6] text-white text-[10px] font-black">
                    {offer.offerType}
                  </span>
                  <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-black">
                    {offer.discountType === "Percentage"
                      ? `${offer.discountValue}% OFF`
                      : `${formatCurrency(offer.discountValue)} OFF`}
                  </span>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                      {offer.offerTitle}
                    </h3>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                      {offer.description}
                    </p>
                  </div>

                  <div className="bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-3 flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400">
                      PROMO
                    </span>
                    <span className="font-mono font-black text-sm text-[#0A4DA6] dark:text-amber-400">
                      {offer.promoCode}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 font-bold flex items-center justify-between">
                    <span>Valid Till:</span>
                    <span>
                      {new Date(offer.validTill).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0 flex items-center justify-between border-t border-gray-100 dark:border-slate-800/80 pt-4 gap-2">
                <button
                  onClick={() => handleOpenWizard(offer)}
                  className="px-3.5 py-2 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 size={13} /> Edit
                </button>

                <button
                  onClick={() => handleDuplicate(offer._id)}
                  className="p-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs cursor-pointer"
                  title="Duplicate Offer"
                >
                  <DuplicateIcon size={14} />
                </button>

                <button
                  onClick={() => handleDelete(offer._id)}
                  className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl text-xs cursor-pointer"
                  title="Delete Offer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowWizard(false)}
          />
          <div className="relative w-full max-w-4xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                  {editOfferId
                    ? "Edit Offer Details"
                    : "Create New Promotional Offer"}
                </h3>
                <p className="text-xs text-gray-400">
                  Step {currentStep} of 8: Multi-Step Enterprise Offer
                  Configuration
                </p>
              </div>
              <button
                onClick={() => setShowWizard(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2 border-b border-gray-100 dark:border-slate-800">
              {[
                "1. Basic Info",
                "2. Ashram",
                "3. Details",
                "4. Discount",
                "5. Images",
                "6. Validity",
                "7. Terms",
                "8. Preview",
              ].map((stName, idx) => {
                const stepNum = idx + 1;
                return (
                  <button
                    key={stName}
                    onClick={() => setCurrentStep(stepNum)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold whitespace-nowrap cursor-pointer transition-all ${
                      currentStep === stepNum
                        ? "bg-[#0A4DA6] text-white"
                        : currentStep > stepNum
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-400"
                    }`}
                  >
                    {stName}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSaveOffer} className="space-y-6">
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1">
                      Offer Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kumbh Mela Special Pilgrimage Offer 30% OFF"
                      value={formData.offerTitle}
                      onChange={(e) =>
                        setFormData({ ...formData, offerTitle: e.target.value })
                      }
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1">
                        Offer Category
                      </label>
                      <select
                        value={formData.offerType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            offerType: e.target.value,
                          })
                        }
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                      >
                        {offerCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1">
                        Short Subtitle
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Includes Satvik meals & Ganga view room"
                        value={formData.subtitle}
                        onChange={(e) =>
                          setFormData({ ...formData, subtitle: e.target.value })
                        }
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    Select Primary Ashram
                  </label>
                  <select
                    value={formData.ashramId}
                    onChange={(e) =>
                      setFormData({ ...formData, ashramId: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  >
                    <option value="">All My Owned Ashrams</option>
                    {ashrams.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name} ({a.address?.city})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1">
                      Offer Description
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1">
                      Offer Highlights (comma separated)
                    </label>
                    <input
                      type="text"
                      value={formData.highlights}
                      onChange={(e) =>
                        setFormData({ ...formData, highlights: e.target.value })
                      }
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1">
                        Promo Code
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.promoCode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            promoCode: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono font-black focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1">
                        Discount Type
                      </label>
                      <select
                        value={formData.discountType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discountType: e.target.value,
                          })
                        }
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold"
                      >
                        <option value="Percentage">Percentage (%)</option>
                        <option value="Flat Amount">Flat Amount (₹)</option>
                        <option value="Free Upgrade">Free Room Upgrade</option>
                        <option value="Free Meal">Free Satvik Meal</option>
                        <option value="Free Prasad">Free Sacred Prasad</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1">
                        Discount Value
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.discountValue}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discountValue: e.target.value,
                          })
                        }
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-black"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1">
                        Max Discount (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.maximumDiscount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maximumDiscount: e.target.value,
                          })
                        }
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1">
                        Min Booking Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.minimumBookingAmount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            minimumBookingAmount: e.target.value,
                          })
                        }
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    Offer Banner Image
                  </label>
                  <FileUploader
                    folder="offers"
                    accept="image/*"
                    label="Upload Banner Photo"
                    currentUrl={formData.bannerImage}
                    onUploaded={(url) =>
                      setFormData({
                        ...formData,
                        bannerImage: url,
                        thumbnailImage: url,
                      })
                    }
                  />
                </div>
              )}

              {currentStep === 6 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1">
                      Valid From
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.validFrom}
                      onChange={(e) =>
                        setFormData({ ...formData, validFrom: e.target.value })
                      }
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1">
                      Valid Till
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.validTill}
                      onChange={(e) =>
                        setFormData({ ...formData, validTill: e.target.value })
                      }
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              {currentStep === 7 && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    Terms & Conditions (comma separated)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.termsAndConditions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        termsAndConditions: e.target.value,
                      })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold"
                  />
                </div>
              )}

              {currentStep === 8 && (
                <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
                  <span className="text-[10px] font-black text-amber-500 tracking-widest">
                    LIVE CUSTOMER PREVIEW
                  </span>
                  <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                      {formData.offerTitle || "Untitled Offer"}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {formData.description}
                    </p>
                    <div className="font-mono font-black text-sm text-[#0A4DA6]">
                      {formData.promoCode}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold cursor-pointer"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                ) : (
                  <div />
                )}

                {currentStep < 8 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="px-6 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold cursor-pointer"
                  >
                    Next Step <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSaveOffer()}
                    disabled={submitting}
                    className="px-8 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-black cursor-pointer shadow-lg"
                  >
                    {submitting ? "Publishing..." : "Publish Offer Live"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerOffersPage;
