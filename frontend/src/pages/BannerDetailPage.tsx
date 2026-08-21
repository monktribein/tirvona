import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock, MapPin } from "lucide-react";
import api from "../lib/api";
import { ashramService, marketplaceService, offerService } from "../services";
import { getFormattingLocale } from "../utils/format";

const imagesOf = (value: any) => Array.from(new Set([
  value?.imageUrl, value?.image, value?.bannerImage, value?.coverImageUrl, value?.coverImage,
  ...(Array.isArray(value?.gallery) ? value.gallery : []),
  ...(Array.isArray(value?.images) ? value.images : []),
].filter((item): item is string => typeof item === "string" && Boolean(item.trim()))));

const normalized = (value: unknown) => String(value || "").trim().toLowerCase();

const entityPath = (type: string, entity: any, banner: any) => {
  const id = entity?._id || banner.linkedEntityId;
  const slug = entity?.slug || banner.linkedEntitySlug || id;
  if (type === "ashram") return `/ashram/${id}`;
  if (type === "marketplace") return `/marketplace/product/${slug}`;
  if (type === "offer") return `/offers/${id}`;
  if (type === "event") return `/events/${slug}`;
  if (type === "destination") return `/search?destination=${encodeURIComponent(entity?.city || entity?.name || banner.linkedEntityName || "")}`;
  return banner.ctaUrl || "/";
};

