import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ashramService } from "../services";
import { formatCurrency } from "../utils/format";
import { FileUploader } from "../components/FileUploader";
import TirvonaMap from "../components/TirvonaMap";
import { ImageGalleryManager } from "../admin/shared/components/ImageGalleryManager";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Plus,
  X,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Image,
  BookOpen,
  Sparkles,
  Layers,
  Bed,
  DollarSign,
  ShieldCheck,
  Utensils,
  Compass,
  HeartPulse,
  Bus,
  FileCheck,
  Map,
  Eye,
  Send,
  Save,
  Star,
  Info,
  Trash2,
  GripVertical,
  CheckCircle,
  Zap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoomCategory {
  id: string;
  name: string;
  type: string;
  acType: string;
  capacity: number;
  totalInventory: number;
  basePrice: number;
  description: string;
  amenities: string;
}

interface NearbyAttraction {
  id: string;
  name: string;
  distance: string;
  type: string;
}

interface FormData {
  // Step 1 – Basic Info
  name: string;
  tagline: string;
  ashramType: string;
  establishedYear: string;
  languages: string;

  // Step 2 – Trust & Registration
  trustName: string;
  trustRegNo: string;
  panNo: string;
  trustType: string;
  registeredBy: string;

  // Step 3 – Address & GPS
  street: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  lat: string;
  lng: string;
  googleMapsUrl: string;

  // Step 4 – Contact
  phone: string;
  altPhone: string;
  email: string;
  website: string;
  facebook: string;
  instagram: string;
  youtube: string;

  // Step 5 – Images
  coverImageUrl: string;
  galleryUrls: string[];

  // Step 6 – About
  description: string;

  // Step 7 – History
  history: string;
  foundedBy: string;
  yearFounded: string;

  // Step 8 – Spiritual Activities
  activities: string[];
  dailySchedule: string;
  specialEvents: string;

  // Step 9 – Amenities
  amenities: string[];
  customAmenity: string;

  // Step 10 – Room Categories
  rooms: RoomCategory[];

  // Step 11 – Pricing & Capacity
  totalCapacity: string;
  lowestNightPrice: string;
  peakSeasonMultiplier: string;
  donationInfo: string;

  // Step 12 – Rules & Policies
  rules: string[];
  customRule: string;
  checkInTime: string;
  checkOutTime: string;
  minStay: string;
  maxStay: string;
  cancellationPolicy: string;

  // Step 13 – Food & Prasad
  foodType: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  prasadDetails: string;
  specialDiet: string;

  // Step 14 – Nearby Attractions
  nearbyAttractions: NearbyAttraction[];

  // Step 15 – Medical & Emergency
  nearestHospital: string;
  hospitalDistance: string;
  emergencyPhone: string;
  firstAidAvailable: boolean;
  ambulanceAccess: boolean;

  // Step 16 – Transport
  nearestRailway: string;
  railwayDistance: string;
  nearestAirport: string;
  airportDistance: string;
  busStand: string;
  busDistance: string;
  autoRickshaw: boolean;
  taxiAvailable: boolean;
  parkingAvailable: boolean;

  // Step 17 – Verification Docs
  trustDeedUrl: string;
  fireSafetyCertUrl: string;
  landOwnershipUrl: string;
  uploadNotes: string;

  // Step 18 – Google Maps (derived from lat/lng)
  mapEmbedUrl: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAFT_KEY = "tirvona_add_ashram_draft";

const BASIC_STEPS = [
  { id: 1, label: "Basic Info", icon: Building2, value: 0 },
  { id: 2, label: "Trust & Reg.", icon: ShieldCheck, value: 1 },
  { id: 3, label: "Address & GPS", icon: MapPin, value: 2 },
  { id: 4, label: "Contact", icon: Phone, value: 3 },
  { id: 5, label: "Ashram Photos", icon: Image, value: 4 },
  { id: 6, label: "Documents", icon: FileCheck, value: 16 },
  { id: 7, label: "Preview", icon: Eye, value: 18 },
  { id: 8, label: "Submit", icon: Send, value: 19 },
];

const CONFIG_STEPS = [
  { id: 1, label: "Images", icon: Image, value: 4 },
  { id: 2, label: "About", icon: BookOpen, value: 5 },
  { id: 3, label: "History", icon: Sparkles, value: 6 },
  { id: 4, label: "Activities", icon: Zap, value: 7 },
  { id: 5, label: "Amenities", icon: Layers, value: 8 },
  { id: 6, label: "Room Categories", icon: Bed, value: 9 },
  { id: 7, label: "Pricing", icon: DollarSign, value: 10 },
  { id: 8, label: "Rules & Policies", icon: Info, value: 11 },
  { id: 9, label: "Food & Prasad", icon: Utensils, value: 12 },
  { id: 10, label: "Attractions", icon: Compass, value: 13 },
  { id: 11, label: "Medical", icon: HeartPulse, value: 14 },
  { id: 12, label: "Transport", icon: Bus, value: 15 },
  { id: 13, label: "Preview", icon: Eye, value: 18 },
  { id: 14, label: "Save Changes", icon: Save, value: 20 },
];

const AMENITY_PRESETS = [
  "WiFi",
  "Pure Vegetarian Food",
  "Meditation Hall",
  "Yoga Studio",
  "Ganga View",
  "Goshala (Cow Shelter)",
  "Aarti Participation",
  "Ayurvedic Treatment",
  "Garden / Nature Walk",
  "Library",
  "Lecture Hall",
  "Hot Water (24x7)",
  "Air Conditioning",
  "Generator Backup",
  "CCTV Security",
  "Parking",
  "Laundry Service",
  "Doctor on Call",
  "Dharamsala Wing",
  "River Bathing Ghat",
  "Sadhana Kutirs",
  "Temple on Premises",
  "Satsang Hall",
];

const RULE_PRESETS = [
  "No alcohol or non-vegetarian food allowed on premises",
  "Silence to be maintained after 9:30 PM",
  "Guest ID proof mandatory at check-in",
  "Children below 5 years stay free",
  "Smoking strictly prohibited inside rooms",
  "Mobile phones to be switched off during Aarti",
  "Guests must attend morning Aarti (optional)",
  "Dress code: modest clothing required in temple areas",
];

const ASHRAM_TYPES = [
  "Vedantic Ashram",
  "Yoga Retreat",
  "Dharamsala",
  "Buddhist Monastery",
  "Jain Dharmashala",
  "Sikh Gurudwara Rest House",
  "Temple Trust Stay",
  "Spiritual Retreat Center",
];

const TRUST_TYPES = [
  "Public Charitable Trust",
  "Religious Trust",
  "Section 8 Company",
  "Society Registered under Societies Act",
  "Temple Trust",
  "Private Trust",
];

// ─── Default Form Data ────────────────────────────────────────────────────────

const defaultFormData: FormData = {
  name: "",
  tagline: "",
  ashramType: "",
  establishedYear: "",
  languages: "",
  trustName: "",
  trustRegNo: "",
  panNo: "",
  trustType: "",
  registeredBy: "",
  street: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  lat: "",
  lng: "",
  googleMapsUrl: "",
  phone: "",
  altPhone: "",
  email: "",
  website: "",
  facebook: "",
  instagram: "",
  youtube: "",
  coverImageUrl: "",
  galleryUrls: ["", "", ""],
  description: "",
  history: "",
  foundedBy: "",
  yearFounded: "",
  activities: [],
  dailySchedule: "",
  specialEvents: "",
  amenities: [],
  customAmenity: "",
  rooms: [],
  totalCapacity: "",
  lowestNightPrice: "",
  peakSeasonMultiplier: "1.5",
  donationInfo: "",
  rules: [],
  customRule: "",
  checkInTime: "12:00",
  checkOutTime: "11:00",
  minStay: "1",
  maxStay: "30",
  cancellationPolicy: "",
  foodType: "Satvik Vegetarian",
  breakfastTime: "07:00",
  lunchTime: "12:30",
  dinnerTime: "19:30",
  prasadDetails: "",
  specialDiet: "",
  nearbyAttractions: [],
  nearestHospital: "",
  hospitalDistance: "",
  emergencyPhone: "",
  firstAidAvailable: true,
  ambulanceAccess: false,
  nearestRailway: "",
  railwayDistance: "",
  nearestAirport: "",
  airportDistance: "",
  busStand: "",
  busDistance: "",
  autoRickshaw: true,
  taxiAvailable: true,
  parkingAvailable: true,
  trustDeedUrl: "",
  fireSafetyCertUrl: "",
  landOwnershipUrl: "",
  uploadNotes: "",
  mapEmbedUrl: "",
};

// ─── Utility ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

// ─── Field Components ─────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-1">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-gray-400 font-medium">{hint}</p>}
  </div>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (
  props,
) => (
  <input
    {...props}
    className={`w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600 ${props.className || ""}`}
  />
);

const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (
  props,
) => (
  <textarea
    {...props}
    className={`w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600 resize-none ${props.className || ""}`}
  />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (
  props,
) => (
  <select
    {...props}
    className={`w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all ${props.className || ""}`}
  />
);

const Toggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: () => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-3 cursor-pointer select-none group">
    <div
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${checked ? "bg-[#0A4DA6]" : "bg-gray-200 dark:bg-slate-700"}`}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${checked ? "left-6" : "left-1"}`}
      />
    </div>
    <span className="text-sm font-semibold text-[#0B192C] dark:text-white">
      {label}
    </span>
  </label>
);

