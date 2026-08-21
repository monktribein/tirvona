import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Radio, Sparkles, Video } from "lucide-react";
import {
  aartiDiscoveryService,
  livePoojaService,
} from "../services/aarti.service";
import type { AartiSession, AartiStream } from "../types/aarti.types";
import AartiCard from "./AartiCard";

type WallStream = AartiStream & { isLiveNow: boolean; state: string };

const SectionHeading: React.FC<{
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaTo: string;
}> = ({ title, subtitle, ctaLabel, ctaTo }) => (
  <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
    <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
      {title}
    </p>
    <div className="flex items-center justify-center gap-2.5 my-1.5">
      <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
      <Sparkles size={14} className="text-[#E58C28] fill-[#E58C28] shrink-0" />
      <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
    </div>
    <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
      {subtitle}
    </p>
    <Link
      to={ctaTo}
      className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
    >
      {ctaLabel} <ArrowRight size={14} />
    </Link>
  </div>
);

/**
 * The two homepage strips behind the "Arati Booking" and "Live Pooja" tiles.
 *
 * Each strip hides itself entirely when the platform has nothing approved yet —
 * an empty rail of placeholder cards on the homepage would read as real
 * inventory that does not exist.
 */
export const HomeAartiSections: React.FC = () => {
  const [sessions, setSessions] = useState<AartiSession[]>([]);
  const [streams, setStreams] = useState<WallStream[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      aartiDiscoveryService.search({ limit: 8, sort: "recommended" }),
      livePoojaService.wall({ limit: 8 }),
    ]).then(([sessionResult, streamResult]) => {
      if (cancelled) return;
      if (sessionResult.status === "fulfilled")
        setSessions(sessionResult.value.data?.data ?? []);
      if (streamResult.status === "fulfilled") {
        const wall = streamResult.value.data;
        // Live first, then whatever else is published — the strip should lead
        // with something a devotee can actually watch right now.
        setStreams([...(wall?.live ?? []), ...(wall?.data ?? [])]
          .filter(
            (row, index, all) =>
              all.findIndex((other) => other._id === row._id) === index,
          )
          .slice(0, 8));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {sessions.length ? (
        <section
          id="aarti-booking"
          className="order-4 w-full max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20"
        >
          <SectionHeading
            title="Aarti Booking"
            subtitle="Reserve a verified pass for Ganga Aarti, Bhasma Aarti, Mangala Aarti and more — issued by the ashram, scanned at the gate."
            ctaLabel="Browse All Aartis"
            ctaTo="/aarti"
          />

          <div className="flex gap-4 overflow-x-auto pb-6 pt-2 scrollbar-none">
            {sessions.slice(0, 4).map((session) => (
              <div
                key={session._id}
                className="flex-shrink-0"
                style={{ width: "clamp(200px, 48vw, 220px)" }}
              >
                <AartiCard session={session} compact />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {streams.length ? (
        <section
          id="live-pooja"
          className="order-3 w-full max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20"
        >
          <SectionHeading
            title="Live Pooja"
            subtitle="Watch the aarti as it happens, streamed by the ashrams themselves and verified by Tirvona."
            ctaLabel="Watch Live Pooja"
            ctaTo="/live-pooja"
          />

          <div className="flex gap-4 overflow-x-auto pb-6 pt-2 scrollbar-none">
            {streams.slice(0, 4).map((stream) => (
              <Link
                key={stream._id}
                to="/live-pooja"
                className="group flex-shrink-0 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                style={{ width: "clamp(200px, 48vw, 220px)" }}
              >
                <div
                  className="relative overflow-hidden bg-gray-100 dark:bg-slate-900"
                  style={{ height: "clamp(170px, 40vw, 190px)" }}
                >
                  {stream.thumbnailUrl ? (
                    <img
                      src={stream.thumbnailUrl}
                      alt={stream.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-slate-700">
                      <Video size={30} />
                    </div>
                  )}
                  {stream.isLiveNow ? (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      Live
                    </span>
                  ) : stream.state === "upcoming" ? (
                    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                      Upcoming
                    </span>
                  ) : null}
                </div>

                <div className="p-4 text-center flex min-h-[72px] flex-col items-center justify-center">
                  <h4 className="w-full truncate font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight">
                    {stream.title}
                  </h4>
                  <p className="mt-1 flex max-w-full items-center justify-center gap-1 text-[11px] text-gray-400 font-bold">
                    <Radio size={11} className="shrink-0" />
                    <span className="truncate">
                      {stream.venueName || stream.deity || "Aarti"}
                      {stream.city ? ` · ${stream.city}` : ""}
                    </span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
};

export default HomeAartiSections;
