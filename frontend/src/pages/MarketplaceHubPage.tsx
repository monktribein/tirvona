import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { marketplaceService } from "../services/marketplace.service";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";
import { humanizeLabel } from "../utils/labels";
import { useCart } from "../contexts/CartContext";
import {
  ArrowRight,
  BadgeCheck,
  Home,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  X,
} from "lucide-react";

interface Product {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  price?: number;
  salePrice?: number;
  stock?: number;
  templeSource?: string;
  weight?: string;
  images?: string[];
  vendor?: { name?: string; location?: string; isVerified?: boolean };
  rating?: number;
  reviewCount?: number;
  specifications?: Array<{ key: string; value: string }>;
  isFeatured?: boolean;
}

interface Category {
  _id: string;
  name: string;
  slug?: string;
}

const PAGE_SIZE = 24;
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
] as const;

const priceOf = (product: Product): number =>
  Number(product.salePrice ?? product.price ?? 0);

const discountOf = (product: Product): number => {
  const list = Number(product.price ?? 0);
  const sale = Number(product.salePrice ?? 0);
  if (!list || !sale || sale >= list) return 0;
  return Math.round(((list - sale) / list) * 100);
};

const ProductCard: React.FC<{
  product: Product;
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
}> = ({ product, onOpen, onAdd }) => {
  const discount = discountOf(product);
  const outOfStock = product.stock !== undefined && product.stock <= 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      className="group text-left bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-[#E58C28]/60 transition-all cursor-pointer flex flex-col"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-slate-900">
        <img
          src={product.images?.[0] || FALLBACK_IMAGE}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
        />
        {discount > 0 && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
            {discount}% off
          </span>
        )}
        {product.rating ? (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-black flex items-center gap-1">
            <Star size={9} className="fill-[#E58C28] text-[#E58C28]" />
            {product.rating}
          </span>
        ) : null}
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-[#0B192C]/85 text-white text-[10px] font-black text-center py-1">
            Out of stock
          </span>
        )}
      </div>

      <div className="p-3 space-y-1 flex-1 flex flex-col">
        <h3 className="text-sm font-bold text-[#0B192C] dark:text-white line-clamp-2 leading-snug">
          {product.name}
        </h3>
        {product.templeSource && (
          <p className="text-[11px] text-gray-500 truncate">
            {product.templeSource}
          </p>
        )}
        <div className="flex items-baseline gap-2 pt-1 mt-auto">
          <span className="text-sm font-black text-[#0A4DA6] dark:text-blue-400">
            {formatCurrency(priceOf(product))}
          </span>
          {discount > 0 && (
            <span className="text-[11px] text-gray-400 line-through">
              {formatCurrency(Number(product.price))}
            </span>
          )}
        </div>
        {product.vendor?.isVerified && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
            <BadgeCheck size={11} /> Verified vendor
          </span>
        )}

        {/* Nested inside a card that is itself a button, so the click must be
            stopped from also opening the detail view. */}
        <span
          role="button"
          tabIndex={0}
          aria-disabled={outOfStock}
          onClick={(e) => {
            e.stopPropagation();
            if (!outOfStock) onAdd(product);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              if (!outOfStock) onAdd(product);
            }
          }}
          className={`mt-2 w-full py-2 rounded-full text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all ${
            outOfStock
              ? "bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed"
              : "bg-[#0A4DA6] hover:bg-blue-900 text-white cursor-pointer"
          }`}
        >
          <ShoppingBag size={12} />
          {outOfStock ? "Out of stock" : "Add to cart"}
        </span>
      </div>
    </button>
  );
};

/**
 * Detail view for a picked product.
 *
 * A modal rather than a route because the app has no product-detail page and
 * inventing one would mean touching the router; the record is fetched from the
 * same public endpoint the listing uses, so nothing here is mocked.
 */
