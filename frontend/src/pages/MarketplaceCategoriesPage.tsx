import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Loader2, PackageSearch, Search, Tags } from "lucide-react";
import { flattenCategories, storeApi, type StoreCategory } from "../services/marketplace.service";

/** All vendor marketplace categories (managed by Tirvona admins). */
const MarketplaceCategoriesPage: React.FC = () => {
  const [tree, setTree] = useState<StoreCategory[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");

  const load = () => {
    setState("loading");
    storeApi
      .categories()
      .then((res) => {
        setTree(res.data?.data ?? []);
        setState("ready");
      })
      .catch(() => setState("error"));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tree;
    return flattenCategories(tree).filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
  }, [tree, query]);

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          <h1 className="font-['Kalam'] text-3xl sm:text-5xl font-bold text-[#E58C28]">Marketplace categories</h1>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200">
            Browse products from verified Tirvona sellers by category.
          </p>
        </div>

        <div className="relative max-w-xl mx-auto">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories"
            aria-label="Search categories"
            className="w-full pl-10 pr-4 py-3 rounded-full border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0B192C] text-sm font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28]"
          />
        </div>

        {state === "loading" ? (
          <div className="py-16 flex justify-center">
            <Loader2 size={26} className="animate-spin text-[#F28C28]" />
          </div>
        ) : state === "error" ? (
          <div className="text-center py-16 space-y-3">
            <PackageSearch size={32} className="mx-auto text-gray-300" />
            <p className="text-sm font-bold text-[#0B192C] dark:text-white">Categories could not be loaded</p>
            <button onClick={load} className="px-5 py-2.5 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-extrabold cursor-pointer">
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Tags size={32} className="mx-auto text-gray-300" />
            <p className="text-sm font-bold text-[#0B192C] dark:text-white">No categories found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((cat) => (
              <div
                key={cat._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] overflow-hidden shadow-sm hover:shadow-lg hover:border-[#E58C28]/60 transition-all"
              >
                <Link to={`/marketplace/category/${cat.slug}`} className="block">
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} loading="lazy" className="w-full aspect-[16/9] object-cover" />
                  ) : (
                    <div className="w-full aspect-[16/9] bg-[#FFF4E5] dark:bg-slate-900 flex items-center justify-center">
                      <Tags size={30} className="text-[#F28C28]" />
                    </div>
                  )}
                  <div className="p-4 space-y-1">
                    <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center justify-between gap-2">
                      {cat.name} <ChevronRight size={15} className="text-[#F28C28]" />
                    </h2>
                    {cat.description && <p className="text-xs text-gray-500 line-clamp-2">{cat.description}</p>}
                  </div>
                </Link>
                {!query && (cat.children?.length ?? 0) > 0 && (
                  <div className="px-4 pb-4 flex flex-wrap gap-1.5">
                    {cat.children!.map((child) => (
                      <Link
                        key={child._id}
                        to={`/marketplace/category/${child.slug}`}
                        className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:text-[#F28C28]"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceCategoriesPage;
