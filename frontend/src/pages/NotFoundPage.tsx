import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Compass, Home, Loader2, Search } from "lucide-react";
import api from "../lib/api";

/**
 * Unknown URLs land here rather than being bounced to the homepage. Before
 * giving up we ask the API whether this path has moved, which covers any
 * legacy link that reached the SPA without passing through the server's 301.
 */
export const NotFoundPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    void (async () => {
      try {
        const res = await api.get("/url/lookup", {
          params: { path: location.pathname },
          skipToast: true,
        } as never);
        const redirectTo = res.data?.redirectTo;
        if (!cancelled && redirectTo) {
          navigate(redirectTo, { replace: true });
          return;
        }
      } catch {
        /* fall through to the 404 view */
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (checking) return;
    const previousTitle = document.title;
    document.title = "Page not found · Tirvona";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,follow";
    document.head.appendChild(robots);
    return () => {
      document.title = previousTitle;
      robots.remove();
    };
  }, [checking]);

  if (checking)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={26} className="animate-spin text-[#0A4DA6]" />
      </div>
    );

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-5">
        <p className="text-6xl font-black text-[#0A4DA6]">404</p>
        <div className="space-y-2">
          <h1 className="text-xl font-black text-[#0B192C] dark:text-white">
            This page does not exist
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The link may be broken, or the page may have moved. The address we
            could not find was:
          </p>
          <p className="text-[11px] font-mono break-all text-gray-400 bg-gray-50 dark:bg-slate-900 rounded-lg px-3 py-2">
            {location.pathname}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold"
          >
            <Home size={14} /> Go to homepage
          </Link>
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold"
          >
            <Search size={14} /> Search ashrams
          </Link>
          <Link
            to="/destinations"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold"
          >
            <Compass size={14} /> Browse destinations
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
