import React, { useCallback, useEffect, useState } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";
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
const STATUSES = ["REQUESTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];
const CHANNEL_LABEL: Record<string, string> = { CHAT: "Chat", VIDEO: "Video", PHONE: "Phone", IN_PERSON: "In person" };

export const AdminPanditConsultationsPage: React.FC = () => {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await providerAdminService.listConsultations({ status: statusFilter || undefined, page, limit: PAGE_SIZE });
      if (res.data?.success) {
        setConsultations(res.data.data || []);
        setTotal(res.data.meta?.total ?? res.data.data?.length ?? 0);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load consultations."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<any>[] = [
    {
      key: "expert",
      header: "Provider",
      primary: true,
      cell: (c) => (
        <span>
          <span className="block font-bold">{c.expert?.displayName || "Provider"}</span>
          <span className="block text-xs font-normal text-gray-500">{c.consultationType === "JYOTISHI" ? "Jyotish guidance" : "Pandit guidance"}</span>
        </span>
      ),
    },
    { key: "customer", header: "Devotee", cell: (c) => c.customer?.name || "—" },
    { key: "channel", header: "Channel", cell: (c) => CHANNEL_LABEL[c.channel] || c.channel },
    {
      key: "when",
      header: "Scheduled",
      cell: (c) => (c.scheduledStartAt ? new Date(c.scheduledStartAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: c.timezone || "Asia/Kolkata" }) : "—"),
    },
    { key: "fee", header: "Fee", cell: (c) => (c.fee?.amountMinor ? formatMinor(c.fee.amountMinor, c.fee.currency || "INR") : "No fee") },
    { key: "status", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
  ];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pandit & Acharya"
        title="Consultations"
        description="Guidance requests across all providers. Message contents are private to the devotee and the provider and are not shown here."
        actions={
          <Button variant="outline" onClick={load} aria-label="Refresh the list">
            <RefreshCw size={16} className={cx(loading && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card as="section" className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
          {loading ? "Loading…" : `${total} consultation${total === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="c-status" className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            Status
          </label>
          <select id="c-status" className={cx(inputClass, "!w-auto")} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
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
        ) : consultations.length === 0 ? (
          <EmptyState icon={<MessageSquare size={26} />} title="No consultations found" description="Change the status filter or check back later." />
        ) : (
          <DataTable caption="Consultations" columns={columns} rows={consultations} rowKey={(c) => c.id} />
        )}
      </Card>
      {!loading && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
    </PageContainer>
  );
};

export default AdminPanditConsultationsPage;
