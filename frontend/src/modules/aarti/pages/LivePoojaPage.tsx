import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CalendarClock,
  ExternalLink,
  Eye,
  Flame,
  MapPin,
  Radio,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { livePoojaService } from "../services/aarti.service";
import type { AartiStream, AartiStreamWall } from "../types/aarti.types";
import { formatDateTime } from "../utils/aartiFormat";

type WallStream = AartiStream & { isLiveNow: boolean; state: string };

const LiveBadge: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span
    className={`inline-flex items-center gap-1.5 bg-rose-600 text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full shadow-md ${className}`}
  >
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
    </span>
    LIVE
  </span>
);

const StreamTile: React.FC<{
  stream: WallStream;
  onSelect: (stream: WallStream) => void;
  active?: boolean;
}> = ({ stream, onSelect, active }) => (
  <button
    type="button"
    onClick={() => onSelect(stream)}
    className={`group w-full text-left bg-white dark:bg-[#0B192C] border rounded-[24px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col h-full cursor-pointer ${
      active
        ? "border-[#0A4DA6] ring-2 ring-[#0A4DA6]/20"
        : "border-gray-100 dark:border-slate-800"
    }`}
  >
    <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-slate-900 shrink-0">
      {stream.thumbnailUrl ? (
        <img
          src={stream.thumbnailUrl}
          alt={stream.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-slate-700">
          <Video size={30} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

      {stream.isLiveNow ? (
        <LiveBadge className="absolute top-3 left-3" />
      ) : stream.state === "upcoming" ? (
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-sm text-[#0B192C] dark:text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md">
          <CalendarClock size={10} className="stroke-[2.5]" />
          Upcoming
        </span>
      ) : null}

      {stream.viewCount ? (
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-sm text-[#0B192C] dark:text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
          <Eye size={10} className="stroke-[2.5]" />
          {stream.viewCount}
        </span>
      ) : null}
    </div>

    <div className="p-4 space-y-1.5 flex-1">
      <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-snug line-clamp-2">
        {stream.title}
      </h3>
      <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
        <MapPin size={11} className="shrink-0 stroke-[2.5]" />
        <span className="truncate">
          {[stream.venueName || stream.deity, stream.city]
            .filter(Boolean)
            .join(", ") || "Aarti"}
        </span>
      </p>
      {stream.state === "upcoming" && stream.startsAt ? (
        <p className="text-[10px] font-bold text-[#E58C28] pt-0.5">
          {formatDateTime(stream.startsAt)}
        </p>
      ) : null}
    </div>
  </button>
);

const Rail: React.FC<{
  title: string;
  icon: React.ReactNode;
  streams: WallStream[];
  selectedId?: string;
  onSelect: (stream: WallStream) => void;
}> = ({ title, icon, streams, selectedId, onSelect }) =>
  streams.length ? (
    <section className="space-y-4">
      <h2 className="inline-flex items-center gap-2 font-extrabold text-base sm:text-lg text-[#0B192C] dark:text-white">
        {icon}
        {title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {streams.map((stream, index) => (
          <motion.div
            key={stream._id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
          >
            <StreamTile
              stream={stream}
              onSelect={onSelect}
              active={selectedId === stream._id}
            />
          </motion.div>
        ))}
      </div>
    </section>
  ) : null;

export const LivePoojaPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [wall, setWall] = useState<AartiStreamWall | null>(null);
  const [selected, setSelected] = useState<WallStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await livePoojaService.wall({ q, city, limit: 48 });
      const data = response.data as AartiStreamWall;
      setWall(data);
      setSelected((current) => {
        if (current) {
          const refreshed = data.data.find((row) => row._id === current._id);
          if (refreshed) return refreshed;
        }
        return data.live[0] ?? data.data[0] ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err, "We could not load live poojas right now."));
      setWall(null);
    } finally {
      setLoading(false);
    }
  }, [q, city]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  // A stream's live window closes on a clock, not on a user action, so the wall
  // refreshes itself rather than leaving a stale "LIVE" badge on screen.
  useEffect(() => {
    const timer = setInterval(load, 120_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (city) next.city = city;
    setSearchParams(next, { replace: true });
  }, [q, city, setSearchParams]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    wall?.data.forEach((row) => {
      if (row.city) set.add(row.city);
    });
    return [...set].sort();
  }, [wall]);

  const live = wall?.live ?? [];
  const upcoming = wall?.upcoming ?? [];
  const recorded = useMemo(
    () => (wall?.data ?? []).filter((row) => row.state === "recorded"),
    [wall],
  );

  return (
    <div className="pb-16 lg:pb-24 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Live Pooja Darshan
          </p>
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Watch the aarti as it happens, streamed by the ashrams themselves.
            Every stream here is verified by Tirvona before it appears.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800/80 rounded-[24px] p-3 sm:p-4 shadow-lg shadow-[#0B192C]/5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <label
                htmlFor="live-pooja-search"
                className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
              >
                Aarti, Deity or Ghat
              </label>
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
                />
                <input
                  id="live-pooja-search"
                  type="text"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Ganga Aarti, Mahakaleshwar, Vrindavan…"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
                />
              </div>
            </div>

            <div className="sm:w-56 shrink-0">
              <label
                htmlFor="live-pooja-city"
                className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
              >
                City
              </label>
              <div className="relative">
                <MapPin
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
                />
                <select
                  id="live-pooja-city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all cursor-pointer appearance-none"
                >
                  <option value="">All cities</option>
                  {cities.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {wall ? (
            <div className="flex flex-wrap items-center gap-4 pt-3 mt-3 border-t border-gray-100 dark:border-slate-800">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                {wall.counts.live} live now
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                <CalendarClock size={12} className="stroke-[2.5]" />
                {wall.counts.upcoming} upcoming
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                <Video size={12} className="stroke-[2.5]" />
                {wall.counts.recorded} channels
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-10">
        {error ? (
          <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5 stroke-[2.5]" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        ) : loading && !wall ? (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
              <div className="aspect-video bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
              <div className="h-64 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-64 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]"
                />
              ))}
            </div>
          </div>
        ) : !wall || wall.data.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-3 shadow-sm">
            <Radio
              size={36}
              className="text-gray-300 dark:text-slate-700 mx-auto"
            />
            <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
              No live poojas published yet
            </h4>
            <p className="text-xs text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
              Ashrams are onboarding their streams. Check back soon, or try a
              different city.
            </p>
          </div>
        ) : (
          <>
            {selected ? (
              <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
                <div className="rounded-[24px] overflow-hidden border border-gray-100 dark:border-slate-800 bg-black shadow-sm">
                  <div className="aspect-video w-full">
                    {selected.embedUrl ? (
                      <iframe
                        key={selected._id}
                        src={selected.embedUrl}
                        title={selected.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        className="h-full w-full border-0"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400 dark:text-slate-700">
                        <Video size={40} />
                      </div>
                    )}
                  </div>
                </div>

                <aside className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-extrabold text-lg text-[#0B192C] dark:text-white leading-snug">
                      {selected.title}
                    </h2>
                    {selected.isLiveNow ? <LiveBadge className="shrink-0" /> : null}
                  </div>

                  {selected.deity ? (
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[#0B192C] dark:text-gray-200">
                      <Flame size={12} className="text-[#D4AF37] stroke-[2.5]" />
                      {selected.deity}
                    </p>
                  ) : null}

                  {selected.venueName || selected.city ? (
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      <MapPin size={12} className="stroke-[2.5] shrink-0" />
                      {[selected.venueName, selected.city, selected.state]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}

                  {selected.startsAt ? (
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      <CalendarClock size={12} className="stroke-[2.5] shrink-0" />
                      {formatDateTime(selected.startsAt)}
                    </p>
                  ) : null}

                  {selected.viewCount ? (
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      <Eye size={12} className="stroke-[2.5] shrink-0" />
                      {selected.viewCount} views
                    </p>
                  ) : null}

                  {selected.description ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed whitespace-pre-line pt-1">
                      {selected.description}
                    </p>
                  ) : null}

                  <a
                    href={selected.streamUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="w-full inline-flex items-center justify-center gap-2 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-[#0A4DA6] dark:text-blue-300 text-xs font-extrabold px-4 py-2.5 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer !mt-5"
                  >
                    <ExternalLink size={14} className="stroke-[2.5]" />
                    Open on{" "}
                    {selected.provider === "youtube"
                      ? "YouTube"
                      : selected.provider === "facebook"
                        ? "Facebook"
                        : "source"}
                  </a>
                </aside>
              </div>
            ) : null}

            <Rail
              title="Live right now"
              icon={<span className="h-2.5 w-2.5 rounded-full bg-rose-500" />}
              streams={live}
              selectedId={selected?._id}
              onSelect={setSelected}
            />
            <Rail
              title="Starting soon"
              icon={
                <CalendarClock size={17} className="text-[#E58C28] stroke-[2.5]" />
              }
              streams={upcoming}
              selectedId={selected?._id}
              onSelect={setSelected}
            />
            <Rail
              title="All channels"
              icon={<Video size={17} className="text-gray-400 stroke-[2.5]" />}
              streams={recorded}
              selectedId={selected?._id}
              onSelect={setSelected}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default LivePoojaPage;
