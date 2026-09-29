import React, { useState } from "react";
import { Star } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { marketplaceAdminApi } from "../../../services/marketplace.service";
import { Chips, Empty, Panel, PanelState, Pager, Pill, shortDate, useAction, useRemote } from "../../../modules/marketplace/ui";
import { Stars, type MpReview } from "../../../modules/marketplace/vendor/VendorReviewsPage";

const FILTERS = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
];

/** Moderation of verified-purchase reviews. Hiding a review recalculates the product rating on the backend. */
export const MarketplaceReviewsAdminPage: React.FC = () => {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, meta, state, error, reload } = useRemote<MpReview[]>(() => marketplaceAdminApi.reviews({ status, page, limit: 20 }), [status, page]);
  const { busy, run } = useAction();

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Marketplace reviews" subtitle="Hide reviews that break the content policy; they stop counting towards the rating." icon={<Star size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips value={status} options={FILTERS} onChange={(v) => { setStatus(v); setPage(1); }} />
          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !data?.length ? (
            <Empty title="No reviews" />
          ) : (
            <>
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.map((r) => (
                  <li key={r._id} className="py-3.5 flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 min-w-0 space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars rating={r.rating} />
                        <span className="font-extrabold">{r.productId?.name ?? "Product"}</span>
                        <span className="text-gray-400">{r.vendorId?.storeName}</span>
                        <Pill status={r.status} />
                      </div>
                      {r.title && <p className="font-bold">{r.title}</p>}
                      {r.comment && <p className="text-gray-600 dark:text-gray-300">{r.comment}</p>}
                      <p className="text-gray-400">
                        {r.customerId?.name ?? "Customer"} · {shortDate(r.createdAt)}
                      </p>
                    </div>
                    <EnterpriseButton
                      size="sm"
                      variant={r.status === "published" ? "ghost" : "outline"}
                      loading={busy === r._id}
                      onClick={() =>
                        run(r._id, () => marketplaceAdminApi.setReviewStatus(r._id, r.status === "published" ? "hidden" : "published"), reload)
                      }
                    >
                      {r.status === "published" ? "Hide" : "Publish"}
                    </EnterpriseButton>
                  </li>
                ))}
              </ul>
              <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default MarketplaceReviewsAdminPage;
