import React, { useMemo } from "react";
import {
  Bed,
  BookOpen,
  Building,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Compass,
  Flame,
  Heart,
  LayoutGrid,
  MapPin,
  Radio,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Building2,
  Ticket,
  Users,
  WalletCards,
} from "lucide-react";
import { formatCurrency, formatIndianNumber } from "../../../utils/format";
import { EnterpriseStatsCard } from "./EnterpriseStatsCard";
import {
  gridClassFor,
  sectionKeysFor,
  useSectionSummaries,
  type SectionSummary,
  type SectionTile,
} from "./sectionSummaryData";

const ICONS: Record<string, React.ReactNode> = {
  users: <Users size={18} />,
  institution: <Building size={18} />,
  temples: <Building size={18} />,
  stays: <Building size={18} />,
  rooms: <Bed size={18} />,
  bookings: <CalendarCheck size={18} />,
  events: <CalendarDays size={18} />,
  eventRegistrations: <Ticket size={18} />,
  aarti: <Ticket size={18} />,
  aartiSessions: <Flame size={18} />,
  livePooja: <Radio size={18} />,
  pilgrimage: <Compass size={18} />,
  itineraries: <MapPin size={18} />,
  parking: <LayoutGrid size={18} />,
  parkingPartners: <Building2 size={18} />,
  content: <BookOpen size={18} />,
  localServices: <MapPin size={18} />,
  marketplace: <ShoppingBag size={18} />,
  smartContact: <ScrollText size={18} />,
  volunteer: <Heart size={18} />,
  volunteerApplications: <ClipboardList size={18} />,
  payouts: <WalletCards size={18} />,
  refunds: <RefreshCw size={18} />,
  support: <ClipboardList size={18} />,
  community: <BookOpen size={18} />,
  offers: <Ticket size={18} />,
  governance: <ShieldCheck size={18} />,
  audit: <ScrollText size={18} />,
};

const icon = (key: string): React.ReactNode =>
  ICONS[key] ?? <LayoutGrid size={18} />;

const display = (tile: SectionTile): string =>
  tile.format === "currency"
    ? formatCurrency(tile.value)
    : formatIndianNumber(tile.value);

/**
 * A wrapping flex row rather than a fixed grid: every card carries the same
 * flex basis and is allowed to grow, so whatever is left on the final row
 * stretches to fill the width. That removes the orphan half-width card a
 * fixed column count produces whenever the tile count is not a multiple of it,
 * at every breakpoint and for any number of tiles.
 */
/**
 * A grid whose column count divides the tile count exactly, so the cards fill
 * the width of a single clean row wherever they fit and never leave a gap or a
 * stretched orphan on a final part-row.
 */
const TileGrid: React.FC<{ tiles: SectionTile[]; sectionKey: string }> = ({
  tiles,
  sectionKey,
}) => (
  <div className={`grid gap-3 ${gridClassFor(tiles.length)}`}>
    {tiles.map((tile) => (
      <EnterpriseStatsCard
        key={tile.label}
        title={tile.label}
        value={display(tile)}
        icon={icon(sectionKey)}
      />
    ))}
  </div>
);

/**
 * The counts for the module this exact link manages. Rendered by the dashboard
 * layout, so every section gets one without each page having to wire it up.
 */
export const SectionSummaryStrip: React.FC<{ pathname: string }> = ({
  pathname,
}) => {
  const { sections, loading } = useSectionSummaries();

  const keys = useMemo(() => sectionKeysFor(pathname), [pathname]);

  const shown = useMemo(
    () => keys.map((key) => sections.find((s) => s.key === key)).filter(Boolean),
    [keys, sections],
  ) as SectionSummary[];

  if (!keys.length) return null;
  if (loading && !shown.length)
    return (
      <div className="grid gap-3 mb-5 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[104px] rounded-[24px] bg-white/60 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 animate-pulse"
          />
        ))}
      </div>
    );
  if (!shown.length) return null;

  return (
    <div className="space-y-4 mb-5">
      {shown.map((section) => (
        <div key={section.key} className="space-y-2">
          {shown.length > 1 && (
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
              {section.label}
            </p>
          )}
          <TileGrid tiles={section.tiles} sectionKey={section.key} />
        </div>
      ))}
    </div>
  );
};

export default SectionSummaryStrip;
