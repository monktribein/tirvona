import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import EnterprisePageHeader from "../../shared/components/EnterprisePageHeader";
import api, { getErrorMessage } from "../../../lib/api";
import { templeService } from "../../../services";
import { toast } from "../../../lib/toast";
import TirvonaMap from "../../../components/TirvonaMap";
import { ImageGalleryManager } from "../../shared/components/ImageGalleryManager";
import {
  ChevronRight,
  ChevronLeft,
  Save,
  MapPin,
  Image as ImageIcon,
  Clock,
  Flame,
  Calendar,
  Info,
  Navigation,
  Globe,
  Building2,
  BookOpen,
  Eye,
  CheckCircle,
} from "lucide-react";

const STEPS = [
  { id: 0, label: "Basic Info", icon: Building2 },
  { id: 1, label: "History", icon: BookOpen },
  { id: 2, label: "Location", icon: MapPin },
  { id: 3, label: "Media", icon: ImageIcon },
  { id: 4, label: "Timings", icon: Clock },
  { id: 5, label: "Aarti", icon: Flame },
  { id: 6, label: "Festivals", icon: Calendar },
  { id: 7, label: "Visitor Info", icon: Info },
  { id: 8, label: "Darshan", icon: Eye },
  { id: 9, label: "Publish", icon: CheckCircle },
];

