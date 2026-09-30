/* oxlint-disable react/only-export-components -- small shared kit for the customer and staff support screens */
import React, { useRef, useState } from "react";
import { FileText, Loader2, Lock, Paperclip, X } from "lucide-react";
import { getErrorMessage } from "../../lib/api";
import { toast } from "../../lib/toast";
import { Pill, inr } from "../marketplace/ui";
import {
  supportApi,
  type EntitySummary,
  type SupportAttachment,
  type TicketPriority,
  type TicketStatus,
} from "../../services/support.service";

export const STATUS_META: Record<TicketStatus, { label: string; tone: "green" | "amber" | "saffron" | "red" | "blue" | "gray" }> = {
  OPEN: { label: "Open", tone: "blue" },
  IN_PROGRESS: { label: "In progress", tone: "saffron" },
  WAITING_FOR_USER: { label: "Waiting for you", tone: "amber" },
  RESOLVED: { label: "Resolved", tone: "green" },
  CLOSED: { label: "Closed", tone: "gray" },
  REOPENED: { label: "Reopened", tone: "red" },
};

export const PRIORITY_META: Record<TicketPriority, { label: string; tone: "green" | "amber" | "saffron" | "red" | "blue" | "gray" }> = {
  LOW: { label: "Low", tone: "gray" },
  MEDIUM: { label: "Medium", tone: "blue" },
  HIGH: { label: "High", tone: "amber" },
  URGENT: { label: "Urgent", tone: "red" },
};

/** Staff wording for WAITING_FOR_USER differs from the customer's ("Waiting for you"). */
export const StatusPill: React.FC<{ status: TicketStatus; staff?: boolean }> = ({ status, staff }) => {
  const meta = STATUS_META[status] ?? { label: status, tone: "gray" as const };
  return <Pill tone={meta.tone} label={staff && status === "WAITING_FOR_USER" ? "Waiting for customer" : meta.label} />;
};

export const PriorityPill: React.FC<{ priority: TicketPriority }> = ({ priority }) => {
  const meta = PRIORITY_META[priority] ?? { label: priority, tone: "gray" as const };
  return <Pill tone={meta.tone} label={meta.label} />;
};

