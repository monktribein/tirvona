import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, ChevronRight, ShoppingBag, Star, Truck } from "lucide-react";
import { storeApi, toStoreProduct, type StoreProduct } from "../../../services/marketplace.service";
import { cx, formatMinor } from "../ui";

const inr = (rupees: number) => formatMinor(Math.round(rupees * 100));

const SamagriCard: React.FC<{ item: StoreProduct }> = ({ item }) => {
  const mrp = item.price;
  const price = item.sellingPrice ?? item.price;
  const off = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  return (
    <Link
      to={`/marketplace/products/${item.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F28C28]/40 hover:shadow-[0_8px_20px_-6px_rgba(242,140,40,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#F28C28]/40"
    >
      <span className="relative block aspect-[4/3] overflow-hidden bg-slate-50 dark:bg-slate-800/60">
        {item.images?.[0] ? (
          <img
            src={item.images[0]}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-slate-300 dark:text-slate-600" aria-hidden="true">
            <ShoppingBag size={28} strokeWidth={1.5} />
          </span>
        )}
        {off > 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-gradient-to-r from-[#F28C28] to-[#E07B1A] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-xs">
            {off}% off
          </span>
        )}
        {!item.inStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[11px] font-semibold uppercase tracking-wider text-slate-600 backdrop-blur-[1px] dark:bg-slate-900/70 dark:text-slate-300">
            Out of stock
          </span>
        )}
      </span>

      <span className="flex flex-1 flex-col p-3 sm:p-3.5">
        {item.vendor?.name && (
          <span className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <BadgeCheck size={12} className="shrink-0 text-[#F28C28]" aria-hidden="true" />
            <span className="truncate">{item.vendor.name}</span>
          </span>
        )}
        <span className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-slate-900 dark:text-slate-100">
          {item.name}
        </span>
        <span className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <span className="flex min-w-0 flex-col">
            {off > 0 && <span className="text-[11px] font-medium text-slate-400 line-through">{inr(mrp)}</span>}
            <span className="text-[15px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">{inr(price)}</span>
          </span>
          {item.rating ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Star size={10} className="fill-amber-400 text-amber-400" aria-hidden="true" />
              {item.rating.toFixed(1)}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
};

/**
 * Puja samagri from the Tirvona Marketplace: the products a super admin
 * switched on for pandit pages. Renders nothing when none are switched on.
 *
 * `band` is a standalone section (pandit directory); `inline` sits inside
 * a page column (pandit profile).
 */
export const PujaSamagriSection: React.FC<{ limit?: number; variant?: "band" | "inline" }> = ({ limit = 10, variant = "inline" }) => {
  const [samagri, setSamagri] = useState<StoreProduct[]>([]);

  useEffect(() => {
    let active = true;
    storeApi
      .products({ panditPages: true, limit })
      .then((res: any) => active && setSamagri((res.data?.data ?? []).map(toStoreProduct)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [limit]);

  if (samagri.length === 0) return null;

  const band = variant === "band";
  // Mobile: a swipeable row. Larger screens: a tidy grid.
  const listClass = band
    ? "-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden"
    : "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4";
  const itemClass = band ? "w-[44%] shrink-0 snap-start sm:w-auto" : undefined;

  return (
    <section
      aria-labelledby="samagri-heading"
      className={cx("relative", band ? "pt-1" : "")}
    >
      <header className={cx("relative flex items-end justify-between gap-4", band ? "mb-4" : "mb-3.5")}>
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#B45309] dark:text-[#FFA44D]">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#F28C28]/10 text-[#F28C28] dark:bg-[#F28C28]/20">
              <ShoppingBag size={12} aria-hidden="true" />
            </span>
            Tirvona Marketplace
          </p>
          <h2
            id="samagri-heading"
            className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white"
          >
            Puja samagri &amp; sacred items
          </h2>
          {band && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Ritual essentials from verified sellers</span>
              <span className="hidden items-center gap-1 sm:inline-flex text-[#B45309] dark:text-[#FFA44D]">
                <Truck size={13} className="text-[#F28C28]" aria-hidden="true" />
                Delivered to your door
              </span>
            </p>
          )}
        </div>
        <Link
          to="/marketplace"
          className={cx(
            "group/link inline-flex shrink-0 items-center gap-1 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
            band
              ? "rounded-full border border-amber-200/80 bg-white px-3.5 py-1 text-xs font-semibold text-amber-900 shadow-xs hover:border-[#F28C28] hover:bg-amber-50/70 dark:border-amber-500/30 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-500/10"
              : "rounded text-xs text-[#B45309] hover:text-[#D97706] dark:text-[#FFA44D]",
          )}
        >
          View all
          {band ? (
            <ArrowRight size={13} className="text-[#F28C28] transition-transform group-hover/link:translate-x-0.5" aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
        </Link>
      </header>

      <ul className={cx("relative", listClass)}>
        {samagri.map((item) => (
          <li key={item._id} className={itemClass}>
            <SamagriCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PujaSamagriSection;