export default function AddEditTemplePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    templeShortName: "",
    shortDescription: "",
    description: "",
    deity: "",
    templeType: "",
    religiousTradition: "",
    templeTags: [] as string[],
    
    // History
    establishedYear: "",
    historicalPeriod: "",
    founder: "",
    dynasty: "",
    historicalSignificance: "",
    religiousSignificance: "",
    spiritualSignificance: "",
    templeStory: "",
    importantBeliefs: "",
    importantTraditions: "",
    importantRituals: "",
    architecturalStyle: "",

    // Location
    address: {
      street: "",
      landmark: "",
      area: "",
      city: "",
      district: "",
      state: "",
      country: "India",
      pincode: "",
      coordinates: [0, 0],
      mapUrl: "",
      googleMapsEmbedUrl: "",
      plusCode: "",
    },

    // Media
    media: {
      coverImage: "",
      galleryImages: [] as string[],
      templeExteriorImages: [] as string[],
      templeInteriorImages: [] as string[],
      deityImages: [] as string[],
      architectureImages: [] as string[],
      festivalImages: [] as string[],
      aartiImages: [] as string[],
      additionalImages: [] as string[],
      videoUrl: "",
      youtubeUrl: "",
      liveStreamUrl: "",
      officialWebsite: "",
    },

    // Timings
    timings: [] as any[],

    // Visitor Info
    visitorInfo: {
      bestTimeToVisit: "",
      recommendedVisitDuration: "",
      entryFee: "",
      dressCode: "",
      photographyAllowed: "",
      mobilePhoneAllowed: "",
      footwearInstructions: "",
      idRequired: "",
      wheelchairAccessible: "",
      seniorCitizenInformation: "",
      childrenPolicy: "",
      prasadAvailable: "",
      lockerAvailable: "",
      parkingAvailable: "",
      foodAvailable: "",
      drinkingWater: "",
      washrooms: "",
      cloakRoom: "",
      securityInformation: "",
      templeRules: "",
      importantInstructions: "",
      emergencyContact: "",
      templeContactNumber: "",
    },

    // Darshan Info
    darshanInfo: {
      darshanType: "",
      generalDarshan: "",
      specialDarshan: "",
      vipDarshan: "",
      darshanDuration: "",
      queueInformation: "",
      entryGateInformation: "",
      specialEntryInformation: "",
      restrictions: "",
    },

    // How to reach
    howToReach: {
      byAir: "",
      byTrain: "",
      byBus: "",
      byRoad: "",
      nearestRailwayStation: "",
      nearestAirport: "",
      nearestBusStand: "",
    },

    // SEO
    seo: {
      seoTitle: "",
      seoDescription: "",
      seoKeywords: "",
      canonicalUrl: "",
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      twitterTitle: "",
      twitterDescription: "",
      twitterImage: "",
    },

    status: "draft",
    isVerified: false,
    isFeatured: false,
    isPopular: false,
  });

  const [aartis, setAartis] = useState<any[]>([]);
  const [festivals, setFestivals] = useState<any[]>([]);
  const [aartiDraft, setAartiDraft] = useState({ name: "", startTime: "", endTime: "", days: [] as string[], description: "", specialNotes: "", liveStreamUrl: "", isActive: true });
  const [festivalDraft, setFestivalDraft] = useState({ name: "", startDate: "", endDate: "", description: "", specialTiming: "", specialAarti: "", expectedCrowdLevel: "", importantInformation: "", isActive: true });
  const [editingAartiId, setEditingAartiId] = useState<string | null>(null);
  const [editingFestivalId, setEditingFestivalId] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit) {
      fetchTemple();
    }
  }, [id]);

  const fetchTemple = async () => {
    try {
      setLoading(true);
      // Load exactly this temple. The list endpoint is never used here: it
      // would ignore the id and hand back whichever record sorts first.
      const res = await templeService.getAdminById(id as string);
      const t = res.data?.data;
      if (res.data?.success && t?._id) {
        setFormData((prev) => ({
          ...prev,
          ...t,
          address: {
            ...prev.address,
            ...t.address,
            coordinates: Array.isArray(t.address?.coordinates)
              ? t.address.coordinates
              : t.address?.coordinates?.coordinates || [0, 0],
          },
          media: { ...prev.media, ...t.media },
          visitorInfo: { ...prev.visitorInfo, ...t.visitorInfo },
          darshanInfo: { ...prev.darshanInfo, ...t.darshanInfo },
          howToReach: { ...prev.howToReach, ...t.howToReach },
          seo: { ...prev.seo, ...t.seo },
          timings: t.timings || []
        }));
        
        // Fetch Aartis and Festivals
        const [aRes, fRes] = await Promise.all([
          templeService.aartis(t._id),
          templeService.festivals(t._id)
        ]);
        setAartis(aRes.data?.data || []);
        setFestivals(fRes.data?.data || []);
      }
    } catch {
      toast.error("Failed to load temple data");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    const keys = field.split(".");
    if (keys.length === 1) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    } else {
      setFormData((prev: any) => ({
        ...prev,
        [keys[0]]: {
          ...prev[keys[0]],
          [keys[1]]: value,
        },
      }));
    }
  };

  const handleCoordinateChange = (index: number, value: string) => {
    const num = parseFloat(value) || 0;
    setFormData((prev) => {
      const coords = [...prev.address.coordinates];
      coords[index] = num;
      return {
        ...prev,
        address: { ...prev.address, coordinates: coords },
      };
    });
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, coordinates: [lng, lat] },
    }));
  };

  const validate = (publish: boolean): string | null => {
    if (!formData.name.trim()) return "Temple name is required";
    return null;
  };

  const saveForm = async (publish: boolean = false) => {
    const problem = validate(publish);
    if (problem) { toast.error(problem); return; }
    try {
      setSaving(true);
      const payload = { ...formData, status: publish ? "published" : formData.status };

      let templeId = id;
      if (isEdit) {
        await api.patch(`/temples/admin/${id}`, payload);
      } else {
        const res = await api.post("/temples/admin", payload);
        templeId = res.data?.data?._id;
        setFormData((prev) => ({ ...prev, slug: res.data?.data?.slug || prev.slug }));
      }
      
      toast.success(`Temple ${isEdit ? "updated" : "created"} successfully`);
      
      if (!isEdit) {
        navigate(`/admin/temples/${templeId}/edit`);
      } else if (publish) {
        setFormData(prev => ({ ...prev, status: "published" }));
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save temple"));
    } finally {
      setSaving(false);
    }
  };

  const addAarti = async () => {
    if (!id || !aartiDraft.name || !aartiDraft.startTime || !aartiDraft.endTime) return;
    try {
      const res = editingAartiId
        ? await templeService.updateAarti(id, editingAartiId, aartiDraft)
        : await templeService.addAarti(id, aartiDraft);
      setAartis((prev) => editingAartiId ? prev.map((item) => item._id === editingAartiId ? res.data?.data : item) : [...prev, res.data?.data]);
      setAartiDraft({ name: "", startTime: "", endTime: "", days: [], description: "", specialNotes: "", liveStreamUrl: "", isActive: true });
      setEditingAartiId(null);
      toast.success(editingAartiId ? "Aarti updated" : "Aarti added");
    } catch (err) { toast.error(getErrorMessage(err, "Failed to add aarti")); }
  };

  const removeAarti = async (aartiId: string) => {
    if (!id) return;
    try { await templeService.removeAarti(id, aartiId); setAartis((prev) => prev.filter((item) => item._id !== aartiId)); toast.success("Aarti removed"); }
    catch { toast.error("Failed to remove aarti"); }
  };

  const addFestival = async () => {
    if (!id || !festivalDraft.name || !festivalDraft.startDate || !festivalDraft.endDate) return;
    try {
      const res = editingFestivalId
        ? await templeService.updateFestival(id, editingFestivalId, festivalDraft)
        : await templeService.addFestival(id, festivalDraft);
      setFestivals((prev) => editingFestivalId ? prev.map((item) => item._id === editingFestivalId ? res.data?.data : item) : [...prev, res.data?.data]);
      setFestivalDraft({ name: "", startDate: "", endDate: "", description: "", specialTiming: "", specialAarti: "", expectedCrowdLevel: "", importantInformation: "", isActive: true });
      setEditingFestivalId(null);
      toast.success(editingFestivalId ? "Festival updated" : "Festival added");
    } catch (err) { toast.error(getErrorMessage(err, "Failed to add festival")); }
  };

  const removeFestival = async (festivalId: string) => {
    if (!id) return;
    try { await templeService.removeFestival(id, festivalId); setFestivals((prev) => prev.filter((item) => item._id !== festivalId)); toast.success("Festival removed"); }
    catch { toast.error("Failed to remove festival"); }
  };

  // --- RENDERS FOR EACH STEP ---
  
  const renderStep0 = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Basic Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temple Name *</label>
          <input type="text" required value={formData.name} onChange={(e) => handleChange("name", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-[#E58C28] focus:border-transparent" placeholder="e.g. Shri Banke Bihari Temple" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temple Short Name</label>
          <input type="text" value={formData.templeShortName} onChange={(e) => handleChange("templeShortName", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-[#E58C28] focus:border-transparent" placeholder="e.g. Banke Bihari" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input type="text" value={(formData as any).slug || ""} onChange={(e) => handleChange("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} className="w-full rounded-full border border-gray-200 px-4 py-2" placeholder="temple-name-city" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Short Description *</label>
          <input type="text" required value={formData.shortDescription} onChange={(e) => handleChange("shortDescription", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-[#E58C28] focus:border-transparent" placeholder="A brief one-line description" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Description *</label>
          <textarea required rows={5} value={formData.description} onChange={(e) => handleChange("description", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-[#E58C28] focus:border-transparent" placeholder="Complete detailed description..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deity</label>
          <input type="text" value={formData.deity} onChange={(e) => handleChange("deity", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-[#E58C28] focus:border-transparent" placeholder="e.g. Lord Krishna" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Religious Tradition</label>
          <input type="text" value={formData.religiousTradition} onChange={(e) => handleChange("religiousTradition", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Tags</label><input type="text" value={formData.templeTags.join(", ")} onChange={(e) => handleChange("templeTags", e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} className="w-full rounded-full border border-gray-200 px-4 py-2" placeholder="heritage, pilgrimage, riverfront" /></div>
        <div className="md:col-span-2 flex flex-wrap gap-5 text-sm font-medium text-gray-700">
          {["isVerified", "isFeatured", "isPopular"].map((field) => <label key={field} className="flex items-center gap-2"><input type="checkbox" checked={(formData as any)[field]} onChange={(e) => handleChange(field, e.target.checked)} /> {field.replace(/^is/, "").replace(/[A-Z]/g, " $&")}</label>)}
          <label className="flex items-center gap-2">Status <select value={formData.status} onChange={(e) => handleChange("status", e.target.value)} className="rounded-lg border px-2 py-1"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temple Type</label>
          <select value={formData.templeType} onChange={(e) => handleChange("templeType", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-[#E58C28] focus:border-transparent">
            <option value="">Select Type</option>
            <option value="Hindu Temple">Hindu Temple</option>
            <option value="Jyotirlinga">Jyotirlinga</option>
            <option value="Shakti Peetha">Shakti Peetha</option>
            <option value="Vaishnav Temple">Vaishnav Temple</option>
            <option value="Shaiv Temple">Shaiv Temple</option>
            <option value="Ancient Temple">Ancient Temple</option>
            <option value="Modern Temple">Modern Temple</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900 border-b pb-2">History & Significance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Established / Built Year</label>
          <input type="text" value={formData.establishedYear} onChange={(e) => handleChange("establishedYear", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" placeholder="e.g. 15th Century or 1862" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Founder / Dynasty</label>
          <input type="text" value={formData.founder} onChange={(e) => handleChange("founder", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" placeholder="e.g. Swami Haridas" />
        </div>
        {(["historicalPeriod", "dynasty", "establishedYear"].map((field) => <div key={field}><label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{field.replace(/[A-Z]/g, " $&")}</label><input type="text" value={(formData as any)[field]} onChange={(e) => handleChange(field, e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" /></div>))}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Temple Story / Legend</label>
          <textarea rows={4} value={formData.templeStory} onChange={(e) => handleChange("templeStory", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" placeholder="Legend or mythological story behind the temple..." />
        </div>
        {(["religiousSignificance", "importantTraditions", "importantRituals", "importantBeliefs"].map((field) => <div key={field} className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{field.replace(/[A-Z]/g, " $&")}</label><textarea rows={3} value={(formData as any)[field]} onChange={(e) => handleChange(field, e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" /></div>))}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Architectural Style</label>
          <input type="text" value={formData.architecturalStyle} onChange={(e) => handleChange("architecturalStyle", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" placeholder="e.g. Dravidian, Nagara, Rajasthani" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Historical Significance</label>
          <textarea rows={3} value={formData.historicalSignificance} onChange={(e) => handleChange("historicalSignificance", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Spiritual Significance</label>
          <textarea rows={3} value={formData.spiritualSignificance} onChange={(e) => handleChange("spiritualSignificance", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Location & Map</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
          <input type="text" required value={formData.address.street} onChange={(e) => handleChange("address.street", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
          <input type="text" required value={formData.address.city} onChange={(e) => handleChange("address.city", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
          <input type="text" required value={formData.address.state} onChange={(e) => handleChange("address.state", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
          <input type="text" required value={formData.address.district} onChange={(e) => handleChange("address.district", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
          <input type="text" required value={formData.address.pincode} onChange={(e) => handleChange("address.pincode", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Area / Locality</label>
          <input type="text" value={formData.address.area} onChange={(e) => handleChange("address.area", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
          <input type="text" value={formData.address.landmark} onChange={(e) => handleChange("address.landmark", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <input type="text" value={formData.address.country} onChange={(e) => handleChange("address.country", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plus Code</label>
          <input type="text" value={formData.address.plusCode} onChange={(e) => handleChange("address.plusCode", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Link</label>
          <input type="url" value={formData.address.mapUrl} onChange={(e) => handleChange("address.mapUrl", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" placeholder="https://maps.google.com/..." />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Embed URL</label>
          <input type="url" value={formData.address.googleMapsEmbedUrl} onChange={(e) => handleChange("address.googleMapsEmbedUrl", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" placeholder="https://www.google.com/maps/embed?..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Longitude *</label>
          <input type="number" step="any" required value={formData.address.coordinates[0]} onChange={(e) => handleCoordinateChange(0, e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Latitude *</label>
          <input type="number" step="any" required value={formData.address.coordinates[1]} onChange={(e) => handleCoordinateChange(1, e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-6">
        <p className="text-sm text-gray-600 mb-3">Click on the map to pinpoint the temple location and automatically set coordinates.</p>
        <div className="h-96 rounded-xl overflow-hidden border border-gray-300">
          <TirvonaMap
            center={formData.address.coordinates[1] !== 0 ? [formData.address.coordinates[1], formData.address.coordinates[0]] : undefined}
            onMapClick={handleLocationSelect}
            markers={formData.address.coordinates[1] !== 0 ? [{
              id: 'preview',
              latitude: formData.address.coordinates[1],
              longitude: formData.address.coordinates[0],
              title: formData.name || "Temple Location"
            }] : []}
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Images & Media</h2>
      <div className="grid grid-cols-1 gap-6">
        <ImageGalleryManager
          coverImage={formData.media.coverImage}
          onCoverImageChange={(url: string) => handleChange("media.coverImage", url)}
          gallery={formData.media.galleryImages}
          onGalleryChange={(imgs: string[]) => handleChange("media.galleryImages", imgs)}
          label="Cover Image & Gallery"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">YouTube Video URL</label>
            <input type="url" value={formData.media.youtubeUrl} onChange={(e) => handleChange("media.youtubeUrl", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Official Website</label><input type="url" value={formData.media.officialWebsite} onChange={(e) => handleChange("media.officialWebsite", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Live Stream / Live Aarti URL</label>
            <input type="url" value={formData.media.liveStreamUrl} onChange={(e) => handleChange("media.liveStreamUrl", e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-xl font-bold text-gray-900">Temple Timings</h2>
        <button 
          onClick={() => {
            const newTimings = [...formData.timings];
            newTimings.push({ dayOfWeek: "Monday", timeSlots: [{ startTime: "", endTime: "", title: "General Darshan" }] });
            setFormData(prev => ({ ...prev, timings: newTimings }));
          }}
          className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
        >
          + Add Day Timing
        </button>
      </div>
      
      {formData.timings.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Clock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No timings configured.</p>
          <p className="text-sm text-gray-400 mt-1">Click "+ Add Day Timing" to set schedule.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {formData.timings.map((dayTiming, dIndex) => (
            <div key={dIndex} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative group">
              <button 
                onClick={() => {
                  const newTimings = [...formData.timings];
                  newTimings.splice(dIndex, 1);
                  setFormData(prev => ({ ...prev, timings: newTimings }));
                }}
                className="absolute top-4 right-4 text-red-500 hover:bg-red-50 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
              
              <div className="mb-4 w-1/3">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Day of Week</label>
                <select 
                  value={dayTiming.dayOfWeek}
                  onChange={(e) => {
                    const newTimings = [...formData.timings];
                    newTimings[dIndex].dayOfWeek = e.target.value;
                    setFormData(prev => ({ ...prev, timings: newTimings }));
                  }}
                  className="w-full rounded-lg border-gray-300 border px-3 py-1.5 text-sm font-medium"
                >
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {dayTiming.timeSlots.map((slot: any, sIndex: number) => (
                  <div key={sIndex} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <input 
                      type="text" placeholder="Title (e.g. Morning Darshan)" value={slot.title}
                      onChange={(e) => {
                        const newTimings = [...formData.timings];
                        newTimings[dIndex].timeSlots[sIndex].title = e.target.value;
                        setFormData(prev => ({ ...prev, timings: newTimings }));
                      }}
                      className="flex-1 rounded-md border-gray-300 border px-3 py-1.5 text-sm"
                    />
                    <input 
                      type="time" value={slot.startTime}
                      onChange={(e) => {
                        const newTimings = [...formData.timings];
                        newTimings[dIndex].timeSlots[sIndex].startTime = e.target.value;
                        setFormData(prev => ({ ...prev, timings: newTimings }));
                      }}
                      className="w-32 rounded-md border-gray-300 border px-3 py-1.5 text-sm"
                    />
                    <input type="text" placeholder="Description" value={slot.description || ""} onChange={(e) => { const newTimings = [...formData.timings]; newTimings[dIndex].timeSlots[sIndex].description = e.target.value; setFormData(prev => ({ ...prev, timings: newTimings })); }} className="flex-1 rounded-md border-gray-300 border px-3 py-1.5 text-sm" />
                    <label className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={Boolean(slot.isClosed)} onChange={(e) => { const newTimings = [...formData.timings]; newTimings[dIndex].timeSlots[sIndex].isClosed = e.target.checked; setFormData(prev => ({ ...prev, timings: newTimings })); }} /> Closed</label>
                    <label className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={Boolean(slot.isOpen24Hours)} onChange={(e) => { const newTimings = [...formData.timings]; newTimings[dIndex].timeSlots[sIndex].isOpen24Hours = e.target.checked; setFormData(prev => ({ ...prev, timings: newTimings })); }} /> 24h</label>
                    <label className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={Boolean(slot.isSpecialTiming)} onChange={(e) => { const newTimings = [...formData.timings]; newTimings[dIndex].timeSlots[sIndex].isSpecialTiming = e.target.checked; setFormData(prev => ({ ...prev, timings: newTimings })); }} /> Special</label>
                    <span className="text-gray-400">to</span>
                    <input 
                      type="time" value={slot.endTime}
                      onChange={(e) => {
                        const newTimings = [...formData.timings];
                        newTimings[dIndex].timeSlots[sIndex].endTime = e.target.value;
                        setFormData(prev => ({ ...prev, timings: newTimings }));
                      }}
                      className="w-32 rounded-md border-gray-300 border px-3 py-1.5 text-sm"
                    />
                    <button 
                      onClick={() => {
                        const newTimings = [...formData.timings];
                        newTimings[dIndex].timeSlots.splice(sIndex, 1);
                        setFormData(prev => ({ ...prev, timings: newTimings }));
                      }}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => {
                  const newTimings = [...formData.timings];
                  newTimings[dIndex].timeSlots.push({ startTime: "", endTime: "", title: "" });
                  setFormData(prev => ({ ...prev, timings: newTimings }));
                }}
                className="mt-3 text-sm text-[#E58C28] font-medium hover:underline"
              >
                + Add Time Slot
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b pb-2"><h2 className="text-xl font-bold text-gray-900">Aarti & Rituals</h2><span className="text-sm text-gray-500">{aartis.length} configured</span></div>
      {!id && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Save this temple as a draft before adding Aartis.</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input placeholder="Aarti name" value={aartiDraft.name} onChange={(e) => setAartiDraft({ ...aartiDraft, name: e.target.value })} className="rounded-lg border px-3 py-2" />
        <input type="time" value={aartiDraft.startTime} onChange={(e) => setAartiDraft({ ...aartiDraft, startTime: e.target.value })} className="rounded-lg border px-3 py-2" />
        <input type="time" value={aartiDraft.endTime} onChange={(e) => setAartiDraft({ ...aartiDraft, endTime: e.target.value })} className="rounded-lg border px-3 py-2" />
        <input placeholder="Days (optional, comma separated)" value={aartiDraft.days.join(", ")} onChange={(e) => setAartiDraft({ ...aartiDraft, days: e.target.value.split(",").map((day) => day.trim()).filter(Boolean) })} className="rounded-lg border px-3 py-2" />
        <input placeholder="Description" value={aartiDraft.description} onChange={(e) => setAartiDraft({ ...aartiDraft, description: e.target.value })} className="rounded-lg border px-3 py-2" />
        <input placeholder="Special notes" value={aartiDraft.specialNotes} onChange={(e) => setAartiDraft({ ...aartiDraft, specialNotes: e.target.value })} className="rounded-lg border px-3 py-2 md:col-span-2" />
        <input type="url" placeholder="Live stream URL (optional)" value={aartiDraft.liveStreamUrl} onChange={(e) => setAartiDraft({ ...aartiDraft, liveStreamUrl: e.target.value })} className="rounded-lg border px-3 py-2" />
      </div>
      <button type="button" disabled={!id} onClick={addAarti} className="rounded-lg bg-[#E58C28] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{editingAartiId ? "Update Aarti" : "Add Aarti"}</button>
      <div className="space-y-2">{aartis.map((aarti) => <div key={aarti._id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-semibold">{aarti.name}</p><p className="text-sm text-gray-500">{aarti.startTime} - {aarti.endTime}{aarti.description ? ` · ${aarti.description}` : ""}</p></div><div className="flex gap-3"><button type="button" onClick={() => { setEditingAartiId(aarti._id); setAartiDraft({ name: aarti.name || "", startTime: aarti.startTime || "", endTime: aarti.endTime || "", days: aarti.days || [], description: aarti.description || "", specialNotes: aarti.specialNotes || "", liveStreamUrl: aarti.liveStreamUrl || "", isActive: aarti.isActive !== false }); }} className="text-sm text-blue-600">Edit</button><button type="button" onClick={() => removeAarti(aarti._id)} className="text-sm text-red-600">Deactivate</button></div></div>)}</div>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b pb-2"><h2 className="text-xl font-bold text-gray-900">Festivals & Events</h2><span className="text-sm text-gray-500">{festivals.length} configured</span></div>
      {!id && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Save this temple as a draft before adding festivals.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input placeholder="Festival or event name" value={festivalDraft.name} onChange={(e) => setFestivalDraft({ ...festivalDraft, name: e.target.value })} className="rounded-lg border px-3 py-2 md:col-span-2" />
        <input type="date" value={festivalDraft.startDate} onChange={(e) => setFestivalDraft({ ...festivalDraft, startDate: e.target.value })} className="rounded-lg border px-3 py-2" />
        <input type="date" value={festivalDraft.endDate} onChange={(e) => setFestivalDraft({ ...festivalDraft, endDate: e.target.value })} className="rounded-lg border px-3 py-2" />
        <textarea placeholder="Description" value={festivalDraft.description} onChange={(e) => setFestivalDraft({ ...festivalDraft, description: e.target.value })} className="rounded-lg border px-3 py-2 md:col-span-2" />
        <input placeholder="Special timing" value={festivalDraft.specialTiming} onChange={(e) => setFestivalDraft({ ...festivalDraft, specialTiming: e.target.value })} className="rounded-lg border px-3 py-2" />
        <input placeholder="Special aarti" value={festivalDraft.specialAarti} onChange={(e) => setFestivalDraft({ ...festivalDraft, specialAarti: e.target.value })} className="rounded-lg border px-3 py-2" />
        <input placeholder="Expected crowd level (e.g. Very High)" value={festivalDraft.expectedCrowdLevel} onChange={(e) => setFestivalDraft({ ...festivalDraft, expectedCrowdLevel: e.target.value })} className="rounded-lg border px-3 py-2" />
        <input placeholder="Important information" value={festivalDraft.importantInformation} onChange={(e) => setFestivalDraft({ ...festivalDraft, importantInformation: e.target.value })} className="rounded-lg border px-3 py-2 md:col-span-2" />
      </div>
      <button type="button" disabled={!id} onClick={addFestival} className="rounded-lg bg-[#E58C28] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{editingFestivalId ? "Update Festival" : "Add Festival"}</button>
      <div className="space-y-2">{festivals.map((festival) => <div key={festival._id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-semibold">{festival.name}</p><p className="text-sm text-gray-500">{new Date(festival.startDate).toLocaleDateString()} - {new Date(festival.endDate).toLocaleDateString()}</p></div><div className="flex gap-3"><button type="button" onClick={() => { setEditingFestivalId(festival._id); setFestivalDraft({ name: festival.name || "", startDate: String(festival.startDate || "").slice(0, 10), endDate: String(festival.endDate || "").slice(0, 10), description: festival.description || "", specialTiming: festival.specialTiming || "", specialAarti: festival.specialAarti || "", expectedCrowdLevel: festival.expectedCrowdLevel || "", importantInformation: festival.importantInformation || "", isActive: festival.isActive !== false }); }} className="text-sm text-blue-600">Edit</button><button type="button" onClick={() => removeFestival(festival._id)} className="text-sm text-red-600">Deactivate</button></div></div>)}</div>
    </div>
  );

  const renderStep8 = () => <div className="space-y-6 animate-fade-in"><h2 className="text-xl font-bold text-gray-900 border-b pb-2">Darshan Information</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{Object.keys(formData.darshanInfo).map((field) => <div key={field}><label className="mb-1 block text-sm font-medium capitalize text-gray-700">{field.replace(/[A-Z]/g, " $&")}</label><textarea rows={2} value={(formData.darshanInfo as any)[field]} onChange={(e) => handleChange(`darshanInfo.${field}`, e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3" /></div>)}</div></div>;

  // Visitor and SEO fields share the same nested payload used by the API.
  const renderStep7 = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Visitor Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{Object.keys(formData.visitorInfo).map((field) => <div key={field} className={field === "templeRules" || field === "importantInstructions" ? "md:col-span-2" : ""}><label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{field.replace(/[A-Z]/g, " $&")}</label><textarea rows={field === "templeRules" || field === "importantInstructions" ? 3 : 2} value={(formData.visitorInfo as any)[field]} onChange={(e) => handleChange(`visitorInfo.${field}`, e.target.value)} className="w-full rounded-full border border-gray-200 px-4 py-2" /></div>)}</div>
    </div>
  );

  const renderStep11 = () => (
    <div className="space-y-6 animate-fade-in text-center py-10">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-900">Ready to Publish</h2>
      <p className="text-gray-500 max-w-md mx-auto">
        Please review all the information before publishing. Published temples will be immediately visible on the public Tirvona portal.
      </p>
      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={() => saveForm(false)}
          className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" /> Save as Draft
        </button>
        <button
          onClick={() => saveForm(true)}
          className="px-8 py-3 bg-[#E58C28] text-white rounded-xl font-bold hover:bg-[#d67d1d] shadow-lg shadow-orange-200 transition-colors flex items-center gap-2"
        >
          <Globe className="w-4 h-4" /> Publish Temple
        </button>
        {isEdit && formData.slug && <button onClick={() => navigate(`/temples/${formData.slug}?previewId=${id}`)} className="px-6 py-3 bg-[#0B192C] text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"><Eye className="w-4 h-4" /> Preview Temple</button>}
      </div>
      {isEdit && formData.status === "published" && (
        <p className="mt-4 text-green-600 font-medium text-sm flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" /> This temple is currently LIVE.
        </p>
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto pb-24">
      <EnterprisePageHeader
        title={isEdit ? `Edit Temple: ${formData.name}` : "Add New Temple"}
        subtitle="Manage complete temple information, history, timings and media."
      />
      
      {loading ? (
        <div className="text-center py-20">Loading temple data...</div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8 mt-6">
          {/* Sidebar Nav */}
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = currentStep === idx;
                return (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(idx)}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-colors border-l-4 ${
                      isActive 
                        ? "border-[#E58C28] bg-white text-[#E58C28]" 
                        : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#E58C28]" : "text-gray-400"}`} />
                    {step.label}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Form Content */}
          <div className="flex-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              {currentStep === 0 && renderStep0()}
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
              {currentStep === 5 && renderStep5()}
              {currentStep === 6 && renderStep6()}
              {currentStep === 7 && renderStep7()}
              {currentStep === 8 && renderStep8()}
              {currentStep === 9 && renderStep11()}
            </div>
            
            {/* Nav Footer */}
            {currentStep !== 9 && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                  disabled={currentStep === 0}
                  className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => saveForm(false)}
                    disabled={saving}
                    className="text-gray-500 hover:text-gray-800 font-medium px-4 py-2"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={() => setCurrentStep(s => Math.min(STEPS.length - 1, s + 1))}
                    className="px-6 py-2.5 bg-[#0B192C] text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
                  >
                    Next Step <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
