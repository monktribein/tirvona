import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Home,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { getErrorMessage } from "../../lib/api";
import { normalizeRole } from "../../utils/roleRedirect";
import { EnterpriseStatusBadge } from "../../admin/shared/components/EnterpriseStatusBadge";
import { ASSISTANT_ROOT, isDisabled, labelOf, resolvePath, visibleChildren } from "./assistantFlow";
import { assistantConfigApi, toMenuConfig, type PublishedConfig } from "./assistantConfig";
import type {
  AssistantContext,
  AssistantNode,
  DataNode,
  FilterOption,
  FilterSpec,
  ResultLink,
  ResultSet,
  Values,
} from "./assistantTypes";

/** Pages where the panel would sit on top of a payment, a login or a gate scanner. */
const HIDDEN_ON =
  /(^\/(login|register|reset-password)\b)|\/checkout\b|\/pay\/|(^\/(parking|aarti|events)\/gate\b)|^\/smart-contact/;
/** Pages with their own bottom-right control or a mobile bottom bar. */
const LANDING = /^\/(public)?$/;
const STICKY_BAR = /^\/(ashrams\/[^/]+\/[^/]+|ashram\/|stay\/|offers\/|food)/;

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-[#0B192C] outline-none focus:border-[#F28C28] focus:ring-1 focus:ring-[#F28C28] dark:border-slate-700 dark:bg-[#0B192C] dark:text-white";

const safeTo = (to?: string) =>
  to && to.startsWith("/") && !to.startsWith("//") && !/\/(undefined|null)(\/|\?|$)/.test(to) ? to : undefined;

const statusKey = (label: string) => label.toLowerCase().replace(/\s+/g, "_");

/** A short, honest message for a failed read; 401/403 are permission boundaries, not faults. */
const failureText = (err: unknown): string => {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 401) return "Please sign in to see this.";
  if (status === 403) return "Your account does not have access to this.";
  if (status === 404) return "Nothing is set up for your account here yet.";
  return getErrorMessage(err, "We could not load this right now. Please try again.");
};

// ── Filters ──────────────────────────────────────────────────────────────────

