import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  approvalService,
  type ApprovalRequestItem,
  type ApprovalStatsData,
} from "../../../services/approval.service";
import { useNotifications } from "../../../contexts/NotificationContext";
import { getErrorMessage } from "../../../lib/api";
import { RecordFieldList } from "../../shared/components/RecordValue";
import { EnterprisePageHeader } from "../../shared";
import { humanizeLabel } from "../../../utils/labels";
import {
  FileCheck,
  XCircle,
  Clock,
  Search,
  Eye,
  ShieldCheck,
  Building2,
  Bed,
  DollarSign,
  Tag,
  Image,
  Users,
  ShoppingBag,
  Car,
  Newspaper,
  Calendar,
  Landmark,
  Sparkles,
  AlertCircle,
} from "lucide-react";

const MODULE_ICON_MAP: Record<string, React.ReactNode> = {
  ashram: <Building2 size={14} className="text-indigo-500" />,
  room_category: <Bed size={14} className="text-[#0A4DA6]" />,
  room: <Bed size={14} className="text-blue-500" />,
  amenities: <Sparkles size={14} className="text-cyan-500" />,
  pricing: <DollarSign size={14} className="text-emerald-500" />,
  offer: <Tag size={14} className="text-amber-500" />,
  gallery: <Image size={14} className="text-purple-500" />,
  volunteer: <Users size={14} className="text-rose-500" />,
  marketplace: <ShoppingBag size={14} className="text-orange-500" />,
  service: <Car size={14} className="text-teal-500" />,
  blog: <Newspaper size={14} className="text-sky-500" />,
  event: <Calendar size={14} className="text-pink-500" />,
  temple: <Landmark size={14} className="text-yellow-600" />,
  banner: <Sparkles size={14} className="text-violet-500" />,
  other: <FileCheck size={14} className="text-gray-500" />,
};

