/**
 * Provider Dashboard: the provider's workspace.
 * Route: /provider/dashboard
 *
 * Real backend data only. A 404 from GET /api/v2/provider/profile means the provider has not onboarded yet.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarCheck,
  Check,
  Clock,
  Hourglass,
  Landmark,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";
import { consultationService, providerSelfService, providerWalletService, pujaBookingService, verificationCaseService } from "../services/provider.service";
import type { ProviderProfile, VerificationCase } from "../types/provider.types";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  LinkButton,
  LoadingBlock,
  PageContainer,
  QuickPill,
  SectionCard,
  StatTile,
  StatusBadge,
  Skeleton,
  buttonClass,
  cx,
  formatMinor,
  inputClass,
} from "../ui";

// What the server reports as missing from a profile, with where to fix it.
const MISSING_STEP: Record<string, { label: string; to: string }> = {
  displayName: { label: "Add your display name", to: "/provider/profile" },
  bio: { label: "Write a short biography (at least 30 characters)", to: "/provider/profile" },
  avatar: { label: "Add a profile photo", to: "/provider/profile" },
  languages: { label: "Choose the languages you chant and speak", to: "/provider/profile" },
  specializations: { label: "List your specialties", to: "/provider/profile" },
  location: { label: "Set your home city", to: "/provider/profile" },
  offering: { label: "Add your first puja offering", to: "/provider/offerings" },
  availability: { label: "Set your weekly availability", to: "/provider/availability" },
  identityVerification: { label: "Complete identity verification", to: "/provider/verification" },
};

const LISTING_BLOCKER: Record<string, string> = {
  STATUS_NOT_ACTIVE: "Your profile is not live yet.",
  IDENTITY_NOT_VERIFIED: "Identity verification is needed before you can be listed.",
  VERIFICATION_EXPIRED: "Your identity verification has expired. Submit it again.",
  NOTHING_TO_OFFER: "Add at least one active offering or enable consultations.",
};

const UPCOMING_STATUSES = ["CONFIRMED", "PROVIDER_ACCEPTED", "PREPARATION_IN_PROGRESS", "READY_FOR_FULFILMENT", "IN_PROGRESS"];

const offeringName = (o: any) => o.title || o.ritual?.titles?.en || Object.values(o.ritual?.titles ?? {})[0] || "Puja service";
const offeringFee = (o: any) => formatMinor(o.indicativeFee?.amountMinor ?? o.baseProfessionalFeeMinor ?? null, o.indicativeFee?.currency || o.currency || "INR");
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "Time to be confirmed");

export const ProviderDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<(ProviderProfile & Record<string, any>) | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [offerings, setOfferings] = useState<any[]>([]);
  const [verificationCases, setVerificationCases] = useState<VerificationCase[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any | null>(null);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [changingLive, setChangingLive] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await providerSelfService.getProfile();
      if (res.data?.success) setProfile(res.data.data as any);
      else setProfileError((res.data as any)?.message || "Failed to load profile.");
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setProfile(null);
      } else {
        setProfileError(getErrorMessage(err, "Failed to load your provider profile."));
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadSecondaryData = useCallback(async () => {
    setSecondaryLoading(true);
    const [offeringsRes, verifyRes, bookingsRes, consultRes, walletRes] = await Promise.allSettled([
      providerSelfService.listOfferings(),
      verificationCaseService.list(),
      pujaBookingService.list({ role: "provider" }),
      consultationService.list(),
      providerWalletService.summary(),
    ]);
    if (offeringsRes.status === "fulfilled" && offeringsRes.value.data?.success) setOfferings(offeringsRes.value.data.data || []);
    if (verifyRes.status === "fulfilled" && verifyRes.value.data?.success) setVerificationCases(verifyRes.value.data.data || []);
    if (bookingsRes.status === "fulfilled" && bookingsRes.value.data?.success) setBookings(bookingsRes.value.data.data || []);
    if (consultRes.status === "fulfilled" && consultRes.value.data?.success) setConsultations(consultRes.value.data.data || []);
    if (walletRes.status === "fulfilled" && walletRes.value.data?.success) setWallet(walletRes.value.data.data);
    setSecondaryLoading(false);
    setLoadedOnce(true);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);
  useEffect(() => {
    if (profile) loadSecondaryData();
  }, [profile, loadSecondaryData]);

  if (profileLoading) {
    return (
      <PageContainer>
        <LoadingBlock label="Loading your workspace" />
      </PageContainer>
    );
  }

  if (profileError) {
    return (
      <PageContainer className="max-w-xl">
        <ErrorNotice message={profileError} onRetry={loadProfile} />
      </PageContainer>
    );
  }

  // ── Not onboarded yet ────────────────────────────────────────────────
  if (!profile) {
    return (
      <PageContainer className="max-w-3xl">
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#0B192C] via-[#F28C28] to-[#0B192C]" aria-hidden="true" />
          <div className="mx-auto max-w-xl px-6 py-10 text-center sm:py-14">
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#FFF4E5] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#B45309] dark:bg-[#F28C28]/15 dark:text-[#F28C28]">
              <Sparkles size={12} aria-hidden="true" />
              Tirvona provider network
            </p>
            <h1 className="mb-3 font-serif text-2xl font-black text-[#0B192C] sm:text-3xl dark:text-white">Set up your provider profile</h1>
            <p className="mb-8 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Join Tirvona's verified Pandits, Acharyas, Purohits and Jyotishis. Complete your profile, list your services and start receiving bookings.
            </p>
            <ol className="mb-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
              {[
                { title: "Profile", sub: "Languages and traditions" },
                { title: "Services", sub: "Pujas and consultations" },
                { title: "Verification", sub: "Earn your verified badge" },
              ].map((s, i) => (
                <li key={s.title} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#0B192C] text-xs font-bold text-white">{i + 1}</span>
                  <p className="text-sm font-bold text-[#0B192C] dark:text-white">{s.title}</p>
                  <p className="text-xs text-gray-500">{s.sub}</p>
                </li>
              ))}
            </ol>
            <Button onClick={() => navigate("/provider/profile")} className="px-8">
              Start setup
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  // ── Workspace ────────────────────────────────────────────────────────
  const latestCase = [...verificationCases].sort(
    (a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime(),
  )[0];
  const caseStage = !latestCase
    ? null
    : latestCase.status === "OPEN"
    ? latestCase.submitted || latestCase.submittedAt
      ? "Awaiting review"
      : "Draft"
    : latestCase.status;

  const isVerified = profile.verificationLevel !== "UNVERIFIED";
  const hasOfferings = offerings.length > 0;
  const isLive = profile.status === "ACTIVE";
  const suspended = profile.status === "SUSPENDED";
  const canGoLive = !isLive && !suspended && isVerified && hasOfferings;

  const now = Date.now();
  const upcoming = bookings
    .filter((b) => UPCOMING_STATUSES.includes(b.status) && (!b.scheduledStartAt || new Date(b.scheduledStartAt).getTime() >= now - 3600_000))
    .sort((a, b) => new Date(a.scheduledStartAt || 0).getTime() - new Date(b.scheduledStartAt || 0).getTime());
  const awaitingResponse = bookings.filter((b) => b.status === "CONFIRMED").length;
  const newRequests = consultations.filter((c) => c.status === "REQUESTED").length;

  const missing: string[] = profile.missingSteps ?? [];
  const completion = Math.max(0, Math.min(100, Number(profile.profileCompletionPercent ?? 0)));
  const blockers: string[] = (profile.listing?.blockers ?? []).filter((b: string) => LISTING_BLOCKER[b]);

  const changeStatus = async (next: "ACTIVE" | "INACTIVE") => {
    setChangingStatus(true);
    try {
      await providerSelfService.setStatus(next);
      toast.success(next === "ACTIVE" ? "Your profile is now live." : "Your profile is now hidden.");
      loadProfile();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not change your profile status."));
    } finally {
      setChangingStatus(false);
    }
  };

  const liveOn = Boolean(profile.liveOnline?.enabled);
  const savedYoutube = profile.liveOnline?.youtubeUrl ?? "";
  /** Switch live on/off; switching on (or saving a new link) needs the pandit's YouTube live link. */
  const updateLive = async (enabled: boolean) => {
    const link = youtubeUrl.trim() || savedYoutube;
    if (enabled && !link) {
      setYoutubeError("Add your YouTube live link first, e.g. https://www.youtube.com/@yourchannel/live");
      return;
    }
    setChangingLive(true);
    setYoutubeError(null);
    try {
      const res = await providerSelfService.setLiveOnline(enabled, youtubeUrl.trim() || undefined);
      if (res.data?.data) setProfile(res.data.data);
      setYoutubeUrl("");
      toast.success(enabled ? "You are live online. Devotees can watch on YouTube and book a live katha / puja." : "Live online is off.");
    } catch (err) {
      setYoutubeError(getErrorMessage(err, "Could not change live online."));
    } finally {
      setChangingLive(false);
    }
  };
  const toggleLive = () => updateLive(!liveOn);

  const loading = secondaryLoading && !loadedOnce;
  const show = (value: React.ReactNode) => (loading ? <Skeleton className="h-6 w-16" /> : value);
  const money = (minor?: number) => formatMinor(minor ?? 0) ?? "₹0";
  const activeOfferings = offerings.filter((o) => o.status === "ACTIVE").length;
  const holdHours = wallet?.rules?.holdHours ?? 72;

  return (
    <PageContainer>
      {/* ── Top bar (same pattern as the super admin dashboard) ───────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-wide text-gray-500 dark:text-gray-400">Provider workspace</p>
          <h1 className="truncate text-lg font-black tracking-tight text-[#0B192C] sm:text-xl dark:text-white">
            Namaste, {profile.displayName || "Pandit ji"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={isLive ? "ACTIVE" : suspended ? "SUSPENDED" : "INACTIVE"}
            label={isLive ? "Live in directory" : suspended ? "Suspended" : "Not listed"}
          />
          {!suspended &&
            (isLive ? (
              <Button variant="outline" className="!min-h-[40px] !px-4 !text-xs" loading={changingStatus} onClick={() => changeStatus("INACTIVE")}>
                Hide profile
              </Button>
            ) : (
              <Button
                className="!min-h-[40px] !px-4 !text-xs"
                disabled={!canGoLive}
                title={canGoLive ? undefined : "Verification and one active service are required"}
                loading={changingStatus}
                onClick={() => changeStatus("ACTIVE")}
              >
                Go live
              </Button>
            ))}
          <button
            type="button"
            onClick={loadSecondaryData}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500 hover:text-[#F28C28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:border-slate-800 dark:bg-slate-900"
            title="Refresh"
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={16} className={secondaryLoading ? "animate-spin text-[#F28C28]" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {suspended && <ErrorNotice message="Your provider account is suspended. You can view your data but cannot change services or availability. Contact Tirvona support." />}

      {/* ── Live online katha / puja switch ─────────────────────────── */}
      <section
        aria-label="Live online"
        className={cx(
          "flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-4 shadow-sm dark:bg-[#0B192C] sm:p-5",
          liveOn ? "border-rose-300 dark:border-rose-900" : "border-gray-200 dark:border-slate-800",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cx(
              "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              liveOn ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40" : "bg-gray-100 text-gray-500 dark:bg-slate-800",
            )}
            aria-hidden="true"
          >
            <Radio size={20} />
            {liveOn && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-rose-500 motion-reduce:animate-none" />}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-black text-[#0B192C] dark:text-white">
              Live online katha &amp; puja
              <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-black", liveOn ? "bg-rose-600 text-white" : "bg-gray-100 text-gray-500 dark:bg-slate-800")}>
                {liveOn ? "LIVE" : "OFF"}
              </span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {liveOn
                ? "Devotees see you as live, can watch your YouTube stream and book a live katha / puja from anywhere."
                : "Stream your katha / puja on YouTube. Add your YouTube live link and turn this on so devotees can watch and book."}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={liveOn}
          aria-label="Live online katha and puja"
          disabled={changingLive || suspended}
          onClick={toggleLive}
          className={cx(
            "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] focus-visible:ring-offset-2 disabled:opacity-50",
            liveOn ? "bg-rose-600" : "bg-gray-300 dark:bg-slate-600",
          )}
        >
          <span className={cx("inline-block h-6 w-6 rounded-full bg-white shadow transition-transform", liveOn ? "translate-x-7" : "translate-x-1")} />
        </button>
        <div className="w-full space-y-1.5 border-t border-gray-100 pt-3 dark:border-slate-800">
          <label htmlFor="youtube-live-link" className="text-xs font-bold text-gray-700 dark:text-gray-300">
            Your YouTube live link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="youtube-live-link"
              type="url"
              inputMode="url"
              className={cx(inputClass, "sm:flex-1")}
              placeholder={savedYoutube || "https://www.youtube.com/@yourchannel/live"}
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              aria-invalid={youtubeError ? true : undefined}
              aria-describedby="youtube-live-hint"
            />
            <Button variant="outline" className="!min-h-[44px]" loading={changingLive} disabled={!youtubeUrl.trim()} onClick={() => updateLive(liveOn)}>
              Save link
            </Button>
          </div>
          {youtubeError ? (
            <p role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">{youtubeError}</p>
          ) : (
            <p id="youtube-live-hint" className="text-xs text-gray-500">
              {savedYoutube ? (
                <>
                  Saved:{" "}
                  <a href={savedYoutube} target="_blank" rel="noreferrer noopener" className="font-semibold text-[#B45309] underline dark:text-[#FFA44D]">
                    {savedYoutube}
                  </a>
                  . For a specific puja, add its stream link on the booking.
                </>
              ) : (
                "Your channel's live page works best (youtube.com/@yourchannel/live): it always shows your current stream."
              )}
            </p>
          )}
        </div>
      </section>

      {/* ── Six compact tiles: 2 per row on phones, 3 on tablets, 6 on desktop ── */}
      <section aria-label="Overview" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={<Wallet size={16} />} label="Available balance" value={show(money(wallet?.availableMinor))} hint="Ready to withdraw" to="/provider/wallet" />
        <StatTile icon={<Landmark size={16} />} label="Total earned" value={show(money(wallet?.lifetimeEarnedMinor))} hint="After refunds" to="/provider/wallet" />
        <StatTile
          icon={<CalendarCheck size={16} />}
          label="Upcoming bookings"
          value={show(upcoming.length)}
          hint="Confirmed and in progress"
          to="/provider/bookings"
        />
        <StatTile
          icon={<Clock size={16} />}
          label="Awaiting response"
          value={show(awaitingResponse)}
          hint={awaitingResponse > 0 ? "Accept or decline" : "Nothing waiting"}
          to="/provider/bookings"
        />
        <StatTile
          icon={<MessageSquare size={16} />}
          label="Consultations"
          value={show(consultations.length)}
          hint={newRequests > 0 ? `${newRequests} new request${newRequests === 1 ? "" : "s"}` : "No new requests"}
          to="/provider/bookings"
        />
        <StatTile
          icon={<BookOpen size={16} />}
          label="Active services"
          value={show(activeOfferings)}
          hint={`${offerings.length} listed in total`}
          to="/provider/offerings"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-12">
        {/* ── Main column ───────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5 sm:space-y-6 lg:col-span-8">
          <SectionCard
            title="Upcoming bookings"
            description="Confirmed and in-progress bookings, soonest first."
            actions={
              <Link to="/provider/bookings" className="text-xs font-bold text-[#B45309] hover:underline dark:text-[#FFA44D]">
                View all ({bookings.length})
              </Link>
            }
          >
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon={<Calendar size={20} />}
                title="No upcoming bookings"
                description={isLive ? "New bookings appear here as soon as devotees pay." : "Once your profile is live, devotee bookings appear here."}
              />
            ) : (
              <ul className="space-y-2">
                {upcoming.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <Link
                      to="/provider/bookings"
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-3 transition-colors hover:border-[#F28C28]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:border-slate-800"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-[#0B192C] dark:text-white">
                          {b.ritual?.titles?.en || b.offering?.title || "Puja booking"}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Clock size={11} aria-hidden="true" />
                          {when(b.scheduledStartAt)} · {b.bookingNumber || `#${String(b.id).slice(-6).toUpperCase()}`}
                        </span>
                      </span>
                      <StatusBadge status={b.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-gray-200 pt-4 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-800">
              <QuickPill icon={<BookOpen size={16} />} label="Services" value={`${activeOfferings} active`} to="/provider/offerings" />
              <QuickPill icon={<Calendar size={16} />} label="Availability" value="Set weekly hours" to="/provider/availability" />
              <QuickPill
                icon={<ShieldCheck size={16} />}
                label="Verification"
                value={isVerified ? "Verified" : caseStage ?? "Not started"}
                to="/provider/verification"
                tone={isVerified ? "bg-emerald-100 text-emerald-600" : undefined}
              />
              <QuickPill icon={<User size={16} />} label="Profile" value={`${completion}% complete`} to="/provider/profile" />
            </div>
          </SectionCard>

          <SectionCard
            title="Your services"
            description="What devotees can book."
            actions={
              <Link to="/provider/offerings" className="text-xs font-bold text-[#B45309] hover:underline dark:text-[#FFA44D]">
                Manage ({offerings.length})
              </Link>
            }
          >
            {loading ? (
              <Skeleton className="h-14" />
            ) : offerings.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={20} />}
                title="No services listed yet"
                description="Add the ceremonies you perform, such as Griha Pravesh or Rudrabhishek, with your fee and duration."
                action={
                  <LinkButton to="/provider/offerings">
                    <Plus size={16} aria-hidden="true" />
                    Add first service
                  </LinkButton>
                }
              />
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {offerings.slice(0, 4).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 p-3 dark:border-slate-800">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[#0B192C] dark:text-white">{offeringName(o)}</span>
                      <span className="block text-[11px] text-gray-500">
                        {[o.durationMinutes ? `${o.durationMinutes} min` : null, offeringFee(o)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <StatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* ── Side column ───────────────────────────────────────────── */}
        <aside className="space-y-5 sm:space-y-6 lg:col-span-4" aria-label="Wallet and setup">
          <SectionCard
            title="Wallet"
            actions={
              <Link to="/provider/wallet" className="text-xs font-bold text-[#B45309] hover:underline dark:text-[#FFA44D]">
                Statement
              </Link>
            }
          >
            <p className="text-[11px] font-extrabold tracking-wide text-gray-500">Available to withdraw</p>
            <div className="mt-1 text-3xl font-black tabular-nums text-[#0B192C] dark:text-white">{loading ? <Skeleton className="h-8 w-28" /> : money(wallet?.availableMinor)}</div>
            <dl className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-xs dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-gray-500">
                  <Hourglass size={13} aria-hidden="true" />
                  On hold ({holdHours}h)
                </dt>
                <dd className="font-black tabular-nums text-[#0B192C] dark:text-white">{money(wallet?.pendingMinor)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-gray-500">
                  <Clock size={13} aria-hidden="true" />
                  Withdrawal in progress
                </dt>
                <dd className="font-black tabular-nums text-[#0B192C] dark:text-white">{money(wallet?.withdrawingMinor)}</dd>
              </div>
            </dl>
            {wallet?.nextRelease && (
              <p className="mt-3 rounded-xl bg-[#FFF4E5] px-3 py-2 text-[11px] font-semibold text-[#92400E] dark:bg-[#F28C28]/15 dark:text-[#FFC88A]">
                {money(wallet.nextRelease.amountMinor)} unlocks on {when(wallet.nextRelease.availableAt)}
              </p>
            )}
            <Link to="/provider/wallet" className={buttonClass("primary", "mt-4 w-full")}>
              <Wallet size={16} aria-hidden="true" />
              Open wallet
            </Link>
          </SectionCard>

          <SectionCard title="Profile setup">
            <div className="mb-3">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="font-semibold text-gray-500">Completion</span>
                <span className="font-black text-[#0B192C] dark:text-white">{completion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
                <div className="h-full rounded-full bg-[#F28C28]" style={{ width: `${completion}%` }} />
              </div>
            </div>
            {missing.length === 0 ? (
              <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <Check size={14} aria-hidden="true" />
                Your profile is complete.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {missing.map((step) => {
                  const meta = MISSING_STEP[step];
                  if (!meta) return null;
                  return (
                    <li key={step}>
                      <Link to={meta.to} className="flex min-h-[44px] items-center gap-2 text-xs text-gray-700 hover:text-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:text-gray-300">
                        <span className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-gray-300" aria-hidden="true" />
                        <span className="min-w-0 flex-1">{meta.label}</span>
                        <ArrowRight size={13} className="shrink-0 text-gray-400" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {!isLive && blockers.length > 0 && (
            <SectionCard title="Before you can go live">
              <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                {blockers.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#F28C28]" aria-hidden="true" />
                    {LISTING_BLOCKER[b]}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </aside>
      </div>
    </PageContainer>
  );
};

export default ProviderDashboard;
