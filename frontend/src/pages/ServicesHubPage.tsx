import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Car,
  Users,
  Utensils,
  HeartPulse,
  ShoppingBag,
  Camera,
  Calendar,
  AlertTriangle,
  Search,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Sparkles,
  Filter,
  Clock,
} from "lucide-react";
import {
  serviceEcosystemService,
  type ServiceProviderItem,
} from "../services/service.service";
import { useNotifications } from "../contexts/NotificationContext";
import { useMemory } from "../contexts/UserMemoryContext";
import { useAuth } from "../contexts/AuthContext";
import {
  clearGuestPendingIntent,
  currentReturnUrl,
  getGuestPendingIntent,
  setGuestPendingIntent,
} from "../utils/guestGate";
import {
  EnterpriseModal,
  EnterpriseButton,
  EnterpriseSortDropdown,
  EnterpriseResetButton,
} from "../admin/shared";

export const ServicesHubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { updateMemoryCategory } = useMemory();

  const activeCategoryParam = searchParams.get("category") || "all";
  const activeCityParam = searchParams.get("city") || "all";

  const [services, setServices] = useState<ServiceProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || "",
  );
  const [selectedCity, setSelectedCity] = useState(activeCityParam);
  const [selectedCategory, setSelectedCategory] = useState(activeCategoryParam);
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "rating");

  // Filters
  const [pureVegOnly, setPureVegOnly] = useState(
    searchParams.get("pureVeg") === "true",
  );
  const [govtVerifiedOnly, setGovtVerifiedOnly] = useState(
    searchParams.get("govtVerified") === "true",
  );

  // Booking Modal State
  const [selectedService, setSelectedService] =
    useState<ServiceProviderItem | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("10:00 AM");
  const [guestsCount, setGuestsCount] = useState(1);
  const [specialNotes, setSpecialNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { id: "all", label: "All Services", icon: <Sparkles size={14} /> },
    { id: "transport", label: "Transport Cabs", icon: <Car size={14} /> },
    { id: "guides", label: "Temple Guides", icon: <Users size={14} /> },
    { id: "food", label: "Satvik Food", icon: <Utensils size={14} /> },
    { id: "medical", label: "Medical 24x7", icon: <HeartPulse size={14} /> },
    { id: "shops", label: "Puja Shops", icon: <ShoppingBag size={14} /> },
    { id: "photography", label: "Photography", icon: <Camera size={14} /> },
    { id: "events", label: "Events & Aarti", icon: <Calendar size={14} /> },
    { id: "emergency", label: "Emergency", icon: <AlertTriangle size={14} /> },
  ];

  const cities = [
    "all",
    "Rishikesh",
    "Haridwar",
    "Vrindavan",
    "Varanasi",
    "Ayodhya",
  ];

  useEffect(() => {
    fetchServices();
  }, [selectedCategory, selectedCity, pureVegOnly, govtVerifiedOnly, sortBy]);

  useEffect(() => {
    if (!user || services.length === 0) return;
    const intent = getGuestPendingIntent();
    if (intent?.type !== "service_booking" || !intent.data) return;
    const service = services.find(
      (item) => item._id === String(intent.data?.serviceId ?? ""),
    );
    if (!service) return;
    setSelectedService(service);
    setBookingDate(String(intent.data.bookingDate ?? ""));
    setBookingTime(String(intent.data.bookingTime ?? "10:00 AM"));
    setGuestsCount(Number(intent.data.guestsCount ?? 1));
    setSpecialNotes(String(intent.data.specialNotes ?? ""));
    clearGuestPendingIntent();
  }, [services, user]);

  useEffect(() => {
    const preserveOpenBooking = () => {
      if (!selectedService) return;
      setGuestPendingIntent({
        type: "service_booking",
        returnUrl: currentReturnUrl(),
        data: {
          serviceId: selectedService._id,
          bookingDate,
          bookingTime,
          guestsCount,
          specialNotes,
        },
      });
    };
    window.addEventListener("tirvona:unauthorized", preserveOpenBooking);
    return () =>
      window.removeEventListener("tirvona:unauthorized", preserveOpenBooking);
  }, [bookingDate, bookingTime, guestsCount, selectedService, specialNotes]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      // Sync URL Search Parameters
      const paramsObj: Record<string, string> = {};
      if (selectedCategory !== "all") paramsObj.category = selectedCategory;
      if (selectedCity !== "all") paramsObj.city = selectedCity;
      if (searchTerm) paramsObj.search = searchTerm;
      if (sortBy) paramsObj.sort = sortBy;
      if (pureVegOnly) paramsObj.pureVeg = "true";
      if (govtVerifiedOnly) paramsObj.govtVerified = "true";
      setSearchParams(paramsObj);

      // Memory engine auto-save
      updateMemoryCategory("filters", {
        serviceCategory: selectedCategory,
        serviceCity: selectedCity,
        serviceSearch: searchTerm,
        serviceSort: sortBy,
      });

      const res = await serviceEcosystemService.getAll({
        category: selectedCategory,
        city: selectedCity,
        search: searchTerm,
        sortBy,
        pureVeg: pureVegOnly,
        govtVerified: govtVerifiedOnly,
      });

      if (res.data?.success) {
        setServices(res.data.data);
      }
    } catch (err) {
      console.error("Fetch services error:", err);
      addNotification(
        "Load Failed",
        "Could not fetch service providers from MongoDB.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSelectedCity("all");
    setSearchTerm("");
    setSortBy("rating");
    setPureVegOnly(false);
    setGovtVerifiedOnly(false);
    setSearchParams({});
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchServices();
  };

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    setSearchParams({ category: catId });
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    if (!user) {
      const returnUrl = currentReturnUrl();
      setGuestPendingIntent({
        type: "service_booking",
        returnUrl,
        data: {
          serviceId: selectedService._id,
          bookingDate,
          bookingTime,
          guestsCount,
          specialNotes,
        },
      });
      navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const totalAmt = (selectedService.pricing.amount || 500) * guestsCount;
      const res = await serviceEcosystemService.book({
        serviceId: selectedService._id,
        customerName: user.name,
        customerPhone: user.phone,
        bookingDate: bookingDate || new Date().toISOString(),
        bookingTime,
        guestsCount,
        totalAmount: totalAmt,
        specialNotes,
      });

      if (res.data?.success) {
        addNotification(
          "Booking Confirmed",
          `Successfully reserved ${selectedService.name}!`,
          "success",
        );
        setSelectedService(null);
      }
    } catch (err) {
      console.error("Booking submit error:", err);
      addNotification(
        "Booking Failed",
        "Unable to confirm service booking.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-20 text-left">
      {/* ── 1. Page Header Banner ── */}
      {/* Clean Text Header (Matching all other section headers on the site) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#E58C28]">
            Local Services Directory
          </p>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Verified transport cabs, certified temple guides, pure Satvik
            bhojnalayas, 24x7 emergency medical assistance, and sacred puja
            vendors across India's holy circuits.
          </p>
        </div>
      </div>

      {/* ── 2. Search & Category Bar ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-20 space-y-6">
        {/* Search Bar Container */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4 sm:p-5 shadow-xl space-y-4">
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3"
          >
            {/* Search input */}
            <div className="sm:col-span-6 relative">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search taxi cabs, guides, Bhojnalaya, doctors..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            {/* City Selector */}
            <div className="sm:col-span-4 relative">
              <MapPin
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6]"
                size={16}
              />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] cursor-pointer capitalize"
              >
                <option value="all">All Holy Cities</option>
                {cities
                  .filter((c) => c !== "all")
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            {/* Submit Button */}
            <div className="sm:col-span-2">
              <EnterpriseButton
                type="submit"
                variant="primary"
                className="w-full py-2.5 text-xs"
              >
                Filter Services
              </EnterpriseButton>
            </div>
          </form>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/25"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Additional Filter Switches & Sort Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-2 border-t border-gray-100 dark:border-slate-800 font-bold text-gray-500">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pureVegOnly}
                  onChange={(e) => setPureVegOnly(e.target.checked)}
                  className="accent-[#0A4DA6] w-4 h-4 rounded"
                />
                <span>100% Pure Satvik / Veg</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={govtVerifiedOnly}
                  onChange={(e) => setGovtVerifiedOnly(e.target.checked)}
                  className="accent-[#0A4DA6] w-4 h-4 rounded"
                />
                <span>Govt Certified Only</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <EnterpriseSortDropdown
                value={sortBy}
                onChange={(val) => setSortBy(val)}
              />
              <EnterpriseResetButton onReset={handleResetFilters} />
            </div>
          </div>
        </div>

        {/* ── 3. Services Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-64 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] animate-pulse"
              />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-4">
            <Sparkles className="mx-auto text-gray-300" size={48} />
            <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
              No service providers found
            </h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              No active service providers matched your category filter or search
              keywords. Try selecting "All Services".
            </p>
            <button
              onClick={() => {
                setSelectedCategory("all");
                setSelectedCity("all");
                setSearchTerm("");
              }}
              className="px-5 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold shadow-md hover:bg-[#083b80]"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {services.map((item) => (
              <div
                key={item._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
              >
                {/* Top Image Banner */}
                <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                  <img
                    src={
                      item.images?.[0] ||
                      "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80"
                    }
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Category Pill Tag */}
                  <span className="absolute top-3 left-3 px-3 py-1 bg-[#0A4DA6] text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-md">
                    {item.subcategory}
                  </span>

                  {/* Rating Chip */}
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 dark:bg-[#0B192C]/90 text-[#0B192C] dark:text-white rounded-full text-xs font-black flex items-center gap-1 shadow-sm">
                    <Star size={12} className="text-amber-400 fill-amber-400" />
                    <span>{item.rating.toFixed(1)}</span>
                  </div>

                  {/* Location Label */}
                  <div className="absolute bottom-3 left-3 text-white text-xs font-extrabold flex items-center gap-1">
                    <MapPin size={12} className="text-[#E58C28]" />
                    <span>
                      {item.city}, {item.state}
                    </span>
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-5 space-y-4 flex-grow flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="font-black text-base text-[#0B192C] dark:text-white leading-tight">
                      {item.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium line-clamp-2">
                      {item.description || item.tagline}
                    </p>
                  </div>

                  {/* Badges / Specs list */}
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-extrabold pt-1">
                    {item.specifications?.pureVeg && (
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full">
                        🟢 100% PURE VEG
                      </span>
                    )}
                    {item.specifications?.govtVerified && (
                      <span className="px-2.5 py-0.5 bg-blue-50 text-[#0A4DA6] border border-blue-200 rounded-full">
                        ✓ GOVT VERIFIED
                      </span>
                    )}
                    {item.specifications?.available24x7 && (
                      <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                        ⏰ 24x7 AVAILABLE
                      </span>
                    )}
                  </div>

                  {/* Pricing & CTA */}
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold uppercase">
                        Estimated Fare
                      </span>
                      <span className="text-base font-black text-[#0A4DA6] dark:text-white">
                        ₹{item.pricing?.amount}{" "}
                        <span className="text-[10px] text-gray-400 font-normal">
                          /{item.pricing?.unit}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${item.contactPhone}`}
                        className="p-2 bg-gray-100 dark:bg-slate-800 text-[#0A4DA6] rounded-full hover:bg-gray-200 transition-colors"
                        title="Call Now"
                      >
                        <Phone size={14} />
                      </a>
                      <EnterpriseButton
                        variant="primary"
                        size="sm"
                        onClick={() => setSelectedService(item)}
                      >
                        Book Now
                      </EnterpriseButton>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Booking Modal ── */}
      <EnterpriseModal
        isOpen={Boolean(selectedService)}
        onClose={() => setSelectedService(null)}
        title={`Book ${selectedService?.name}`}
        subtitle="Confirm reservation details & customer details"
      >
        {selectedService && (
          <form
            onSubmit={handleBookingSubmit}
            className="space-y-4 text-xs font-bold"
          >
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-[10px] text-[#0A4DA6] block uppercase font-bold">
                  Provider
                </span>
                <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">
                  {selectedService.name}
                </span>
              </div>
              <span className="text-sm font-black text-[#0A4DA6]">
                ₹{selectedService.pricing.amount}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">
                Reservation Date *
              </label>
              <input
                type="date"
                required
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">
                  Preferred Time *
                </label>
                <input
                  type="text"
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  placeholder="e.g. 10:00 AM"
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">
                  Guests / Quantity *
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={guestsCount}
                  onChange={(e) => setGuestsCount(Number(e.target.value))}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">
                Special Notes / Address Pickup
              </label>
              <textarea
                rows={2}
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Mention hotel pickup location or special diet requests..."
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
              />
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
              <EnterpriseButton
                type="button"
                variant="outline"
                onClick={() => setSelectedService(null)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                loading={isSubmitting}
              >
                Confirm & Pay ₹
                {(selectedService.pricing.amount || 500) * guestsCount}
              </EnterpriseButton>
            </div>
          </form>
        )}
      </EnterpriseModal>
    </div>
  );
};

export default ServicesHubPage;
