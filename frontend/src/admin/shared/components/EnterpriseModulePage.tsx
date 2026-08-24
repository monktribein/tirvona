import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EnterpriseDataTable, { type TableColumn } from "./EnterpriseDataTable";
import ImageGalleryManager from "./ImageGalleryManager";
import { RecordFieldList } from "./RecordValue";
import LocalHubEnterpriseDrawer from "./LocalHubEnterpriseDrawer";
import { EnterprisePageHeader } from "./EnterprisePageHeader";
import { useNotifications } from "../../../contexts/NotificationContext";
import api, { getErrorMessage } from "../../../lib/api";
import {
  ashramService,
  marketplaceService,
  offerService,
  roomService,
  userService,
} from "../../../services";
import { parkingAdminService } from "../../../modules/parking/services/parking.service";
import { humanizeLabel } from "../../../utils/labels";
import { formatCurrency, getFormattingLocale } from "../../../utils/format";
import { formatInline } from "../utils/recordFormat";
import { getAllStates, getDistricts } from "india-state-district";
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
  BarChart3,
  BookOpen,
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

  const [pendingCmsRequests, setPendingCmsRequests] = useState<CmsRequest[]>(
    [],
  );
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [bannerEntities, setBannerEntities] = useState<Record<string, any[]>>({});
  const [featuredAshramSearch, setFeaturedAshramSearch] = useState("");
  const [roomAshramOptions, setRoomAshramOptions] = useState<any[]>([]);
  const [roomCategoryOptions, setRoomCategoryOptions] = useState<any[]>([]);
  const [aartiSessionOptions, setAartiSessionOptions] = useState<any[]>([]);
  const [aartiPassOptions, setAartiPassOptions] = useState<any[]>([]);
  const [aartiUserOptions, setAartiUserOptions] = useState<any[]>([]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [managingItem, setManagingItem] = useState<any | null>(null);

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
    "featured_banner:homepage": "Featured Banner Management",
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
    "aarti_pass_types:all": "Aarti Passes",
    "aarti_pricing:all": "Aarti Pricing Rules",
    "aarti_availability:all": "Aarti Availability",
    "aarti_staff:all": "Aarti Gate Staff",
    "aarti_payments:all": "Aarti Payments",
    "aarti_reviews:all": "Aarti Reviews",
    "aarti_settings:all": "Aarti Settings",
    "reports:revenue": "Revenue Reports",
    "reports:bookings": "Booking Telemetry",
  };
  const displayTitle = pageTitles[`${activeModule}:${activeSubKey || "all"}`] || title;
  const recordLabel =
    displayTitle
      .replace(/^All\s+/i, "")
      .replace(/ies$/, "y")
      .replace(/([^s])s$/, "$1") || displayTitle;

  useEffect(() => {
    fetchModuleData();
    if (activeModule === "banner") {
      fetchPendingCmsRequests();
    }
  }, [activeModule, activeSubKey]);

  useEffect(() => {
    if (activeModule !== "featured_banner") return;
    void Promise.allSettled([
      ashramService.search({ limit: "100" }),
      marketplaceService.getProducts({ limit: 100 }),
      offerService.getPublicOffers({ limit: "100" }),
      api.get("/services/events"),
      ashramService.destinations(),
    ]).then((results) => {
      const value = (index: number) =>
        results[index].status === "fulfilled"
          ? (results[index] as PromiseFulfilledResult<any>).value.data?.data || []
          : [];
      setBannerEntities({
        ashram: value(0),
        marketplace: value(1),
        offer: value(2),
        event: value(3),
        destination: value(4),
      });
    });
  }, [activeModule]);

  useEffect(() => {
    if (
      activeModule !== "rooms" &&
      activeModule !== "aarti_sessions" &&
      !activeModule.startsWith("aarti_")
    )
      return;
    let cancelled = false;

    const fetchAllPages = async (path: string): Promise<any[]> => {
      const rows: any[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const separator = path.includes("?") ? "&" : "?";
        const res = await api.get(`${path}${separator}limit=100&page=${page}`);
        if (!res.data?.success) break;
        rows.push(...(res.data.data || []));
        if (page >= (res.data.totalPages || 1)) break;
      }
      return rows;
    };

    void Promise.allSettled([
      fetchAllPages("/admin/crud/ashrams"),
      fetchAllPages("/admin/crud/rooms?subKey=all"),
    ]).then((results) => {
      if (cancelled) return;
      const value = (index: number) =>
        results[index].status === "fulfilled"
          ? (results[index] as PromiseFulfilledResult<any[]>).value
          : [];
      setRoomAshramOptions(value(0));
      setRoomCategoryOptions(value(1));
    });

    return () => {
      cancelled = true;
    };
  }, [activeModule]);

  useEffect(() => {
    if (!activeModule.startsWith("aarti_")) return;
    let cancelled = false;

    void Promise.allSettled([
      api.get("/admin/crud/aarti_sessions?subKey=all"),
      api.get("/admin/crud/aarti_pass_types?subKey=all"),
      api.get("/admin/crud/users?subKey=staff"),
    ]).then((results) => {
      if (cancelled) return;
      const rows = (index: number) =>
        results[index].status === "fulfilled"
          ? (results[index] as PromiseFulfilledResult<any>).value.data?.data || []
          : [];
      setAartiSessionOptions(rows(0));
      setAartiPassOptions(rows(1));
      setAartiUserOptions(rows(2));
    });

    return () => {
      cancelled = true;
    };
  }, [activeModule]);

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
      const endpoint =
        activeModule === "reports"
          ? activeSubKey === "bookings"
            ? // The dashboard DTO caps `limit` at 100; asking for more is a 400.
              "/bookings/dashboard?limit=100"
            : "/booking-finance/payments"
          : activeModule === "bookings" && activeSubKey === "refunds"
          ? "/booking-finance/refunds"
          : activeModule === "bookings"
            ? `/bookings/dashboard?limit=100${activeSubKey === "pending" ? "&paymentStatus=pending" : activeSubKey === "refunded" ? "&paymentStatus=refunded" : activeSubKey && activeSubKey !== "all" ? `&status=${encodeURIComponent(activeSubKey)}` : ""}`
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

  const READ_ONLY_MODULES = new Set([
    "reports",
    "parking_bookings",
    "parking_commissions",
    "parking_transactions",
    "parking_scan_logs",
    "parking_staff",
    "aarti_payments",
    "aarti_reviews",
  ]);
  const isRoomInventoryView =
    activeModule === "rooms" &&
    ["availability", "inventory"].includes(activeSubKey);
  const isRoomPricingView =
    activeModule === "rooms" &&
    ["pricing", "season_pricing"].includes(activeSubKey);
  const isRoomCategoryView = activeModule === "rooms" && !isRoomInventoryView && !isRoomPricingView;
  const supportsBulkLifecycle =
    activeModule === "ashrams" ||
    activeModule === "parking_partners" ||
    activeModule === "parking_locations" ||
    isRoomCategoryView;
  const isAartiSessionView = activeModule === "aarti_sessions";
  const isAartiConfigurationView = [
    "aarti_pass_types",
    "aarti_pricing",
    "aarti_availability",
    "aarti_staff",
    "aarti_settings",
  ].includes(activeModule);
  const isReadOnlyFinance =
    (activeModule === "bookings" && activeSubKey === "refunds") ||
    READ_ONLY_MODULES.has(activeModule);

  const genericModuleConfig = {
    icon: <Building size={20} className="text-[#0A4DA6]" />,
    columns: defaultColumns || [
      {
        key: "name",
        label: "Record Name / Title",
        render: (v: any, item: any) =>
          formatInline(v || item.title || item.bookingId || item._id),
      },
      {
        key: "category",
        label: "Category / Tag",
        render: (v: any, item: any) => v || item.department || item.type || "General",
      },
      {
        key: "owner",
        label: "Managed By",
        render: (v: any, item: any) => v || item.customerId?.name || "System Admin",
      },
      {
        key: "status",
        label: "Status",
        render: (v: any) => v || "active",
      },
    ],
    fields: [
      { name: "name", label: "Record Name", type: "text", required: true },
      { name: "title", label: "Title / Subject", type: "text" },
      { name: "category", label: "Category", type: "text" },
      { name: "details", label: "Description", type: "textarea" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["active", "pending", "approved", "rejected"],
      },
    ],
  };

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
            { name: "street", label: "Street Address", type: "text", required: true },
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
              options: ["approved", "pending", "rejected"],
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

      case "blogs":
        if (activeSubKey && activeSubKey !== "all") return genericModuleConfig;
        return {
          icon: <BookOpen size={20} className="text-[#0A4DA6]" />,
          columns: [
            {
              key: "coverImage",
              label: "Cover",
              render: (value: any, item: any) => {
                const src = value || item.image || item.imageUrl;
                return (
                  <div className="w-12 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800 bg-slate-900 shrink-0">
                    {src ? (
                      <img
                        src={src}
                        alt="Cover"
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                );
              },
            },
            {
              key: "title",
              label: "Article Title",
              render: (value: any, item: any) => value || item.name || "—",
            },
            { key: "category", label: "Category" },
            {
              key: "contentType",
              label: "Type",
              render: (value: any) => humanizeLabel(value || "article"),
            },
            {
              key: "author",
              label: "Author",
              render: (value: any, item: any) =>
                value?.name || item.authorId?.name || "Tirvona Editorial",
            },
            {
              key: "views",
              label: "Views",
              render: (value: any) => Number(value || 0),
            },
            {
              key: "status",
              label: "Status",
              render: (value: any) => humanizeLabel(value || "draft"),
            },
          ],
          fields: [
            {
              name: "title",
              label: "Article Title",
              type: "text",
              required: true,
            },
            {
              name: "slug",
              label: "URL Slug (auto-generated when blank)",
              type: "text",
            },
            {
              name: "category",
              label: "Category",
              type: "select",
              options: [
                "spiritual",
                "pilgrimage",
                "temples",
                "festivals",
                "travel",
                "wellness",
                "food",
                "culture",
              ],
            },
            {
              name: "contentType",
              label: "Content Type",
              type: "select",
              options: ["article", "video"],
            },
            { name: "videoUrl", label: "Video URL (for video posts)", type: "text" },
            { name: "coverImage", label: "Featured Image URL", type: "text" },
            {
              name: "excerpt",
              label: "Short Description",
              type: "textarea",
            },
            {
              name: "content",
              label: "Article Body Content",
              type: "textarea",
              required: true,
            },
            { name: "tags", label: "Tags (comma separated)", type: "text" },
            {
              name: "status",
              label: "Publish Status",
              type: "select",
              options: ["published", "draft"],
            },
          ],
        };

      case "reports":
        if (activeSubKey === "bookings") {
          return {
            icon: <BarChart3 size={20} className="text-[#0A4DA6]" />,
            columns: [
              { key: "bookingId", label: "Booking ID" },
              {
                key: "customerId",
                label: "Guest",
                render: (value: any) =>
                  value?.name || value?.email || value?.phone || "—",
              },
              {
                key: "ashramId",
                label: "Ashram",
                render: (value: any) => value?.name || "—",
              },
              {
                key: "checkInDate",
                label: "Check-in",
                render: (value: any) =>
                  value
                    ? new Date(value).toLocaleDateString(getFormattingLocale())
                    : "—",
              },
              {
                key: "checkOutDate",
                label: "Check-out",
                render: (value: any) =>
                  value
                    ? new Date(value).toLocaleDateString(getFormattingLocale())
                    : "—",
              },
              {
                key: "guestsCount",
                label: "Guests / Rooms",
                render: (value: any, item: any) =>
                  value == null && item.roomsBookedCount == null
                    ? "—"
                    : `${value ?? 0} guest${value === 1 ? "" : "s"} · ${item.roomsBookedCount ?? 0} room${item.roomsBookedCount === 1 ? "" : "s"}`,
              },
              {
                key: "pricing",
                label: "Booking Value",
                render: (value: any) =>
                  formatCurrency(Number(value?.totalAmount) || 0),
              },
              { key: "paymentStatus", label: "Payment" },
              { key: "status", label: "Booking Status" },
            ],
            fields: [],
          };
        }
        return {
          icon: <BarChart3 size={20} className="text-[#0A4DA6]" />,
          columns: [
            {
              key: "transactionId",
              label: "Transaction Reference",
              render: (value: any, item: any) =>
                value ||
                item.gateway?.paymentId ||
                item.gateway?.orderId ||
                (item._id ? String(item._id).slice(-10).toUpperCase() : "—"),
            },
            {
              key: "bookingId",
              label: "Booking",
              render: (value: any) =>
                value?.bookingId || value?.reservationNumber || "—",
            },
            {
              key: "ashramId",
              label: "Ashram",
              render: (value: any) => value?.name || "—",
            },
            {
              key: "paidBy",
              label: "Paid By",
              render: (value: any, item: any) => {
                const payer = value || item.bookedBy || item.userId;
                return payer?.name || payer?.email || payer?.phone || "—";
              },
            },
            {
              key: "amount",
              label: "Amount",
              render: (value: any) => formatCurrency(Number(value) || 0),
            },
            {
              key: "method",
              label: "Payment Method",
              render: (value: any) => (value ? humanizeLabel(value) : "—"),
            },
            { key: "status", label: "Payment Status" },
            {
              key: "paidAt",
              label: "Paid On",
              render: (value: any, item: any) => {
                const when = value || item.createdAt;
                return when
                  ? new Date(when).toLocaleString(getFormattingLocale())
                  : "—";
              },
            },
          ],
          fields: [],
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
              key: "bookingSource",
              label: "Source",
              render: (value: any) =>
                String(value ?? "tirvona") === "self" ? "Walk-in" : "Tirvona",
            },
            {
              key: "customerId",
              label: "Guest",
              render: (value: any, item: any) =>
                item?.walkInGuest?.name ||
                value?.name ||
                value?.email ||
                value?.phone ||
                "Guest unavailable",
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
          fields: [
            {
              name: "assignedRoomNumber",
              label: "Assigned Room Number",
              type: "text",
            },
            {
              name: "specialRequests",
              label: "Guest Special Requests",
              type: "textarea",
            },
          ],
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
            fields: [
              {
                name: "totalInventory",
                label: "Total Units",
                type: "number",
                required: true,
              },
              {
                name: "maintenanceCount",
                label: "Blocked / Maintenance Units",
                type: "number",
              },
              {
                name: "customPrice",
                label: "Custom Price (blank = base price)",
                type: "number",
              },
              {
                name: "isClosed",
                label: "Stop Sell",
                type: "select",
                options: ["false", "true"],
              },
              { name: "note", label: "Internal Note", type: "text" },
            ],
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
              { key: "priceType", label: "Price Type" },
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
                label: "Effective Price",
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
            fields: [
              { name: "name", label: "Pricing Rule Name", type: "text" },
              { name: "validFrom", label: "Valid From", type: "date" },
              { name: "validUntil", label: "Valid Until", type: "date" },
              {
                name: "multiplier",
                label: "Peak Multiplier (e.g. 1.5)",
                type: "number",
              },
              {
                name: "overridePrice",
                label: "Effective Price (₹)",
                type: "number",
                required: true,
              },
            ],
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

      case "featured_banner":
        return {
          icon: <Sparkles size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "title", label: "Featured Banner Title" },
            { key: "eventName", label: "Event / Festival" },
            { key: "relatedAshramName", label: "Linked Ashram" },
            { key: "location", label: "Location" },
            { key: "startDate", label: "Start Date" },
            { key: "status", label: "Status" },
          ],
          fields: [
            { name: "title", label: "Featured Banner Title", type: "text", required: true },
            { name: "subtitle", label: "Subtitle / Caption", type: "text", required: true },
            { name: "description", label: "Full Description / Content", type: "textarea", required: true },
            { name: "eventName", label: "Event / Festival Name", type: "text", required: true },
            { name: "eventDetails", label: "Event / Festival Details", type: "textarea", required: true },
            { name: "startDate", label: "Start Date & Time", type: "datetime-local", required: true },
            { name: "endDate", label: "End Date & Time", type: "datetime-local" },
            { name: "timing", label: "Timings", type: "text" },
            { name: "location", label: "Location", type: "text", required: true },
            {
              name: "relatedContentType",
              label: "Related Tirvona Content Type",
              type: "select",
              options: ["event", "ashram", "offer", "destination", "marketplace"],
              required: true,
            },
            { name: "ctaText", label: "CTA Button Text", type: "text", required: true },
            { name: "ctaUrl", label: "Book Now / Explore Destination", type: "text" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: ["active", "inactive"],
            },
          ],
        };

      case "aarti_pass_types":
        return {
          icon: <Sparkles size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "name", label: "Pass Name" },
            { key: "code", label: "Code" },
            { key: "sessionId", label: "Aarti", render: (value: any) => value?.name || "—" },
            { key: "basePrice", label: "Price", render: (value: any) => formatCurrency(Number(value || 0)) },
            { key: "totalCapacity", label: "Capacity" },
            { key: "isActive", label: "Status", render: (value: any) => value === false ? "Inactive" : "Active" },
          ],
          fields: [
            { name: "name", label: "Pass Name", type: "text", required: true },
            { name: "code", label: "Pass Code", type: "text", required: true },
            { name: "description", label: "Description", type: "textarea" },
            { name: "basePrice", label: "Base Price", type: "number", required: true },
            { name: "totalCapacity", label: "Total Capacity", type: "number", required: true },
            { name: "maxPerBooking", label: "Maximum Per Booking", type: "number", required: true },
            { name: "zoneLabel", label: "Zone / Seating Label", type: "text" },
            { name: "includesPrasad", label: "Includes Prasad", type: "select", options: ["false", "true"] },
            { name: "includesSankalp", label: "Includes Sankalp", type: "select", options: ["false", "true"] },
            { name: "isActive", label: "Active", type: "select", options: ["true", "false"] },
            { name: "displayOrder", label: "Display Order", type: "number" },
          ],
        };

      case "aarti_pricing":
        return {
          icon: <TagIcon size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "name", label: "Pricing Rule" },
            { key: "sessionId", label: "Aarti", render: (value: any) => value?.name || "—" },
            { key: "passTypeId", label: "Pass", render: (value: any) => value?.name || "All passes" },
            { key: "validFrom", label: "Valid From" },
            { key: "validUntil", label: "Valid Until" },
            { key: "overridePrice", label: "Override Price", render: (value: any) => value == null ? "—" : formatCurrency(Number(value)) },
            { key: "isActive", label: "Status", render: (value: any) => value === false ? "Inactive" : "Active" },
          ],
          fields: [
            { name: "name", label: "Rule Name", type: "text", required: true },
            { name: "validFrom", label: "Valid From", type: "date" },
            { name: "validUntil", label: "Valid Until", type: "date" },
            { name: "daysOfWeek", label: "Days of Week (0–6, comma separated)", type: "text" },
            { name: "multiplier", label: "Price Multiplier", type: "number" },
            { name: "overridePrice", label: "Override Price", type: "number" },
            { name: "taxPercent", label: "Tax Percent", type: "number" },
            { name: "priority", label: "Priority", type: "number" },
            { name: "isActive", label: "Active", type: "select", options: ["true", "false"] },
          ],
        };

      case "aarti_availability":
        return {
          icon: <Calendar size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "sessionId", label: "Aarti", render: (value: any) => value?.name || "—" },
            { key: "passTypeId", label: "Pass", render: (value: any) => value?.name || "—" },
            { key: "date", label: "Date" },
            { key: "totalCapacity", label: "Capacity" },
            { key: "bookedCount", label: "Booked" },
            { key: "blockedCount", label: "Blocked" },
            { key: "customPrice", label: "Custom Price", render: (value: any) => value == null ? "—" : formatCurrency(Number(value)) },
            { key: "isClosed", label: "Availability", render: (value: any) => value ? "Closed" : "Open" },
          ],
          fields: [
            { name: "date", label: "Availability Date", type: "date", required: true },
            { name: "totalCapacity", label: "Total Capacity", type: "number", required: true },
            { name: "blockedCount", label: "Blocked Seats", type: "number" },
            { name: "customPrice", label: "Custom Price", type: "number" },
            { name: "isClosed", label: "Close Bookings", type: "select", options: ["false", "true"] },
            { name: "note", label: "Internal Note", type: "textarea" },
          ],
        };

      case "aarti_staff":
        return {
          icon: <Users size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "userId", label: "Staff Member", render: (value: any) => value?.name || value?.email || "—" },
            { key: "ashramId", label: "Ashram", render: (value: any) => value?.name || "—" },
            { key: "aartiRole", label: "Aarti Role", render: (value: any) => humanizeLabel(value || "") },
            { key: "employeeCode", label: "Employee Code" },
            { key: "shift", label: "Shift" },
            { key: "status", label: "Status" },
          ],
          fields: [
            { name: "aartiRole", label: "Aarti Role", type: "select", options: ["aarti_coordinator", "aarti_gate_staff"], required: true },
            { name: "employeeCode", label: "Employee Code", type: "text" },
            { name: "phone", label: "Phone", type: "text" },
            { name: "shift", label: "Shift", type: "text" },
            { name: "status", label: "Status", type: "select", options: ["active", "suspended", "revoked"] },
          ],
        };

      case "aarti_settings":
        return {
          icon: <ShieldCheck size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "scope", label: "Scope" },
            { key: "ashramId", label: "Ashram", render: (value: any) => value?.name || "Platform-wide" },
            { key: "sessionId", label: "Aarti", render: (value: any) => value?.name || "All Aartis" },
            { key: "reservationHoldMinutes", label: "Hold Minutes" },
            { key: "maxPassesPerBooking", label: "Max Passes" },
            { key: "allowOnlineBooking", label: "Online Booking", render: (value: any) => value === false ? "Disabled" : "Enabled" },
          ],
          fields: [
            { name: "scope", label: "Setting Scope", type: "select", options: ["platform", "ashram", "session"], required: true },
            { name: "reservationHoldMinutes", label: "Reservation Hold (minutes)", type: "number" },
            { name: "gateOpensBeforeMinutes", label: "Gate Opens Before (minutes)", type: "number" },
            { name: "gateClosesAfterMinutes", label: "Gate Closes After (minutes)", type: "number" },
            { name: "noShowAfterMinutes", label: "No-show After (minutes)", type: "number" },
            { name: "commissionPercent", label: "Commission Percent", type: "number" },
            { name: "taxPercent", label: "Tax Percent", type: "number" },
            { name: "maxPassesPerBooking", label: "Maximum Passes Per Booking", type: "number" },
            { name: "bookingOpensDaysAhead", label: "Booking Opens Days Ahead", type: "number" },
            { name: "freeCancellationHours", label: "Free Cancellation Hours", type: "number" },
            { name: "allowOnlineBooking", label: "Allow Online Booking", type: "select", options: ["true", "false"] },
            { name: "allowCancellation", label: "Allow Cancellation", type: "select", options: ["true", "false"] },
            { name: "requireDevoteeNames", label: "Require Devotee Names", type: "select", options: ["true", "false"] },
          ],
        };

      case "aarti_sessions": {
        const states = getAllStates();
        const selectedState = states.find(
          (state) => state.name === (formData.state || formData.venue?.state),
        );
        const cities = selectedState ? getDistricts(selectedState.code) : [];
        return {
          icon: <Sparkles size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: "name", label: "Aarti Name" },
            {
              key: "kind",
              label: "Category",
              render: (value: any) => humanizeLabel(value || "other"),
            },
            {
              key: "venue",
              label: "Location",
              render: (value: any) =>
                [value?.city, value?.state].filter(Boolean).join(", ") || "—",
            },
            { key: "startTime", label: "Start Time" },
            { key: "status", label: "Status" },
          ],
          fields: [
            { name: "name", label: "Aarti Name", type: "text", required: true },
            {
              name: "kind",
              label: "Category",
              type: "select",
              options: [
                "ganga_aarti",
                "mangala_aarti",
                "bhasma_aarti",
                "sandhya_aarti",
                "shayan_aarti",
                "maha_aarti",
                "abhishek",
                "havan",
                "bhajan_sandhya",
                "other",
              ],
              required: true,
            },
            { name: "deity", label: "Deity", type: "text" },
            {
              name: "state",
              label: "State",
              type: "select",
              options: states.map((state) => state.name),
              required: true,
            },
            {
              name: "city",
              label: "City / District",
              type: "select",
              options: cities,
              required: true,
            },
            { name: "startTime", label: "Start Time", type: "time", required: true },
            {
              name: "durationMinutes",
              label: "Duration (minutes)",
              type: "number",
              required: true,
            },
            {
              name: "totalCapacity",
              label: "Total Capacity",
              type: "number",
              required: true,
            },
            { name: "description", label: "Description", type: "textarea" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: ["draft", "pending", "approved", "rejected", "suspended"],
            },
          ],
        };
      }

      default:
        return genericModuleConfig;
    }
  };

  const moduleConfig = getModuleConfig();
  const featuredAshrams = Array.isArray(bannerEntities.ashram)
    ? bannerEntities.ashram
    : [];
  const featuredStates = Array.from(
    new Set(
      featuredAshrams
        .map((item: any) => item.address?.state || item.state || "")
        .filter(Boolean),
    ),
  ).sort((a, b) => String(a).localeCompare(String(b)));
  const featuredDistricts = Array.from(
    new Set(
      featuredAshrams
        .filter(
          (item: any) =>
            !formData.relatedState ||
            (item.address?.state || item.state) === formData.relatedState,
        )
        .map(
          (item: any) =>
            item.address?.district ||
            item.district ||
            item.address?.city ||
            item.city ||
            "",
        )
        .filter(Boolean),
    ),
  ).sort((a, b) => String(a).localeCompare(String(b)));
  const filteredFeaturedAshrams = featuredAshrams.filter((item: any) => {
    const state = item.address?.state || item.state || "";
    const district =
      item.address?.district ||
      item.district ||
      item.address?.city ||
      item.city ||
      "";
    const query = featuredAshramSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [item.name, item.ashramCode, district, state]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    return (
      matchesSearch &&
      (!formData.relatedState || state === formData.relatedState) &&
      (!formData.relatedDistrict || district === formData.relatedDistrict)
    );
  });
  const selectedAartiId = String(formData.sessionId || "");
  const filteredAartiPassOptions = aartiPassOptions.filter(
    (pass) =>
      !selectedAartiId ||
      String(pass.sessionId?._id || pass.sessionId) === selectedAartiId,
  );
  const requiresAartiSession = [
    "aarti_pass_types",
    "aarti_pricing",
    "aarti_availability",
  ].includes(activeModule);
  const requiresAartiPass = ["aarti_pricing", "aarti_availability"].includes(
    activeModule,
  );
  const showAartiAshram =
    activeModule === "aarti_staff" ||
    (activeModule === "aarti_settings" && formData.scope === "ashram");
  const showAartiSettingSession =
    activeModule === "aarti_settings" && formData.scope === "session";
  const formUsesImages = [
    "ashrams",
    "banner",
    "featured_banner",
    "blogs",
    "marketplace",
    "local",
    "temples",
    "events",
    "parking_locations",
    "aarti_sessions",
  ].includes(activeModule);

  const handleEditOpen = (item: any) => {
    setEditingItem(item);
    const initial = { ...item };
    if (!initial.city && item.address?.city) {
      initial.city = item.address.city;
    }
    if (activeModule === "aarti_sessions") {
      initial.ashramId = item.ashramId?._id || item.ashramId || "";
      initial.state = item.venue?.state || "";
      initial.city = item.venue?.city || "";
    }
    if (activeModule.startsWith("aarti_")) {
      ["ashramId", "sessionId", "passTypeId", "userId"].forEach((key) => {
        initial[key] = item[key]?._id || item[key] || "";
      });
      [
        "includesPrasad",
        "includesSankalp",
        "isActive",
        "isClosed",
        "allowOnlineBooking",
        "allowCancellation",
        "requireDevoteeNames",
      ].forEach((key) => {
        if (typeof item[key] === "boolean") initial[key] = String(item[key]);
      });
      if (Array.isArray(item.daysOfWeek)) {
        initial.daysOfWeek = item.daysOfWeek.join(",");
      }
    }
    setFormData(initial);
    setFeaturedAshramSearch("");
    setIsModalOpen(true);
  };

  const handleCreateOpen = () => {
    setEditingItem(null);
    const initialData: Record<string, any> = {};
    if (activeModule === "banner") {
      initialData.category = "hero_banner";
      initialData.deviceType = "both";
      initialData.status = "active";
    } else if (activeModule === "featured_banner") {
      initialData.relatedContentType = "event";
      initialData.ctaText = "Book Now";
      initialData.status = "active";
    } else if (activeModule === "blogs" && (!activeSubKey || activeSubKey === "all")) {
      initialData.status = "published";
      initialData.contentType = "article";
      initialData.category = "spiritual";
    } else if (isRoomCategoryView) {
      initialData.ashramId = roomAshramOptions[0]?._id || "";
      initialData.type = "private_room";
      initialData.acType = "Non-AC";
      initialData.capacity = 2;
      initialData.totalInventory = 10;
      initialData.basePrice = 800;
      initialData.status = "active";
    } else if (isRoomPricingView) {
      initialData.sourceRoomId = roomCategoryOptions[0]?._id || "";
      initialData.multiplier = 1;
    } else if (isAartiSessionView) {
      const states = getAllStates();
      const firstAshram = roomAshramOptions[0];
      const preferredState =
        firstAshram?.address?.state || "Uttar Pradesh";
      const firstState =
        states.find((state) => state.name === preferredState) || states[0];
      const districts = firstState ? getDistricts(firstState.code) : [];
      const preferredCity =
        firstAshram?.address?.district || firstAshram?.address?.city || "";
      initialData.ashramId = firstAshram?._id || "";
      initialData.kind = "other";
      initialData.state = firstState?.name || "";
      initialData.city = districts.includes(preferredCity)
        ? preferredCity
        : districts[0] || "";
      initialData.startTime = "18:00";
      initialData.durationMinutes = 45;
      initialData.totalCapacity = 0;
      initialData.status = "approved";
    } else if (activeModule === "aarti_pass_types") {
      const firstSession = aartiSessionOptions[0];
      initialData.sessionId = firstSession?._id || "";
      initialData.ashramId = firstSession?.ashramId?._id || firstSession?.ashramId || "";
      initialData.basePrice = 0;
      initialData.totalCapacity = 100;
      initialData.maxPerBooking = 10;
      initialData.includesPrasad = "false";
      initialData.includesSankalp = "false";
      initialData.isActive = "true";
      initialData.displayOrder = 0;
    } else if (activeModule === "aarti_pricing") {
      initialData.sessionId = aartiSessionOptions[0]?._id || "";
      initialData.passTypeId = "";
      initialData.multiplier = 1;
      initialData.priority = 0;
      initialData.isActive = "true";
    } else if (activeModule === "aarti_availability") {
      const firstSession = aartiSessionOptions[0];
      const firstPass = aartiPassOptions.find(
        (pass) =>
          String(pass.sessionId?._id || pass.sessionId) === String(firstSession?._id),
      );
      initialData.sessionId = firstSession?._id || "";
      initialData.passTypeId = firstPass?._id || "";
      initialData.date = new Date().toISOString().slice(0, 10);
      initialData.totalCapacity = firstPass?.totalCapacity || 0;
      initialData.blockedCount = 0;
      initialData.isClosed = "false";
    } else if (activeModule === "aarti_staff") {
      initialData.userId = aartiUserOptions[0]?._id || "";
      initialData.ashramId = roomAshramOptions[0]?._id || "";
      initialData.aartiRole = "aarti_gate_staff";
      initialData.status = "active";
    } else if (activeModule === "aarti_settings") {
      initialData.scope = "platform";
      initialData.allowOnlineBooking = "true";
      initialData.allowCancellation = "true";
      initialData.requireDevoteeNames = "true";
    }
    setFormData(initialData);
    setFeaturedAshramSearch("");
    setIsModalOpen(true);
  };

  const announceRoomsChanged = () => {
    localStorage.setItem("tirvona:rooms-updated", Date.now().toString());
    window.dispatchEvent(new Event("tirvona:rooms-updated"));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRoomCategoryView && editingItem?._id) {
        await roomService.update(editingItem._id, {
          name: String(formData.name || "").trim(),
          type: formData.type,
          acType: formData.acType,
          capacity: Number(formData.capacity),
          totalInventory: Number(formData.totalInventory),
          basePrice: Number(formData.basePrice),
          status: formData.status,
        });
        announceRoomsChanged();
        addNotification("Room Updated", "Room and inventory data are now live.", "success");
        setIsModalOpen(false);
        fetchModuleData();
        return;
      }
      if (isRoomCategoryView) {
        if (!formData.ashramId) {
          addNotification(
            "Ashram Required",
            "Pick the ashram this room category belongs to.",
            "error",
          );
          return;
        }
        await api.post("/admin/crud/rooms?subKey=all", {
          ashramId: formData.ashramId,
          name: String(formData.name || "").trim(),
          type: formData.type || "private_room",
          acType: formData.acType || "Non-AC",
          capacity: Number(formData.capacity) || 1,
          totalInventory: Number(formData.totalInventory) || 1,
          basePrice: Number(formData.basePrice) || 0,
          status: formData.status || "active",
        });
        announceRoomsChanged();
        addNotification("Room Category Created", "The category is now bookable.", "success");
        setIsModalOpen(false);
        fetchModuleData();
        return;
      }
      if (isRoomPricingView) {
        const sourceRoomId = editingItem?.sourceRoomId || formData.sourceRoomId;
        if (!sourceRoomId) {
          addNotification(
            "Room Required",
            "Pick the room category this price applies to.",
            "error",
          );
          return;
        }
        await api.post(`/admin/crud/rooms?subKey=${activeSubKey || "pricing"}`, {
          _id: editingItem?._id,
          sourceRoomId,
          name: formData.name,
          validFrom: formData.validFrom || undefined,
          validUntil: formData.validUntil || undefined,
          multiplier: Number(formData.multiplier) || 1,
          overridePrice: Number(formData.overridePrice) || 0,
        });
        announceRoomsChanged();
        addNotification("Pricing Updated", "The new rate is live for new bookings.", "success");
        setIsModalOpen(false);
        fetchModuleData();
        return;
      }
      if (isAartiSessionView) {
        if (!formData.ashramId || !formData.state || !formData.city) {
          addNotification(
            "Aarti Location Required",
            "Select an ashram, state, and city before saving.",
            "error",
          );
          return;
        }
        const images = Array.from(
          new Set(
            [
              formData.coverImage,
              ...(Array.isArray(formData.images) ? formData.images : []),
              ...(Array.isArray(formData.gallery) ? formData.gallery : []),
            ].filter((value): value is string => typeof value === "string" && !!value.trim()),
          ),
        );
        await api.post(`/admin/crud/aarti_sessions${activeSubKey ? `?subKey=${activeSubKey}` : ""}`, {
          ...(editingItem?._id ? { _id: editingItem._id } : {}),
          ashramId: formData.ashramId,
          name: String(formData.name || "").trim(),
          kind: formData.kind,
          deity: String(formData.deity || "").trim(),
          description: String(formData.description || "").trim(),
          state: formData.state,
          city: formData.city,
          startTime: formData.startTime,
          durationMinutes: Number(formData.durationMinutes),
          totalCapacity: Number(formData.totalCapacity),
          status: formData.status,
          coverImage: formData.coverImage || images[0] || "",
          images,
        });
        addNotification(
          editingItem ? "Aarti Updated" : "Aarti Created",
          editingItem
            ? "The Aarti details were updated successfully."
            : "The Aarti was created with a unique URL slug.",
          "success",
        );
        setIsModalOpen(false);
        fetchModuleData();
        return;
      }
      if (isAartiConfigurationView) {
        const needsSession = [
          "aarti_pass_types",
          "aarti_pricing",
          "aarti_availability",
        ].includes(activeModule);
        const needsPass = activeModule === "aarti_availability";
        const needsStaffIdentity = activeModule === "aarti_staff";
        if (
          (needsSession && !formData.sessionId) ||
          (needsPass && !formData.passTypeId) ||
          (needsStaffIdentity && (!formData.userId || !formData.ashramId)) ||
          (activeModule === "aarti_settings" &&
            formData.scope === "ashram" &&
            !formData.ashramId) ||
          (activeModule === "aarti_settings" &&
            formData.scope === "session" &&
            !formData.sessionId)
        ) {
          addNotification(
            "Required Selection Missing",
            "Select the required Aarti, pass, ashram, or staff member before saving.",
            "error",
          );
          return;
        }

        const booleanFields = [
          "includesPrasad",
          "includesSankalp",
          "isActive",
          "isClosed",
          "allowOnlineBooking",
          "allowCancellation",
          "requireDevoteeNames",
        ];
        const numberFields = [
          "basePrice",
          "totalCapacity",
          "maxPerBooking",
          "displayOrder",
          "multiplier",
          "overridePrice",
          "taxPercent",
          "priority",
          "blockedCount",
          "customPrice",
          "reservationHoldMinutes",
          "gateOpensBeforeMinutes",
          "gateClosesAfterMinutes",
          "noShowAfterMinutes",
          "commissionPercent",
          "maxPassesPerBooking",
          "bookingOpensDaysAhead",
          "freeCancellationHours",
        ];
        const payload: Record<string, unknown> = {
          ...formData,
          ...(editingItem?._id ? { _id: editingItem._id } : {}),
        };
        booleanFields.forEach((key) => {
          if (payload[key] !== undefined && payload[key] !== "") {
            payload[key] = String(payload[key]) === "true";
          }
        });
        numberFields.forEach((key) => {
          if (payload[key] !== undefined && payload[key] !== "") {
            payload[key] = Number(payload[key]);
          } else {
            delete payload[key];
          }
        });
        if (activeModule === "aarti_pricing") {
          payload.daysOfWeek = String(formData.daysOfWeek || "")
            .split(",")
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
        }
        if (activeModule === "aarti_settings") {
          if (formData.scope === "platform") {
            delete payload.ashramId;
            delete payload.sessionId;
          } else if (formData.scope === "ashram") {
            delete payload.sessionId;
          }
        }

        await api.post(
          `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`,
          payload,
        );
        addNotification(
          editingItem ? "Aarti Configuration Updated" : "Aarti Configuration Created",
          `${displayTitle} saved successfully.`,
          "success",
        );
        setIsModalOpen(false);
        fetchModuleData();
        return;
      }
      if (isRoomInventoryView && editingItem?._id) {
        await api.post(
          `/admin/crud/rooms?subKey=${activeSubKey || "availability"}`,
          {
            _id: editingItem._id,
            totalInventory: Number(formData.totalInventory) || 0,
            maintenanceCount: Number(formData.maintenanceCount) || 0,
            customPrice:
              formData.customPrice === "" || formData.customPrice == null
                ? null
                : Number(formData.customPrice),
            isClosed: String(formData.isClosed) === "true",
            note: formData.note || "",
          },
        );
        announceRoomsChanged();
        addNotification("Availability Updated", "The calendar now reflects this change.", "success");
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
      const isHomepageBanner = activeModule === "banner";
      const isFeaturedBanner = activeModule === "featured_banner";
      const bannerCategory = isHomepageBanner ? formData.category || "hero_banner" : undefined;
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
        ...(isHomepageBanner
          ? {
              category: bannerCategory,
              section: bannerCategory,
              deviceType: formData.deviceType || "both",
            }
          : {}),
        status: formData.status || "active",
        image: bannerImage,
        imageUrl: bannerImage,
        gallery: Array.isArray(formData.gallery) ? formData.gallery : [],
      };

      const endpoint = `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;
      await api.post(endpoint, payload);

      if (isHomepageBanner) {
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
        isFeaturedBanner ? "Featured Banner Published" : "Changes Saved",
        isFeaturedBanner
          ? "The Featured Sacred Event section is now updated on the public homepage."
          : "Banner updated and published live on homepage.",
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
      if (activeModule === "bookings" && activeSubKey !== "refunds") {
        await api.put(`/bookings/${savedData._id}/admin`, {
          assignedRoomNumber: savedData.assignedRoomNumber || undefined,
          specialRequests: savedData.specialRequests ?? "",
        });
        addNotification(
          "Booking Updated",
          "The editable booking details were updated and audited.",
          "success",
        );
        fetchModuleData();
        return;
      }
      if (isRoomCategoryView && savedData._id) {
        await roomService.update(savedData._id, {
          name: String(savedData.name || "").trim(),
          type: savedData.type,
          acType: savedData.acType,
          capacity: Number(savedData.capacity),
          totalInventory: Number(savedData.totalInventory),
          basePrice: Number(savedData.basePrice),
          status: savedData.status,
        });
        announceRoomsChanged();
        addNotification("Saved Successfully", "Room and inventory data are now live.", "success");
        fetchModuleData();
        return;
      }
      if (isRoomPricingView && savedData._id) {
        await api.post(`/admin/crud/rooms?subKey=${activeSubKey || "pricing"}`, {
          _id: savedData._id,
          sourceRoomId: savedData.sourceRoomId || savedData.roomId?._id,
          name: savedData.name,
          validFrom: savedData.validFrom || undefined,
          validUntil: savedData.validUntil || undefined,
          multiplier: Number(savedData.multiplier) || 1,
          overridePrice: Number(savedData.overridePrice) || 0,
        });
        announceRoomsChanged();
        addNotification("Pricing Updated", "The new rate is live for new bookings.", "success");
        fetchModuleData();
        return;
      }
      if (isRoomInventoryView && savedData._id) {
        await api.post(
          `/admin/crud/rooms?subKey=${activeSubKey || "availability"}`,
          {
            _id: savedData._id,
            totalInventory: Number(savedData.totalInventory) || 0,
            maintenanceCount: Number(savedData.maintenanceCount) || 0,
            customPrice:
              savedData.customPrice === "" || savedData.customPrice == null
                ? null
                : Number(savedData.customPrice),
            isClosed:
              savedData.isClosed === true || String(savedData.isClosed) === "true",
            note: savedData.note || "",
          },
        );
        announceRoomsChanged();
        addNotification("Availability Updated", "The calendar now reflects this change.", "success");
        fetchModuleData();
        return;
      }
      if (isAartiConfigurationView && savedData._id) {
        const payload: Record<string, unknown> = { ...savedData };
        ["ashramId", "sessionId", "passTypeId", "userId"].forEach((key) => {
          if (savedData[key]) payload[key] = savedData[key]?._id || savedData[key];
        });
        [
          "includesPrasad",
          "includesSankalp",
          "isActive",
          "isClosed",
          "allowOnlineBooking",
          "allowCancellation",
          "requireDevoteeNames",
        ].forEach((key) => {
          if (savedData[key] !== undefined && savedData[key] !== "") {
            payload[key] =
              savedData[key] === true || String(savedData[key]) === "true";
          }
        });
        if (activeModule === "aarti_pricing") {
          payload.daysOfWeek = Array.isArray(savedData.daysOfWeek)
            ? savedData.daysOfWeek
            : String(savedData.daysOfWeek || "")
                .split(",")
                .map((value) => Number(value.trim()))
                .filter(
                  (value) =>
                    Number.isInteger(value) && value >= 0 && value <= 6,
                );
        }
        await api.post(
          `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`,
          payload,
        );
        addNotification(
          "Aarti Configuration Updated",
          `${displayTitle} saved successfully.`,
          "success",
        );
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
            ownerId:
              savedData.ownerId?._id ?? savedData.ownerId ?? undefined,
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

  const crudDeletePath = (id: string) =>
    `/admin/crud/${activeModule}/${id}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;

  const handleDelete = async (id: string) => {
    try {
      if (activeModule === "bookings" && activeSubKey !== "refunds") {
        await api.delete(`/bookings/${id}/admin`);
        addNotification(
          "Booking Deleted",
          "The eligible unpaid booking was deleted from active administration records.",
          "info",
        );
        setData((current) =>
          current.filter((item) => (item._id || item.id) !== id),
        );
        return;
      }
      if (isRoomCategoryView) {
        await roomService.remove(id);
        announceRoomsChanged();
        addNotification("Room Removed", "The room category was removed safely.", "success");
        fetchModuleData();
        return;
      }
      if (isRoomPricingView || isRoomInventoryView) {
        await api.delete(crudDeletePath(id));
        announceRoomsChanged();
        addNotification("Removed", "The record was removed.", "info");
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
      const results = await Promise.allSettled(
        ids.map((id) =>
          activeModule === "bookings" && activeSubKey !== "refunds"
            ? api.delete(`/bookings/${id}/admin`)
            : api.delete(crudDeletePath(id)),
        ),
      );
      const removed = results.filter((result) => result.status === "fulfilled").length;
      const protectedCount = results.length - removed;
      const partialMessage =
        activeModule === "bookings"
          ? `${removed} eligible unpaid booking${removed === 1 ? " was" : "s were"} deleted. ${protectedCount} paid or active record${protectedCount === 1 ? " was" : "s were"} protected.`
          : isRoomPricingView
            ? `${removed} seasonal pricing rule${removed === 1 ? " was" : "s were"} deleted. ${protectedCount} base price${protectedCount === 1 ? " is" : "s are"} protected and must be edited through the room category.`
            : `${removed} record${removed === 1 ? " was" : "s were"} deleted. ${protectedCount} record${protectedCount === 1 ? " was" : "s were"} protected or could not be deleted.`;
      addNotification(
        protectedCount ? "Bulk Delete Partially Completed" : "Bulk Delete Complete",
        protectedCount
          ? partialMessage
          : `${removed} records removed.`,
        protectedCount ? "warning" : "info",
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

  const handleBulkStatus = async (
    ids: string[],
    next: "active" | "suspended",
  ) => {
    const selected = data.filter((item) =>
      ids.includes(String(item._id || item.id)),
    );
    const results = await Promise.allSettled(
      selected.map(async (item) => {
        if (activeModule === "parking_partners") {
          return parkingAdminService.updatePartnerStatus(item._id || item.id, {
            status: next,
            ...(next === "suspended"
              ? { rejectionReason: "Suspended by Super Admin" }
              : {}),
          });
        }
        if (activeModule === "rooms") {
          return roomService.update(item._id || item.id, {
            status: next === "active" ? "active" : "under_maintenance",
          });
        }
        if (activeModule === "ashrams") {
          return api.post("/admin/crud/ashrams", {
            ...item,
            status: next === "active" ? "approved" : "suspended",
            isVerified: next === "active",
          });
        }
        return api.post(
          `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ""}`,
          {
            ...item,
            status: next === "active" ? "active" : "suspended",
            ...(Object.prototype.hasOwnProperty.call(item, "isVerified")
              ? { isVerified: next === "active" }
              : {}),
          },
        );
      }),
    );
    const updated = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - updated;
    addNotification(
      failed ? "Bulk Status Partially Updated" : "Bulk Status Updated",
      `${updated} record${updated === 1 ? "" : "s"} ${next === "active" ? "activated" : "suspended"}.${failed ? ` ${failed} record${failed === 1 ? " was" : "s were"} protected or could not be updated.` : ""}`,
      failed ? "warning" : "success",
    );
    fetchModuleData();
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
            {!isReadOnlyFinance && activeModule !== "bookings" && !isRoomInventoryView && (
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
                  : isRoomCategoryView
                    ? "Add Room Category"
                    : isRoomPricingView
                      ? "Add Seasonal Price"
                      : `Add New ${formatTitle(activeModule).replace(/s$/, "")}`}
              </button>
            )}
          </div>
        }
      />



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
          "featured_banner",
          "blogs",
          "marketplace",
          "local",
          "temples",
          "events",
          "parking_locations",
        ].includes(activeModule)}
        detailVariant={activeModule === "bookings" ? "table" : "cards"}
        bulkDeleteLabel={
          activeModule === "bookings" ? "Delete Unpaid" : "Bulk Delete"
        }
        deleteLabel={
          activeModule === "bookings" ? "Delete Unpaid Booking" : "Delete"
        }
        statusOptions={
          activeModule === "bookings"
            ? [
                "pending",
                "confirmed",
                "checked_in",
                "checked_out",
                "completed",
                "cancelled",
                "refunded",
                "no_show",
                "expired",
              ]
            : undefined
        }
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
          isReadOnlyFinance || isRoomInventoryView
            ? undefined
            : (ids) => handleBulkDelete(ids)
        }
        onBulkApprove={
          isReadOnlyFinance || activeModule === "rooms" || activeModule === "bookings" ? undefined : (ids) => handleBulkApprove(ids)
        }
        onBulkReject={
          isReadOnlyFinance || activeModule === "rooms" || activeModule === "bookings" ? undefined : (ids) => handleBulkReject(ids)
        }
        onBulkActivate={
          isReadOnlyFinance || !supportsBulkLifecycle
            ? undefined
            : (ids) => handleBulkStatus(ids, "active")
        }
        onBulkSuspend={
          isReadOnlyFinance || !supportsBulkLifecycle
            ? undefined
            : (ids) => handleBulkStatus(ids, "suspended")
        }
        onToggleStatus={
          isReadOnlyFinance || activeModule === "bookings" ? undefined : (item) => handleToggleStatus(item)
        }
        onResetOwnerPassword={
          activeModule === "ashrams"
            ? async (ownerId, password) => {
                await userService.resetPassword(ownerId, password);
                addNotification(
                  "Owner Password Changed",
                  "The owner password was changed securely and existing sessions were invalidated.",
                  "success",
                );
              }
            : undefined
        }
      />

      <LocalHubEnterpriseDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        item={managingItem}
        categoryKey={activeSubKey || "transport"}
        onSave={async (updatedData) => {
          const endpoint = `/admin/crud/local${activeSubKey ? `?subKey=${activeSubKey}` : ""}`;
          await api.post(endpoint, updatedData);
          addNotification(
            "Changes Saved",
            `${updatedData.title || "Local service"} was updated successfully.`,
            "success",
          );
          setIsDrawerOpen(false);
          fetchModuleData();
        }}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-5xl w-full rounded-[28px] p-6 space-y-5 text-left shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base sm:text-lg text-[#0B192C] dark:text-white">
                {editingItem ? `Edit ${recordLabel}` : `Create New ${recordLabel}`}
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
              {formUsesImages ? (
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
              ) : null}

              {activeModule === "featured_banner" && (
                <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <div>
                    <label className="mb-1.5 block font-bold text-gray-700 dark:text-gray-300">
                      Search Ashrams
                    </label>
                    <input
                      type="search"
                      value={featuredAshramSearch}
                      onChange={(event) => setFeaturedAshramSearch(event.target.value)}
                      placeholder="Search by Ashram name, code, district or state..."
                      className="w-full rounded-xl border border-blue-200 bg-white p-3 font-semibold text-gray-800 outline-none focus:border-[#0A4DA6] dark:border-slate-700 dark:bg-[#0B192C] dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block font-bold text-gray-700 dark:text-gray-300">
                        State <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.relatedState || ""}
                        onChange={(event) =>
                          setFormData({
                            ...formData,
                            relatedState: event.target.value,
                            relatedDistrict: "",
                            relatedAshramId: "",
                            relatedAshramName: "",
                            ctaUrl: String(formData.ctaUrl || "").startsWith("/ashram/")
                              ? ""
                              : formData.ctaUrl,
                          })
                        }
                        className="w-full rounded-xl border border-blue-200 bg-white p-3 font-bold text-[#0A4DA6] outline-none dark:border-slate-700 dark:bg-[#0B192C]"
                      >
                        <option value="">Select State</option>
                        {featuredStates.map((state) => (
                          <option key={String(state)} value={String(state)}>{String(state)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block font-bold text-gray-700 dark:text-gray-300">
                        District <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        disabled={!formData.relatedState}
                        value={formData.relatedDistrict || ""}
                        onChange={(event) =>
                          setFormData({
                            ...formData,
                            relatedDistrict: event.target.value,
                            relatedAshramId: "",
                            relatedAshramName: "",
                            ctaUrl: String(formData.ctaUrl || "").startsWith("/ashram/")
                              ? ""
                              : formData.ctaUrl,
                          })
                        }
                        className="w-full rounded-xl border border-blue-200 bg-white p-3 font-bold text-[#0A4DA6] outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-[#0B192C]"
                      >
                        <option value="">Select District</option>
                        {featuredDistricts.map((district) => (
                          <option key={String(district)} value={String(district)}>{String(district)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block font-bold text-gray-700 dark:text-gray-300">
                        Ashram <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        disabled={!formData.relatedDistrict}
                        value={formData.relatedAshramId || ""}
                        onChange={(event) => {
                          const selected = featuredAshrams.find(
                            (item: any) => String(item._id || item.id) === event.target.value,
                          );
                          const ashramId = String(selected?._id || selected?.id || "");
                          setFormData({
                            ...formData,
                            relatedAshramId: ashramId,
                            relatedAshramName: selected?.name || "",
                            relatedAshramSlug: selected?.slug || "",
                            ctaUrl: formData.ctaUrl || (ashramId ? `/ashram/${ashramId}` : ""),
                          });
                        }}
                        className="w-full rounded-xl border border-blue-200 bg-white p-3 font-bold text-[#0A4DA6] outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-[#0B192C]"
                      >
                        <option value="">Select Ashram</option>
                        {filteredFeaturedAshrams.map((item: any) => {
                          const value = String(item._id || item.id);
                          return <option key={value} value={value}>{item.name || item.ashramCode || value}</option>;
                        })}
                      </select>
                    </div>
                  </div>

                  <p className="text-[10px] font-semibold text-gray-500">
                    The selected State, District and Ashram control the destination route and which Ashram offers appear on the Featured Banner detail page.
                  </p>

                  <div className="border-t border-blue-100 pt-4 dark:border-slate-700">
                  <label className="mb-1.5 block font-bold text-gray-700 dark:text-gray-300">
                    Related Tirvona Content <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.linkedEntityId || ""}
                    onChange={(event) => {
                      const selected = (bannerEntities[formData.relatedContentType] || []).find(
                        (item: any) => String(item._id || item.id || item.slug || item.city || item.name) === event.target.value,
                      );
                      if (!selected) {
                        setFormData({ ...formData, linkedEntityId: "" });
                        return;
                      }
                      const entityId = String(selected._id || selected.id || selected.slug || selected.city || selected.name);
                      const entityName = selected.name || selected.title || selected.city || selected.label || entityId;
                      const entitySlug = selected.slug || selected.code || "";
                      const entityImage = selected.coverImageUrl || selected.coverImage || selected.imageUrl || selected.image || selected.images?.[0] || "";
                      setFormData({
                        ...formData,
                        linkedEntityId: entityId,
                        linkedEntitySlug: entitySlug,
                        linkedEntityName: entityName,
                        title: formData.title || entityName,
                        description: formData.description || selected.description || selected.about || selected.excerpt || "",
                        location: formData.location || selected.address?.city || selected.city || selected.location || "",
                        image: formData.image || entityImage,
                        coverImage: formData.coverImage || entityImage,
                        imageUrl: formData.imageUrl || entityImage,
                      });
                    }}
                    className="w-full rounded-xl border border-blue-200 bg-white p-3 font-bold text-[#0A4DA6] outline-none dark:border-slate-700 dark:bg-[#0B192C]"
                  >
                    <option value="">Select related {humanizeLabel(formData.relatedContentType || "content")}</option>
                    {(bannerEntities[formData.relatedContentType] || []).map((item: any) => {
                      const value = String(item._id || item.id || item.slug || item.city || item.name);
                      const label = item.name || item.title || item.city || item.label || value;
                      return <option key={value} value={value}>{label}</option>;
                    })}
                  </select>
                  <p className="mt-1.5 text-[10px] font-semibold text-gray-500">
                    Selecting content links this banner to its live Tirvona record and pre-fills available details. You can still customize the banner copy and CTA below.
                  </p>
                  </div>
                </div>
              )}

              {(isRoomCategoryView || isAartiSessionView) && (
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Ashram <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    disabled={!!editingItem}
                    value={
                      formData.ashramId ||
                      editingItem?.ashramId?._id ||
                      ""
                    }
                    onChange={(e) => {
                      const ashram = roomAshramOptions.find(
                        (item: any) => String(item._id) === e.target.value,
                      );
                      const state = ashram?.address?.state || "";
                      const preferredCity =
                        ashram?.address?.city || ashram?.address?.district || "";
                      const stateEntry = getAllStates().find(
                        (item) => item.name === state,
                      );
                      const districts = stateEntry
                        ? getDistricts(stateEntry.code)
                        : [];
                      const city = districts.includes(preferredCity)
                        ? preferredCity
                        : districts.includes(ashram?.address?.district)
                          ? ashram.address.district
                          : districts[0] || "";
                      setFormData({
                        ...formData,
                        ashramId: e.target.value,
                        ...(isAartiSessionView && state ? { state } : {}),
                        ...(isAartiSessionView && city ? { city } : {}),
                      });
                    }}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#0A4DA6] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Select an ashram</option>
                    {roomAshramOptions.map((a: any) => (
                      <option key={String(a._id)} value={String(a._id)}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isRoomPricingView && (
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Room Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    disabled={!!editingItem}
                    value={
                      formData.sourceRoomId ||
                      editingItem?.sourceRoomId ||
                      editingItem?.roomId?._id ||
                      ""
                    }
                    onChange={(e) =>
                      setFormData({ ...formData, sourceRoomId: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#0A4DA6] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a room category</option>
                    {roomCategoryOptions.map((room: any) => (
                      <option key={String(room._id)} value={String(room._id)}>
                        {room.name}
                        {room.ashramId?.name ? ` — ${room.ashramId.name}` : ""}
                      </option>
                    ))}
                  </select>
                  {editingItem?.priceType === "Base price" && (
                    <p className="mt-1.5 text-[10px] font-semibold text-gray-500">
                      This is the room's own base price. Saving updates the
                      category's rate directly; the seasonal fields are ignored.
                    </p>
                  )}
                </div>
              )}

              {(requiresAartiSession || showAartiSettingSession) && (
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Aarti <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    disabled={!!editingItem}
                    value={formData.sessionId || ""}
                    onChange={(event) => {
                      const session = aartiSessionOptions.find(
                        (item) => String(item._id) === event.target.value,
                      );
                      setFormData({
                        ...formData,
                        sessionId: event.target.value,
                        ashramId:
                          session?.ashramId?._id || session?.ashramId || "",
                        passTypeId: "",
                      });
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-bold text-[#0A4DA6] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="">Select an Aarti</option>
                    {aartiSessionOptions.map((session) => (
                      <option key={String(session._id)} value={String(session._id)}>
                        {session.name}
                        {session.ashramId?.name
                          ? ` — ${session.ashramId.name}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {requiresAartiPass && (
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Pass Type
                    {activeModule === "aarti_availability" ? (
                      <span className="text-rose-500"> *</span>
                    ) : null}
                  </label>
                  <select
                    required={activeModule === "aarti_availability"}
                    disabled={!!editingItem || !formData.sessionId}
                    value={formData.passTypeId || ""}
                    onChange={(event) =>
                      setFormData({ ...formData, passTypeId: event.target.value })
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-bold text-[#0A4DA6] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="">
                      {activeModule === "aarti_pricing"
                        ? "All pass types"
                        : "Select a pass type"}
                    </option>
                    {filteredAartiPassOptions.map((pass) => (
                      <option key={String(pass._id)} value={String(pass._id)}>
                        {pass.name} ({pass.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeModule === "aarti_staff" && (
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Staff Member <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    disabled={!!editingItem}
                    value={formData.userId || ""}
                    onChange={(event) =>
                      setFormData({ ...formData, userId: event.target.value })
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-bold text-[#0A4DA6] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="">Select a staff member</option>
                    {aartiUserOptions.map((member) => (
                      <option key={String(member._id)} value={String(member._id)}>
                        {member.name || member.email}
                        {member.email ? ` — ${member.email}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {showAartiAshram && (
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Ashram <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    disabled={!!editingItem}
                    value={formData.ashramId || ""}
                    onChange={(event) =>
                      setFormData({ ...formData, ashramId: event.target.value })
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-bold text-[#0A4DA6] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="">Select an ashram</option>
                    {roomAshramOptions.map((ashram) => (
                      <option key={String(ashram._id)} value={String(ashram._id)}>
                        {ashram.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {moduleConfig.fields
                  .filter(
                    (field) =>
                      import.meta.env.DEV ||
                      !["coverImage", "coverImageUrl", "imageUrl", "bannerImage", "thumbnailUrl"].includes(
                        field.name,
                      ),
                  )
                  .map((f) => (
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
                        required={f.required}
                        value={
                          formData[f.name] || (f.options ? f.options[0] : "")
                        }
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          const nextState =
                            f.name === "state"
                              ? getAllStates().find((state) => state.name === nextValue)
                              : undefined;
                          setFormData({
                            ...formData,
                            [f.name]: nextValue,
                            ...(nextState
                              ? { city: getDistricts(nextState.code)[0] || "" }
                              : {}),
                            ...(f.name === "relatedContentType"
                              ? {
                                  linkedEntityId: "",
                                  linkedEntitySlug: "",
                                  linkedEntityName: "",
                                }
                              : {}),
                            ...(f.name === "scope"
                              ? { ashramId: "", sessionId: "" }
                              : {}),
                          });
                        }}
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
