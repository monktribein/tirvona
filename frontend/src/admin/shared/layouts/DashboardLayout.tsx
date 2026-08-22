import React, { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import NotificationDropdown from "../../../components/shared/NotificationDropdown";
import GlobalSearch, {
  type SearchableLink,
} from "../components/GlobalSearch";
import { isParkingRole } from "../../../utils/roleRedirect";
import { useLanguage } from "../../../contexts/LanguageContext";
import {
  LayoutDashboard,
  Bed,
  Calendar,
  ShieldAlert,
  Users,
  LogOut,
  FileCheck,
  LifeBuoy,
  Menu,
  X,
  ClipboardList,
  Tag,
  Building,
  Heart,
  ChevronDown,
  ChevronRight,
  MapPin,
  Compass,
  ShoppingBag,
  Image,
  BarChart3,
  Bell,
  ShieldCheck,
  Globe,
  ArrowRight,
  Landmark,
  Car,
  Flame,
  Radio,
  PartyPopper,
  Undo2,
  ContactRound,
  Sparkles,
  DollarSign,
} from "lucide-react";

interface NavGroup {
  groupName: string;
  icon: React.ReactNode;
  links: { label: string; path: string }[];
}

const SIDEBAR_SEQUENCE = [
  "user & access",
  "institution",
  "ashram",
  "room",
  "platform fee",
  "booking",
  "aarti",
  "live pooja",
  "parking",
  "payout",
  "refund",
  "offers",
  "marketplace",
  "local services",
  "content",
  "homepage",
  "featured",
  "pilgrimage",
  "staff",
  "volunteer",
  "lead",
  "smart contact",
  "verification",
  "reports",
  "system",
  "notification",
] as const;

const MATERIAL_ICON_BY_SECTION: Array<[string, string]> = [
  ["dashboard", "dashboard"],
  ["user & access", "manage_accounts"],
  ["institution", "account_balance"],
  ["ashram", "temple_hindu"],
  ["room", "bed"],
  ["platform fee", "payments"],
  ["booking", "event_note"],
  ["aarti", "local_fire_department"],
  ["live pooja", "live_tv"],
  ["parking", "local_parking"],
  ["payout", "account_balance_wallet"],
  ["refund", "currency_exchange"],
  ["offers", "sell"],
  ["marketplace", "storefront"],
  ["local services", "home_repair_service"],
  ["content", "campaign"],
  ["homepage", "image"],
  ["featured", "auto_awesome"],
  ["pilgrimage", "explore"],
  ["staff", "groups"],
  ["volunteer", "volunteer_activism"],
  ["lead", "assignment_ind"],
  ["smart contact", "contacts"],
  ["verification", "verified_user"],
  ["reports", "analytics"],
  ["system", "admin_panel_settings"],
  ["notification", "notifications"],
];

const materialIconFor = (label: string): string => {
  const normalized = label.toLowerCase();
  return (
    MATERIAL_ICON_BY_SECTION.find(([section]) =>
      normalized.includes(section),
    )?.[1] ?? "apps"
  );
};

const MaterialSidebarIcon: React.FC<{ label: string }> = ({ label }) => (
  <span className="material-symbols-rounded sidebar-material-icon" aria-hidden="true">
    {materialIconFor(label)}
  </span>
);

const orderSidebarGroups = (groups: NavGroup[]): NavGroup[] =>
  groups
    .map((group, originalIndex) => ({ group, originalIndex }))
    .sort((left, right) => {
      const rank = (name: string) => {
        const normalized = name.toLowerCase();
        const index = SIDEBAR_SEQUENCE.findIndex((section) =>
          normalized.includes(section),
        );
        return index === -1 ? SIDEBAR_SEQUENCE.length : index;
      };
      return (
        rank(left.group.groupName) - rank(right.group.groupName) ||
        left.originalIndex - right.originalIndex
      );
    })
    .map(({ group }) => group);

const getFormattedRole = (role?: string): string => {
  if (!role) return "User";
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "ashram_admin":
    case "stay_admin":
      return "Ashram Admin";
    case "ashram_owner":
    case "owner":
      return "Ashram Owner";
    case "support":
      return "Support";
    case "reception":
      return "Reception";
    case "district_officer":
    case "district_admin":
      return "District Admin";
    case "govt_admin":
    case "government_admin":
      return "Government Admin";
    case "parking_partner":
      return "Parking Partner";
    case "parking_manager":
      return "Parking Manager";
    case "security_guard":
      return "Security Guard";
    case "customer":
    case "pilgrim":
      return "Customer";
    case "volunteer":
      return "Volunteer";
    case "manager":
      return "Manager";
    case "housekeeping":
      return "Housekeeping";
    default:
      return role
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
  }
};

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [languageOpen, setLanguageOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  React.useEffect(() => {
    const activeGroup = superAdminGroups.find((group) =>
      group.links.some(
        (l) =>
          location.pathname === l.path ||
          (l.path !== "/admin/dashboard" &&
            location.pathname.startsWith(l.path)),
      ),
    );

    if (activeGroup) {
      setOpenGroups({ [activeGroup.groupName]: true });
      sessionStorage.setItem("sidebar_open_group", activeGroup.groupName);
    } else {
      const savedGroup = sessionStorage.getItem("sidebar_open_group");
      if (savedGroup) {
        setOpenGroups({ [savedGroup]: true });
      } else {
        setOpenGroups({});
      }
    }
  }, [location.pathname]);

  const toggleGroup = (groupName: string) => {
    setOpenGroups((prev) => {
      const isCurrentlyOpen = !!prev[groupName];
      if (isCurrentlyOpen) {
        sessionStorage.removeItem("sidebar_open_group");
        return {};
      } else {
        sessionStorage.setItem("sidebar_open_group", groupName);
        return { [groupName]: true };
      }
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("sidebar_open_group");
    logout();
    navigate("/");
  };

  React.useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const superAdminGroups: NavGroup[] = [
    {
      groupName: "User & Access Management",
      icon: <Users size={15} />,
      links: [
        { label: "All User Accounts", path: "/admin/users" },
      ],
    },
    {
      groupName: "Institution Management",
      icon: <Landmark size={15} />,
      links: [
        { label: "Institution Profiles", path: "/admin/manage/institution" },
        {
          label: "Trust & Legal Bodies",
          path: "/admin/manage/institution/trusts",
        },
        {
          label: "Contacts Directory",
          path: "/admin/manage/institution_contacts",
        },
        {
          label: "Locations & GPS",
          path: "/admin/manage/institution_locations",
        },
        { label: "Quality & Audit", path: "/admin/manage/institution_audits" },
      ],
    },
    {
      groupName: "Ashram Management",
      icon: <Building size={15} />,
      links: [
        { label: "All Ashrams", path: "/admin/manage/ashrams/all" },
        { label: "Pending Verification", path: "/admin/verifications" },
        { label: "Approved Ashrams", path: "/admin/manage/ashrams/approved" },
        { label: "Rejected Ashrams", path: "/admin/manage/ashrams/rejected" },
      ],
    },
    {
      groupName: "Room & Inventory Management",
      icon: <Bed size={15} />,
      links: [
        {
          label: "Room Category Approvals",
          path: "/admin/approvals/room-categories",
        },
        { label: "Room Categories", path: "/admin/manage/rooms/all" },
        { label: "Room Availability", path: "/admin/manage/rooms/availability" },
        { label: "Room Pricing", path: "/admin/manage/rooms/pricing" },
        { label: "Room Inventory", path: "/admin/manage/rooms/inventory" },
      ],
    },
    {
      groupName: "Platform Fee & Pricing",
      icon: <DollarSign size={15} />,
      links: [
        { label: "Platform Fee Settings", path: "/admin/settings/pricing" },
      ],
    },
    {
      groupName: "Booking Management",
      icon: <Calendar size={15} />,
      links: [
        { label: "All Bookings", path: "/admin/manage/bookings/all" },
        { label: "Pending Bookings", path: "/admin/manage/bookings/pending" },
        {
          label: "Confirmed Bookings",
          path: "/admin/manage/bookings/confirmed",
        },
        { label: "Checked-in Stays", path: "/admin/manage/bookings/checked_in" },
        { label: "Checked-out Stays", path: "/admin/manage/bookings/checked_out" },
        { label: "Completed Stays", path: "/admin/manage/bookings/completed" },
        { label: "Cancelled Bookings", path: "/admin/manage/bookings/cancelled" },
        { label: "Expired Bookings", path: "/admin/manage/bookings/expired" },
        { label: "No-show Bookings", path: "/admin/manage/bookings/no_show" },
        { label: "Refunded Bookings", path: "/admin/manage/bookings/refunded" },
      ],
    },
    {
      groupName: "Events & Festivals",
      icon: <PartyPopper size={15} />,
      links: [
        { label: "Events Control Center", path: "/admin/events/control" },
        { label: "Event Approvals", path: "/admin/events/approvals" },
        { label: "Event Registrations", path: "/admin/events/registrations" },
        { label: "All Events", path: "/admin/manage/event_festivals/all" },
        { label: "Pending Events", path: "/admin/manage/event_festivals/pending" },
        {
          label: "Event Day Capacity",
          path: "/admin/manage/event_availability/all",
        },
        {
          label: "Registrations (all data)",
          path: "/admin/manage/event_registrations/all",
        },
        { label: "Event Passes", path: "/admin/manage/event_qr_codes/all" },
        { label: "Event Scan Logs", path: "/admin/manage/event_scan_logs/all" },
        { label: "Event Gate Staff", path: "/admin/manage/event_staff/all" },
        {
          label: "Event Notifications",
          path: "/admin/manage/event_notifications/all",
        },
        { label: "Event Settings", path: "/admin/manage/event_settings/all" },
      ],
    },
    {
      groupName: "Pilgrimage & Planner",
      icon: <Compass size={15} />,
      links: [
        { label: "Pilgrimage Control Center", path: "/admin/circuits/control" },
        { label: "Circuit Approvals", path: "/admin/circuits/approvals" },
        { label: "All Circuits", path: "/admin/manage/pilgrimage_circuits/all" },
        {
          label: "Pending Circuits",
          path: "/admin/manage/pilgrimage_circuits/pending",
        },
        { label: "Circuit Stops", path: "/admin/manage/pilgrimage_stops/all" },
        {
          label: "Saved Itineraries",
          path: "/admin/manage/pilgrimage_itineraries/all",
        },
        {
          label: "Pilgrimage Settings",
          path: "/admin/manage/pilgrimage_settings/all",
        },
      ],
    },
    {
      groupName: "Aarti Bookings",
      icon: <Flame size={15} />,
      links: [
        { label: "Aarti Approvals", path: "/admin/aarti/approvals/aarti" },
        { label: "All Aartis", path: "/admin/manage/aarti_sessions/all" },
        { label: "Aarti Bookings", path: "/admin/aarti/bookings" },
        { label: "Aarti Passes", path: "/admin/manage/aarti_pass_types/all" },
        { label: "Aarti Pricing Rules", path: "/admin/manage/aarti_pricing/all" },
        { label: "Aarti Availability", path: "/admin/manage/aarti_availability/all" },
        { label: "Aarti Gate Staff", path: "/admin/manage/aarti_staff/all" },
        { label: "Aarti Payments", path: "/admin/manage/aarti_payments/all" },
        { label: "Aarti Reviews", path: "/admin/manage/aarti_reviews/all" },
        { label: "Aarti Settings", path: "/admin/manage/aarti_settings/all" },
      ],
    },
    {
      groupName: "Live Pooja",
      icon: <Radio size={15} />,
      links: [
        {
          label: "Live Pooja Approvals",
          path: "/admin/aarti/approvals/live-pooja",
        },
        {
          label: "All Live Poojas",
          path: "/admin/manage/aarti_streams/all",
        },
        {
          label: "Pending Live Poojas",
          path: "/admin/manage/aarti_streams/pending",
        },
      ],
    },
    {
      groupName: "Parking Management",
      icon: <Car size={15} />,
      links: [
        { label: "Parking Operations Dashboard", path: "/parking/dashboard" },
        { label: "Parking Control Center", path: "/admin/parking/control" },
        { label: "Parking Staff & Roles", path: "/admin/parking/roles" },
        { label: "Parking Partners", path: "/admin/manage/parking_partners/all" },
        {
          label: "Pending Parking Partners",
          path: "/admin/manage/parking_partners/pending",
        },
        { label: "Parking Locations", path: "/admin/manage/parking_locations/all" },
        { label: "Parking Bookings", path: "/admin/manage/parking_bookings/all" },
        {
          label: "Vehicles On-Site",
          path: "/admin/manage/parking_bookings/checked_in",
        },
        { label: "Parking Slot Types", path: "/admin/manage/parking_slot_types/all" },
        { label: "Parking Slots", path: "/admin/manage/parking_slots/all" },
        { label: "Parking Pricing Rules", path: "/admin/manage/parking_pricing/all" },
        {
          label: "Pending Parking Commissions",
          path: "/admin/manage/parking_commissions/pending",
        },
        {
          label: "Parking Transactions",
          path: "/admin/manage/parking_transactions/all",
        },
        { label: "Parking Scan Logs", path: "/admin/manage/parking_scan_logs/all" },
        { label: "Parking Reviews", path: "/admin/manage/parking_reviews/all" },
      ],
    },
    {
      groupName: "Content & Promotions",
      icon: <Tag size={15} />,
      links: [
        { label: "All Offers", path: "/admin/manage/offers/all" },
        { label: "Featured Offers", path: "/admin/manage/offers/featured" },
        { label: "All Blogs", path: "/admin/manage/blogs/all" },
        { label: "Visitor Articles", path: "/admin/articles" },
        { label: "Blog Categories", path: "/admin/manage/blogs/categories" },
        { label: "Author Approvals", path: "/admin/manage/blogs/authors" },
      ],
    },
    {
      groupName: "Pilgrimage Planning",
      icon: <Compass size={15} />,
      links: [
        { label: "Spiritual Circuits", path: "/admin/manage/planner/circuits" },
        { label: "Temple Directory", path: "/admin/manage/planner/temples" },
        { label: "Yatra Routes", path: "/admin/manage/planner/routes" },
        { label: "Itineraries", path: "/admin/manage/planner/itineraries" },
        { label: "Ritual Packages", path: "/admin/manage/planner/rituals" },
      ],
    },
    {
      groupName: "Local Services Management",
      icon: <Compass size={15} />,
      links: [
        { label: "Local Transport Services", path: "/admin/manage/local/transport" },
        { label: "Local Guides", path: "/admin/manage/local/guides" },
        { label: "Restaurants", path: "/admin/manage/local/restaurants" },
        { label: "Medical Services", path: "/admin/manage/local/medical" },
        { label: "Emergency Services", path: "/admin/manage/local/emergency" },
        { label: "Local Shops", path: "/admin/manage/local/shops" },
        { label: "Photography Services", path: "/admin/manage/local/photography" },
        { label: "Local Events", path: "/admin/manage/local/events" },
      ],
    },
    {
      groupName: "Marketplace Management",
      icon: <ShoppingBag size={15} />,
      links: [
        { label: "Marketplace Products", path: "/admin/manage/marketplace/products" },
        { label: "Marketplace Categories", path: "/admin/manage/marketplace/categories" },
        { label: "Marketplace Vendors", path: "/admin/manage/marketplace/vendors" },
        { label: "Marketplace Orders", path: "/admin/manage/marketplace/orders" },
        { label: "Marketplace Waitlist", path: "/admin/manage/marketplace/waitlist" },
        { label: "Marketplace Newsletter", path: "/admin/manage/marketplace/newsletter" },
      ],
    },
    {
      groupName: "Homepage Banners",
      icon: <Image size={15} />,
      links: [
        { label: "Homepage Banner Management", path: "/admin/manage/banner/homepage" },
      ],
    },
    {
      groupName: "Featured Banner",
      icon: <Sparkles size={15} />,
      links: [
        { label: "Featured Banner Management", path: "/admin/manage/featured_banner/homepage" },
      ],
    },
    {
      groupName: "Lead Collection Management",
      icon: <ClipboardList size={15} />,
      links: [
        { label: "All Leads", path: "/admin/lead-collection/leads" },
        { label: "Field Executives", path: "/admin/lead-collection/agents" },
      ],
    },
    {
      groupName: "Smart Contact Profiles",
      icon: <ContactRound size={15} />,
      links: [
        { label: "All Profiles", path: "/admin/smart-contacts" },
        { label: "Active", path: "/admin/smart-contacts?status=ACTIVE" },
        { label: "Disabled", path: "/admin/smart-contacts?status=SUSPENDED" },
        {
          label: "Employees",
          path: "/admin/smart-contacts?category=employee",
        },
        { label: "Partners", path: "/admin/smart-contacts?category=partner" },
        {
          label: "District Partners",
          path: "/admin/smart-contacts?category=district-partner",
        },
        { label: "QR Analytics", path: "/admin/smart-contacts/analytics" },
      ],
    },
    {
      groupName: "Volunteer Management",
      icon: <Heart size={15} />,
      links: [
        { label: "Openings & Applications", path: "/admin/volunteer" },
      ],
    },
    {
      groupName: "Payout Management",
      icon: <DollarSign size={15} />,
      links: [{ label: "Payout Dashboard", path: "/admin/payouts" }],
    },
    {
      groupName: "Refund Management",
      icon: <Undo2 size={15} />,
      links: [
        { label: "Refund Queue", path: "/admin/refunds" },
        { label: "Refund Policies", path: "/admin/refunds/policies" },
      ],
    },
    {
      groupName: "Reports & Audit",
      icon: <BarChart3 size={15} />,
      links: [
        { label: "Revenue Reports", path: "/admin/manage/reports/revenue" },
        { label: "Booking Telemetry", path: "/admin/manage/reports/bookings" },
        { label: "System Audit Logs", path: "/admin/audit-logs" },
      ],
    },
    {
      groupName: "Notification Center",
      icon: <Bell size={15} />,
      links: [
        {
          label: "Notification Center",
          path: "/admin/enterprise-notifications",
        },
      ],
    },
  ];

  const accommodationRole = user?.role || "";
  const ownerBase = ["ashram_admin", "stay_admin"].includes(accommodationRole)
    ? "/ashram-admin"
    : ["ashram_owner", "owner"].includes(accommodationRole)
      ? "/ashram-owner"
      : "/owner";
  const ownerGroups: NavGroup[] = [
    {
      groupName: "Ashram management",
      icon: <Building size={15} />,
      links: [
        { label: "Manage Ashrams", path: `${ownerBase}/ashrams` },
        { label: "Add-On Services", path: `${ownerBase}/add-ons` },
      ],
    },
    {
      groupName: "Room management",
      icon: <Bed size={15} />,
      links: [
        { label: "Manage Rooms", path: `${ownerBase}/rooms` },
        { label: "Inventory Calendar", path: `${ownerBase}/calendar` },
      ],
    },
    {
      groupName: "Offers & deals",
      icon: <Tag size={15} />,
      links: [{ label: "Offers & Deals", path: `${ownerBase}/offers` }],
    },
    {
      groupName: "Volunteer & careers",
      icon: <Heart size={15} />,
      links: [{ label: "Volunteer & Careers", path: `${ownerBase}/volunteer` }],
    },
    {
      groupName: "Staff & users",
      icon: <Users size={15} />,
      links: [
        { label: "Users & Guests", path: `${ownerBase}/users` },
        { label: "Staff Management", path: `${ownerBase}/staff` },
      ],
    },
    {
      groupName: "Bookings & finance",
      icon: <Calendar size={15} />,
      links: [
        { label: "All Bookings", path: `${ownerBase}/bookings` },
        { label: "Payments", path: `${ownerBase}/payments` },
        { label: "Payout Management", path: `${ownerBase}/payouts` },
      ],
    },
    {
      groupName: "Events & Festivals",
      icon: <PartyPopper size={15} />,
      links: [
        { label: "Manage Events", path: `${ownerBase}/events` },
        {
          label: "Event Registrations",
          path: `${ownerBase}/events/registrations`,
        },
        { label: "Event Gate Scanner", path: "/events/gate" },
      ],
    },
    {
      groupName: "Pilgrimage Circuits",
      icon: <Compass size={15} />,
      links: [
        { label: "Manage Circuits", path: `${ownerBase}/circuits` },
        { label: "Itinerary Planner", path: "/destinations/planner" },
      ],
    },
    {
      groupName: "Aarti & Live Pooja",
      icon: <Flame size={15} />,
      links: [
        { label: "Manage Aartis", path: `${ownerBase}/aarti` },
        { label: "Aarti Bookings", path: `${ownerBase}/aarti/bookings` },
        { label: "Live Pooja Streams", path: `${ownerBase}/live-pooja` },
        { label: "Aarti Gate Scanner", path: "/aarti/gate" },
      ],
    },
    {
      groupName: "Parking Management",
      icon: <Car size={15} />,
      links: [
        { label: "My Ashram Parking", path: `${ownerBase}/parking` },
        { label: "Parking Operations", path: "/parking/dashboard" },
      ],
    },
  ];



  const districtAdminGroups: NavGroup[] = [
    {
      groupName: "Verifications & ashrams",
      icon: <FileCheck size={15} />,
      links: [
        { label: "Verification Queue", path: "/admin/verifications" },
        { label: "Approved Ashrams", path: "/admin/manage/ashrams/approved" },
      ],
    },
    {
      groupName: "Reports & audit",
      icon: <BarChart3 size={15} />,
      links: [
        { label: "Audit Logs", path: "/admin/audit-logs" },
        { label: "Staff Management", path: "/admin/users" },
      ],
    },
  ];

  const standardGroups: NavGroup[] = [
    {
      groupName: "System & audit",
      icon: <FileCheck size={15} />,
      links: [
        { label: "Verification Queue", path: "/admin/verifications" },
        { label: "Audit Logs", path: "/admin/audit-logs" },
        { label: "Staff Management", path: "/admin/users" },
      ],
    },
  ];

  const userHasParkingRole = isParkingRole(user?.parkingRoles, user?.role, user?.email);
  const parkingGroups: NavGroup[] = [
    {
      groupName: "Parking operations",
      icon: <Car size={15} />,
      links: [
        { label: "⚡ Operations Console", path: "/parking/dashboard" },
        { label: "Partner & Revenue Console", path: "/parking/partner" },
        { label: "Gate Scanner & Verifier", path: "/parking/gate" },
        { label: "My Parking Bookings", path: "/parking/my-bookings" },
      ],
    },
  ];

  const getRoleNavData = () => {
    if (user?.role === "super_admin") {
      return {
        topLink: {
          label: "Executive Dashboard",
          path: "/admin/dashboard",
          icon: <LayoutDashboard size={16} className="text-[#E58C28]" />,
        },
        groups: superAdminGroups,
      };
    }
    if (
      userHasParkingRole &&
      !["owner", "stay_admin", "ashram_owner", "ashram_admin"].includes(user?.role || "")
    ) {
      return {
        topLink: {
          label: "Parking Console",
          path: "/parking/dashboard",
          icon: <Car size={16} className="text-[#E58C28]" />,
        },
        groups: parkingGroups,
      };
    }
    if (["owner", "stay_admin", "ashram_owner", "ashram_admin"].includes(user?.role || "")) {
      return {
        topLink: {
          label: "Overview Dashboard",
          path: `${ownerBase}/dashboard`,
          icon: <LayoutDashboard size={16} className="text-[#E58C28]" />,
        },
        groups: ownerGroups,
      };
    }
    if (user?.role === "manager") {
      return {
        topLink: {
          label: "Overview Dashboard",
          path: "/owner/dashboard",
          icon: <LayoutDashboard size={16} className="text-[#E58C28]" />,
        },
        groups: ownerGroups
          .map((group) => ({
            ...group,
            links: group.links.filter(
              (link) =>
                ![
                  "/owner/staff",
                  "/owner/users",
                  "/owner/bookings",
                  "/owner/payments",
                  "/owner/parking",
                  "/parking/dashboard",
                ].includes(link.path),
            ),
          }))
          .filter((group) => group.links.length > 0),
      };
    }
    if (user?.role === "staff") {
      return {
        topLink: {
          label: "Staff Dashboard",
          path: "/owner/dashboard",
          icon: <LayoutDashboard size={16} className="text-[#E58C28]" />,
        },
        groups: [],
      };
    }
    if (user?.role === "reception") {
      return {
        topLink: {
          label: "Reception Desk",
          path: "/staff/reception",
          icon: <ClipboardList size={16} className="text-[#E58C28]" />,
        },
        groups: [],
      };
    }
    if (user?.role === "housekeeping") {
      return {
        topLink: {
          label: "Housekeeping Board",
          path: "/staff/housekeeping",
          icon: <Bed size={16} className="text-[#E58C28]" />,
        },
        groups: [],
      };
    }
    if (user?.role === "offer_manager") {
      return {
        topLink: {
          label: "Offers & Deals",
          path: "/owner/offers",
          icon: <Tag size={16} className="text-[#E58C28]" />,
        },
        groups: [],
      };
    }
    if (user?.role === "marketplace_manager") {
      return {
        topLink: {
          label: "Marketplace Products",
          path: "/admin/manage/marketplace/products",
          icon: <ShoppingBag size={16} className="text-[#E58C28]" />,
        },
        groups: [],
      };
    }
    if (
      [
        "blog_manager",
        "local_manager",
        "service_manager",
        "finance_manager",
      ].includes(user?.role || "")
    ) {
      const roleLanding: Record<string, { label: string; path: string }> = {
        blog_manager: {
          label: "Blog Management",
          path: "/admin/manage/blogs/all",
        },
        local_manager: {
          label: "Local Services",
          path: "/admin/manage/local/all",
        },
        service_manager: {
          label: "Service Providers",
          path: "/admin/manage/local/all",
        },
        finance_manager: {
          label: "Finance & Refunds",
          path: "/admin/manage/bookings/refunds",
        },
      };
      const landing = roleLanding[user!.role];
      return {
        topLink: {
          ...landing,
          icon: <LayoutDashboard size={16} className="text-[#E58C28]" />,
        },
        groups: [],
      };
    }
    if (user?.role === "support") {
      return {
        topLink: {
          label: "Support Tickets",
          path: "/support",
          icon: <LifeBuoy size={16} className="text-[#E58C28]" />,
        },
        groups: [],
      };
    }
    if (user?.role === "inspector") {
      return {
        topLink: {
          label: "Verification Queue",
          path: "/admin/verifications",
          icon: <FileCheck size={16} className="text-[#E58C28]" />,
        },
        groups: [],
      };
    }
    if (
      [
        "district_officer",
        "district_admin",
        "state_admin",
        "govt_admin",
        "government_admin",
        "national_admin",
      ].includes(user?.role || "")
    ) {
      return {
        topLink: {
          label: "Government Dashboard",
          path: "/admin/dashboard",
          icon: <LayoutDashboard size={16} className="text-[#E58C28]" />,
        },
        groups: districtAdminGroups.map((group) => ({
          ...group,
          links: group.links.filter(
            (link) =>
              link.path === "/admin/verifications" ||
              (["govt_admin", "government_admin"].includes(user?.role || "") &&
                link.path === "/admin/users"),
          ),
        })),
      };
    }
    return {
      topLink: {
        label: "Executive Dashboard",
        path: "/admin/dashboard",
        icon: <LayoutDashboard size={16} className="text-[#E58C28]" />,
      },
      groups: standardGroups,
    };
  };

  const roleNavData = getRoleNavData();
  const navData = {
    ...roleNavData,
    groups: orderSidebarGroups(roleNavData.groups),
  };

  const searchableLinks: SearchableLink[] = [
    { label: t(navData.topLink.label), path: navData.topLink.path, group: t("Overview") },
    ...navData.groups.flatMap((group) =>
      group.links.map((link) => ({
        label: t(link.label),
        path: link.path,
        group: t(group.groupName),
      })),
    ),
  ];

  React.useEffect(() => {
    const activeGroup = navData.groups.find((group) =>
      group.links.some(
        (l) =>
          location.pathname === l.path ||
          (l.path !== navData.topLink.path &&
            location.pathname.startsWith(l.path)),
      ),
    );

    if (activeGroup) {
      setOpenGroups({ [activeGroup.groupName]: true });
      sessionStorage.setItem("sidebar_open_group", activeGroup.groupName);
    } else {
      const savedGroup = sessionStorage.getItem("sidebar_open_group");
      if (savedGroup) {
        setOpenGroups({ [savedGroup]: true });
      } else {
        setOpenGroups({});
      }
    }
  }, [location.pathname, user?.role]);

  if (!user) return null;

  const renderSidebarContent = (isMobile = false) => (
    <>
      {isMobile && (
        <div className="p-4 border-b border-blue-100 dark:border-slate-800 flex items-center gap-3 bg-[#F8FAFC] dark:bg-[#0B192C]">
          <div className="p-2 bg-white rounded-xl border border-blue-100 shadow-sm">
            <img
              src="/logo/logo.png"
              alt="Tirvona"
              className="w-8 h-8 object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-lg leading-tight text-[#0B192C] dark:text-white">
              Tirvona
            </span>
            <span className="text-[10px] font-extrabold text-[#0A4DA6]">
              {t(getFormattedRole(user?.role))}
            </span>
          </div>
        </div>
      )}

      <nav className="flex-grow overflow-y-auto overscroll-contain p-3 scrollbar-thin">
        <div className="space-y-1.5">
          {navData.topLink && (
            <Link
              to={navData.topLink.path}
              onClick={isMobile ? () => setSidebarOpen(false) : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-xs font-bold transition-all ${location.pathname === navData.topLink.path
                ? "bg-[#0A4DA6] text-white shadow-sm shadow-[#0A4DA6]/20"
                : "text-slate-600 hover:bg-[#EBF2FA] hover:text-[#0A4DA6] dark:text-gray-300 dark:hover:bg-slate-800"
                }`}
            >
              <MaterialSidebarIcon label={navData.topLink.label} />
              <span>{t(navData.topLink.label)}</span>
            </Link>
          )}

          {navData.groups.map((group) => {
            if (
              group.links.length === 1 &&
              (group.links[0].label === "Banner Management" ||
                group.links[0].label === group.groupName)
            ) {
              const singleLink = group.links[0];
              const isActive =
                location.pathname === singleLink.path ||
                (singleLink.path !== navData.topLink.path &&
                  location.pathname.startsWith(singleLink.path));

              return (
                <Link
                  key={group.groupName}
                  to={singleLink.path}
                  onClick={isMobile ? () => setSidebarOpen(false) : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${isActive
                    ? "bg-[#0A4DA6] text-white shadow-sm shadow-[#0A4DA6]/20"
                    : "text-slate-600 hover:bg-[#EBF2FA] hover:text-[#0A4DA6] dark:text-gray-300 dark:hover:bg-slate-800"
                    }`}
                >
                  <MaterialSidebarIcon label={group.groupName} />
                  <span>{t(group.groupName)}</span>
                </Link>
              );
            }

            const isOpen = openGroups[group.groupName] ?? false;
            const hasActiveLink = group.links.some(
              (l) => location.pathname === l.path,
            );

            return (
              <div key={group.groupName} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.groupName)}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${hasActiveLink
                    ? "bg-[#EBF2FA] text-[#0A4DA6] dark:bg-white/5"
                    : "text-slate-600 hover:bg-[#F0F5FA] hover:text-[#0A4DA6] dark:text-gray-400"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <MaterialSidebarIcon label={group.groupName} />
                    <span>{t(group.groupName)}</span>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                </button>

                {isOpen && (
                  <div className="ml-5 space-y-1 border-l border-blue-100 pl-3 dark:border-slate-800">
                    {group.links.map((link) => {
                      const isActive = location.pathname === link.path;
                      return (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={
                            isMobile ? () => setSidebarOpen(false) : undefined
                          }
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${isActive
                            ? "bg-[#E2EDF8] font-semibold text-[#0A4DA6] shadow-sm dark:bg-[#0A4DA6] dark:text-white"
                            : "text-slate-600 hover:bg-[#F0F5FA] hover:text-[#0A4DA6] dark:text-gray-400"
                            }`}
                        >
                          <span className="truncate">{t(link.label)}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

    </>
  );

  return (
    <div className="dashboard-shell flex min-h-screen flex-col bg-[#F0F4F9] text-left text-[#0B192C] dark:bg-[#070F1B] dark:text-white">
      <header className="sticky top-0 z-30 flex h-[72px] w-full items-center justify-between gap-3 border-b border-blue-100 bg-white px-3 shadow-sm sm:px-5 lg:gap-6 lg:px-7 dark:border-slate-800 dark:bg-[#0B192C]">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-full hover:bg-blue-50 text-[#0B192C] dark:text-white transition-colors"
            aria-label={t("Open navigation menu")}
          >
            <Menu size={20} />
          </button>

          <Link to="/" className="group flex shrink-0 cursor-pointer items-center gap-3">
            <div className="flex items-center justify-center rounded-xl border border-blue-100 bg-white p-1.5 shadow-sm transition-all group-hover:border-[#0A4DA6]/60">
              <img
                src="/logo/logo.png"
                alt="Tirvona"
                className="h-8 w-8 object-contain transition-transform group-hover:scale-105"
              />
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-lg font-extrabold leading-tight tracking-tight text-[#0B192C] transition-colors group-hover:text-[#0A4DA6] dark:text-white">
                Tirvona
              </span>
              <span className="text-[10px] font-semibold leading-none text-[#0A4DA6]">
                {t(getFormattedRole(user?.role))}
              </span>
            </div>
          </Link>
        </div>

        <div className="mx-auto hidden max-w-2xl flex-1 md:block">
          <GlobalSearch links={searchableLinks} />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setLanguageOpen((open) => !open)}
              className="flex h-10 items-center gap-1.5 rounded-full border border-blue-100 bg-white px-3 text-xs font-semibold text-[#0A4DA6] hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
              aria-label={t("Language")}
            >
              <Globe size={14} /> {language === "hi" ? "हिंदी" : "EN"}
              <ChevronDown size={12} />
            </button>
            {languageOpen && (
              <div className="absolute right-0 top-full mt-2 w-36 rounded-xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-[#0B192C] shadow-xl overflow-hidden z-50">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage("en");
                    setLanguageOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-left text-xs font-bold ${language === "en" ? "bg-blue-50 text-[#0A4DA6] dark:bg-slate-800" : "text-slate-600 dark:text-slate-300"}`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage("hi");
                    setLanguageOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-left text-xs font-bold ${language === "hi" ? "bg-blue-50 text-[#0A4DA6] dark:bg-slate-800" : "text-slate-600 dark:text-slate-300"}`}
                >
                  हिंदी
                </button>
              </div>
            )}
          </div>

          <NotificationDropdown />

          <Link
            to="/public"
            className="hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#0A4DA6] px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-[#0A4DA6]/20 transition-all hover:bg-[#083b80] xl:flex"
          >
            <Globe size={14} className="text-[#E58C28]" /> {t("Public Portal")}{" "}
            <ArrowRight size={12} />
          </Link>

          <div className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-[#F8FAFC] p-1.5 pl-2 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0A4DA6] text-xs font-bold text-white shadow-sm">
              {(user.name || user.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="hidden min-w-0 flex-col xl:flex">
              <span className="max-w-32 truncate text-xs font-semibold text-[#0B192C] dark:text-white">
                {user.name || user.email || t("User")}
              </span>
              <span className="text-[10px] font-medium text-[#0A4DA6]">
                {t(getFormattedRole(user.role))}
              </span>
            </div>
            <span className="hidden h-6 w-px bg-blue-100 xl:block dark:bg-slate-700" />
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              aria-label={t("Sign Out")}
              title={t("Sign Out")}
            >
              <LogOut size={15} />
              <span className="hidden 2xl:inline">{t("Sign Out")}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-row flex-grow min-h-0">
        <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] w-[272px] shrink-0 flex-col border-r border-blue-100 bg-white text-[#0B192C] shadow-sm lg:flex dark:border-slate-800 dark:bg-[#0B192C] dark:text-white">
          {renderSidebarContent(false)}
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="relative flex flex-col w-72 max-w-[85vw] bg-white dark:bg-[#0B192C] text-[#0B192C] dark:text-white border-r border-blue-100 dark:border-slate-800 shadow-2xl h-full z-10">
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors z-20"
                aria-label={t("Close menu")}
              >
                <X size={20} />
              </button>
              {renderSidebarContent(true)}
            </aside>
          </div>
        )}

        <main className="flex-grow p-4 lg:p-6 pb-12 lg:pb-16 overflow-y-auto min-w-0 bg-[#F0F4F9] dark:bg-[#070F1B]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default DashboardLayout;
