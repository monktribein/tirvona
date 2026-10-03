import React, { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate, useLocation } from "react-router-dom";
import {
  Heart,
  Briefcase,
  MapPin,
  Building2,
  ShieldCheck,
  Search,
  Users,
  Award,
  Utensils,
  Home as HomeIcon,
  Clock,
  Sparkles,
  Send,
  Calendar,
  ArrowLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Lock,
} from "lucide-react";
import {
  volunteerService,
  VOLUNTEER_CATEGORIES,
  getVolunteerCategoryLabel,
  type VolunteerJobItem,
} from "../services/volunteer.service";
import { useNotifications } from "../contexts/NotificationContext";
import { useMemory } from "../contexts/UserMemoryContext";
import {
  EnterpriseModal,
  EnterpriseButton,
  EnterpriseStatusBadge,
  EnterpriseSortDropdown,
  EnterpriseResetButton,
} from "../admin/shared";
import { useAuth } from "../contexts/AuthContext";
import {
  clearGuestPendingIntent,
  getGuestPendingIntent,
  setGuestPendingIntent,
} from "../utils/guestGate";
import { useProfileAutoFill } from "../hooks/useProfileAutoFill";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  volunteer: <Heart className="w-6 h-6 text-[#F28C28]" />,
  internship: <Briefcase className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />,
  kitchen_seva: <Utensils className="w-6 h-6 text-amber-500 dark:text-amber-400" />,
  event_coordinator: <Calendar className="w-6 h-6 text-orange-500 dark:text-orange-400" />,
  digital_marketing: <Users className="w-6 h-6 text-blue-500 dark:text-blue-400" />,
  temple_guide: <MapPin className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />,
};

const CATEGORY_ICONS_SM: Record<string, React.ReactNode> = {
  volunteer: <Heart size={14} />,
  internship: <Briefcase size={14} />,
  kitchen_seva: <Utensils size={14} />,
  event_coordinator: <Calendar size={14} />,
  digital_marketing: <Users size={14} />,
  temple_guide: <MapPin size={14} />,
};

