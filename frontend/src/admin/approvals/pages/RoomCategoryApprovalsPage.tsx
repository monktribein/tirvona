import React, { useState, useEffect, useCallback } from "react";
import { approvalService } from "../../../services";
import type { RoomCategoryRequestItem } from "../../../services/approval.service";
import { useNotifications } from "../../../contexts/NotificationContext";
import { getErrorMessage } from "../../../lib/api";
import { humanizeLabel } from "../../../utils/labels";
import { formatCurrency, getFormattingLocale } from "../../../utils/format";
import { EnterprisePageHeader } from "../../shared";
import {
  Bed,
  Search,
  Eye,
  Layers,
} from "lucide-react";

export const RoomCategoryApprovalsPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const [requests, setRequests] = useState<RoomCategoryRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] =
    useState<RoomCategoryRequestItem | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await approvalService.getRoomCategoryRequests({
        status: statusFilter,
      });
      if (res.success) {
        setRequests(res.data);
      }
    } catch (err) {
      console.error("Error fetching room category requests:", err);
      addNotification(
        "Load Error",
        getErrorMessage(err, "Failed to load approval requests."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [addNotification, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleReviewAction = async (
    action: "approve" | "reject" | "request_changes",
  ) => {
    if (!selectedRequest) return;
    setProcessing(true);

    try {
      const res = await approvalService.reviewRoomCategoryRequest(
        selectedRequest._id,
        action,
        reviewComment,
      );
      if (res.success) {
        addNotification(
          `Request ${humanizeLabel(action)}`,
          res.message,
          action === "approve"
            ? "success"
            : action === "reject"
              ? "error"
              : "warning",
        );
        setSelectedRequest(null);
        setReviewComment("");
        fetchRequests();
      }
    } catch (err) {
      console.error("Error processing review decision:", err);
      addNotification(
        "Review Action Failed",
        getErrorMessage(err, "Failed to submit review decision."),
        "error",
      );
    } finally {
      setProcessing(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    const term = searchTerm.toLowerCase();
    return (
      req.requestId.toLowerCase().includes(term) ||
      req.categoryData.name.toLowerCase().includes(term) ||
      (req.ashramId?.name || "").toLowerCase().includes(term) ||
      (req.stayAdminId?.name || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 text-left w-full">
      {/* Header */}
      <EnterprisePageHeader
        title="Room Category Approval Engine"
        subtitle="Review and validate structural room category additions requested by Ashram Owners across ashrams."
        icon={<Layers size={22} />}
        badgeText="Super Admin Console"
      />

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-[#0B192C] p-4 rounded-[20px] border border-gray-100 dark:border-slate-800 shadow-sm">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {[
            "all",
            "pending",
            "under_review",
            "approved",
            "rejected",
            "needs_modification",
          ].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl capitalize transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === status
                  ? "bg-[#0A4DA6] text-white shadow-sm"
                  : "bg-gray-50 dark:bg-slate-900 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search request ID, ashram..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A4DA6]"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400 font-semibold animate-pulse">
            Loading room category approval requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 font-semibold bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
            No room category approval requests found matching filter settings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Ashram Name</th>
                  <th className="py-3 px-4">Ashram Owner</th>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Capacity / Price</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr
                    key={req._id}
                    className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-900/40"
                  >
                    <td className="py-3.5 px-4 font-bold text-[#0A4DA6]">
                      {req.requestId}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#0B192C] dark:text-white">
                      {req.ashramId?.name || "Ashram Retreat"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold">
                          {req.stayAdminId?.name || "Ashram Owner"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {req.stayAdminId?.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-[#0B192C] dark:text-white">
                      {req.categoryData?.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold">
                        {req.categoryData?.maxGuests} Guests
                      </span>
                      <span className="text-gray-400 block text-[10px]">
                        {formatCurrency(req.categoryData?.suggestedBasePrice)} / night
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 font-semibold">
                      {new Date(req.createdAt).toLocaleDateString(getFormattingLocale(), {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border ${
                          req.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : req.status === "rejected"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : req.status === "needs_modification"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                        }`}
                      >
                        {req.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="px-3 py-1.5 bg-[#0A4DA6]/10 text-[#0A4DA6] hover:bg-[#0A4DA6] hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <Eye size={13} /> View & Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Review Details Modal ── */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-[#0A4DA6] tracking-wider">
                  {selectedRequest.requestId}
                </span>
                <h3 className="font-extrabold text-lg text-[#0B192C] dark:text-white flex items-center gap-2">
                  <Bed size={20} className="text-[#0A4DA6]" />{" "}
                  {selectedRequest.categoryData?.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            {/* Request Summary Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 dark:bg-slate-900/60 p-4 rounded-2xl text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] font-bold">
                  Target Ashram
                </span>
                <span className="font-extrabold text-[#0B192C] dark:text-white">
                  {selectedRequest.ashramId?.name}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold">
                  Ashram Owner
                </span>
                <span className="font-bold text-gray-700 dark:text-gray-200">
                  {selectedRequest.stayAdminId?.name}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold">
                  Max Capacity
                </span>
                <span className="font-bold text-gray-700 dark:text-gray-200">
                  {selectedRequest.categoryData?.maxGuests} Guests
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold">
                  Suggested Price
                </span>
                <span className="font-bold text-[#0A4DA6]">
                  {formatCurrency(selectedRequest.categoryData?.suggestedBasePrice)} / night
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold">
                  Current Status
                </span>
                <span className="font-bold text-amber-600">
                  {selectedRequest.status?.replace("_", " ")}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold">
                  Submitted Date
                </span>
                <span className="font-semibold text-gray-600 dark:text-gray-300">
                  {new Date(selectedRequest.createdAt).toLocaleDateString(getFormattingLocale())}
                </span>
              </div>
            </div>

            {/* Description & Amenities */}
            <div className="space-y-2 text-xs">
              <h4 className="font-extrabold text-gray-700 dark:text-gray-200 tracking-wider text-[11px]">
                Reason for Request & Details
              </h4>
              <p className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl text-gray-600 dark:text-gray-300 font-medium">
                {selectedRequest.categoryData?.reasonForRequest ||
                  "No reason specified."}
              </p>

              {selectedRequest.categoryData?.defaultAmenities &&
                selectedRequest.categoryData.defaultAmenities.length > 0 && (
                  <div className="pt-2">
                    <h4 className="font-extrabold text-gray-700 dark:text-gray-200 tracking-wider text-[11px] mb-1.5">
                      Default Amenities
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRequest.categoryData.defaultAmenities.map(
                        (am: string, i: number) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 bg-[#0A4DA6]/10 text-[#0A4DA6] rounded-md font-bold text-[10px]"
                          >
                            {am}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* Review Comment Box */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 tracking-wider">
                Reviewer Notes / Feedback Comment
              </label>
              <textarea
                rows={3}
                placeholder="Enter approval comments, modification requirements, or rejection reason..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-xs"
              >
                Cancel
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleReviewAction("request_changes")}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-extrabold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  Request Changes
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleReviewAction("reject")}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-extrabold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  Reject Request
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleReviewAction("approve")}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-extrabold text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {processing ? "Processing..." : "Approve & Create Live Room"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomCategoryApprovalsPage;
