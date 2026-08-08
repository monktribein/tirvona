import React, { useState, useEffect } from "react";
import { FileCheck, ShieldAlert, FileText, X, ShieldCheck } from "lucide-react";
import { useNotifications } from "../../../contexts/NotificationContext";
import { useAuth } from "../../../contexts/AuthContext";
import { verificationService } from "../../../services";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../shared";
import { humanizeLabel } from "../../../utils/labels";

export const VerificationQueuePage: React.FC = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Inspector Action States
  const [actionAshramId, setActionAshramId] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [targetStatus, setTargetStatus] = useState<"approved" | "rejected">(
    "approved",
  );
  const [schedulingAshramId, setSchedulingAshramId] = useState<string | null>(
    null,
  );
  const [inspectionDate, setInspectionDate] = useState("");

  const canMakeFinalDecision = user?.role !== "inspector";

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await verificationService.pending();
      if (res.data.success) {
        setPendingList(res.data.data);
      }
    } catch (err) {
      console.error("Fetch pending error:", err);
      addNotification(
        "Load Failed",
        getErrorMessage(err, "Unable to load the verification queue."),
        "error",
      );
      setPendingList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionAshramId) return;

    try {
      const res = await verificationService.updateStatus(actionAshramId, {
        status: targetStatus,
        comments,
      });
      if (res.data.success) {
        setActionAshramId(null);
        setComments("");
        addNotification(
          "Inspection Decided",
          `Ashram has been marked as ${humanizeLabel(targetStatus)}`,
          "success",
        );
        fetchPending();
      }
    } catch (err) {
      console.error("Decision error:", err);
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not submit decision."),
        "error",
      );
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingAshramId || !inspectionDate) return;
    try {
      const res = await verificationService.schedule(
        schedulingAshramId,
        inspectionDate,
      );
      if (res.data.success) {
        setSchedulingAshramId(null);
        setInspectionDate("");
        addNotification(
          "Inspection Scheduled",
          "The application moved to the inspection queue.",
          "success",
        );
        fetchPending();
      }
    } catch (err) {
      addNotification(
        "Scheduling Failed",
        getErrorMessage(err, "Could not schedule the inspection."),
        "error",
      );
    }
  };

  return (
    <div className="space-y-6 text-left w-full">
      <EnterprisePageHeader
        title="Government Ashram Verification Queue"
        subtitle="Screen trust deeds, review local fire certificates, and submit inspection decisions."
        icon={<ShieldCheck size={22} />}
        badgeText={`${pendingList.length} PENDING INSPECTIONS`}
      />

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : pendingList.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-4">
          <FileCheck className="mx-auto text-gray-300" size={32} />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            Verification Queue Clear
          </h4>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            There are no pending Ashram registrations or audits in your district
            jurisdiction.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingList.map((a) => (
            <div
              key={a._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm space-y-5"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-gray-50 dark:border-slate-850 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-[#0B192C] dark:text-white">
                    {a.name}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    {a.address?.city}, {a.address?.state}
                  </span>
                </div>
                <span className="text-[9px] font-bold bg-yellow-50 text-yellow-750 border border-yellow-200 px-2.5 py-0.5 rounded-full capitalize">
                  {a.status?.replace("_", " ")}
                </span>
              </div>

              {/* Owner KYC contacts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-450 block font-bold">
                    Applicant Owner
                  </span>
                  <span className="font-semibold text-secondary dark:text-white">
                    {a.ownerId?.name} ({a.ownerId?.phone})
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    {a.ownerId?.govtIdType
                      ? `${a.ownerId.govtIdType}: ${a.ownerId.govtIdNumberMasked || "document uploaded"}`
                      : "Owner identity document not available"}
                  </span>
                  {a.ownerId?.govtIdUrl && (
                    <a
                      href={a.ownerId.govtIdUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-[#0A4DA6] hover:underline"
                    >
                      View owner identity document
                    </a>
                  )}
                </div>

                {/* Documents uploaded */}
                <div className="space-y-1 md:col-span-2">
                  <span className="text-[9px] text-gray-455 block font-bold">
                    KYC Attachments
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["Trust Deed", a.documents?.trustDeedUrl],
                      [
                        "Fire Safety Certificate",
                        a.documents?.fireSafetyCertificateUrl,
                      ],
                      ["Land Ownership / Lease", a.documents?.landOwnershipUrl],
                    ].map(([label, url]) =>
                      url ? (
                        <a
                          key={label}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-slate-900 border border-gray-150 rounded-full text-[10px] font-bold hover:bg-gray-100 transition-colors"
                        >
                          <FileText size={12} className="text-orange-500" />{" "}
                          {label}
                        </a>
                      ) : (
                        <span
                          key={label}
                          className="px-3 py-1 bg-red-50 text-red-600 border border-red-100 rounded-full text-[10px] font-bold"
                        >
                          Missing: {label}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </div>

              {/* Decisions Buttons */}
              <div className="pt-3 border-t border-gray-50 dark:border-slate-850 flex justify-end gap-3">
                {a.status === "pending_docs" && (
                  <button
                    onClick={() => {
                      setSchedulingAshramId(a._id);
                      setInspectionDate("");
                    }}
                    className="px-4 py-2 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 hover:bg-[#0A4DA6]/15 rounded-full text-[10px] font-bold cursor-pointer"
                  >
                    Schedule Inspection
                  </button>
                )}
                {canMakeFinalDecision && (
                  <button
                    onClick={() => {
                      setActionAshramId(a._id);
                      setTargetStatus("rejected");
                      setComments("");
                    }}
                    className="px-4 py-2 bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 rounded-full text-[10px] font-bold cursor-pointer"
                  >
                    Reject
                  </button>
                )}
                {canMakeFinalDecision && a.status === "pending_inspection" && (
                  <button
                    onClick={() => {
                      setActionAshramId(a._id);
                      setTargetStatus("approved");
                      setComments("");
                    }}
                    className="px-4 py-2 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 hover:bg-[#0A4DA6]/15 rounded-full text-[10px] font-bold cursor-pointer"
                  >
                    Verify Approve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decision Modal Dialog */}
      {actionAshramId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleDecision}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-xl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-[#0A4DA6]" /> Log
                Verification Decision
              </h3>
              <button
                type="button"
                onClick={() => setActionAshramId(null)}
                className="text-gray-400 hover:text-gray-655"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400">
                Inspector Comments / Audit findings
              </label>
              <textarea
                required
                rows={3}
                placeholder="Include safety check details, separate washing quarters findings, water safety checks..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setActionAshramId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 py-2.5 text-white rounded-full text-xs font-bold cursor-pointer shadow ${
                  targetStatus === "approved" ? "bg-success" : "bg-danger"
                }`}
              >
                Confirm {humanizeLabel(targetStatus)}
              </button>
            </div>
          </form>
        </div>
      )}

      {schedulingAshramId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSchedule}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-xl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-[#0B192C] dark:text-white">
                Schedule Physical Inspection
              </h3>
              <button
                type="button"
                onClick={() => setSchedulingAshramId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">
                Inspection date and time
              </label>
              <input
                required
                type="datetime-local"
                min={new Date().toISOString().slice(0, 16)}
                value={inspectionDate}
                onChange={(event) => setInspectionDate(event.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSchedulingAshramId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold"
              >
                Schedule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default VerificationQueuePage;
