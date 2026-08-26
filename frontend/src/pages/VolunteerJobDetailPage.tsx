import React, { useState, useEffect } from "react";
import { ashramUrl } from "../lib/urls";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  MapPin,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Users,
  Award,
  Utensils,
  Home as HomeIcon,
  Clock,
  ArrowRight,
  Send,
  ChevronLeft,
  Phone,
  Mail,
  User,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  volunteerService,
  type VolunteerJobItem,
} from "../services/volunteer.service";
import { SUPPORT_CONFIG } from "../constants/support";
import { useNotifications } from "../contexts/NotificationContext";
import { useAuth } from "../contexts/AuthContext";
import {
  clearGuestPendingIntent,
  getGuestPendingIntent,
  setGuestPendingIntent,
} from "../utils/guestGate";
import { useProfileAutoFill } from "../hooks/useProfileAutoFill";
import { EnterpriseModal, EnterpriseButton } from "../admin/shared";

export const VolunteerJobDetailPage: React.FC = () => {
  const { jobSlug, jobId: legacyJobId } = useParams<{
    jobSlug?: string;
    jobId?: string;
  }>();
  const jobId = jobSlug || legacyJobId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const autoFill = useProfileAutoFill();
  const { addNotification } = useNotifications();

  const [job, setJob] = useState<VolunteerJobItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
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
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [checkingApplication, setCheckingApplication] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    if (jobId) {
      fetchJobDetails(jobId);
    }
  }, [jobId]);

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

  const fetchJobDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await volunteerService.getJobById(id);
      if (res.data?.success && res.data.data) {
        setJob(res.data.data);
      } else {
        setError("Volunteer opportunity details could not be found.");
      }
    } catch (err) {
      console.error("Fetch job details error:", err);
      setError("Failed to load volunteer opening details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = () => {
    if (!job) return;
    if (alreadyApplied) {
      navigate("/profile/volunteer");
      return;
    }
    if (!user) {
      const targetUrl = `/volunteer/${job._id}`;
      setGuestPendingIntent({
        type: "volunteer_apply",
        returnUrl: targetUrl,
        data: { jobId: job._id },
      });
      navigate(`/login?redirect=${encodeURIComponent(targetUrl)}`);
      return;
    }
    setIsApplyModalOpen(true);
  };

  useEffect(() => {
    if (!user || !job) {
      setAlreadyApplied(false);
      return;
    }
    setCheckingApplication(true);
    volunteerService
      .getMyApplications({ jobId: job._id })
      .then((response) =>
        setAlreadyApplied(
          (response.data?.data || []).some(
            (application: any) => application.status !== "rejected",
          ),
        ),
      )
      .catch(() => setAlreadyApplied(false))
      .finally(() => setCheckingApplication(false));
  }, [job, user]);

  useEffect(() => {
    if (!user || !job) return;
    const intent = getGuestPendingIntent();
    if (
      intent?.type !== "volunteer_apply" ||
      String(intent.data?.jobId ?? "") !== job._id
    )
      return;
    const data = intent.data ?? {};
    if (data.applicantName) setApplicantName(String(data.applicantName));
    if (data.email) setEmail(String(data.email));
    if (data.phone) setPhone(String(data.phone));
    if (data.city) setCity(String(data.city));
    if (data.education) setEducation(String(data.education));
    if (data.skills) setSkills(String(data.skills));
    if (data.languages) setLanguages(String(data.languages));
    if (data.availability) setAvailability(String(data.availability));
    if (data.motivation) setMotivation(String(data.motivation));
    setIsApplyModalOpen(true);
    clearGuestPendingIntent();
  }, [job, user]);

  useEffect(() => {
    const preserveOpenApplication = () => {
      if (!job || !isApplyModalOpen) return;
      setGuestPendingIntent({
        type: "volunteer_apply",
        returnUrl: `/volunteer/${job._id}`,
        data: {
          jobId: job._id,
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
    isApplyModalOpen,
    job,
    languages,
    motivation,
    phone,
    skills,
  ]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    if (!user) {
      const targetUrl = `/volunteer/${job._id}`;
      setGuestPendingIntent({
        type: "volunteer_apply",
        returnUrl: targetUrl,
        data: {
          jobId: job._id,
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
        jobId: job._id,
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
          `Your application for ${job.title} at ${job.ashramName} has been received successfully!`,
          "success",
        );
        setIsApplyModalOpen(false);
        setMotivation("");
        setAlreadyApplied(true);
      }
    } catch (err) {
      console.error("Application submission error:", err);
      addNotification(
        "Submission Error",
        "Failed to submit application. Please try again.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-28 pb-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#0A4DA6] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-gray-500 animate-pulse">
          Loading Volunteer Opportunity Details...
        </p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen pt-28 pb-20 max-w-4xl mx-auto px-4 text-center space-y-6">
        <div className="p-8 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
          <AlertCircle size={48} className="text-rose-500 mx-auto" />
          <h2 className="text-xl font-extrabold text-[#0B192C] dark:text-white">
            Opportunity Not Found
          </h2>
          <p className="text-xs font-medium text-gray-500">
            {error || "This volunteer position is no longer active."}
          </p>
          <Link
            to="/volunteer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A4DA6] text-white text-xs font-extrabold rounded-full hover:bg-[#083b80] transition-colors"
          >
            <ChevronLeft size={14} /> Back to Volunteer Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 pt-4 text-left sm:pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 sm:p-8 shadow-lg space-y-6 relative overflow-hidden">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-blue-50 dark:bg-slate-850 text-[#0A4DA6] dark:text-blue-400 rounded-full text-xs font-black tracking-wider">
                  {job.department}
                </span>
                {job.isGovtVerified && (
                  <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-full text-xs font-bold flex items-center gap-1">
                    <ShieldCheck size={13} /> Tirvona Verified Seva
                  </span>
                )}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    job.status === "open"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {job.status === "open"
                    ? "● Accepting Applications"
                    : "● Closing Soon"}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white leading-tight">
                {job.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-1.5">
                  <Building2 size={16} className="text-[#0A4DA6]" />
                  <span className="text-[#0B192C] dark:text-white font-black">
                    {job.ashramName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={16} className="text-rose-500" />
                  <span>
                    {job.city}, {job.state}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shrink-0 flex flex-col items-center justify-center space-y-3 text-center md:w-64">
              <div className="text-center">
                <span className="text-[10px] font-extrabold text-gray-400 block">
                  Stipend & Honorarium
                </span>
                <span className="text-base font-black text-[#E58C28]">
                  {job.stipend}
                </span>
              </div>

              <button
                type="button"
                onClick={handleApplyClick}
                disabled={checkingApplication}
                className={`w-full py-3 px-6 text-white font-black rounded-full text-xs shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-60 ${alreadyApplied ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" : "bg-[#0A4DA6] hover:bg-[#083b80] shadow-[#0A4DA6]/25"}`}
              >
                {checkingApplication ? "Checking..." : alreadyApplied ? "Already Applied" : "Apply for Seva"} <ArrowRight size={14} />
              </button>

              <span className="text-[10px] font-bold text-gray-400">
                {job.openingsCount} Openings Available
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100 dark:border-slate-800 text-xs font-bold text-gray-700 dark:text-gray-200">
            <div className="p-3 bg-gray-50/80 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center gap-2.5">
              <HomeIcon size={18} className="text-emerald-500 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold block">
                  Accommodation
                </span>
                <span className="font-extrabold">
                  {job.accommodation === "free_ashram_stay"
                    ? "Free Ashram Stay"
                    : "Paid Stay Option"}
                </span>
              </div>
            </div>

            <div className="p-3 bg-gray-50/80 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center gap-2.5">
              <Utensils size={18} className="text-[#E58C28] shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold block">
                  Meals Provided
                </span>
                <span className="font-extrabold">
                  {job.food === "satvik_free_3_meals"
                    ? "3 Free Satvik Meals"
                    : "Meals Included"}
                </span>
              </div>
            </div>

            <div className="p-3 bg-gray-50/80 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center gap-2.5">
              <Clock size={18} className="text-blue-500 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold block">
                  Duration
                </span>
                <span className="font-extrabold">{job.duration}</span>
              </div>
            </div>

            <div className="p-3 bg-gray-50/80 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center gap-2.5">
              <Award size={18} className="text-amber-500 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold block">
                  Certificate
                </span>
                <span className="font-extrabold">
                  {job.certificateProvided
                    ? "Official Cert. Included"
                    : "Experience Certificate"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-4 shadow-sm">
              <h3 className="text-sm font-extrabold tracking-wider text-[#0A4DA6]">
                About This Seva Opportunity
              </h3>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 leading-relaxed">
                Join {job.ashramName} in {job.city} for dedicated service as a{" "}
                <strong>{job.title}</strong>. This opportunity allows pilgrims
                and spiritual seekers to contribute to ashram operations, event
                management, and guest welfare while experiencing authentic
                spiritual ashram living with full accommodation and Satvik
                meals.
              </p>
            </div>

            {job.responsibilities && job.responsibilities.length > 0 && (
              <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-extrabold tracking-wider text-[#0A4DA6] flex items-center gap-2">
                  <CheckCircle2 size={16} /> Key Responsibilities & Duties
                </h3>
                <ul className="space-y-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                  {job.responsibilities.map((resp, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {job.requirements && job.requirements.length > 0 && (
              <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-extrabold tracking-wider text-[#0A4DA6] flex items-center gap-2">
                  <Users size={16} /> Eligibility & Requirements
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium text-gray-600 dark:text-gray-300">
                  {job.requirements.map((req, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-100 dark:border-slate-800 flex items-center gap-2"
                    >
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>{req}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {job.benefits && job.benefits.length > 0 && (
              <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-extrabold tracking-wider text-[#0A4DA6] flex items-center gap-2">
                  <Award size={16} /> Volunteer Benefits & Experience
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium text-gray-600 dark:text-gray-300">
                  {job.benefits.map((ben, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center text-emerald-800 dark:text-emerald-300"
                    >
                      <span className="font-bold">{ben}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-5 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-[#0A4DA6]" />
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2">
                <Send size={16} className="text-[#0A4DA6]" /> Ready to Offer
                Seva?
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                Submit your application directly to {job.ashramName}. Your
                profile will be reviewed by the Ashram administrator.
              </p>

              <button
                type="button"
                onClick={handleApplyClick}
                disabled={checkingApplication}
                className={`w-full py-3.5 text-white font-black rounded-full text-xs shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-60 ${alreadyApplied ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" : "bg-[#0A4DA6] hover:bg-[#083b80] shadow-[#0A4DA6]/25"}`}
              >
                {checkingApplication ? "Checking..." : alreadyApplied ? "View My Application" : "Apply Now"} <ArrowRight size={14} />
              </button>

              <div className="pt-3 border-t border-gray-100 dark:border-slate-800 space-y-2 text-[11px] font-bold text-gray-500">
                <div className="flex justify-between">
                  <span>Openings:</span>
                  <span className="text-[#0B192C] dark:text-white font-black">
                    {job.openingsCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Application Deadline:</span>
                  <span className="text-[#0B192C] dark:text-white font-black">
                    {job.deadline
                      ? new Date(job.deadline).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Open"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-4">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2">
                <Building2 size={16} className="text-[#0A4DA6]" /> Ashram
                Contact Office
              </h3>

              <div className="space-y-3 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2.5">
                  <User size={14} className="text-[#0A4DA6] shrink-0" />
                  <span>
                    {job.contactPerson?.name || "Ashram Seva Administrator"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone size={14} className="text-emerald-500 shrink-0" />
                  <span>{job.contactPerson?.phone || SUPPORT_CONFIG.phone}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail size={14} className="text-blue-500 shrink-0" />
                  <span className="truncate">
                    {job.contactPerson?.email || "seva@tirvona.com"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin size={14} className="text-rose-500 shrink-0" />
                  <span>
                    {job.ashramName}, {job.city}, {job.state}
                  </span>
                </div>
              </div>

              <Link
                to={ashramUrl(job.ashramId)}
                className="inline-block w-full py-2.5 text-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-[#0A4DA6] text-xs font-black rounded-full hover:bg-gray-100 dark:hover:bg-slate-850 transition-colors"
              >
                View Ashram Profile →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {isApplyModalOpen && (
        <EnterpriseModal
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          title={`Apply for ${job.title}`}
          subtitle={`${job.ashramName} — ${job.city}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleApplySubmit} className="space-y-4 text-left">
            <div className="p-3 bg-blue-50/70 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 rounded-2xl text-xs font-bold text-[#0A4DA6] flex items-center justify-between">
              <span>
                Applying for Job ID:{" "}
                <code className="font-mono">{job._id}</code>
              </span>
              <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full">
                {job.department}
              </span>
            </div>

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
                  placeholder="Delhi / Rishikesh / Varanasi"
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
                Skills & Relevant Experience
              </label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Yoga, Photography, Kitchen Seva, Event Management..."
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                Why do you want to offer Seva for this specific role?
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
                onClick={() => setIsApplyModalOpen(false)}
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

export default VolunteerJobDetailPage;
