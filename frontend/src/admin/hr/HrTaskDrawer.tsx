/**
 * One task in the right-side drawer: details, the actions the signed-in user may take (the
 * server decides: `permissions.work` for the assignee, `manage` for HR / the manager, `review`
 * for a reviewer who is not the assignee), and the full history. Shared by Daily Tasks and My Work.
 */
import React, { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { Field, PanelState, inputClass } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type { HrDirectoryEntry, HrTaskDetail, HrTaskEvent, HrTaskPriority } from "../../services/hr.service";
import { PRIORITIES, PriorityPill, TASK_STATUS_LABEL, TaskStatusPill, fmtDate, fmtDateTime } from "./hrUi";

type Mode = null | "progress" | "block" | "submit" | "approve" | "reject" | "reopen" | "cancel" | "reassign" | "edit" | "unblock";

const EVENT_LABEL: Record<string, string> = {
  created: "Assigned",
  edited: "Details edited",
  due_changed: "Deadline changed",
  started: "Started",
  progress: "Progress update",
  blocked: "Marked blocked",
  unblocked: "Unblocked",
  submitted: "Submitted for review",
  approved: "Approved",
  rejected: "Sent back",
  reopened: "Reopened",
  cancelled: "Cancelled",
  reassigned: "Reassigned",
  comment: "Comment",
};

const toLocalInput = (iso: string) => {
  // "YYYY-MM-DDTHH:mm" in IST for <input type="datetime-local">.
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => new Date(`${value}:00+05:30`).toISOString();

const eventDetail = (e: HrTaskEvent) => {
  if (e.type === "reassigned" && e.data) return `${e.data.fromEmployeeName || "previous employee"} → ${e.data.toEmployeeName || "new employee"}${e.message ? `: ${e.message}` : ""}`;
  if (e.type === "due_changed" && e.data) return `${fmtDateTime(e.data.from)} → ${fmtDateTime(e.data.to)}`;
  if (e.type === "edited" && e.data?.fields) return `Changed: ${(e.data.fields as string[]).join(", ")}`;
  if (e.type === "progress" && e.data?.progressPercent !== undefined) return `${e.data.progressPercent}% · ${e.message}`;
  return e.message;
};

export const HrTaskDrawer: React.FC<{
  taskId: string;
  /** Employees the caller may reassign to (empty hides reassignment choices). */
  directory?: HrDirectoryEntry[];
  onClose: () => void;
  onChanged: () => void;
}> = ({ taskId, directory = [], onClose, onChanged }) => {
  const [task, setTask] = useState<HrTaskDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [percent, setPercent] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [edit, setEdit] = useState({ title: "", description: "", expectedOutcome: "", priority: "medium" as HrTaskPriority, dueAt: "" });
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTask(null);
    setFailed(false);
    setMode(null);
    hrService.task(taskId).then(setTask).catch(() => setFailed(true));
  }, [taskId]);

  const open = (next: Mode) => {
    setMode(next);
    setText("");
    setLink("");
    setError("");
    setEmployeeId("");
    setPercent(task ? String(task.progressPercent) : "");
    if (next === "edit" && task)
      setEdit({ title: task.title, description: task.description, expectedOutcome: task.expectedOutcome, priority: task.priority, dueAt: toLocalInput(task.dueAt) });
  };

  const run = async (action: () => Promise<HrTaskDetail>) => {
    setBusy(true);
    try {
      const updated = await action();
      setTask(updated);
      setMode(null);
      onChanged();
    } catch {
      // The API layer shows why it failed.
    } finally {
      setBusy(false);
    }
  };

  const need = (min: number, message: string) => {
    if (text.trim().length < min) {
      setError(message);
      return false;
    }
    return true;
  };

  const submitMode = () => {
    if (!task) return;
    setError("");
    switch (mode) {
      case "progress": {
        const p = percent === "" ? undefined : Number(percent);
        if (p !== undefined && (!Number.isInteger(p) || p < 0 || p > 100)) return setError("Progress is a whole number from 0 to 100.");
        if (!need(2, "Write a short progress note.")) return;
        return run(() => hrService.taskProgress(task.id, { progressPercent: p, note: text.trim() }));
      }
      case "block":
        if (!need(3, "Say what is blocking the work.")) return;
        return run(() => hrService.blockTask(task.id, text.trim()));
      case "unblock":
        return run(() => hrService.unblockTask(task.id, text.trim() || undefined));
      case "submit":
        if (!need(3, "Summarise what was done.")) return;
        if (link && !/^https?:\/\//i.test(link.trim())) return setError("The deliverable link must start with http:// or https://");
        return run(() => hrService.submitTask(task.id, { completionSummary: text.trim(), deliverableUrl: link.trim() || undefined }));
      case "approve":
        return run(() => hrService.reviewTask(task.id, "approve", text.trim() || undefined));
      case "reject":
        if (!need(3, "Say what needs to change.")) return;
        return run(() => hrService.reviewTask(task.id, "reject", text.trim()));
      case "reopen":
        if (!need(3, "Give a reason for reopening.")) return;
        return run(() => hrService.reopenTask(task.id, text.trim()));
      case "cancel":
        if (!need(3, "Give a reason for cancelling.")) return;
        return run(() => hrService.cancelTask(task.id, text.trim()));
      case "reassign":
        if (!employeeId) return setError("Choose the employee to reassign to.");
        if (!need(3, "Give a reason for reassigning.")) return;
        return run(() => hrService.reassignTask(task.id, employeeId, text.trim()));
      case "edit":
        if (edit.title.trim().length < 3) return setError("The title needs at least 3 characters.");
        if (!edit.dueAt) return setError("Choose the due time.");
        return run(() =>
          hrService.updateTask(task.id, {
            title: edit.title.trim(),
            description: edit.description.trim(),
            expectedOutcome: edit.expectedOutcome.trim(),
            priority: edit.priority,
            // Only a due time the user actually changed (the input drops seconds).
            dueAt: edit.dueAt !== toLocalInput(task.dueAt) ? fromLocalInput(edit.dueAt) : undefined,
          }),
        );
    }
  };

  const addComment = async () => {
    if (!task || !comment.trim()) return;
    setBusy(true);
    try {
      setTask(await hrService.commentTask(task.id, comment.trim()));
      setComment("");
    } catch {
      // shown by the API layer
    } finally {
      setBusy(false);
    }
  };

  const p = task?.permissions;
  const s = task?.status;
  const actions: Array<{ key: Mode; label: string; variant?: "primary" | "outline" | "danger" | "success" }> = [];
  if (task && p) {
    if (p.work && s === "assigned") actions.push({ key: null, label: "Start work", variant: "primary" });
    if (p.work && (s === "assigned" || s === "in_progress")) {
      actions.push({ key: "progress", label: "Update progress", variant: "outline" });
      actions.push({ key: "submit", label: "Submit for review", variant: "primary" });
      actions.push({ key: "block", label: "Report blocked", variant: "outline" });
    }
    if ((p.work || p.manage) && s === "blocked") actions.push({ key: "unblock", label: "Unblock", variant: "outline" });
    if (p.review && s === "submitted") {
      actions.push({ key: "approve", label: "Approve", variant: "success" });
      actions.push({ key: "reject", label: "Send back", variant: "danger" });
    }
    if (p.manage && s !== "completed" && s !== "cancelled") actions.push({ key: "edit", label: "Edit", variant: "outline" });
    if (p.manage && (s === "assigned" || s === "in_progress" || s === "blocked") && directory.length) actions.push({ key: "reassign", label: "Reassign", variant: "outline" });
    if (p.manage && (s === "completed" || s === "cancelled")) actions.push({ key: "reopen", label: "Reopen", variant: "outline" });
    if (p.manage && s !== "completed" && s !== "cancelled") actions.push({ key: "cancel", label: "Cancel task", variant: "danger" });
  }

  const modeTitle: Record<Exclude<Mode, null>, string> = {
    progress: "Update progress",
    block: "Report that the task is blocked",
    unblock: "Unblock the task",
    submit: "Submit for review",
    approve: "Approve the submitted work",
    reject: "Send the work back",
    reopen: "Reopen the task",
    cancel: "Cancel the task",
    reassign: "Reassign to another employee",
    edit: "Edit task",
  };

  return (
    <EnterpriseModal
      isOpen
      onClose={busy ? () => undefined : onClose}
      title={task?.title ?? "Task"}
      subtitle={task ? `${task.taskNumber} · ${task.employeeName} (${task.employeeCode})` : undefined}
      maxWidth="2xl"
    >
      {failed ? (
        <PanelState state="missing" missingText="This task was not found, or you do not have access to it." />
      ) : !task ? (
        <PanelState state="loading" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusPill status={task.status} overdue={task.overdue} />
            <PriorityPill priority={task.priority} />
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div><dt className="text-[10px] uppercase font-black text-gray-400">Task date</dt><dd>{fmtDate(task.assignedDate)}</dd></div>
            <div><dt className="text-[10px] uppercase font-black text-gray-400">Due</dt><dd className={task.overdue ? "font-black text-rose-600" : ""}>{fmtDateTime(task.dueAt)}</dd></div>
            <div><dt className="text-[10px] uppercase font-black text-gray-400">Office / department</dt><dd>{task.officeName ?? "—"} · {task.departmentName ?? "—"}</dd></div>
            <div><dt className="text-[10px] uppercase font-black text-gray-400">Assigned by</dt><dd>{task.createdByName || "—"}</dd></div>
            <div><dt className="text-[10px] uppercase font-black text-gray-400">Progress</dt><dd>{task.progressPercent}%{task.progressNote ? ` · ${task.progressNote}` : ""}</dd></div>
            {task.reviewStatus !== "none" && (
              <div><dt className="text-[10px] uppercase font-black text-gray-400">Review</dt><dd>{task.reviewStatus.replace(/_/g, " ")}{task.reviewedByName ? ` by ${task.reviewedByName}` : ""}{task.rejectionCount ? ` · sent back ${task.rejectionCount}×` : ""}</dd></div>
            )}
          </dl>

          {task.description && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-black text-gray-400 mb-1">Description</p>
              <p className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300">{task.description}</p>
            </div>
          )}
          {task.expectedOutcome && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-black text-gray-400 mb-1">Expected outcome</p>
              <p className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300">{task.expectedOutcome}</p>
            </div>
          )}
          {task.status === "blocked" && task.blockedReason && (
            <p className="text-xs border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-2.5">Blocked: {task.blockedReason}</p>
          )}
          {task.completionSummary && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-black text-gray-400 mb-1">Completion summary</p>
              <p className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300">{task.completionSummary}</p>
              {task.deliverableUrl && (
                <a href={task.deliverableUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 mt-1 text-[11px] font-black text-[#F28C28]">
                  <ExternalLink size={11} /> Open deliverable
                </a>
              )}
            </div>
          )}
          {task.reviewComment && (
            <p className="text-xs border border-gray-100 dark:border-slate-800 p-2.5">Reviewer: {task.reviewComment}</p>
          )}

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <EnterpriseButton
                  key={a.label}
                  size="sm"
                  variant={a.variant}
                  disabled={busy}
                  onClick={() => (a.label === "Start work" ? run(() => hrService.startTask(task.id)) : open(a.key))}
                >
                  {a.label}
                </EnterpriseButton>
              ))}
            </div>
          )}

          {mode && (
            <section className="border border-gray-100 dark:border-slate-800 p-3 space-y-3" aria-label={modeTitle[mode]}>
              <p className="text-xs font-black">{modeTitle[mode]}</p>
              {mode === "edit" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Title" required className="sm:col-span-2">
                    <input className={inputClass} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={160} />
                  </Field>
                  <Field label="Due (IST)" required>
                    <input type="datetime-local" className={inputClass} value={edit.dueAt} onChange={(e) => setEdit({ ...edit, dueAt: e.target.value })} />
                  </Field>
                  <Field label="Priority">
                    <select className={inputClass} value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value as HrTaskPriority })}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </Field>
                  <Field label="Description" className="sm:col-span-2">
                    <textarea className={`${inputClass} min-h-[72px]`} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} maxLength={4000} />
                  </Field>
                  <Field label="Expected outcome" className="sm:col-span-2">
                    <textarea className={`${inputClass} min-h-[56px]`} value={edit.expectedOutcome} onChange={(e) => setEdit({ ...edit, expectedOutcome: e.target.value })} maxLength={1000} />
                  </Field>
                </div>
              ) : (
                <>
                  {mode === "progress" && (
                    <Field label="Progress (%)">
                      <input className={inputClass} inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, "").slice(0, 3))} />
                    </Field>
                  )}
                  {mode === "reassign" && (
                    <Field label="Reassign to" required>
                      <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                        <option value="">Choose employee</option>
                        {directory.filter((d) => d.id !== task.employeeId).map((d) => (
                          <option key={d.id} value={d.id}>{d.fullName} ({d.employeeCode})</option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field
                    label={
                      mode === "progress" ? "What has been done" :
                      mode === "block" ? "What is blocking it" :
                      mode === "submit" ? "Completion summary" :
                      mode === "approve" ? "Comment (optional)" :
                      mode === "unblock" ? "Note (optional)" :
                      mode === "reject" ? "What needs to change" : "Reason"
                    }
                    required={mode !== "approve" && mode !== "unblock"}
                  >
                    <textarea className={`${inputClass} min-h-[72px]`} value={text} onChange={(e) => setText(e.target.value)} maxLength={mode === "submit" ? 4000 : 1000} />
                  </Field>
                  {mode === "submit" && (
                    <Field label="Deliverable link (optional)">
                      <input className={inputClass} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" maxLength={500} />
                    </Field>
                  )}
                </>
              )}
              {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <EnterpriseButton size="sm" variant="outline" onClick={() => setMode(null)} disabled={busy}>Back</EnterpriseButton>
                <EnterpriseButton size="sm" variant={mode === "cancel" || mode === "reject" ? "danger" : "primary"} onClick={submitMode} disabled={busy}>
                  {busy ? "Saving…" : "Confirm"}
                </EnterpriseButton>
              </div>
            </section>
          )}

          <section aria-labelledby="task-history" className="space-y-2">
            <p id="task-history" className="text-[10px] uppercase tracking-wider font-black text-gray-400">History</p>
            <ol className="space-y-2">
              {task.history.map((e) => (
                <li key={e.id} className="border-l-2 border-[#F28C28]/40 pl-3">
                  <p className="text-xs font-black">
                    {EVENT_LABEL[e.type] ?? e.type}
                    {e.toStatus && e.fromStatus && e.fromStatus !== e.toStatus && e.type !== "comment" ? ` →${TASK_STATUS_LABEL[e.toStatus as keyof typeof TASK_STATUS_LABEL] ?? e.toStatus}` : ""}
                  </p>
                  <p className="text-[10px] text-gray-400">{e.actorName || "—"} · {fmtDateTime(e.createdAt)}</p>
                  {eventDetail(e) && <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{eventDetail(e)}</p>}
                </li>
              ))}
            </ol>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <label className="sr-only" htmlFor={`comment-${task.id}`}>Add a comment</label>
              <input id={`comment-${task.id}`} className={inputClass} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" maxLength={2000} />
              <EnterpriseButton size="sm" variant="outline" onClick={addComment} disabled={busy || !comment.trim()}>Comment</EnterpriseButton>
            </div>
          </section>
        </div>
      )}
    </EnterpriseModal>
  );
};

export default HrTaskDrawer;
