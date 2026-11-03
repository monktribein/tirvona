import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import EnterprisePageHeader from "../../shared/components/EnterprisePageHeader";
import api, { getErrorMessage } from "../../../lib/api";
import { templeService } from "../../../services";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from "../../../lib/toast";
import { coordinatesFromGoogleMapsUrl } from "../../../utils/geo";
import { ImageGalleryManager } from "../../shared/components/ImageGalleryManager";
import {
  Building2,
  CheckCircle,
  Clock,
  Eye,
  Flame,
  Globe,
  Image as ImageIcon,
  MapPin,
  Phone,
  Plus,
  Save,
  Share2,
  Trash2,
} from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

// Fields of the stored temple that this form does not show are kept as they are: the API
// replaces a nested object as a whole, so it is re-sent with only these keys changed.
const ADDRESS_KEYS = ["street", "landmark", "area", "city", "district", "state", "country", "pincode", "mapUrl", "googleMapsEmbedUrl", "plusCode"];
const MEDIA_KEYS = [
  "coverImage", "galleryImages", "templeExteriorImages", "templeInteriorImages", "deityImages", "architectureImages",
  "festivalImages", "aartiImages", "additionalImages", "videoUrl", "youtubeUrl", "liveStreamUrl", "officialWebsite",
  "instagramUrl", "facebookUrl", "twitterUrl",
];
const VISITOR_KEYS = [
  "bestTimeToVisit", "recommendedVisitDuration", "entryFee", "dressCode", "photographyAllowed", "mobilePhoneAllowed",
  "footwearInstructions", "idRequired", "wheelchairAccessible", "seniorCitizenInformation", "childrenPolicy",
  "prasadAvailable", "lockerAvailable", "parkingAvailable", "foodAvailable", "drinkingWater", "washrooms", "cloakRoom",
  "securityInformation", "templeRules", "importantInstructions", "emergencyContact", "templeContactNumber",
  "priestName", "priestPhone",
];

const pick = (source: any, keys: string[]) =>
  Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source[key]]));

