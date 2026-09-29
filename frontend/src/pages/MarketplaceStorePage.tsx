import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  storeApi,
  toStoreProduct,
  type StoreProduct,
} from "../services/marketplace.service";
import { useCart } from "../contexts/CartContext";
import { formatCurrency } from "../utils/format";
import {
  BadgeCheck,
  Loader2,
  MapPin,
  PackageSearch,
  ShoppingBag,
  Star,
  Store,
} from "lucide-react";

interface PublicStore {
  _id: string;
  storeName: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  address?: { city?: string; state?: string };
  isPlatformVendor?: boolean;
  createdAt?: string;
}

const PAGE_SIZE = 24;
const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

/** Public storefront of one seller: only what the backend exposes publicly. */
export const MarketplaceStorePage: React.FC = () => {
  const { slug = "" } = useParams();
  const { add } = useCart();
  const [store, setStore] = useState<PublicStore | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  const loadProducts = useCallback(
    async (nextPage: number) => {
      const res = await storeApi.products({ vendorSlug: slug, page: nextPage, limit: PAGE_SIZE });
      const rows = (res.data?.data ?? []).map(toStoreProduct);
      setProducts((prev) => (nextPage === 1 ? rows : [...prev, ...rows]));
      setTotal(Number(res.data?.total ?? rows.length));
      setPage(nextPage);
    },
    [slug],
  );

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    storeApi
      .vendor(slug)
      .then(async (res) => {
        if (cancelled) return;
        setStore(res.data?.data ?? null);
        await loadProducts(1);
        if (!cancelled) setState("ready");
      })
      .catch((err) => {
        if (!cancelled) setState(err?.response?.status === 404 ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, loadProducts]);

  if (state === "loading")
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#F28C28]" />
      </div>
    );

  if (state !== "ready" || !store)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <PackageSearch size={36} className="text-gray-300" />
        <h1 className="text-lg font-black text-[#0B192C] dark:text-white">
          {state === "missing" ? "This store is not available" : "The store could not be loaded"}
        </h1>
        <p className="text-xs text-gray-500 max-w-sm">
          {state === "missing"
            ? "It may be closed, under review or no longer selling on Tirvona."
            : "Please check your connection and try again."}
        </p>
        <Link
          to="/marketplace"
          className="px-5 py-2.5 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-extrabold"
        >
          Back to marketplace
        </Link>
      </div>
    );

  const location = [store.address?.city, store.address?.state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-8">
        <header className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 sm:p-8 shadow-sm flex flex-col sm:flex-row gap-5 sm:items-center">
          <div className="w-20 h-20 rounded-2xl bg-[#FFF4E5] dark:bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
            {store.logoUrl ? (
              <img src={store.logoUrl} alt={store.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store size={34} className="text-[#F28C28]" />
            )}
          </div>
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B192C] dark:text-white tracking-tight flex items-center gap-2 flex-wrap">
              {store.storeName}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-black">
                <BadgeCheck size={13} /> Verified seller
              </span>
            </h1>
            {location && (
              <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                <MapPin size={13} className="text-[#F28C28]" /> {location}
              </p>
            )}
            {store.description && (
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-3xl whitespace-pre-line">
                {store.description}
              </p>
            )}
            <p className="text-[11px] font-bold text-gray-400">
              {total} product{total === 1 ? "" : "s"}
              {store.createdAt &&
                ` · Selling on Tirvona since ${new Date(store.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`}
            </p>
          </div>
        </header>

        {products.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <ShoppingBag size={32} className="mx-auto text-gray-300" />
            <p className="text-sm font-bold text-[#0B192C] dark:text-white">No products listed yet</p>
            <p className="text-xs text-gray-500">This store has no products on sale right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => {
              const discount =
                p.salePrice && p.salePrice < p.price
                  ? Math.round(((p.price - p.salePrice) / p.price) * 100)
                  : 0;
              return (
                <article
                  key={p._id}
                  className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col hover:shadow-lg hover:border-[#E58C28]/60 transition-all"
                >
                  <Link to={`/marketplace/products/${p.slug || p._id}`} className="block">
                    <img
                      src={p.images[0] || FALLBACK_IMAGE}
                      alt={p.name}
                      loading="lazy"
                      className="w-full aspect-square object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                      }}
                    />
                  </Link>
                  <div className="p-3 flex-1 flex flex-col gap-1.5">
                    <Link
                      to={`/marketplace/products/${p.slug || p._id}`}
                      className="text-xs font-bold text-[#0B192C] dark:text-white line-clamp-2 hover:text-[#F28C28]"
                    >
                      {p.name}
                    </Link>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-black text-[#F28C28] dark:text-amber-400">
                        {formatCurrency(p.sellingPrice)}
                      </span>
                      {discount > 0 && (
                        <span className="text-[11px] text-gray-400 line-through">
                          {formatCurrency(p.price)}
                        </span>
                      )}
                    </div>
                    {Number(p.rating) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                        <Star size={11} fill="currentColor" className="text-[#E58C28]" />
                        {p.rating} ({p.reviewCount ?? 0})
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={!p.inStock}
                      onClick={() =>
                        add({
                          productId: p._id,
                          name: p.name,
                          slug: p.slug,
                          image: p.images[0],
                          displayPrice: p.sellingPrice,
                          maxQuantity: p.stock,
                          vendorId: p.vendor?.id ?? store._id,
                          vendorName: p.vendor?.name ?? store.storeName,
                          vendorSlug: store.slug,
                        })
                      }
                      className="mt-auto py-2 rounded-full bg-[#F28C28]/10 hover:bg-[#F28C28] text-[#F28C28] hover:text-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-[11px] font-extrabold cursor-pointer transition-all"
                    >
                      {p.inStock ? "Add to cart" : "Out of stock"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {products.length < total && (
          <div className="text-center">
            <button
              onClick={async () => {
                setLoadingMore(true);
                try {
                  await loadProducts(page + 1);
                } finally {
                  setLoadingMore(false);
                }
              }}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-[#0B192C] dark:text-white cursor-pointer disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceStorePage;
