import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EnterpriseDataTable, { type TableColumn } from "./EnterpriseDataTable";
import ImageGalleryManager from "./ImageGalleryManager";
import { RecordFieldList } from "./RecordValue";
import LocalHubEnterpriseDrawer from "./LocalHubEnterpriseDrawer";
import { EnterprisePageHeader } from "./EnterprisePageHeader";
import { useNotifications } from "../../../contexts/NotificationContext";
import api, { getErrorMessage } from "../../../lib/api";
import { roomService } from "../../../services";
import { parkingAdminService } from "../../../modules/parking/services/parking.service";
import { humanizeLabel } from "../../../utils/labels";
import { formatCurrency, getFormattingLocale } from "../../../utils/format";
import { formatInline } from "../utils/recordFormat";
import {
  Image,
  Tag as TagIcon,
  Compass,
  Building,
  Calendar,
  Users,
  ShieldCheck,
  X,
  XCircle,
  CheckCircle,
  Car,
  Download,
  Printer,
  Sparkles,
  Plus,
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
  const navigate = useNavigate();
  const activeModule = moduleName || params.moduleKey || "users";
  const activeSubKey = params.subKey || "";

  const { addNotification } = useNotifications();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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

  const pageTitles: Record<string, string> = {
    "users:pilgrims": "Pilgrim Accounts",
    "users:owners": "Ashram Owner Accounts",
    "users:content-managers": "Content Managers",
    "users:staff": "Staff Members",
    "users:roles": "Roles & Permissions",
    "institution:all": "Institution Profiles",
    "institution:trusts": "Trust & Legal Bodies",
    "institution_contacts:all": "Contacts Directory",
    "institution_locations:all": "Institution Locations & GPS",
    "institution_audits:all": "Institution Quality & Audit",
    "ashrams:all": "All Ashrams",
    "ashrams:approved": "Approved Ashrams",
    "ashrams:rejected": "Rejected Ashrams",
    "rooms:all": "Room Categories",
    "rooms:availability": "Room Availability",
    "rooms:pricing": "Room Pricing",
    "rooms:inventory": "Room Inventory",
    "bookings:all": "All Bookings",
    "bookings:pending": "Pending Bookings",
    "bookings:confirmed": "Confirmed Bookings",
    "bookings:checked_in": "Checked-in Stays",
    "bookings:checked_out": "Checked-out Stays",
    "bookings:completed": "Completed Stays",
    "bookings:cancelled": "Cancelled Bookings",
    "bookings:expired": "Expired Bookings",
    "bookings:no_show": "No-show Bookings",
    "bookings:refunded": "Refunded Bookings",
    "bookings:refunds": "Booking Refund Requests",
    "offers:all": "All Offers",
    "offers:featured": "Featured Offers",
    "blogs:all": "All Blogs",
    "blogs:categories": "Blog Categories",
    "blogs:authors": "Author Approvals",
    "planner:circuits": "Spiritual Circuits",
    "planner:temples": "Temple Directory",
    "planner:routes": "Yatra Routes",
    "planner:itineraries": "Itineraries",
    "planner:rituals": "Ritual Packages",
    "local:transport": "Local Transport Services",
    "local:guides": "Local Guides",
    "local:restaurants": "Restaurants",
    "local:medical": "Medical Services",
    "local:emergency": "Emergency Services",
    "local:shops": "Local Shops",
    "local:photography": "Photography Services",
    "local:events": "Local Events",
    "marketplace:products": "Marketplace Products",
    "marketplace:categories": "Marketplace Categories",
    "marketplace:vendors": "Marketplace Vendors",
    "marketplace:orders": "Marketplace Orders",
    "marketplace:waitlist": "Marketplace Waitlist",
    "marketplace:newsletter": "Marketplace Newsletter",
    "banner:homepage": "Homepage Banner Management",
    "parking_partners:all": "Parking Partners",
    "parking_partners:pending": "Pending Parking Partners",
    "parking_locations:all": "Parking Locations",
    "parking_bookings:all": "Parking Bookings",
    "parking_bookings:checked_in": "Vehicles On-Site",
    "parking_slot_types:all": "Parking Slot Types",
    "parking_slots:all": "Parking Slots",
    "parking_pricing:all": "Parking Pricing Rules",
    "parking_commissions:pending": "Pending Parking Commissions",
    "parking_transactions:all": "Parking Transactions",
    "parking_scan_logs:all": "Parking Scan Logs",
    "parking_reviews:all": "Parking Reviews",
    "reports:revenue": "Revenue Reports",
    "reports:bookings": "Booking Telemetry",
  };
  const displayTitle = pageTitles[`${activeModule}:${activeSubKey || "all"}`] || title;

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
          "Feedback has been sent back to Content Manager.",
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
          : activeModule === "bookings"
            ? `/bookings/dashboard?limit=100${activeSubKey === "refunded" ? "&paymentStatus=refunded" : activeSubKey && activeSubKey !== "all" ? `&status=${encodeURIComponent(activeSubKey)}` : ""}`
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
    "bookings",
    "parking_bookings",
    "parking_commissions",
    "parking_transactions",
    "parking_scan_logs",
    "parking_staff",
  ]);
  const isOperationalRoomView =
    activeModule === "rooms" &&
    ["availability", "inventory", "pricing", "season_pricing"].includes(
      activeSubKey,
    );
  const isReadOnlyFinance =
    (activeModule === "bookings" && activeSubKey === "refunds") ||
    READ_ONLY_MODULES.has(activeModule) ||
    isOperationalRoomView;

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
          ],
          fields: [
            {
              name: "title",
              label: "Banner Title",
              type: "text",
            },
            { name: "subtitle", label: "Subtitle / Caption", type: "text" },
            {
              name: "category",
              label: "Placement Category",
              type: "select",
              options: [
                "hero_banner",
                "destinations_banner",
                "parking_banner",
                "marketplace_banner",
                "festival_banner",
                "offer_banner",
                "announcement",
              ],
            },
            {
              name: "deviceType",
              label: "Target Device",
              type: "select",
              options: ["both", "desktop", "mobile"],
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
                item.address?.city ||
                item.address?.district ||
                item.address?.state ||
                item.city ||
                "N/A",
            },
            {
              key: "rating",
              label: "Overall Rating",
              render: (val: any) => {
                const num =
                  typeof val === "number"
                    ? val
                    : typeof val === "object" && val?.average != null
                      ? val.average
                      : 4.8;
                return `⭐ ${num}`;
              },
            },
            {
              key: "isVerified",
              label: "Verification",
              render: (val: any, item: any) =>
                val === false || val === "false" || val === "Unverified"
                  ? "Unverified"
                  : val === true ||
                    val === "true" ||
                    val === "Verified" ||
                    val === "verified" ||
                    item?.isVerified === true ||
                    item?.status === "approved" ||
                    item?.status === "active"
                    ? "Verified"
                    : "Unverified",
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
            {
              name: "city",
              label: "Location City",
              type: "text",
              required: true,
            },
            { name: "street", label: "Street Address", type: "text" },
            { name: "district", label: "District", type: "text", required: true },
            { name: "state", label: "State", type: "text", required: true },
            { name: "pincode", label: "Pincode", type: "text", required: true },
            { name: "description", label: "Description", type: "textarea" },
            {
              name: "isVerified",
              label: "Verification Status",
              type: "select",
              options: ["Verified", "Unverified"],
            },
            { name: "email", label: "Contact Email", type: "email" },
            { name: "phone", label: "Contact Phone", type: "text" },
            { name: "trustDeedUrl", label: "Trust Deed", type: "text" },
            { name: "fireSafetyCertificateUrl", label: "Fire Safety Certificate", type: "text" },
            { name: "landOwnershipUrl", label: "Land Ownership Document", type: "text" },
            { name: "uploadNotes", label: "Document Notes", type: "textarea" },
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
                  {val ? (
                    <img
                      src={val}
                      alt="Service Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : null}
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
                v ? new Date(v).toLocaleString(getFormattingLocale()) : "—",
            },
            {
              key: "pricing",
              label: "Amount",
              render: (v: any) => formatCurrency(v?.totalAmount ?? 0),
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
              render: (v: any) => formatCurrency(v ?? 0),
            },
            {
              key: "hourlyRate",
              label: "Hourly",
              render: (v: any) => formatCurrency(v ?? 0),
            },
            {
              key: "dailyRate",
              label: "Daily",
              render: (v: any) => formatCurrency(v ?? 0),
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
              render: (v: any) => formatCurrency(v ?? 0),
            },
            {
              key: "commissionAmount",
              label: "Commission",
              render: (v: any, item: any) =>
                `${formatCurrency(v ?? 0)} (${item.commissionPercent ?? 0}%)`,
            },
            {
              key: "partnerEarning",
              label: "Partner Earning",
              render: (v: any) => formatCurrency(v ?? 0),
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
              render: (v: any) => formatCurrency(v ?? 0),
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
                v ? new Date(v).toLocaleString(getFormattingLocale()) : "—",
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
                v ? new Date(v).toLocaleString(getFormattingLocale()) : "—",
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

      case "bookings":
        if (activeSubKey === "refunds") {
          return {
            icon: <Calendar size={20} className="text-[#0A4DA6]" />,
            columns: [
              { key: "refundReference", label: "Refund Reference" },
              {
                key: "bookingId",
                label: "Booking",
                render: (value: any) =>
                  value?.bookingId || value?.reservationNumber || "Booking unavailable",
              },
              {
                key: "requestedBy",
                label: "Requested By",
                render: (value: any) => value?.name || value?.email || "User unavailable",
              },
              {
                key: "amount",
                label: "Refund Amount",
                render: (value: any) => formatCurrency(Number(value) || 0),
              },
              { key: "reason", label: "Reason" },
              { key: "status", label: "Refund Status" },
            ],
            fields: [],
          };
        }
        return {
          icon: <Calendar size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "bookingId", label: "Booking ID" },
            {
              key: "customerId",
              label: "Guest",
              render: (value: any) =>
                value?.name || value?.email || value?.phone || "Guest unavailable",
            },
            {
              key: "ashramId",
              label: "Ashram",
              render: (value: any) => value?.name || "Ashram unavailable",
            },
            {
              key: "roomId",
              label: "Room Category",
              render: (value: any) => value?.name || "Room unavailable",
            },
            {
              key: "checkInDate",
              label: "Check-in",
              render: (value: any) =>
                value ? new Date(value).toLocaleDateString(getFormattingLocale()) : "—",
            },
            {
              key: "checkOutDate",
              label: "Check-out",
              render: (value: any) =>
                value ? new Date(value).toLocaleDateString(getFormattingLocale()) : "—",
            },
            { key: "paymentStatus", label: "Payment" },
            {
              key: "pricing",
              label: "Total",
              render: (value: any) =>
                formatCurrency(Number(value?.totalAmount || 0)),
            },
            { key: "status", label: "Booking Status" },
          ],
          fields: [],
        };

      case "rooms":
        if (["availability", "inventory"].includes(activeSubKey)) {
          return {
            icon: <Calendar size={20} className="text-[#0A4DA6]" />,
            columns: [
              {
                key: "ashramId",
                label: "Ashram",
                render: (value: any) => value?.name || "—",
              },
              {
                key: "roomId",
                label: "Room Category",
                render: (value: any) => value?.name || "—",
              },
              {
                key: "date",
                label: "Date",
                render: (value: any) =>
                  value ? new Date(value).toLocaleDateString(getFormattingLocale()) : "—",
              },
              { key: "totalInventory", label: "Total" },
              { key: "bookedCount", label: "Booked" },
              { key: "heldCount", label: "Held" },
              { key: "maintenanceCount", label: "Maintenance" },
              {
                key: "customPrice",
                label: "Custom Price",
                render: (value: any) =>
                  value == null ? "Base price" : formatCurrency(Number(value)),
              },
              {
                key: "isClosed",
                label: "Closed",
                render: (value: any) => (value ? "Yes" : "No"),
              },
            ],
            fields: [],
          };
        }
        if (["pricing", "season_pricing"].includes(activeSubKey)) {
          return {
            icon: <TagIcon size={20} className="text-[#0A4DA6]" />,
            columns: [
              {
                key: "ashramId",
                label: "Ashram",
                render: (value: any) => value?.name || "—",
              },
              {
                key: "roomId",
                label: "Room Category",
                render: (value: any) => value?.name || "All rooms",
              },
              { key: "name", label: "Pricing Rule" },
              {
                key: "validFrom",
                label: "Valid From",
                render: (value: any) =>
                  value ? new Date(value).toLocaleDateString(getFormattingLocale()) : "Always",
              },
              {
                key: "validUntil",
                label: "Valid Until",
                render: (value: any) =>
                  value ? new Date(value).toLocaleDateString(getFormattingLocale()) : "Always",
              },
              { key: "multiplier", label: "Multiplier" },
              {
                key: "overridePrice",
                label: "Override Price",
                render: (value: any) =>
                  value == null ? "—" : formatCurrency(Number(value)),
              },
              { key: "minStay", label: "Minimum Stay" },
              {
                key: "isActive",
                label: "Active",
                render: (value: any) => (value === false ? "No" : "Yes"),
              },
            ],
            fields: [],
          };
        }
        return {
          icon: <Building size={20} className="text-[#0A4DA6]" />,
          columns: [
            {
              key: "ashramId",
              label: "Ashram",
              render: (value: any) => value?.name || "Ashram unavailable",
            },
            { key: "name", label: "Room Category" },
            { key: "type", label: "Stay Type" },
            { key: "acType", label: "AC / Ventilation" },
            { key: "capacity", label: "Capacity" },
            { key: "totalInventory", label: "Total Units" },
            {
              key: "basePrice",
              label: "Base Price",
              render: (value: any) => formatCurrency(Number(value) || 0),
            },
            { key: "status", label: "Status" },
          ],
          fields: [
            { name: "name", label: "Room Category Name", type: "text", required: true },
            {
              name: "type",
              label: "Stay Type",
              type: "select",
              options: ["private_room", "dormitory", "family_room", "hall"],
            },
            {
              name: "acType",
              label: "AC / Ventilation",
              type: "select",
              options: ["AC", "Non-AC"],
            },
            { name: "capacity", label: "Capacity", type: "number", required: true },
            { name: "totalInventory", label: "Total Units", type: "number", required: true },
            { name: "basePrice", label: "Base Price", type: "number", required: true },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: ["active", "under_maintenance"],
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
    const initial = { ...item };
    if (!initial.city && item.address?.city) {
      initial.city = item.address.city;
    }
    setFormData(initial);
    setIsModalOpen(true);
  };

  const handleCreateOpen = () => {
    setEditingItem(null);
    const initialData: Record<string, any> = {};
    if (activeModule === "banner") {
      initialData.category = "hero_banner";
      initialData.deviceType = "both";
      initialData.status = "active";
    }
    setFormData(initialData);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeModule === "rooms" && editingItem?._id) {
        await roomService.update(editingItem._id, {
          name: String(formData.name || "").trim(),
          type: formData.type,
          acType: formData.acType,
          capacity: Number(formData.capacity),
          totalInventory: Number(formData.totalInventory),
          basePrice: Number(formData.basePrice),
          status: formData.status,
        });
        localStorage.setItem("tirvona:rooms-updated", Date.now().toString());
        window.dispatchEvent(new Event("tirvona:rooms-updated"));
        addNotification("Room Updated", "Room and inventory data are now live.", "success");
        setIsModalOpen(false);
        fetchModuleData();
        return;
      }
      if (activeModule === "parking_locations") {
        const parkingPhotos = Array.from(
          new Set(
            [
              formData.coverImage,
              ...(Array.isArray(formData.images) ? formData.images : []),
            ].filter(
              (value): value is string =>
                typeof value === "string" && value.trim().length > 0,
            ),
          ),
        );
        if (parkingPhotos.length < 3) {
          addNotification(
            "Three Parking Photos Required",
            `Upload ${3 - parkingPhotos.length} more real parking photo${3 - parkingPhotos.length === 1 ? "" : "s"}. The map does not count as a gallery image.`,
            "warning",
          );
          return;
        }
      }
      const bannerCategory = formData.category || "hero_banner";
      const bannerImage =
        formData.image ||
        formData.coverImage ||
        formData.imageUrl ||
        formData.bannerImage ||
        "";

      const cityVal = formData.city || formData.address?.city || "";

      let isVerifiedVal = Boolean(formData.isVerified);
      if (typeof formData.isVerified === "string") {
        const lower = formData.isVerified.toLowerCase();
        isVerifiedVal = lower === "true" || lower === "verified" || lower === "yes";
      } else if (formData.isVerified === true) {
        isVerifiedVal = true;
      }

      const payload = {
        ...formData,
        isVerified: isVerifiedVal,
        ...(cityVal
          ? {
            city: cityVal,
            address: {
              ...(formData.address || {}),
              city: cityVal,
            },
          }
          : {}),
        title: formData.title || "",
        category: bannerCategory,
        section: bannerCategory,
        deviceType: formData.deviceType || "both",
        status: formData.status || "active",
        image: bannerImage,
        imageUrl: bannerImage,
      };

      const endpoint = `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;
      await api.post(endpoint, payload);

      if (activeModule === "banner") {
        try {
          const reqRes = await api.post("/cms/request-change", {
            page: "homepage",
            section: bannerCategory,
            title: payload.title,
            oldValue: {},
            newValue: {
              heading: payload.title,
              title: payload.title,
              subtitle: formData.subtitle || formData.caption || "",
              description: formData.subtitle || formData.description || "",
              bannerImage: bannerImage,
              targetUrl: "",
              ctaText: formData.ctaText || "",
              bannerWidth: formData.bannerWidth || 1920,
              bannerHeight: formData.bannerHeight || 600,
              updatedAt: new Date().toISOString(),
            },
          });
          if (reqRes.data?.success && reqRes.data?.data?._id) {
            await api.post(`/cms/approve/${reqRes.data.data._id}`, {});
          }
        } catch (cmsErr) {
          console.warn("CMS auto-publish sync error:", cmsErr);
        }
      }

      addNotification(
        "Saved & Published Live",
        `Banner updated and published live on homepage.`,
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

  const handleDirectSave = async (savedData: any) => {
    try {
      if (activeModule === "rooms" && savedData._id) {
        await roomService.update(savedData._id, {
          name: String(savedData.name || "").trim(),
          type: savedData.type,
          acType: savedData.acType,
          capacity: Number(savedData.capacity),
          totalInventory: Number(savedData.totalInventory),
          basePrice: Number(savedData.basePrice),
          status: savedData.status,
        });
        localStorage.setItem("tirvona:rooms-updated", Date.now().toString());
        window.dispatchEvent(new Event("tirvona:rooms-updated"));
        addNotification("Saved Successfully", "Room and inventory data are now live.", "success");
        fetchModuleData();
        return;
      }
      if (activeModule === "parking_partners" && savedData._id) {
        const editablePartner = { ...savedData };
        delete editablePartner.status;
        delete editablePartner.isVerified;
        delete editablePartner.createdAt;
        delete editablePartner.updatedAt;
        delete editablePartner.__v;
        await api.post("/admin/crud/parking_partners", editablePartner);
        addNotification(
          "Partner Updated",
          "Parking partner details were updated without changing approval status.",
          "success",
        );
        fetchModuleData();
        return;
      }
      const cityVal = savedData.city || savedData.address?.city || "";
      let isVerifiedVal = false;
      if (
        savedData.isVerified === true ||
        savedData.isVerified === "true" ||
        savedData.isVerified === "Verified" ||
        savedData.isVerified === "verified"
      ) {
        isVerifiedVal = true;
      }

      const payload = {
        ...savedData,
        isVerified: isVerifiedVal,
        ...(cityVal
          ? {
            city: cityVal,
            address: {
              ...(savedData.address || {}),
              city: cityVal,
            },
          }
          : {}),
        ...(activeModule === "ashrams"
          ? {
            address: {
              ...(savedData.address || {}),
              street: savedData.street || savedData.address?.street || "",
              city: cityVal,
              district: savedData.district || savedData.address?.district || "",
              state: savedData.state || savedData.address?.state || "",
              pincode: savedData.pincode || savedData.address?.pincode || "",
            },
            contact: {
              ...(savedData.contact || {}),
              email: savedData.email || savedData.contact?.email || "",
              phone: savedData.phone || savedData.contact?.phone || "",
            },
            documents: {
              ...(savedData.documents || {}),
              trustDeedUrl:
                savedData.trustDeedUrl || savedData.documents?.trustDeedUrl || "",
              fireSafetyCertificateUrl:
                savedData.fireSafetyCertificateUrl ||
                savedData.documents?.fireSafetyCertificateUrl ||
                "",
              landOwnershipUrl:
                savedData.landOwnershipUrl ||
                savedData.documents?.landOwnershipUrl ||
                "",
              uploadNotes:
                savedData.uploadNotes || savedData.documents?.uploadNotes || "",
            },
          }
          : {}),
        status: savedData.status || "approved",
      };

      const endpoint = `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;
      await api.post(endpoint, payload);
      addNotification("Saved Successfully", "Record has been updated.", "success");
      fetchModuleData();
    } catch (err) {
      addNotification("Save Error", getErrorMessage(err, "Failed to save record."), "error");
    }
  };

  // The sub-key decides which collection a record lives in (blogs/authors,
  // marketplace/orders …), so a delete has to carry it too.
  const crudDeletePath = (id: string) =>
    `/admin/crud/${activeModule}/${id}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;

  const handleDelete = async (id: string) => {
    try {
      if (activeModule === "rooms") {
        await roomService.remove(id);
        localStorage.setItem("tirvona:rooms-updated", Date.now().toString());
        window.dispatchEvent(new Event("tirvona:rooms-updated"));
        addNotification("Room Removed", "The room category was removed safely.", "success");
        fetchModuleData();
        return;
      }
      const itemToDelete = data.find((x) => (x._id || x.id) === id);
      await api.delete(crudDeletePath(id));

      if (activeModule === "banner") {
        const targetSec =
          itemToDelete?.category || itemToDelete?.section || "hero_banner";
        try {
          await api.post(`/cms/reset-section/${targetSec}`, {});
        } catch (cmsResetErr) {
          console.warn("CMS reset error:", cmsResetErr);
        }
      }

      addNotification("Deleted", "Record removed and reset.", "info");
      setData((prev) => prev.filter((x) => (x._id || x.id) !== id));
      fetchModuleData();
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
      if (activeModule === "parking_partners") {
        await Promise.all(
          ids.map((id) =>
            parkingAdminService.updatePartnerStatus(id, { status: "active" }),
          ),
        );
        addNotification(
          "Parking Partners Approved",
          `${ids.length} parking partner(s) activated.`,
          "success",
        );
        fetchModuleData();
        return;
      }
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
      if (activeModule === "parking_partners") {
        await Promise.all(
          ids.map((id) =>
            parkingAdminService.updatePartnerStatus(id, {
              status: "rejected",
              rejectionReason: "Rejected from parking partner administration",
            }),
          ),
        );
        addNotification(
          "Parking Partners Rejected",
          `${ids.length} parking partner(s) rejected.`,
          "warning",
        );
        fetchModuleData();
        return;
      }
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
      if (activeModule === "parking_partners") {
        const nextStatus = item.status === "active" ? "suspended" : "active";
        const response = await parkingAdminService.updatePartnerStatus(
          item._id || item.id,
          { status: nextStatus },
        );
        if (!response.data?.success)
          throw new Error(response.data?.message || "Partner status was not updated");
        addNotification(
          nextStatus === "active" ? "Parking Partner Approved" : "Parking Partner Suspended",
          `${item.businessName || "Parking partner"} is now ${nextStatus}.`,
          nextStatus === "active" ? "success" : "warning",
        );
        fetchModuleData();
        return;
      }
      if (activeModule === "rooms") {
        const nextStatus = item.status === "active" ? "under_maintenance" : "active";
        await roomService.update(item._id, { status: nextStatus });
        localStorage.setItem("tirvona:rooms-updated", Date.now().toString());
        window.dispatchEvent(new Event("tirvona:rooms-updated"));
        addNotification("Status Updated", `Status changed to ${nextStatus}.`, "success");
        fetchModuleData();
        return;
      }
      if (activeModule === "ashrams") {
        const currentlyActive = ["active", "approved"].includes(
          String(item.status || "").toLowerCase(),
        );
        const nextStatus = currentlyActive ? "suspended" : "approved";
        await api.post("/admin/crud/ashrams", {
          ...item,
          status: nextStatus,
          isVerified: nextStatus === "approved",
        });
        addNotification(
          nextStatus === "approved" ? "Ashram Reactivated" : "Ashram Suspended",
          `${item.name || "Ashram"} is now ${nextStatus}.`,
          nextStatus === "approved" ? "success" : "warning",
        );
        fetchModuleData();
        return;
      }
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

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const cols = moduleConfig.columns;
    const keys = cols.map((c) => c.key);
    const headers = cols.map((c) => c.label).join(",");
    const rows = data.map((row) =>
      keys
        .map((k) => `"${formatInline(row[k]).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${title.toLowerCase().replace(/\s+/g, "_")}_export.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-left w-full">
      {/* Page Module Banner Header */}
      <EnterprisePageHeader
        title={displayTitle}
        subtitle="Enterprise administration, lifecycle controls, and status monitoring console."
        icon={moduleConfig.icon}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 text-xs font-bold flex items-center gap-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 text-xs font-bold flex items-center gap-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Printer size={14} /> Print
            </button>
            {!isReadOnlyFinance && activeModule !== "rooms" && (
              <button
                onClick={
                  activeModule === "ashrams" || activeModule === "ashram"
                    ? () => navigate("/admin/manage/ashrams/add")
                    : handleCreateOpen
                }
                className="px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/25 cursor-pointer"
              >
                <Plus size={16} />{" "}
                {activeModule === "banner"
                  ? "Add New Banner"
                  : `Add New ${formatTitle(activeModule).replace(/s$/, "")}`}
              </button>
            )}
          </div>
        }
      />



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

      {/* Module Table Data */}
      {loadError && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          {loadError}
        </div>
      )}
      <EnterpriseDataTable
        title={displayTitle}
        columns={moduleConfig.columns}
        data={data}
        loading={loading}
        hideAddButton={true}
        formFields={moduleConfig.fields}
        showImageManager={[
          "ashrams",
          "banner",
          "blogs",
          "marketplace",
          "local",
          "temples",
          "events",
          "parking_locations",
        ].includes(activeModule)}
        onSave={isReadOnlyFinance ? undefined : (item) => handleDirectSave(item)}
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
          isReadOnlyFinance || activeModule === "rooms" ? undefined : (ids) => handleBulkDelete(ids)
        }
        onBulkApprove={
          isReadOnlyFinance || activeModule === "rooms" ? undefined : (ids) => handleBulkApprove(ids)
        }
        onBulkReject={
          isReadOnlyFinance || activeModule === "rooms" ? undefined : (ids) => handleBulkReject(ids)
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
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-5xl w-full rounded-[28px] p-6 space-y-5 text-left shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base sm:text-lg text-[#0B192C] dark:text-white">
                {editingItem ? `Edit ${displayTitle}` : `Create ${displayTitle}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
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
                label={`${displayTitle} Image & Gallery Manager`}
                minimumImages={activeModule === "parking_locations" ? 3 : 0}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {moduleConfig.fields.map((f) => (
                  <div
                    key={f.name}
                    className={`space-y-1 ${f.type === "textarea" ? "md:col-span-2" : ""}`}
                  >
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
                        className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none font-semibold text-gray-800 dark:text-white"
                      />
                    ) : (
                      <input
                        type={f.type}
                        required={f.required}
                        value={formData[f.name] || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, [f.name]: e.target.value })
                        }
                        className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none font-semibold text-gray-800 dark:text-white"
                      />
                    )}
                  </div>
                ))}
              </div>
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
