import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Info, RefreshCw, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { EnterprisePageHeader } from "../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../admin/shared/components/EnterpriseButton";
import { EnterpriseStatusBadge } from "../../admin/shared/components/EnterpriseStatusBadge";
import { useNotifications } from "../../contexts/NotificationContext";
import { getErrorMessage } from "../../lib/api";
import { assistantConfigApi, type PublishedConfig } from "../../components/assistant/assistantConfig";
import { ASSISTANT_REGISTRY, type Integration, type RegistryEntry } from "../../components/assistant/assistantFlow";
import type { AssistantEntryConfig } from "../../components/assistant/assistantTypes";

/** One module or option as the administrator is editing it. */
interface Row {
  entry: RegistryEntry;
  visible: boolean;
  enabled: boolean;
  /** Module display name override; empty = the default name. */
  label: string;
  children: Row[];
}

const LABEL_MAX = 40;

const INTEGRATION: Record<Integration, { status: string; label: string; hint: string }> = {
  live: { status: "active", label: "Live data", hint: "Every option reads current records from existing APIs." },
  partial: { status: "pending", label: "Partly live", hint: "Some options read live data, others open an existing page." },
  navigation: { status: "draft", label: "Navigation only", hint: "Options open existing pages; no data is read here." },
};

/** Builds the editable tree from the options registered in code plus what is currently published. */
const buildRows = (published: Map<string, AssistantEntryConfig>): Row[] => {
  const build = (entries: RegistryEntry[]): Row[] =>
    entries
      .map((entry, index) => ({ entry, index, saved: published.get(entry.pid) }))
      .sort((a, b) => {
        if (!a.saved && !b.saved) return a.index - b.index;
        if (!a.saved) return 1;
        if (!b.saved) return -1;
        return a.saved.order - b.saved.order || a.index - b.index;
      })
      .map(({ entry, saved }) => ({
        entry,
        visible: saved?.visible ?? true,
        enabled: saved?.enabled ?? true,
        label: saved?.label ?? "",
        children: build(entry.children),
      }));
  return build(ASSISTANT_REGISTRY);
};

/** Every row, in order, as the entries the server stores. */
const toEntries = (rows: Row[]): AssistantEntryConfig[] =>
  rows.flatMap((row, index) => [
    {
      id: row.entry.pid,
      visible: row.visible,
      enabled: row.enabled,
      order: (index + 1) * 10,
      ...(row.label.trim() && !row.entry.pid.includes("/") ? { label: row.label.trim() } : {}),
    },
    ...toEntries(row.children),
  ]);

const updateAt = (rows: Row[], pid: string, change: (row: Row) => Row): Row[] =>
  rows.map((row) =>
    row.entry.pid === pid ? change(row) : { ...row, children: updateAt(row.children, pid, change) },
  );

const move = (rows: Row[], pid: string, direction: -1 | 1): Row[] => {
  const index = rows.findIndex((r) => r.entry.pid === pid);
  if (index >= 0) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return rows;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }
  return rows.map((row) => ({ ...row, children: move(row.children, pid, direction) }));
};

const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

