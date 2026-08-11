import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Clock3,
  Loader2,
  MapPin,
} from "lucide-react";
import {
  volunteerService,
  type VolunteerApplicationItem,
  type VolunteerJobItem,
} from "../../services/volunteer.service";

const statusStyle: Record<string, string> = {
  applied: "bg-blue-50 text-[#0A4DA6] border-blue-100",
  shortlisted: "bg-amber-50 text-amber-700 border-amber-100",
  interviewed: "bg-purple-50 text-purple-700 border-purple-100",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-100",
  rejected: "bg-rose-50 text-rose-700 border-rose-100",
};

const label = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export function VolunteerApplicationsTab() {
  const [rows, setRows] = useState<VolunteerApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    volunteerService
      .getMyApplications()
      .then((response) => setRows(response.data?.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-[#0B192C] dark:text-white">
          My Volunteer Applications
        </h2>
        <p className="text-xs font-medium text-gray-400">
          Follow every seva application and its latest review status.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-[28px] border border-gray-100 bg-white dark:border-slate-800 dark:bg-[#0B192C]">
          <Loader2 className="animate-spin text-[#0A4DA6]" size={24} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[28px] border border-gray-100 bg-white p-8 text-center shadow-md dark:border-slate-800 dark:bg-[#0B192C]">
          <BriefcaseBusiness className="mx-auto text-[#0A4DA6]" size={32} />
          <h3 className="mt-3 text-sm font-black text-[#0B192C] dark:text-white">
            No volunteer applications yet
          </h3>
          <p className="mt-1 text-xs text-gray-400">
            Explore meaningful seva opportunities across Tirvona ashrams.
          </p>
          <Link
            to="/volunteer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0A4DA6] px-5 py-2.5 text-xs font-black text-white"
          >
            Explore Opportunities <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((application) => {
            const job =
              typeof application.jobId === "object"
                ? (application.jobId as VolunteerJobItem)
                : null;
            const jobId = job?._id || String(application.jobId);
            return (
              <Link
                key={application._id}
                to={`/volunteer/${jobId}`}
                className="group block rounded-[24px] border border-gray-100 bg-white p-5 shadow-md transition-all hover:-translate-y-0.5 hover:border-[#E58C28]/50 hover:shadow-lg dark:border-slate-800 dark:bg-[#0B192C]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusStyle[application.status] || statusStyle.applied}`}>
                        {label(application.status)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                        <CalendarDays size={12} /> Applied {new Date(application.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <h3 className="truncate text-base font-black text-[#0B192C] dark:text-white">
                      {job?.title || "Volunteer opportunity"}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-gray-500">
                      <span className="flex items-center gap-1"><Building2 size={13} className="text-[#0A4DA6]" /> {job?.ashramName || "Tirvona Ashram"}</span>
                      {job?.city && <span className="flex items-center gap-1"><MapPin size={13} className="text-[#E58C28]" /> {job.city}{job.state ? `, ${job.state}` : ""}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#0A4DA6] dark:bg-blue-950/40">
                      {application.status === "accepted" ? <CircleCheck size={19} /> : <Clock3 size={19} />}
                    </div>
                    <ChevronRight className="text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-[#0A4DA6]" size={18} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
