import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, RefreshCw, Search } from "lucide-react";
import { providerAdminService } from "../services/provider.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  Button,
  Card,
  ConfirmDialog,
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
  type Column,
} from "../ui";

const PAGE_SIZE = 20;

const ritualTitle = (o: any) => o.title || o.ritual?.titles?.en || Object.values(o.ritual?.titles ?? {})[0] || "Puja service";

export const AdminPanditOfferingsPage: React.FC = () => {
  const [offerings, setOfferings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [target, setTarget] = useState<{ offering: any; next: "ACTIVE" | "INACTIVE" } | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await providerAdminService.listOfferings({ status: statusFilter || undefined, page, limit: PAGE_SIZE });
      if (res.data?.success) {
        setOfferings(res.data.data || []);
        setTotal(res.data.meta?.total ?? res.data.data?.length ?? 0);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load offerings."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const confirm = async () => {
    if (!target) return;
    setUpdating(true);
    try {
      await providerAdminService.setOfferingStatus(target.offering.id, target.next);
      toast.success(target.next === "ACTIVE" ? "Offering is back on sale." : "Offering taken off sale.");
      setOfferings((prev) => prev.map((o) => (o.id === target.offering.id ? { ...o, status: target.next } : o)));
      setTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not change the offering."));
    } finally {
      setUpdating(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const rows = q ? offerings.filter((o) => ritualTitle(o).toLowerCase().includes(q) || String(o.providerName ?? "").toLowerCase().includes(q)) : offerings;

  const columns: Column<any>[] = [
    {
      key: "service",
      header: "Service",
      primary: true,
      cell: (o) => (
        <span>
          <span className="block font-bold">{ritualTitle(o)}</span>
          <span className="block text-xs font-normal text-gray-500">{o.fulfilmentType?.replace(/_/g, " ").toLowerCase()}</span>
        </span>
      ),
    },
    { key: "provider", header: "Provider", cell: (o) => o.providerName || "—" },
    { key: "fee", header: "Fee", cell: (o) => formatMinor(o.indicativeFee?.amountMinor, o.indicativeFee?.currency || "INR") ?? "—" },
    { key: "duration", header: "Duration", cell: (o) => (o.durationMinutes ? `${o.durationMinutes} min` : "—") },
    { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
  ];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pandit & Acharya"
        title="Puja services"
        description="Every service listed by providers. Taking a service off sale hides it from devotees immediately."
        actions={
          <Button variant="outline" onClick={load} aria-label="Refresh the list">
            <RefreshCw size={16} className={cx(loading && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card as="section" className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr,14rem]">
        <div className="relative">
          <label htmlFor="off-search" className="sr-only">
            Search this page by service or provider
          </label>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input id="off-search" type="search" className={cx(inputClass, "pl-10")} placeholder="Search this page by service or provider" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div>
          <label htmlFor="off-status" className="sr-only">
            Status
          </label>
          <select id="off-status" className={inputClass} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="INACTIVE">Inactive</option>
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
        ) : rows.length === 0 ? (
          <EmptyState icon={<BookOpen size={26} />} title="No services found" description="Providers' services appear here once they create them." />
        ) : (
          <DataTable
            caption="Puja services"
            columns={columns}
            rows={rows}
            rowKey={(o) => o.id}
            actions={(o) =>
              o.status === "ACTIVE" ? (
                <Button variant="outline" className="!min-h-[40px] !px-3 !border-rose-300 !text-rose-700" onClick={() => setTarget({ offering: o, next: "INACTIVE" })}>
                  Take off sale
                </Button>
              ) : (
                <Button className="!min-h-[40px] !px-3" onClick={() => setTarget({ offering: o, next: "ACTIVE" })}>
                  Put on sale
                </Button>
              )
            }
          />
        )}
      </Card>
      {!loading && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}

      <ConfirmDialog
        open={!!target}
        title={target?.next === "ACTIVE" ? "Put this service back on sale?" : "Take this service off sale?"}
        tone={target?.next === "ACTIVE" ? "primary" : "danger"}
        confirmLabel={target?.next === "ACTIVE" ? "Put on sale" : "Take off sale"}
        loading={updating}
        description={
          target
            ? target.next === "ACTIVE"
              ? `${ritualTitle(target.offering)} by ${target.offering.providerName ?? "this provider"} becomes bookable again if the catalogue still allows it.`
              : `${ritualTitle(target.offering)} by ${target.offering.providerName ?? "this provider"} will no longer be shown or bookable. Existing bookings are not cancelled.`
            : ""
        }
        onCancel={() => setTarget(null)}
        onConfirm={confirm}
      />
    </PageContainer>
  );
};

export default AdminPanditOfferingsPage;
