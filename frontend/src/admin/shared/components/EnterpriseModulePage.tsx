import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import EnterpriseDataTable, { type TableColumn } from "./EnterpriseDataTable";
import ImageGalleryManager from "./ImageGalleryManager";
import { RecordFieldList } from "./RecordValue";
import LocalHubEnterpriseDrawer from "./LocalHubEnterpriseDrawer";
import { useNotifications } from "../../../contexts/NotificationContext";
import api, { getErrorMessage } from "../../../lib/api";
import { humanizeLabel } from "../../../utils/labels";
import {
  Image,
  Tag as TagIcon,
  Compass,
  Building,
  Calendar,
  Users,
  ShieldCheck,
  X,
  Plus,
  Sparkles,
  XCircle,
  CheckCircle,
  Key,
  Car,
} from "lucide-react";

interface CmsRequest {
  _id: string;
  page: string;
  section: string;
  title: string;
  oldValue: any;
  newValue: any;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  userId?: { name: string; email: string; phone: string; role: string };
}

export const EnterpriseModulePage: React.FC<{
  moduleName?: string;
  defaultColumns?: TableColumn[];
}> = ({ moduleName, defaultColumns }) => {
  const params = useParams<{ moduleKey?: string; subKey?: string }>();
  const activeModule = moduleName || params.moduleKey || "users";
  const activeSubKey = params.subKey || "";

  const { addNotification } = useNotifications();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isCredentialsListOpen, setIsCredentialsListOpen] = useState(true);

  // Pending CMS Approval Requests State
  const [pendingCmsRequests, setPendingCmsRequests] = useState<CmsRequest[]>(
    [],
  );
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Form Modal State for Specific Module Editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Local Hub 7-Section Enterprise Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [managingItem, setManagingItem] = useState<any | null>(null);

  // Underscores are separators too — module keys arrive as `parking_partners`
  // and `institution_contacts`, which rendered with the underscore intact.
  const formatTitle = (str: string) =>
    str
      .replace(/[-_]/g, " ")
      .replace(/([A-Z])/g, " $1")
      .replace(/\s+/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();

  const title = `${formatTitle(activeModule)}${activeSubKey ? ` — ${formatTitle(activeSubKey)}` : ""}`;

  useEffect(() => {
    fetchModuleData();
    if (activeModule === "banner") {
      fetchPendingCmsRequests();
    }
  }, [activeModule, activeSubKey]);

  const fetchPendingCmsRequests = async () => {
    try {
      const res = await api.get("/cms/pending-approvals");
      if (res.data?.success) {
        setPendingCmsRequests(res.data.data);
      }
    } catch (err) {
      console.warn("Fetch CMS pending error:", err);
    }
  };

  const handleApproveCms = async (id: string) => {
    try {
      const res = await api.post(`/cms/approve/${id}`, {});
      if (res.data?.success) {
        addNotification(
          "CMS Content Approved",
          "The proposed banner/content is now published live!",
          "success",
        );
        fetchPendingCmsRequests();
        fetchModuleData();
      }
    } catch (err) {
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not approve CMS content edit."),
        "error",
      );
    }
  };

  const handleRejectCms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionModalId) return;

    try {
      const res = await api.post(`/cms/reject/${rejectionModalId}`, {
        reason: rejectionReason,
      });
      if (res.data?.success) {
        addNotification(
          "Request Rejected",
          "Feedback has been sent back to BannerBoy.",
          "warning",
        );
        setRejectionModalId(null);
        setRejectionReason("");
        fetchPendingCmsRequests();
      }
    } catch (err) {
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not reject CMS request."),
        "error",
      );
    }
  };

  const handleDeleteCms = async (id: string) => {
    try {
      const res = await api.delete(`/cms/request/${id}`);
      if (res.data?.success) {
        addNotification(
          "Deleted & Reverted",
          "Request removed. Reverted to default system image & text.",
          "info",
        );
        fetchPendingCmsRequests();
      }
    } catch (err) {
      addNotification(
        "Delete Failed",
        getErrorMessage(err, "Could not delete request."),
        "error",
      );
    }
  };

  const fetchModuleData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      // Must go through the shared `api` client: /admin/crud is authenticated,
      // and raw axios sends no Authorization header (it would 401).
      const endpoint =
        activeModule === "bookings" && activeSubKey === "refunds"
          ? "/booking-finance/refunds"
          : `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;
      const res = await api.get(endpoint);
      if (res.data?.success) {
        setData(res.data.data || []);
      } else {
        setData([]);
        setLoadError("The API returned an invalid response.");
      }
    } catch (err) {
      console.warn(`API load for ${activeModule}:`, err);
      setData([]);
      setLoadError(
        getErrorMessage(
          err,
          `Unable to load ${formatTitle(activeModule)} data.`,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  // Tables the console shows but must never write. Parking bookings drive slot
  // occupancy and QR validity, commissions and transactions are written by the
  // settlement run, scan logs are an audit trail, and a staff grant carries
  // authorisation rules that a plain field update would bypass — all of them
  // change through /parking/admin, which enforces the transition.
  const READ_ONLY_MODULES = new Set([
    "parking_bookings",
    "parking_commissions",
    "parking_transactions",
    "parking_scan_logs",
    "parking_staff",
  ]);
  const isReadOnlyFinance =
    (activeModule === "bookings" && activeSubKey === "refunds") ||
    READ_ONLY_MODULES.has(activeModule);

  // Custom Form & Column Definitions per Feature Area
  const getModuleConfig = () => {
    switch (activeModule) {
      case "banner":
        return {
          icon: <Image size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "title", label: "Banner Title" },
            { key: "category", label: "Placement Category" },
            { key: "deviceType", label: "Device Target" },
            { key: "priorityOrder", label: "Priority" },
            { key: "status", label: "Approval Status" },
          ],
          fields: [
            {
              name: "title",
              label: "Banner Title",
              type: "text",
              required: true,
            },
            { name: "subtitle", label: "Subtitle / Caption", type: "text" },
            {
              name: "category",
              label: "Placement Category",
              type: "select",
              options: [
                "homepage",
                "hero_slider",
                "offers",
                "blog",
                "marketplace",
                "destination",
                "festival",
                "mobile",
                "desktop",
              ],
            },
            { name: "targetUrl", label: "Target Action Link", type: "text" },
            {
              name: "priorityOrder",
              label: "Display Order Priority",
              type: "number",
            },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                "active",
                "pending",
                "approved",
                "rejected",
                "scheduled",
              ],
            },
          ],
        };

      case "users":
      case "pilgrims":
      case "owners":
      case "staff":
        return {
          icon: <Users size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "name", label: "Full Name" },
            { key: "email", label: "Email Address" },
            { key: "phone", label: "Phone Number" },
            { key: "role", label: "User Role" },
          ],
          fields: [
            { name: "name", label: "Full Name", type: "text", required: true },
            {
              name: "email",
              label: "Email Address",
              type: "email",
              required: true,
            },
            { name: "phone", label: "Phone Number", type: "text" },
            {
              name: "role",
              label: "Role",
              type: "select",
              options: [
                "customer",
                "owner",
                "manager",
                "reception",
                "housekeeping",
                "banner_manager",
                "super_admin",
              ],
            },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: ["active", "suspended", "pending", "inactive"],
            },
          ],
        };

      case "ashrams":
        return {
          icon: <Building size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "name", label: "Ashram Name" },
            {
              key: "city",
              label: "Location City",
              render: (_: any, item: any) =>
                item.address?.city || item.city || "N/A",
            },
            {
              key: "rating",
              label: "Overall Rating",
              render: (val: any) => `⭐ ${val || 4.8}`,
            },
            {
              key: "isVerified",
              label: "Verification",
              render: (val: any) => (val ? "Verified" : "Unverified"),
            },
            { key: "status", label: "Status" },
          ],
          fields: [
            {
              name: "name",
              label: "Ashram Name",
              type: "text",
              required: true,
            },
            { name: "email", label: "Contact Email", type: "email" },
            { name: "phone", label: "Contact Phone", type: "text" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: ["approved", "pending", "rejected", "archived"],
            },
          ],
        };

      case "local":
        return {
          icon: <Compass size={20} className="text-[#0A4DA6]" />,
          columns: [
            {
              key: "image",
              label: "Image",
              render: (val: any) => (
                <div className="w-12 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800 bg-slate-900 shrink-0">
                  <img
                    src={
                      val ||
                      "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80"
                    }
                    alt="Service Thumbnail"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80";
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>
              ),
            },
            { key: "title", label: "Service / Provider Title" },
            { key: "city", label: "City" },
            { key: "category", label: "Category" },
            { key: "price", label: "Price / Fare" },
            { key: "phone", label: "Contact Phone" },
            { key: "badge", label: "Badge" },
            { key: "status", label: "Status" },
          ],
          fields: [
            {
              name: "title",
              label: "Service Title",
              type: "text",
              required: true,
            },
            {
              name: "city",
              label: "City",
              type: "select",
              options: [
                "Varanasi",
                "Haridwar",
                "Rishikesh",
                "Ayodhya",
                "Kedarnath",
                "Ujjain",
                "Puri",
              ],
            },
            {
              name: "category",
              label: "Service Category",
              type: "select",
              options: [
                "transport",
                "guides",
                "food",
                "medical",
                "emergency",
                "shops",
                "photography",
                "stays",
                "events",
              ],
            },
            {
              name: "price",
              label: "Price / Fare (e.g. ₹400 / transfer)",
              type: "text",
            },
            { name: "phone", label: "Contact Phone Number", type: "text" },
            {
              name: "location",
              label: "Specific Location / Landmark",
              type: "text",
              required: true,
            },
            {
              name: "badge",
              label: "Verification Badge (e.g. VERIFIED OPERATOR)",
              type: "text",
            },
            { name: "rating", label: "Rating (1.0 - 5.0)", type: "number" },
            {
              name: "description",
              label: "Service Description",
              type: "textarea",
              required: true,
            },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: ["active", "draft"],
            },
          ],
        };

      case "volunteer":
      case "volunteer_jobs":
      case "volunteer_applications":
        return {
          icon: <Sparkles size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "title", label: "Position / Seva Title" },
            { key: "department", label: "Department" },
            { key: "openingsCount", label: "Openings" },
            { key: "stipend", label: "Stipend / Support" },
            { key: "status", label: "Status" },
          ],
          fields: [
            {
              name: "title",
              label: "Position Title",
              type: "text",
              required: true,
            },
            {
              name: "department",
              label: "Department",
              type: "text",
              required: true,
            },
            { name: "openingsCount", label: "Openings Count", type: "number" },
            { name: "stipend", label: "Stipend", type: "text" },
            { name: "description", label: "Description", type: "textarea" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: ["active", "closed", "draft"],
            },
          ],
        };

      // ── Parking ────────────────────────────────────────────────────────────
      // The console lists and searches these; partner approval, commission
      // settlement, and refunds live in the Parking Control Center because
      // they are workflow transitions, not field edits.
      case "parking_partners":
        return {
          icon: <Car size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "businessName", label: "Business Name" },
            { key: "partnerCode", label: "Partner Code" },
            { key: "contactPhone", label: "Contact Phone" },
            {
              key: "city",
              label: "City",
              render: (_: any, item: any) => item.address?.city || "—",
            },
            {
              key: "commissionPercent",
              label: "Commission",
              render: (v: any) => (v == null ? "Platform default" : `${v}%`),
            },
            { key: "status", label: "Status" },
          ],
          // `status` is deliberately absent: approving a partner cascades to
          // every location it owns, so it goes through the Control Center.
          fields: [
            {
              name: "businessName",
              label: "Business Name",
              type: "text",
              required: true,
            },
            { name: "contactPerson", label: "Contact Person", type: "text" },
            { name: "contactEmail", label: "Contact Email", type: "email" },
            { name: "contactPhone", label: "Contact Phone", type: "text" },
            { name: "gstNumber", label: "GST Number", type: "text" },
            { name: "panNumber", label: "PAN Number", type: "text" },
            { name: "notes", label: "Internal Notes", type: "textarea" },
          ],
        };

      case "parking_locations":
        return {
          icon: <Car size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "name", label: "Parking Name" },
            {
              key: "partnerId",
              label: "Partner",
              render: (v: any) => v?.businessName || "—",
            },
            {
              key: "city",
              label: "City",
              render: (_: any, item: any) => item.address?.city || "—",
            },
            { key: "totalCapacity", label: "Capacity" },
            {
              key: "rating",
              label: "Rating",
              render: (v: any) => `⭐ ${v?.average ?? 0}`,
            },
            { key: "status", label: "Status" },
          ],
          fields: [
            {
              name: "name",
              label: "Parking Name",
              type: "text",
              required: true,
            },
            { name: "description", label: "Description", type: "textarea" },
            { name: "contactPhone", label: "Contact Phone", type: "text" },
            { name: "totalCapacity", label: "Total Capacity", type: "number" },
            { name: "instructions", label: "Entry Instructions", type: "textarea" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: ["draft", "pending", "active", "inactive", "suspended"],
            },
          ],
        };

      case "parking_bookings":
        return {
          icon: <Car size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "bookingReference", label: "Reference" },
            { key: "vehicleNumber", label: "Vehicle" },
            { key: "vehicleType", label: "Type" },
            {
              key: "locationId",
              label: "Parking",
              render: (v: any) => v?.name || "—",
            },
            {
              key: "entryAt",
              label: "Entry",
              render: (v: any) =>
                v ? new Date(v).toLocaleString("en-IN") : "—",
            },
            {
              key: "pricing",
              label: "Amount",
              render: (v: any) => `₹${v?.totalAmount ?? 0}`,
            },
            { key: "paymentStatus", label: "Payment" },
            { key: "status", label: "Status" },
          ],
          fields: [],
        };

      case "parking_slot_types":
        return {
          icon: <Car size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "name", label: "Slot Type" },
            { key: "code", label: "Code" },
            {
              key: "locationId",
              label: "Parking",
              render: (v: any) => v?.name || "—",
            },
            { key: "totalCapacity", label: "Capacity" },
            {
              key: "vehicleTypes",
              label: "Vehicles",
              render: (v: any) => (Array.isArray(v) ? v.join(", ") : "—"),
            },
            {
              key: "isActive",
              label: "Active",
              render: (v: any) => (v === false ? "No" : "Yes"),
            },
          ],
          fields: [
            { name: "name", label: "Slot Type", type: "text", required: true },
            { name: "code", label: "Code", type: "text" },
            {
              name: "totalCapacity",
              label: "Total Capacity",
              type: "number",
              required: true,
            },
            { name: "floorLabel", label: "Floor Label", type: "text" },
            { name: "displayOrder", label: "Display Order", type: "number" },
            { name: "description", label: "Description", type: "textarea" },
          ],
        };

      case "parking_slots":
        return {
          icon: <Car size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "slotNumber", label: "Slot Number" },
            {
              key: "locationId",
              label: "Parking",
              render: (v: any) => v?.name || "—",
            },
            {
              key: "slotTypeId",
              label: "Slot Type",
              render: (v: any) => v?.name || "—",
            },
            { key: "floorLabel", label: "Floor" },
            { key: "zone", label: "Zone" },
            { key: "status", label: "Status" },
          ],
          fields: [
            {
              name: "slotNumber",
              label: "Slot Number",
              type: "text",
              required: true,
            },
            { name: "floorLabel", label: "Floor Label", type: "text" },
            { name: "zone", label: "Zone", type: "text" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                "available",
                "occupied",
                "reserved",
                "maintenance",
                "blocked",
              ],
            },
            { name: "maintenanceNote", label: "Maintenance Note", type: "textarea" },
          ],
        };

      case "parking_pricing":
        return {
          icon: <Car size={20} className="text-[#0A4DA6]" />,
          columns: [
            {
              key: "locationId",
              label: "Parking",
              render: (v: any) => v?.name || "—",
            },
            { key: "vehicleType", label: "Vehicle Type" },
            { key: "mode", label: "Mode" },
            {
              key: "baseFee",
              label: "Base Fee",
              render: (v: any) => `₹${v ?? 0}`,
            },
            {
              key: "hourlyRate",
              label: "Hourly",
              render: (v: any) => `₹${v ?? 0}`,
            },
            {
              key: "dailyRate",
              label: "Daily",
              render: (v: any) => `₹${v ?? 0}`,
            },
          ],
          fields: [
            {
              name: "mode",
              label: "Pricing Mode",
              type: "select",
              options: ["hourly", "slab", "flat_day"],
            },
            { name: "baseFee", label: "Base Fee (₹)", type: "number" },
            { name: "hourlyRate", label: "Hourly Rate (₹)", type: "number" },
            { name: "dailyRate", label: "Daily Rate (₹)", type: "number" },
            { name: "peakMultiplier", label: "Peak Multiplier", type: "number" },
            { name: "freeMinutes", label: "Free Minutes", type: "number" },
          ],
        };

      case "parking_staff":
        return {
          icon: <ShieldCheck size={20} className="text-[#0A4DA6]" />,
          columns: [
            {
              key: "userId",
              label: "Staff Member",
              render: (v: any) => v?.name || v?.email || "—",
            },
            {
              key: "partnerId",
              label: "Partner",
              render: (v: any) => v?.businessName || "—",
            },
            { key: "parkingRole", label: "Parking Role" },
            {
              key: "locationIds",
              label: "Scope",
              render: (v: any) =>
                Array.isArray(v) && v.length
                  ? v.map((l: any) => l?.name || "—").join(", ")
                  : "All partner locations",
            },
            { key: "shift", label: "Shift" },
            { key: "status", label: "Status" },
          ],
          fields: [],
        };

      case "parking_commissions":
        return {
          icon: <Car size={20} className="text-[#0A4DA6]" />,
          columns: [
            {
              key: "partnerId",
              label: "Partner",
              render: (v: any) => v?.businessName || "—",
            },
            {
              key: "bookingId",
              label: "Booking",
              render: (v: any) => v?.bookingReference || "—",
            },
            {
              key: "grossAmount",
              label: "Gross",
              render: (v: any) => `₹${v ?? 0}`,
            },
            {
              key: "commissionAmount",
              label: "Commission",
              render: (v: any, item: any) =>
                `₹${v ?? 0} (${item.commissionPercent ?? 0}%)`,
            },
            {
              key: "partnerEarning",
              label: "Partner Earning",
              render: (v: any) => `₹${v ?? 0}`,
            },
            { key: "settlementStatus", label: "Settlement" },
          ],
          fields: [],
        };

      case "parking_transactions":
        return {
          icon: <Car size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "reference", label: "Reference" },
            { key: "type", label: "Type" },
            { key: "direction", label: "Direction" },
            {
              key: "amount",
              label: "Amount",
              render: (v: any) => `₹${v ?? 0}`,
            },
            {
              key: "partnerId",
              label: "Partner",
              render: (v: any) => v?.businessName || "—",
            },
            {
              key: "occurredAt",
              label: "Occurred",
              render: (v: any) =>
                v ? new Date(v).toLocaleString("en-IN") : "—",
            },
          ],
          fields: [],
        };

      case "parking_scan_logs":
        return {
          icon: <ShieldCheck size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "action", label: "Action" },
            { key: "result", label: "Result" },
            { key: "vehicleNumber", label: "Vehicle" },
            {
              key: "locationId",
              label: "Parking",
              render: (v: any) => v?.name || "—",
            },
            {
              key: "scannedByUserId",
              label: "Scanned By",
              render: (v: any) => v?.name || "—",
            },
            {
              key: "scannedAt",
              label: "Scanned At",
              render: (v: any) =>
                v ? new Date(v).toLocaleString("en-IN") : "—",
            },
          ],
          fields: [],
        };

      case "parking_reviews":
        return {
          icon: <Car size={20} className="text-[#0A4DA6]" />,
          columns: [
            {
              key: "locationId",
              label: "Parking",
              render: (v: any) => v?.name || "—",
            },
            {
              key: "customerId",
              label: "Reviewer",
              render: (v: any) => v?.name || "—",
            },
            {
              key: "rating",
              label: "Rating",
              render: (v: any) => `⭐ ${v?.overall ?? 0}`,
            },
            { key: "comment", label: "Comment" },
            { key: "status", label: "Moderation" },
          ],
          fields: [
            {
              name: "status",
              label: "Moderation Status",
              type: "select",
              options: ["pending", "approved", "rejected"],
            },
            {
              name: "moderationNote",
              label: "Moderation Note",
              type: "textarea",
            },
          ],
        };

      default:
        return {
          icon: <Building size={20} className="text-[#0A4DA6]" />,
          columns: defaultColumns || [
            {
              key: "name",
              label: "Record Name / Title",
              render: (v: any, item: any) =>
                v || item.title || item.bookingId || item._id,
            },
            {
              key: "category",
              label: "Category / Tag",
              render: (v: any, item: any) =>
                v || item.department || item.type || "General",
            },
            {
              key: "owner",
              label: "Managed By",
              render: (v: any, item: any) =>
                v || item.customerId?.name || "System Admin",
            },
            {
              key: "status",
              label: "Status",
              render: (v: any) => v || "active",
            },
          ],
          fields: [
            {
              name: "name",
              label: "Record Name",
              type: "text",
              required: true,
            },
            { name: "title", label: "Title / Subject", type: "text" },
            { name: "category", label: "Category", type: "text" },
            { name: "details", label: "Description", type: "textarea" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                "active",
                "pending",
                "approved",
                "rejected",
                "archived",
              ],
            },
          ],
        };
    }
  };

  const moduleConfig = getModuleConfig();

  const handleEditOpen = (item: any) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleCreateOpen = () => {
    setEditingItem(null);
    setFormData({});
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        image:
          formData.image ||
          formData.coverImage ||
          formData.imageUrl ||
          "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80",
        imageUrl:
          formData.image ||
          formData.coverImage ||
          formData.imageUrl ||
          "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80",
      };
      const endpoint = `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;
      await api.post(endpoint, payload);
      addNotification(
        "Saved Successfully",
        `Record updated in ${title}.`,
        "success",
      );
      setIsModalOpen(false);
      fetchModuleData();
    } catch (err) {
      addNotification(
        "Save Failed",
        getErrorMessage(err, `Could not save this ${title} record.`),
        "error",
      );
    }
  };

  // The sub-key decides which collection a record lives in (blogs/authors,
  // marketplace/orders …), so a delete has to carry it too.
  const crudDeletePath = (id: string) =>
    `/admin/crud/${activeModule}/${id}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;

  const handleDelete = async (id: string) => {
    try {
      await api.delete(crudDeletePath(id));
      addNotification("Deleted", "Record removed.", "info");
      setData((prev) => prev.filter((x) => (x._id || x.id) !== id));
    } catch (err) {
      addNotification(
        "Delete Failed",
        getErrorMessage(err, "Could not remove this record."),
        "error",
      );
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => api.delete(crudDeletePath(id))));
      addNotification(
        "Bulk Delete Complete",
        `${ids.length} records removed.`,
        "info",
      );
      fetchModuleData();
    } catch (err) {
      addNotification(
        "Bulk Delete Error",
        getErrorMessage(err, "Could not remove selected records."),
        "error",
      );
    }
  };

  const handleBulkApprove = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map((id) => {
          const item = data.find((d) => (d._id || d.id) === id);
          if (!item) return Promise.resolve();
          return api.post(
            `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`,
            {
              ...item,
              status: "approved",
              isVerified: true,
            },
          );
        }),
      );
      addNotification(
        "Bulk Approval Complete",
        `${ids.length} records approved.`,
        "success",
      );
      fetchModuleData();
    } catch (err) {
      addNotification(
        "Bulk Action Error",
        getErrorMessage(err, "Could not approve selected items."),
        "error",
      );
    }
  };

  const handleBulkReject = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map((id) => {
          const item = data.find((d) => (d._id || d.id) === id);
          if (!item) return Promise.resolve();
          return api.post(
            `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`,
            {
              ...item,
              status: "rejected",
              isVerified: false,
            },
          );
        }),
      );
      addNotification(
        "Bulk Rejection Complete",
        `${ids.length} records marked as rejected.`,
        "warning",
      );
      fetchModuleData();
    } catch (err) {
      addNotification(
        "Bulk Action Error",
        getErrorMessage(err, "Could not reject selected items."),
        "error",
      );
    }
  };

  const handleToggleStatus = async (item: any) => {
    try {
      const currentStatus =
        item.status || (item.isVerified ? "approved" : "pending");
      const nextStatus =
        currentStatus === "active" || currentStatus === "approved"
          ? "inactive"
          : "active";
      const nextVerified = nextStatus === "active";

      const endpoint = `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;
      await api.post(endpoint, {
        ...item,
        status: nextStatus,
        isVerified: nextVerified,
      });

      addNotification(
        "Status Updated",
        `Status changed to ${nextStatus}.`,
        "success",
      );
      fetchModuleData();
    } catch (err) {
      addNotification(
        "Update Failed",
        getErrorMessage(err, "Could not update status."),
        "error",
      );
    }
  };

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-12">
      {/* Page Module Banner Header */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#0A4DA6]/10 rounded-2xl">
            {moduleConfig.icon}
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0B192C] dark:text-white tracking-tight">
              {title}
            </h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">
              Enterprise administration, lifecycle controls, and status
              monitoring console.
            </p>
          </div>
        </div>

        <button
          onClick={handleCreateOpen}
          className="px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/25 cursor-pointer"
        >
          <Plus size={16} /> Add New Entry
        </button>
      </div>

      {/* ── Banner Management: Real-Time BannerBoy Pending Approvals Console ── */}
      {activeModule === "banner" && (
        <div className="bg-white dark:bg-[#0B192C] border border-amber-200 dark:border-amber-900/50 p-6 rounded-[28px] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                  BannerBoy CMS Pending Approvals Queue
                </h3>
                <p className="text-xs text-gray-400">
                  Review proposed banner edits submitted by BannerBoy.
                </p>
              </div>
            </div>

            <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full text-xs font-black">
              {pendingCmsRequests.length} Request
              {pendingCmsRequests.length === 1 ? "" : "s"} Pending
            </span>
          </div>

          {pendingCmsRequests.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400 font-medium">
              No pending banner change requests found.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCmsRequests.map((req) => (
                <div
                  key={req._id}
                  className="p-4 bg-amber-50/40 dark:bg-slate-900/60 border border-amber-200/60 dark:border-slate-800 rounded-2xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                        {req.title}
                      </span>
                      <div className="text-[11px] text-gray-500 flex items-center gap-2">
                        <span>
                          Submitted by:{" "}
                          <strong>{req.userId?.name || "BannerBoy"}</strong> (
                          {req.userId?.email})
                        </span>
                        <span>•</span>
                        <span>
                          Section:{" "}
                          <code className="font-bold text-amber-700 dark:text-amber-300">
                            {req.section}
                          </code>
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(req.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Side-by-Side Old vs New Preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl space-y-1">
                      <span className="text-[10px] font-extrabold text-gray-400 tracking-wider block">
                        Current Live Version (Old)
                      </span>
                      <RecordFieldList
                        data={req.oldValue}
                        emptyLabel="Default system content"
                        className="text-[11px] text-gray-600 dark:text-gray-400 overflow-y-auto max-h-32"
                      />
                    </div>

                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 tracking-wider block">
                          Proposed BannerBoy Version (New)
                        </span>
                        {req.newValue?.bannerWidth && (
                          <span className="px-2 py-0.5 bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 rounded text-[9px] font-mono font-bold">
                            {req.newValue.bannerWidth} ×{" "}
                            {req.newValue.bannerHeight} px (
                            {req.newValue.bannerSizePreset || "Custom"})
                          </span>
                        )}
                      </div>

                      {req.newValue?.bannerImage && (
                        <div className="w-full h-28 rounded-lg overflow-hidden border border-emerald-200 dark:border-emerald-800 bg-gray-100 dark:bg-slate-900">
                          <img
                            src={req.newValue.bannerImage}
                            alt="Proposed Banner"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <RecordFieldList
                        data={req.newValue}
                        emptyLabel="No changes proposed"
                        className="text-[11px] text-emerald-900 dark:text-emerald-200 overflow-y-auto max-h-32"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setRejectionModalId(req._id);
                        setRejectionReason("");
                      }}
                      className="px-4 py-2 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <XCircle size={14} /> Reject & Request Changes
                    </button>

                    <button
                      onClick={() => handleApproveCms(req._id)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1"
                    >
                      <ShieldCheck size={14} /> Approve & Publish Live
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModalId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRejectCms}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <h3 className="font-extrabold text-base text-rose-600 flex items-center gap-2">
              <XCircle size={18} /> Reject Proposed Content Change
            </h3>
            <div className="space-y-1 text-xs">
              <label className="font-bold text-gray-700 dark:text-gray-300">
                Feedback / Reason for Rejection *
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Please update hero image resolution and revise discount details..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectionModalId(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-rose-600 text-white rounded-full font-extrabold text-xs shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* All Ashram Owners Master Credentials Toolbar */}
      {(activeModule === "owners" || activeSubKey === "owners") && (
        <div className="bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-slate-900 dark:to-slate-900 border border-amber-200/80 dark:border-amber-900/40 p-5 rounded-[24px] shadow-sm mb-6 text-left space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-2xl border border-amber-500/20">
                <Key size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#0B192C] dark:text-white flex items-center gap-2">
                  Ashram Owner Account Directory
                </h4>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  Passwords are securely hashed and are never displayed.{" "}
                  <code className="bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded text-amber-700 font-mono font-bold">
                    Protected
                  </code>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCredentialsListOpen(!isCredentialsListOpen)}
              className="px-4 py-2 bg-[#0A4DA6] hover:bg-blue-700 text-white rounded-full text-xs font-black shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck size={14} />{" "}
              {isCredentialsListOpen
                ? "Hide Account Directory"
                : "Show Account Directory"}
            </button>
          </div>

          {/* Expandable Master Credentials Directory Table */}
          {isCredentialsListOpen && (
            <div className="pt-3 border-t border-amber-200/60 dark:border-slate-800 animate-in fade-in duration-200">
              {/* overflow-x-auto matters as much as -y here: the credentials
                  table has more columns than fit a phone, and without it the
                  whole page scrolls sideways instead of just the table. */}
              <div className="max-h-[320px] overflow-y-auto overflow-x-auto rounded-2xl border border-amber-200/50 dark:border-slate-800 bg-white dark:bg-[#0B192C] shadow-inner">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-amber-50/80 dark:bg-slate-900 border-b border-amber-100 dark:border-slate-800 text-[10px] font-black text-amber-800 dark:text-amber-400 sticky top-0 backdrop-blur-md">
                    <tr>
                      <th className="py-3 px-4">Ashram / Owner Name</th>
                      <th className="py-3 px-4">Login Email Address</th>
                      <th className="py-3 px-4">Password</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-bold">
                    {data.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-6 text-center text-gray-400"
                        >
                          No owner accounts loaded.
                        </td>
                      </tr>
                    ) : (
                      data.map((item) => (
                        <tr
                          key={item._id || item.email}
                          className="hover:bg-amber-50/40 dark:hover:bg-slate-900/50 transition-colors"
                        >
                          <td className="py-2.5 px-4 text-[#0B192C] dark:text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {item.name || "Ashram Trustee"}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-blue-600 dark:text-blue-400">
                            {item.email}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-amber-600 dark:text-amber-400">
                            Protected
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `Email: ${item.email}`,
                                );
                                addNotification(
                                  "Email Copied",
                                  `Copied login email for ${item.name || item.email}`,
                                  "success",
                                );
                              }}
                              className="px-3 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 rounded-full text-[10px] font-black cursor-pointer transition-colors"
                            >
                              Copy Email
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Module Table Data */}
      {loadError && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          {loadError}
        </div>
      )}
      <EnterpriseDataTable
        title={title}
        columns={moduleConfig.columns}
        data={data}
        loading={loading}
        onSave={isReadOnlyFinance ? undefined : (item) => handleEditOpen(item)}
        onManage={
          activeModule === "local"
            ? (item) => {
                setManagingItem(item);
                setIsDrawerOpen(true);
              }
            : undefined
        }
        onDelete={isReadOnlyFinance ? undefined : (id) => handleDelete(id)}
        onBulkDelete={
          isReadOnlyFinance ? undefined : (ids) => handleBulkDelete(ids)
        }
        onBulkApprove={
          isReadOnlyFinance ? undefined : (ids) => handleBulkApprove(ids)
        }
        onBulkReject={
          isReadOnlyFinance ? undefined : (ids) => handleBulkReject(ids)
        }
        onToggleStatus={
          isReadOnlyFinance ? undefined : (item) => handleToggleStatus(item)
        }
      />

      {/* Local Hub 7-Section Full Enterprise Manager Drawer */}
      <LocalHubEnterpriseDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        item={managingItem}
        categoryKey={activeSubKey || "transport"}
        onSave={async (updatedData) => {
          const endpoint = `/admin/crud/local${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;
          await api.post(endpoint, updatedData);
          addNotification(
            "MongoDB Updated Live",
            `Saved changes for ${updatedData.title || "Local Service"} to database.`,
            "success",
          );
          setIsDrawerOpen(false);
          fetchModuleData();
        }}
      />

      {/* Dedicated Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-lg w-full rounded-[28px] p-6 space-y-5 text-left shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                {editingItem ? `Edit ${title}` : `Create ${title}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1 text-xs">
              {/* Universal Image Gallery & Upload Manager */}
              <ImageGalleryManager
                coverImage={
                  formData.image ||
                  formData.coverImage ||
                  formData.imageUrl ||
                  ""
                }
                onCoverImageChange={(url) => {
                  setFormData((prev) => ({
                    ...prev,
                    image: url,
                    coverImage: url,
                    imageUrl: url,
                  }));
                }}
                gallery={
                  Array.isArray(formData.gallery)
                    ? formData.gallery
                    : Array.isArray(formData.images)
                      ? formData.images
                      : []
                }
                onGalleryChange={(urls) => {
                  setFormData((prev) => ({
                    ...prev,
                    gallery: urls,
                    images: urls,
                  }));
                }}
                label={`${title} Image & Gallery Manager`}
              />

              {moduleConfig.fields.map((f) => (
                <div key={f.name} className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    {f.label}{" "}
                    {f.required && <span className="text-rose-500">*</span>}
                  </label>

                  {f.type === "select" ? (
                    <select
                      value={
                        formData[f.name] || (f.options ? f.options[0] : "")
                      }
                      onChange={(e) =>
                        setFormData({ ...formData, [f.name]: e.target.value })
                      }
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#0A4DA6]"
                    >
                      {f.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {humanizeLabel(opt)}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={formData[f.name] || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, [f.name]: e.target.value })
                      }
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                    />
                  ) : (
                    <input
                      type={f.type}
                      required={f.required}
                      value={formData[f.name] || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, [f.name]: e.target.value })
                      }
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0A4DA6] text-white rounded-full font-black text-xs shadow cursor-pointer"
              >
                Save Record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default EnterpriseModulePage;