// ─── Section Header ────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}> = ({ icon, title, subtitle }) => (
  <div className="flex items-start gap-4 pb-6 border-b border-gray-100 dark:border-slate-800 mb-6">
    <div className="w-12 h-12 rounded-2xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <div>
      <h2 className="text-lg font-extrabold text-[#0B192C] dark:text-white">
        {title}
      </h2>
      <p className="text-xs text-gray-400 font-medium mt-0.5">{subtitle}</p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const AddAshramWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const backPath = window.location.pathname.startsWith("/admin")
    ? "/admin/manage/ashrams/all"
    : "/owner/ashrams";
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const STEPS = editId ? CONFIG_STEPS : BASIC_STEPS;

  const [step, setStep] = useState(0); // 0-indexed
  const [maxStep, setMaxStep] = useState(0);

  useEffect(() => {
    setMaxStep((prev) => Math.max(prev, step));
  }, [step]);

  const [formData, setFormData] = useState<FormData>(() => {
    try {
      const isEditing = window.location.search.includes("edit");
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved && !isEditing)
        return { ...defaultFormData, ...JSON.parse(saved) };
    } catch {
      /* ignore */
    }
    return defaultFormData;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [newRule, setNewRule] = useState("");
  const [newGalleryUrl, setNewGalleryUrl] = useState("");

  // Fetch ashram for editing
  useEffect(() => {
    if (editId) {
      const fetchAshram = async () => {
        try {
          const res = await ashramService.getManagedById(editId);
          if (res.data.success) {
            const ashram = res.data.data.ashram;
            setFormData((prev) => ({
              ...prev,
              name: ashram.name || "",
              tagline: ashram.tagline || "",
              ashramType: ashram.ashramType || "",
              description: ashram.description || "",
              history: ashram.history || "",
              foundedBy: ashram.foundedBy || "",
              establishedYear: ashram.establishedYear || "",
              street: ashram.address?.street || "",
              city: ashram.address?.city || "",
              district: ashram.address?.district || "",
              state: ashram.address?.state || "",
              pincode: ashram.address?.pincode || "",
              lat:
                ashram.address?.coordinates?.coordinates?.[1]?.toString() || "",
              lng:
                ashram.address?.coordinates?.coordinates?.[0]?.toString() || "",
              googleMapsUrl: ashram.googleMapsUrl || "",
              phone: ashram.contact?.phone || "",
              altPhone: ashram.contact?.altPhone || "",
              email: ashram.contact?.email || "",
              website: ashram.contact?.website || "",
              facebook: ashram.contact?.social?.facebook || "",
              instagram: ashram.contact?.social?.instagram || "",
              youtube: ashram.contact?.social?.youtube || "",
              trustName: ashram.trust?.trustName || "",
              trustRegNo: ashram.trust?.trustRegNo || "",
              panNo: ashram.trust?.panNo || "",
              trustType: ashram.trust?.trustType || "",
              registeredBy: ashram.trust?.registeredBy || "",
              coverImageUrl: ashram.images?.[0] || "",
              galleryUrls: ashram.images?.slice(1) || [],
              amenities: ashram.amenities || [],
              activities: ashram.activities || [],
              dailySchedule: ashram.dailySchedule || "",
              specialEvents: ashram.specialEvents || "",
              rules: ashram.rules || [],
              checkInTime: ashram.policies?.checkInTime || "",
              checkOutTime: ashram.policies?.checkOutTime || "",
              minStay: ashram.policies?.minStay?.toString() || "1",
              maxStay: ashram.policies?.maxStay?.toString() || "30",
              cancellationPolicy: ashram.policies?.cancellationPolicy || "",
              foodType: ashram.food?.foodType || "",
              breakfastTime: ashram.food?.mealTimings?.breakfast || "",
              lunchTime: ashram.food?.mealTimings?.lunch || "",
              dinnerTime: ashram.food?.mealTimings?.dinner || "",
              prasadDetails: ashram.food?.prasadDetails || "",
              specialDiet: ashram.food?.specialDiet || "",
              nearbyAttractions: ashram.nearbyAttractions || [],
              nearestHospital: ashram.medical?.nearestHospital || "",
              hospitalDistance: ashram.medical?.hospitalDistance || "",
              emergencyPhone: ashram.medical?.emergencyPhone || "",
              firstAidAvailable: ashram.medical?.firstAidAvailable || false,
              ambulanceAccess: ashram.medical?.ambulanceAccess || false,
              nearestRailway: ashram.transport?.nearestRailway || "",
              railwayDistance: ashram.transport?.railwayDistance || "",
              nearestAirport: ashram.transport?.nearestAirport || "",
              airportDistance: ashram.transport?.airportDistance || "",
              busStand: ashram.transport?.busStand || "",
              busDistance: ashram.transport?.busDistance || "",
              autoRickshaw: ashram.transport?.autoRickshaw || false,
              taxiAvailable: ashram.transport?.taxiAvailable || false,
              parkingAvailable: ashram.transport?.parkingAvailable || false,
              trustDeedUrl: ashram.documents?.trustDeedUrl || "",
              fireSafetyCertUrl:
                ashram.documents?.fireSafetyCertificateUrl || "",
              landOwnershipUrl: ashram.documents?.landOwnershipUrl || "",
              uploadNotes: ashram.documents?.uploadNotes || "",
            }));
          }
        } catch (err) {
          console.error("Error fetching ashram details:", err);
        }
      };
      fetchAshram();
    }
  }, [editId]);

  // Autosave draft
  useEffect(() => {
    if (editId) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    } catch {
      /* ignore */
    }
  }, [formData, editId]);

  const set = useCallback((field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const e = { ...prev };
      delete e[field];
      return e;
    });
  }, []);

  // ─── Validation ──────────────────────────────────────────────────────────────

  const validateStep = (): boolean => {
    const e: Record<string, string> = {};
    const stepValue = STEPS[step].value;
    if (stepValue === 0) {
      if (!formData.name.trim()) e.name = "Ashram name is required";
      if (!formData.ashramType) e.ashramType = "Please select ashram type";
    }
    if (stepValue === 1) {
      if (!formData.trustName.trim()) e.trustName = "Trust name is required";
    }
    if (stepValue === 2) {
      if (!formData.street.trim()) e.street = "Street address is required";
      if (!formData.city.trim()) e.city = "City is required";
      if (!formData.district.trim()) e.district = "District is required";
      if (!formData.state.trim()) e.state = "State is required";
      if (!formData.pincode.trim()) e.pincode = "Pincode is required";
    }
    if (stepValue === 3) {
      if (!formData.phone.trim()) e.phone = "Phone number is required";
    }
    if (stepValue === 5) {
      if (!formData.description.trim())
        e.description = "Description is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");

    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = "Ashram name is required";
    if (!formData.ashramType) e.ashramType = "Please select ashram type";
    if (!formData.trustName.trim()) e.trustName = "Trust name is required";
    if (!formData.street.trim()) e.street = "Street address is required";
    if (!formData.city.trim()) e.city = "City is required";
    if (!formData.district.trim()) e.district = "District is required";
    if (!formData.state.trim()) e.state = "State is required";
    if (!formData.pincode.trim()) e.pincode = "Pincode is required";
    if (!formData.phone.trim()) e.phone = "Phone number is required";
    if (!formData.trustDeedUrl.trim())
      e.trustDeedUrl = "Trust deed document is required";
    if (!formData.fireSafetyCertUrl.trim())
      e.fireSafetyCertUrl = "Fire safety certificate is required";
    if (!formData.landOwnershipUrl.trim())
      e.landOwnershipUrl = "Land ownership or lease document is required";
    if (editId && !formData.description.trim())
      e.description = "Description is required";

    if (Object.keys(e).length > 0) {
      setErrors(e);
      const findStepIndex = (val: number) =>
        STEPS.findIndex((s) => s.value === val);
      if (e.name || e.ashramType) {
        const idx = findStepIndex(0);
        if (idx !== -1) setStep(idx);
      } else if (e.trustName) {
        const idx = findStepIndex(1);
        if (idx !== -1) setStep(idx);
      } else if (e.street || e.city || e.district || e.state || e.pincode) {
        const idx = findStepIndex(2);
        if (idx !== -1) setStep(idx);
      } else if (e.phone) {
        const idx = findStepIndex(3);
        if (idx !== -1) setStep(idx);
      } else if (e.trustDeedUrl || e.fireSafetyCertUrl || e.landOwnershipUrl) {
        const idx = findStepIndex(16);
        if (idx !== -1) setStep(idx);
      } else if (e.description) {
        const idx = findStepIndex(5);
        if (idx !== -1) setStep(idx);
      }

      setSubmitError("Please fill in all required fields before submitting.");
      setSubmitting(false);
      return;
    }

    const payload = {
      name: formData.name,
      tagline: formData.tagline,
      ashramType: formData.ashramType,
      description: formData.description,
      history: formData.history,
      foundedBy: formData.foundedBy,
      establishedYear: formData.establishedYear,
      address: {
        street: String(formData.street).trim(),
        city: String(formData.city).trim(),
        district: String(formData.district).trim(),
        state: String(formData.state).trim(),
        pincode: String(formData.pincode).trim(),
        coordinates:
          formData.lat && formData.lng
            ? {
                type: "Point",
                coordinates: [
                  parseFloat(formData.lng),
                  parseFloat(formData.lat),
                ],
              }
            : undefined,
      },
      contact: {
        phone: formData.phone,
        altPhone: formData.altPhone,
        email: formData.email,
        website: formData.website,
        social: {
          facebook: formData.facebook,
          instagram: formData.instagram,
          youtube: formData.youtube,
        },
      },
      trust: {
        trustName: formData.trustName,
        trustRegNo: formData.trustRegNo,
        panNo: formData.panNo,
        trustType: formData.trustType,
        registeredBy: formData.registeredBy,
      },
      images: [formData.coverImageUrl, ...formData.galleryUrls].filter(Boolean),
      amenities: formData.amenities,
      activities: formData.activities,
      dailySchedule: formData.dailySchedule,
      specialEvents: formData.specialEvents,
      rooms: formData.rooms,
      pricing: {
        totalCapacity: parseInt(formData.totalCapacity) || 0,
        lowestNightPrice: parseInt(formData.lowestNightPrice) || 0,
        peakSeasonMultiplier: parseFloat(formData.peakSeasonMultiplier) || 1.5,
        donationInfo: formData.donationInfo,
      },
      policies: {
        checkInTime: formData.checkInTime,
        checkOutTime: formData.checkOutTime,
        minStay: parseInt(formData.minStay) || 1,
        maxStay: parseInt(formData.maxStay) || 30,
        cancellationPolicy: formData.cancellationPolicy,
      },
      rules: formData.rules,
      food: {
        foodType: formData.foodType,
        mealTimings: {
          breakfast: formData.breakfastTime,
          lunch: formData.lunchTime,
          dinner: formData.dinnerTime,
        },
        prasadDetails: formData.prasadDetails,
        specialDiet: formData.specialDiet,
      },
      nearbyAttractions: formData.nearbyAttractions,
      medical: {
        nearestHospital: formData.nearestHospital,
        hospitalDistance: formData.hospitalDistance,
        emergencyPhone: formData.emergencyPhone,
        firstAidAvailable: formData.firstAidAvailable,
        ambulanceAccess: formData.ambulanceAccess,
      },
      transport: {
        nearestRailway: formData.nearestRailway,
        railwayDistance: formData.railwayDistance,
        nearestAirport: formData.nearestAirport,
        airportDistance: formData.airportDistance,
        busStand: formData.busStand,
        busDistance: formData.busDistance,
        autoRickshaw: formData.autoRickshaw,
        taxiAvailable: formData.taxiAvailable,
        parkingAvailable: formData.parkingAvailable,
      },
      documents: {
        trustDeedUrl: formData.trustDeedUrl,
        fireSafetyCertificateUrl: formData.fireSafetyCertUrl,
        landOwnershipUrl: formData.landOwnershipUrl,
        uploadNotes: formData.uploadNotes,
      },
    };

    try {
      const res = editId
        ? await ashramService.update(editId, payload)
        : await ashramService.create(payload);

      if (res.data.success) {
        setSubmitSuccess(true);
        localStorage.removeItem(DRAFT_KEY);
      } else {
        setSubmitError(
          editId
            ? "Failed to save changes. Please try again."
            : "Submission failed. Please try again.",
        );
      }
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.message || "Network error. Draft is saved locally.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Room Helpers ────────────────────────────────────────────────────────────

  const addRoom = () => {
    const newRoom: RoomCategory = {
      id: uid(),
      name: "",
      type: "dormitory",
      acType: "non_ac",
      capacity: 4,
      totalInventory: 5,
      basePrice: 150,
      description: "",
      amenities: "",
    };
    set("rooms", [...formData.rooms, newRoom]);
  };

  const updateRoom = (id: string, field: keyof RoomCategory, value: any) => {
    set(
      "rooms",
      formData.rooms.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const removeRoom = (id: string) => {
    set(
      "rooms",
      formData.rooms.filter((r) => r.id !== id),
    );
  };

  // ─── Attraction Helpers ───────────────────────────────────────────────────────

  const addAttraction = () => {
    set("nearbyAttractions", [
      ...formData.nearbyAttractions,
      { id: uid(), name: "", distance: "", type: "Temple" },
    ]);
  };

  const updateAttraction = (
    id: string,
    field: keyof NearbyAttraction,
    value: string,
  ) => {
    set(
      "nearbyAttractions",
      formData.nearbyAttractions.map((a) =>
        a.id === id ? { ...a, [field]: value } : a,
      ),
    );
  };

  const removeAttraction = (id: string) => {
    set(
      "nearbyAttractions",
      formData.nearbyAttractions.filter((a) => a.id !== id),
    );
  };

  // ─── Activity Helpers ─────────────────────────────────────────────────────────

  const addActivity = (val: string) => {
    const v = val.trim();
    if (v && !formData.activities.includes(v)) {
      set("activities", [...formData.activities, v]);
    }
    setNewActivity("");
  };

  const removeActivity = (a: string) =>
    set(
      "activities",
      formData.activities.filter((x) => x !== a),
    );

  // ─── Rule Helpers ─────────────────────────────────────────────────────────────

  const addRule = (val: string) => {
    const v = val.trim();
    if (v && !formData.rules.includes(v)) {
      set("rules", [...formData.rules, v]);
    }
    setNewRule("");
  };

  const removeRule = (r: string) =>
    set(
      "rules",
      formData.rules.filter((x) => x !== r),
    );

  // ─── Amenity Helpers ──────────────────────────────────────────────────────────

  const toggleAmenity = (am: string) => {
    if (formData.amenities.includes(am)) {
      set(
        "amenities",
        formData.amenities.filter((a) => a !== am),
      );
    } else {
      set("amenities", [...formData.amenities, am]);
    }
  };

  const addCustomAmenity = () => {
    const v = formData.customAmenity.trim();
    if (v && !formData.amenities.includes(v)) {
      set("amenities", [...formData.amenities, v]);
      set("customAmenity", "");
    }
  };

  // The Google Maps embed URL that used to back the read-only iframe on the map
  // step is gone — that step now renders an interactive OpenStreetMap picker.

  // ─── Error Badge ──────────────────────────────────────────────────────────────

  const ErrMsg: React.FC<{ field: string }> = ({ field }) =>
    errors[field] ? (
      <p className="flex items-center gap-1 text-[10px] text-danger font-bold mt-1">
        <AlertCircle size={10} /> {errors[field]}
      </p>
    ) : null;

  // ─── Step Renderers ───────────────────────────────────────────────────────────

  const renderStep = () => {
    const stepValue = STEPS[step].value;
    switch (stepValue) {
      // ── Step 1: Basic Information ──────────────────────────────────────────
      case 0:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Building2 size={22} />}
              title="Basic Information"
              subtitle="Core identity of the Ashram — name, type, and overview."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Ashram / Retreat Name" required>
                <Input
                  placeholder="e.g. Swami Dayanand Ashram"
                  value={formData.name}
                  onChange={(e) => set("name", e.target.value)}
                />
                <ErrMsg field="name" />
              </Field>
              <Field
                label="Tagline"
                hint="Short inspiring phrase shown under the name"
              >
                <Input
                  placeholder="e.g. A Sanctuary of Inner Peace on the Ganges"
                  value={formData.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Ashram Type" required>
                <Select
                  value={formData.ashramType}
                  onChange={(e) => set("ashramType", e.target.value)}
                >
                  <option value="">— Select Type —</option>
                  {ASHRAM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <ErrMsg field="ashramType" />
              </Field>
              <Field label="Year Established" hint="e.g. 1975">
                <Input
                  type="number"
                  placeholder="1975"
                  value={formData.establishedYear}
                  onChange={(e) => set("establishedYear", e.target.value)}
                />
              </Field>
              <Field
                label="Primary Languages"
                hint="e.g. Hindi, Sanskrit, English"
              >
                <Input
                  placeholder="Hindi, Sanskrit"
                  value={formData.languages}
                  onChange={(e) => set("languages", e.target.value)}
                />
              </Field>
            </div>
          </div>
        );

      // ── Step 2: Trust & Registration ───────────────────────────────────────
      case 1:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<ShieldCheck size={22} />}
              title="Trust & Registration Details"
              subtitle="Legal identity, trust deed, and government registration details."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Registered Trust / Organization Name" required>
                <Input
                  placeholder="e.g. Sri Ram Mandir Trust"
                  value={formData.trustName}
                  onChange={(e) => set("trustName", e.target.value)}
                />
                <ErrMsg field="trustName" />
              </Field>
              <Field label="Trust Type">
                <Select
                  value={formData.trustType}
                  onChange={(e) => set("trustType", e.target.value)}
                >
                  <option value="">— Select Trust Type —</option>
                  {TRUST_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Trust Registration Number">
                <Input
                  placeholder="e.g. TR/UK/2001/1234"
                  value={formData.trustRegNo}
                  onChange={(e) => set("trustRegNo", e.target.value)}
                />
              </Field>
              <Field label="PAN Number">
                <Input
                  placeholder="e.g. AABT1234X"
                  value={formData.panNo}
                  onChange={(e) => set("panNo", e.target.value)}
                />
              </Field>
              <Field label="Registered By / Founder Trustee Name">
                <Input
                  placeholder="Swami Dayanand Saraswati"
                  value={formData.registeredBy}
                  onChange={(e) => set("registeredBy", e.target.value)}
                />
              </Field>
            </div>
          </div>
        );

      // ── Step 3: Address & GPS ───────────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<MapPin size={22} />}
              title="Complete Address & GPS Coordinates"
              subtitle="Physical location for mapping, navigation, and official records."
            />
            <Field label="Street / Locality" required>
              <Input
                placeholder="e.g. Purani Basti, Near Ram Jhula"
                value={formData.street}
                onChange={(e) => set("street", e.target.value)}
              />
              <ErrMsg field="street" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="City / Town" required>
                <Input
                  placeholder="Rishikesh"
                  value={formData.city}
                  onChange={(e) => set("city", e.target.value)}
                />
                <ErrMsg field="city" />
              </Field>
              <Field label="District" required>
                <Input
                  placeholder="Pauri Garhwal"
                  value={formData.district}
                  onChange={(e) => set("district", e.target.value)}
                />
                <ErrMsg field="district" />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="State" required>
                <Input
                  placeholder="Uttarakhand"
                  value={formData.state}
                  onChange={(e) => set("state", e.target.value)}
                />
                <ErrMsg field="state" />
              </Field>
              <Field label="PIN Code" required>
                <Input
                  name="postal-code"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  placeholder="249201"
                  value={formData.pincode}
                  onChange={(e) => set("pincode", e.target.value)}
                />
                <ErrMsg field="pincode" />
              </Field>
            </div>
            <div className="p-4 bg-[#0A4DA6]/5 border border-[#0A4DA6]/20 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-[#0A4DA6] tracking-wider flex items-center gap-1.5">
                <Map size={14} /> GPS Coordinates (for map widget)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Latitude" hint="e.g. 30.1086">
                  <Input
                    placeholder="30.1086"
                    value={formData.lat}
                    onChange={(e) => set("lat", e.target.value)}
                  />
                </Field>
                <Field label="Longitude" hint="e.g. 78.3218">
                  <Input
                    placeholder="78.3218"
                    value={formData.lng}
                    onChange={(e) => set("lng", e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label="Google Maps Share Link"
                hint="Paste the 'Share' URL from Google Maps"
              >
                <Input
                  placeholder="https://maps.google.com/..."
                  value={formData.googleMapsUrl}
                  onChange={(e) => set("googleMapsUrl", e.target.value)}
                />
              </Field>
            </div>
          </div>
        );

      // ── Step 4: Contact Information ─────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Phone size={22} />}
              title="Contact Information"
              subtitle="All ways pilgrims and guests can reach the ashram trust."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Primary Phone" required>
                <Input
                  type="tel"
                  placeholder="+91 135 244 0001"
                  value={formData.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
                <ErrMsg field="phone" />
              </Field>
              <Field label="Alternate Phone">
                <Input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.altPhone}
                  onChange={(e) => set("altPhone", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Email Address">
                <Input
                  type="email"
                  placeholder="stay@ashram.org"
                  value={formData.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Official Website">
                <Input
                  type="url"
                  placeholder="https://ashram.org"
                  value={formData.website}
                  onChange={(e) => set("website", e.target.value)}
                />
              </Field>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-gray-400 tracking-wider">
                Social Media Links (Optional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Field label="Facebook">
                  <Input
                    placeholder="https://facebook.com/..."
                    value={formData.facebook}
                    onChange={(e) => set("facebook", e.target.value)}
                  />
                </Field>
                <Field label="Instagram">
                  <Input
                    placeholder="https://instagram.com/..."
                    value={formData.instagram}
                    onChange={(e) => set("instagram", e.target.value)}
                  />
                </Field>
                <Field label="YouTube">
                  <Input
                    placeholder="https://youtube.com/..."
                    value={formData.youtube}
                    onChange={(e) => set("youtube", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        );

      // ── Step 5: Images ──────────────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Image size={22} />}
              title="Cover Image & Gallery"
              subtitle="High-quality images that showcase the ashram on the public listing page."
            />

            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider">
                Gallery Images (Up to 10)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.galleryUrls.map((url, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder={`Gallery image ${idx + 1} URL`}
                        value={url}
                        onChange={(e) => {
                          const updated = [...formData.galleryUrls];
                          updated[idx] = e.target.value;
                          set("galleryUrls", updated);
                        }}
                      />
                      <button
                        onClick={() =>
                          set(
                            "galleryUrls",
                            formData.galleryUrls.filter((_, i) => i !== idx),
                          )
                        }
                        className="p-3 bg-danger/10 text-danger rounded-xl hover:bg-danger/20 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {url && (
                      <div className="h-28 rounded-xl overflow-hidden border border-gray-100 dark:border-slate-800">
                        <img
                          src={url}
                          alt={`Gallery ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {formData.galleryUrls.length < 10 && (
                <div className="space-y-2">
                  <FileUploader
                    folder="ashrams"
                    label="Upload a Gallery Image"
                    onUploaded={(url) =>
                      set("galleryUrls", [...formData.galleryUrls, url])
                    }
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="…or paste an image URL and click Add"
                      value={newGalleryUrl}
                      onChange={(e) => setNewGalleryUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          set("galleryUrls", [
                            ...formData.galleryUrls,
                            newGalleryUrl,
                          ]);
                          setNewGalleryUrl("");
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newGalleryUrl.trim()) {
                          set("galleryUrls", [
                            ...formData.galleryUrls,
                            newGalleryUrl.trim(),
                          ]);
                          setNewGalleryUrl("");
                        }
                      }}
                      className="px-5 py-3 bg-[#0A4DA6] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-[#0A4DA6]/90 transition-colors flex-shrink-0"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      // ── Step 6: About ───────────────────────────────────────────────────────
      case 5:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<BookOpen size={22} />}
              title="About the Ashram"
              subtitle="The main description shown on the public page. Be detailed and inviting."
            />
            <Field
              label="Ashram Description"
              required
              hint="Write at least 100 words describing the retreat, atmosphere, purpose, and guest experience."
            >
              <Textarea
                rows={12}
                placeholder="Nestled on the banks of the sacred Ganges in Rishikesh, this ashram offers a serene sanctuary for spiritual seekers and pilgrims from across India. Founded in 1975 by revered saint Swami Dayanand Saraswati, the ashram maintains traditional Vedantic teachings while providing comfortable accommodation for pilgrims of all walks of life..."
                value={formData.description}
                onChange={(e) => set("description", e.target.value)}
              />
              <div className="flex justify-between items-center mt-1">
                <ErrMsg field="description" />
                <span className="text-[10px] text-gray-400 ml-auto">
                  {formData.description.length} characters
                </span>
              </div>
            </Field>
          </div>
        );

      // ── Step 7: Historical Significance ────────────────────────────────────
      case 6:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Sparkles size={22} />}
              title="Historical Significance"
              subtitle="The spiritual heritage, founding story, and historical context of the ashram."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label="Founded By"
                hint="Name of the founding saint or organization"
              >
                <Input
                  placeholder="Swami Dayanand Saraswati"
                  value={formData.foundedBy}
                  onChange={(e) => set("foundedBy", e.target.value)}
                />
              </Field>
              <Field label="Year Founded">
                <Input
                  type="number"
                  placeholder="1975"
                  value={formData.yearFounded}
                  onChange={(e) => set("yearFounded", e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Historical Significance"
              hint="Appears in an italic quote block on the public page. Describe the spiritual or historical importance."
            >
              <Textarea
                rows={10}
                placeholder="This sacred site holds immense historical importance, dating back to the early Vedantic movement of the 20th century. The ashram was established as a center for classical Sanskrit education and Vedantic philosophy. Over the decades, it has hosted thousands of seekers and continues to be a beacon of authentic spiritual learning..."
                value={formData.history}
                onChange={(e) => set("history", e.target.value)}
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                {formData.history.length} characters
              </span>
            </Field>
          </div>
        );

      // ── Step 8: Spiritual Activities ────────────────────────────────────────
      case 7:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Zap size={22} />}
              title="Spiritual Activities"
              subtitle="Programs, rituals, and activities conducted at the ashram for guests."
            />
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider">
                Activities & Programs
              </label>
              <div className="flex flex-wrap gap-2 min-h-12 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl">
                {formData.activities.map((a) => (
                  <span
                    key={a}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A4DA6]/10 text-[#0A4DA6] rounded-full text-xs font-bold"
                  >
                    {a}
                    <button
                      onClick={() => removeActivity(a)}
                      className="hover:text-danger transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {formData.activities.length === 0 && (
                  <span className="text-xs text-gray-300 dark:text-gray-600">
                    No activities added yet
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Morning Aarti, Yoga, Gita Discourse..."
                  value={newActivity}
                  onChange={(e) => setNewActivity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addActivity(newActivity);
                    }
                  }}
                />
                <button
                  onClick={() => addActivity(newActivity)}
                  className="px-5 py-3 bg-[#0A4DA6] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-[#0A4DA6]/90 transition-colors flex-shrink-0"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  "Morning Aarti",
                  "Yoga Classes",
                  "Gita Discourse",
                  "Meditation Sessions",
                  "Vedic Chanting",
                  "Puja Ceremony",
                  "Satsang",
                  "Pranayama",
                  "Bhajan",
                  "River Dip",
                ].map((p) => (
                  <button
                    key={p}
                    onClick={() => addActivity(p)}
                    disabled={formData.activities.includes(p)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${formData.activities.includes(p) ? "bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/30 opacity-50" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-[#0A4DA6]/10 hover:text-[#0A4DA6] hover:border-[#0A4DA6]/30"}`}
                  >
                    + {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label="Daily Schedule"
                hint="Brief description of a typical day for a guest"
              >
                <Textarea
                  rows={5}
                  placeholder="5:00 AM — Morning Aarti&#10;6:00 AM — Yoga & Pranayama&#10;8:00 AM — Breakfast&#10;10:00 AM — Discourse / Study&#10;12:30 PM — Lunch&#10;..."
                  value={formData.dailySchedule}
                  onChange={(e) => set("dailySchedule", e.target.value)}
                />
              </Field>
              <Field
                label="Special Events & Festivals"
                hint="Upcoming or annual programs"
              >
                <Textarea
                  rows={5}
                  placeholder="Navaratri Celebrations (Oct)&#10;Diwali Puja &amp; Havan&#10;Guru Purnima Satsang&#10;Annual Yoga Retreat (Jan)"
                  value={formData.specialEvents}
                  onChange={(e) => set("specialEvents", e.target.value)}
                />
              </Field>
            </div>
          </div>
        );

      // ── Step 9: Amenities ───────────────────────────────────────────────────
      case 8:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Layers size={22} />}
              title="Facilities & Amenities"
              subtitle="Select all amenities available at this ashram. These appear as tags on the listing page."
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {AMENITY_PRESETS.map((am) => (
                <button
                  key={am}
                  onClick={() => toggleAmenity(am)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl text-xs font-semibold border transition-all text-left ${
                    formData.amenities.includes(am)
                      ? "bg-[#0A4DA6] text-white border-[#0A4DA6] shadow-md shadow-[#0A4DA6]/20"
                      : "bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6]/50 hover:bg-[#0A4DA6]/5"
                  }`}
                >
                  {formData.amenities.includes(am) ? (
                    <Check size={12} className="flex-shrink-0" />
                  ) : (
                    <div className="w-3 h-3 rounded border border-current opacity-40 flex-shrink-0" />
                  )}
                  {am}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Add custom amenity..."
                value={formData.customAmenity}
                onChange={(e) => set("customAmenity", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomAmenity();
                  }
                }}
              />
              <button
                onClick={addCustomAmenity}
                className="px-5 py-3 bg-[#0A4DA6] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-[#0A4DA6]/90 transition-colors flex-shrink-0"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            {formData.amenities.filter((a) => !AMENITY_PRESETS.includes(a))
              .length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {formData.amenities
                  .filter((a) => !AMENITY_PRESETS.includes(a))
                  .map((a) => (
                    <span
                      key={a}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-700 rounded-full text-xs font-bold border border-amber-500/20"
                    >
                      {a}
                      <button onClick={() => toggleAmenity(a)}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
              </div>
            )}
            <p className="text-[10px] text-gray-400">
              {formData.amenities.length} amenities selected
            </p>
          </div>
        );

      // ── Step 10: Room Categories ────────────────────────────────────────────
      case 9:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Bed size={22} />}
              title="Room Categories"
              subtitle="Define every type of accommodation available. Guests select from these on the booking page."
            />
            <div className="space-y-5">
              {formData.rooms.map((room, idx) => (
                <div
                  key={room.id}
                  className="p-5 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-2xl space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold text-[#0A4DA6] tracking-wider flex items-center gap-2">
                      <GripVertical size={14} className="text-gray-300" /> Room
                      Category {idx + 1}
                    </span>
                    <button
                      onClick={() => removeRoom(room.id)}
                      className="flex items-center gap-1 text-[10px] font-bold text-danger hover:bg-danger/10 px-3 py-1.5 rounded-full border border-danger/20 transition-colors"
                    >
                      <Trash2 size={11} /> Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Room Category Name" required>
                      <Input
                        placeholder="e.g. Deluxe Dormitory, Private Kutir"
                        value={room.name}
                        onChange={(e) =>
                          updateRoom(room.id, "name", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Room Type">
                      <Select
                        value={room.type}
                        onChange={(e) =>
                          updateRoom(room.id, "type", e.target.value)
                        }
                      >
                        <option value="dormitory">Dormitory</option>
                        <option value="private_room">Private Room</option>
                        <option value="deluxe_room">Deluxe Room</option>
                        <option value="suite">Suite / Kutir</option>
                        <option value="family_room">Family Room</option>
                        <option value="cottage">Cottage</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="AC Type">
                      <Select
                        value={room.acType}
                        onChange={(e) =>
                          updateRoom(room.id, "acType", e.target.value)
                        }
                      >
                        <option value="non_ac">Non-AC</option>
                        <option value="ac">AC</option>
                        <option value="fan">Fan Only</option>
                      </Select>
                    </Field>
                    <Field label="Capacity (Guests)">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={room.capacity}
                        onChange={(e) =>
                          updateRoom(
                            room.id,
                            "capacity",
                            parseInt(e.target.value) || 1,
                          )
                        }
                      />
                    </Field>
                    <Field label="Total Inventory (Rooms)">
                      <Input
                        type="number"
                        min={1}
                        value={room.totalInventory}
                        onChange={(e) =>
                          updateRoom(
                            room.id,
                            "totalInventory",
                            parseInt(e.target.value) || 1,
                          )
                        }
                      />
                    </Field>
                    <Field label="Base Price (₹/night)">
                      <Input
                        type="number"
                        min={0}
                        value={room.basePrice}
                        onChange={(e) =>
                          updateRoom(
                            room.id,
                            "basePrice",
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Room Description">
                    <Textarea
                      rows={2}
                      placeholder="Simple clean room with attached bathroom, 24-hour hot water, and Ganga view..."
                      value={room.description}
                      onChange={(e) =>
                        updateRoom(room.id, "description", e.target.value)
                      }
                    />
                  </Field>
                  <Field
                    label="Room Amenities (comma separated)"
                    hint="e.g. Hot Water, Attached Bathroom, Ganga View, AC, Locker"
                  >
                    <Input
                      placeholder="Hot Water, Attached Bathroom, Ganga View"
                      value={room.amenities}
                      onChange={(e) =>
                        updateRoom(room.id, "amenities", e.target.value)
                      }
                    />
                  </Field>
                </div>
              ))}

              <button
                onClick={addRoom}
                className="w-full py-4 border-2 border-dashed border-[#0A4DA6]/30 rounded-2xl text-[#0A4DA6] font-bold text-sm flex items-center justify-center gap-2 hover:border-[#0A4DA6]/60 hover:bg-[#0A4DA6]/5 transition-all"
              >
                <Plus size={18} /> Add Room Category
              </button>

              {formData.rooms.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-sm">
                  <Bed size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="font-semibold">No room categories added yet.</p>
                  <p className="text-xs mt-1">
                    Click "Add Room Category" to begin.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      // ── Step 11: Pricing & Capacity ─────────────────────────────────────────
      case 10:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<DollarSign size={22} />}
              title="Pricing & Capacity"
              subtitle="Total ashram capacity, pricing range, and donation information."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field
                label="Total Guest Capacity"
                hint="Maximum number of guests at any time"
              >
                <Input
                  type="number"
                  placeholder="100"
                  value={formData.totalCapacity}
                  onChange={(e) => set("totalCapacity", e.target.value)}
                />
              </Field>
              <Field
                label="Lowest Night Price (₹)"
                hint="Used in search results and listing cards"
              >
                <Input
                  type="number"
                  placeholder="150"
                  value={formData.lowestNightPrice}
                  onChange={(e) => set("lowestNightPrice", e.target.value)}
                />
              </Field>
              <Field
                label="Peak Season Price Multiplier"
                hint="e.g. 1.5 = 50% higher during festivals"
              >
                <Input
                  type="number"
                  step="0.1"
                  placeholder="1.5"
                  value={formData.peakSeasonMultiplier}
                  onChange={(e) => set("peakSeasonMultiplier", e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Donation Information"
              hint="Describe how guests can make donations to the ashram trust (optional but recommended)"
            >
              <Textarea
                rows={4}
                placeholder="Guests are encouraged to make a voluntary donation to support the ashram's free meal (Bhandara) program for pilgrims. Donations can be made via UPI (ashram@upi) or by cheque in favor of 'Sri Ram Mandir Trust'."
                value={formData.donationInfo}
                onChange={(e) => set("donationInfo", e.target.value)}
              />
            </Field>
          </div>
        );

      // ── Step 12: Rules & Policies ───────────────────────────────────────────
      case 11:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Info size={22} />}
              title="Booking Rules & Policies"
              subtitle="Guest guidelines, check-in policies, and cancellation terms."
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <Field label="Check-in Time">
                <Input
                  type="time"
                  value={formData.checkInTime}
                  onChange={(e) => set("checkInTime", e.target.value)}
                />
              </Field>
              <Field label="Check-out Time">
                <Input
                  type="time"
                  value={formData.checkOutTime}
                  onChange={(e) => set("checkOutTime", e.target.value)}
                />
              </Field>
              <Field label="Min. Stay (nights)">
                <Input
                  type="number"
                  min={1}
                  value={formData.minStay}
                  onChange={(e) => set("minStay", e.target.value)}
                />
              </Field>
              <Field label="Max. Stay (nights)">
                <Input
                  type="number"
                  min={1}
                  value={formData.maxStay}
                  onChange={(e) => set("maxStay", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Cancellation Policy">
              <Textarea
                rows={3}
                placeholder="Free cancellation up to 48 hours before check-in. Cancellations within 24 hours forfeit 50% of the booking amount. No-shows forfeit the full amount."
                value={formData.cancellationPolicy}
                onChange={(e) => set("cancellationPolicy", e.target.value)}
              />
            </Field>

            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider">
                Guest Rules & Guidelines
              </label>
              <div className="space-y-2">
                {formData.rules.map((rule, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center text-[9px] font-extrabold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 flex-grow">
                      {rule}
                    </span>
                    <button
                      onClick={() => removeRule(rule)}
                      className="text-gray-300 hover:text-danger transition-colors flex-shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Type a rule and press Add..."
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRule(newRule);
                    }
                  }}
                />
                <button
                  onClick={() => addRule(newRule)}
                  className="px-5 py-3 bg-[#0A4DA6] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-[#0A4DA6]/90 transition-colors flex-shrink-0"
                >
                  <Plus size={14} /> Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {RULE_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => addRule(p)}
                    disabled={formData.rules.includes(p)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-all ${formData.rules.includes(p) ? "opacity-40 cursor-not-allowed bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/20" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-[#0A4DA6]/5 hover:border-[#0A4DA6]/30 hover:text-[#0A4DA6]"}`}
                  >
                    + {p.slice(0, 40)}
                    {p.length > 40 ? "…" : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      // ── Step 13: Food & Prasad ──────────────────────────────────────────────
      case 12:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Utensils size={22} />}
              title="Food & Prasad Services"
              subtitle="Meal types, timings, and special prasad offerings for guests."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Food Type Offered">
                <Select
                  value={formData.foodType}
                  onChange={(e) => set("foodType", e.target.value)}
                >
                  <option value="Satvik Vegetarian">
                    Satvik Vegetarian (No Onion/Garlic)
                  </option>
                  <option value="Pure Vegetarian">Pure Vegetarian</option>
                  <option value="Jain Food">Jain Food Available</option>
                  <option value="Vegan">Vegan Options Available</option>
                  <option value="No Meals Provided">No Meals Provided</option>
                </Select>
              </Field>
              <Field
                label="Special Diet Accommodations"
                hint="e.g. diabetic meals, lactose-free, etc."
              >
                <Input
                  placeholder="Diabetic meals on request, lactose-free"
                  value={formData.specialDiet}
                  onChange={(e) => set("specialDiet", e.target.value)}
                />
              </Field>
            </div>
            {/* Stacked on phones: a native <input type="time"> has a browser-
                enforced minimum width (~110px) that will not shrink, so three
                across a 320px viewport overflows and clips the AM/PM control. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Field label="Breakfast Time">
                <Input
                  type="time"
                  value={formData.breakfastTime}
                  onChange={(e) => set("breakfastTime", e.target.value)}
                />
              </Field>
              <Field label="Lunch Time">
                <Input
                  type="time"
                  value={formData.lunchTime}
                  onChange={(e) => set("lunchTime", e.target.value)}
                />
              </Field>
              <Field label="Dinner Time">
                <Input
                  type="time"
                  value={formData.dinnerTime}
                  onChange={(e) => set("dinnerTime", e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Prasad & Special Offerings"
              hint="Describe any special prasad meals, bhandara, or free meal programs"
            >
              <Textarea
                rows={5}
                placeholder="Daily Bhandara (free community meal) served to all pilgrims at 12:30 PM. Special Mahaprasad prepared on Ekadashi and festival days. Guests can participate in offering Bhog to the deity in the main temple."
                value={formData.prasadDetails}
                onChange={(e) => set("prasadDetails", e.target.value)}
              />
            </Field>
          </div>
        );

      // ── Step 14: Nearby Attractions ─────────────────────────────────────────
      case 13:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Compass size={22} />}
              title="Nearby Attractions & Temples"
              subtitle="Points of interest near the ashram that guests can visit during their stay."
            />
            <div className="space-y-4">
              {formData.nearbyAttractions.map((attr, idx) => (
                <div
                  key={attr.id}
                  className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-2xl items-end"
                >
                  <Field label={`Attraction ${idx + 1}`}>
                    <Input
                      placeholder="Triveni Ghat"
                      value={attr.name}
                      onChange={(e) =>
                        updateAttraction(attr.id, "name", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Distance">
                    <Input
                      placeholder="0.5 km"
                      value={attr.distance}
                      onChange={(e) =>
                        updateAttraction(attr.id, "distance", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={attr.type}
                      onChange={(e) =>
                        updateAttraction(attr.id, "type", e.target.value)
                      }
                    >
                      <option value="Temple">Temple</option>
                      <option value="Ghat">Ghat</option>
                      <option value="Market">Market</option>
                      <option value="Nature Spot">Nature Spot</option>
                      <option value="Historical Site">Historical Site</option>
                      <option value="Yoga Center">Yoga Center</option>
                      <option value="Other">Other</option>
                    </Select>
                  </Field>
                  <button
                    onClick={() => removeAttraction(attr.id)}
                    className="flex items-center gap-1 text-[10px] font-bold text-danger hover:bg-danger/10 px-4 py-3 rounded-xl border border-danger/20 transition-colors justify-center"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              ))}

              <button
                onClick={addAttraction}
                className="w-full py-4 border-2 border-dashed border-[#0A4DA6]/30 rounded-2xl text-[#0A4DA6] font-bold text-sm flex items-center justify-center gap-2 hover:border-[#0A4DA6]/60 hover:bg-[#0A4DA6]/5 transition-all"
              >
                <Plus size={18} /> Add Attraction
              </button>
            </div>
          </div>
        );

      // ── Step 15: Medical & Emergency ────────────────────────────────────────
      case 14:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<HeartPulse size={22} />}
              title="Medical & Emergency Services"
              subtitle="Healthcare access information — critical for pilgrims and senior guests."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Nearest Hospital / Clinic Name">
                <Input
                  placeholder="All India Institute of Medical Sciences (AIIMS)"
                  value={formData.nearestHospital}
                  onChange={(e) => set("nearestHospital", e.target.value)}
                />
              </Field>
              <Field label="Hospital Distance">
                <Input
                  placeholder="2.5 km"
                  value={formData.hospitalDistance}
                  onChange={(e) => set("hospitalDistance", e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Emergency Contact Number"
              hint="24-hour emergency number displayed prominently to guests"
            >
              <Input
                type="tel"
                placeholder="+91 135 244 0999"
                value={formData.emergencyPhone}
                onChange={(e) => set("emergencyPhone", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <Toggle
                label="First Aid Kit Available on Premises"
                checked={formData.firstAidAvailable}
                onChange={() =>
                  set("firstAidAvailable", !formData.firstAidAvailable)
                }
              />
              <Toggle
                label="Ambulance Access to Premises"
                checked={formData.ambulanceAccess}
                onChange={() =>
                  set("ambulanceAccess", !formData.ambulanceAccess)
                }
              />
            </div>
          </div>
        );

      // ── Step 16: Transport Information ──────────────────────────────────────
      case 15:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Bus size={22} />}
              title="Transport Information"
              subtitle="How guests reach the ashram — essential for travel planning."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Nearest Railway Station">
                <Input
                  placeholder="Haridwar Railway Station (Haridwar Jn.)"
                  value={formData.nearestRailway}
                  onChange={(e) => set("nearestRailway", e.target.value)}
                />
              </Field>
              <Field label="Distance from Railway Station">
                <Input
                  placeholder="24 km"
                  value={formData.railwayDistance}
                  onChange={(e) => set("railwayDistance", e.target.value)}
                />
              </Field>
              <Field label="Nearest Airport">
                <Input
                  placeholder="Jolly Grant Airport, Dehradun"
                  value={formData.nearestAirport}
                  onChange={(e) => set("nearestAirport", e.target.value)}
                />
              </Field>
              <Field label="Distance from Airport">
                <Input
                  placeholder="35 km"
                  value={formData.airportDistance}
                  onChange={(e) => set("airportDistance", e.target.value)}
                />
              </Field>
              <Field label="Nearest Bus Stand">
                <Input
                  placeholder="Rishikesh Bus Depot"
                  value={formData.busStand}
                  onChange={(e) => set("busStand", e.target.value)}
                />
              </Field>
              <Field label="Distance from Bus Stand">
                <Input
                  placeholder="1.5 km"
                  value={formData.busDistance}
                  onChange={(e) => set("busDistance", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              <Toggle
                label="Auto-Rickshaw Available Nearby"
                checked={formData.autoRickshaw}
                onChange={() => set("autoRickshaw", !formData.autoRickshaw)}
              />
              <Toggle
                label="Taxi / Cab Service Available"
                checked={formData.taxiAvailable}
                onChange={() => set("taxiAvailable", !formData.taxiAvailable)}
              />
              <Toggle
                label="Parking Available on Premises"
                checked={formData.parkingAvailable}
                onChange={() =>
                  set("parkingAvailable", !formData.parkingAvailable)
                }
              />
            </div>
          </div>
        );

      // ── Step 17: Verification Documents ────────────────────────────────────
      case 16:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<FileCheck size={22} />}
              title="Verification Documents"
              subtitle="Upload verification documents for review by the District Officer."
            />
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-500 flex items-start gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                Physical verification by a Tirvona District Inspector is
                required after submission. Upload clear PDF or image copies of
                each required document.
              </p>
            </div>
            <Field
              label="Trust Deed Document"
              hint="Scanned copy of the registered trust deed"
            >
              <FileUploader folder="ashram-documents" accept="image/*,.pdf,application/pdf" label="Upload trust deed" currentUrl={formData.trustDeedUrl} onUploaded={(url) => set("trustDeedUrl", url)} />
            </Field>
            <Field
              label="Fire Safety Certificate"
              hint="Latest fire safety audit certificate"
            >
              <FileUploader folder="ashram-documents" accept="image/*,.pdf,application/pdf" label="Upload fire safety certificate" currentUrl={formData.fireSafetyCertUrl} onUploaded={(url) => set("fireSafetyCertUrl", url)} />
            </Field>
            <Field
              label="Land Ownership / Lease Document"
              hint="Registry or lease certificate for the property"
            >
              <FileUploader folder="ashram-documents" accept="image/*,.pdf,application/pdf" label="Upload ownership or lease document" currentUrl={formData.landOwnershipUrl} onUploaded={(url) => set("landOwnershipUrl", url)} />
            </Field>
            <Field
              label="Additional Notes for Verification Team"
              hint="Any context or caveats about the documents"
            >
              <Textarea
                rows={4}
                placeholder="The trust deed was renewed in 2023. The old deed (1998) is also available upon request. The fire safety certificate is under renewal — new certificate expected by Dec 2026."
                value={formData.uploadNotes}
                onChange={(e) => set("uploadNotes", e.target.value)}
              />
            </Field>
          </div>
        );

      // ── Step 18: Google Maps ────────────────────────────────────────────────
      case 17:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Map size={22} />}
              title="Map Location"
              subtitle="Click the map or drag the pin to set the exact entrance. Coordinates update automatically."
            />

            {/* Interactive OpenStreetMap picker.
                Replaces the previous Google Maps `output=embed` iframe, which
                was read-only — an owner could preview a position but not set
                one, and had to type coordinates by hand in Step 3. This is
                editable, needs no API key, and writes straight back into the
                same `lat`/`lng` form fields, so the submit payload is unchanged. */}
            <div className="space-y-4">
              <TirvonaMap
                height="384px"
                zoom={formData.lat && formData.lng ? 16 : 5}
                center={
                  formData.lat && formData.lng
                    ? [parseFloat(formData.lat), parseFloat(formData.lng)]
                    : [22.5937, 78.9629] // Centre of India, until a pin is placed
                }
                draggableMarker
                ariaLabel="Pick the ashram location on the map"
                markers={
                  formData.lat && formData.lng
                    ? [
                        {
                          id: "ashram-pin",
                          latitude: parseFloat(formData.lat),
                          longitude: parseFloat(formData.lng),
                          title: formData.name || "Ashram location",
                          subtitle: "Drag to adjust",
                        },
                      ]
                    : []
                }
                onMapClick={(lat, lng) => {
                  set("lat", lat.toFixed(6));
                  set("lng", lng.toFixed(6));
                }}
                onMarkerDrag={(lat, lng) => {
                  set("lat", lat.toFixed(6));
                  set("lng", lng.toFixed(6));
                }}
              />

              {formData.lat && formData.lng ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 p-4 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-gray-400">
                      Coordinates
                    </span>
                    <p className="text-sm font-extrabold text-[#0B192C] dark:text-white">
                      {formData.lat}° N, {formData.lng}° E
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${formData.lat},${formData.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-3 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 rounded-xl text-xs font-bold hover:bg-[#0A4DA6]/15 transition-all"
                  >
                    <Map size={14} /> Verify on Google Maps
                  </a>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start gap-2.5">
                  <Map size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold text-amber-900 dark:text-amber-200">
                      No location set yet
                    </p>
                    <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300/90">
                      Click anywhere on the map to drop a pin, or enter Latitude
                      and Longitude in Step 3.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      // ── Step 19: Final Preview ──────────────────────────────────────────────
      case 18:
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={<Eye size={22} />}
              title="Final Preview"
              subtitle="This is exactly how the public Ashram Details page will appear after approval."
            />
            <div className="p-3 bg-[#0A4DA6]/5 border border-[#0A4DA6]/20 rounded-xl">
              <p className="text-xs text-[#0A4DA6] font-semibold flex items-center gap-2">
                <Eye size={12} /> Read-only preview. Go back to any previous
                step to make edits.
              </p>
            </div>

            {/* ── Preview: Title Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-gray-100 dark:border-slate-800 pb-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-[#0A4DA6] text-white text-[9px] font-extrabold rounded-full flex items-center gap-1 shadow-sm tracking-wider">
                    <ShieldCheck size={11} /> Pending Verification
                  </span>
                  <span className="text-xs text-gray-400 font-extrabold tracking-wider">
                    {formData.city}
                    {formData.state ? `, ${formData.state}` : ""}
                  </span>
                </div>
                <h2 className="text-3xl font-extrabold text-[#0B192C] dark:text-white leading-tight">
                  {formData.name || "Ashram Name"}
                </h2>
                {formData.tagline && (
                  <p className="text-sm text-gray-500 italic">
                    {formData.tagline}
                  </p>
                )}
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin size={12} className="text-[#0A4DA6]" />{" "}
                  {formData.street}
                  {formData.city ? `, ${formData.city}` : ""}
                  {formData.pincode ? ` — PIN ${formData.pincode}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 px-4 py-2.5 border border-gray-150 rounded-2xl shrink-0">
                <Star className="text-[#D4AF37] fill-[#D4AF37]" size={20} />
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">
                    New Listing
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold">
                    No reviews yet
                  </span>
                </div>
              </div>
            </div>

            {/* ── Preview: Gallery ── */}
            {(formData.coverImageUrl || formData.galleryUrls.some(Boolean)) && (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3 h-56">
                <div className="col-span-2 rounded-[20px] overflow-hidden">
                  <img
                    src={
                      formData.coverImageUrl ||
                      formData.galleryUrls.find(Boolean)
                    }
                    alt="Cover"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
                    }}
                  />
                </div>
                <div className="grid grid-rows-2 gap-3">
                  {formData.galleryUrls.slice(0, 2).map(
                    (url, i) =>
                      url && (
                        <div key={i} className="rounded-[16px] overflow-hidden">
                          <img
                            src={url}
                            alt={`Gallery ${i}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      ),
                  )}
                </div>
              </div>
            )}

            {/* ── Preview: About & History ── */}
            {(formData.description || formData.history) && (
              <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
                <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white border-b border-gray-50 dark:border-slate-850 pb-3">
                  About the Retreat
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  {formData.description}
                </p>
                {formData.history && (
                  <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2">
                    <h4 className="text-xs font-bold text-[#0A4DA6] tracking-wider">
                      Historical Significance
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed italic bg-gray-50/50 dark:bg-slate-900/10 p-4 rounded-2xl border border-dashed border-gray-100 dark:border-slate-850">
                      "{formData.history}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Preview: Amenities ── */}
            {formData.amenities.length > 0 && (
              <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
                <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white border-b border-gray-50 dark:border-slate-850 pb-3">
                  Facilities & Spiritual Activities
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {formData.amenities.map((am, i) => (
                    <span
                      key={i}
                      className="font-bold text-[9px] bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full dark:bg-slate-800 dark:text-gray-400"
                    >
                      {am}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Preview: Rooms ── */}
            {formData.rooms.length > 0 && (
              <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
                <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white border-b border-gray-50 dark:border-slate-850 pb-3">
                  Available Room Categories
                </h3>
                <div className="space-y-4">
                  {formData.rooms.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 border border-gray-100 dark:border-slate-800 rounded-[20px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                          {r.name || "Room Category"}
                        </span>
                        <span className="text-[10px] text-gray-400 block font-bold capitalize tracking-wide">
                          {r.type.replace("_", " ")} •{" "}
                          {r.acType.replace("_", " ")} • Capacity: {r.capacity}{" "}
                          Guests
                        </span>
                        {r.description && (
                          <p className="text-[10px] text-gray-500 max-w-md">
                            {r.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col sm:items-end">
                        <span className="text-xs text-gray-400 font-bold tracking-wider">
                          Bed Rate
                        </span>
                        <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">
                          {formatCurrency(r.basePrice)} / night
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Preview: Rules ── */}
            {formData.rules.length > 0 && (
              <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
                <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5 border-b border-gray-50 dark:border-slate-850 pb-3">
                  <Info size={18} className="text-[#0A4DA6]" /> Rules & Policies
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div className="space-y-3">
                    <h4 className="font-bold text-[#0A4DA6] tracking-wider text-[10px]">
                      Guidelines for Guests
                    </h4>
                    <ul className="text-gray-500 space-y-2 list-disc pl-5">
                      {formData.rules.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-[#0A4DA6] tracking-wider text-[10px]">
                      Check-in Policies
                    </h4>
                    <div className="space-y-1.5 text-gray-500">
                      <p>
                        <strong>Check-in Time:</strong> {formData.checkInTime}
                      </p>
                      <p>
                        <strong>Check-out Time:</strong> {formData.checkOutTime}
                      </p>
                      <p>
                        <strong>Min Stay:</strong> {formData.minStay} night(s)
                      </p>
                      {formData.nearbyAttractions.length > 0 && (
                        <p>
                          <strong>Nearby Attractions:</strong>{" "}
                          {formData.nearbyAttractions
                            .map((a) => a.name)
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Preview: Contact ── */}
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-4">
              <h4 className="font-extrabold text-xs text-[#0B192C] dark:text-white tracking-wider">
                Contact Ashram Trust
              </h4>
              <div className="space-y-3 text-[11px] text-gray-500">
                {formData.phone && (
                  <p className="flex items-center gap-2">
                    <Phone size={12} className="text-[#0A4DA6]" />{" "}
                    {formData.phone}
                  </p>
                )}
                {formData.email && (
                  <p className="flex items-center gap-2">
                    <Mail size={12} className="text-[#0A4DA6]" />{" "}
                    {formData.email}
                  </p>
                )}
                {formData.website && (
                  <p className="flex items-center gap-2">
                    <Globe size={12} className="text-[#0A4DA6]" />{" "}
                    {formData.website}
                  </p>
                )}
              </div>
            </div>

            {/* ── Preview: Map ──
                Read-only here (interactive={false}), so the reviewer can see the
                pin without being able to nudge it on the final confirmation step. */}
            {formData.lat && formData.lng && (
              <TirvonaMap
                height="256px"
                zoom={15}
                interactive={false}
                center={[parseFloat(formData.lat), parseFloat(formData.lng)]}
                ariaLabel="Preview of the ashram location"
                markers={[
                  {
                    id: "preview-pin",
                    latitude: parseFloat(formData.lat),
                    longitude: parseFloat(formData.lng),
                    title: formData.name || "Ashram location",
                    subtitle: [formData.city, formData.state]
                      .filter(Boolean)
                      .join(", "),
                  },
                ]}
              />
            )}
          </div>
        );

      // ── Step 20: Submit for Approval ────────────────────────────────────────
      case 19:
        if (submitSuccess) {
          return (
            <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
              <div className="w-20 h-20 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                <CheckCircle size={40} className="text-success" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-[#0B192C] dark:text-white">
                  Submitted for Approval!
                </h2>
                <p className="text-sm text-gray-500 max-w-md">
                  The Ashram listing for <strong>{formData.name}</strong> has
                  been submitted to the Tirvona verification queue. A District
                  Officer will review and conduct a physical inspection within
                  7–10 working days.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => navigate(backPath)}
                  className="px-6 py-3 bg-[#0A4DA6] text-white rounded-full font-bold text-sm hover:bg-[#0A4DA6]/90 transition-colors"
                >
                  Back to My Ashrams
                </button>
              </div>
            </div>
          );
        }

        const completedSteps = [
          { label: "Basic Information", done: !!formData.name, required: true },
          {
            label: "Trust & Registration",
            done: !!formData.trustName,
            required: true,
          },
          {
            label: "Address & GPS",
            done:
              !!formData.street &&
              !!formData.city &&
              !!formData.district &&
              !!formData.state &&
              !!formData.pincode,
            required: true,
          },
          {
            label: "Contact Information",
            done: !!formData.phone,
            required: true,
          },
          {
            label: "Verification Documents",
            done:
              !!formData.trustDeedUrl &&
              !!formData.fireSafetyCertUrl &&
              !!formData.landOwnershipUrl,
            required: true,
          },
        ];
        const requiredDone = completedSteps.filter(
          (s) => s.required && s.done,
        ).length;
        const totalRequired = completedSteps.filter((s) => s.required).length;
        const readyToSubmit = requiredDone === totalRequired;

        return (
          <div className="space-y-6">
            <SectionHeader
              icon={<Send size={22} />}
              title="Submit for Approval"
              subtitle="Final check before submitting this ashram to the Tirvona District Officer verification queue."
            />

            {/* Completion summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {completedSteps.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold ${s.done ? "bg-success/5 border-success/20 text-success" : "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-400"}`}
                >
                  {s.done ? (
                    <CheckCircle size={14} />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-40" />
                  )}
                  {s.label}
                </div>
              ))}
            </div>

            <div
              className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-3 ${readyToSubmit ? "bg-success/5 border-success/20 text-success" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30 text-amber-700"}`}
            >
              {readyToSubmit ? (
                <CheckCircle size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              {readyToSubmit
                ? `${requiredDone}/${totalRequired} required sections completed. Ready for submission.`
                : `Only ${requiredDone}/${totalRequired} required sections completed. Please fill all required fields before submitting.`}
            </div>

            {submitError && (
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-danger text-sm font-semibold flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setStep(STEPS.findIndex((s) => s.value === 18))}
                className="flex-1 py-3.5 border border-gray-200 dark:border-slate-700 rounded-full font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Eye size={16} /> View Final Preview
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !readyToSubmit}
                className={`flex-1 py-3.5 rounded-full font-extrabold text-sm flex items-center justify-center gap-2 transition-all ${
                  readyToSubmit && !submitting
                    ? "bg-[#0A4DA6] text-white hover:bg-[#0A4DA6]/90 shadow-lg shadow-[#0A4DA6]/20"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed"
                }`}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit for Approval
                  </>
                )}
              </button>
            </div>
          </div>
        );

      // ── Step 21: Save Changes (Edit Mode only) ──────────────────────────────────
      case 20:
        if (submitSuccess) {
          return (
            <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
              <div className="w-20 h-20 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                <CheckCircle size={40} className="text-success" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-[#0B192C] dark:text-white">
                  Changes Saved Successfully!
                </h2>
                <p className="text-sm text-gray-500 max-w-md">
                  The Ashram configuration details for{" "}
                  <strong>{formData.name}</strong> have been updated.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => navigate(backPath)}
                  className="px-6 py-3 bg-[#0A4DA6] text-white rounded-full font-bold text-sm hover:bg-[#0A4DA6]/90 transition-colors"
                >
                  Back to My Ashrams
                </button>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <SectionHeader
              icon={<Save size={22} />}
              title="Save Details"
              subtitle="Verify and save the configuration of your Ashram."
            />

            <p className="text-xs text-gray-500 font-medium leading-relaxed">
              Ensure you have reviewed all the changes. Once saved, these
              details will be immediately visible to pilgrims browsing the
              Tirvona application.
            </p>

            {submitError && (
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-danger text-sm font-semibold flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setStep(STEPS.findIndex((s) => s.value === 18))}
                className="flex-1 py-3.5 border border-gray-200 dark:border-slate-700 rounded-full font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Eye size={16} /> View Final Preview
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-full font-extrabold text-sm flex items-center justify-center gap-2 transition-all bg-success text-white hover:bg-success/90 shadow-lg shadow-success/20"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Progress Indicator ────────────────────────────────────────────────────

  const progressPercent = ((step + 1) / STEPS.length) * 100;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-12">
      {/* ── Page Module Banner Header ── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(backPath)}
              className="flex-shrink-0 p-2.5 rounded-2xl bg-[#0A4DA6]/10 hover:bg-[#0A4DA6]/20 transition-colors text-[#0A4DA6]"
              title="Back"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-[#0B192C] dark:text-white tracking-tight truncate">
                {formData.name || "New Ashram Listing"}
              </h1>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">
                Step {step + 1} of {STEPS.length} — {STEPS[step].label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
              <Save size={12} /> Draft Autosaved
            </span>
            <span className="text-sm font-black text-[#0A4DA6] bg-[#0A4DA6]/10 px-3.5 py-1.5 rounded-full">
              {Math.round(progressPercent)}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-4">
          <div
            className="h-full bg-gradient-to-r from-[#0A4DA6] to-[#1D6AE5] transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex gap-8">
        {/* ── Sidebar Step Navigator ── */}
        <aside className="hidden xl:block w-56 flex-shrink-0">
          <div className="sticky top-28 space-y-1 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <button
                  key={s.id}
                  onClick={() => i <= maxStep && setStep(i)}
                  disabled={i > maxStep}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[11px] font-semibold transition-all disabled:opacity-50 ${
                    isActive
                      ? "bg-[#0A4DA6] text-white shadow-sm"
                      : isDone
                        ? "text-success hover:bg-success/5"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-900"
                  }`}
                >
                  {isDone ? (
                    <Check size={12} className="flex-shrink-0" />
                  ) : (
                    <Icon size={12} className="flex-shrink-0" />
                  )}
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-grow min-w-0">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-6 md:p-8 shadow-sm">
            {renderStep()}
          </div>

          {/* ── Navigation Controls ── */}
          <div className="flex justify-between items-center mt-6 pt-4">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm border transition-all ${
                step === 0
                  ? "opacity-0 cursor-default"
                  : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
              }`}
            >
              <ChevronLeft size={16} /> Previous
            </button>

            {/* Mobile step indicator */}
            <span className="xl:hidden text-xs font-bold text-gray-400">
              {step + 1} / {STEPS.length}
            </span>

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 bg-[#0A4DA6] text-white rounded-full font-bold text-sm hover:bg-[#0A4DA6]/90 shadow-md shadow-[#0A4DA6]/20 transition-all"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-8 py-3 bg-[#0A4DA6] text-white rounded-full font-extrabold text-sm hover:bg-[#0A4DA6]/90 shadow-lg shadow-[#0A4DA6]/20 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  editId ? (
                    "Saving…"
                  ) : (
                    "Submitting…"
                  )
                ) : editId ? (
                  <>
                    <Save size={16} /> Save Changes
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit for Approval
                  </>
                )}
              </button>
            )}
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Step Scroller ── */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0B192C] border-t border-gray-100 dark:border-slate-800 px-4 py-2 z-20 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max mx-auto">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isDone = i < step;
            return (
              <button
                key={s.id}
                onClick={() => i <= maxStep && setStep(i)}
                disabled={i > maxStep}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all disabled:opacity-55 ${
                  isActive
                    ? "bg-[#0A4DA6] text-white"
                    : isDone
                      ? "bg-success/10 text-success"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                }`}
              >
                {isDone ? "✓" : s.id}. {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom padding for mobile sticky bar */}
      <div className="xl:hidden h-16" />
    </div>
  );
};

export default AddAshramWizardPage;
