import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useNotifications } from "../../../contexts/NotificationContext";
import {
  AlertCircle,
  Check,
  Clock,
  ExternalLink,
  FileCheck,
  Flame,
  Loader2,
  MapPin,
  Radio,
  X,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { aartiAdminService } from "../../../modules/aarti/services/aarti.service";
import type {
  AartiSession,
  AartiStream,
} from "../../../modules/aarti/types/aarti.types";
import {
  formatClock,
  formatDateTime,
  formatSchedule,
} from "../../../modules/aarti/utils/aartiFormat";

export const AartiApprovalsPage: React.FC = () => {
  const { approvalType } = useParams<{ approvalType?: string }>();
  const { promptAction } = useNotifications();
  const [sessions, setSessions] = useState<AartiSession[]>([]);
  const [streams, setStreams] = useState<AartiStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await aartiAdminService.approvals(50);
      setSessions(response.data?.data?.sessions ?? []);
      setStreams(response.data?.data?.streams ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load the approval queue."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decideSession = async (
    session: AartiSession,
    decision: "approve" | "reject",
  ) => {
    const reason =
      decision === "reject"
        ? await promptAction({
            title: "Reject Aarti",
            message: `Explain why "${session.name}" is being rejected.`,
            placeholder: "Reason for rejection",
            confirmLabel: "Reject",
            required: true,
            tone: "danger",
          })
        : undefined;
    if (decision === "reject" && reason === null) return;
    setBusyId(session._id);
    await aartiAdminService
      .reviewSession(session._id, decision, reason ?? undefined)
      .catch(() => undefined);
    setBusyId("");
    await load();
  };

  const decideStream = async (
    stream: AartiStream,
    decision: "approve" | "reject",
  ) => {
    const reason =
      decision === "reject"
        ? await promptAction({
            title: "Reject Live Pooja",
            message: `Explain why "${stream.title}" is being rejected.`,
            placeholder: "Reason for rejection",
            confirmLabel: "Reject",
            required: true,
            tone: "danger",
          })
        : undefined;
    if (decision === "reject" && reason === null) return;
    setBusyId(stream._id);
    await aartiAdminService
      .reviewStream(stream._id, decision, reason ?? undefined)
      .catch(() => undefined);
    setBusyId("");
    await load();
  };

  const showAartis = approvalType !== "live-pooja";
  const showLivePoojas = approvalType !== "aarti";
  const visibleSessions = showAartis ? sessions : [];
  const visibleStreams = showLivePoojas ? streams : [];
  const pending = visibleSessions.length + visibleStreams.length;
  const pageTitle =
    showLivePoojas && !showAartis ? "Live Pooja Approvals" : "Aarti Approvals";
  const emptyDescription =
    showLivePoojas && !showAartis
      ? "New live pooja submissions will appear here."
      : "New aarti submissions will appear here.";

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title={pageTitle}
        subtitle={`${pending} item${pending === 1 ? "" : "s"} waiting for review. Nothing reaches the public site until it is approved here.`}
        icon={<FileCheck size={22} />}
        badgeText="Super Admin"
      />

      {error ? (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm font-semibold">
          <AlertCircle size={16} /> {error}
        </div>
      ) : loading ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-12 flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-[#0A4DA6]" />
          <span className="text-sm font-bold text-gray-400">Loading…</span>
        </div>
      ) : pending === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-12 text-center space-y-3">
          <Check size={36} className="text-emerald-400 mx-auto" />
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            The queue is clear
          </h3>
          <p className="mt-1 text-xs text-gray-400 font-semibold leading-relaxed">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <>
          {visibleSessions.length ? (
            <section>
              <h2 className="mb-3 inline-flex items-center gap-2 text-base font-black text-[#0B192C] dark:text-white">
                <Flame size={18} className="text-[#0A4DA6] stroke-[2.5]" /> Aartis ({visibleSessions.length})
              </h2>
              <div className="space-y-3">
                {visibleSessions.map((session) => {
                  const ashram =
                    typeof session.ashramId === "object" ? session.ashramId : null;
                  return (
                    <div
                      key={session._id}
                      className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
                            {session.name}
                          </h3>
                          <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
                            {ashram?.name ?? "—"} · {session.kindLabel ?? session.kind}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1.5">
                              <Clock size={13} />
                              {formatClock(session.startTime)} ·{" "}
                              {formatSchedule(session.daysOfWeek)}
                            </span>
                            {session.venue?.city ? (
                              <span className="flex items-center gap-1.5">
                                <MapPin size={13} />
                                {[session.venue.name, session.venue.city]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            ) : null}
                          </div>
                          {session.description ? (
                            <p className="mt-2 line-clamp-2 text-[11px] font-medium text-gray-400 leading-relaxed">
                              {session.description}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            disabled={busyId === session._id}
                            onClick={() => decideSession(session, "approve")}
                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === session._id}
                            onClick={() => decideSession(session, "reject")}
                            className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-extrabold px-4 py-2 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {visibleStreams.length ? (
            <section>
              <h2 className="mb-3 inline-flex items-center gap-2 text-base font-black text-[#0B192C] dark:text-white">
                <Radio size={18} className="text-[#0A4DA6] stroke-[2.5]" /> Live poojas ({visibleStreams.length})
              </h2>
              <div className="space-y-3">
                {visibleStreams.map((stream) => {
                  const ashram =
                    typeof stream.ashramId === "object" ? stream.ashramId : null;
                  return (
                    <div
                      key={stream._id}
                      className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 gap-4">
                          {stream.thumbnailUrl ? (
                            <img
                              src={stream.thumbnailUrl}
                              alt={stream.title}
                              className="h-20 w-32 shrink-0 rounded-2xl object-cover"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
                              {stream.title}
                            </h3>
                            <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
                              {ashram?.name ?? "—"} · {stream.provider}
                            </p>
                            <a
                              href={stream.streamUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#0A4DA6] dark:text-blue-400 hover:underline"
                            >
                              Open the stream to verify
                              <ExternalLink size={12} />
                            </a>
                            {stream.startsAt ? (
                              <p className="mt-1 text-[10px] font-bold text-gray-400">
                                {formatDateTime(stream.startsAt)}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            disabled={busyId === stream._id}
                            onClick={() => decideStream(stream, "approve")}
                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === stream._id}
                            onClick={() => decideStream(stream, "reject")}
                            className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-extrabold px-4 py-2 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
};

export default AartiApprovalsPage;
