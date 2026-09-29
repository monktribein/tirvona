import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Loader2, PackageSearch, ShoppingBag, Star, Store } from "lucide-react";
import {
  flattenCategories,
  storeApi,
  toStoreProduct,
  type StoreCategory,
  type StoreProduct,
} from "../services/marketplace.service";
import { useCart } from "../contexts/CartContext";
import { formatCurrency } from "../utils/format";

const PAGE_SIZE = 24;
const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

/** One vendor marketplace category: its sub-categories and approved products. */
export const MarketplaceCategoryDetailPage: React.FC = () => {
  const { slug = "" } = useParams();
  const { add } = useCart();
  const [category, setCategory] = useState<StoreCategory | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  const loadProducts = useCallback(async (categoryId: string, nextPage: number) => {
    const res = await storeApi.products({ categoryId, page: nextPage, limit: PAGE_SIZE });
    const rows = (res.data?.data ?? []).map(toStoreProduct);
    setProducts((prev) => (nextPage === 1 ? rows : [...prev, ...rows]));
    setTotal(Number(res.data?.total ?? rows.length));
    setPage(nextPage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    storeApi
      .categories()
      .then(async (res) => {
        const match = flattenCategories(res.data?.data ?? []).find((c) => c.slug === slug) ?? null;
        if (cancelled) return;
        if (!match) {
          setState("missing");
          return;
        }
        setCategory(match);
        await loadProducts(match._id, 1);
        if (!cancelled) setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
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

  if (state !== "ready" || !category)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <PackageSearch size={36} className="text-gray-300" />
        <h1 className="text-lg font-black text-[#0B192C] dark:text-white">
          {state === "missing" ? "Category not found" : "This category could not be loaded"}
        </h1>
        <Link to="/marketplace/categories" className="px-5 py-2.5 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-extrabold">
          Browse all categories
        </Link>
      </div>
    );

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        <nav className="flex items-center gap-1.5 text-xs font-bold text-gray-500" aria-label="Breadcrumb">
          <Link to="/marketplace" className="hover:text-[#F28C28]">Marketplace</Link>
          <ChevronRight size={12} />
          <Link to="/marketplace/categories" className="hover:text-[#F28C28]">Categories</Link>
          <ChevronRight size={12} />
          <span className="text-[#0B192C] dark:text-white">{category.name}</span>
        </nav>

        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B192C] dark:text-white tracking-tight">{category.name}</h1>
          {category.description && <p className="text-sm text-gray-600 dark:text-gray-300 max-w-3xl">{category.description}</p>}
          {(category.children?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {category.children!.map((child) => (
                <Link
                  key={child._id}
                  to={`/marketplace/category/${child.slug}`}
                  className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:border-[#F28C28] hover:text-[#F28C28]"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          )}
        </header>

        {products.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <ShoppingBag size={32} className="mx-auto text-gray-300" />
            <p className="text-sm font-bold text-[#0B192C] dark:text-white">No products in this category yet</p>
            <Link to="/marketplace" className="text-xs font-bold text-[#F28C28] hover:underline">
              Browse the whole marketplace
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <article
                key={p._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col hover:shadow-lg hover:border-[#E58C28]/60 transition-all"
              >
                <Link to={`/marketplace/products/${p.slug || p._id}`}>
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
                  {p.vendor?.slug && (
                    <Link to={`/marketplace/store/${p.vendor.slug}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-[#F28C28]">
                      <Store size={11} className="text-[#F28C28]" /> {p.vendor.name}
                    </Link>
                  )}
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-sm font-black text-[#F28C28] dark:text-amber-400">{formatCurrency(p.sellingPrice)}</span>
                    {p.salePrice && p.salePrice < p.price ? (
                      <span className="text-[11px] text-gray-400 line-through">{formatCurrency(p.price)}</span>
                    ) : null}
                  </div>
                  {Number(p.rating) > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                      <Star size={11} fill="currentColor" className="text-[#E58C28]" /> {p.rating} ({p.reviewCount ?? 0})
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
                        vendorId: p.vendor?.id,
                        vendorName: p.vendor?.name,
                        vendorSlug: p.vendor?.slug,
                      })
                    }
                    className="mt-auto py-2 rounded-full bg-[#F28C28]/10 hover:bg-[#F28C28] text-[#F28C28] hover:text-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-[11px] font-extrabold cursor-pointer transition-all"
                  >
                    {p.inStock ? "Add to cart" : "Out of stock"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {products.length < total && (
          <div className="text-center">
            <button
              onClick={async () => {
                setLoadingMore(true);
                try {
                  await loadProducts(category._id, page + 1);
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

export default MarketplaceCategoryDetailPage;
