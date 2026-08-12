import React, { useCallback, useEffect, useState } from "react";
import {
  smartContactService,
  type SmartContactAuditEntry,
} from "../../../services/smartContact.service";
import { getErrorMessage } from "../../../lib/api";
import { getFormattingLocale } from "../../../utils/format";
import { History, Loader2 } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  PROFILE_CREATED: "Profile created",
  PROFILE_UPDATED: "Profile updated",
  PHONE_CHANGED: "Mobile changed",
  EMAIL_CHANGED: "Email changed",
  PHOTO_CHANGED: "Photograph changed",
  DESIGNATION_CHANGED: "Designation changed",
  SLUG_CHANGED: "Profile slug changed",
  QR_GENERATED: "QR generated",
  QR_RETIRED: "QR retired",
  PROFILE_ACTIVATED: "Profile activated",
  PROFILE_DISABLED: "Profile disabled",
  PROFILE_ARCHIVED: "Profile archived",
  PROFILE_RESTORED: "Profile restored",
};

const formatDate = (value?: string): string =>
  value
    ? new Date(value).toLocaleString(getFormattingLocale(), {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** The per-profile audit trail (spec §37). */
export const AuditPanel: React.FC<{ profileId: string }> = ({ profileId }) => {
  const [entries, setEntries] = useState<SmartContactAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await smartContactService.audit(profileId);
      setEntries(res.data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load the audit trail."));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center text-gray-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-sm">
      <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A4DA6] mb-3 flex items-center gap-2">
        <History size={13} /> Audit trail
      </h4>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {entries.length === 0 && !error ? (
        <p className="py-10 text-center text-xs text-gray-400">
          No changes recorded yet.
        </p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="relative pl-5 border-l-2 border-gray-100 dark:border-slate-800 pb-1"
            >
              <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#0A4DA6]" />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-black text-[#0B192C] dark:text-white">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                  {entry.field && (
                    <span className="ml-1.5 text-[10px] font-bold text-gray-400">
                      {entry.field}
                    </span>
                  )}
                </p>
                <span className="text-[10px] font-bold text-gray-400">
                  {formatDate(entry.createdAt)}
                </span>
              </div>

              {(entry.oldValue || entry.newValue) && (
                <p className="text-[11px] text-gray-500 mt-0.5 break-words">
                  <span className="line-through opacity-60">
                    {entry.oldValue || "empty"}
                  </span>
                  {" → "}
                  <span className="font-bold text-[#0B192C] dark:text-white">
                    {entry.newValue || "empty"}
                  </span>
                </p>
              )}

              <p className="text-[10px] text-gray-400 mt-0.5">
                {entry.actor?.name || "System"}
                {entry.ip && ` · ${entry.ip}`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
