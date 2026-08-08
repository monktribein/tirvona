import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Download,
  Printer,
  Edit,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  Clock,
  Activity,
  History,
  Tag,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { RecordValue } from "./RecordValue";
import { ImageGalleryManager } from "./ImageGalleryManager";
import { formatInline, humanizeKey } from "../utils/recordFormat";

function extractAllImages(item: any): string[] {
  if (!item || typeof item !== "object") return [];
  const foundUrls: string[] = [];

  const addIfImage = (val: any) => {
    if (!val) return;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("data:image/") ||
        trimmed.startsWith("/uploads/") ||
        /\.(jpg|jpeg|png|webp|gif|svg|avif)($|\?)/i.test(trimmed)
      ) {
        foundUrls.push(trimmed);
      } else if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) parsed.forEach(addIfImage);
        } catch { }
      }
    } else if (Array.isArray(val)) {
      val.forEach(addIfImage);
    } else if (typeof val === "object") {
      Object.values(val).forEach(addIfImage);
    }
  };

  const primaryKeys = [
    "coverImageUrl",
    "coverImage",
    "image",
    "imageUrl",
    "images",
    "gallery",
    "galleryUrls",
    "photos",
    "media",
    "virtualTour360",
    "trustDeedUrl",
    "fireSafetyCertificateUrl",
    "landOwnershipUrl",
    "documents",
  ];

  primaryKeys.forEach((key) => {
    if (item[key]) addIfImage(item[key]);
  });

  if (foundUrls.length === 0) {
    Object.values(item).forEach(addIfImage);
  }

  return Array.from(new Set(foundUrls));
}

export interface TableColumn {
  key: string;
  label: string;
  render?: (value: any, item: any) => React.ReactNode;
}

export interface EnterpriseDataTableProps {
  title: string;
  subtitle?: string;
  columns: TableColumn[];
  data: any[];
  isLoading?: boolean;
  loading?: boolean;
  hideAddButton?: boolean;
  onSave?: (item: any) => void;
  onManage?: (item: any) => void;
  onDelete?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkApprove?: (ids: string[]) => void;
  onBulkReject?: (ids: string[]) => void;
  onToggleStatus?: (item: any) => void;
}

