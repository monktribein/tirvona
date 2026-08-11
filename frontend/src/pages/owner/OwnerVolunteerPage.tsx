import React, { useState, useEffect } from "react";
import {
  Heart,
  Plus,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  Edit,
  Trash2,
  Send,
  MapPin,
  Utensils,
  Home as HomeIcon,
  Sparkles,
} from "lucide-react";
import {
  volunteerService,
  type VolunteerJobItem,
} from "../../services/volunteer.service";
import { ashramService } from "../../services";
import { getErrorMessage } from "../../lib/api";
import { useNotifications } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  EnterpriseModal,
  EnterpriseButton,
  EnterpriseStatusBadge,
  EnterpriseStatsCard,
} from "../../admin/shared";

export const OwnerVolunteerPage: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [jobs, setJobs] = useState<VolunteerJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"openings" | "applications">(
    "openings",
  );

  // Modal State for Create Opening
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("Event Management");
  const [type, setType] = useState("volunteer");
  // City is chosen first, then the ashram within it — the opening belongs to a
  // specific ashram, and `ashramId` is required by the API. The form used to
  // send no id at all and pass the signed-in user's *name* as the ashram name,
  // falling back to a hardcoded "Parmarth Niketan Ashram" when that was blank.
  const [city, setCity] = useState("");
  const [ashramId, setAshramId] = useState("");
  const [cityAshrams, setCityAshrams] = useState<any[]>([]);
  const [loadingAshrams, setLoadingAshrams] = useState(false);
  const [openingsCount, setOpeningsCount] = useState(5);
  const [duration, setDuration] = useState("1 Month");
  const [stipend, setStipend] = useState("Free Ashram Stay + Satvik Meals");
  const [accommodation, setAccommodation] = useState<
    "free_ashram_stay" | "paid" | "none"
  >("free_ashram_stay");
  const [food, setFood] = useState<"satvik_free_3_meals" | "paid" | "none">(
    "satvik_free_3_meals",
  );
  const [responsibilities, setResponsibilities] = useState("");
  const [requirements, setRequirements] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Applications Drawer State
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedJobForApps, setSelectedJobForApps] =
    useState<VolunteerJobItem | null>(null);

  // Scope differs by role and nothing else: the platform sees every ashram,
  // an owner only their own. Mirrors the offers console exactly.
  const isPlatformAdmin = user?.role === "super_admin";
  const [destinations, setDestinations] = useState<any[]>([]);
  const [myAshrams, setMyAshrams] = useState<any[]>([]);

  useEffect(() => {
    fetchOwnerJobs();
    fetchOwnerApplications();
  }, []);

  useEffect(() => {
    const load = isPlatformAdmin
      ? ashramService.destinations().then((res) => {
          setDestinations(res.data?.data || []);
        })
      : ashramService.myListings().then((res) => {
          const rows: any[] = res.data?.data || [];
          setMyAshrams(rows);
          const byCity = new Map<string, any>();
          for (const a of rows) {
            const name = String(a.address?.city || "").trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (byCity.has(key)) byCity.get(key).count += 1;
            else byCity.set(key, { city: name, count: 1 });
          }
          setDestinations(
            [...byCity.values()].sort((a, b) => a.city.localeCompare(b.city)),
          );
        });
    load.catch(() => setDestinations([]));
  }, [isPlatformAdmin]);

  /** Load the ashrams inside a city, and clear any stale selection. */
  const handleCityChange = async (nextCity: string) => {
    setCity(nextCity);
    setAshramId("");
    if (!nextCity) {
      setCityAshrams([]);
      return;
    }
    if (!isPlatformAdmin) {
      setCityAshrams(
        myAshrams.filter(
          (a) =>
            String(a.address?.city || "").toLowerCase() ===
            nextCity.toLowerCase(),
        ),
      );
      return;
    }
    setLoadingAshrams(true);
    try {
      const res = await ashramService.byDestination(nextCity);
      setCityAshrams(res.data?.data || []);
    } catch {
      setCityAshrams([]);
    } finally {
      setLoadingAshrams(false);
    }
  };

  const fetchOwnerJobs = async () => {
    setLoading(true);
    try {
      const res = await volunteerService.getJobs();
      if (res.data?.success) {
        setJobs(res.data.data);
      }
    } catch (err) {
      console.error("Fetch owner jobs error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOwnerApplications = async () => {
    try {
      const res = await volunteerService.getApplications();
      if (res.data?.success) {
        setApplications(res.data.data);
      }
    } catch (err) {
      console.error("Fetch applications error:", err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ashram = cityAshrams.find((a) => a._id === ashramId);
    if (!ashram) {
      addNotification(
        "Validation Error",
        "Choose the city and the ashram this opening belongs to.",
        "error",
      );
      return;
    }
    setIsSaving(true);
    try {
      const resp = await volunteerService.createJob({
        // Both taken from the selected ashram, so the public listing names the
        // place a volunteer would actually report to.
        ashramId: ashram._id,
        ashramName: ashram.name,
        state: ashram.address?.state,
        city,
        title,
        department,
        type,
        openingsCount: Number(openingsCount),
        duration,
        stipend,
        accommodation,
        food,
        responsibilities: responsibilities.split("\n").filter((r) => r.trim()),
        requirements: requirements.split("\n").filter((r) => r.trim()),
        status: "open",
      });

      if (resp.data?.success) {
        addNotification(
          "Opening Published!",
          `${title} is now live on the public Volunteer & Careers page.`,
          "success",
        );
        setIsCreateOpen(false);
        setTitle("");
        setResponsibilities("");
        setRequirements("");
        setCity("");
        setAshramId("");
        setCityAshrams([]);
        fetchOwnerJobs();
      }
    } catch (err) {
      // Surface what the API rejected — a blanket "failed to publish" left an
      // owner with no idea which field was wrong.
      addNotification(
        "Error",
        getErrorMessage(err, "Failed to publish opening."),
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (appId: string, status: string) => {
    try {
      await volunteerService.updateApplicationStatus(appId, status);
      setApplications((prev) =>
        prev.map((app) => (app._id === appId ? { ...app, status } : app)),
      );
      addNotification(
        "Applicant Status Updated",
        `Application marked as ${status.toUpperCase()}.`,
        "success",
      );
    } catch (err) {
      console.error("Update status error:", err);
      addNotification("Error", "Failed to update application status.", "error");
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (
      !window.confirm("Are you sure you want to delete this volunteer opening?")
    )
      return;
    try {
      await volunteerService.deleteJob(id);
      addNotification(
        "Opening Deleted",
        "The job opening has been removed.",
        "info",
      );
      fetchOwnerJobs();
    } catch (err) {
      console.error("Delete job error:", err);
    }
  };

  const stats = {
    activeOpenings: jobs.filter((j) => j.status === "open").length,
    totalApplicants: applications.length,
    shortlisted: applications.filter((a) => a.status === "shortlisted").length,
    accepted: applications.filter((a) => a.status === "accepted").length,
  };

  return (
    <div className="space-y-6 text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-[#E58C28]/15 text-[#E58C28] border border-[#E58C28]/30 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1.5">
              <Heart size={12} /> Ashram Recruitment Module
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white tracking-tight mt-1">
            Volunteer & Careers Management
          </h1>
          <p className="text-xs font-semibold text-gray-400">
            Publish openings, manage applications, and hire devoted volunteers
            for your ashram.
          </p>
        </div>

        <EnterpriseButton
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus size={16} /> Create New Opportunity
        </EnterpriseButton>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <EnterpriseStatsCard
          title="Active Openings"
          value={stats.activeOpenings}
          icon={<Building2 size={20} className="text-[#0A4DA6]" />}
        />
        <EnterpriseStatsCard
          title="Total Applications"
          value={stats.totalApplicants}
          icon={<Users size={20} className="text-[#E58C28]" />}
        />
        <EnterpriseStatsCard
          title="Shortlisted"
          value={stats.shortlisted}
          icon={<Clock size={20} className="text-amber-500" />}
        />
        <EnterpriseStatsCard
          title="Accepted Seva Yatri"
          value={stats.accepted}
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Tab Controls */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("openings")}
          className={`pb-3 text-xs font-black tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === "openings"
              ? "border-[#0A4DA6] text-[#0A4DA6] dark:text-[#E58C28]"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          My Published Openings ({jobs.length})
        </button>

        <button
          onClick={() => setActiveTab("applications")}
          className={`pb-3 text-xs font-black tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === "applications"
              ? "border-[#0A4DA6] text-[#0A4DA6] dark:text-[#E58C28]"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Received Applications ({applications.length})
        </button>
      </div>

      {/* Content Area */}
      {activeTab === "openings" ? (
        loading ? (
          <div className="py-20 text-center text-xs font-black text-gray-400">
            Loading ashram openings...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <div
                key={job._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black tracking-wider text-[#E58C28] bg-[#E58C28]/10 px-2.5 py-0.5 rounded-full border border-[#E58C28]/20">
                        {job.department}
                      </span>
                      <h3 className="text-base font-black text-[#0B192C] dark:text-white mt-1.5">
                        {job.title}
                      </h3>
                    </div>
                    <EnterpriseStatusBadge
                      status={job.status === "open" ? "active" : "pending"}
                    />
                  </div>

                  <div className="text-xs font-extrabold text-gray-500 space-y-1.5">
                    <p className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-[#0A4DA6]" /> {job.city}
                      , {job.state}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <HomeIcon size={13} className="text-emerald-500" />{" "}
                      {job.accommodation === "free_ashram_stay"
                        ? "Free Ashram Stay"
                        : "Paid Stay"}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Utensils size={13} className="text-[#E58C28]" />{" "}
                      {job.food === "satvik_free_3_meals"
                        ? "Free 3 Satvik Meals"
                        : "Meals Provided"}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl p-2.5 text-center">
                    <span className="text-xs font-black text-[#0A4DA6] dark:text-blue-300">
                      {job.stipend}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400">
                    {job.openingsCount} Openings
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteJob(job._id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors cursor-pointer"
                      title="Delete Opening"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Applications Table */
        <div className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl overflow-x-auto">
          <table className="w-full text-left text-xs font-bold">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 tracking-wider text-[10px]">
                <th className="py-3 px-4">Applicant</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">City / Availability</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No applications received yet.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr
                    key={app._id}
                    className="hover:bg-gray-50/50 dark:hover:bg-slate-900/50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-[#0B192C] dark:text-white">
                        {app.applicantName}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {app.education}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{app.email}</div>
                      <div className="text-[10px] text-gray-400">
                        {app.phone}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{app.city}</div>
                      <div className="text-[10px] text-emerald-500">
                        {app.availability}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <EnterpriseStatusBadge
                        status={
                          app.status === "accepted"
                            ? "active"
                            : app.status === "rejected"
                              ? "rejected"
                              : "pending"
                        }
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() =>
                            handleStatusUpdate(app._id, "shortlisted")
                          }
                          className="px-2.5 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-full text-[10px] font-black cursor-pointer"
                        >
                          Shortlist
                        </button>
                        <button
                          onClick={() =>
                            handleStatusUpdate(app._id, "accepted")
                          }
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-full text-[10px] font-black cursor-pointer"
                        >
                          Accept
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Opening Modal */}
      {isCreateOpen && (
        <EnterpriseModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New Volunteer & Career Opportunity"
          subtitle="Publish an opening directly to the public Tirvona Volunteer directory"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Position Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ganga Aarti Seva Coordinator"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Event Management / Kitchen / Digital"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                />
              </div>

              {/* City, then the ashram inside it. The list was a fixed five
                cities regardless of where anything is actually published; it
                is now derived from real ashrams, so a city can never be offered
                with nothing in it. */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  City <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                >
                  <option value="">
                    {destinations.length === 0
                      ? "No published ashrams yet"
                      : "Select a city"}
                  </option>
                  {destinations.map((d) => (
                    <option key={d.city} value={d.city}>
                      {d.city} ({d.count})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Ashram <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={ashramId}
                  disabled={!city || loadingAshrams}
                  onChange={(e) => setAshramId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!city
                      ? "Select a city first"
                      : loadingAshrams
                        ? "Loading ashrams..."
                        : cityAshrams.length === 0
                          ? "No ashrams in this city"
                          : "Select an ashram"}
                  </option>
                  {cityAshrams.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Opportunity Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                >
                  <option value="volunteer">Volunteer Seva</option>
                  <option value="internship">Internship / Fellowship</option>
                  <option value="kitchen_seva">Kitchen Seva</option>
                  <option value="event_coordinator">
                    Ganga Aarti & Events
                  </option>
                  <option value="digital_marketing">Digital Marketing</option>
                  <option value="temple_guide">Pilgrim Guide</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Openings Count
                </label>
                <input
                  type="number"
                  min={1}
                  value={openingsCount}
                  onChange={(e) => setOpeningsCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Stipend / Honorarium
                </label>
                <input
                  type="text"
                  value={stipend}
                  onChange={(e) => setStipend(e.target.value)}
                  placeholder="Honorarium ₹5,000/mo + Free Room"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                Responsibilities (One per line)
              </label>
              <textarea
                rows={3}
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder="Coordinate Aarti seating&#10;Assist devotees&#10;Maintain hall decorum"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold"
              />
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3">
              <EnterpriseButton
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                loading={isSaving}
              >
                <Send size={14} /> Publish Opportunity
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}
    </div>
  );
};

export default OwnerVolunteerPage;
