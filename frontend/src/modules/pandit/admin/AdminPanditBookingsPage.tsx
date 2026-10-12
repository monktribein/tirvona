import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { providerAdminService } from "../services/provider.service";
import { getErrorMessage } from "../../../lib/api";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorNotice,
  PageContainer,
  PageHeader,
  Pagination,
  Skeleton,
  StatusBadge,
  cx,
  formatMinor,
  inputClass,
  statusLabel,
  type Column,
} from "../ui";

const PAGE_SIZE = 20;

/** Every booking state the server stores. */
const STATUSES = [
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
  "CONFIRMED",
  "PROVIDER_ACCEPTED",
  "PREPARATION_IN_PROGRESS",
  "READY_FOR_FULFILMENT",
  "IN_PROGRESS",
  "COMPLETED",
  "SETTLEMENT_PENDING",
  "CLOSED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_PROVIDER",
  "CANCELLED_BY_OPS",
  "DISPUTED",
];

const when = (iso?: string, tz = "Asia/Kolkata") =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: tz }) : "Not scheduled";

export const AdminPanditBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await providerAdminService.listBookings({ status: status || undefined, from: from || undefined, to: to || undefined, page, limit: PAGE_SIZE });
      if (res.data?.success) {
        setBookings(res.data.data || []);
        setTotal(res.data.meta?.total ?? res.data.data?.length ?? 0);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load bookings."));
    } finally {
      setLoading(false);
    }
  }, [status, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<any>[] = [
    {
      key: "booking",
      header: "Booking",
      primary: true,
      cell: (b) => (
        <span>
          <span className="block font-mono font-bold">{b.bookingNumber}</span>
          <span className="block truncate text-xs font-normal text-gray-500">{b.offering?.title || b.ritual?.titles?.en || "Puja"}</span>
        </span>
      ),
    },
    { key: "provider", header: "Provider", cell: (b) => b.providerName || "—" },
    { key: "when", header: "Scheduled", cell: (b) => when(b.scheduledStartAt, b.timezone || "Asia/Kolkata") },
    { key: "status", header: "Status", cell: (b) => <StatusBadge status={b.status} /> },
    { key: "total", header: "Total", className: "text-right", cell: (b) => formatMinor(b.totalMinor, b.currency || "INR") ?? "—" },
  ];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pandit & Acharya"
        title="Puja bookings"
        description="Every devotee booking across all providers. Contact details and addresses are not shown in this list."
        actions={
          <Button variant="outline" onClick={load} aria-label="Refresh the list">
            <RefreshCw size={16} className={cx(loading && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card as="section" className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="bk-status" className="mb-1 block text-xs font-bold text-gray-600 dark:text-gray-400">
            Status
          </label>
          <select id="bk-status" className={inputClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bk-from" className="mb-1 block text-xs font-bold text-gray-600 dark:text-gray-400">
            Scheduled from
          </label>
          <input id="bk-from" type="date" className={inputClass} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label htmlFor="bk-to" className="mb-1 block text-xs font-bold text-gray-600 dark:text-gray-400">
            Scheduled to
          </label>
          <input id="bk-to" type="date" min={from || undefined} className={inputClass} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
      </Card>

      {error && <ErrorNotice message={error} onRetry={load} />}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5" aria-busy="true">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : bookings.length === 0 ? (
          <EmptyState icon={<CalendarDays size={26} />} title="No bookings found" description="Try a different status or date range." />
        ) : (
          <DataTable caption="Puja bookings" columns={columns} rows={bookings} rowKey={(b) => b.id} />
        )}
      </Card>
      {!loading && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
    </PageContainer>
  );
};

export default AdminPanditBookingsPage;
