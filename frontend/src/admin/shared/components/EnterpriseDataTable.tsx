import React, { useState, useMemo } from "react";
import {
  Search,
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
  Image as ImageIcon,
  ExternalLink,
  FileText,
  Loader2,
  Upload,
  KeyRound,
} from "lucide-react";
import { RecordValue } from "./RecordValue";
import { ImageGalleryManager } from "./ImageGalleryManager";
import { formatInline, humanizeKey, URL_LIKE } from "../utils/recordFormat";
import { useLanguage } from "../../../contexts/LanguageContext";
import { getFormattingLocale } from "../../../utils/format";
import api, { getErrorMessage } from "../../../lib/api";

const IMAGE_ASSET = /\.(jpe?g|png|webp|gif|svg|avif|heic)($|\?)/i;
const DOCUMENT_FIELD = /(document|certificate|deed|ownership|pdf|file).*url$|^(trustDeedUrl|fireSafetyCertificateUrl|landOwnershipUrl)$/i;

const DocumentAssetEditor: React.FC<{
  label: string;
  value: string;
  onChange: (url: string) => void;
}> = ({ label, value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const isUrl = URL_LIKE.test(value || "");

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "admin-documents");
      const response = await api.post("/uploads", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploadedUrl = response.data?.data?.url || "";
      if (!response.data?.success || !uploadedUrl)
        throw new Error(response.data?.message || "Upload did not return a document.");
      onChange(uploadedUrl);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Could not upload this document."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2 sm:col-span-2 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60 p-3">
      <p className="text-xs font-bold text-gray-400">{label}</p>
      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          {isUrl && IMAGE_ASSET.test(value) ? (
            <img src={value} alt={label} className="h-24 w-36 rounded-xl object-cover bg-slate-900" />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6] flex items-center justify-center">
              <FileText size={24} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {isUrl && (
              <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#0A4DA6] px-3 py-2 text-[10px] font-extrabold text-white">
                <ExternalLink size={11} /> {IMAGE_ASSET.test(value) ? "Open image" : "Open document"}
              </a>
            )}
            <button type="button" onClick={() => onChange("")} className="rounded-full bg-rose-50 px-3 py-2 text-[10px] font-extrabold text-rose-600">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400">No document uploaded.</p>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#0A4DA6]/30 px-3 py-2 text-[10px] font-extrabold text-[#0A4DA6]">
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {value ? "Replace document" : "Upload document or image"}
        <input type="file" accept="image/*,.pdf,application/pdf" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} className="hidden" />
      </label>
      {error && <p className="text-[10px] font-bold text-rose-600">{error}</p>}
    </div>
  );
};

