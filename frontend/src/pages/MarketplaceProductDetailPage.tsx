import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { storeApi, toStoreProduct } from "../services/marketplace.service";
import { useCart } from "../contexts/CartContext";
import { formatCurrency } from "../utils/format";
import { humanizeLabel } from "../utils/labels";
import {
  BadgeCheck,
  Minus,
  PackageSearch,
  Plus,
  ShieldCheck,
  Star,
  Store,
  Truck,
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
  authenticityCertificate?: string;
  images?: string[];
  categoryId?: string;
  categoryName?: string;
  inStock?: boolean;
  vendor?: {
    id?: string;
    name?: string;
    slug?: string;
    location?: string;
    isVerified?: boolean;
  };
  rating?: number;
  reviewCount?: number;
  specifications?: Array<{ key: string; value: string }>;
}

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

const priceOf = (p: Product) => Number(p.salePrice ?? p.price ?? 0);
const discountOf = (p: Product) => {
  const list = Number(p.price ?? 0);
  const sale = Number(p.salePrice ?? 0);
  if (!list || !sale || sale >= list) return 0;
  return Math.round(((list - sale) / list) * 100);
};

interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  createdAt: string;
  customerId?: { name?: string };
}

export const MarketplaceProductDetailPage: React.FC = () => {
  const { productSlug, idOrSlug: legacyKey } = useParams();
  const idOrSlug = productSlug || legacyKey;
  const navigate = useNavigate();
  const { add, close } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);

  const load = useCallback(async () => {
    if (!idOrSlug) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await storeApi.product(idOrSlug);
      const row: Product = toStoreProduct(res.data?.data);
      setProduct(row);
      setActiveImage(0);
      setQuantity(1);
      const [rel, rev] = await Promise.all([
        row.categoryId
          ? storeApi.products({ categoryId: row.categoryId, limit: 8 }).catch(() => null)
          : Promise.resolve(null),
        storeApi.reviews(row._id, { limit: 10 }).catch(() => null),
      ]);
      setRelated(
        (rel?.data?.data ?? [])
          .map(toStoreProduct)
          .filter((p: Product) => p._id !== row._id),
      );
      setReviews(rev?.data?.data ?? []);
    } catch {
      setProduct(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-square rounded-3xl bg-gray-100 dark:bg-slate-900 animate-pulse" />
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-6 rounded-lg bg-gray-100 dark:bg-slate-900 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );

  if (failed || !product)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <PackageSearch size={36} className="text-gray-300" />
        <h1 className="text-lg font-black text-[#0B192C] dark:text-white">
          This product could not be found
        </h1>
        <p className="text-xs text-gray-500">
          It may have been removed or is no longer on sale.
        </p>
        <button
          onClick={() => navigate("/marketplace")}
          className="px-5 py-2.5 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-extrabold cursor-pointer"
        >
          Back to marketplace
        </button>
      </div>
    );

  const images = product.images?.length ? product.images : [FALLBACK_IMAGE];
  const discount = discountOf(product);
  const outOfStock =
    product.inStock === false ||
    (product.stock !== undefined && product.stock <= 0);
  const maxQty = Math.min(product.stock ?? 20, 20);

  const addToCart = () => {
    add(
      {
        productId: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images?.[0],
        displayPrice: priceOf(product),
        maxQuantity: product.stock,
        vendorId: product.vendor?.id,
        vendorName: product.vendor?.name,
        vendorSlug: product.vendor?.slug,
      },
      quantity,
    );
  };

  const buyNow = () => {
    add(
      {
        productId: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images?.[0],
        displayPrice: priceOf(product),
        maxQuantity: product.stock,
        vendorId: product.vendor?.id,
        vendorName: product.vendor?.name,
        vendorSlug: product.vendor?.slug,
      },
      quantity,
      false,
    );
    close();
    navigate("/marketplace/checkout");
  };

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800">
              <img
                src={images[activeImage]}
                alt={product.name}
                className="w-full aspect-square object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                }}
              />
              {discount > 0 && (
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-rose-500 text-white text-[11px] font-black">
                  {discount}% off
                </span>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    aria-label={`Image ${i + 1}`}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer ${
                      i === activeImage
                        ? "border-[#F28C28]"
                        : "border-transparent opacity-70"
                    }`}
                  >
                    <img
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          FALLBACK_IMAGE;
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white">
                {product.name}
              </h1>
              {product.templeSource && (
                <p className="text-xs text-gray-500">{product.templeSource}</p>
              )}
              {product.rating ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0B192C] dark:text-white">
                  <Star size={13} className="fill-[#E58C28] text-[#E58C28]" />
                  {product.rating}
                  {product.reviewCount ? (
                    <span className="text-gray-400 font-medium">
                      ({product.reviewCount})
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-black text-[#F28C28] dark:text-amber-400">
                {formatCurrency(priceOf(product))}
              </span>
              {discount > 0 && (
                <span className="text-sm text-gray-400 line-through">
                  {formatCurrency(Number(product.price))}
                </span>
              )}
              <span
                className={`text-[11px] font-black ${outOfStock ? "text-rose-500" : "text-emerald-600"}`}
              >
                {outOfStock
                  ? "Out of stock"
                  : product.stock !== undefined
                    ? `${product.stock} in stock`
                    : "In stock"}
              </span>
            </div>

            {product.description && (
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {product.description}
              </p>
            )}

            {!outOfStock && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-gray-200 dark:border-slate-700 rounded-full shrink-0">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label="Decrease quantity"
                      className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-[#F28C28] cursor-pointer"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="px-3 text-sm font-black tabular-nums">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                      aria-label="Increase quantity"
                      className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-[#F28C28] cursor-pointer"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <button
                    onClick={addToCart}
                    className="flex-1 py-3 rounded-full border-2 border-[#F28C28] text-[#F28C28] dark:text-amber-400 hover:bg-[#F28C28]/5 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    Add to cart
                  </button>
                </div>
                <button
                  onClick={buyNow}
                  className="w-full py-3 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  Buy now
                </button>
              </div>
            )}

            <dl className="text-xs space-y-2 border-t border-gray-100 dark:border-slate-800 pt-3">
              {product.weight && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Weight</dt>
                  <dd className="font-bold text-[#0B192C] dark:text-white">
                    {product.weight}
                  </dd>
                </div>
              )}
              {(product.categoryName || product.category) && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Category</dt>
                  <dd className="font-bold text-[#0B192C] dark:text-white">
                    {product.categoryName ?? humanizeLabel(product.category ?? "")}
                  </dd>
                </div>
              )}
              {product.vendor?.name && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Sold by</dt>
                  <dd className="font-bold text-[#0B192C] dark:text-white text-right">
                    {product.vendor.slug ? (
                      <Link
                        to={`/marketplace/store/${product.vendor.slug}`}
                        className="inline-flex items-center gap-1 hover:text-[#F28C28]"
                      >
                        <Store size={12} className="text-[#F28C28]" />
                        {product.vendor.name}
                      </Link>
                    ) : (
                      product.vendor.name
                    )}
                    {product.vendor.isVerified && (
                      <BadgeCheck
                        size={12}
                        className="inline ml-1 text-emerald-600"
                      />
                    )}
                  </dd>
                </div>
              )}
              {product.vendor?.location && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Origin</dt>
                  <dd className="font-bold text-[#0B192C] dark:text-white">
                    {product.vendor.location}
                  </dd>
                </div>
              )}
              {product.authenticityCertificate && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Authenticity</dt>
                  <dd className="font-bold text-[#0B192C] dark:text-white text-right">
                    {product.authenticityCertificate}
                  </dd>
                </div>
              )}
              {(product.specifications ?? []).map((spec) => (
                <div key={spec.key} className="flex justify-between gap-3">
                  <dt className="text-gray-500">{spec.key}</dt>
                  <dd className="font-bold text-[#0B192C] dark:text-white text-right">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-4 text-[11px] font-bold text-gray-500 border-t border-gray-100 dark:border-slate-800 pt-3">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-600" /> Secure
                payment
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck size={13} className="text-[#F28C28]" /> Shipping
                calculated per store at checkout
              </span>
            </div>
          </div>
        </div>

        <section className="space-y-4 pt-6 border-t border-gray-200 dark:border-slate-800">
          <h2 className="text-base font-black text-[#0B192C] dark:text-white">
            Customer reviews
          </h2>
          {reviews.length === 0 ? (
            <p className="text-xs text-gray-500">
              No reviews yet. Reviews come only from customers who received this
              product.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {reviews.map((review) => (
                <article
                  key={review._id}
                  className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0B192C] p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={12}
                          fill={n <= review.rating ? "currentColor" : "none"}
                          className={n <= review.rating ? "text-[#E58C28]" : "text-gray-300"}
                        />
                      ))}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 inline-flex items-center gap-1">
                      <BadgeCheck size={11} /> Verified purchase
                    </span>
                  </div>
                  {review.title && (
                    <h3 className="text-xs font-black text-[#0B192C] dark:text-white">
                      {review.title}
                    </h3>
                  )}
                  {review.comment && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                      {review.comment}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400">
                    {review.customerId?.name ?? "Customer"} ·{" "}
                    {new Date(review.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {related.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-slate-800">
            <h2 className="text-base font-black text-[#0B192C] dark:text-white">
              More {product.categoryName ?? humanizeLabel(product.category ?? "items")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.slice(0, 4).map((rel) => (
                <Link
                  key={rel._id}
                  to={`/marketplace/products/${rel.slug || rel._id}`}
                  className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-[#E58C28]/60 transition-all"
                >
                  <img
                    src={rel.images?.[0] || FALLBACK_IMAGE}
                    alt={rel.name}
                    loading="lazy"
                    className="w-full aspect-[4/3] object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                    }}
                  />
                  <div className="p-3">
                    <h3 className="text-xs font-bold text-[#0B192C] dark:text-white line-clamp-2">
                      {rel.name}
                    </h3>
                    <span className="text-sm font-black text-[#F28C28] dark:text-amber-400">
                      {formatCurrency(priceOf(rel))}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceProductDetailPage;
