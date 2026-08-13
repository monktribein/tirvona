import React, { useState, useEffect } from "react";
import {
  Heart,
  Plus,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
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
  const { addNotification, confirmAction } = useNotifications();

  const [jobs, setJobs] = useState<VolunteerJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"openings" | "applications">(
    "openings",
  );

  // A single form handles create and edit so every role sees the same fields.
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<VolunteerJobItem | null>(null);
  const [viewingJob, setViewingJob] = useState<VolunteerJobItem | null>(null);
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
  const [jobStatus, setJobStatus] = useState<VolunteerJobItem["status"]>("open");
  const [isSaving, setIsSaving] = useState(false);

  // Applications Drawer State
  const [applications, setApplications] = useState<any[]>([]);
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null);
  // Scope differs by role and nothing else: the platform sees every ashram,
  // an owner only their own. Mirrors the offers console exactly.
  const isPlatformAdmin =
    ["super_admin", "ashram_admin", "stay_admin"].includes(user?.role || "") ||
    user?.permissions?.includes("ashrams.manage_all") ||
    (["ashram_owner", "owner"].includes(user?.role || "") &&
      String(user?.name || "").trim().toLowerCase() === "ashram stay admin");
  const [destinations, setDestinations] = useState<any[]>([]);
  const [myAshrams, setMyAshrams] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchOwnerJobs();
    fetchOwnerApplications();
  }, [user?.id, isPlatformAdmin]);

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
      const results = await Promise.allSettled([
        volunteerService.getManagedJobs({ limit: 100 }),
        ...(isPlatformAdmin
          ? [volunteerService.getJobs({ limit: 100 })]
          : []),
      ]);
      const managedResult = results[0];
      const publicResult = results[1];
      const managedRows =
        managedResult?.status === "fulfilled" && managedResult.value.data?.success
          ? managedResult.value.data.data || []
          : [];
      const publicRows =
        publicResult?.status === "fulfilled" && publicResult.value.data?.success
          ? publicResult.value.data.data || []
          : [];
      const uniqueRows = new Map<string, VolunteerJobItem>();
      [...managedRows, ...publicRows].forEach((job: VolunteerJobItem) => {
        if (job?._id) uniqueRows.set(String(job._id), job);
      });
      setJobs([...uniqueRows.values()]);
      if (managedResult?.status === "rejected" && publicRows.length === 0)
        throw managedResult.reason;
    } catch (err) {
      console.error("Fetch owner jobs error:", err);
      addNotification(
        "Opportunities Could Not Be Loaded",
        getErrorMessage(err, "Volunteer opportunities could not be loaded."),
        "error",
      );
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

  const resetForm = () => {
    setEditingJob(null);
    setTitle("");
    setDepartment("Event Management");
    setType("volunteer");
    setCity("");
    setAshramId("");
    setCityAshrams([]);
    setOpeningsCount(5);
    setDuration("1 Month");
    setStipend("Free Ashram Stay + Satvik Meals");
    setAccommodation("free_ashram_stay");
    setFood("satvik_free_3_meals");
    setResponsibilities("");
    setRequirements("");
    setJobStatus("open");
  };

  const closeForm = () => {
    setIsCreateOpen(false);
    resetForm();
  };

  const openCreateForm = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEditForm = async (job: VolunteerJobItem) => {
    setEditingJob(job);
    setTitle(job.title || "");
    setDepartment(job.department || "");
    setType(job.type || "volunteer");
    setOpeningsCount(job.openingsCount || 1);
    setDuration(job.duration || "");
    setStipend(job.stipend || "");
    setAccommodation(job.accommodation || "none");
    setFood(job.food || "none");
    setResponsibilities((job.responsibilities || []).join("\n"));
    setRequirements((job.requirements || []).join("\n"));
    setJobStatus(job.status || "open");
    await handleCityChange(job.city || "");
    setAshramId(String(job.ashramId || ""));
    setViewingJob(null);
    setIsCreateOpen(true);
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
      const payload = {
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
        status: jobStatus,
      };
      const resp = editingJob
        ? await volunteerService.updateJob(editingJob._id, payload)
        : await volunteerService.createJob(payload);

      if (resp.data?.success) {
        addNotification(
          editingJob ? "Opportunity Updated" : "Opening Published!",
          editingJob
            ? `${title} was updated successfully.`
            : `${title} is now live on the public Volunteer & Careers page.`,
          "success",
        );
        closeForm();
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
    const application = applications.find((app) => app._id === appId);
    if (!status || application?.status === status) return;
    setUpdatingApplicationId(appId);
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
      addNotification(
        "Status Update Failed",
        getErrorMessage(err, "Failed to update application status."),
        "error",
      );
    } finally {
      setUpdatingApplicationId(null);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!(await confirmAction({ title: "Delete volunteer opening?", message: "This opening will be removed from the visitor portal.", confirmLabel: "Delete Opening", tone: "danger" }))) return;
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
      addNotification("Delete Failed", getErrorMessage(err, "Could not delete this volunteer opening."), "error");
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
          onClick={openCreateForm}
          icon={<Plus size={16} />}
          className="w-full sm:w-auto"
        >
          Create New Opportunity
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
          {isPlatformAdmin ? "All Published Openings" : "My Published Openings"} ({jobs.length})
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
            {jobs.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3 rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-[#0B192C]">
                <Heart size={28} className="mx-auto text-[#E58C28]" />
                <h3 className="mt-3 text-base font-black text-[#0B192C] dark:text-white">No opportunities published yet</h3>
                <p className="mt-1 text-xs font-semibold text-gray-400">Create the first volunteer or career opportunity for an ashram you manage.</p>
                <EnterpriseButton className="mt-5" icon={<Plus size={14} />} onClick={openCreateForm}>
                  Create Opportunity
                </EnterpriseButton>
              </div>
            )}
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <EnterpriseButton
                      size="sm"
                      variant="ghost"
                      icon={<Eye size={14} />}
                      onClick={() => setViewingJob(job)}
                    >
                      View
                    </EnterpriseButton>
                    <EnterpriseButton
                      size="sm"
                      variant="outline"
                      icon={<Edit size={14} />}
                      onClick={() => void openEditForm(job)}
                    >
                      Edit
                    </EnterpriseButton>
                    <EnterpriseButton
                      size="sm"
                      variant="danger"
                      icon={<Trash2 size={14} />}
                      onClick={() => handleDeleteJob(job._id)}
                    >
                      Delete
                    </EnterpriseButton>
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
                      <EnterpriseStatusBadge status={app.status || "applied"} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {updatingApplicationId === app._id && (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0A4DA6] border-t-transparent" aria-label="Updating status" />
                        )}
                        <select
                          aria-label={`Update status for ${app.applicantName}`}
                          value={app.status || "applied"}
                          disabled={updatingApplicationId === app._id}
                          onChange={(event) => void handleStatusUpdate(app._id, event.target.value)}
                          className="min-h-9 min-w-[142px] cursor-pointer rounded-full border border-gray-200 bg-white px-3 py-2 text-[10px] font-black capitalize text-[#0B192C] outline-none transition focus:border-[#0A4DA6] focus:ring-2 focus:ring-[#0A4DA6]/15 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                          <option value="applied">Applied</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="interviewed">Interviewed</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View / Edit management modal */}
      {viewingJob && (
        <EnterpriseModal
          isOpen={Boolean(viewingJob)}
          onClose={() => setViewingJob(null)}
          title={viewingJob.title}
          subtitle={`${viewingJob.ashramName} · ${viewingJob.city}, ${viewingJob.state || "India"}`}
          icon={<Eye size={18} className="text-[#0A4DA6]" />}
          maxWidth="2xl"
          footer={
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <EnterpriseButton variant="outline" onClick={() => setViewingJob(null)}>
                Close
              </EnterpriseButton>
              <EnterpriseButton icon={<Edit size={14} />} onClick={() => void openEditForm(viewingJob)}>
                Edit Opportunity
              </EnterpriseButton>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ["Department", viewingJob.department],
              ["Opportunity Type", viewingJob.type],
              ["Status", viewingJob.status],
              ["Openings", viewingJob.openingsCount],
              ["Duration", viewingJob.duration || "Not specified"],
              ["Stipend / Benefits", viewingJob.stipend || "Not specified"],
              ["Accommodation", viewingJob.accommodation],
              ["Food", viewingJob.food],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</p>
                <p className="mt-1 font-bold text-[#0B192C] dark:text-white">{String(value)}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-slate-700">
              <h4 className="font-black text-[#0B192C] dark:text-white">Responsibilities</h4>
              <ul className="mt-2 space-y-1 text-gray-600 dark:text-gray-300">
                {(viewingJob.responsibilities?.length ? viewingJob.responsibilities : ["Not specified"]).map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-slate-700">
              <h4 className="font-black text-[#0B192C] dark:text-white">Requirements</h4>
              <ul className="mt-2 space-y-1 text-gray-600 dark:text-gray-300">
                {(viewingJob.requirements?.length ? viewingJob.requirements : ["Not specified"]).map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}
              </ul>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* Create / Edit Opening Modal */}
      {isCreateOpen && (
        <EnterpriseModal
          isOpen={isCreateOpen}
          onClose={closeForm}
          title={editingJob ? "Edit Volunteer & Career Opportunity" : "Create New Volunteer & Career Opportunity"}
          subtitle={editingJob ? "Update the public opportunity and its availability" : "Publish an opening directly to the public Tirvona Volunteer directory"}
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

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select value={jobStatus} onChange={(e) => setJobStatus(e.target.value as VolunteerJobItem["status"])} className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold">
                  <option value="open">Open</option>
                  <option value="closing_soon">Closing Soon</option>
                  <option value="closed">Closed</option>
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

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 1 Month" className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold" />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">Accommodation</label>
                <select value={accommodation} onChange={(e) => setAccommodation(e.target.value as typeof accommodation)} className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold">
                  <option value="free_ashram_stay">Free Ashram Stay</option><option value="paid">Paid Stay</option><option value="none">Not Provided</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">Food</label>
                <select value={food} onChange={(e) => setFood(e.target.value as typeof food)} className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold">
                  <option value="satvik_free_3_meals">Free 3 Satvik Meals</option><option value="paid">Paid Meals</option><option value="none">Not Provided</option>
                </select>
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

            <div>
              <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">Requirements (One per line)</label>
              <textarea rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Relevant experience&#10;Available for the full duration" className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold" />
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <EnterpriseButton
                variant="outline"
                onClick={closeForm}
                className="w-full sm:w-auto"
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                loading={isSaving}
                className="w-full sm:w-auto"
              >
                {editingJob ? <Edit size={14} /> : <Send size={14} />} {editingJob ? "Save Changes" : "Publish Opportunity"}
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}
    </div>
  );
};

export default OwnerVolunteerPage;
