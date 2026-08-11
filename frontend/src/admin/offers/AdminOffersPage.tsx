import React, { useState, useEffect, useCallback } from "react";
import { getErrorMessage } from "../../lib/api";
import { ashramService, offerService } from "../../services";
import {
  Tag,
  Plus,
  Search,
  Edit3,
  Trash2,
  Copy as DuplicateIcon,
  X,
  Eye,
  AlertCircle,
  Loader2,
  MapPin,
  Power,
  RefreshCw,
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

/**
 * Discount types the API accepts, verbatim.
 *
 * These strings are an enum on both the DTO and the Mongoose schema. Sending
 * anything else — the old "FixedAmount" — is rejected before the request
 * reaches the service, so the labels and the wire values are kept apart here.
 */
export const DISCOUNT_TYPES = [
  { value: "Percentage", label: "Percentage (%)" },
  { value: "Flat Amount", label: "Flat Amount (₹)" },
];

const EMPTY_FORM = () => ({
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
  // Two-level location binding. `destination` only narrows the ashram list in
  // the form; `ashramId` is what is persisted and what booking validation
  // enforces. Empty ashramId means the coupon stays platform-wide.
  destination: "",
  ashramId: "",
});

/** Resolve an offer's ashram reference to an id, populated or not. */
const ashramIdOf = (offer: any): string =>
  String(offer?.ashramId?._id ?? offer?.ashramId ?? "");

const isOfferExpired = (offer: any): boolean =>
  offer?.status === "expired" ||
  Boolean(offer?.validTill && new Date(offer.validTill).getTime() < Date.now());

export const AdminOffersPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedRoute, setSelectedRoute] = useState("all");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editOfferId, setEditOfferId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The row an action is currently running against, so only that card's
  // buttons spin and a double click cannot fire the same request twice.
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    action: "delete" | "duplicate" | "status" | "view";
  } | null>(null);

  // View (read-only) drawer
  const [viewOffer, setViewOffer] = useState<any>(null);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const [formData, setFormData] = useState<any>(EMPTY_FORM());

  // Location picker. Destinations load once with the page; the ashram list is
  // fetched per destination so the second dropdown only ever offers ashrams
  // that actually sit in the chosen one.
  const [destinations, setDestinations] = useState<any[]>([]);
  const [destinationAshrams, setDestinationAshrams] = useState<any[]>([]);
  const [loadingAshrams, setLoadingAshrams] = useState(false);

  const loadDestinationAshrams = useCallback(
    async (city: string) => {
      if (!city) {
        setDestinationAshrams([]);
        return;
      }
      setLoadingAshrams(true);
      try {
        const res = await ashramService.byDestination(city);
        setDestinationAshrams(res.data?.data || []);
      } catch (err) {
        setDestinationAshrams([]);
        addNotification(
          "Error",
          getErrorMessage(err, `Could not load ashrams in ${city}`),
          "error",
        );
      } finally {
        setLoadingAshrams(false);
      }
    },
    [addNotification],
  );

  const handleDestinationChange = (city: string) => {
    // The previously chosen ashram belongs to the old destination, so it is
    // cleared rather than left pointing outside the new list.
    setFormData((prev: any) => ({ ...prev, destination: city, ashramId: "" }));
    loadDestinationAshrams(city);
  };

  /**
   * @param background true for a post-action refresh, which must not blank the
   * grid out to skeletons — the administrator is looking at the row they just
   * changed and needs to see it update in place.
   */
  const fetchOffers = useCallback(
    async (background = false) => {
      if (background) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await offerService.mine();
        setOffers(res.data?.data || []);
        setLoadError(null);
      } catch (err) {
        const message = getErrorMessage(err, "Failed to load offers");
        setLoadError(message);
        addNotification("Error", message, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addNotification],
  );

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  useEffect(() => {
    ashramService
      .destinations()
      .then((res) => setDestinations(res.data?.data || []))
      .catch((err) =>
        addNotification(
          "Error",
          getErrorMessage(err, "Could not load destinations"),
          "error",
        ),
      );
  }, [addNotification]);

  // Derived from the rows on screen, so every action that changes a row moves
  // these tiles in the same render. No second source of truth to fall behind.
  const stats = {
    totalOffers: offers.length,
    activeOffers: offers.filter((o) => o.status === "active" && !isOfferExpired(o))
      .length,
    featuredOffers: offers.filter((o) => o.featured).length,
    expiredOffers: offers.filter(isOfferExpired).length,
  };

  const openCreateModal = () => {
    setEditOfferId(null);
    setFormData(EMPTY_FORM());
    setDestinationAshrams([]);
    setShowModal(true);
  };

  const openEditModal = (offer: any) => {
    // `mine()` resolves the ashram reference, so an existing binding can be
    // shown at both levels: its city preselects the destination and reloads
    // that destination's ashrams so the second dropdown has the row to select.
    const boundAshram = offer.ashramId?._id ? offer.ashramId : null;
    const destination = boundAshram?.address?.city || "";
    setDestinationAshrams([]);
    if (destination) loadDestinationAshrams(destination);

    setEditOfferId(offer._id);
    setFormData({
      destination,
      ashramId: ashramIdOf(offer),
      offerTitle: offer.offerTitle || offer.title || "",
      promoCode: offer.promoCode || "",
      targetRoute: offer.targetRoute || offer.category || "homepage",
      offerType: offer.offerType || "MAHAKUMBH OFFER",
      description: offer.description || "",
      // Legacy rows carry the retired "FixedAmount" value, which the API no
      // longer accepts; map it forward so opening one and saving it succeeds.
      discountType:
        offer.discountType === "FixedAmount"
          ? "Flat Amount"
          : offer.discountType || "Percentage",
      discountValue: offer.discountValue ?? offer.discountPercentage ?? 20,
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
    const title = String(formData.offerTitle || "").trim();
    const code = String(formData.promoCode || "").trim().toUpperCase();
    const description = String(formData.description || "").trim();

    if (!title || !code) {
      addNotification(
        "Validation Error",
        "Please provide an Offer Title and a Coupon Code",
        "error",
      );
      return;
    }
    // The API marks description required. Failing here beats a 400 the
    // administrator has to decode from a toast.
    if (!description) {
      addNotification(
        "Validation Error",
        "Please add a short description — it appears on the offer card",
        "error",
      );
      return;
    }
    if (new Date(formData.validTill) < new Date(formData.validFrom)) {
      addNotification(
        "Validation Error",
        "The expiry date cannot fall before the start date",
        "error",
      );
      return;
    }
    // Picking a destination and stopping there is almost always an unfinished
    // selection, not a request for a platform-wide coupon.
    if (formData.destination && !formData.ashramId) {
      addNotification(
        "Validation Error",
        `Select which ashram in ${formData.destination} this coupon applies to, or clear the destination to make it platform-wide`,
        "error",
      );
      return;
    }

    setSubmitting(true);
    try {
      // Only fields the API declares. `whitelist` + `forbidNonWhitelisted` on
      // the server rejects the whole request over one stray key, which is what
      // the retired `discountPercentage` / `image` pair used to do.
      const payload = {
        offerTitle: title,
        promoCode: code,
        description,
        targetRoute: formData.targetRoute,
        offerType: formData.offerType,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        bannerImage: formData.bannerImage || undefined,
        validFrom: formData.validFrom,
        validTill: formData.validTill,
        status: formData.status,
        featured: Boolean(formData.featured),
        maximumRedemptions: Number(formData.maximumRedemptions) || 100,
        // Explicit null rather than omitted: on an edit that clears the
        // binding, an absent key would leave the old ashram in place.
        ashramId: formData.ashramId || null,
      };

      if (editOfferId) await offerService.update(editOfferId, payload);
      else await offerService.create(payload);

      addNotification(
        "Success",
        editOfferId ? "Offer updated successfully" : "Offer created successfully",
        "success",
      );
      setShowModal(false);
      await fetchOffers(true);
    } catch (err) {
      addNotification("Error", getErrorMessage(err, "Could not save offer"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleView = async (offer: any) => {
    setPendingAction({ id: offer._id, action: "view" });
    try {
      // Re-read rather than reusing the list row: the list is a snapshot and
      // the detail view resolves the linked ashram, which the listing omits.
      const res = await offerService.manageById(offer._id);
      setViewOffer(res.data?.data ?? offer);
    } catch (err) {
      addNotification("Error", getErrorMessage(err, "Could not load this offer"), "error");
    } finally {
      setPendingAction(null);
    }
  };

  const handleDuplicate = async (offer: any) => {
    setPendingAction({ id: offer._id, action: "duplicate" });
    try {
      await offerService.duplicate(offer._id);
      addNotification(
        "Success",
        "Offer duplicated — the copy is saved as a draft",
        "success",
      );
      await fetchOffers(true);
    } catch (err) {
      addNotification("Error", getErrorMessage(err, "Failed to duplicate offer"), "error");
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (offer: any) => {
    setPendingAction({ id: offer._id, action: "delete" });
    try {
      const res = await offerService.remove(offer._id);
      // The server reports whether the row was removed outright or archived
      // because bookings already reference it. Repeat what it actually did.
      addNotification(
        "Success",
        res.data?.message || "Offer deleted successfully",
        "success",
      );
      setConfirmDelete(null);
      // Drop the card immediately, then reconcile with the server.
      setOffers((rows) => rows.filter((row) => row._id !== offer._id));
      await fetchOffers(true);
    } catch (err) {
      addNotification("Error", getErrorMessage(err, "Failed to delete offer"), "error");
    } finally {
      setPendingAction(null);
    }
  };

  const handleToggleStatus = async (offer: any) => {
    const nextStatus = offer.status === "active" ? "disabled" : "active";
    setPendingAction({ id: offer._id, action: "status" });
    try {
      const res = await offerService.setStatus(offer._id, nextStatus);
      const saved = res.data?.data;
      addNotification("Success", `Offer marked as ${nextStatus}`, "success");
      setOffers((rows) =>
        rows.map((row) =>
          row._id === offer._id ? { ...row, ...(saved ?? { status: nextStatus }) } : row,
        ),
      );
    } catch (err) {
      addNotification("Error", getErrorMessage(err, "Failed to update status"), "error");
    } finally {
      setPendingAction(null);
    }
  };

  const isBusy = (id: string, action?: string) =>
    pendingAction?.id === id && (!action || pendingAction.action === action);

  // Filter Logic
  const filteredOffers = offers.filter((offer) => {
    const matchesSearch =
      searchQuery === "" ||
      (offer.offerTitle || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (offer.promoCode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (offer.description || "").toLowerCase().includes(searchQuery.toLowerCase());

    const isExpired = isOfferExpired(offer);

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

      {/* Load failure. Distinct from "no offers" — the difference decides
        whether the administrator should retry or create something. */}
      {loadError && !loading && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-extrabold text-rose-700 dark:text-rose-300">
                Could not load offers
              </p>
              <p className="text-[11px] font-semibold text-rose-600/80 dark:text-rose-400/80">
                {loadError}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchOffers()}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold cursor-pointer"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

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
        <div
          className={`grid grid-cols-1 xl:grid-cols-2 gap-6 transition-opacity ${
            refreshing ? "opacity-60" : ""
          }`}
        >
          {filteredOffers.map((offer) => {
            const isExpired = isOfferExpired(offer);

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

                        {/* Which ashram the coupon is redeemable at — the
                          single most consequential setting on the record. */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                            offer.ashramId?.name
                              ? "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
                              : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                          }`}
                        >
                          <MapPin size={9} />
                          {offer.ashramId?.name || "All ashrams"}
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
                          onClick={() => handleView(offer)}
                          disabled={isBusy(offer._id)}
                          title="View Offer Details"
                          aria-label="View offer details"
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-[#0A4DA6] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isBusy(offer._id, "view") ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Eye size={15} />
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(offer)}
                          disabled={isBusy(offer._id)}
                          title="Edit Offer"
                          aria-label="Edit offer"
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-[#0A4DA6] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(offer)}
                          disabled={isBusy(offer._id)}
                          title={
                            offer.status === "active"
                              ? "Disable Offer"
                              : "Activate Offer"
                          }
                          aria-label={
                            offer.status === "active"
                              ? "Disable offer"
                              : "Activate offer"
                          }
                          className={`p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            offer.status === "active"
                              ? "text-emerald-600 hover:text-amber-600"
                              : "text-gray-400 hover:text-emerald-600"
                          }`}
                        >
                          {isBusy(offer._id, "status") ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Power size={15} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDuplicate(offer)}
                          disabled={isBusy(offer._id)}
                          title="Duplicate Offer"
                          aria-label="Duplicate offer"
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-emerald-600 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isBusy(offer._id, "duplicate") ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <DuplicateIcon size={15} />
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(offer)}
                          disabled={isBusy(offer._id)}
                          title="Delete Offer"
                          aria-label="Delete offer"
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-rose-600 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isBusy(offer._id, "delete") ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
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

                {/* ── Location binding (two levels) ──
                  Destination first, then the ashrams inside it. Only the
                  ashram is saved; the destination exists to make the second
                  list short and correct. */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800">
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <MapPin size={14} className="text-[#0A4DA6]" />
                    <p className="text-[11px] font-extrabold text-[#0B192C] dark:text-white">
                      Applies To
                    </p>
                    <span className="text-[10px] font-semibold text-gray-400">
                      Leave blank to make this coupon valid across all ashrams
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                      Destination / Area
                    </label>
                    <select
                      value={formData.destination}
                      onChange={(e) => handleDestinationChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] cursor-pointer"
                    >
                      <option value="">All destinations</option>
                      {destinations.map((d) => (
                        <option key={d.city} value={d.city}>
                          {d.city}
                          {d.state ? `, ${d.state}` : ""} ({d.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                      Ashram{" "}
                      {formData.destination && (
                        <span className="text-rose-500">*</span>
                      )}
                    </label>
                    <select
                      value={formData.ashramId}
                      disabled={!formData.destination || loadingAshrams}
                      onChange={(e) =>
                        setFormData({ ...formData, ashramId: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!formData.destination
                          ? "Select a destination first"
                          : loadingAshrams
                            ? "Loading ashrams..."
                            : destinationAshrams.length === 0
                              ? "No ashrams in this destination"
                              : "Select an ashram"}
                      </option>
                      {destinationAshrams.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.ashramId && (
                    <p className="sm:col-span-2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-2.5 leading-relaxed">
                      This coupon will only be redeemable on bookings at{" "}
                      <span className="font-black">
                        {destinationAshrams.find(
                          (a) => a._id === formData.ashramId,
                        )?.name || "the selected ashram"}
                      </span>
                      . Clicking the offer takes visitors straight to that
                      ashram with the code already applied.
                    </p>
                  )}
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
                    {DISCOUNT_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
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
                    Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
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

                {/* Redemption cap. Editable because the server recomputes the
                  remaining balance from what has already been spent — raising
                  the cap adds headroom, it does not refund used redemptions. */}
                <div>
                  <label className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 block mb-1">
                    Maximum Redemptions
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maximumRedemptions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maximumRedemptions: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>

                <div className="flex items-center pt-5 sm:col-span-2">
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
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  {submitting ? "Saving..." : editOfferId ? "Update Offer" : "Publish Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read-only Offer Detail */}
      {viewOffer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => setViewOffer(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Offer details"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl my-8"
          >
            <div className="flex items-start justify-between border-b border-gray-100 dark:border-slate-800 pb-4 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[10px] font-black text-[#0A4DA6] dark:text-blue-400">
                    {TARGET_ROUTES.find(
                      (r) => r.value === (viewOffer.targetRoute || "homepage"),
                    )?.label || "Homepage"}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      isOfferExpired(viewOffer)
                        ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600"
                        : viewOffer.status === "active"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                    }`}
                  >
                    {isOfferExpired(viewOffer) ? "Expired" : viewOffer.status}
                  </span>
                  {viewOffer.featured && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-[10px] font-black text-amber-600">
                      Featured
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-extrabold text-[#0B192C] dark:text-white truncate">
                  {viewOffer.offerTitle}
                </h2>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                  {viewOffer.offerType || "Offer"}
                </p>
              </div>
              <button
                onClick={() => setViewOffer(null)}
                aria-label="Close"
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {viewOffer.description && (
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 leading-relaxed">
                {viewOffer.description}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                {
                  label: "Coupon Code",
                  value: viewOffer.promoCode,
                  mono: true,
                },
                {
                  label: "Discount",
                  value:
                    viewOffer.discountType === "Percentage"
                      ? `${viewOffer.discountValue}%`
                      : `₹${viewOffer.discountValue}`,
                },
                {
                  label: "Valid From",
                  value: viewOffer.validFrom
                    ? new Date(viewOffer.validFrom).toLocaleDateString("en-GB")
                    : "—",
                },
                {
                  label: "Valid Till",
                  value: viewOffer.validTill
                    ? new Date(viewOffer.validTill).toLocaleDateString("en-GB")
                    : "—",
                },
                {
                  label: "Redemptions Left",
                  value: `${viewOffer.remainingRedemptions ?? 0} / ${viewOffer.maximumRedemptions ?? 0}`,
                },
                { label: "Times Redeemed", value: viewOffer.redemptionsCount ?? 0 },
                { label: "Views", value: viewOffer.viewsCount ?? 0 },
                {
                  label: "Minimum Booking",
                  value: viewOffer.minimumBookingAmount
                    ? `₹${viewOffer.minimumBookingAmount}`
                    : "—",
                },
                {
                  label: "Ashram",
                  value: viewOffer.ashramId?.name || "All ashrams",
                },
              ].map((cell) => (
                <div
                  key={cell.label}
                  className="bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-2xl p-3"
                >
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    {cell.label}
                  </p>
                  <p
                    className={`text-sm font-black text-[#0B192C] dark:text-white mt-0.5 break-words ${
                      cell.mono ? "font-mono tracking-wider" : ""
                    }`}
                  >
                    {String(cell.value ?? "—")}
                  </p>
                </div>
              ))}
            </div>

            {viewOffer.bannerImage && (
              <img
                src={viewOffer.bannerImage}
                alt=""
                className="w-full h-40 object-cover rounded-2xl border border-gray-100 dark:border-slate-800"
              />
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                onClick={() => setViewOffer(null)}
                className="px-5 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const target = viewOffer;
                  setViewOffer(null);
                  openEditModal(target);
                }}
                className="px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold shadow-md cursor-pointer flex items-center gap-2"
              >
                <Edit3 size={13} /> Edit Offer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation. Names the offer and its code, so an administrator
        working a filtered grid can see exactly which row is about to go. */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete offer"
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] max-w-md w-full p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 shrink-0">
                <Trash2 size={20} className="text-rose-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white">
                  Delete this offer?
                </h3>
                {/* A malformed row has neither. Identify it by id so the
                  administrator still knows exactly what they are removing. */}
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1 leading-relaxed break-words">
                  <span className="font-black text-[#0B192C] dark:text-white">
                    {confirmDelete.offerTitle ||
                      confirmDelete.title ||
                      "This untitled record"}
                  </span>
                  {confirmDelete.promoCode ? (
                    <>
                      {" "}
                      (<span className="font-mono">{confirmDelete.promoCode}</span>)
                    </>
                  ) : (
                    <>
                      {" "}
                      (<span className="font-mono">{confirmDelete._id}</span>)
                    </>
                  )}{" "}
                  will be removed from every listing and can no longer be redeemed.
                </p>
                {Number(confirmDelete.redemptionsCount ?? 0) > 0 && (
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-2.5 leading-relaxed">
                    This offer was redeemed{" "}
                    {confirmDelete.redemptionsCount} time(s), so it will be archived
                    rather than erased — the bookings that used it keep their records.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isBusy(confirmDelete._id, "delete")}
                className="px-5 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={isBusy(confirmDelete._id, "delete")}
                className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isBusy(confirmDelete._id, "delete") && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                {isBusy(confirmDelete._id, "delete") ? "Deleting..." : "Delete Offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOffersPage;