export const CentralApprovalCenterPage: React.FC = () => {
  const { moduleType = "all" } = useParams<{ moduleType?: string }>();
  const { addNotification } = useNotifications();

  const [requests, setRequests] = useState<ApprovalRequestItem[]>([]);
  const [stats, setStats] = useState<ApprovalStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<string>(moduleType);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] =
    useState<ApprovalRequestItem | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [commentText, setCommentText] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    setActiveModule(moduleType);
  }, [moduleType]);

  useEffect(() => {
    fetchStats();
    fetchRequests();
  }, [activeModule, statusFilter, priorityFilter]);

  const fetchStats = async () => {
    try {
      const res = await approvalService.getStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Error fetching approval stats:", err);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await approvalService.getRequests({
        module: activeModule,
        status: statusFilter,
        priority: priorityFilter,
      });
      if (res.success) {
        setRequests(res.data);
      }
    } catch (err) {
      console.error("Error fetching approval requests:", err);
      addNotification(
        "Load Error",
        getErrorMessage(
          err,
          "Failed to load Central Approval Center requests.",
        ),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (
    action: "approve" | "reject" | "request_changes" | "under_review",
  ) => {
    if (!selectedRequest) return;
    setProcessing(true);

    try {
      const res = await approvalService.reviewRequest(
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
        fetchStats();
        fetchRequests();
      }
    } catch (err) {
      console.error("Error submitting review decision:", err);
      addNotification(
        "Review Action Failed",
        getErrorMessage(err, "Failed to process approval decision."),
        "error",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !commentText.trim()) return;

    try {
      const res = await approvalService.addComment(
        selectedRequest._id,
        commentText,
      );
      if (res.success) {
        addNotification(
          "Comment Added",
          "Your note was posted to the approval thread.",
          "info",
        );
        setCommentText("");
        // Refresh single request
        const single = await approvalService.getRequestById(
          selectedRequest._id,
        );
        if (single.success) {
          setSelectedRequest(single.data);
        }
      }
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  const filteredRequests = requests.filter((req) => {
    const term = searchTerm.toLowerCase();
    return (
      req.requestId.toLowerCase().includes(term) ||
      req.title.toLowerCase().includes(term) ||
      req.module.toLowerCase().includes(term) ||
      (req.ashramId?.name || "").toLowerCase().includes(term) ||
      (req.stayAdminId?.name || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 text-left w-full">
      {/* Header Banner */}
      <EnterprisePageHeader
        title="Central Approval Center"
        subtitle="Master control panel for reviewing, validating, and approving every structural platform modification request."
        icon={<FileCheck size={22} />}
        badgeText="Master Approval Queue"
      />

      {/* KPI Dashboard Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-[22px] shadow-sm space-y-1">
          <span className="text-[10px] text-gray-400 font-extrabold tracking-wider block">
            Total Pending
          </span>
          <h3 className="text-2xl font-black text-[#0A4DA6]">
            {stats?.totalPending ?? 0}
          </h3>
          <span className="text-[9px] text-gray-400 font-semibold">
            Awaiting Review
          </span>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-[22px] shadow-sm space-y-1">
          <span className="text-[10px] text-gray-400 font-extrabold tracking-wider block">
            Approved Today
          </span>
          <h3 className="text-2xl font-black text-emerald-600">
            {stats?.approvedToday ?? 0}
          </h3>
          <span className="text-[9px] text-emerald-500 font-bold">
            Live in Database
          </span>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-[22px] shadow-sm space-y-1">
          <span className="text-[10px] text-gray-400 font-extrabold tracking-wider block">
            Under Review
          </span>
          <h3 className="text-2xl font-black text-blue-500">
            {stats?.underReview ?? 0}
          </h3>
          <span className="text-[9px] text-blue-500 font-bold">
            In Progress
          </span>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-[22px] shadow-sm space-y-1">
          <span className="text-[10px] text-gray-400 font-extrabold tracking-wider block">
            Needs Changes
          </span>
          <h3 className="text-2xl font-black text-amber-500">
            {stats?.needsChanges ?? 0}
          </h3>
          <span className="text-[9px] text-amber-500 font-bold">
            Returned to Admin
          </span>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-[22px] shadow-sm space-y-1">
          <span className="text-[10px] text-gray-400 font-extrabold tracking-wider block">
            Rejected Today
          </span>
          <h3 className="text-2xl font-black text-rose-500">
            {stats?.rejectedToday ?? 0}
          </h3>
          <span className="text-[9px] text-rose-400 font-bold">Declined</span>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-[22px] shadow-sm space-y-1">
          <span className="text-[10px] text-gray-400 font-extrabold tracking-wider block">
            High Priority
          </span>
          <h3 className="text-2xl font-black text-purple-600">
            {stats?.highPriority ?? 0}
          </h3>
          <span className="text-[9px] text-purple-500 font-bold">
            Urgent Action
          </span>
        </div>
      </div>

      {/* Module Selector & Filter Toolbar */}
      <div className="bg-white dark:bg-[#0B192C] p-4 rounded-[24px] border border-gray-100 dark:border-slate-800 shadow-sm space-y-3.5">
        {/* Module Sub-tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "all", label: "📥 All Requests" },
            { id: "ashram", label: "🏨 Ashram Requests" },
            { id: "room_category", label: "🛏 Room Categories" },
            { id: "room", label: "🏠 Rooms" },
            { id: "amenities", label: "🛁 Amenities" },
            { id: "pricing", label: "💰 Pricing" },
            { id: "offer", label: "🎁 Offers" },
            { id: "gallery", label: "🖼 Gallery" },
            { id: "volunteer", label: "🙋 Volunteer" },
            { id: "marketplace", label: "🛍 Marketplace" },
            { id: "service", label: "🚕 Services" },
            { id: "blog", label: "📰 Blogs" },
            { id: "event", label: "🎉 Events" },
            { id: "temple", label: "🛕 Temples" },
            { id: "banner", label: "📢 Banners" },
            { id: "other", label: "⚙ Other" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveModule(tab.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeModule === tab.id
                  ? "bg-[#0A4DA6] text-white shadow-sm"
                  : "bg-gray-50 dark:bg-slate-900 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status, Priority & Search Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="needs_changes">Needs Changes</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search request ID, title, ashram..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A4DA6]"
            />
          </div>
        </div>
      </div>

      {/* Central Requests Table */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-xs text-gray-400 font-semibold animate-pulse">
            Loading Central Approval Center queue...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-10 text-center text-xs text-gray-400 font-semibold bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
            No approval requests found matching active module and filter
            criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Ashram Name</th>
                  <th className="py-3 px-4">Stay Admin</th>
                  <th className="py-3 px-4">Title / Summary</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted</th>
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
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold">
                        {MODULE_ICON_MAP[req.module] || MODULE_ICON_MAP.other}
                        {req.module?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#0B192C] dark:text-white">
                      {req.ashramId?.name || "Ashram Retreat"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold">
                          {req.stayAdminId?.name || "Stay Admin"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {req.stayAdminId?.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-[#0B192C] dark:text-white max-w-xs truncate">
                      {req.title}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                          req.priority === "urgent"
                            ? "bg-rose-500/10 text-rose-600"
                            : req.priority === "high"
                              ? "bg-purple-500/10 text-purple-600"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {req.priority || "normal"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border ${
                          req.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : req.status === "rejected"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : req.status === "needs_changes"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : req.status === "under_review"
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                  : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {req.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 font-semibold">
                      {new Date(req.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
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

      {/* ── Comprehensive Review Modal ── */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 max-w-3xl w-full space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-[#0A4DA6] tracking-wider">
                  {selectedRequest.requestId} •{" "}
                  {humanizeLabel(selectedRequest.module)}
                </span>
                <h3 className="font-extrabold text-lg text-[#0B192C] dark:text-white flex items-center gap-2">
                  <FileCheck size={20} className="text-[#0A4DA6]" />{" "}
                  {selectedRequest.title}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 dark:bg-slate-900/60 p-4 rounded-2xl text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] font-bold">
                  Ashram
                </span>
                <span className="font-extrabold text-[#0B192C] dark:text-white">
                  {selectedRequest.ashramId?.name || "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold">
                  Stay Admin
                </span>
                <span className="font-bold text-gray-700 dark:text-gray-200">
                  {selectedRequest.stayAdminId?.name}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold">
                  Priority
                </span>
                <span className="font-extrabold text-purple-600">
                  {selectedRequest.priority || "normal"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold">
                  Current Status
                </span>
                <span className="font-extrabold text-amber-600">
                  {selectedRequest.status?.replace("_", " ")}
                </span>
              </div>
            </div>

            {/* Payload Inspector */}
            <div className="space-y-2 text-xs">
              <h4 className="font-extrabold text-gray-700 dark:text-gray-200 tracking-wider text-[11px]">
                Requested Data Payload
              </h4>
              <div className="p-4 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-y-auto max-h-56">
                <RecordFieldList
                  data={selectedRequest.requestedData}
                  emptyLabel="This request carries no payload"
                  className="text-[11px] leading-relaxed"
                />
              </div>
            </div>

            {/* Comment Thread */}
            {selectedRequest.comments &&
              selectedRequest.comments.length > 0 && (
                <div className="space-y-2 text-xs border-t border-gray-100 dark:border-slate-800 pt-3">
                  <h4 className="font-extrabold text-gray-700 dark:text-gray-200 tracking-wider text-[11px]">
                    Approval Thread ({selectedRequest.comments.length})
                  </h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {selectedRequest.comments.map((c, i) => (
                      <div
                        key={i}
                        className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl space-y-1"
                      >
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                          <span>{c.userName || "User"}</span>
                          <span>{new Date(c.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-700 dark:text-gray-200 font-medium">
                          {c.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Post Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Write a message to approval thread..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-grow p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#0A4DA6] text-white rounded-xl text-xs font-bold hover:bg-opacity-95 cursor-pointer"
              >
                Comment
              </button>
            </form>

            {/* Review Comment Box */}
            <div className="space-y-1.5 border-t border-gray-100 dark:border-slate-800 pt-3">
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 tracking-wider">
                Review Decision Note
              </label>
              <textarea
                rows={2}
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
                Close
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleReviewAction("under_review")}
                  className="px-3.5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-extrabold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  Under Review
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleReviewAction("request_changes")}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-extrabold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  Request Changes
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleReviewAction("reject")}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-extrabold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleReviewAction("approve")}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-extrabold text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {processing ? "Processing..." : "Approve & Execute Live"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CentralApprovalCenterPage;