export const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${(hours / 24).toFixed(1)} days`;
};

export const timeAgo = (value?: string | null): string => {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fullTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Only ever link to https URLs the backend stored (Cloudinary); anything else is not rendered as a link. */
const safeUrl = (url: string) => (/^https:\/\//i.test(url) ? url : undefined);

export const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,application/pdf";

/**
 * Uploads files as they are picked and keeps the returned attachment ids.
 * The backend re-checks the type from the file bytes; these checks only save
 * a pointless upload.
 */
export const AttachmentPicker: React.FC<{
  value: SupportAttachment[];
  onChange: (next: SupportAttachment[]) => void;
  onBusy?: (busy: boolean) => void;
  compact?: boolean;
}> = ({ value, onChange, onBusy, compact }) => {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, MAX_FILES - value.length));
    if (files.length > list.length) toast.warning(`You can attach up to ${MAX_FILES} files.`);
    const accepted: SupportAttachment[] = [];
    setUploading(list.length);
    onBusy?.(true);
    for (const file of list) {
      if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
        toast.error(`${file.name}: only images and PDF files can be attached.`);
        setUploading((n) => n - 1);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is larger than 10 MB.`);
        setUploading((n) => n - 1);
        continue;
      }
      try {
        const res = await supportApi.upload(file);
        accepted.push(res.data.data);
      } catch (err) {
        toast.error(getErrorMessage(err, `${file.name} could not be uploaded.`));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onBusy?.(false);
    if (accepted.length) onChange([...value, ...accepted]);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={value.length >= MAX_FILES || uploading > 0}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 font-extrabold hover:border-[#F28C28] hover:text-[#F28C28] disabled:opacity-50 cursor-pointer transition-colors ${compact ? "p-2 text-[11px]" : "px-3 py-2 text-[11px]"}`}
          aria-label="Attach files"
        >
          {uploading > 0 ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          {!compact && (uploading > 0 ? "Uploading…" : "Attach files")}
        </button>
        {!compact && <span className="text-[10px] text-gray-400">Images or PDF · up to 10 MB each · max {MAX_FILES}</span>}
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => pick(e.target.files)} />
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((file) => (
            <li
              key={file._id ?? file.url}
              className="inline-flex items-center gap-1.5 max-w-[220px] rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 pl-2 pr-1 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-200"
            >
              <FileText size={12} className="shrink-0 text-[#F28C28]" />
              <span className="truncate">{file.fileName}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((f) => f !== file))}
                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer"
                aria-label={`Remove ${file.fileName}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AttachmentList: React.FC<{ files: SupportAttachment[]; onDark?: boolean }> = ({ files, onDark }) => {
  if (!files?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1.5">
      {files.map((file) => {
        const href = safeUrl(file.url);
        const image = file.mimeType.startsWith("image/") && href;
        return (
          <a
            key={file.attachmentId ?? file.url}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`group inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold max-w-[220px] ${
              onDark ? "border-white/30 bg-white/10 text-white" : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200"
            }`}
          >
            {image ? (
              <img src={href} alt="" className="w-8 h-8 rounded object-cover shrink-0" loading="lazy" />
            ) : (
              <FileText size={13} className="shrink-0" />
            )}
            <span className="truncate group-hover:underline">{file.fileName}</span>
            <span className="opacity-60 shrink-0">{fileSize(file.bytes)}</span>
          </a>
        );
      })}
    </div>
  );
};

export interface ThreadItem {
  id: string;
  /** me = right side; them = left; note = internal (staff only); system = centred */
  side: "me" | "them" | "note" | "system";
  name: string;
  body: string;
  attachments?: SupportAttachment[];
  createdAt: string;
  readAt?: string | null;
}

/** Conversation thread. Text is rendered as plain text (React escapes it), never as HTML. */
export const Thread: React.FC<{ items: ThreadItem[]; emptyText?: string }> = ({ items, emptyText }) => {
  if (!items.length)
    return <p className="py-8 text-center text-xs text-gray-400">{emptyText ?? "No messages yet."}</p>;
  return (
    <ol className="space-y-3">
      {items.map((item) => {
        if (item.side === "system")
          return (
            <li key={item.id} className="text-center text-[10px] font-bold text-gray-400">
              {item.body} · {fullTime(item.createdAt)}
            </li>
          );
        const mine = item.side === "me";
        const note = item.side === "note";
        return (
          <li key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] sm:max-w-[75%] space-y-1 ${mine ? "items-end text-right" : ""}`}>
              <div className={`flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ${mine ? "justify-end" : ""}`}>
                {note && <Lock size={10} className="text-amber-600" />}
                <span className="text-gray-600 dark:text-gray-300">{item.name}</span>
                <span>· {fullTime(item.createdAt)}</span>
              </div>
              <div
                className={`rounded-[18px] px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words text-left ${
                  note
                    ? "bg-amber-50 dark:bg-amber-950/40 border border-dashed border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                    : mine
                      ? "bg-[#F28C28] text-white rounded-tr-md"
                      : "bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-[#0B192C] dark:text-gray-100 rounded-tl-md"
                }`}
              >
                {note && <span className="block text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">Internal note · not visible to the customer</span>}
                {item.body}
                <AttachmentList files={item.attachments ?? []} onDark={mine && !note} />
              </div>
              {mine && item.readAt !== undefined && (
                <div className="text-[9px] font-bold text-gray-400">{item.readAt ? "Seen" : "Sent"}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

const renderValue = (field: EntitySummary["fields"][number]) => {
  if (field.value === null || field.value === "") return "—";
  if (field.kind === "money") return inr(field.value);
  if (field.kind === "date") return fullTime(String(field.value));
  if (field.kind === "status") return <Pill status={String(field.value).toLowerCase()} />;
  return String(field.value);
};

/** Live details of the booking/order/payment a ticket is about (staff workspace). */
export const EntityCard: React.FC<{ entity: EntitySummary }> = ({ entity }) => (
  <div className="space-y-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{entity.typeLabel}</p>
        <p className="text-sm font-black text-[#0B192C] dark:text-white truncate">{entity.title || entity.reference}</p>
      </div>
      {!entity.exists && <Pill tone="gray" label="No longer available" />}
    </div>
    {entity.exists ? (
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        {entity.fields.map((field) => (
          <div key={field.label} className="min-w-0">
            <dt className="text-[10px] font-bold text-gray-400">{field.label}</dt>
            <dd className="font-bold text-[#0B192C] dark:text-gray-100 break-words">{renderValue(field)}</dd>
          </div>
        ))}
      </dl>
    ) : (
      <p className="text-[11px] text-gray-500">
        The linked record ({entity.reference || "unknown reference"}) was changed or removed. The ticket keeps its reference for history.
      </p>
    )}
  </div>
);
