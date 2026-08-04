import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanLine,
  LogIn,
  LogOut,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  ShieldCheck,
  Loader2,
  RotateCcw,
  Camera,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { parkingScanService } from "../services/parking.service";
import type {
  ParkingGuardContext,
  ParkingScanResult,
} from "../types/parking.types";
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  isCompleteScanInput,
  vehicleLabel,
} from "../utils/parkingFormat";
import ParkingStatusBadge from "../components/ParkingStatusBadge";

type Mode = "verify" | "check-in" | "check-out";

/**
 * Security Guard panel.
 *
 * Four actions and no more: verify a pass, check a vehicle in, check it out,
 * and look a plate up when a phone is dead. There is no delete, no pricing, no
 * refund and no management control anywhere on this screen — the API enforces
 * the same restriction, so the UI is not the only thing holding the line.
 *
 * Built for one-handed use at a gate: large targets, a persistent result card,
 * and an input that keeps focus so a hardware scanner (which types the token
 * and presses Enter) works without any tapping at all.
 */
export const ParkingGuardPanelPage: React.FC = () => {
  const [context, setContext] = useState<ParkingGuardContext | null>(null);
  const [locationId, setLocationId] = useState("");
  const [mode, setMode] = useState<Mode>("check-in");

  const [token, setToken] = useState("");
  const [plate, setPlate] = useState("");
  const [manualMode, setManualMode] = useState(false);

  const [result, setResult] = useState<ParkingScanResult | null>(null);
  const [resultTone, setResultTone] = useState<"success" | "error">("success");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [autoScan, setAutoScan] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // `busy` as a ref as well: the auto-fire timer and the camera loop both read
  // it outside React's render cycle, where the state value is a stale closure.
  const busyRef = useRef(false);
  const lastSubmittedRef = useRef("");

  // Which facilities this guard is posted to. A guard with one post gets it
  // preselected so the screen is immediately usable.
  useEffect(() => {
    (async () => {
      try {
        const res = await parkingScanService.myLocations();
        if (res.data?.success) {
          const ctx: ParkingGuardContext = {
            locations: res.data.data || [],
            roles: res.data.roles || [],
            capabilities: res.data.capabilities || [],
          };
          setContext(ctx);
          if (ctx.locations.length === 1) setLocationId(ctx.locations[0]._id);
        }
      } catch (err) {
        setMessage(
          getErrorMessage(
            err,
            "Could not load your assigned parking locations.",
          ),
        );
        setResultTone("error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keep the scanner input focused between scans — a hardware reader types into
  // whatever holds focus, so losing it means the next scan goes nowhere.
  const refocus = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  useEffect(() => {
    if (locationId && !manualMode) refocus();
  }, [locationId, manualMode, mode, refocus]);

  const reset = () => {
    setToken("");
    setPlate("");
    setResult(null);
    setMessage("");
    // Clear the guard against re-sending, so the SAME vehicle can legitimately
    // be scanned again — an entry followed by an exit, for instance.
    lastSubmittedRef.current = "";
    refocus();
  };

  /**
   * Camera scanning via the browser's own BarcodeDetector.
   *
   * Deliberately no QR library: the native detector is hardware-accelerated,
   * adds nothing to the bundle, and is present in the Chromium browsers a gate
   * terminal actually runs. Where it is missing the panel says so and the
   * scanner box, gate code and plate lookup all still work.
   */
  const cameraSupported =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    let timer = 0;
    // Held locally, not on a ref: cleanup must stop the stream THIS run opened,
    // whatever a later run may have replaced the ref with.
    let activeStream: MediaStream | null = null;
    const video = videoRef.current;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        activeStream = stream;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        const Detector = (
          window as unknown as {
            BarcodeDetector: new (options: { formats: string[] }) => {
              detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
            };
          }
        ).BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code"] });

        const tick = async () => {
          if (cancelled) return;
          if (video && video.readyState >= 2 && !busyRef.current) {
            try {
              const [found] = await detector.detect(video);
              const value = found?.rawValue?.trim();
              if (value && value !== lastSubmittedRef.current) {
                setToken(value);
                await submitToken(value);
              }
            } catch {
              // A single failed frame is normal while focusing; keep polling.
            }
          }
          if (!cancelled) timer = window.setTimeout(tick, 350);
        };
        void tick();
      } catch (err) {
        if (!cancelled)
          setCameraError(
            getErrorMessage(
              err,
              "Could not open the camera. Check the browser's camera permission.",
            ),
          );
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      // Release the device, or the camera light stays on after leaving.
      activeStream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [cameraOn, locationId, mode]);

  const submitToken = async (raw: string) => {
    const value = raw.trim();
    if (!value || !locationId || busyRef.current) return;

    // Remember what was sent so the auto-fire watcher cannot send it twice —
    // a duplicate check-in is a real scan against the booking, not a no-op.
    lastSubmittedRef.current = value;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    setResult(null);

    try {
      const call =
        mode === "check-in"
          ? parkingScanService.checkIn(value, locationId)
          : mode === "check-out"
            ? parkingScanService.checkOut(value, locationId)
            : parkingScanService.verify(value, locationId);

      const res = await call;

      if (res.data?.success) {
        setResult(res.data.data);
        setResultTone("success");
        setMessage(res.data.message || "Verified.");
      } else {
        setResultTone("error");
        setMessage(res.data?.message || "This pass could not be accepted.");
      }
    } catch (err) {
      setResultTone("error");
      setMessage(getErrorMessage(err, "This pass could not be accepted."));
    } finally {
      busyRef.current = false;
      setBusy(false);
      setToken("");
      refocus();
    }
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    void submitToken(token);
  };

  /**
   * Fire as soon as a whole code lands, so the gate needs no keypress or tap.
   *
   * A hardware reader that sends Enter already submitted via the form; this
   * covers the ones that do not, and pasting. The short delay lets a reader
   * finish typing — it emits characters one at a time, and an 8-character gate
   * code passes the completeness test at its last character either way.
   */
  useEffect(() => {
    if (!autoScan || manualMode || busy || !locationId) return;
    const value = token.trim();
    if (!isCompleteScanInput(value) || value === lastSubmittedRef.current)
      return;
    const timer = window.setTimeout(() => void submitToken(value), 250);
    return () => window.clearTimeout(timer);
    // submitToken closes over mode/locationId, both in the dependency list.
  }, [token, autoScan, manualMode, busy, locationId, mode]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() || !locationId || busy) return;

    setBusy(true);
    setMessage("");
    setResult(null);

    try {
      const res = await parkingScanService.lookupVehicle(
        plate.trim(),
        locationId,
      );
      if (res.data?.success) {
        setResult(res.data.data);
        setResultTone("success");
        setMessage("Booking found.");
      } else {
        setResultTone("error");
        setMessage(res.data?.message || "No active booking for this vehicle.");
      }
    } catch (err) {
      setResultTone("error");
      setMessage(getErrorMessage(err, "No active booking for this vehicle."));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-10 pb-20 space-y-4">
        <div className="h-24 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
        <div className="h-64 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
      </div>
    );
  }

  if (!context?.locations.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-16 pb-20 text-center space-y-3">
        <ShieldCheck
          size={40}
          className="text-gray-300 dark:text-slate-700 mx-auto"
        />
        <h1 className="font-extrabold text-lg text-[#0B192C] dark:text-white">
          No parking post assigned
        </h1>
        <p className="text-xs text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
          You are not currently assigned to a parking location. Ask your parking
          manager to add you to a post.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-16 lg:pb-24 pt-8 sm:pt-10 min-h-screen bg-gray-50/70 dark:bg-[#070F1B]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-4">
        <header className="space-y-1">
          <h1 className="inline-flex items-center gap-2.5 text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white">
            <span className="w-9 h-9 rounded-2xl bg-[#0A4DA6] text-white flex items-center justify-center shadow-md">
              <ScanLine size={18} className="stroke-[2.5]" />
            </span>
            Gate Scanner
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Scan a visitor&rsquo;s QR pass to verify, check in or check out.
          </p>
        </header>

        {/* Post selector */}
        {context.locations.length > 1 && (
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-4 shadow-sm">
            <label
              htmlFor="guard-location"
              className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5"
            >
              Your Post
            </label>
            <select
              id="guard-location"
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value);
                reset();
              }}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 cursor-pointer"
            >
              <option value="">Select a parking location…</option>
              {context.locations.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name}
                  {loc.address?.city ? ` — ${loc.address.city}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {locationId && (
          <>
            {/* Mode */}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: "check-in", label: "Entry", icon: LogIn },
                  { key: "check-out", label: "Exit", icon: LogOut },
                  { key: "verify", label: "Verify", icon: ShieldCheck },
                ] as { key: Mode; label: string; icon: typeof LogIn }[]
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMode(key);
                    reset();
                  }}
                  className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border transition-all cursor-pointer ${
                    mode === key
                      ? "bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/25"
                      : "bg-white dark:bg-[#0B192C] border-gray-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:border-[#0A4DA6]"
                  }`}
                >
                  <Icon size={20} className="stroke-[2.5]" />
                  <span className="text-[11px] font-extrabold">{label}</span>
                </button>
              ))}
            </div>

            {/* Scan / lookup */}
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-3 shadow-sm">
              {!manualMode ? (
                <form onSubmit={handleScan} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="scan-token"
                      className="block text-[10px] uppercase tracking-wider font-bold text-gray-400"
                    >
                      Scan the QR pass, or type the gate code
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={autoScan}
                        onChange={(e) => setAutoScan(e.target.checked)}
                        className="accent-[#0A4DA6]"
                      />
                      AUTO
                    </label>
                  </div>

                  {cameraSupported && (
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError("");
                        setCameraOn((on) => !on);
                      }}
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                        cameraOn
                          ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300"
                          : "bg-white dark:bg-[#0B192C] border-gray-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:border-[#0A4DA6]"
                      }`}
                    >
                      <Camera size={15} />
                      {cameraOn ? "Stop camera" : "Scan with camera"}
                    </button>
                  )}

                  {cameraOn && (
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                      <video
                        ref={videoRef}
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-40 border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                      </div>
                      <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-bold text-white/90">
                        Hold the pass inside the frame
                      </span>
                    </div>
                  )}

                  {cameraError && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      {cameraError}
                    </p>
                  )}
                  <input
                    id="scan-token"
                    ref={inputRef}
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    // Both inputs resolve to the same pass: the scanner reads
                    // the sealed token, and the gate code printed under the QR
                    // is accepted for a screen the scanner will not read.
                    placeholder="Point the scanner here, or type e.g. H24R-BGTB"
                    autoComplete="off"
                    autoFocus
                    className="w-full bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-[#0A4DA6]/30 focus:border-[#0A4DA6] rounded-2xl px-4 py-4 text-xs font-mono text-[#0B192C] dark:text-white placeholder:text-gray-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 transition-all"
                  />

                  <button
                    type="submit"
                    disabled={busy || !token.trim()}
                    className="w-full bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-extrabold px-6 py-3.5 rounded-full shadow-lg shadow-[#0A4DA6]/20 transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    {busy ? (
                      <Loader2
                        size={16}
                        className="animate-spin stroke-[2.5]"
                      />
                    ) : (
                      <ScanLine size={16} className="stroke-[2.5]" />
                    )}
                    {mode === "check-in"
                      ? "Grant Entry"
                      : mode === "check-out"
                        ? "Process Exit"
                        : "Verify Pass"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLookup} className="space-y-3">
                  <label
                    htmlFor="lookup-plate"
                    className="block text-[10px] uppercase tracking-wider font-bold text-gray-400"
                  >
                    Vehicle registration number
                  </label>
                  <input
                    id="lookup-plate"
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="MH12AB1234"
                    autoComplete="off"
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl px-4 py-4 text-base font-black tracking-widest uppercase text-center text-[#0B192C] dark:text-white placeholder:text-gray-300 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
                  />

                  <button
                    type="submit"
                    disabled={busy || !plate.trim()}
                    className="w-full bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-50 text-white text-sm font-extrabold px-6 py-3.5 rounded-full shadow-lg transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    {busy ? (
                      <Loader2
                        size={16}
                        className="animate-spin stroke-[2.5]"
                      />
                    ) : (
                      <Search size={16} className="stroke-[2.5]" />
                    )}
                    Find Booking
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setManualMode(!manualMode);
                  reset();
                }}
                className="w-full text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-[#0A4DA6] transition-colors cursor-pointer py-1"
              >
                {manualMode
                  ? "← Back to QR scanning"
                  : "QR won't scan? Look up by vehicle number"}
              </button>
            </section>

            {/* Result */}
            <AnimatePresence mode="wait">
              {message && (
                <motion.section
                  key={message + (result?.bookingReference || "")}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`rounded-[24px] border-2 overflow-hidden shadow-lg ${
                    resultTone === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                      : "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
                  }`}
                >
                  {/* Verdict banner — readable at arm's length */}
                  <div
                    className={`px-5 py-4 flex items-center gap-3 ${
                      resultTone === "success"
                        ? "bg-emerald-600"
                        : "bg-rose-600"
                    } text-white`}
                  >
                    {resultTone === "success" ? (
                      <CheckCircle2
                        size={26}
                        className="shrink-0 stroke-[2.5]"
                      />
                    ) : (
                      <XCircle size={26} className="shrink-0 stroke-[2.5]" />
                    )}
                    <p className="font-extrabold text-sm leading-snug">
                      {message}
                    </p>
                  </div>

                  {result && (
                    <div className="p-5 space-y-4">
                      {/* Plate — the single most important thing on this screen */}
                      <div className="text-center space-y-1">
                        <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                          Vehicle
                        </p>
                        <p className="text-2xl sm:text-3xl font-black tracking-widest text-[#0B192C] dark:text-white">
                          {result.vehicleNumber}
                        </p>
                        {result.vehicleModel && (
                          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                            {result.vehicleModel}
                          </p>
                        )}
                      </div>

                      {result.assignedSlotNumber && (
                        <div className="bg-[#0B192C] dark:bg-slate-900 text-white rounded-2xl px-5 py-4 text-center space-y-0.5">
                          <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-blue-200">
                            Direct to bay
                          </p>
                          <p className="text-2xl font-black tracking-wider">
                            {result.assignedSlotNumber}
                          </p>
                        </div>
                      )}

                      {result.overstay && result.overstay.amount > 0 && (
                        <div className="bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-2xl px-4 py-3 text-center space-y-0.5">
                          <p className="text-[10px] uppercase tracking-wider font-black text-amber-800 dark:text-amber-300">
                            Overstay collected
                          </p>
                          <p className="text-xl font-black text-amber-900 dark:text-amber-200">
                            {formatCurrency(result.overstay.amount)}
                          </p>
                          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                            {formatDuration(result.overstay.minutes)} over the
                            booked window
                          </p>
                        </div>
                      )}

                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                        {[
                          ["Booking", result.bookingReference],
                          ["Type", vehicleLabel(result.vehicleType)],
                          ["Driver", result.driverName || "—"],
                          ["Contact", result.driverPhone || "—"],
                          ["Booked entry", formatDateTime(result.entryAt)],
                          ["Booked exit", formatDateTime(result.exitAt)],
                          ...(result.checkedInAt
                            ? [
                                [
                                  "Checked in",
                                  formatDateTime(result.checkedInAt),
                                ] as [string, string],
                              ]
                            : []),
                          ...(result.checkedOutAt
                            ? [
                                [
                                  "Checked out",
                                  formatDateTime(result.checkedOutAt),
                                ] as [string, string],
                              ]
                            : []),
                          ...(result.actualDurationMinutes
                            ? [
                                [
                                  "Actual stay",
                                  formatDuration(result.actualDurationMinutes),
                                ] as [string, string],
                              ]
                            : []),
                        ].map(([label, value]) => (
                          <div key={label} className="pt-2 space-y-0.5 min-w-0">
                            <dt className="text-[9px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                              {label}
                            </dt>
                            <dd className="text-[11px] font-bold text-[#0B192C] dark:text-white break-words">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      <div className="flex items-center justify-between gap-2 pt-2">
                        {result.status && (
                          <ParkingStatusBadge status={result.status} />
                        )}
                        {result.location && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                            <MapPin size={10} className="stroke-[2.5]" />
                            {result.location}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="px-5 pb-5">
                    <button
                      type="button"
                      onClick={reset}
                      className="w-full bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-gray-200 text-xs font-extrabold px-5 py-3 rounded-full transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={14} className="stroke-[2.5]" />
                      Next Vehicle
                    </button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Scope reminder */}
            <p className="flex items-start gap-1.5 text-[10px] text-gray-400 font-medium leading-relaxed px-1">
              <AlertCircle size={11} className="shrink-0 mt-0.5 stroke-[2.5]" />
              You can only scan passes issued for your assigned parking
              location. Every scan is logged.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ParkingGuardPanelPage;