export const VolunteerHubPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const autoFill = useProfileAutoFill();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addNotification } = useNotifications();
  const { updateMemoryCategory } = useMemory();

  const isCareersPath = location.pathname.startsWith("/careers");

  // All jobs loaded on mount to compute category opening counts & cities list
  const [allJobs, setAllJobs] = useState<VolunteerJobItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Active filter state: selectedType is empty string "" by default (Category Choice Step)
  const [selectedType, setSelectedType] = useState<string>(
    searchParams.get("type") || "",
  );
  const [jobs, setJobs] = useState<VolunteerJobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || "",
  );
  const [selectedCity, setSelectedCity] = useState(
    searchParams.get("city") || "all",
  );
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "newest");
  const [freeStayOnly, setFreeStayOnly] = useState(
    searchParams.get("stay") === "true",
  );
  const [freeMealsOnly, setFreeMealsOnly] = useState(
    searchParams.get("meals") === "true",
  );

  const [selectedJob, setSelectedJob] = useState<VolunteerJobItem | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());

  // Form states for application modal
  const [applicantName, setApplicantName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [education, setEducation] = useState("Graduate");
  const [skills, setSkills] = useState("");
  const [languages, setLanguages] = useState("Hindi, English");
  const [availability, setAvailability] = useState("Immediate (Next 7 Days)");
  const [motivation, setMotivation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selectedType when URL parameter changes (e.g. back/forward navigation)
  useEffect(() => {
    const urlType = searchParams.get("type");
    setSelectedType(urlType || "");
  }, [searchParams]);

  // Load all jobs once on mount to get counts for each category
  useEffect(() => {
    let isMounted = true;
    volunteerService
      .getJobs({ limit: 100 })
      .then((res) => {
        if (isMounted && res.data?.success) {
          setAllJobs(res.data.data || []);
        }
      })
      .catch((err) => console.error("Fetch all volunteer jobs error:", err))
      .finally(() => {
        if (isMounted) setInitialLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch applications for logged in user
  useEffect(() => {
    if (!user) {
      setAppliedJobIds(new Set());
      return;
    }
    volunteerService
      .getMyApplications()
      .then((response) => {
        const ids = (response.data?.data || [])
          .filter((application: any) => application.status !== "rejected")
          .map((application: any) =>
            String(application.jobId?._id || application.jobId),
          );
        setAppliedJobIds(new Set(ids));
      })
      .catch(() => setAppliedJobIds(new Set()));
  }, [user]);

  // Handle direct job modal opening via URL parameter
  useEffect(() => {
    const jobIdParam = searchParams.get("jobId");
    if (jobIdParam && (jobs.length > 0 || allJobs.length > 0)) {
      const match = (jobs.length > 0 ? jobs : allJobs).find(
        (j) => j._id === jobIdParam,
      );
      if (match) setSelectedJob(match);
    }
  }, [searchParams, jobs, allJobs]);

  // Preserve guest intent if unauthorized
  useEffect(() => {
    const preserveOpenApplication = () => {
      if (!selectedJob) return;
      const returnUrl = `/volunteer?jobId=${selectedJob._id}`;
      setGuestPendingIntent({
        type: "volunteer_apply",
        returnUrl,
        data: {
          jobId: selectedJob._id,
          applicantName,
          email,
          phone,
          city,
          education,
          skills,
          languages,
          availability,
          motivation,
        },
      });
    };
    window.addEventListener("tirvona:unauthorized", preserveOpenApplication);
    return () =>
      window.removeEventListener(
        "tirvona:unauthorized",
        preserveOpenApplication,
      );
  }, [
    applicantName,
    availability,
    city,
    education,
    email,
    languages,
    motivation,
    phone,
    selectedJob,
    skills,
  ]);

  // Autofill user details
  useEffect(() => {
    if (autoFill.isLoggedIn) {
      if (autoFill.name && !applicantName) setApplicantName(autoFill.name);
      if (autoFill.email && !email) setEmail(autoFill.email);
      if (autoFill.phone && !phone) setPhone(autoFill.phone);
      if (autoFill.city && !city) setCity(autoFill.city);
      if (autoFill.education) setEducation(autoFill.education);
      if (autoFill.skills && !skills) setSkills(autoFill.skills);
    }
  }, [autoFill]);

  // Compute opening counts per category
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    VOLUNTEER_CATEGORIES.forEach((cat) => {
      counts[cat.id] = allJobs.filter((j) => j.type === cat.id).length;
    });
    return counts;
  }, [allJobs]);

  // Compute unique cities
  const cities = React.useMemo(() => {
    const set = new Set<string>();
    const list = allJobs.length > 0 ? allJobs : jobs;
    list.forEach((j: any) => {
      const c = j.location?.city || j.city;
      if (c) set.add(c);
    });
    return ["all", ...Array.from(set)];
  }, [allJobs, jobs]);

  // Fetch jobs whenever selectedType or filters change
  useEffect(() => {
    if (selectedType) {
      fetchJobs();
    }
  }, [selectedCity, selectedType, freeStayOnly, freeMealsOnly, sortBy]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const paramsObj: Record<string, string> = {};
      if (selectedType && selectedType !== "all") paramsObj.type = selectedType;
      else if (selectedType === "all") paramsObj.type = "all";
      if (selectedCity !== "all") paramsObj.city = selectedCity;
      if (searchTerm) paramsObj.search = searchTerm;
      if (sortBy) paramsObj.sort = sortBy;
      if (freeStayOnly) paramsObj.stay = "true";
      if (freeMealsOnly) paramsObj.meals = "true";
      setSearchParams(paramsObj);

      updateMemoryCategory("filters", {
        volunteerCity: selectedCity,
        volunteerType: selectedType,
        volunteerSearch: searchTerm,
        volunteerSort: sortBy,
      });

      const res = await volunteerService.getJobs({
        city: selectedCity !== "all" ? selectedCity : undefined,
        type: selectedType !== "all" ? selectedType : undefined,
        search: searchTerm || undefined,
        sortBy,
        accommodation: freeStayOnly ? "free_ashram_stay" : undefined,
        food: freeMealsOnly ? "satvik_free_3_meals" : undefined,
      });

      if (res.data?.success) {
        setJobs(res.data.data || []);
      }
    } catch (err) {
      console.error("Fetch volunteer jobs error:", err);
      addNotification(
        "Load Error",
        "Failed to fetch openings for this category.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  // Category selection handler
  const handleSelectCategory = (categoryId: string) => {
    setSelectedType(categoryId);
    const newParams = new URLSearchParams(searchParams);
    if (categoryId && categoryId !== "all") {
      newParams.set("type", categoryId);
    } else if (categoryId === "all") {
      newParams.set("type", "all");
    } else {
      newParams.delete("type");
    }
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Back to category choice handler
  const handleBackToCategories = () => {
    setSelectedType("");
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("type");
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleResetFilters = () => {
    setSelectedCity("all");
    setSearchTerm("");
    setSortBy("newest");
    setFreeStayOnly(false);
    setFreeMealsOnly(false);
    const paramsObj: Record<string, string> = {};
    if (selectedType) paramsObj.type = selectedType;
    setSearchParams(paramsObj);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  const handleApplyClick = (job: VolunteerJobItem) => {
    if (!user) {
      const targetUrl = `/volunteer?jobId=${job._id}&type=${job.type || "volunteer"}`;
      setGuestPendingIntent({
        type: "volunteer_apply",
        returnUrl: targetUrl,
        data: { jobId: job._id },
      });
      navigate(`/login?redirect=${encodeURIComponent(targetUrl)}`);
      return;
    }
    if (appliedJobIds.has(job._id)) {
      navigate("/profile/volunteer");
      return;
    }
    setSelectedJob(job);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    if (!user) {
      const targetUrl = `/volunteer?jobId=${selectedJob._id}&type=${selectedJob.type || "volunteer"}`;
      setGuestPendingIntent({
        type: "volunteer_apply",
        returnUrl: targetUrl,
        data: {
          jobId: selectedJob._id,
          applicantName,
          email,
          phone,
          city,
          education,
          skills,
          languages,
          availability,
          motivation,
        },
      });
      navigate(`/login?redirect=${encodeURIComponent(targetUrl)}`);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await volunteerService.applyJob({
        jobId: selectedJob._id,
        applicantName,
        email,
        phone,
        city,
        education,
        skills,
        languages,
        availability,
        motivation,
      });

      if (res.data?.success) {
        addNotification(
          "Application Submitted!",
          `Your application for ${selectedJob.title} at ${selectedJob.ashramName} has been received!`,
          "success",
        );
        setSelectedJob(null);
        setApplicantName("");
        setEmail("");
        setPhone("");
        setCity("");
        setMotivation("");
        setAppliedJobIds((current) => new Set(current).add(selectedJob._id));
      }
    } catch (err) {
      console.error("Application submit error:", err);
      addNotification(
        "Submission Error",
        "Failed to submit application. Please try again.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCategory = VOLUNTEER_CATEGORIES.find((c) => c.id === selectedType);
  const activeCategoryLabel = activeCategory
    ? activeCategory.label
    : selectedType === "all"
      ? "All Openings"
      : "Job Openings";

  return (
    <div className="min-h-screen pb-20 text-left">
      {/* Top Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#E58C28]">
            {isCareersPath ? "Career & Seva Opportunities" : "Serve with Devotion, Build Your Career"}
          </p>
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Explore volunteer opportunities, internships, Ganga Aarti seva,
            digital fellowships, kitchen management, and temple careers across
            Rishikesh, Haridwar, Varanasi, Vrindavan, and Ayodhya.
          </p>
        </div>
      </div>

      {/* STEP 1: CATEGORY SELECTION VIEW (when no category is selected) */}
      {!selectedType ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-20 space-y-6">
          <div className="text-center space-y-1.5 max-w-2xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0B192C] dark:text-white">
              Select Your Job Category
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Please choose a field below to view available openings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
            {VOLUNTEER_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.id] ?? 0;
              return (
                <div
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.id)}
                  className="group bg-white dark:bg-[#0B192C] border border-gray-150 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-[#F28C28]/40 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Top small rounded square icon */}
                    <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-rose-500 flex items-center justify-center mb-3 shadow-xs">
                      {CATEGORY_ICONS_SM[cat.id] || <Heart size={16} />}
                    </div>

                    {/* Title (blue text when positions > 0, matching the user reference image) */}
                    <h3
                      className={`text-sm sm:text-[15px] font-bold leading-snug line-clamp-1 mb-2.5 transition-colors ${
                        count > 0
                          ? "text-[#1E40AF] dark:text-blue-400 group-hover:text-[#F28C28]"
                          : "text-gray-900 dark:text-gray-100 group-hover:text-[#F28C28]"
                      }`}
                    >
                      {cat.label}
                    </h3>

                    {/* Open Positions Pill Badge */}
                    <div>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          count > 0
                            ? "bg-[#EAF8E7] dark:bg-emerald-950/40 text-[#3FA72F] dark:text-emerald-400 font-bold"
                            : "bg-[#F1F3F6] dark:bg-slate-800 text-[#9CA3AF] dark:text-gray-400"
                        }`}
                      >
                        {count} Open {count === 1 ? "Position" : "Positions"}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action / Status (View Jobs → vs No current positions 🔒) */}
                  <div className="mt-4 pt-1 text-xs">
                    {count > 0 ? (
                      <span className="font-bold text-gray-900 dark:text-white group-hover:text-[#F28C28] flex items-center gap-1 transition-colors">
                        View Jobs <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF] dark:text-gray-500 font-medium flex items-center gap-1.5 text-[11px]">
                        No current positions <Lock size={12} className="text-gray-300 dark:text-gray-600" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Discreet option to view all openings */}
          <div className="pt-2 text-center">
            <button
              onClick={() => handleSelectCategory("all")}
              className="text-xs font-bold text-gray-500 hover:text-[#F28C28] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              Or browse all openings across all categories ({allJobs.length}) →
            </button>
          </div>
        </section>
      ) : (
        /* STEP 2: OPENINGS LIST FOR THE SELECTED CATEGORY */
        <section
          id="openings"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-20 space-y-6"
        >
          {/* Active Field Header & Back Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleBackToCategories}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-[#0B192C] dark:text-white hover:border-[#F28C28] hover:text-[#F28C28] shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeft size={14} className="text-[#F28C28]" /> Change Category
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">Selected Field:</span>
                <span className="text-xs font-black text-[#F28C28] bg-[#F28C28]/10 px-3 py-1 rounded-full border border-[#F28C28]/25 flex items-center gap-1.5">
                  {CATEGORY_ICONS_SM[selectedType] || <Sparkles size={13} />}
                  {activeCategoryLabel}
                </span>
              </div>
            </div>

            <span className="text-xs font-extrabold text-gray-500">
              {loading
                ? "Loading openings..."
                : `${jobs.length} ${jobs.length === 1 ? "Opening" : "Openings"} Available`}
            </span>
          </div>

          {/* Search, Filter & Quick Category Switcher */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4 sm:p-5 shadow-xl space-y-4">
            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-grow">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    selectedType === "all"
                      ? "Search Ganga Aarti, Yoga Trainer, Kitchen Seva, Media, Stay Manager..."
                      : `Search in ${activeCategoryLabel}...`
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-bold focus:outline-none focus:border-[#F28C28]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-extrabold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28] cursor-pointer"
                >
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c === "all" ? "All Holy Cities" : `City: ${c}`}
                    </option>
                  ))}
                </select>

                <EnterpriseButton
                  type="submit"
                  variant="primary"
                  className="px-6 py-2.5 text-xs shrink-0"
                >
                  Search
                </EnterpriseButton>
              </div>
            </form>

            {/* Quick Category Switcher Pills (Exact same categories from Stay Owner upload) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
              <button
                onClick={() => handleSelectCategory("all")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                  selectedType === "all"
                    ? "bg-[#F28C28] text-white shadow-md shadow-[#F28C28]/25"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                <Sparkles size={13} />
                <span>All Fields</span>
              </button>
              {VOLUNTEER_CATEGORIES.map((cat) => {
                const isActive = selectedType === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#F28C28] text-white shadow-md shadow-[#F28C28]/25"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                    }`}
                  >
                    {CATEGORY_ICONS_SM[cat.id]}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-2 border-t border-gray-100 dark:border-slate-800 font-bold text-gray-500">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={freeStayOnly}
                    onChange={(e) => setFreeStayOnly(e.target.checked)}
                    className="accent-[#F28C28] w-4 h-4 rounded"
                  />
                  <span className="flex items-center gap-1">
                    <HomeIcon size={12} className="text-[#F28C28]" /> Free Stay Included
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={freeMealsOnly}
                    onChange={(e) => setFreeMealsOnly(e.target.checked)}
                    className="accent-[#F28C28] w-4 h-4 rounded"
                  />
                  <span className="flex items-center gap-1">
                    <Utensils size={12} className="text-[#E58C28]" /> 3 Free Satvik Meals
                  </span>
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

          {/* Results State */}
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-[#F28C28] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-black text-gray-500">
                Loading verified stay openings in {activeCategoryLabel}...
              </p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
              <Building2 size={44} className="text-gray-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-black text-[#0B192C] dark:text-white">
                  No Openings in {activeCategoryLabel}
                </h3>
                <p className="text-xs font-medium text-gray-400 max-w-md mx-auto">
                  There are currently no active openings matching your filters in this category. You can choose another category or reset your filters.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <EnterpriseButton
                  variant="primary"
                  size="sm"
                  onClick={handleBackToCategories}
                >
                  ← Choose Another Category
                </EnterpriseButton>
                <EnterpriseButton
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </EnterpriseButton>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((job) => (
                <div
                  key={job._id}
                  className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-lg hover:shadow-2xl transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#F28C28]/10 text-[#F28C28] flex items-center justify-center font-black text-sm">
                          {job.ashramName ? job.ashramName.charAt(0) : "S"}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-[#0B192C] dark:text-white group-hover:text-[#F28C28] transition-colors line-clamp-1">
                            {job.ashramName}
                          </h4>
                          <span className="text-[10px] font-extrabold text-gray-400 flex items-center gap-1">
                            <MapPin size={10} className="text-[#E58C28]" />{" "}
                            {job.city}, {job.state}
                          </span>
                        </div>
                      </div>

                      <EnterpriseStatusBadge
                        status={job.status === "open" ? "active" : "pending"}
                      />
                    </div>

                    <div>
                      <Link
                        to={`/volunteer/${job._id}`}
                        className="block group-hover:text-[#F28C28] transition-colors"
                      >
                        <h3 className="text-base font-black text-[#0B192C] dark:text-white leading-snug hover:underline">
                          {job.title}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="inline-block px-2.5 py-0.5 bg-blue-50 dark:bg-slate-900 text-[#F28C28] border border-blue-100 dark:border-slate-800 rounded-full text-[10px] font-black tracking-wider">
                          {getVolunteerCategoryLabel(job.type)}
                        </span>
                        {job.department && job.department !== getVolunteerCategoryLabel(job.type) && (
                          <span className="inline-block px-2 py-0.5 bg-gray-50 dark:bg-slate-850 text-gray-500 rounded-full text-[10px] font-bold">
                            {job.department}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-extrabold text-gray-600 dark:text-gray-300 pt-1">
                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900/60 p-2 rounded-xl border border-gray-100 dark:border-slate-800/80">
                        <HomeIcon
                          size={13}
                          className="text-emerald-500 shrink-0"
                        />
                        <span className="truncate">
                          {job.accommodation === "free_ashram_stay"
                            ? "Free Stay"
                            : "Stay Option"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900/60 p-2 rounded-xl border border-gray-100 dark:border-slate-800/80">
                        <Utensils size={13} className="text-[#E58C28] shrink-0" />
                        <span className="truncate">
                          {job.food === "satvik_free_3_meals"
                            ? "Free 3 Satvik Meals"
                            : "Meals Provided"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900/60 p-2 rounded-xl border border-gray-100 dark:border-slate-800/80">
                        <Clock size={13} className="text-blue-500 shrink-0" />
                        <span className="truncate">{job.duration || "Flexible Duration"}</span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900/60 p-2 rounded-xl border border-gray-100 dark:border-slate-800/80">
                        <Award size={13} className="text-amber-500 shrink-0" />
                        <span className="truncate">
                          {job.certificateProvided
                            ? "Cert. Included"
                            : "Experience"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#E58C28]/10 border border-[#E58C28]/25 rounded-2xl p-2.5 text-center">
                      <span className="text-xs font-black text-[#E58C28]">
                        {job.stipend || "Free Ashram Stay + Satvik Meals"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <Link
                      to={`/volunteer/${job._id}`}
                      className="text-[11px] font-extrabold text-[#F28C28] hover:underline"
                    >
                      View Details →
                    </Link>
                    <EnterpriseButton
                      variant={appliedJobIds.has(job._id) ? "success" : "primary"}
                      size="sm"
                      onClick={() => handleApplyClick(job)}
                    >
                      {appliedJobIds.has(job._id) ? "Already Applied" : "Apply Now"}
                    </EnterpriseButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Application Submission Modal */}
      {selectedJob && (
        <EnterpriseModal
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          title={`Apply for ${selectedJob.title}`}
          subtitle={`${selectedJob.ashramName} — ${selectedJob.city}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleApplySubmit} className="space-y-4 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#F28C28]"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#F28C28]"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Mobile Phone
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#F28C28]"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Current City
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Delhi / Lucknow / Rishikesh"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#F28C28]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Education
                </label>
                <select
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#F28C28]"
                >
                  <option value="High School">High School</option>
                  <option value="Undergraduate">Undergraduate</option>
                  <option value="Graduate">Graduate</option>
                  <option value="Post Graduate">Post Graduate</option>
                  <option value="Yoga Certification">
                    Yoga Certification (YTT)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Earliest Availability
                </label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#F28C28]"
                >
                  <option value="Immediate (Next 7 Days)">
                    Immediate (Next 7 Days)
                  </option>
                  <option value="Within 15 Days">Within 15 Days</option>
                  <option value="Next Month">Next Month</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                Skills & Experience
              </label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Yoga, Ganga Aarti management, Photography, Kitchen Seva..."
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#F28C28]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                Why do you want to join this Ashram Seva?
              </label>
              <textarea
                required
                rows={3}
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Share your spiritual motivation and desire to serve..."
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#F28C28]"
              />
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <EnterpriseButton
                variant="outline"
                onClick={() => setSelectedJob(null)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                loading={isSubmitting}
                icon={<Send size={14} />}
                className="px-5"
              >
                Submit Application
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}
    </div>
  );
};

export default VolunteerHubPage;