const ProductModal: React.FC<{
  product: Product;
  onClose: () => void;
  onAdd: (product: Product) => void;
}> = ({ product, onClose, onAdd }) => {
  const [detail, setDetail] = useState<Product>(product);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    marketplaceService
      .getBySlug(product.slug || product._id)
      .then((res) => {
        if (!cancelled && res.data?.data) setDetail(res.data.data);
      })
      // The listing row is already a complete product, so a failed refetch just
      // means the modal shows what the grid had rather than an error.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const discount = discountOf(detail);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={detail.name}
    >
      <div
        className="bg-white dark:bg-[#0B192C] rounded-2xl max-w-3xl w-full max-h-[88vh] overflow-y-auto overscroll-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-[#0B192C] z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-[#0B192C] dark:text-white">
              {detail.name}
            </h2>
            {detail.templeSource && (
              <p className="text-xs text-gray-500">{detail.templeSource}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <img
            src={detail.images?.[0] || FALLBACK_IMAGE}
            alt={detail.name}
            className="w-full rounded-xl object-cover aspect-square bg-gray-100 dark:bg-slate-900"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
          />

          <div className="space-y-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-black text-[#0A4DA6] dark:text-blue-400">
                {formatCurrency(priceOf(detail))}
              </span>
              {discount > 0 && (
                <>
                  <span className="text-sm text-gray-400 line-through">
                    {formatCurrency(Number(detail.price))}
                  </span>
                  <span className="text-[11px] font-black text-rose-500">
                    {discount}% off
                  </span>
                </>
              )}
            </div>

            {detail.description && (
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {detail.description}
              </p>
            )}

            <dl className="text-xs space-y-1.5">
              {detail.weight && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Weight</dt>
                  <dd className="font-bold text-[#0B192C] dark:text-white">
                    {detail.weight}
                  </dd>
                </div>
              )}
              {detail.vendor?.name && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Vendor</dt>
                  <dd className="font-bold text-[#0B192C] dark:text-white text-right">
                    {detail.vendor.name}
                    {detail.vendor.isVerified && (
                      <BadgeCheck
                        size={12}
                        className="inline ml-1 text-emerald-600"
                      />
                    )}
                  </dd>
                </div>
              )}
              {detail.vendor?.location && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Origin</dt>
                  <dd className="font-bold text-[#0B192C] dark:text-white">
                    {detail.vendor.location}
                  </dd>
                </div>
              )}
              {detail.stock !== undefined && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Availability</dt>
                  <dd
                    className={`font-bold ${detail.stock > 0 ? "text-emerald-600" : "text-rose-500"}`}
                  >
                    {detail.stock > 0
                      ? `${detail.stock} in stock`
                      : "Out of stock"}
                  </dd>
                </div>
              )}
              {(detail.specifications ?? []).map((spec) => (
                <div key={spec.key} className="flex justify-between gap-3">
                  <dt className="text-gray-500">{spec.key}</dt>
                  <dd className="font-bold text-[#0B192C] dark:text-white text-right">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>

            {loading && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" /> Loading full
                details
              </p>
            )}

            <button
              type="button"
              disabled={detail.stock !== undefined && detail.stock <= 0}
              onClick={() => {
                onAdd(detail);
                onClose();
              }}
              className="w-full py-3 rounded-full bg-[#0A4DA6] hover:bg-blue-900 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
            >
              <ShoppingBag size={14} />
              {detail.stock !== undefined && detail.stock <= 0
                ? "Out of stock"
                : "Add to cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MarketplaceHubPage: React.FC = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] =
    useState<(typeof SORTS)[number]["value"]>("featured");
  const [selected, setSelected] = useState<Product | null>(null);

  const { add: addLineToCart } = useCart();
  const requestId = useRef(0);

  /**
   * `displayPrice` is only for the cart's indicative subtotal — checkout
   * re-prices every line from the catalogue, so a stale figure here can never
   * become the amount charged.
   */
  const addToCart = useCallback(
    (product: Product) => {
      addLineToCart({
        productId: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images?.[0],
        displayPrice: priceOf(product),
        maxQuantity: product.stock,
      });
    },
    [addLineToCart],
  );

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(term.trim()), 300);
    return () => window.clearTimeout(id);
  }, [term]);

  useEffect(() => {
    api
      .get("/marketplace/categories")
      .then((res) => setCategories(res.data?.data ?? []))
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      const ticket = ++requestId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await marketplaceService.getProducts({
          page: nextPage,
          limit: PAGE_SIZE,
          ...(search ? { search } : {}),
          ...(category ? { category } : {}),
          ...(sortBy !== "featured" ? { sortBy } : {}),
        });
        // A slower earlier request must not overwrite a newer result.
        if (ticket !== requestId.current) return;
        const rows: Product[] = res.data?.data ?? [];
        setProducts((prev) => (append ? [...prev, ...rows] : rows));
        setTotal(Number(res.data?.total ?? rows.length));
        setPage(nextPage);
        setFailed(false);
      } catch {
        if (ticket !== requestId.current) return;
        if (!append) setProducts([]);
        setFailed(true);
      } finally {
        if (ticket === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [search, category, sortBy],
  );

  useEffect(() => {
    load(1, false);
  }, [load]);

  const hasMore = products.length < total;
  const activeFilters = Boolean(search || category);

  /**
   * Filter options come from the products themselves as well as the category
   * collection, because that collection is currently empty while products do
   * carry a `category` value — sourcing it from categories alone left the
   * dropdown with nothing but "All categories" in it.
   */
  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const value of [
      ...categories.map((c) => c.name),
      ...products.map((p) => p.category),
    ]) {
      const raw = (value ?? "").trim();
      if (raw && !seen.has(raw.toLowerCase())) seen.set(raw.toLowerCase(), raw);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [categories, products]);

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-3xl sm:text-5xl font-bold text-[#E58C28]">
            Shops &amp; Sacred Marketplace
          </p>
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Authentic temple prasad, lab-certified rudraksha, tulsi mala and
            puja samagri from verified sacred vendors.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* One filter row above everything it scopes. */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search prasad, rudraksha, mala, puja items..."
              aria-label="Search marketplace"
              className="w-full pl-10 pr-9 py-2.5 rounded-full border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0B192C] text-xs font-medium text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#0A4DA6] focus:ring-2 focus:ring-[#0A4DA6]/15"
            />
            {term && (
              <button
                onClick={() => setTerm("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0A4DA6] cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
              className="px-4 py-2.5 rounded-full border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0B192C] text-xs font-bold text-[#0B192C] dark:text-white cursor-pointer focus:outline-none focus:border-[#0A4DA6]"
            >
              <option value="">All categories</option>
              {categoryOptions.map((name) => (
                <option key={name} value={name}>
                  {humanizeLabel(name)}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort products"
              className="px-4 py-2.5 rounded-full border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0B192C] text-xs font-bold text-[#0B192C] dark:text-white cursor-pointer focus:outline-none focus:border-[#0A4DA6]"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!loading && !failed && products.length > 0 && (
          <p className="text-xs text-gray-500 font-semibold">
            Showing {products.length} of {total} item{total === 1 ? "" : "s"}
            {activeFilters && (
              <button
                onClick={() => {
                  setTerm("");
                  setCategory("");
                }}
                className="ml-2 text-[#0A4DA6] hover:underline font-bold cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-gray-100 dark:bg-slate-900 animate-pulse h-72"
              />
            ))}
          </div>
        ) : failed ? (
          <div className="text-center py-16 space-y-3">
            <PackageSearch size={34} className="mx-auto text-gray-300" />
            <p className="text-sm font-bold text-[#0B192C] dark:text-white">
              The marketplace could not be loaded
            </p>
            <button
              onClick={() => load(1, false)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold cursor-pointer"
            >
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        ) : products.length === 0 ? (
          // An empty catalogue is the original "coming soon" state, kept for
          // the genuinely-empty case instead of being shown unconditionally.
          <div className="text-center py-10 space-y-6">
            {activeFilters ? (
              <>
                <PackageSearch size={34} className="mx-auto text-gray-300" />
                <p className="text-sm font-bold text-[#0B192C] dark:text-white">
                  Nothing matched your filters
                </p>
                <button
                  onClick={() => {
                    setTerm("");
                    setCategory("");
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold cursor-pointer"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <img
                  src="/banner/coming soon/marketplace.png"
                  alt="Marketplace coming soon"
                  className="w-full max-w-2xl mx-auto h-auto max-h-[420px] object-contain drop-shadow-md"
                />
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button
                    onClick={() => navigate("/")}
                    className="px-6 py-3 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Home size={16} /> Back to home
                  </button>
                  <button
                    onClick={() => navigate("/search")}
                    className="px-6 py-3 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    Explore verified ashrams <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {products.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onOpen={setSelected}
                  onAdd={addToCart}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => load(page + 1, true)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0A4DA6] hover:bg-blue-900 disabled:opacity-60 text-white text-xs font-extrabold shadow-md cursor-pointer transition-all"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Loading
                    </>
                  ) : (
                    <>
                      Load more <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <ProductModal
          product={selected}
          onClose={() => setSelected(null)}
          onAdd={addToCart}
        />
      )}
    </div>
  );
};

export default MarketplaceHubPage;
