import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Loader2,
  Pencil,
  Plus,
  Radio,
  Send,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { aartiOwnerService } from "../services/aarti.service";
import type {
  AartiSession,
  AartiStream,
  AartiStreamProvider,
} from "../types/aarti.types";
import {
  formatDateTime,
  sessionStatusLabel,
  sessionStatusStyle,
} from "../utils/aartiFormat";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import FileUploader from "../../../components/FileUploader";
import { getAllStates, getDistricts } from "india-state-district";
import { useNotifications } from "../../../contexts/NotificationContext";

interface Ashram {
  _id: string;
  name: string;
  address?: { city?: string; state?: string };
}

const INDIA_STATES = getAllStates();
const stateForLocation = (stateName?: string, city?: string) =>
  INDIA_STATES.find((state) => state.name === stateName) ??
  INDIA_STATES.find((state) => city && getDistricts(state.code).includes(city));

const emptyStream = {
  ashramId: "",
  sessionId: "",
  title: "",
  description: "",
  deity: "",
  provider: "youtube" as AartiStreamProvider,
  streamUrl: "",
  thumbnailUrl: "",
  venueName: "",
  city: "",
  state: "",
  startsAt: "",
  endsAt: "",
};

const toLocalInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const OwnerLivePoojaPage: React.FC = () => {
  const { subKey } = useParams<{ subKey?: string }>();
  const { confirmAction } = useNotifications();
  const [ashrams, setAshrams] = useState<Ashram[]>([]);
  const [sessions, setSessions] = useState<AartiSession[]>([]);
  const [streams, setStreams] = useState<AartiStream[]>([]);
  const [statusFilter, setStatusFilter] = useState(
    subKey && subKey !== "all" ? subKey : "",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AartiStream | null>(null);
  const [form, setForm] = useState({ ...emptyStream });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatusFilter(subKey && subKey !== "all" ? subKey : "");
  }, [subKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await aartiOwnerService.listStreams({
        status: statusFilter || undefined,
      });
      setStreams(response.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load your live poojas."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    Promise.all([
      aartiOwnerService.ashrams(),
      aartiOwnerService.listSessions({ status: "approved", limit: 100 }),
    ])
      .then(([ashramRes, sessionRes]) => {
        setAshrams(ashramRes.data?.data ?? []);
        setSessions(sessionRes.data?.data ?? []);
      })
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setEditing(null);
    const ashram = ashrams[0];
    const state = stateForLocation(
      ashram?.address?.state,
      ashram?.address?.city,
    );
    const districts = state ? getDistricts(state.code) : [];
    const city = ashram?.address?.city ?? "";
    setForm({
      ...emptyStream,
      ashramId: ashram?._id ?? "",
      state: state?.name ?? "",
      city: districts.includes(city) ? city : districts[0] ?? city,
    });
    setShowForm(true);
  };

  const openEdit = (stream: AartiStream) => {
    setEditing(stream);
    const state = stateForLocation(stream.state, stream.city);
    const districts = state ? getDistricts(state.code) : [];
    const city = stream.city ?? "";
    setForm({
      ashramId:
        typeof stream.ashramId === "object"
          ? stream.ashramId._id
          : (stream.ashramId ?? ""),
      sessionId:
        typeof stream.sessionId === "object" && stream.sessionId
          ? (stream.sessionId as AartiSession)._id
          : ((stream.sessionId as string) ?? ""),
      title: stream.title,
      description: stream.description ?? "",
      deity: stream.deity ?? "",
      provider: stream.provider,
      streamUrl: stream.streamUrl,
      thumbnailUrl: stream.thumbnailUrl ?? "",
      venueName: stream.venueName ?? "",
      city: districts.includes(city) ? city : districts[0] ?? city,
      state: state?.name ?? stream.state ?? "",
      startsAt: toLocalInput(stream.startsAt),
      endsAt: toLocalInput(stream.endsAt),
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        sessionId: form.sessionId || undefined,
        thumbnailUrl: form.thumbnailUrl || undefined,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      };
      if (editing) {
        const { ashramId: _ignored, ...rest } = payload;
        await aartiOwnerService.updateStream(editing._id, rest);
      } else {
        await aartiOwnerService.createStream(payload);
      }
      setShowForm(false);
      await load();
    } catch {
      // Reported by the toast interceptor.
    } finally {
      setSaving(false);
    }
  };

  const submit = async (stream: AartiStream) => {
    await aartiOwnerService.submitStream(stream._id).catch(() => undefined);
    await load();
  };

  const toggleLive = async (stream: AartiStream) => {
    await aartiOwnerService
      .setStreamLive(stream._id, !stream.isLive)
      .catch(() => undefined);
    await load();
  };

  const remove = async (stream: AartiStream) => {
    const confirmed = await confirmAction({
      title: "Delete Live Pooja",
      message: `Delete "${stream.title}"? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    await aartiOwnerService.deleteStream(stream._id).catch(() => undefined);
    await load();
  };

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Live Pooja"
        subtitle="Add your stream link and its schedule. It shows on the public Live Pooja page once Tirvona approves it."
        icon={<Radio size={22} />}
        actions={
          <>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="pending">In review</option>
            <option value="approved">Live</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={15} /> New stream
          </button>
          </>
        }
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
      ) : streams.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-12 text-center space-y-3">
          <Video size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            No live poojas yet
          </h3>
          <p className="mt-1 text-xs text-gray-400 font-semibold leading-relaxed">
            Paste a YouTube or Facebook live link and set the aarti window.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {streams.map((stream) => {
            const tone = sessionStatusStyle(stream.status);
            return (
              <div
                key={stream._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm flex flex-col overflow-hidden"
              >
                <div className="relative aspect-video bg-slate-900">
                  {stream.thumbnailUrl ? (
                    <img
                      src={stream.thumbnailUrl}
                      alt={stream.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-500">
                      <Video size={30} />
                    </div>
                  )}
                  {stream.isLiveNow ? (
                    <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Live
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-bold text-[#0B192C] dark:text-white">
                      {stream.title}
                    </h3>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black tracking-wider ${tone}`}
                    >
                      {sessionStatusLabel(stream.status)}
                    </span>
                  </div>

                  <p className="text-[10px] font-bold text-gray-400">
                    {[stream.venueName, stream.city].filter(Boolean).join(", ") ||
                      "—"}
                  </p>
                  {stream.startsAt ? (
                    <p className="text-[10px] font-bold text-gray-400">
                      {formatDateTime(stream.startsAt)}
                    </p>
                  ) : null}
                  {stream.status === "rejected" && stream.rejectionReason ? (
                    <p className="text-[10px] font-bold text-rose-600">{stream.rejectionReason}</p>
                  ) : null}

                  <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                    <button
                      type="button"
                      onClick={() => openEdit(stream)}
                      className="inline-flex items-center gap-1 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:text-[#0A4DA6] hover:border-[#0A4DA6] text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    {["draft", "rejected"].includes(stream.status) ? (
                      <button
                        type="button"
                        onClick={() => submit(stream)}
                        className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer"
                      >
                        <Send size={12} /> Submit
                      </button>
                    ) : null}
                    {stream.status === "approved" ? (
                      <button
                        type="button"
                        onClick={() => toggleLive(stream)}
                        className="inline-flex items-center gap-1 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:text-[#0A4DA6] hover:border-[#0A4DA6] text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer"
                      >
                        <Radio size={12} />
                        {stream.isLive ? "Mark offline" : "Mark live"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => remove(stream)}
                      className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#0B192C] dark:text-white">
                {editing ? "Edit live pooja" : "New live pooja"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                    Ashram
                  </span>
                  <select
                    disabled={!!editing}
                    value={form.ashramId}
                    onChange={(event) => {
                      const ashram = ashrams.find(
                        (item) => item._id === event.target.value,
                      );
                      setForm({
                        ...form,
                        ashramId: event.target.value,
                        state: ashram?.address?.state ?? form.state,
                        city: ashram?.address?.city ?? form.city,
                      });
                    }}
                    className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all disabled:opacity-60"
                  >
                    <option value="">Select an ashram</option>
                    {ashrams.map((ashram) => (
                      <option key={ashram._id} value={ashram._id}>
                        {ashram.name}
                      </option>
                    ))}
                  </select>
                </label>

              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Title
                </span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="e.g. Ganga Aarti Live — Har Ki Pauri"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Platform
                </span>
                <select
                  value={form.provider}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      provider: event.target.value as AartiStreamProvider,
                    })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                >
                  <option value="youtube">YouTube</option>
                  <option value="facebook">Facebook</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="custom">Custom embed</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Linked aarti (optional)
                </span>
                <select
                  value={form.sessionId}
                  onChange={(event) =>
                    setForm({ ...form, sessionId: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                >
                  <option value="">Not linked</option>
                  {sessions.map((session) => (
                    <option key={session._id} value={session._id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Stream URL
                </span>
                <input
                  value={form.streamUrl}
                  onChange={(event) =>
                    setForm({ ...form, streamUrl: event.target.value })
                  }
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
                <span className="text-[10px] font-medium text-gray-400">
                  The playable embed is derived automatically for supported providers.
                </span>
              </label>

              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2 rounded-2xl border border-gray-100 dark:border-slate-800 p-3">
                {import.meta.env.DEV ? <label className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                    Thumbnail image URL (development only)
                  </span>
                  <input
                    type="url"
                    value={form.thumbnailUrl}
                    onChange={(event) =>
                      setForm({ ...form, thumbnailUrl: event.target.value })
                    }
                    placeholder="https://…"
                    className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                  />
                </label> : null}
                <div>
                  <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1 block mb-1">
                    Or upload an image
                  </span>
                  <FileUploader
                    folder="live-pooja"
                    label="Upload thumbnail"
                    currentUrl={form.thumbnailUrl}
                    onUploaded={(url) =>
                      setForm({ ...form, thumbnailUrl: url })
                    }
                  />
                </div>
                {!form.thumbnailUrl.trim() ? (
                  <p className="sm:col-span-2 text-[10px] font-semibold text-amber-600">
                    Add one image using either the URL field or upload button.
                  </p>
                ) : null}
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Starts at
                </span>
                <input
                  type="datetime-local"
                  required
                  value={form.startsAt}
                  onChange={(event) =>
                    setForm({ ...form, startsAt: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Ends at
                </span>
                <input
                  type="datetime-local"
                  min={form.startsAt}
                  value={form.endsAt}
                  onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Venue
                </span>
                <input
                  value={form.venueName}
                  onChange={(event) =>
                    setForm({ ...form, venueName: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  State
                </span>
                <select
                  value={form.state}
                  onChange={(event) => {
                    const state = INDIA_STATES.find(
                      (item) => item.name === event.target.value,
                    );
                    setForm({
                      ...form,
                      state: event.target.value,
                      city: state ? getDistricts(state.code)[0] ?? "" : "",
                    });
                  }}
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                >
                  <option value="">Select state</option>
                  {INDIA_STATES.map((state) => (
                    <option key={state.code} value={state.name}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  City / District
                </span>
                <select
                  value={form.city}
                  onChange={(event) =>
                    setForm({ ...form, city: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                >
                  <option value="">Select city / district</option>
                  {(INDIA_STATES.find((state) => state.name === form.state)
                    ? getDistricts(
                        INDIA_STATES.find(
                          (state) => state.name === form.state,
                        )!.code,
                      )
                    : []
                  ).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Description
                </span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-gray-500 dark:text-gray-400 hover:text-[#0A4DA6] text-xs font-extrabold px-4 py-2.5 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={
                  saving ||
                  !form.title.trim() ||
                  !form.streamUrl.trim() ||
                  !form.thumbnailUrl.trim() ||
                  !form.startsAt ||
                  (!!form.endsAt && form.endsAt < form.startsAt) ||
                  (!editing && !form.ashramId)
                }
                className="inline-flex items-center gap-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Save stream
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default OwnerLivePoojaPage;
