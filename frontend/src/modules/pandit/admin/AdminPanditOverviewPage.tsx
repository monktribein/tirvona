import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, Clock, Flame, RefreshCw, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { providerAdminService } from "../services/provider.service";
import { getErrorMessage } from "../../../lib/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  LinkButton,
  PageContainer,
  PageHeader,
  SectionCard,
  Skeleton,
  StatTile,
  StatusBadge,
  cx,
} from "../ui";

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "—");

export const AdminPanditOverviewPage: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await providerAdminService.overview();
      if (res.data?.success) setData(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load the Pandit & Acharya overview."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pandit & Acharya"
        title="Overview"
        description="Live figures for providers, verification, services and bookings."
        actions={
          <>
            <LinkButton to="/admin/verifications/providers">
              <ShieldCheck size={16} aria-hidden="true" />
              Review KYC{data ? ` (${data.pendingVerifications})` : ""}
            </LinkButton>
            <Button variant="outline" onClick={load} aria-label="Refresh the overview">
              <RefreshCw size={16} className={cx(loading && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      {error && <ErrorNotice message={error} onRetry={load} />}

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : data ? (
        <>
          <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatTile
              icon={<Users size={16} />}
              label="Providers"
              value={data.totalProviders}
              hint={`${data.activeProviders} active · ${data.inactiveProviders} inactive${data.suspendedProviders > 0 ? ` · ${data.suspendedProviders} suspended` : ""}`}
              to="/admin/pandits"
              cta="All providers"
            />
            <StatTile
              icon={<ShieldAlert size={16} />}
              label="Verification"
              value={`${data.pendingVerifications} pending`}
              hint={`${data.approvedVerifications} approved · ${data.rejectedVerifications} rejected`}
              to="/admin/verifications/providers"
              cta="Open the queue"
            />
            <StatTile
              icon={<BookOpen size={16} />}
              label="Services"
              value={data.totalOfferings}
              hint={`${data.publishedOfferings} live and bookable`}
              to="/admin/pandits/offerings"
              cta="Manage services"
            />
            <StatTile
              icon={<Flame size={16} />}
              label="Bookings"
              value={data.totalBookings}
              hint={`${data.upcomingBookings} upcoming · ${data.totalConsultations} consultations`}
              to="/admin/pandits/bookings"
              cta="All bookings"
            />
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard
              title="Recent bookings"
              actions={
                <Link to="/admin/pandits/bookings" className="text-sm font-bold text-[#B45309] hover:underline dark:text-[#FFA44D]">
                  View all
                </Link>
              }
            >
              {data.recentBookings?.length ? (
                <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                  {data.recentBookings.map((b: any) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-[#0B192C] dark:text-white">{b.bookingNumber}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock size={12} aria-hidden="true" />
                          {when(b.scheduledStartAt)}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<CalendarDays size={24} />} title="No bookings yet" description="Bookings appear here as devotees book providers." />
              )}
            </SectionCard>

            <SectionCard
              title="Recent verification cases"
              actions={
                <Link to="/admin/verifications/providers" className="text-sm font-bold text-[#B45309] hover:underline dark:text-[#FFA44D]">
                  Open queue
                </Link>
              }
            >
              {data.recentVerifications?.length ? (
                <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                  {data.recentVerifications.map((v: any) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0B192C] dark:text-white">{String(v.verificationType || "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} verification</p>
                        <p className="text-xs text-gray-500">Opened {when(v.openedAt)}</p>
                      </div>
                      <StatusBadge status={v.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<ShieldCheck size={24} />} title="No verification cases" description="Cases appear here when providers submit documents." />
              )}
            </SectionCard>
          </div>

          <Card className="p-5">
            <h2 className="mb-1 text-base font-extrabold text-[#0B192C] dark:text-white">Shortcuts</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton to="/admin/pandits" variant="outline">Providers</LinkButton>
              <LinkButton to="/admin/pandits/rituals" variant="outline">Ritual catalogue</LinkButton>
              <LinkButton to="/admin/pandits/offerings" variant="outline">Services</LinkButton>
              <LinkButton to="/admin/pandits/consultations" variant="outline">Consultations</LinkButton>
            </div>
          </Card>
        </>
      ) : null}
    </PageContainer>
  );
};

export default AdminPanditOverviewPage;
