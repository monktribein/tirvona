import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock, Copy, ExternalLink, MapPin, MessageSquare, Phone, RefreshCw, User, Video } from "lucide-react";
import { ConsultationChatModal } from "../components/ConsultationChatModal";
import { PujaProcessButton } from "../components/PujaProcessGuide";
import { YouTubePlayer } from "../components/YouTubeLive";
import { consultationService, providerSelfService, pujaBookingService } from "../services/provider.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorNotice,
  Field,
  Modal,
  Notice,
  PageContainer,
  PageHeader,
  Pagination,
  Skeleton,
  StatTile,
  StatusBadge,
  cx,
  formatMinor,
  inputClass,
  statusLabel,
} from "../ui";

const PAGE_SIZE = 20;

/** Booking states in which a YouTube live link can be set (the server checks this too). */
const LIVE_STATUSES = ["CONFIRMED", "PROVIDER_ACCEPTED", "PREPARATION_IN_PROGRESS", "READY_FOR_FULFILMENT", "IN_PROGRESS"];

const BOOKING_FILTERS = [
  "PAYMENT_PENDING",
  "CONFIRMED",
  "PROVIDER_ACCEPTED",
  "PREPARATION_IN_PROGRESS",
  "READY_FOR_FULFILMENT",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_PROVIDER",
  "CANCELLED_BY_OPS",
];

/** How each server command is presented. The server decides which commands are available (`nextActions`). */
const COMMAND_META: Record<string, { label: string; kind: "primary" | "secondary" | "danger" | "confirm" }> = {
  accept: { label: "Accept booking", kind: "primary" },
  start_preparation: { label: "Start preparation", kind: "primary" },
  mark_ready: { label: "Mark ready", kind: "primary" },
  start: { label: "Begin ceremony", kind: "primary" },
  complete: { label: "Mark completed", kind: "confirm" },
  decline: { label: "Decline booking", kind: "danger" },
  cancel_by_provider: { label: "Cancel booking", kind: "danger" },
};

const REASON_LABEL: Record<string, string> = {
  UNAVAILABLE: "I am not available at that time",
  OUT_OF_SERVICE_AREA: "Outside my service area",
  PERSONAL_EMERGENCY: "Personal or health emergency",
  OTHER: "Other reason",
};

const CONSULT_CANCEL_REASONS: Array<[string, string]> = [
  ["EXPERT_UNAVAILABLE", "I am unavailable"],
  ["SCHEDULING_CONFLICT", "Scheduling conflict"],
  ["OTHER", "Other reason"],
];

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "Time to be confirmed";

type Command = { command: string; reasons: string[] | null };

