/**
 * Reusable building blocks of the Tirvona premium visual language. They need the `tvp` class on an
 * ancestor (see premium.css). The homepage is the first user; any public page can reuse them.
 */
import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { TirvonaService } from "./services";
import "./premium.css";

/** A thin gold rule with a small lotus-diamond in the middle; the one ornamental motif we use. */
export const SacredDivider: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden>
    <span className="tvp-gold-rule w-12 sm:w-20" />
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M12 3c1.8 2.6 2.7 5 2.7 7.2S13.8 14.3 12 16c-1.8-1.7-2.7-3.6-2.7-5.8S10.2 5.6 12 3Z" stroke="#C19A52" strokeWidth="1.4" />
      <path d="M4 12.5c2.9-.6 5.3.2 8 3.5-3.4.9-6 .1-8-3.5Zm16 0c-2.9-.6-5.3.2-8 3.5 3.4.9 6 .1 8-3.5Z" stroke="#C19A52" strokeWidth="1.4" />
      <path d="M8 20h8" stroke="#C19A52" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
    <span className="tvp-gold-rule w-12 sm:w-20" />
  </div>
);

export const SectionHeader: React.FC<{
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "left";
  action?: React.ReactNode;
  id?: string;
}> = ({ eyebrow, title, subtitle, align = "center", action, id }) => {
  const centered = align === "center";
  return (
    <div className={`flex flex-col gap-3 ${centered ? "items-center text-center" : "items-start text-left sm:flex-row sm:items-end sm:justify-between"}`}>
      <div className={`space-y-3 ${centered ? "max-w-2xl" : "max-w-xl"}`}>
        {eyebrow && <p className="tvp-eyebrow">{eyebrow}</p>}
        <h2 id={id} className="tvp-display text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold leading-tight">
          {title}
        </h2>
        {centered && <SacredDivider />}
        {subtitle && <p className="tvp-body text-sm sm:text-base leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

/** Icon in the service's signature tint. */
export const ServiceIcon: React.FC<{ service: TirvonaService; size?: "sm" | "md" }> = ({ service, size = "md" }) => {
  const Icon = service.icon;
  const box = size === "sm" ? "h-8 w-8" : "h-11 w-11";
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-full text-white ring-2 ring-white/80 dark:ring-[#0e1a2b]`}
      style={{ backgroundColor: service.tint }}
      aria-hidden
    >
      <Icon size={size === "sm" ? 15 : 19} />
    </span>
  );
};

/**
 * One service: photograph, signature icon, what it does, and the way in.
 * `featured` spans two grid columns with a wider photo of the same height, so rows stay even.
 */
export const ServiceCard: React.FC<{
  service: TirvonaService;
  image?: string;
  description?: string;
  cta?: string;
  featured?: boolean;
}> = ({ service, image, description, cta, featured = false }) => (
  <Link
    to={service.to}
    aria-label={`${service.name}: ${cta || service.cta}`}
    className={`tvp-card group flex h-full flex-col overflow-hidden rounded-3xl ${featured ? "sm:col-span-2" : ""} transition-transform duration-300 hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C19A52]`}
  >
    <div className={`relative overflow-hidden ${featured ? "aspect-[16/9] sm:aspect-[16/5]" : "aspect-[16/9]"} bg-[#f4ecdf] dark:bg-[#0b1626]`}>
      <img
        src={image || service.image}
        alt={service.imageAlt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <span className="absolute bottom-3 right-4 max-w-[60%] text-right text-[11px] font-semibold tracking-wide text-white/95">{service.tagline}</span>
    </div>
    <div className="relative flex flex-1 flex-col px-5 pb-4 pt-6 sm:px-6">
      <span className="absolute -top-5 left-5 sm:left-6">
        <ServiceIcon service={service} />
      </span>
      <h3 className="tvp-display text-xl font-semibold">{service.name}</h3>
      <p className="tvp-body mt-2 line-clamp-3 min-h-[4.1rem] text-sm leading-relaxed">{description || service.description}</p>
      <ul className="mt-3 flex h-7 flex-wrap gap-2 overflow-hidden" aria-label={`${service.name} highlights`}>
        {service.highlights.map((h) => (
          <li key={h} className="whitespace-nowrap rounded-full border border-[#C19A52]/35 px-2.5 py-1 text-[11px] font-semibold tvp-muted">
            {h}
          </li>
        ))}
      </ul>
      <span className="tvp-link mt-auto pt-4 text-sm">
        {cta || service.cta} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </div>
  </Link>
);

/** A compact "pill" link to a service, designed to sit on photography (hero). */
export const ServiceChip: React.FC<{ service: TirvonaService }> = ({ service }) => (
  <Link
    to={service.to}
    className="tvp-glass group flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C19A52]"
  >
    <ServiceIcon service={service} size="sm" />
    <span className="min-w-0">
      <span className="block truncate text-[13px] font-bold leading-tight">{service.navLabel}</span>
      <span className="hidden truncate text-[11px] text-white/75 sm:block">{service.tagline}</span>
    </span>
  </Link>
);

/** Small secondary link card for experiences beyond the six core services. */
export const ExploreLink: React.FC<{
  to: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = ({ to, label, hint, icon: Icon }) => (
  <Link
    to={to}
    className="tvp-card group flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:border-[#C19A52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C19A52]"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F28C28]/10 text-[#d9741a]" aria-hidden>
      <Icon size={16} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="tvp-ink block truncate text-sm font-bold">{label}</span>
      {hint && <span className="block truncate text-[11px] tvp-muted">{hint}</span>}
    </span>
    <ArrowRight size={14} className="shrink-0 text-[#C19A52] transition-transform group-hover:translate-x-0.5" />
  </Link>
);