const FilterField: React.FC<{
  spec: FilterSpec;
  value: string;
  options: FilterOption[];
  loading: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}> = ({ spec, value, options, loading, disabled, onChange }) => {
  const id = `tv-assistant-${spec.key}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        {spec.label}
        {spec.required ? " *" : ""}
      </label>
      {spec.type === "select" ? (
        <select
          id={id}
          className={inputClass}
          value={value}
          disabled={disabled || loading}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{loading ? "Loading…" : disabled ? `Choose ${spec.dependsOn} first` : "Any"}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className={inputClass}
          type={spec.type === "date" ? "date" : "text"}
          value={value}
          placeholder={spec.placeholder}
          min={spec.type === "date" ? new Date().toISOString().slice(0, 10) : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};

// ── A live result screen ─────────────────────────────────────────────────────

type Phase = "idle" | "loading" | "ready" | "error";

const DataView: React.FC<{
  node: DataNode;
  ctx: AssistantContext;
  onLeave: () => void;
  onOpenCart: () => void;
}> = ({ node, ctx, onLeave, onOpenCart }) => {
  const location = useLocation();
  const filters = node.filters ?? [];
  const [values, setValues] = useState<Values>({});
  const [options, setOptions] = useState<Record<string, FilterOption[]>>({});
  const [optionsLoading, setOptionsLoading] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultSet | null>(null);
  const [formError, setFormError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const run = useRef(0);
  const blocked = Boolean(node.needsLogin && !ctx.user);

  // Filter choices come from the existing APIs; a dependent filter reloads when its parent changes.
  useEffect(() => {
    if (blocked) return;
    let live = true;
    filters.forEach((spec) => {
      if (!spec.loadOptions) return;
      if (spec.dependsOn && !values[spec.dependsOn]) {
        setOptions((o) => ({ ...o, [spec.key]: [] }));
        return;
      }
      setOptionsLoading((s) => ({ ...s, [spec.key]: true }));
      spec
        .loadOptions(ctx, values)
        .then((list) => live && setOptions((o) => ({ ...o, [spec.key]: list })))
        .catch(() => live && setOptions((o) => ({ ...o, [spec.key]: [] })))
        .finally(() => live && setOptionsLoading((s) => ({ ...s, [spec.key]: false })));
    });
    return () => {
      live = false;
    };
    // Only the parent values matter for dependent filters; independent ones load once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, ...filters.filter((f) => f.dependsOn).map((f) => values[f.dependsOn as string])]);

  const search = useCallback(
    async (current: Values) => {
      const problem = node.validate?.(current) ?? null;
      const missing = filters.find((f) => f.required && !current[f.key]);
      if (problem || missing) {
        setFormError(problem ?? `Please fill in ${missing?.label}.`);
        return;
      }
      setFormError("");
      const id = ++run.current;
      setPhase("loading");
      try {
        const next = await node.load(ctx, current);
        if (id !== run.current) return;
        setResult(next);
        setUpdatedAt(new Date());
        setPhase("ready");
      } catch (err) {
        if (id !== run.current) return;
        setError(failureText(err));
        setPhase("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node, ctx.user?.id, ctx.role, ctx.cart],
  );

  const autoRun = node.autoRun ?? !filters.some((f) => f.required);
  useEffect(() => {
    if (blocked || !autoRun) return;
    search({});
    return () => {
      run.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, autoRun, node.id, ctx.user?.id]);

  const change = (spec: FilterSpec, value: string) =>
    setValues((current) => {
      const next = { ...current, [spec.key]: value };
      filters.filter((f) => f.dependsOn === spec.key).forEach((child) => delete next[child.key]);
      return next;
    });

  if (blocked) {
    const here = encodeURIComponent(location.pathname + location.search);
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-[#0B192C]">
        <Lock size={20} className="mx-auto mb-2 text-[#F28C28]" />
        <p className="text-sm font-semibold text-[#0B192C] dark:text-white">Sign in to see this</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {node.label} shows your own records, so Tirvona needs to know who you are.
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Link
            to={`/login?redirect=${here}`}
            onClick={onLeave}
            className="rounded-full bg-[#F28C28] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#D97706]"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            onClick={onLeave}
            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-bold text-[#0B192C] hover:border-[#F28C28] dark:border-slate-700 dark:text-white"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const renderLink = (link: ResultLink) => {
    const cls =
      "inline-flex items-center gap-1 text-xs font-bold text-[#F28C28] hover:underline focus-visible:underline";
    if (link.action === "openCart") {
      return (
        <button key={link.label} type="button" className={cls} onClick={onOpenCart}>
          {link.label} <ChevronRight size={12} />
        </button>
      );
    }
    const to = safeTo(link.to);
    return to ? (
      <Link key={link.label} to={to} onClick={onLeave} className={cls}>
        {link.label} <ExternalLink size={12} />
      </Link>
    ) : null;
  };

  return (
    <div className="space-y-3">
      {filters.length > 0 && (
        <form
          className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#0B192C]/60"
          onSubmit={(e) => {
            e.preventDefault();
            search(values);
          }}
        >
          {filters.map((spec) => (
            <FilterField
              key={spec.key}
              spec={spec}
              value={values[spec.key] ?? ""}
              options={spec.options ?? options[spec.key] ?? []}
              loading={Boolean(optionsLoading[spec.key])}
              disabled={Boolean(spec.dependsOn && !values[spec.dependsOn])}
              onChange={(v) => change(spec, v)}
            />
          ))}
          {formError && (
            <p role="alert" className="text-[11px] font-semibold text-red-600">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={phase === "loading"}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#F28C28] px-3 py-2 text-xs font-bold text-white hover:bg-[#D97706] disabled:opacity-60"
          >
            <Search size={13} /> {node.submitLabel ?? "Show results"}
          </button>
        </form>
      )}

      <div aria-live="polite">
        {phase === "loading" && (
          <p className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 size={15} className="animate-spin text-[#F28C28]" /> Loading from Tirvona…
          </p>
        )}

        {phase === "error" && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <p className="flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
            <button type="button" onClick={() => search(values)} className="mt-2 font-bold underline">
              Try again
            </button>
          </div>
        )}

        {phase === "ready" && result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
              <button
                type="button"
                onClick={() => search(values)}
                className="inline-flex items-center gap-1 font-bold text-[#F28C28] hover:underline"
                aria-label="Refresh these results"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
            {result.note && <p className="text-xs text-slate-600 dark:text-slate-300">{result.note}</p>}

            {result.stats && result.stats.length > 0 && (
              <dl className="grid grid-cols-2 gap-2">
                {result.stats.map((s) => (
                  <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-[#0B192C]/60">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.label}</dt>
                    <dd className="mt-0.5 text-sm font-bold text-[#0B192C] dark:text-white">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {result.items && result.items.length > 0 && (
              <>
                {typeof result.total === "number" && (
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Showing {result.items.length}
                    {result.total > result.items.length ? ` of ${result.total}` : ""}
                  </p>
                )}
                <ul className="space-y-2">
                  {result.items.map((item) => {
                    const to = safeTo(item.to);
                    const body = (
                      <>
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 text-[13px] font-bold leading-snug text-[#0B192C] dark:text-white">{item.title}</span>
                          {item.badge && <EnterpriseStatusBadge status={statusKey(item.badge)} label={item.badge} size="sm" />}
                        </span>
                        {item.subtitle && (
                          <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{item.subtitle}</span>
                        )}
                        {item.meta && item.meta.length > 0 && (
                          <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{item.meta.join(" · ")}</span>
                        )}
                      </>
                    );
                    const cls =
                      "block rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-700 dark:bg-[#0B192C]/60";
                    return (
                      <li key={item.id}>
                        {to ? (
                          <Link to={to} onClick={onLeave} className={`${cls} hover:border-[#F28C28] focus-visible:border-[#F28C28]`}>
                            {body}
                          </Link>
                        ) : (
                          <div className={cls}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {!result.items?.length && !result.stats?.length && (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {result.emptyText ?? "Nothing to show here yet."}
              </p>
            )}

            {result.links && result.links.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">{result.links.map(renderLink)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── The assistant ────────────────────────────────────────────────────────────

export const TirvonaAssistant: React.FC = () => {
  const { user } = useAuth();
  const cart = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [path, setPath] = useState<string[]>([]);
  const [published, setPublished] = useState<PublishedConfig | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);

  const ctx = useMemo<AssistantContext>(
    () => ({
      user: user
        ? { id: user.id, name: user.name, role: user.role, parkingRoles: user.parkingRoles, email: user.email }
        : null,
      config: toMenuConfig(published),
      role: user ? normalizeRole(user.role) : "guest",
      cart: cart.lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        displayPrice: l.displayPrice,
        quantity: l.quantity,
      })),
    }),
    [user, cart.lines, published],
  );

  // The Super Admin's published menu. Read when the assistant opens, at most once a minute; if the read
  // fails it falls back to the last good copy, then to the built-in menu. It waits briefly so the first
  // screen already has the right order, but never blocks the assistant on a slow server.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const wait = new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), 2500));
    const load = assistantConfigApi.load();
    Promise.race([load, wait]).then((first) => {
      if (live && first !== "slow") setPublished(first);
      if (live) setConfigReady(true);
    });
    load.then((late) => live && setPublished(late));
    return () => {
      live = false;
    };
  }, [open]);

  // A different account must never inherit the previous account's screen.
  useEffect(() => {
    setPath([]);
  }, [user?.id]);

  const close = useCallback(() => {
    setOpen(false);
    launcher.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [path]);

  const trail = useMemo(() => resolvePath(path, ctx), [path, ctx]);
  // If the account changed so a step is no longer reachable, fall back to what still is.
  useEffect(() => {
    if (trail.length !== path.length) setPath(trail.map((n) => n.id));
  }, [trail, path.length]);

  if (HIDDEN_ON.test(location.pathname)) return null;

  const current: AssistantNode = trail[trail.length - 1] ?? ASSISTANT_ROOT;
  const atRoot = trail.length === 0;

  const lift = LANDING.test(location.pathname)
    ? "bottom-20 sm:bottom-24"
    : STICKY_BAR.test(location.pathname)
      ? "bottom-24 lg:bottom-6"
      : "bottom-4 sm:bottom-6";

  const select = (node: AssistantNode) => {
    if (isDisabled(node, ctx)) return;
    if (node.kind === "nav") {
      const to = safeTo(typeof node.to === "function" ? node.to(ctx) : node.to);
      if (to) {
        setOpen(false);
        navigate(to);
      }
      return;
    }
    setPath([...path, node.id]);
  };

  const welcome = user ? `Signed in as ${user.name?.split(" ")[0] || "you"}.` : "You are browsing as a guest.";

  return (
    <>
      <button
        ref={launcher}
        type="button"
        aria-label={open ? "Close Tirvona assistant" : "Open Tirvona assistant"}
        aria-expanded={open}
        aria-controls="tirvona-assistant-panel"
        onClick={() => {
          setOpen((v) => !v);
          setEverOpened(true);
        }}
        className={`fixed right-4 sm:right-6 ${lift} z-[55] flex h-12 w-12 items-center justify-center rounded-full bg-[#F28C28] text-white shadow-lg transition hover:bg-[#D97706] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C] print:hidden ${open ? "max-sm:hidden" : ""}`}
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>

      <section
        id="tirvona-assistant-panel"
        role="dialog"
        aria-label="Tirvona assistant"
        aria-hidden={!open}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[56] flex h-[min(620px,calc(100dvh-2rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#FFF8EF] text-left shadow-2xl transition-[opacity,transform,visibility] duration-200 motion-reduce:transition-none dark:border-slate-700 dark:bg-[#070F1B] sm:w-[380px] print:hidden ${open ? "visible translate-y-0 opacity-100" : "invisible translate-y-3 opacity-0"}`}
      >
        <header className="flex items-center justify-between gap-2 bg-[#F28C28] px-4 py-3 text-white">
          <h2 ref={heading} tabIndex={-1} className="flex items-center gap-2 text-sm font-bold outline-none">
            <Sparkles size={16} /> Tirvona Assistant
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close assistant"
            className="rounded-full p-1 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <X size={16} />
          </button>
        </header>

        {everOpened && configReady && (
          <>
            <nav aria-label="Where you are" className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-4 py-2 text-[11px] dark:border-slate-800 dark:bg-[#0B192C]">
              <button type="button" onClick={() => setPath([])} className="font-semibold text-[#F28C28] hover:underline">
                Home
              </button>
              {trail.map((node, i) => (
                <React.Fragment key={node.id}>
                  <ChevronRight size={11} className="text-slate-400" aria-hidden />
                  {i === trail.length - 1 ? (
                    <span aria-current="page" className="font-semibold text-[#0B192C] dark:text-white">
                      {labelOf(node, ctx)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPath(path.slice(0, i + 1))}
                      className="font-semibold text-[#F28C28] hover:underline"
                    >
                      {labelOf(node, ctx)}
                    </button>
                  )}
                </React.Fragment>
              ))}
            </nav>

            <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {atRoot && (
                <div className="mb-3 rounded-2xl rounded-tl-sm border border-[#F28C28]/30 bg-white p-3 dark:bg-[#0B192C]">
                  <p className="text-sm font-bold text-[#0B192C] dark:text-white">Hello! Welcome to Tirvona 👋</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {welcome} What would you like to do?
                  </p>
                </div>
              )}

              {current.kind === "menu" && (
                <ul className={atRoot ? "grid grid-cols-2 gap-2" : "space-y-2"}>
                  {visibleChildren(current, ctx).map((node) => {
                    const Icon = node.icon;
                    const gated = Boolean(node.needsLogin && !ctx.user);
                    const off = isDisabled(node, ctx);
                    return (
                      <li key={node.id}>
                        <button
                          type="button"
                          onClick={() => select(node)}
                          disabled={off}
                          className={`group flex ${off ? "cursor-not-allowed opacity-60" : ""} w-full rounded-xl border border-slate-200 bg-white text-left hover:border-[#F28C28] focus-visible:border-[#F28C28] focus-visible:outline-none dark:border-slate-700 dark:bg-[#0B192C]/60 ${
                            atRoot ? "h-full flex-col gap-1.5 p-3" : "items-center gap-3 p-3"
                          }`}
                        >
                          {Icon && (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F28C28]/10 text-[#F28C28]">
                              <Icon size={16} />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-bold leading-tight text-[#0B192C] dark:text-white">{labelOf(node, ctx)}</span>
                            {off ? (
                              <span className="mt-0.5 block text-[11px] font-semibold text-amber-700 dark:text-amber-400">Temporarily unavailable</span>
                            ) : node.description && (
                              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                                {node.description}
                              </span>
                            )}
                          </span>
                          {!atRoot && (
                            <span className="flex shrink-0 items-center gap-1 text-slate-400 group-hover:text-[#F28C28]">
                              {gated && <Lock size={11} aria-label="Sign in required" />}
                              {node.kind === "nav" ? <ExternalLink size={13} /> : <ChevronRight size={14} />}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {current.kind === "data" && (
                <DataView
                  key={`${current.id}:${trail.map((n) => n.id).join("/")}:${ctx.user?.id ?? "guest"}`}
                  node={current}
                  ctx={ctx}
                  onLeave={() => setOpen(false)}
                  onOpenCart={() => {
                    setOpen(false);
                    cart.open();
                  }}
                />
              )}
            </div>

            <footer className="grid grid-cols-3 gap-1 border-t border-slate-200 bg-white px-2 py-2 dark:border-slate-800 dark:bg-[#0B192C]">
              <button
                type="button"
                disabled={atRoot}
                onClick={() => setPath(path.slice(0, -1))}
                className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#0B192C] hover:bg-slate-100 disabled:opacity-40 dark:text-white dark:hover:bg-slate-800"
              >
                <ArrowLeft size={13} /> Back
              </button>
              <button
                type="button"
                disabled={atRoot}
                onClick={() => setPath([])}
                className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#0B192C] hover:bg-slate-100 disabled:opacity-40 dark:text-white dark:hover:bg-slate-800"
              >
                <Home size={13} /> Main menu
              </button>
              <button
                type="button"
                onClick={() => {
                  setPath([]);
                  body.current?.scrollTo({ top: 0 });
                }}
                className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#0B192C] hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
              >
                <RotateCcw size={13} /> Start again
              </button>
            </footer>
          </>
        )}
      </section>
    </>
  );
};

export default TirvonaAssistant;