export const ProviderBookingsPage: React.FC = () => {
  const [tab, setTab] = useState<"bookings" | "consultations">("bookings");
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingTotal, setBookingTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // A command that needs a reason or a confirmation.
  const [pending, setPending] = useState<{ booking: any; action: Command } | null>(null);
  const [reason, setReason] = useState("");

  // Consultation lifecycle dialogs
  const [completeTarget, setCompleteTarget] = useState<any | null>(null);
  const [expertNotes, setExpertNotes] = useState("");
  const [noShow, setNoShow] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [consultReason, setConsultReason] = useState(CONSULT_CANCEL_REASONS[0][0]);

  // YouTube live link
  const [streamBooking, setStreamBooking] = useState<any | null>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [streamSaving, setStreamSaving] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Chat
  const [chatConsultation, setChatConsultation] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [bookRes, sumRes, consultRes] = await Promise.allSettled([
      pujaBookingService.list({ role: "provider", status: statusFilter || undefined, page }),
      providerSelfService.bookingSummary(),
      providerSelfService.listConsultations(),
    ]);
    if (bookRes.status === "fulfilled" && bookRes.value.data?.success) {
      setBookings(bookRes.value.data.data || []);
      setBookingTotal((bookRes.value.data as any).meta?.total ?? bookRes.value.data.data?.length ?? 0);
    } else if (bookRes.status === "rejected") {
      setError(getErrorMessage(bookRes.reason, "Failed to load bookings."));
    }
    if (sumRes.status === "fulfilled" && sumRes.value.data?.success) setSummary(sumRes.value.data.data);
    if (consultRes.status === "fulfilled" && consultRes.value.data?.success) setConsultations(consultRes.value.data.data || []);
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runCommand = async (booking: any, command: string, reasonCode?: string) => {
    setBusyKey(`${booking.id}:${command}`);
    try {
      await pujaBookingService.transition(booking.id, { command, reasonCode });
      toast.success("Booking updated.");
      setPending(null);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the booking."));
    } finally {
      setBusyKey(null);
    }
  };

  const onCommand = (booking: any, action: Command) => {
    const meta = COMMAND_META[action.command];
    if (meta?.kind === "danger" || meta?.kind === "confirm" || action.reasons?.length) {
      setReason(action.reasons?.[0] ?? "");
      setPending({ booking, action });
    } else {
      runCommand(booking, action.command);
    }
  };

  const consultCall = async (id: string, label: string, call: () => Promise<unknown>, done?: () => void) => {
    setBusyKey(`c:${id}`);
    try {
      await call();
      toast.success(label);
      done?.();
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the consultation."));
    } finally {
      setBusyKey(null);
    }
  };

  const openStream = (b: any) => {
    setStreamBooking(b);
    setStreamUrl(b.liveStream?.youtubeUrl ?? "");
    setStreamError(null);
  };

  const saveStream = async () => {
    if (!streamBooking) return;
    setStreamSaving(true);
    setStreamError(null);
    try {
      const res = await pujaBookingService.setLiveStream(streamBooking.id, streamUrl.trim());
      const updated = res.data?.data;
      if (updated) setStreamBooking(updated);
      toast.success("YouTube live link saved. The devotee has been told.");
      loadData();
    } catch (err) {
      setStreamError(getErrorMessage(err, "Could not save the YouTube link."));
    } finally {
      setStreamSaving(false);
    }
  };

  const pendingMeta = pending ? COMMAND_META[pending.action.command] : null;
  const pageCount = Math.max(1, Math.ceil(bookingTotal / PAGE_SIZE));
  const unreadTotal = consultations.reduce((n, c) => n + (c.unreadCount || 0), 0);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Fulfilment"
        title="Bookings & consultations"
        description="Accept ceremonies, coordinate with devotees and track each puja through to completion."
        actions={
          <Button variant="outline" onClick={loadData} loading={loading && !!summary} aria-label="Refresh">
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {summary && (
        <section aria-label="Booking summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile icon={<CalendarDays size={16} />} label="Awaiting you" value={summary.awaitingAcceptance ?? 0} hint="Paid, not yet accepted" />
          <StatTile icon={<Clock size={16} />} label="Today" value={summary.todayCount ?? 0} hint="Ceremonies scheduled today" />
          <StatTile icon={<Video size={16} />} label="In progress" value={summary.inProgress ?? 0} />
          <StatTile icon={<User size={16} />} label="Awaiting payment" value={summary.awaitingPayment ?? 0} hint="Slots on hold" />
        </section>
      )}

      <div className="flex flex-col gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div role="tablist" aria-label="Bookings and consultations" className="flex gap-2">
          {(
            [
              ["bookings", `Puja bookings (${bookingTotal})`],
              ["consultations", `Consultations (${consultations.length})${unreadTotal ? ` · ${unreadTotal} unread` : ""}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              onClick={() => setTab(key)}
              className={cx(
                "min-h-[44px] rounded-full px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
                tab === key ? "bg-[#0B192C] text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "bookings" && (
          <div className="flex items-center gap-2">
            <label htmlFor="booking-status" className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              Status
            </label>
            <select
              id="booking-status"
              className={cx(inputClass, "!w-auto")}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {BOOKING_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <ErrorNotice message={error} onRetry={loadData} />}

      {loading && !bookings.length && !consultations.length ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : tab === "bookings" ? (
        <div role="tabpanel" id="panel-bookings" aria-labelledby="tab-bookings" className="space-y-4">
          {bookings.length === 0 ? (
            <Card>
              <EmptyState
                icon={<CalendarDays size={26} />}
                title={statusFilter ? "No bookings with this status" : "No bookings yet"}
                description="Bookings appear here as soon as devotees reserve a slot from your public profile."
              />
            </Card>
          ) : (
            <>
              <ul className="space-y-4">
                {bookings.map((b) => {
                  const fee = (b.pricing?.lines ?? []).find((l: any) => l.code === "PROVIDER_SERVICE");
                  const title = b.offering?.title || b.ritual?.titles?.en || "Puja ceremony";
                  const actions: Command[] = b.nextActions ?? [];
                  const place = b.serviceLocation ? [b.serviceLocation.line1, b.serviceLocation.city, b.serviceLocation.state].filter(Boolean).join(", ") : null;
                  return (
                    <li key={b.id}>
                      <Card as="article" className="space-y-4 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span>Ref {b.bookingNumber}</span>
                              <StatusBadge status={b.status} />
                            </p>
                            <h2 className="break-words text-base font-extrabold text-[#0B192C] dark:text-white">{title}</h2>
                          </div>
                          {fee && (
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Your fee</p>
                              <p className="text-lg font-black text-[#0B192C] dark:text-white">{formatMinor(fee.amountMinor, b.pricing?.currency || "INR")}</p>
                            </div>
                          )}
                        </div>

                        <ul className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 text-sm text-gray-700 sm:grid-cols-3 dark:border-slate-800 dark:text-gray-300">
                          <li className="flex items-center gap-2">
                            <Clock size={15} className="shrink-0 text-[#B45309]" aria-hidden="true" />
                            {when(b.scheduledStartAt)}
                          </li>
                          <li className="flex items-center gap-2">
                            <User size={15} className="shrink-0 text-[#F28C28]" aria-hidden="true" />
                            <span className="min-w-0 break-words">{b.customer?.name || "Devotee"}</span>
                          </li>
                          {b.customer?.phone && (
                            <li className="flex items-center gap-2">
                              <Phone size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
                              {b.customer.phone}
                              {!b.customer.contactVisible && <span className="text-xs text-gray-500">(shown in full after payment)</span>}
                            </li>
                          )}
                        </ul>
                        {b.deliveryMode === "LIVE_ONLINE" && (
                          <p className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-black text-white">
                            <Video size={13} aria-hidden="true" />
                            Live online katha · stream it on YouTube at the booked time
                          </p>
                        )}
                        {place && (
                          <p className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <span className="break-words">{place}</span>
                          </p>
                        )}
                        {b.notes && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-slate-900 dark:text-gray-300">Note from devotee: {b.notes}</p>}

                        {(actions.length > 0 || LIVE_STATUSES.includes(b.status)) && (
                          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-slate-800">
                            {actions
                              .filter((a) => COMMAND_META[a.command]?.kind !== "danger")
                              .map((a) => {
                                const meta = COMMAND_META[a.command];
                                if (!meta) return null;
                                return (
                                  <Button key={a.command} variant={meta.kind === "confirm" ? "secondary" : "primary"} loading={busyKey === `${b.id}:${a.command}`} onClick={() => onCommand(b, a)}>
                                    {meta.label}
                                  </Button>
                                );
                              })}
                            {LIVE_STATUSES.includes(b.status) && (
                              <Button variant="outline" onClick={() => openStream(b)}>
                                <Video size={16} aria-hidden="true" />
                                {b.liveStream ? "YouTube live link" : "Add YouTube live link"}
                              </Button>
                            )}
                            <PujaProcessButton ritualId={b.ritual?.id} title={b.ritual?.titles?.en} viewer="PANDIT" className="!min-h-[44px]" />
                            {actions
                              .filter((a) => COMMAND_META[a.command]?.kind === "danger")
                              .map((a) => (
                                <Button key={a.command} variant="outline" className="sm:ml-auto !border-rose-300 !text-rose-700" onClick={() => onCommand(b, a)}>
                                  {COMMAND_META[a.command].label}
                                </Button>
                              ))}
                          </div>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </>
          )}
        </div>
      ) : (
        <div role="tabpanel" id="panel-consultations" aria-labelledby="tab-consultations" className="space-y-4">
          {consultations.length === 0 ? (
            <Card>
              <EmptyState icon={<MessageSquare size={26} />} title="No consultations yet" description="Questions and consultation requests from devotees appear here." />
            </Card>
          ) : (
            <ul className="space-y-4">
              {consultations.map((c) => {
                const open = c.status !== "COMPLETED" && c.status !== "CANCELLED" && c.status !== "NO_SHOW";
                return (
                  <li key={c.id}>
                    <Card as="article" className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">{c.consultationType === "JYOTISHI" ? "Jyotish guidance" : "Pandit guidance"} · {c.channel}</p>
                          <h2 className="break-words text-base font-extrabold text-[#0B192C] dark:text-white">{c.customer?.name || "Devotee"}</h2>
                          <p className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                            <Clock size={14} aria-hidden="true" />
                            {when(c.scheduledStartAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.unreadCount > 0 && <StatusBadge tone="accent" label={`${c.unreadCount} unread`} />}
                          <StatusBadge status={c.status} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-slate-800">
                        <Button variant="secondary" onClick={() => setChatConsultation(c)}>
                          <MessageSquare size={16} aria-hidden="true" />
                          Open chat
                        </Button>
                        {c.status === "REQUESTED" && (
                          <Button loading={busyKey === `c:${c.id}`} onClick={() => consultCall(c.id, "Consultation confirmed.", () => consultationService.schedule(c.id, {}))}>
                            Confirm time
                          </Button>
                        )}
                        {c.status === "SCHEDULED" && (
                          <Button loading={busyKey === `c:${c.id}`} onClick={() => consultCall(c.id, "Consultation started.", () => consultationService.start(c.id))}>
                            Start
                          </Button>
                        )}
                        {(c.status === "SCHEDULED" || c.status === "IN_PROGRESS") && (
                          <Button variant="outline" onClick={() => { setCompleteTarget(c); setExpertNotes(""); setNoShow(false); }}>
                            Finish
                          </Button>
                        )}
                        {(c.status === "REQUESTED" || c.status === "SCHEDULED") && (
                          <Button variant="outline" className="sm:ml-auto !border-rose-300 !text-rose-700" onClick={() => { setCancelTarget(c); setConsultReason(CONSULT_CANCEL_REASONS[0][0]); }}>
                            Cancel
                          </Button>
                        )}
                        {!open && <span className="text-sm text-gray-500">This consultation is closed.</span>}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Reason / confirmation for a booking command ──────────────── */}
      <ConfirmDialog
        open={!!pending}
        title={pendingMeta?.label ?? "Confirm"}
        tone={pendingMeta?.kind === "danger" ? "danger" : "primary"}
        confirmLabel={pendingMeta?.label ?? "Confirm"}
        loading={!!pending && busyKey === `${pending.booking.id}:${pending.action.command}`}
        description={
          pendingMeta?.kind === "danger"
            ? "The devotee is notified and any amount they paid is refunded. This cannot be undone."
            : "Please confirm this ceremony has taken place."
        }
        onCancel={() => setPending(null)}
        onConfirm={() => pending && runCommand(pending.booking, pending.action.command, pending.action.reasons?.length ? reason : undefined)}
      >
        {pending?.action.reasons?.length ? (
          <Field label="Reason" required>
            <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
              {pending.action.reasons.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABEL[r] ?? statusLabel(r)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </ConfirmDialog>

      {/* ── Consultation: finish ──────────────────────────────────────── */}
      <Modal
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        title="Finish consultation"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCompleteTarget(null)}>
              Back
            </Button>
            <Button
              loading={!!completeTarget && busyKey === `c:${completeTarget.id}`}
              onClick={() =>
                completeTarget &&
                consultCall(
                  completeTarget.id,
                  noShow ? "Marked as not attended." : "Consultation completed.",
                  () => consultationService.complete(completeTarget.id, { expertNotes: expertNotes.trim() || undefined, noShow: noShow || undefined }),
                  () => setCompleteTarget(null),
                )
              }
            >
              {noShow ? "Mark not attended" : "Complete"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Private notes" hint="Only you can see these.">
            <textarea rows={4} className={inputClass} value={expertNotes} onChange={(e) => setExpertNotes(e.target.value)} />
          </Field>
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" className="h-4 w-4" checked={noShow} onChange={(e) => setNoShow(e.target.checked)} />
            The devotee did not attend
          </label>
        </div>
      </Modal>

      {/* ── Consultation: cancel ──────────────────────────────────────── */}
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this consultation?"
        confirmLabel="Cancel consultation"
        description="The devotee is notified. This cannot be undone."
        loading={!!cancelTarget && busyKey === `c:${cancelTarget.id}`}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() =>
          cancelTarget &&
          consultCall(cancelTarget.id, "Consultation cancelled.", () => consultationService.cancel(cancelTarget.id, consultReason), () => setCancelTarget(null))
        }
      >
        <Field label="Reason" required>
          <select className={inputClass} value={consultReason} onChange={(e) => setConsultReason(e.target.value)}>
            {CONSULT_CANCEL_REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </ConfirmDialog>

      {/* ── YouTube live link ─────────────────────────────────────────── */}
      <Modal
        open={!!streamBooking}
        onClose={() => setStreamBooking(null)}
        title="Live on YouTube"
        description={streamBooking ? `${streamBooking.offering?.title || streamBooking.ritual?.titles?.en || "Puja"} · ${when(streamBooking.scheduledStartAt)}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setStreamBooking(null)}>
              Close
            </Button>
            <Button onClick={saveStream} loading={streamSaving} disabled={!streamUrl.trim()}>
              Save link
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Start a live stream on your YouTube channel (YouTube app or YouTube Studio → Go live), then paste the stream link here. The devotee watches it
            inside their Tirvona booking.
          </p>
          {streamError && <ErrorNotice message={streamError} />}
          <Field label="YouTube live link" hint="e.g. https://youtube.com/live/abc123xyz00 or https://www.youtube.com/@yourchannel/live">
            <input
              type="url"
              inputMode="url"
              className={inputClass}
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://youtube.com/live/..."
              data-autofocus
            />
          </Field>
          {streamBooking?.liveStream && (
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500">What the devotee sees now</p>
              <YouTubePlayer stream={streamBooking.liveStream} title={streamBooking.ritual?.titles?.en} />
            </div>
          )}
        </div>
      </Modal>

      {chatConsultation && (
        <ConsultationChatModal
          isOpen
          onClose={() => {
            setChatConsultation(null);
            loadData();
          }}
          consultationId={chatConsultation.id}
          recipientName={chatConsultation.customer?.name || "Devotee"}
          recipientSubtitle="Consultation"
          consultationStatus={chatConsultation.status}
          scheduledTime={chatConsultation.scheduledStartAt}
        />
      )}
    </PageContainer>
  );
};

export default ProviderBookingsPage;