const RowEditor: React.FC<{
  rows: Row[];
  depth: number;
  open: Set<string>;
  onToggleOpen: (pid: string) => void;
  onChange: (pid: string, change: (row: Row) => Row) => void;
  onMove: (pid: string, direction: -1 | 1) => void;
  parentHidden: boolean;
}> = ({ rows, depth, open, onToggleOpen, onChange, onMove, parentHidden }) => (
  <ul className={depth ? "border-l border-gray-100 dark:border-slate-800 ml-4" : ""}>
    {rows.map((row, index) => {
      const { entry } = row;
      const isModule = depth === 0;
      const expandable = row.children.length > 0;
      const expanded = open.has(entry.pid);
      const hidden = parentHidden || !row.visible;
      const meta = INTEGRATION[entry.integration];
      return (
        <li key={entry.pid} className="border-b border-gray-100 dark:border-slate-800 last:border-b-0">
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 ${hidden ? "opacity-60" : ""}`}>
            <div className="flex min-w-[200px] flex-1 items-center gap-2">
              {expandable ? (
                <button
                  type="button"
                  onClick={() => onToggleOpen(entry.pid)}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${entry.label}`}
                  className="shrink-0 text-gray-500 hover:text-[#F28C28]"
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <span className="w-4 shrink-0" aria-hidden />
              )}
              <div className="min-w-0">
                {isModule ? (
                  <input
                    aria-label={`Display name for ${entry.label}`}
                    value={row.label}
                    maxLength={LABEL_MAX}
                    placeholder={entry.label}
                    onChange={(e) => onChange(entry.pid, (r) => ({ ...r, label: e.target.value.replace(/[<>]/g, "") }))}
                    className="w-full max-w-[240px] border border-gray-200 bg-white px-2 py-1 text-sm font-bold text-[#0B192C] focus:border-[#F28C28] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                ) : (
                  <p className="truncate text-sm font-semibold text-[#0B192C] dark:text-white">{entry.label}</p>
                )}
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {entry.kind === "menu" ? `${entry.children.length} options · ` : entry.kind === "data" ? "Live data · " : "Opens a page · "}
                  <span className="font-mono">{entry.pid}</span>
                  {entry.restricted ? " · only for some roles" : ""}
                </p>
              </div>
            </div>

            {entry.kind === "menu" && (
              <span title={meta.hint}>
                <EnterpriseStatusBadge status={meta.status} label={meta.label} size="sm" />
              </span>
            )}

            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={row.visible}
                onChange={(e) => onChange(entry.pid, (r) => ({ ...r, visible: e.target.checked }))}
              />
              Show
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={row.enabled}
                disabled={!row.visible}
                onChange={(e) => onChange(entry.pid, (r) => ({ ...r, enabled: e.target.checked }))}
              />
              Enabled
            </label>

            <span className="inline-flex">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMove(entry.pid, -1)}
                aria-label={`Move ${entry.label} up`}
                className="border border-gray-200 p-1 text-gray-600 hover:text-[#F28C28] disabled:opacity-30 dark:border-slate-700"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                disabled={index === rows.length - 1}
                onClick={() => onMove(entry.pid, 1)}
                aria-label={`Move ${entry.label} down`}
                className="-ml-px border border-gray-200 p-1 text-gray-600 hover:text-[#F28C28] disabled:opacity-30 dark:border-slate-700"
              >
                <ChevronDown size={14} />
              </button>
            </span>
          </div>
          {expandable && expanded && (
            <RowEditor
              rows={row.children}
              depth={depth + 1}
              open={open}
              onToggleOpen={onToggleOpen}
              onChange={onChange}
              onMove={onMove}
              parentHidden={hidden}
            />
          )}
        </li>
      );
    })}
  </ul>
);

/** What the menu will look like once published (for people who are allowed to see each option). */
const Preview: React.FC<{ rows: Row[] }> = ({ rows }) => {
  const shown = rows.filter((r) => r.visible);
  return (
    <ol className="space-y-2" aria-label="Assistant menu preview">
      {shown.map((row) => {
        const options = row.children.filter((c) => c.visible);
        return (
          <li key={row.entry.pid} className="border border-gray-200 p-2.5 dark:border-slate-700">
            <p className="text-sm font-bold text-[#0B192C] dark:text-white">{row.label.trim() || row.entry.label}</p>
            {!row.enabled ? (
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Temporarily unavailable</p>
            ) : (
              <p className="mt-0.5 text-[11px] text-gray-500">
                {options.length ? options.map((o) => (o.enabled ? o.entry.label : `${o.entry.label} (unavailable)`)).join(" · ") : "No visible options"}
              </p>
            )}
          </li>
        );
      })}
      {!shown.length && <li className="text-xs text-gray-500">Every module is hidden: the assistant would open with an empty menu.</li>}
    </ol>
  );
};