export const EnterpriseDataTable: React.FC<EnterpriseDataTableProps> = ({
  title,
  subtitle,
  columns,
  data,
  onSave,
  onManage,
  onDelete,
  onBulkDelete,
  onBulkApprove,
  onBulkReject,
  onToggleStatus,
  isLoading = false,
  loading = false,
  hideAddButton = false,
}) => {
  const tableLoading = isLoading || loading;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal States
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "info" | "timeline" | "activity" | "logs"
  >("overview");
  const [editItem, setEditItem] = useState<any | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State for Create/Edit
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Filtered & Searched Data
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Search check
      const searchMatch =
        !searchTerm ||
        Object.values(item).some((val) =>
          String(val || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
        );
      // Status check
      const statusMatch =
        statusFilter === "all" ||
        (item.status &&
          String(item.status).toLowerCase() === statusFilter.toLowerCase());
      return searchMatch && statusMatch;
    });
  }, [data, searchTerm, statusFilter]);

  // Paginated Data
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  // Selection Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedData.map((item) => item._id || item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const keys = columns.map((c) => c.key);
    const headers = columns.map((c) => c.label).join(",");
    const rows = filteredData.map((row) =>
      keys
        // formatInline keeps nested values readable; String() would export
        // "[object Object]" for address, contact, rating and friends.
        .map((k) => `"${formatInline(row[k]).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${title.toLowerCase().replace(/\s+/g, "_")}_export.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  // Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      onSave(formData);
    }
    setIsCreateOpen(false);
    setEditItem(null);
    setFormData({});
  };

  const openCreateModal = () => {
    const initial: Record<string, any> = {};
    columns.forEach((c) => {
      initial[c.key] = "";
    });
    initial.status = "active";
    setFormData(initial);
    setIsCreateOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditItem(item);
    const initial: Record<string, any> = { ...item };
    if (!initial.city && item.address?.city) {
      initial.city = item.address.city;
    }
    if (
      initial.isVerified === true ||
      initial.isVerified === "true" ||
      initial.isVerified === "Verified" ||
      initial.isVerified === "verified"
    ) {
      initial.isVerified = true;
    } else if (initial.isVerified === false || initial.isVerified === "false" || initial.isVerified === "Unverified") {
      initial.isVerified = false;
    }
    setFormData(initial);
  };

  return (
    <div className="space-y-6 text-left w-full">
      {/* Controls & Search Toolbar */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-[20px] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-medium text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
          />
        </div>

        {/* Filter & Per-Page Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active / Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected / Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 rounded-[20px] flex items-center justify-between animate-in fade-in">
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
            {selectedIds.length} item(s) selected
          </span>
          <div className="flex items-center gap-2">
            {onBulkApprove && (
              <button
                onClick={() => {
                  onBulkApprove(selectedIds);
                  setSelectedIds([]);
                }}
                className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-700"
              >
                <CheckCircle size={14} /> Bulk Approve
              </button>
            )}
            {onBulkReject && (
              <button
                onClick={() => {
                  onBulkReject(selectedIds);
                  setSelectedIds([]);
                }}
                className="px-3 py-1.5 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-orange-700"
              >
                <XCircle size={14} /> Bulk Reject
              </button>
            )}
            {onBulkDelete && (
              <button
                onClick={() => {
                  onBulkDelete(selectedIds);
                  setSelectedIds([]);
                }}
                className="px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-700"
              >
                <Trash2 size={14} /> Bulk Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Enterprise Data Table */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
        {tableLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-xs font-bold animate-pulse">
            Loading data records...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/50 text-gray-400 font-extrabold text-[10px] tracking-wider">
                  <th className="py-4 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        paginatedData.length > 0 &&
                        paginatedData.every((item) =>
                          selectedIds.includes(item._id || item.id),
                        )
                      }
                      className="rounded border-gray-300 text-[#0A4DA6] focus:ring-0 cursor-pointer"
                    />
                  </th>
                  {columns.map((col) => (
                    <th key={col.key} className="py-4 px-4 font-bold">
                      {col.label}
                    </th>
                  ))}
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Created Date</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + 4}
                      className="py-12 text-center text-gray-400 font-semibold"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => {
                    const id = item._id || item.id;
                    const isSelected = selectedIds.includes(id);
                    const statusStr = String(
                      item.status || "active",
                    ).toLowerCase();

                    return (
                      <tr
                        key={id}
                        className={`border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/40 dark:hover:bg-slate-800/30 transition-colors ${isSelected ? "bg-blue-50/30 dark:bg-slate-800/50" : ""
                          }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectOne(id)}
                            className="rounded border-gray-300 text-[#0A4DA6] focus:ring-0 cursor-pointer"
                          />
                        </td>
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className="py-3.5 px-4 font-medium text-[#0B192C] dark:text-gray-200"
                          >
                            {col.render
                              ? col.render(item[col.key], item)
                              : formatInline(item[col.key])}
                          </td>
                        ))}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wide ${["active", "approved"].includes(statusStr)
                              ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                              : ["pending"].includes(statusStr)
                                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                                : "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                              }`}
                          >
                            {statusStr === "approved" ? "active" : statusStr}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-400 text-[11px] font-mono whitespace-nowrap">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onManage ? (
                              <button
                                onClick={() => onManage(item)}
                                className="px-3 py-1 bg-[#0A4DA6] hover:bg-blue-900 text-white rounded-full text-[11px] font-black shadow-sm transition-all cursor-pointer flex items-center gap-1"
                                title="Open 7-Section Enterprise Manager"
                              >
                                <Sparkles size={12} /> Manage
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setDetailItem(item)}
                                  className="p-1.5 text-gray-400 hover:text-[#0A4DA6] hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                                  title="View Details"
                                >
                                  <Eye size={14} />
                                </button>
                                {onSave && (
                                  <button
                                    onClick={() => openEditModal(item)}
                                    className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                                    title="Edit Record"
                                  >
                                    <Edit size={14} />
                                  </button>
                                )}
                              </>
                            )}
                            {onToggleStatus && (
                              <button
                                onClick={() => onToggleStatus(item)}
                                className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                                title="Toggle Status"
                              >
                                {["active", "approved"].includes(statusStr) ? (
                                  <ToggleRight
                                    size={16}
                                    className="text-emerald-500"
                                  />
                                ) : (
                                  <ToggleLeft
                                    size={16}
                                    className="text-rose-500"
                                  />
                                )}
                              </button>
                            )}
                            {onDelete && (
                              <button
                                onClick={() => onDelete(id)}
                                className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-gray-400 font-medium">
            Showing{" "}
            {filteredData.length === 0
              ? 0
              : (currentPage - 1) * itemsPerPage + 1}{" "}
            to {Math.min(currentPage * itemsPerPage, filteredData.length)} of{" "}
            {filteredData.length} records
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-full border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-bold text-[#0B192C] dark:text-white px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-full border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* View Detail Tabbed Modal */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-2xl w-full rounded-[28px] p-6 space-y-6 text-left shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-800 pb-4">
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-black text-xl text-[#0B192C] dark:text-white tracking-tight">
                    {detailItem.name || detailItem.title || "Record Details"}
                  </h3>
                  {detailItem.status && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                      {detailItem.status}
                    </span>
                  )}
                  {(detailItem.isVerified || detailItem.status === "approved") && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-[#0A4DA6] dark:bg-blue-950/60 dark:text-blue-300 flex items-center gap-1">
                      <CheckCircle size={10} /> Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-mono">
                  ID: {detailItem._id || detailItem.id} {detailItem.ashramCode ? `· Code: ${detailItem.ashramCode}` : ""}
                </p>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-100 dark:border-slate-800 gap-4 text-xs font-bold text-gray-400">
              <button
                onClick={() => setActiveTab("overview")}
                className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "overview"
                  ? "border-[#0A4DA6] text-[#0A4DA6] dark:text-amber-400"
                  : "border-transparent"
                  }`}
              >
                <Info size={14} /> Overview
              </button>
              <button
                onClick={() => setActiveTab("info")}
                className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "info"
                  ? "border-[#0A4DA6] text-[#0A4DA6] dark:text-amber-400"
                  : "border-transparent"
                  }`}
              >
                <Tag size={14} /> Information
              </button>
              <button
                onClick={() => setActiveTab("timeline")}
                className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "timeline"
                  ? "border-[#0A4DA6] text-[#0A4DA6] dark:text-amber-400"
                  : "border-transparent"
                  }`}
              >
                <Clock size={14} /> Timeline
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "activity"
                  ? "border-[#0A4DA6] text-[#0A4DA6] dark:text-amber-400"
                  : "border-transparent"
                  }`}
              >
                <Activity size={14} /> Activity
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "logs"
                  ? "border-[#0A4DA6] text-[#0A4DA6] dark:text-amber-400"
                  : "border-transparent"
                  }`}
              >
                <History size={14} /> Audit Logs
              </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {activeTab === "overview" && (
                <div className="space-y-5">
                  {/* Photo & Media Showcase */}
                  {(() => {
                    const gallery = extractAllImages(detailItem);

                    return (
                      <div className="space-y-3 p-4 bg-gray-50 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                            <ImageIcon size={14} className="text-[#0A4DA6]" /> Photos & Media Gallery ({gallery.length})
                          </span>
                          {onSave && (
                            <button
                              type="button"
                              onClick={() => {
                                const target = detailItem;
                                setDetailItem(null);
                                openEditModal(target);
                              }}
                              className="text-[11px] font-extrabold text-[#0A4DA6] hover:underline cursor-pointer"
                            >
                              + Manage Photos & Edit
                            </button>
                          )}
                        </div>

                        {gallery.length > 0 ? (
                          <div className="space-y-2">
                            {/* Main Cover Image Preview */}
                            <div className="h-40 rounded-xl overflow-hidden relative border border-gray-200 dark:border-slate-800 bg-slate-950">
                              <img
                                src={gallery[0]}
                                alt={detailItem.name || "Cover"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-3">
                                <span className="text-white text-xs font-extrabold">
                                  {detailItem.name || "Ashram Listing"} · Cover Photo
                                </span>
                              </div>
                            </div>
                            {/* Thumbnails */}
                            {gallery.length > 1 && (
                              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-1">
                                {gallery.slice(1).map((imgUrl, idx) => (
                                  <a
                                    key={idx}
                                    href={imgUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group relative h-16 rounded-lg overflow-hidden bg-slate-950 border border-gray-200 dark:border-slate-800"
                                  >
                                    <img
                                      src={imgUrl}
                                      alt={`Gallery Photo ${idx + 2}`}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-gray-400 text-xs font-medium space-y-2 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/50">
                            <ImageIcon size={28} className="mx-auto text-gray-300 dark:text-slate-700" />
                            <p>No photos uploaded for this listing yet.</p>
                            {onSave && (
                              <button
                                type="button"
                                onClick={() => {
                                  const target = detailItem;
                                  setDetailItem(null);
                                  openEditModal(target);
                                }}
                                className="px-4 py-2 bg-[#0A4DA6] text-white rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/25 cursor-pointer hover:bg-[#083b80] mt-1"
                              >
                                <Plus size={14} /> Add / Upload Photos Now
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Formatted Information Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.entries(detailItem)
                      .filter(
                        ([k]) =>
                          ![
                            "__v",
                            "images",
                            "gallery",
                            "coverImage",
                            "coverImageUrl",
                            "imageUrl",
                          ].includes(k),
                      )
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl space-y-1 border border-gray-100/80 dark:border-slate-800/80"
                        >
                          <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">
                            {humanizeKey(k)}
                          </span>
                          <div className="font-semibold text-[#0B192C] dark:text-white">
                            <RecordValue value={v} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {activeTab === "info" && (
                <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl text-xs space-y-2">
                  <h4 className="font-bold text-[#0B192C] dark:text-white">
                    Record Metadata
                  </h4>
                  <p className="text-gray-400">
                    Owner Module: Enterprise System Admin Panel
                  </p>
                  <p className="text-gray-400">
                    Encrypted DB Node: tirvona-primary-cluster
                  </p>
                </div>
              )}

              {activeTab === "timeline" && (
                <div className="space-y-3 text-xs">
                  <div className="flex gap-3 items-center text-gray-400">
                    <Clock size={14} className="text-[#0A4DA6]" /> Created:{" "}
                    {detailItem.createdAt
                      ? new Date(detailItem.createdAt).toLocaleString()
                      : "N/A"}
                  </div>
                  <div className="flex gap-3 items-center text-gray-400">
                    <Clock size={14} className="text-emerald-500" /> Updated:{" "}
                    {detailItem.updatedAt
                      ? new Date(detailItem.updatedAt).toLocaleString()
                      : "N/A"}
                  </div>
                </div>
              )}

              {activeTab === "activity" && (
                <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl text-xs text-gray-400">
                  Recent activities and change triggers registered for this
                  record.
                </div>
              )}

              {activeTab === "logs" && (
                <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl text-xs font-mono text-gray-400">
                  [AUDIT_LOG]: Action verified by Super Admin at{" "}
                  {new Date().toISOString()}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setDetailItem(null)}
                className="px-6 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full text-xs font-bold cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
              {onSave && (
                <button
                  onClick={() => {
                    const targetItem = detailItem;
                    setDetailItem(null);
                    openEditModal(targetItem);
                  }}
                  className="px-6 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/25 cursor-pointer hover:bg-[#083b80] transition-colors"
                >
                  <Edit size={14} /> Edit Record
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {(isCreateOpen || editItem) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleFormSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-lg w-full rounded-[28px] p-6 space-y-5 text-left shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-[#0B192C] dark:text-white">
                {editItem ? "Edit Record" : "Create New Record"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditItem(null);
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              <ImageGalleryManager
                coverImage={
                  formData.coverImage ||
                  formData.image ||
                  formData.imageUrl ||
                  (Array.isArray(formData.images) ? formData.images[0] : "")
                }
                onCoverImageChange={(url) =>
                  setFormData({
                    ...formData,
                    coverImage: url,
                    image: url,
                    imageUrl: url,
                    images: [
                      url,
                      ...(Array.isArray(formData.images) ? formData.images : []).filter(
                        (x: string) => x !== url,
                      ),
                    ],
                  })
                }
                gallery={
                  Array.isArray(formData.images)
                    ? formData.images
                    : formData.gallery || []
                }
                onGalleryChange={(urls) =>
                  setFormData({ ...formData, images: urls, gallery: urls })
                }
              />
              {columns.map((col) => (
                <div key={col.key} className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    {col.label}
                  </label>
                  {col.key === "isVerified" ? (
                    <select
                      value={
                        formData[col.key] === true ||
                          formData[col.key] === "true" ||
                          formData[col.key] === "Verified" ||
                          formData[col.key] === "verified"
                          ? "Verified"
                          : "Unverified"
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [col.key]: e.target.value === "Verified" ? true : false,
                        })
                      }
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white font-bold cursor-pointer"
                    >
                      <option value="Verified">Verified</option>
                      <option value="Unverified">Unverified</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={formData[col.key] || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, [col.key]: e.target.value })
                      }
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white"
                    />
                  )}
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">
                  Status
                </label>
                <select
                  value={formData.status || "active"}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white font-bold"
                >
                  <option value="active">Active / Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected / Suspended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditItem(null);
                }}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-black shadow-md cursor-pointer hover:bg-[#083b80]"
              >
                {editItem ? "Save Changes" : "Create Record"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default EnterpriseDataTable;
