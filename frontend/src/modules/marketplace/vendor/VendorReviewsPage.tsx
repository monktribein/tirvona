import React, { useState } from "react";
import { Star } from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { Empty, Panel, PanelState, Pager, Pill, shortDate, useRemote } from "../ui";
import { RequireStore } from "./VendorShared";

export interface MpReview {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  status: string;
  isVerifiedPurchase?: boolean;
  createdAt: string;
  productId?: { _id: string; name: string; slug: string } | null;
  vendorId?: { _id: string; storeName: string; slug: string } | null;
  customerId?: { name?: string } | null;
}

export const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={12} className={i <= rating ? "fill-[#F28C28] text-[#F28C28]" : "text-gray-300"} />
    ))}
  </span>
);

/** Verified-purchase reviews of this store's products (read-only for the store). */
export const VendorReviewsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data, meta, state, error, reload } = useRemote<MpReview[]>(() => vendorApi.reviews({ page, limit: 20 }), [page]);

  return (
    <RequireStore>
      {() => (
        <div className="space-y-5">
          <EnterprisePageHeader title="Reviews" subtitle="Reviews come only from customers whose order was delivered." icon={<Star size={20} />} />
          <Panel>
            {state !== "ready" ? (
              <PanelState state={state} error={error} onRetry={reload} />
            ) : !data?.length ? (
              <Empty title="No reviews yet" text="Customers can review a product after it is delivered." />
            ) : (
              <>
                <ul className="divide-y divide-gray-100 dark:divide-slate-800 -my-2">
                  {data.map((r) => (
                    <li key={r._id} className="py-3.5 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Stars rating={r.rating} />
                        <span className="font-extrabold text-[#0B192C] dark:text-white">{r.productId?.name ?? "Product"}</span>
                        {r.status !== "published" && <Pill status={r.status} />}
                        <span className="text-gray-400 ml-auto">
                          {r.customerId?.name ?? "Customer"} · {shortDate(r.createdAt)}
                        </span>
                      </div>
                      {r.title && <p className="text-xs font-bold">{r.title}</p>}
                      {r.comment && <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
                <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
              </>
            )}
          </Panel>
        </div>
      )}
    </RequireStore>
  );
};

export default VendorReviewsPage;
