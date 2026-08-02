import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
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
} from "lucide-react";
import {
  volunteerService,
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
import { useNavigate } from "react-router-dom";
import {
  clearGuestPendingIntent,
  getGuestPendingIntent,
  setGuestPendingIntent,
} from "../utils/guestGate";
import { useProfileAutoFill } from "../hooks/useProfileAutoFill";

export const VolunteerHubPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const autoFill = useProfileAutoFill();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addNotification } = useNotifications();
  const { updateMemoryCategory } = useMemory();

  const [jobs, setJobs] = useState<VolunteerJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || "",
  );
  const [selectedCity, setSelectedCity] = useState(
    searchParams.get("city") || "all",
  );
  const [selectedType, setSelectedType] = useState(
    searchParams.get("type") || "all",
  );
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "newest");
  const [freeStayOnly, setFreeStayOnly] = useState(
    searchParams.get("stay") === "true",
  );
  const [freeMealsOnly, setFreeMealsOnly] = useState(
    searchParams.get("meals") === "true",
  );

  // Application Modal State
  const [selectedJob, setSelectedJob] = useState<VolunteerJobItem | null>(null);

  // Auto-open job modal if returning from login with jobId query param
  useEffect(() => {
    const jobIdParam = searchParams.get("jobId");
    if (jobIdParam && jobs.length > 0) {
      const match = jobs.find((j) => j._id === jobIdParam);
      if (match) setSelectedJob(match);
    }
  }, [searchParams, jobs]);

  const handleApplyClick = (job: VolunteerJobItem) => {
    if (!user) {
      const targetUrl = `/volunteer?jobId=${job._id}`;
      setGuestPendingIntent({
        type: "volunteer_apply",
        returnUrl: targetUrl,
        data: { jobId: job._id },
      });
      navigate(`/login?redirect=${encodeURIComponent(targetUrl)}`);
      return;
    }
    setSelectedJob(job);
  };

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

  useEffect(() => {
    if (!user || jobs.length === 0) return;
    const intent = getGuestPendingIntent();
    if (intent?.type !== "volunteer_apply" || !intent.data) return;
    const job = jobs.find(
      (item) => item._id === String(intent.data?.jobId ?? ""),
    );
    if (!job) return;
    setSelectedJob(job);
    if (intent.data.applicantName)
      setApplicantName(String(intent.data.applicantName));
    if (intent.data.email) setEmail(String(intent.data.email));
    if (intent.data.phone) setPhone(String(intent.data.phone));
    if (intent.data.city) setCity(String(intent.data.city));
    if (intent.data.education) setEducation(String(intent.data.education));
    if (intent.data.skills) setSkills(String(intent.data.skills));
    if (intent.data.languages) setLanguages(String(intent.data.languages));
    if (intent.data.availability)
      setAvailability(String(intent.data.availability));
    if (intent.data.motivation) setMotivation(String(intent.data.motivation));
    clearGuestPendingIntent();
  }, [jobs, user]);

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

  // Smart Auto-Fill profile effect
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

  const cities = [
    "all",
    "Rishikesh",
    "Haridwar",
    "Varanasi",
    "Vrindavan",
    "Ayodhya",
  ];

  const types = [
    { id: "all", label: "All Openings", icon: <Sparkles size={14} /> },
    { id: "volunteer", label: "General Seva", icon: <Heart size={14} /> },
    { id: "internship", label: "Internships", icon: <Briefcase size={14} /> },
    { id: "kitchen_seva", label: "Kitchen Seva", icon: <Utensils size={14} /> },
    {
      id: "event_coordinator",
      label: "Ganga Aarti & Events",
      icon: <Calendar size={14} />,
    },
    {
      id: "digital_marketing",
      label: "Digital Fellowship",
      icon: <Users size={14} />,
    },
    { id: "temple_guide", label: "Pilgrim Guide", icon: <MapPin size={14} /> },
  ];

  useEffect(() => {
    fetchJobs();
  }, [selectedCity, selectedType, freeStayOnly, freeMealsOnly, sortBy]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const paramsObj: Record<string, string> = {};
      if (selectedCity !== "all") paramsObj.city = selectedCity;
      if (selectedType !== "all") paramsObj.type = selectedType;
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
        city: selectedCity,
        type: selectedType,
        search: searchTerm,
        sortBy,
        accommodation: freeStayOnly ? "free_ashram_stay" : undefined,
        food: freeMealsOnly ? "satvik_free_3_meals" : undefined,
      });

      if (res.data?.success) {
        setJobs(res.data.data);
      }
    } catch (err) {
      console.error("Fetch volunteer jobs error:", err);
      addNotification(
        "Load Error",
        "Failed to fetch volunteer openings from MongoDB.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedCity("all");
    setSelectedType("all");
    setSearchTerm("");
    setSortBy("newest");
    setFreeStayOnly(false);
    setFreeMealsOnly(false);
    setSearchParams({});
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    if (!user) {
      const targetUrl = `/volunteer?jobId=${selectedJob._id}`;
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

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-20 text-left">
      {/* Clean Text Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#E58C28]">
            Serve with Devotion, Build Your Career
          </p>
          {/* Decorative Saffron Underline Divider */}
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

      {/* ── 2. Search & Category Filters Bar ── */}
      <section
        id="openings"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-20 space-y-6"
      >
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
                placeholder="Search Ganga Aarti, Yoga Trainer, Kitchen Seva, Graphic Designer, Ashram Manager..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-extrabold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] cursor-pointer"
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

          {/* Type Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
            {types.map((t) => {
              const isActive = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className={`px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/25"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Checkboxes & Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-2 border-t border-gray-100 dark:border-slate-800 font-bold text-gray-500">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={freeStayOnly}
                  onChange={(e) => setFreeStayOnly(e.target.checked)}
                  className="accent-[#0A4DA6] w-4 h-4 rounded"
                />
                <span className="flex items-center gap-1">
                  <HomeIcon size={12} className="text-[#0A4DA6]" /> Free Ashram
                  Stay Included
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={freeMealsOnly}
                  onChange={(e) => setFreeMealsOnly(e.target.checked)}
                  className="accent-[#0A4DA6] w-4 h-4 rounded"
                />
                <span className="flex items-center gap-1">
                  <Utensils size={12} className="text-[#E58C28]" /> 3 Free
                  Satvik Meals
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

        {/* ── 3. Openings Grid ── */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#0A4DA6] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-black text-gray-500">
              Loading verified ashram openings...
            </p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3 shadow-sm">
            <Building2 size={40} className="text-gray-300 mx-auto" />
            <h3 className="text-lg font-black text-[#0B192C] dark:text-white">
              No Openings Found
            </h3>
            <p className="text-xs font-medium text-gray-400">
              Try adjusting your city or opportunity type filters.
            </p>
            <EnterpriseButton
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
            >
              Reset Filters
            </EnterpriseButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <div
                key={job._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-lg hover:shadow-2xl transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center font-black text-sm uppercase">
                        {job.ashramName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#0B192C] dark:text-white group-hover:text-[#0A4DA6] transition-colors line-clamp-1">
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

                  {/* Title & Department */}
                  <div>
                    <Link
                      to={`/volunteer/${job._id}`}
                      className="block group-hover:text-[#0A4DA6] transition-colors"
                    >
                      <h3 className="text-base font-black text-[#0B192C] dark:text-white leading-snug hover:underline">
                        {job.title}
                      </h3>
                    </Link>
                    <span className="inline-block mt-1 px-2.5 py-0.5 bg-blue-50 dark:bg-slate-900 text-[#0A4DA6] border border-blue-100 dark:border-slate-800 rounded-full text-[10px] font-black uppercase tracking-wider">
                      {job.department}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-extrabold text-gray-600 dark:text-gray-300 pt-1">
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900/60 p-2 rounded-xl border border-gray-100 dark:border-slate-800/80">
                      <HomeIcon
                        size={13}
                        className="text-emerald-500 shrink-0"
                      />
                      <span className="truncate">
                        {job.accommodation === "free_ashram_stay"
                          ? "Free Ashram Stay"
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
                      <span className="truncate">{job.duration}</span>
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

                  {/* Stipend Banner */}
                  <div className="bg-[#E58C28]/10 border border-[#E58C28]/25 rounded-2xl p-2.5 text-center">
                    <span className="text-xs font-black text-[#E58C28]">
                      {job.stipend}
                    </span>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <Link
                    to={`/volunteer/${job._id}`}
                    className="text-[11px] font-extrabold text-[#0A4DA6] hover:underline"
                  >
                    View Details →
                  </Link>
                  <EnterpriseButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleApplyClick(job)}
                  >
                    Apply Now
                  </EnterpriseButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Application Modal ── */}
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
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
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
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
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
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
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
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
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
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
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
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
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
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
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
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
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
