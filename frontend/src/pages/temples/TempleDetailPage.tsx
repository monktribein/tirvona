import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../../lib/api";
import { 
  Building2, MapPin, Clock, Info, Navigation, BookOpen, Flame, Calendar, ArrowLeft, Image as ImageIcon, Map 
} from "lucide-react";
import TirvonaMap from "../../components/TirvonaMap";

export default function TempleDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewId = searchParams.get("previewId");
  const [temple, setTemple] = useState<any>(null);
  const [aartis, setAartis] = useState<any[]>([]);
  const [festivals, setFestivals] = useState<any[]>([]);
  const [nearby, setNearby] = useState<any>({ temples: [], ashrams: [], homestays: [], parking: [], prasad: [] });
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef(0);

  useEffect(() => {
    fetchTempleData();
  }, [slug, previewId]);

  useEffect(() => {
    if (!temple) return;
    const title = temple.seo?.seoTitle || temple.name;
    const description = temple.seo?.seoDescription || temple.shortDescription || temple.description || "";
    document.title = title;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = description;
    const setProperty = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!tag) { tag = document.createElement("meta"); tag.setAttribute("property", property); document.head.appendChild(tag); }
      tag.content = content;
    };
    setProperty("og:type", "place");
    setProperty("og:title", temple.seo?.ogTitle || title);
    setProperty("og:description", temple.seo?.ogDescription || description);
    const ogImage = temple.seo?.ogImage || temple.media?.coverImage;
    if (ogImage) setProperty("og:image", ogImage);
    const setName = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!tag) { tag = document.createElement("meta"); tag.setAttribute("name", name); document.head.appendChild(tag); }
      tag.content = content;
    };
    setName("twitter:card", ogImage ? "summary_large_image" : "summary");
    setName("twitter:title", temple.seo?.twitterTitle || temple.seo?.ogTitle || title);
    setName("twitter:description", temple.seo?.twitterDescription || temple.seo?.ogDescription || description);
    if (temple.seo?.twitterImage || ogImage) setName("twitter:image", temple.seo?.twitterImage || ogImage);
    const canonical = temple.seo?.canonicalUrl || `${window.location.origin}/temples/${temple.slug}`;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = canonical;

    const coords = temple.address?.coordinates?.coordinates || temple.address?.coordinates;
    const hasGeo = Array.isArray(coords) && coords.length === 2 && !(coords[0] === 0 && coords[1] === 0);
    const dayMap: Record<string, string> = { Monday: "Mo", Tuesday: "Tu", Wednesday: "We", Thursday: "Th", Friday: "Fr", Saturday: "Sa", Sunday: "Su" };
    const openingHours = (temple.timings || [])
      .flatMap((day: any) => (day.timeSlots || [])
        .filter((slot: any) => !slot.isClosed && slot.startTime && slot.endTime)
        .map((slot: any) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: dayMap[day.dayOfWeek] || day.dayOfWeek,
          opens: slot.isOpen24Hours ? "00:00" : slot.startTime,
          closes: slot.isOpen24Hours ? "23:59" : slot.endTime,
        })));

    const existing = document.getElementById("temple-jsonld");
    existing?.remove();
    const script = document.createElement("script");
    script.id = "temple-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": ["PlaceOfWorship", "TouristAttraction"],
        name: temple.name,
        alternateName: temple.templeShortName || undefined,
        description,
        url: canonical,
        image: temple.media?.coverImage || undefined,
        telephone: temple.visitorInfo?.templeContactNumber || undefined,
        address: { "@type": "PostalAddress", streetAddress: temple.address?.street, addressLocality: temple.address?.city, addressRegion: temple.address?.state, postalCode: temple.address?.pincode, addressCountry: temple.address?.country || "India" },
        geo: hasGeo ? { "@type": "GeoCoordinates", longitude: coords[0], latitude: coords[1] } : undefined,
        openingHoursSpecification: openingHours.length ? openingHours : undefined,
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: window.location.origin + "/" },
          { "@type": "ListItem", position: 2, name: "Temples", item: window.location.origin + "/temples" },
          { "@type": "ListItem", position: 3, name: temple.name, item: canonical },
        ],
      },
    ]);
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [temple]);

  const fetchTempleData = async () => {
    try {
      setLoading(true);
      const tRes = previewId
        ? await api.get(`/temples/admin/${previewId}`)
        : await api.get(`/temples/${slug}`);
      if (!tRes.data?.success) {
        setTemple(null);
        return;
      }
      
      const t = tRes.data.data;
      setTemple(t);

      // Fetch related data
      const [aRes, fRes, nRes] = await Promise.allSettled([
        api.get(`/temples/${t._id}/aartis`),
        api.get(`/temples/${t._id}/festivals`),
        api.get(`/temples/${t._id}/nearby?radius=5`)
      ]);

      if (aRes.status === "fulfilled") setAartis(aRes.value.data?.data || []);
      if (fRes.status === "fulfilled") setFestivals(fRes.value.data?.data || []);
      if (nRes.status === "fulfilled") {
        const data = nRes.value.data?.data || {};
        setNearby({
          temples: data.temples || [],
          ashrams: data.ashrams || [],
          homestays: data.homestays || [],
          parking: data.parking || [],
          prasad: data.prasad || [],
        });
      }
      
    } catch (err) {
      console.error(err);
      setTemple(null);
    } finally {
      setLoading(false);
    }
  };

  const getMinutes = (value: string) => {
    const [hours, minutes] = String(value || "").split(":").map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : -1;
  };

  // Temples in Tirvona operate on India Standard Time; the visitor's device
  // clock (which may be anywhere) must not decide "Open Now" or "LIVE".
  const istNow = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata", weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    let hour = parseInt(get("hour"), 10);
    if (hour === 24) hour = 0; // some engines emit "24" for midnight
    return { day: get("weekday"), minutes: hour * 60 + parseInt(get("minute"), 10) };
  };

  const inWindow = (start: number, end: number, mins: number) =>
    start <= end ? mins >= start && mins <= end : mins >= start || mins <= end;

  const aartiStatus = (startTime: string, endTime: string) => {
    const { minutes } = istNow();
    const start = getMinutes(startTime); const end = getMinutes(endTime);
    if (start < 0 || end < 0) return "";
    if (inWindow(start, end, minutes)) return "LIVE NOW";
    // Minutes until the next start, wrapping past midnight.
    const untilStart = (start - minutes + 1440) % 1440;
    return untilStart <= 60 ? "STARTS SOON" : minutes < start && start <= end ? "UPCOMING" : "COMPLETED";
  };

  const { day: currentDay, minutes: nowMinutes } = istNow();
  const todayTiming = temple?.timings?.find((timing: any) => timing.dayOfWeek === currentDay);
  const openSlots: any[] = (todayTiming?.timeSlots || []).filter((s: any) => !s.isClosed);
  const isOpenNow = openSlots.some((slot: any) => {
    if (slot.isOpen24Hours) return true;
    const start = getMinutes(slot.startTime); const end = getMinutes(slot.endTime);
    return start >= 0 && end >= 0 && inWindow(start, end, nowMinutes);
  });
  const openStatusLabel = (() => {
    if (!todayTiming) return "";
    if (isOpenNow) {
      const closing = openSlots
        .map((s: any) => (s.isOpen24Hours ? Infinity : getMinutes(s.endTime)))
        .filter((m: number) => m >= 0)
        .map((m: number) => (m === Infinity ? Infinity : (m - nowMinutes + 1440) % 1440))
        .sort((a: number, b: number) => a - b)[0];
      return closing !== Infinity && closing <= 30 ? "Closes soon" : "Open now";
    }
    const nextOpen = openSlots
      .map((s: any) => getMinutes(s.startTime))
      .filter((m: number) => m >= 0)
      .map((m: number) => (m - nowMinutes + 1440) % 1440)
      .sort((a: number, b: number) => a - b)[0];
    return nextOpen !== undefined && nextOpen <= 60 ? "Opens soon" : "Closed now";
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#E58C28] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!temple) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Building2 className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Temple Not Found</h1>
        <p className="text-gray-500 mb-6">The temple you're looking for doesn't exist or is currently unavailable.</p>
        <button onClick={() => navigate("/temples")} className="px-6 py-3 bg-[#E58C28] text-white rounded-xl font-medium">
          Explore Temples
        </button>
      </div>
    );
  }

  // Safe checks for empty states
  const historyFields: [string, string][] = [
    ["Historical Significance", temple.historicalSignificance],
    ["Religious Significance", temple.religiousSignificance],
    ["Spiritual Significance", temple.spiritualSignificance],
    ["Legend / Story", temple.templeStory],
    ["Important Beliefs", temple.importantBeliefs],
    ["Important Traditions", temple.importantTraditions],
    ["Important Rituals", temple.importantRituals],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const historyFacts: [string, string][] = [
    ["Established", temple.establishedYear],
    ["Historical Period", temple.historicalPeriod],
    ["Founder", temple.founder],
    ["Dynasty", temple.dynasty],
    ["Architectural Style", temple.architecturalStyle],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const hasTimings = temple.timings && temple.timings.length > 0;
  const hasHistory = historyFields.length > 0 || historyFacts.length > 0;
  const darshanEntries = Object.entries(temple.darshanInfo || {}).filter(([, v]) => Boolean(v)) as [string, string][];
  const activeFestivals = [...festivals]
    .filter((f: any) => f.isActive !== false)
    .sort((a: any, b: any) => {
      const now = Date.now();
      const aPast = new Date(a.endDate).getTime() < now;
      const bPast = new Date(b.endDate).getTime() < now;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  const hasVisitorInfo = temple.visitorInfo && Object.values(temple.visitorInfo).some(v => Boolean(v));
  const hasNearbyEntities = nearby.temples.length > 0 || nearby.ashrams.length > 0 || nearby.homestays.length > 0 || nearby.parking.length > 0 || nearby.prasad.length > 0;
  const coordinates = temple.address?.coordinates?.coordinates || temple.address?.coordinates;
  const humanize = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
  const locationLabel = [temple.address?.city, temple.address?.state].filter(Boolean).join(", ");
  const gallery = Array.from(new Set([temple.media?.coverImage, ...(temple.media?.galleryImages || [])].filter((image): image is string => typeof image === "string" && image.length > 0)));
  const currentImage = gallery[activeImage];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {previewId && <div className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">Preview mode: this temple is not visible to the public until published.</div>}
      <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 pt-5 text-sm text-gray-500 sm:px-6" aria-label="Breadcrumb"><Link to="/" className="hover:text-[#E58C28]">Home</Link><span>/</span><Link to="/temples" className="hover:text-[#E58C28]">Temples</Link><span>/</span><span className="truncate text-gray-900">{temple.name}</span></nav>
      {/* Hero Section */}
      <div className="relative h-[60vh] min-h-[400px] bg-black">
        {temple.media?.coverImage ? (
          <img src={temple.media.coverImage} onClick={() => setLightboxOpen(true)} className="w-full h-full cursor-zoom-in object-cover opacity-60" alt={temple.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <Building2 className="w-32 h-32 text-white" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 max-w-7xl mx-auto">
          {temple.isVerified && <span className="mb-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">Verified</span>}
          {temple.deity && (
            <span className="inline-block bg-[#E58C28] text-white text-xs font-bold px-3 py-1.5 rounded-lg mb-4">
              Dedicated to {temple.deity}
            </span>
          )}
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">{temple.name}</h1>
          {locationLabel && <p className="text-xl text-gray-200 flex items-center gap-2 font-medium"><MapPin className="w-5 h-5 text-[#E58C28]" /> {locationLabel}</p>}
          {temple.shortDescription && <p className="mt-3 max-w-2xl text-base text-gray-200">{temple.shortDescription}</p>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <div className="flex-1 space-y-8">
          
          {/* Quick Info Bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-wrap gap-8">
            {temple.establishedYear && (
              <div>
                <p className="text-sm font-bold tracking-wider text-gray-400 uppercase mb-1">Established</p>
                <p className="font-medium text-gray-900">{temple.establishedYear}</p>
              </div>
            )}
            {temple.templeType && (
              <div>
                <p className="text-sm font-bold tracking-wider text-gray-400 uppercase mb-1">Temple Type</p>
                <p className="font-medium text-gray-900">{temple.templeType}</p>
              </div>
            )}
            {temple.deity && (
              <div>
                <p className="text-sm font-bold tracking-wider text-gray-400 uppercase mb-1">Deity</p>
                <p className="font-medium text-gray-900">{temple.deity}</p>
              </div>
            )}
            {locationLabel && <div><p className="text-sm font-bold tracking-wider text-gray-400 uppercase mb-1">Location</p><p className="font-medium text-gray-900">{locationLabel}</p></div>}
            {temple.visitorInfo?.bestTimeToVisit && <div><p className="text-sm font-bold tracking-wider text-gray-400 uppercase mb-1">Best Time</p><p className="font-medium text-gray-900">{temple.visitorInfo.bestTimeToVisit}</p></div>}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">About Temple</h2>
            <p className="text-gray-600 leading-relaxed text-lg whitespace-pre-wrap">
              {temple.description || temple.shortDescription}
            </p>
          </div>

          {/* Timings */}
          {hasTimings && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-indigo-600" />
                </div>
                <div><h2 className="text-2xl font-bold text-gray-900">Temple Timings</h2>{todayTiming && <p className={`mt-1 text-sm font-semibold ${isOpenNow ? "text-emerald-600" : openStatusLabel === "Opens soon" ? "text-amber-600" : "text-gray-500"}`}>{openStatusLabel} · Today&apos;s timing (IST)</p>}</div>
              </div>
              <div className="space-y-4">
                {temple.timings.map((day: any, idx: number) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 border-b border-gray-50 last:border-0 last:pb-0">
                    <span className={`w-32 font-bold ${day.dayOfWeek === currentDay ? "text-[#E58C28]" : "text-gray-900"}`}>{day.dayOfWeek}{day.dayOfWeek === currentDay ? " · Today" : ""}</span>
                    <div className="flex-1 space-y-2">
                      {day.timeSlots?.map((slot: any, sIdx: number) => (
                        <div key={sIdx} className="flex items-center gap-2 text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                          <span className="font-medium min-w-[120px]">{slot.title || "Temple hours"}</span>
                          <span className="text-gray-400">|</span>
                          <span className="text-gray-900 font-medium">{slot.isClosed ? "Closed" : slot.isOpen24Hours ? "24 Hours" : `${slot.startTime || ""} - ${slot.endTime || ""}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {hasHistory && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">History &amp; Significance</h2>
              </div>
              {historyFacts.length > 0 && (
                <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {historyFacts.map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
                      <p className="font-medium text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-6">
                {historyFields.map(([label, value]) => (
                  <div key={label}>
                    <h3 className="font-bold text-gray-900 mb-2">{label}</h3>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Darshan Information */}
          {darshanEntries.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-rose-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Darshan Information</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                {darshanEntries.map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">{humanize(key)}</p>
                    <p className="font-medium text-gray-800 whitespace-pre-wrap">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aartis */}
          {aartis.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Flame className="w-5 h-5 text-[#E58C28]" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Daily Aartis</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aartis.map((aarti: any) => {
                  const status = aartiStatus(aarti.startTime, aarti.endTime);
                  return (
                    <div key={aarti._id} className={`p-4 rounded-xl border ${status === 'LIVE NOW' ? 'border-[#E58C28] bg-orange-50/30' : 'border-gray-100 bg-gray-50'} relative overflow-hidden`}>
                      {status && (
                        <div className="absolute top-0 right-0 bg-[#E58C28] text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> {status}
                        </div>
                      )}
                      <h3 className="font-bold text-gray-900 mb-1">{aarti.name}</h3>
                      <p className="text-indigo-600 font-bold mb-2">{aarti.startTime} - {aarti.endTime}</p>
                      {aarti.description && <p className="text-sm text-gray-500">{aarti.description}</p>}
                      {status === "LIVE NOW" && aarti.liveStreamUrl && <a href={aarti.liveStreamUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-[#E58C28]">Watch Live Aarti</a>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeFestivals.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><Calendar className="w-5 h-5 text-blue-600" /></div><h2 className="text-2xl font-bold text-gray-900">Festivals &amp; Events</h2></div>
              <div className="space-y-4">{activeFestivals.map((festival) => {
                const start = new Date(festival.startDate); const end = new Date(festival.endDate); const now = new Date();
                const phase = now >= start && now <= end ? "Happening now" : end < now ? "Past" : "Upcoming";
                const phaseClass = phase === "Happening now" ? "bg-emerald-100 text-emerald-700" : phase === "Past" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700";
                return (
                <article key={festival._id} className={`rounded-xl border border-gray-100 p-4 ${phase === "Past" ? "bg-gray-50/60 opacity-80" : "bg-gray-50"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2"><h3 className="font-bold text-gray-900">{festival.name}</h3><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${phaseClass}`}>{phase}</span></div>
                    <span className="text-sm font-semibold text-blue-700">{start.toLocaleDateString()} - {end.toLocaleDateString()}</span>
                  </div>
                  {festival.description && <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{festival.description}</p>}
                  {festival.specialTiming && <p className="mt-2 text-sm font-medium text-gray-800">Special timing: {festival.specialTiming}</p>}
                  {festival.specialAarti && <p className="mt-1 text-sm font-medium text-gray-800">Special aarti: {festival.specialAarti}</p>}
                  {festival.expectedCrowdLevel && <p className="mt-1 text-sm text-gray-600">Expected crowd: {festival.expectedCrowdLevel}</p>}
                  {festival.importantInformation && <p className="mt-1 text-sm text-gray-600">{festival.importantInformation}</p>}
                </article>
              );})}</div>
            </div>
          )}

          {Array.isArray(temple.media?.galleryImages) && temple.media.galleryImages.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><ImageIcon className="w-5 h-5 text-amber-600" /></div><h2 className="text-2xl font-bold text-gray-900">Gallery</h2></div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{gallery.map((image: string, index: number) => <button key={image} type="button" onClick={() => { setActiveImage(index); setLightboxOpen(true); }} className="overflow-hidden rounded-xl"><img src={image} alt={`${temple.name} gallery ${index + 1}`} loading="lazy" className="h-40 w-full object-cover transition-transform hover:scale-105" /></button>)}</div>
            </div>
          )}

        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-[400px] shrink-0 space-y-8">
          
          {/* Visitor Information */}
          {hasVisitorInfo && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
                <Info className="w-5 h-5 text-gray-400" /> Visitor Information
              </h2>
              {(temple.visitorInfo.templeRules || temple.visitorInfo.importantInstructions) && (
                <div className="bg-red-50 text-red-800 p-4 rounded-xl mb-4 text-sm font-medium whitespace-pre-wrap">
                  <span className="block font-bold mb-1">⚠️ Important Rules &amp; Instructions</span>
                  {[temple.visitorInfo.templeRules, temple.visitorInfo.importantInstructions].filter(Boolean).join("\n")}
                </div>
              )}
              <div className="space-y-3">
                {Object.entries(temple.visitorInfo)
                  .filter(([key, value]) => Boolean(value) && key !== "templeRules" && key !== "importantInstructions")
                  .map(([key, value]) => (
                    <div key={key} className="border-b border-gray-50 pb-3 last:border-0">
                      <span className="block text-xs font-bold uppercase tracking-wide text-gray-400">{humanize(key)}</span>
                      <span className="text-sm font-medium text-gray-800 whitespace-pre-wrap">{String(value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {temple.howToReach && Object.values(temple.howToReach).some(Boolean) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2"><Navigation className="w-5 h-5 text-gray-400" /> How to Reach</h2>
              <div className="space-y-3">{Object.entries(temple.howToReach).filter(([, value]) => Boolean(value)).map(([key, value]) => <div key={key}><span className="font-bold text-gray-900">{humanize(key)}: </span><span className="text-gray-600">{String(value)}</span></div>)}</div>
            </div>
          )}

          {/* Map Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Map className="w-5 h-5 text-gray-400" /> Location
              </h2>
              <p className="text-gray-600 mt-2 text-sm">{[temple.address?.street, locationLabel].filter(Boolean).join(", ") || "Location currently unavailable"}</p>
              {Array.isArray(coordinates) && coordinates.length === 2 && <a href={`https://www.google.com/maps/dir/?api=1&destination=${coordinates[1]},${coordinates[0]}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#0A4DA6]">Get Directions <Navigation className="h-4 w-4" /></a>}
            </div>
              {Array.isArray(coordinates) && coordinates.length === 2 && (
              <div className="h-64 relative bg-gray-100">
                <TirvonaMap 
                  center={[coordinates[1], coordinates[0]]} 
                  interactive={false}
                  markers={[{
                    id: temple._id,
                    latitude: coordinates[1],
                    longitude: coordinates[0],
                    title: temple.name
                  }]} 
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nearby Places Section — computed live from this temple's coordinates */}
      {hasNearbyEntities && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Nearby Tirvona Places</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {[
              { key: "temples", label: "Other Temples", color: "text-indigo-600", to: (r: any) => `/temples/${r.slug}`, img: (r: any) => r.media?.coverImage },
              { key: "ashrams", label: "Ashrams / Stays", color: "text-[#E58C28]", to: (r: any) => `/ashram/${r.slug || r._id}`, img: (r: any) => r.images?.[0] },
              { key: "homestays", label: "Homestays", color: "text-emerald-600", to: (r: any) => `/stay/${r.slug || r._id}`, img: (r: any) => r.images?.[0] },
              { key: "parking", label: "Parking", color: "text-blue-600", to: (r: any) => `/parking/${r.slug}`, img: (r: any) => r.coverImage || r.images?.[0] },
              { key: "prasad", label: "Prasad & Local Services", color: "text-rose-600", to: (r: any) => (r.slug ? `/services/${r.slug}` : "#"), img: (r: any) => r.image || r.coverImage },
            ].map((group) => {
              const rows: any[] = nearby[group.key] || [];
              if (!rows.length) return null;
              return (
                <div key={group.key}>
                  <h3 className={`text-lg font-bold text-gray-900 mb-4 flex items-center gap-2`}>
                    <Building2 className={`w-5 h-5 ${group.color}`} /> {group.label}
                  </h3>
                  <div className="space-y-4">
                    {rows.map((r: any) => {
                      const target = group.to(r);
                      const image = group.img(r);
                      const meta = [r.address?.city || r.city, r.distanceKm !== undefined ? `${r.distanceKm} km` : ""].filter(Boolean).join(" · ");
                      return (
                        <div
                          key={r._id}
                          onClick={() => { if (target && target !== "#") navigate(target); }}
                          className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow ${target && target !== "#" ? "cursor-pointer hover:shadow-md" : ""}`}
                        >
                          <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                            {image ? <img src={image} alt={r.name || r.title} className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-gray-300" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-gray-900 line-clamp-1">{r.name || r.title}</h4>
                            {meta && <p className="text-sm text-gray-500">{meta}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {lightboxOpen && currentImage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" onClick={() => setLightboxOpen(false)} onTouchStart={(event) => { touchStartX.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => { const delta = event.changedTouches[0].clientX - touchStartX.current; if (Math.abs(delta) > 40) setActiveImage((index) => (index + (delta < 0 ? 1 : -1) + gallery.length) % gallery.length); }}><button type="button" aria-label="Close gallery" onClick={() => setLightboxOpen(false)} className="absolute right-5 top-5 text-3xl text-white">×</button><button type="button" aria-label="Previous image" onClick={(event) => { event.stopPropagation(); setActiveImage((index) => (index - 1 + gallery.length) % gallery.length); }} className="absolute left-4 text-4xl text-white">‹</button><img src={currentImage} alt={temple.name} className="max-h-[85vh] max-w-[90vw] object-contain" onClick={(event) => event.stopPropagation()} /><button type="button" aria-label="Next image" onClick={(event) => { event.stopPropagation(); setActiveImage((index) => (index + 1) % gallery.length); }} className="absolute right-4 text-4xl text-white">›</button></div>}
    </div>
  );
}