/** "instagram.com/x" → "https://instagram.com/x"; empty stays empty. */
const withProtocol = (url: string) => {
  const value = url.trim();
  return !value || /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

/** First sentence of the description, for listing cards, when the temple has no summary yet. */
const summaryOf = (text: string) => {
  const first = text.trim().split(/(?<=[.!?।])\s/)[0] ?? "";
  return first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first;
};

interface AartiRow {
  key: string;
  _id?: string;
  name: string;
  startTime: string;
  endTime?: string;
}

const emptyForm = {
  name: "",
  description: "",
  street: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  mapUrl: "",
  coordinates: [0, 0] as number[],
  templePhone: "",
  priestName: "",
  priestPhone: "",
  opensAt: "",
  closesAt: "",
  coverImage: "",
  galleryImages: [] as string[],
  website: "",
  instagram: "",
  facebook: "",
  youtube: "",
  twitter: "",
};
type FormState = typeof emptyForm;

const inputClass = "w-full rounded-full border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-[#E58C28] focus:border-transparent";

const Section: React.FC<{ title: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }> = ({ title, icon, hint, children }) => (
  <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
    <div className="border-b pb-2">
      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <span className="text-[#E58C28]">{icon}</span>
        {title}
      </h2>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
    {children}
  </section>
);

const Field: React.FC<{ label: string; required?: boolean; error?: string; hint?: string; className?: string; children: React.ReactNode }> = ({
  label,
  required,
  error,
  hint,
  className = "",
  children,
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </label>
    {children}
    {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
  </div>
);

/**
 * Add or edit a temple: name, address and map link, contact numbers (temple and pujari),
 * about, opening hours, aartis, photos and social media. Only the name and the city are
 * required; everything else can be filled in later.
 */
export default function AddEditTemplePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const isTempleOwner = user?.role === "temple_owner";

  const [form, setForm] = useState<FormState>(emptyForm);
  const [original, setOriginal] = useState<any>(null);
  const [timingsTouched, setTimingsTouched] = useState(false);
  const [detailedTimings, setDetailedTimings] = useState(false);
  const [aartis, setAartis] = useState<AartiRow[]>([]);
  const [aartiDraft, setAartiDraft] = useState({ name: "", startTime: "", endTime: "" });
  const [aartiError, setAartiError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof FormState, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      try {
        setLoading(true);
        // Exactly this temple, never the list endpoint (it would ignore the id).
        const res = await templeService.getAdminById(id as string);
        const t = res.data?.data;
        if (!res.data?.success || !t?._id) throw new Error("not found");
        setOriginal(t);
        const timings: any[] = Array.isArray(t.timings) ? t.timings : [];
        const slot = timings[0]?.timeSlots?.[0];
        const uniform =
          timings.length === DAYS.length &&
          timings.every(
            (day) => (day.timeSlots?.length ?? 0) === 1 && day.timeSlots[0].startTime === slot?.startTime && day.timeSlots[0].endTime === slot?.endTime,
          );
        setDetailedTimings(timings.length > 0 && !uniform);
        setForm({
          name: t.name ?? "",
          description: t.description ?? "",
          street: t.address?.street ?? "",
          city: t.address?.city ?? "",
          district: t.address?.district ?? "",
          state: t.address?.state ?? "",
          pincode: t.address?.pincode ?? "",
          mapUrl: t.address?.mapUrl ?? "",
          coordinates: Array.isArray(t.address?.coordinates) ? t.address.coordinates : t.address?.coordinates?.coordinates ?? [0, 0],
          templePhone: t.visitorInfo?.templeContactNumber ?? "",
          priestName: t.visitorInfo?.priestName ?? "",
          priestPhone: t.visitorInfo?.priestPhone ?? "",
          opensAt: slot?.startTime ?? "",
          closesAt: slot?.endTime ?? "",
          coverImage: t.media?.coverImage ?? "",
          galleryImages: t.media?.galleryImages ?? [],
          website: t.media?.officialWebsite ?? "",
          instagram: t.media?.instagramUrl ?? "",
          facebook: t.media?.facebookUrl ?? "",
          youtube: t.media?.youtubeUrl || t.media?.videoUrl || "",
          twitter: t.media?.twitterUrl ?? "",
        });
        const aartiRes = await templeService.aartis(t._id);
        setAartis(
          (aartiRes.data?.data ?? [])
            .filter((a: any) => a.isActive !== false)
            .map((a: any) => ({ key: a._id, _id: a._id, name: a.name, startTime: a.startTime, endTime: a.endTime })),
        );
      } catch {
        toast.error("Failed to load temple data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  // The map pin follows the Google Maps link: a full link carries it, a short link does not.
  const setMapUrl = (mapUrl: string) => {
    const point = coordinatesFromGoogleMapsUrl(mapUrl);
    setForm((prev) => ({ ...prev, mapUrl, coordinates: point ? [point.lng, point.lat] : [0, 0] }));
  };

  const setTiming = (field: "opensAt" | "closesAt", value: string) => {
    setTimingsTouched(true);
    set(field, value);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Enter the temple's name";
    if (!form.city.trim()) e.city = "Enter the city";
    if (form.templePhone.trim() && !PHONE.test(form.templePhone.trim())) e.templePhone = "Enter a valid phone number";
    if (form.priestPhone.trim() && !PHONE.test(form.priestPhone.trim())) e.priestPhone = "Enter a valid phone number";
    if (Boolean(form.opensAt) !== Boolean(form.closesAt)) e.timings = "Enter both the opening and the closing time";
    return e;
  };

  const buildPayload = (publish: boolean) => {
    const youtube = withProtocol(form.youtube);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      address: {
        ...pick(original?.address, ADDRESS_KEYS),
        street: form.street.trim(),
        city: form.city.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        mapUrl: form.mapUrl.trim(),
        coordinates: form.coordinates,
      },
      media: {
        ...pick(original?.media, MEDIA_KEYS),
        coverImage: form.coverImage,
        galleryImages: form.galleryImages,
        officialWebsite: withProtocol(form.website),
        instagramUrl: withProtocol(form.instagram),
        facebookUrl: withProtocol(form.facebook),
        twitterUrl: withProtocol(form.twitter),
        youtubeUrl: youtube,
        videoUrl: youtube,
      },
      visitorInfo: {
        ...pick(original?.visitorInfo, VISITOR_KEYS),
        templeContactNumber: form.templePhone.trim(),
        priestName: form.priestName.trim(),
        priestPhone: form.priestPhone.trim(),
      },
    };
    if (!original?.shortDescription && form.description.trim()) payload.shortDescription = summaryOf(form.description);
    if (form.opensAt && form.closesAt && (timingsTouched || !isEdit))
      payload.timings = DAYS.map((day) => ({
        dayOfWeek: day,
        timeSlots: [{ title: "Darshan", startTime: form.opensAt, endTime: form.closesAt }],
      }));
    else if (isEdit && timingsTouched && !form.opensAt && !form.closesAt) payload.timings = [];
    if (publish) payload.status = "published";
    return payload;
  };

  const aartiBody = (row: { name: string; startTime: string; endTime?: string }) => ({
    name: row.name.trim(),
    startTime: row.startTime,
    ...(row.endTime ? { endTime: row.endTime } : {}),
  });

  const save = async (publish: boolean) => {
    const problems = validate();
    setErrors(problems);
    if (Object.keys(problems).length) {
      toast.error(Object.values(problems)[0]);
      return;
    }
    try {
      setSaving(true);
      const payload = buildPayload(publish);
      if (isEdit) {
        await api.patch(`/temples/admin/${id}`, payload);
        setOriginal((prev: any) => ({ ...prev, ...payload, status: publish ? "published" : prev?.status }));
        if (timingsTouched) {
          setTimingsTouched(false);
          setDetailedTimings(false);
        }
        toast.success(publish ? "Temple saved and published" : "Temple saved");
      } else {
        const res = await api.post("/temples/admin", payload);
        const newId = res.data?.data?._id;
        // Aartis belong to a saved temple, so the ones added before saving go in now.
        let failed = 0;
        for (const row of aartis) {
          try {
            await templeService.addAarti(newId, aartiBody(row));
          } catch {
            failed += 1;
          }
        }
        if (failed) toast.error(`${failed} aarti could not be saved. Add them again below.`);
        else toast.success(publish ? "Temple created and published" : "Temple created");
        navigate(`/admin/temples/${newId}/edit`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save temple"));
    } finally {
      setSaving(false);
    }
  };

  const addAarti = async () => {
    const name = aartiDraft.name.trim();
    if (!name) return setAartiError("Enter the aarti's name");
    if (!TIME.test(aartiDraft.startTime)) return setAartiError("Enter the aarti's time");
    if (aartiDraft.endTime && !TIME.test(aartiDraft.endTime)) return setAartiError("Enter a valid end time");
    setAartiError("");
    const row = { name, startTime: aartiDraft.startTime, endTime: aartiDraft.endTime || undefined };
    if (!isEdit) {
      setAartis((prev) => [...prev, { ...row, key: `new-${Date.now()}` }]);
      setAartiDraft({ name: "", startTime: "", endTime: "" });
      return;
    }
    try {
      const res = await templeService.addAarti(id as string, aartiBody(row));
      const saved = res.data?.data;
      setAartis((prev) => [...prev, { key: saved?._id ?? `saved-${Date.now()}`, _id: saved?._id, ...row }]);
      setAartiDraft({ name: "", startTime: "", endTime: "" });
      toast.success("Aarti added");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to add aarti"));
    }
  };

  const removeAarti = async (row: AartiRow) => {
    if (row._id && isEdit) {
      try {
        await templeService.removeAarti(id as string, row._id);
      } catch {
        toast.error("Failed to remove aarti");
        return;
      }
    }
    setAartis((prev) => prev.filter((item) => item.key !== row.key));
  };

  const hasPin = !(form.coordinates[0] === 0 && form.coordinates[1] === 0);
  const published = original?.status === "published";

  return (
    <div className="pb-24">
      <EnterprisePageHeader
        title={isEdit ? `Edit Temple: ${form.name || "…"}` : "Add New Temple"}
        subtitle="Only the temple name and city are required. Fill in the rest whenever you have it."
      />

      {loading ? (
        <div className="text-center py-20">Loading temple data...</div>
      ) : (
        <div className="mt-6 space-y-6 max-w-4xl">
          <Section title="Temple" icon={<Building2 className="w-4 h-4" />}>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Temple name" required error={errors.name}>
                <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} placeholder="e.g. Shri Banke Bihari Temple" />
              </Field>
              <Field label="About the temple">
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-[#E58C28] focus:border-transparent"
                  placeholder="History, deity, what makes this temple special…"
                />
              </Field>
            </div>
          </Section>

          <Section title="Address & map" icon={<MapPin className="w-4 h-4" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Address" className="md:col-span-2">
                <input type="text" value={form.street} onChange={(e) => set("street", e.target.value)} className={inputClass} placeholder="Street, area or landmark" />
              </Field>
              <Field label="City" required error={errors.city}>
                <input type="text" value={form.city} onChange={(e) => set("city", e.target.value)} className={inputClass} placeholder="e.g. Vrindavan" />
              </Field>
              <Field label="District">
                <input type="text" value={form.district} onChange={(e) => set("district", e.target.value)} className={inputClass} />
              </Field>
              <Field label="State">
                <input type="text" value={form.state} onChange={(e) => set("state", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Pincode">
                <input type="text" inputMode="numeric" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Google Maps link" className="md:col-span-2">
                <input type="url" value={form.mapUrl} onChange={(e) => setMapUrl(e.target.value)} className={inputClass} placeholder="https://www.google.com/maps/place/..." />
                {form.mapUrl.trim() !== "" &&
                  (hasPin ? (
                    <p className="mt-1 text-xs text-emerald-700">
                      Location set ({form.coordinates[1].toFixed(5)}, {form.coordinates[0].toFixed(5)}).
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-amber-700">
                      This link has no location in it (short links like maps.app.goo.gl don't). The temple still saves; for a map pin, open the link and paste the full address-bar link.
                    </p>
                  ))}
              </Field>
            </div>
          </Section>

          <Section title="Contact" icon={<Phone className="w-4 h-4" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Temple phone number" error={errors.templePhone}>
                <input type="tel" value={form.templePhone} onChange={(e) => set("templePhone", e.target.value)} className={inputClass} placeholder="+91 98765 43210" />
              </Field>
              <Field label="Pujari name">
                <input type="text" value={form.priestName} onChange={(e) => set("priestName", e.target.value)} className={inputClass} placeholder="e.g. Pt. Shyam Sharma" />
              </Field>
              <Field label="Pujari phone number" error={errors.priestPhone}>
                <input type="tel" value={form.priestPhone} onChange={(e) => set("priestPhone", e.target.value)} className={inputClass} placeholder="+91 98765 43210" />
              </Field>
            </div>
          </Section>

          <Section
            title="Temple timing"
            icon={<Clock className="w-4 h-4" />}
            hint={detailedTimings ? "This temple has day-wise timings. Changing the times below replaces them with one daily timing." : "The same opening and closing time is used for every day."}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Opens at" error={errors.timings}>
                <input type="time" value={form.opensAt} onChange={(e) => setTiming("opensAt", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Closes at">
                <input type="time" value={form.closesAt} onChange={(e) => setTiming("closesAt", e.target.value)} className={inputClass} />
              </Field>
            </div>
          </Section>

          <Section title="Aarti" icon={<Flame className="w-4 h-4" />} hint="Add each aarti with its time. The end time is optional.">
            {aartis.length > 0 && (
              <ul className="space-y-2">
                {aartis.map((row) => (
                  <li key={row.key} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-2">
                    <div>
                      <p className="font-semibold text-gray-900">{row.name}</p>
                      <p className="text-sm text-gray-500">
                        {row.startTime}
                        {row.endTime ? ` – ${row.endTime}` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeAarti(row)} className="text-sm text-red-600 flex items-center gap-1">
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <Field label="Aarti name" className="md:col-span-2">
                <input type="text" value={aartiDraft.name} onChange={(e) => setAartiDraft({ ...aartiDraft, name: e.target.value })} className={inputClass} placeholder="e.g. Mangla Aarti" />
              </Field>
              <Field label="Time">
                <input type="time" value={aartiDraft.startTime} onChange={(e) => setAartiDraft({ ...aartiDraft, startTime: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Ends at">
                <input type="time" value={aartiDraft.endTime} onChange={(e) => setAartiDraft({ ...aartiDraft, endTime: e.target.value })} className={inputClass} />
              </Field>
            </div>
            {aartiError && <p className="text-xs font-medium text-red-600">{aartiError}</p>}
            <button type="button" onClick={addAarti} className="rounded-lg bg-[#E58C28] px-4 py-2 text-sm font-medium text-white flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add aarti
            </button>
          </Section>

          <Section title="Photos" icon={<ImageIcon className="w-4 h-4" />}>
            <ImageGalleryManager
              coverImage={form.coverImage}
              onCoverImageChange={(url: string) => set("coverImage", url)}
              gallery={form.galleryImages}
              onGalleryChange={(images: string[]) => set("galleryImages", images)}
              label="Cover image & gallery"
            />
          </Section>

          <Section title="Social media" icon={<Share2 className="w-4 h-4" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Website">
                <input type="url" value={form.website} onChange={(e) => set("website", e.target.value)} className={inputClass} placeholder="https://..." />
              </Field>
              <Field label="Instagram">
                <input type="url" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} className={inputClass} placeholder="https://instagram.com/..." />
              </Field>
              <Field label="Facebook">
                <input type="url" value={form.facebook} onChange={(e) => set("facebook", e.target.value)} className={inputClass} placeholder="https://facebook.com/..." />
              </Field>
              <Field label="YouTube">
                <input type="url" value={form.youtube} onChange={(e) => set("youtube", e.target.value)} className={inputClass} placeholder="https://youtube.com/..." />
              </Field>
              <Field label="X (Twitter)">
                <input type="url" value={form.twitter} onChange={(e) => set("twitter", e.target.value)} className={inputClass} placeholder="https://x.com/..." />
              </Field>
            </div>
          </Section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => save(false)}
              disabled={saving}
              className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? "Saving..." : isTempleOwner ? "Save Changes" : isEdit ? "Save" : "Save as Draft"}
            </button>
            {!isTempleOwner && (
              <button
                type="button"
                onClick={() => save(true)}
                disabled={saving}
                className="px-8 py-3 bg-[#E58C28] text-white rounded-xl font-bold hover:bg-[#d67d1d] shadow-lg shadow-orange-200 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Globe className="w-4 h-4" /> {published ? "Save & Keep Live" : "Save & Publish"}
              </button>
            )}
            {isEdit && original?.slug && (
              <button
                type="button"
                onClick={() => navigate(`/temples/${original.slug}?previewId=${id}`)}
                className="px-6 py-3 bg-[#0B192C] text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <Eye className="w-4 h-4" /> Preview Temple
              </button>
            )}
            {published && (
              <p className="text-green-600 font-medium text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> This temple is currently LIVE.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