export const AssistantManagementPage: React.FC = () => {
  const { addNotification, confirmAction } = useNotifications();
  const [published, setPublished] = useState<PublishedConfig | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const config = await assistantConfigApi.loadForAdmin();
      setPublished(config);
      setRows(buildRows(new Map(config.entries.map((e) => [e.id, e]))));
      setPhase("ready");
    } catch (err) {
      setError(getErrorMessage(err, "The assistant configuration could not be loaded."));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const draftEntries = useMemo(() => toEntries(rows), [rows]);
  const savedEntries = useMemo(
    () => (published ? toEntries(buildRows(new Map(published.entries.map((e) => [e.id, e])))) : []),
    [published],
  );
  const dirty = JSON.stringify(draftEntries) !== JSON.stringify(savedEntries);
  // Entries saved earlier for options that no longer exist in code are dropped on the next publish.
  const stale = useMemo(() => {
    const known = new Set(toEntries(buildRows(new Map())).map((e) => e.id));
    return (published?.entries ?? []).filter((e) => !known.has(e.id)).length;
  }, [published]);
  const hiddenModules = rows.filter((r) => !r.visible).length;

  const toggleOpen = (pid: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(pid)) next.add(pid);
      return next;
    });

  const publish = async () => {
    if (!published) return;
    const ok = await confirmAction({
      title: "Publish the assistant menu?",
      message: `This changes the assistant for every visitor on every device${hiddenModules ? `, and hides ${hiddenModules} module${hiddenModules > 1 ? "s" : ""}` : ""}. The features themselves and people's access are not changed.`,
      confirmLabel: "Publish",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await assistantConfigApi.publish(draftEntries, published.revision);
      setPublished(next);
      setRows(buildRows(new Map(next.entries.map((e) => [e.id, e]))));
      addNotification("Assistant menu published", "Visitors will see it the next time they open the assistant.", "success");
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      addNotification(
        status === 409 ? "Someone else published first" : "Could not publish",
        status === 409 ? "Reload to see their changes, then apply yours again." : getErrorMessage(err, "The assistant menu was not changed."),
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const restoreDefault = async () => {
    const ok = await confirmAction({
      title: "Restore the default menu?",
      message: "All hiding, disabling, renaming and ordering is removed for every visitor. The features themselves are not changed.",
      confirmLabel: "Restore default",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await assistantConfigApi.reset();
      setPublished(next);
      setRows(buildRows(new Map()));
      addNotification("Default menu restored", "The assistant is back to its built-in menu.", "success");
    } catch (err) {
      addNotification("Could not restore", getErrorMessage(err, "The assistant menu was not changed."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-left">
      <EnterprisePageHeader
        title="Assistant Management"
        subtitle="Choose which modules and options the Tirvona Assistant shows, and in what order."
        icon={<Sparkles size={20} />}
        actions={
          <EnterpriseButton variant="outline" size="sm" icon={<RefreshCw size={13} />} onClick={load} disabled={busy}>
            Reload
          </EnterpriseButton>
        }
      />

      <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" role="note">
        <Info size={15} className="mt-0.5 shrink-0" />
        <p>
          <strong>Hiding or disabling here only changes the assistant menu.</strong> The feature, its pages and who may use it are not changed, and
          this page cannot give anyone access to data their role does not allow.
        </p>
      </div>

      {phase === "loading" && <p className="py-10 text-center text-sm text-gray-500">Loading the assistant configuration…</p>}

      {phase === "error" && (
        <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <p>{error}</p>
          <EnterpriseButton className="mt-3" size="sm" variant="outline" onClick={load}>
            Try again
          </EnterpriseButton>
        </div>
      )}

      {phase === "ready" && published && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="tv-surface xl:col-span-2">
            <div className="tv-surface-bar">
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {published.updatedAt
                  ? `Last published ${formatWhen(published.updatedAt)}${published.updatedByName ? ` by ${published.updatedByName}` : ""} · revision ${published.revision}`
                  : "Using the built-in menu (nothing published yet)"}
              </p>
              <EnterpriseButton variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={restoreDefault} disabled={busy || (!published.entries.length && !dirty)}>
                Restore default
              </EnterpriseButton>
            </div>
            <RowEditor rows={rows} depth={0} open={open} onToggleOpen={toggleOpen} onChange={(pid, change) => setRows((r) => updateAt(r, pid, change))} onMove={(pid, d) => setRows((r) => move(r, pid, d))} parentHidden={false} />
            {stale > 0 && (
              <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500 dark:border-slate-800">
                {stale} saved setting{stale > 1 ? "s" : ""} no longer match any assistant option and will be removed when you publish.
              </p>
            )}
            <div className="tv-surface-bar border-t border-gray-100 dark:border-slate-800">
              <p className="text-xs text-gray-500">{dirty ? "You have unpublished changes." : "No unpublished changes."}</p>
              <div className="flex gap-2">
                <EnterpriseButton variant="outline" size="sm" icon={<X size={13} />} disabled={!dirty || busy} onClick={() => setRows(buildRows(new Map(published.entries.map((e) => [e.id, e]))))}>
                  Cancel changes
                </EnterpriseButton>
                <EnterpriseButton size="sm" icon={<Save size={13} />} loading={busy} disabled={!dirty || busy} onClick={publish}>
                  Publish
                </EnterpriseButton>
              </div>
            </div>
          </div>

          <aside className="tv-surface h-fit">
            <div className="tv-surface-bar">
              <h2 className="text-sm font-bold text-[#0B192C] dark:text-white">Preview</h2>
              <span className="text-[11px] text-gray-500">after publishing</span>
            </div>
            <div className="p-4">
              <Preview rows={rows} />
              <p className="mt-3 text-[11px] text-gray-500">
                Each person still sees only the options their role allows. New options added in code appear at the end of their module until they are ordered here.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default AssistantManagementPage;