const BannerDetailPage: React.FC = () => {
  const { bannerId } = useParams();
  const navigate = useNavigate();
  const [banner, setBanner] = useState<any>(null);
  const [entity, setEntity] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [relatedOffers, setRelatedOffers] = useState<any[]>([]);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bannerId) return;
    let active = true;
    void api.get(`/cms/featured-banners/${bannerId}`).then(async ({ data }) => {
      const record = data?.data;
      if (!record || !active) return;
      setBanner(record);
      const type = record.relatedContentType || "event";
      const id = record.linkedEntityId;
      const slug = record.linkedEntitySlug || id;
      let linked: any = null;
      let relatedRows: any[] = [];
      let offerRows: any[] = [];
      try {
        if (type === "ashram" && id) linked = (await ashramService.getById(id)).data?.data;
        if (type === "marketplace" && slug) linked = (await marketplaceService.getBySlug(slug)).data?.data;
        if (type === "offer" && id) linked = (await offerService.getById(id)).data?.data;
        if (type === "event" && slug) linked = (await api.get(`/services/events/${slug}`)).data?.data;
        if (type === "destination") linked = { name: record.linkedEntityName, city: record.linkedEntityName };

        if (record.relatedState || record.relatedDistrict || record.relatedAshramId) {
          const [ashramResponse, selectedResponse, offersResponse] = await Promise.all([
            ashramService.search({ limit: "100" }),
            record.relatedAshramId
              ? ashramService.getById(String(record.relatedAshramId))
              : Promise.resolve({ data: { data: null } }),
            offerService.getPublicOffers({ limit: "100" }),
          ]);
          const targetState = normalized(record.relatedState);
          const targetDistrict = normalized(record.relatedDistrict);
          const areaAshrams = (ashramResponse.data?.data || []).filter((ashram: any) => {
            const state = normalized(ashram.address?.state || ashram.state);
            const district = normalized(ashram.address?.district || ashram.district);
            const city = normalized(ashram.address?.city || ashram.city);
            return (
              (!targetState || state === targetState) &&
              (!targetDistrict || district === targetDistrict || city === targetDistrict)
            );
          });
          const selectedAshram = selectedResponse.data?.data;
          if (
            selectedAshram &&
            !areaAshrams.some((ashram: any) => String(ashram._id) === String(selectedAshram._id))
          ) {
            const selectedState = normalized(selectedAshram.address?.state || selectedAshram.state);
            const selectedDistrict = normalized(
              selectedAshram.address?.district ||
              selectedAshram.district ||
              selectedAshram.address?.city ||
              selectedAshram.city,
            );
            if (
              (!targetState || selectedState === targetState) &&
              (!targetDistrict || selectedDistrict === targetDistrict)
            ) areaAshrams.unshift(selectedAshram);
          }
          relatedRows = areaAshrams;

          const selectedAshramId = String(record.relatedAshramId || "");
          offerRows = (offersResponse.data?.data || []).filter((offer: any) => {
            const scopedIds = [
              offer.ashramId,
              ...(Array.isArray(offer.applicableAshrams) ? offer.applicableAshrams : []),
              ...(Array.isArray(offer.ashramIds) ? offer.ashramIds : []),
            ]
              .map((value: any) => String(value?._id || value || ""))
              .filter(Boolean);
            const offerState = offer.state || offer.location?.state || "";
            const offerDistrict =
              offer.district || offer.location?.district || offer.city || "";
            const matchesArea =
              Boolean(targetState || targetDistrict) &&
              (!targetState || normalized(offerState) === targetState) &&
              (!targetDistrict || normalized(offerDistrict) === targetDistrict);
            return Boolean(selectedAshramId && scopedIds.includes(selectedAshramId)) || matchesArea;
          });
        } else {
          const city = linked?.address?.city || linked?.city || linked?.location || record.location;
          if (["event", "destination"].includes(type) && city) {
            relatedRows = (await ashramService.search({ city: String(city), limit: "8" })).data?.data || [];
          } else if (type === "marketplace" && linked?.category) {
            relatedRows = (await marketplaceService.getProducts({ category: linked.category, limit: 8 })).data?.data || [];
            relatedRows = relatedRows.filter((row: any) => row._id !== linked._id);
          } else if (type === "offer") {
            const ids = linked?.applicableAshrams || linked?.ashramIds || (linked?.ashramId ? [linked.ashramId] : []);
            const rows = await Promise.allSettled(ids.slice(0, 8).map((value: any) => ashramService.getById(String(value?._id || value))));
            relatedRows = rows.filter((row) => row.status === "fulfilled").map((row: any) => row.value.data?.data).filter(Boolean);
          }
        }
      } catch {
      }
      if (active) {
        setEntity(linked);
        setRelated(relatedRows);
        setRelatedOffers(offerRows);
      }
    }).catch((err) => active && setError(err?.response?.data?.message || "Banner details are unavailable.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [bannerId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const gallery = useMemo(() => imagesOf({ ...entity, ...banner, gallery: [...imagesOf(banner), ...imagesOf(entity)] }), [banner, entity]);
  if (loading) return <div className="min-h-[65vh] grid place-items-center font-bold text-gray-500">Loading banner details…</div>;
  if (error || !banner) return <div className="min-h-[65vh] grid place-items-center px-6 text-center"><div><h1 className="text-2xl font-black">Banner unavailable</h1><p className="mt-2 text-gray-500">{error}</p></div></div>;

  const type = banner.relatedContentType || "event";
  const destination = banner.ctaUrl || entityPath(type, entity, banner);
  const cta = banner.ctaText || (type === "offer" ? "View Offer" : type === "ashram" ? "Book Now" : "Explore");
  const location = banner.location || entity?.address?.city || entity?.city || entity?.location;
  const dateText = (value: string) => value ? new Date(value).toLocaleString(getFormattingLocale(), { dateStyle: "medium", timeStyle: "short" }) : "";
  const areaLabel = [banner.relatedDistrict, banner.relatedState].filter(Boolean).join(", ");
  const countdown = (() => {
    const start = banner.startDate ? new Date(banner.startDate).getTime() : 0;
    const end = banner.endDate ? new Date(banner.endDate).getTime() : 0;
    const target = start > clockNow ? start : end > clockNow ? end : 0;
    if (!target) return null;
    const totalSeconds = Math.max(0, Math.floor((target - clockNow) / 1000));
    return {
      label: start > clockNow ? "Starts in" : "Ends in",
      values: [
        { label: "Days", value: Math.floor(totalSeconds / 86400) },
        { label: "Hours", value: Math.floor((totalSeconds % 86400) / 3600) },
        { label: "Minutes", value: Math.floor((totalSeconds % 3600) / 60) },
        { label: "Seconds", value: totalSeconds % 60 },
      ],
    };
  })();
  const openDestination = () => {
    if (/^https?:\/\//i.test(destination)) window.location.assign(destination);
    else navigate(destination);
  };

  return <main className="bg-gray-50/70 pb-20 dark:bg-[#070F1B]">
    <section className="relative min-h-[520px] overflow-hidden rounded-b-[40px] bg-[#0B192C]">
      {gallery[0] && <img src={gallery[0]} alt={banner.title} className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-r from-[#071426]/95 via-[#0B192C]/72 to-black/30" />
      <div className="relative mx-auto flex min-h-[520px] max-w-7xl items-end px-5 pb-14 pt-32 sm:px-8 lg:px-12">
        <div className="max-w-3xl text-white">
          <span className="block text-xs font-black uppercase tracking-[.2em] text-[#F4A340]">{String(type).replace(/_/g, " ")}</span>
          <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{banner.title}</h1>
          {banner.subtitle && <p className="mt-4 text-lg font-semibold text-slate-200">{banner.subtitle}</p>}
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold text-slate-100">
            {banner.startDate && <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur"><CalendarDays size={15}/>{dateText(banner.startDate)}{banner.endDate ? ` – ${dateText(banner.endDate)}` : ""}</span>}
            {banner.timing && <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur"><Clock size={15}/>{banner.timing}</span>}
            {location && <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur"><MapPin size={15}/>{location}</span>}
          </div>
          {countdown && <div className="mt-6">
            <p className="mb-2 text-[11px] font-black uppercase tracking-[.2em] text-[#F4A340]">{countdown.label}</p>
            <div className="flex flex-wrap gap-2">{countdown.values.map((item) => <div key={item.label} className="min-w-[68px] rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-center backdrop-blur-md"><strong className="block text-xl font-black tabular-nums text-white">{String(item.value).padStart(2, "0")}</strong><span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">{item.label}</span></div>)}</div>
          </div>}
          <button onClick={openDestination} className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#0A4DA6] px-7 py-3.5 text-sm font-black shadow-xl transition hover:-translate-y-0.5 hover:bg-[#083b80]">{cta}<ArrowRight size={17}/></button>
        </div>
      </div>
    </section>

    <div className={`mx-auto grid max-w-7xl gap-7 px-5 py-10 sm:px-8 lg:px-12 ${gallery.length > 1 ? "lg:grid-cols-[1.35fr_.65fr]" : "grid-cols-1"}`}>
      <article className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-[#0B192C]">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[#E58C28]">About this {String(type).replace(/_/g, " ")}</p>
        <h2 className="mt-3 text-2xl font-black sm:text-3xl">{entity?.name || entity?.title || banner.linkedEntityName || banner.title}</h2>
        <p className="mt-5 whitespace-pre-line text-sm font-medium leading-7 text-gray-600 dark:text-gray-300">{banner.description || banner.eventDetails || entity?.description || entity?.about || banner.subtitle}</p>
        {banner.eventDetails && banner.eventDetails !== banner.description && <div className="mt-7 border-t border-orange-100 pt-6 dark:border-slate-800"><h3 className="text-lg font-black">Event & festival information</h3><p className="mt-3 whitespace-pre-line text-sm font-medium leading-7 text-gray-600 dark:text-gray-300">{banner.eventDetails}</p></div>}
      </article>
      {gallery.length > 1 && <aside className="grid grid-cols-2 gap-3">{gallery.slice(1, 5).map((image) => <img key={image} src={image} alt="Banner gallery" className="h-36 w-full rounded-2xl object-cover shadow-sm sm:h-44" />)}</aside>}
    </div>

    {related.length > 0 && <section className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-orange-100 pb-5 dark:border-slate-800">
        <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#E58C28]">Ashrams in the selected area</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Explore related Ashrams{areaLabel ? ` in ${areaLabel}` : ""}</h2></div>
        <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-[#0A4DA6] dark:bg-slate-800">{related.length} Ashram{related.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{related.slice(0, 12).map((item: any, index) => {
        const image = imagesOf(item)[0];
        const name = item.name || item.title || `Ashram ${index + 1}`;
        const path = `/ashram/${item._id}`;
        const itemArea = [item.address?.city || item.city, item.address?.state || item.state].filter(Boolean).join(", ");
        return <button key={item._id || index} onClick={() => navigate(path)} className="group flex min-h-full flex-col overflow-hidden rounded-[24px] border border-orange-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl dark:border-slate-800 dark:bg-[#0B192C]">
          {image ? <img src={image} alt={name} className="h-48 w-full object-cover transition duration-500 group-hover:scale-105"/> : <div className="grid h-48 w-full place-items-center bg-gradient-to-br from-[#0A4DA6] to-[#0B192C] text-3xl font-black text-white">{name.slice(0, 1).toUpperCase()}</div>}
          <div className="flex flex-1 flex-col p-5"><h3 className="text-base font-black text-[#0B192C] dark:text-white">{name}</h3>{itemArea && <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500"><MapPin size={13}/>{itemArea}</p>}<p className="mt-3 line-clamp-2 text-xs leading-5 text-gray-500">{item.description || item.about || "Explore rooms, facilities and booking availability."}</p><span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-black text-[#0A4DA6]">View Ashram <ArrowRight size={13} className="transition group-hover:translate-x-1"/></span></div>
        </button>;
      })}</div>
    </section>}

    {relatedOffers.length > 0 && <section className="mx-auto mt-12 max-w-7xl px-5 sm:px-8 lg:px-12">
      <div className="rounded-[30px] border border-orange-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-[#0B192C]">
        <div className="mb-6"><p className="text-xs font-black uppercase tracking-[.16em] text-[#E58C28]">Available for the selected Ashram and area</p><h2 className="mt-2 text-2xl font-black">Related offers</h2></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{relatedOffers.slice(0, 6).map((offer: any, index) => <button key={offer._id || index} onClick={() => navigate(`/offers/${offer._id}`)} className="group rounded-2xl border border-orange-100 bg-orange-50/40 p-5 text-left transition hover:border-orange-300 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-[#E58C28]">Special offer</p><h3 className="mt-1 font-black text-[#0B192C] dark:text-white">{offer.title || offer.name || offer.promoCode || "Tirvona Offer"}</h3></div>{offer.promoCode && <span className="rounded-full bg-[#0A4DA6] px-3 py-1 text-[10px] font-black text-white">{offer.promoCode}</span>}</div>
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-gray-500">{offer.description || offer.subtitle || "View offer eligibility and booking details."}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#0A4DA6]">View Offer <ArrowRight size={13} className="transition group-hover:translate-x-1"/></span>
        </button>)}</div>
      </div>
    </section>}
  </main>;
};

export default BannerDetailPage;