function extractAllImages(item: any): string[] {
  if (!item || typeof item !== "object") return [];
  const foundUrls: string[] = [];

  const addIfImage = (val: any) => {
    if (!val) return;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (
        trimmed.startsWith("data:image/") ||
        /\.(jpg|jpeg|png|webp|gif|svg|avif|heic)($|\?)/i.test(trimmed)
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

  // Scan the complete record as well so nested galleries, documents and
  // module-specific image fields all appear in the unified view/editor.
  Object.values(item).forEach(addIfImage);

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
  onSave?: (item: any) => void | Promise<void>;
  onManage?: (item: any) => void;
  onDelete?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkApprove?: (ids: string[]) => void;
  onBulkReject?: (ids: string[]) => void;
  onToggleStatus?: (item: any) => void;
  onResetOwnerPassword?: (ownerId: string, password: string) => Promise<void>;
  formFields?: Array<{
    name: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
  }>;
  showImageManager?: boolean;
}

export const EnterpriseDataTable: React.FC<EnterpriseDataTableProps> = ({
  title,
  subtitle,
  columns,
  data,
  onSave,
  onManage,
  onDelete,
  onToggleStatus,
  onResetOwnerPassword,
  onBulkDelete,
  onBulkApprove,
  onBulkReject,
  isLoading = false,
  loading = false,
  hideAddButton = false,
  formFields,
  showImageManager = true,
}) => {
  const { t } = useLanguage();
  const tableLoading = isLoading || loading;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal States
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [isDetailEditing, setIsDetailEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Form State for Create/Edit
  const [formData, setFormData] = useState<Record<string, any>>({});
  const resolvedFormFields = useMemo<
    NonNullable<EnterpriseDataTableProps["formFields"]>
  >(
    () =>
      formFields ??
      columns.map((column) => ({
        name: column.key,
        label: column.label,
        type: "text",
      })),
    [formFields, columns],
  );

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

  const prepareFormData = (item: any) => {
    const initial: Record<string, any> = { ...item };
    if (!initial.city && item.address?.city) {
      initial.city = item.address.city;
    }
    if (!initial.district && item.address?.district) initial.district = item.address.district;
    if (!initial.state && item.address?.state) initial.state = item.address.state;
    if (!initial.pincode && item.address?.pincode) initial.pincode = item.address.pincode;
    if (!initial.email && item.contact?.email) initial.email = item.contact.email;
    if (!initial.phone && item.contact?.phone) initial.phone = item.contact.phone;
    if (!initial.street && item.address?.street) initial.street = item.address.street;
    if (!initial.trustDeedUrl && item.documents?.trustDeedUrl) initial.trustDeedUrl = item.documents.trustDeedUrl;
    if (!initial.fireSafetyCertificateUrl && item.documents?.fireSafetyCertificateUrl) initial.fireSafetyCertificateUrl = item.documents.fireSafetyCertificateUrl;
    if (!initial.landOwnershipUrl && item.documents?.landOwnershipUrl) initial.landOwnershipUrl = item.documents.landOwnershipUrl;
    if (!initial.uploadNotes && item.documents?.uploadNotes) initial.uploadNotes = item.documents.uploadNotes;
    initial.images = Array.from(
      new Set([
        ...(Array.isArray(initial.images) ? initial.images : []),
        ...extractAllImages(item),
      ]),
    );
    if (
      initial.isVerified === true ||
      initial.isVerified === "true" ||
      initial.isVerified === "Verified" ||
      initial.isVerified === "verified"
    ) {
      initial.isVerified = "Verified";
    } else if (initial.isVerified === false || initial.isVerified === "false" || initial.isVerified === "Unverified") {
      initial.isVerified = "Unverified";
    }
    return initial;
  };

  const openDetailModal = (item: any) => {
    setDetailItem(item);
    setIsDetailEditing(false);
    setConfirmingDelete(false);
    setShowPasswordChange(false);
    setNewOwnerPassword("");
    setConfirmOwnerPassword("");
    setPasswordChangeError("");
    setFormData(prepareFormData(item));
  };

  const detailOwnerId = String(
    detailItem?.ownerId?._id ?? detailItem?.ownerId ?? "",
  );

  const handleOwnerPasswordChange = async () => {
    if (!onResetOwnerPassword || !detailOwnerId) return;
    if (newOwnerPassword.length < 6) {
      setPasswordChangeError("Password must contain at least 6 characters.");
      return;
    }
    if (newOwnerPassword !== confirmOwnerPassword) {
      setPasswordChangeError("The password confirmation does not match.");
      return;
    }
    setPasswordChanging(true);
    setPasswordChangeError("");
    try {
      await onResetOwnerPassword(detailOwnerId, newOwnerPassword);
      setShowPasswordChange(false);
      setNewOwnerPassword("");
      setConfirmOwnerPassword("");
    } catch (error) {
      setPasswordChangeError(
        getErrorMessage(error, "The owner password could not be changed."),
      );
    } finally {
      setPasswordChanging(false);
    }
  };

  const beginDetailEdit = () => {
    if (!detailItem) return;
    setFormData(prepareFormData(detailItem));
    setIsDetailEditing(true);
  };

  const handleDetailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onSave) return;
    await onSave(formData);
    setDetailItem((current: any) => (current ? { ...current, ...formData } : current));
    setIsDetailEditing(false);
  };

  const renderRecordEditor = () => (
    <div className="space-y-4">
      {showImageManager && (
        <ImageGalleryManager
          coverImage={
            formData.coverImage ||
            formData.image ||
            formData.imageUrl ||
            (Array.isArray(formData.images) ? formData.images[0] : "")
          }
          onCoverImageChange={(url) =>
            setFormData((current) => ({
              ...current,
              coverImage: url,
              image: url,
              imageUrl: url,
              images: [
                url,
                ...(Array.isArray(current.images) ? current.images : []).filter(
                  (image: string) => image !== url,
                ),
              ],
            }))
          }
          gallery={
            Array.isArray(formData.images)
              ? formData.images
              : formData.gallery || []
          }
          onGalleryChange={(urls) =>
            setFormData((current) => ({
              ...current,
              images: urls,
              gallery: urls,
            }))
          }
          label="Record Images"
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {resolvedFormFields.map((field) =>
          (DOCUMENT_FIELD.test(field.name) ||
            URL_LIKE.test(String(formData[field.name] || ""))) ? (
            <DocumentAssetEditor
              key={field.name}
              label={t(field.label)}
              value={String(formData[field.name] || "")}
              onChange={(url) =>
                setFormData((current) => ({
                  ...current,
                  [field.name]: url,
                }))
              }
            />
          ) : (
          <div
            key={field.name}
            className={field.type === "textarea" ? "space-y-1 sm:col-span-2" : "space-y-1"}
          >
            <label className="text-xs font-bold text-gray-400">
              {t(field.label)}
            </label>
            {field.type === "select" ? (
              <select
                value={formData[field.name] ?? field.options?.[0] ?? ""}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white font-bold"
              >
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {humanizeKey(option)}
                  </option>
                ))}
              </select>
            ) : field.name === "isVerified" ? (
              <select
                value={formData[field.name] ? "Verified" : "Unverified"}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    [field.name]: event.target.value === "Verified",
                  }))
                }
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white font-bold"
              >
                <option value="Verified">Verified</option>
                <option value="Unverified">Unverified</option>
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                required={field.required}
                rows={4}
                value={formData[field.name] ?? ""}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white resize-y"
              />
            ) : (
              <input
                type={field.type}
                required={field.required}
                min={field.type === "number" ? 0 : undefined}
                value={formData[field.name] ?? ""}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

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
            placeholder={t("Search records...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-medium text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
          />
        </div>

        {/* Filter & Per-Page Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold">{t("Status")}:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none"
            >
              <option value="all">{t("All Statuses")}</option>
              <option value="active">{t("Active / Approved")}</option>
              <option value="pending">{t("Pending")}</option>
              <option value="rejected">{t("Rejected / Suspended")}</option>
              <option value="cancelled">{t("Cancelled")}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold">{t("Show")}:</span>
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
                <CheckCircle size={14} /> {t("Bulk Approve")}
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
                <XCircle size={14} /> {t("Bulk Reject")}
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
                <Trash2 size={14} /> {t("Bulk Delete")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Enterprise Data Table */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
        {tableLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-xs font-bold animate-pulse">
            {t("Loading data records...")}
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
                        {t(col.label)}
                    </th>
                  ))}
                   {!columns.some((column) => column.key === "status") && (
                     <th className="py-4 px-4">Status</th>
                   )}
                  <th className="py-4 px-4">Created Date</th>
                   <th className="py-4 px-4 text-right">Edit / View</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + (columns.some((column) => column.key === "status") ? 3 : 4)}
                      className="py-12 text-center text-gray-400 font-semibold"
                    >
                      {t("No records found.")}
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
                         {!columns.some((column) => column.key === "status") && <td className="py-3.5 px-4">
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
                         </td>}
                        <td className="py-3.5 px-4 text-gray-400 text-[11px] font-mono whitespace-nowrap">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString(getFormattingLocale())
                            : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openDetailModal(item)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#0A4DA6]/25 bg-[#0A4DA6]/5 px-3 py-1.5 text-[11px] font-extrabold text-[#0A4DA6] transition-colors hover:bg-[#0A4DA6] hover:text-white cursor-pointer whitespace-nowrap"
                          >
                            <Eye size={13} /> {t("Edit / View")}
                          </button>
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

      {/* Unified Edit / View record modal */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-4xl w-full rounded-[28px] p-6 space-y-6 text-left shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-800 pb-4">
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-black text-xl text-[#0B192C] dark:text-white tracking-tight">
                    {detailItem.name ||
                      detailItem.title ||
                      detailItem.businessName ||
                      detailItem.bookingCode ||
                      detailItem.email ||
                      "Record Details"}
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
                onClick={() => {
                  setDetailItem(null);
                  setIsDetailEditing(false);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* One complete record view shared by every Super Admin module. */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {isDetailEditing ? (
                <form id="unified-record-edit-form" onSubmit={handleDetailSubmit}>
                  {renderRecordEditor()}
                </form>
              ) : (
                <>
              <div className="space-y-5">
                  {/* Photo & Media Showcase */}
                  {(() => {
                    const gallery = extractAllImages(detailItem);
                    if (gallery.length === 0) return null;

                    return (
                      <div className="space-y-3 p-4 bg-gray-50 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                            <ImageIcon size={14} className="text-[#0A4DA6]" /> Photos & Media Gallery ({gallery.length})
                          </span>
                        </div>

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
                            "_id",
                            "id",
                            "createdAt",
                            "updatedAt",
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
                            {k === "ownerId" ? "Owner Account" : humanizeKey(k)}
                          </span>
                          <div className="font-semibold text-[#0B192C] dark:text-white">
                            {k === "ownerId" && v && typeof v === "object" ? (
                              <div className="space-y-0.5">
                                <p>{(v as any).name || "Ashram owner"}</p>
                                <p className="font-medium text-[#0A4DA6]">{(v as any).email || "No email available"}</p>
                                {(v as any).phone && <p className="font-medium text-gray-500">{(v as any).phone}</p>}
                              </div>
                            ) : (
                              <RecordValue value={v} />
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              {(detailItem.createdAt || detailItem.updatedAt) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {detailItem.createdAt && (
                    <div className="rounded-xl border border-gray-100 dark:border-slate-800 p-3">
                      <span className="text-[10px] font-extrabold uppercase text-gray-400">Created</span>
                      <p className="mt-1 font-semibold text-[#0B192C] dark:text-white">{new Date(detailItem.createdAt).toLocaleString(getFormattingLocale())}</p>
                    </div>
                  )}
                  {detailItem.updatedAt && (
                    <div className="rounded-xl border border-gray-100 dark:border-slate-800 p-3">
                      <span className="text-[10px] font-extrabold uppercase text-gray-400">Last updated</span>
                      <p className="mt-1 font-semibold text-[#0B192C] dark:text-white">{new Date(detailItem.updatedAt).toLocaleString(getFormattingLocale())}</p>
                    </div>
                  )}
                </div>
              )}
                </>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-wrap justify-end gap-3">
              {isDetailEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prepareFormData(detailItem));
                      setIsDetailEditing(false);
                    }}
                    className="px-6 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="unified-record-edit-form"
                    className="px-6 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/25 cursor-pointer hover:bg-[#083b80]"
                  >
                    <Edit size={14} /> Save Changes
                  </button>
                </>
              ) : (
                <>
                  {showPasswordChange && onResetOwnerPassword && detailOwnerId && (
                    <div className="w-full rounded-2xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900/60 dark:bg-purple-950/20">
                      <div className="mb-3 flex items-center gap-2 text-xs font-black text-purple-700 dark:text-purple-300">
                        <KeyRound size={15} /> Change ashram owner password
                      </div>
                      <p className="mb-3 text-[10px] text-gray-500 dark:text-gray-400">
                        Account: {detailItem.ownerId?.email || "Owner account"}. The existing password is encrypted and cannot be displayed.
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="password"
                          value={newOwnerPassword}
                          onChange={(event) => setNewOwnerPassword(event.target.value)}
                          placeholder="New password"
                          autoComplete="new-password"
                          className="rounded-xl border border-purple-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-purple-500 dark:border-purple-900 dark:bg-slate-950"
                        />
                        <input
                          type="password"
                          value={confirmOwnerPassword}
                          onChange={(event) => setConfirmOwnerPassword(event.target.value)}
                          placeholder="Confirm new password"
                          autoComplete="new-password"
                          className="rounded-xl border border-purple-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-purple-500 dark:border-purple-900 dark:bg-slate-950"
                        />
                      </div>
                      {passwordChangeError && (
                        <p className="mt-2 text-[10px] font-bold text-rose-600">{passwordChangeError}</p>
                      )}
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordChange(false);
                            setNewOwnerPassword("");
                            setConfirmOwnerPassword("");
                            setPasswordChangeError("");
                          }}
                          className="rounded-full bg-white px-4 py-2 text-[10px] font-bold text-gray-600 dark:bg-slate-900 dark:text-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={passwordChanging}
                          onClick={() => void handleOwnerPasswordChange()}
                          className="rounded-full bg-purple-600 px-4 py-2 text-[10px] font-black text-white disabled:opacity-50"
                        >
                          {passwordChanging ? "Changing..." : "Confirm Password Change"}
                        </button>
                      </div>
                    </div>
                  )}
                  {onToggleStatus && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onToggleStatus(detailItem);
                        const currentStatus = String(detailItem.status || "").toLowerCase();
                        setDetailItem((current: any) => ({
                          ...current,
                          status: ["active", "approved"].includes(currentStatus)
                            ? "suspended"
                            : "active",
                        }));
                      }}
                      className="px-5 py-2.5 rounded-full bg-amber-50 text-amber-700 text-xs font-extrabold cursor-pointer"
                    >
                      {["active", "approved"].includes(String(detailItem.status || "").toLowerCase())
                        ? "Suspend"
                        : "Reactivate"}
                    </button>
                  )}
                  {onResetOwnerPassword && detailOwnerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordChange((current) => !current);
                        setPasswordChangeError("");
                      }}
                      className="px-5 py-2.5 rounded-full bg-purple-50 text-purple-700 text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <KeyRound size={14} /> Change Owner Password
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirmingDelete) {
                          setConfirmingDelete(true);
                          return;
                        }
                        await onDelete(detailItem._id || detailItem.id);
                        setDetailItem(null);
                        setConfirmingDelete(false);
                      }}
                      className="px-5 py-2.5 rounded-full bg-rose-50 text-rose-600 text-xs font-extrabold cursor-pointer"
                    >
                      {confirmingDelete ? "Confirm Delete" : "Delete"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setDetailItem(null);
                      setIsDetailEditing(false);
                      setConfirmingDelete(false);
                    }}
                    className="px-6 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full text-xs font-bold cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Close
                  </button>
                  {(onSave || onManage) && (
                    <button
                      onClick={() => {
                        if (onSave) beginDetailEdit();
                        else if (onManage) onManage(detailItem);
                      }}
                      className="px-6 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/25 cursor-pointer hover:bg-[#083b80] transition-colors"
                    >
                      <Edit size={14} /> Edit Record
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Form Modal. Editing stays inside the unified record modal. */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleFormSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-lg w-full rounded-[28px] p-6 space-y-5 text-left shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-[#0B192C] dark:text-white">
                Create New Record
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {showImageManager && <ImageGalleryManager
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
              />}
              {resolvedFormFields.map((field) => (
                <div key={field.name} className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    {t(field.label)}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={formData[field.name] ?? field.options?.[0] ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [field.name]: e.target.value,
                        })
                      }
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white font-bold cursor-pointer"
                    >
                      {field.options?.map((option) => (
                        <option key={option} value={option}>{humanizeKey(option)}</option>
                      ))}
                    </select>
                  ) : field.name === "isVerified" ? (
                    <select
                      value={formData[field.name] ? "Verified" : "Unverified"}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value === "Verified" })}
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white font-bold cursor-pointer"
                    >
                      <option value="Verified">Verified</option>
                      <option value="Unverified">Unverified</option>
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      required={field.required}
                      rows={4}
                      value={formData[field.name] ?? ""}
                      onChange={(e) =>
                        setFormData({ ...formData, [field.name]: e.target.value })
                      }
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white resize-y"
                    />
                  ) : (
                    <input
                      type={field.type}
                      required={field.required}
                      min={field.type === "number" ? 0 : undefined}
                      value={formData[field.name] ?? ""}
                      onChange={(e) =>
                        setFormData({ ...formData, [field.name]: e.target.value })
                      }
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-[#0B192C] dark:text-white"
                    />
                  )}
                </div>
              ))}
              {!formFields && <div className="space-y-1">
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
              </div>}
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                }}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-black shadow-md cursor-pointer hover:bg-[#083b80]"
              >
                Create Record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default EnterpriseDataTable;
