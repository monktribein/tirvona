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

  // Auto-expand ONLY the single parent group that contains the current active route
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

  // Single Accordion Expansion: Clicking a group expands ONLY that group and collapses all others
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

  // Redirect unauthenticated visitors from an effect, not during render.
  //
  // This used to be `if (!user) { navigate('/login'); return null; }` right
  // here, which had two defects:
  //   1. navigate() during render updates the router while React is rendering
  //      this component.
  //   2. The early return sat ABOVE the useEffect declared further down, so
  //      that hook was skipped whenever `user` was null. React requires the
  //      same hooks in the same order on every render, so the moment `user`
  //      flipped truthy -> null (i.e. on logout) the component rendered fewer
  //      hooks than the previous pass and React threw "Rendered fewer hooks
  //      than expected".
  // The bail-out now lives below every hook; see the `if (!user) return null`
  // after the last useEffect.
  React.useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  // Super Admin Categorized Navigation Groups
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
      // Its own section rather than a link under Room & Inventory: this is the
      // platform's own fee, charged on top of whatever a property prices its
      // rooms at, and it reaches systems beyond stays. Filed under rooms it
      // read as a per-room setting, which is the opposite of what it is.
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
      // Parking keeps one module key per collection rather than
      // parking/<section>: the console resolves a sub-key against a shared
      // alias table, where "bookings" already means ashram bookings.
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
        // Pilgrim-written stay stories. A separate collection from All Blogs,
        // and the one the public blog feed is actually full of.
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
        { label: "Field Agents", path: "/admin/lead-collection/agents" },
      ],
    },
    {
      // Smart Contact QR — permanent QR profiles for representatives.
      // The status filters are query strings on one page rather than separate
      // routes, so the list keeps a single source of truth for its data.
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
      // The platform manages every ashram's openings and applications from
      // here; the same page scoped to one owner lives at /owner/volunteer.
      groupName: "Volunteer Management",
      icon: <Heart size={15} />,
      links: [
        { label: "Openings & Applications", path: "/admin/volunteer" },
      ],
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
      // No dropdown: every section (all notifications, system activities,
      // auth logs, bookings telemetry, payment audit, CMS queue, timeline)
      // is a tab on the one dashboard page, so a second copy of that list in
      // the sidebar only duplicated navigation the page already provides.
      // Matching `label` to `groupName` renders this as a flat link.
      groupName: "Notification Center",
      icon: <Bell size={15} />,
      links: [
        {
          // The base path (subSection is optional and defaults to the
          // dashboard) so the link stays highlighted whichever tab is open.
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
        { label: "Payments & Payouts", path: `${ownerBase}/payments` },
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

  // Helper to resolve active role's navigation structure
  // Parking staff are identified by their grants, not by `user.role` — a guard
  // and a pilgrim both read `customer`. Checked before the role switch so a
  // grant holder lands on the parking dashboard instead of the pilgrim profile.
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

  const navData = getRoleNavData();

  // Flatten the same tree the sidebar renders, so global search can only ever
  // offer pages this role actually has — no second list to keep in sync.
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

  // Auto-expand ONLY the single parent group that contains the current active route
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

  // Safe to bail out only here: every hook above has now run unconditionally,
  // so the hook count is identical on every render. The effect further up
  // performs the actual redirect to /login.
  if (!user) return null;

  const renderSidebarContent = (isMobile = false) => (
    <>
      {/* Mobile Drawer Brand Header */}
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

      {/* Links Navigation */}
      <nav className="flex-grow p-4 space-y-3 overflow-y-auto overscroll-contain scrollbar-thin">
        <div className="space-y-3">
          {/* Main Role Overview Link */}
          {navData.topLink && (
            <Link
              to={navData.topLink.path}
              onClick={isMobile ? () => setSidebarOpen(false) : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black transition-all ${location.pathname === navData.topLink.path
                ? "bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/20 border-l-4 border-[#0A4DA6]"
                : "text-slate-600 dark:text-gray-300 hover:bg-[#EBF2FA] dark:hover:bg-slate-800 hover:text-[#0A4DA6]"
                }`}
            >
              {navData.topLink.icon}
              <span>{t(navData.topLink.label)}</span>
            </Link>
          )}

          {/* Categorized Dropdown Groups (All Collapsed By Default) */}
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
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${isActive
                    ? "bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/20 border-l-4 border-[#0A4DA6]"
                    : "text-slate-600 dark:text-gray-300 hover:bg-[#EBF2FA] dark:hover:bg-slate-800 hover:text-[#0A4DA6]"
                    }`}
                >
                  {group.icon}
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
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-[10px] font-black tracking-wider transition-colors text-left rounded-xl ${hasActiveLink
                    ? "text-[#0A4DA6] bg-[#EBF2FA] dark:bg-white/5"
                    : "text-slate-500 dark:text-gray-400 hover:text-[#0A4DA6] hover:bg-[#F0F5FA]"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {group.icon}
                    <span>{t(group.groupName)}</span>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                </button>

                {isOpen && (
                  <div className="pl-4 space-y-1 border-l border-blue-100 dark:border-slate-800 ml-3">
                    {group.links.map((link) => {
                      const isActive = location.pathname === link.path;
                      return (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={
                            isMobile ? () => setSidebarOpen(false) : undefined
                          }
                          className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${isActive
                            ? "bg-[#E2EDF8] dark:bg-[#0A4DA6] text-[#0A4DA6] dark:text-white shadow-sm border-l-2 border-[#0A4DA6]"
                            : "text-slate-600 dark:text-gray-400 hover:text-[#0A4DA6] hover:bg-[#F0F5FA]"
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

      {/* User Profile Bottom Bar */}
      <div className="p-4 border-t border-blue-100 dark:border-slate-800 space-y-3 shrink-0 bg-[#F8FAFC] dark:bg-[#0B192C]">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-[#0A4DA6]/10 border border-[#0A4DA6]/30 flex items-center justify-center font-black text-[#0A4DA6] text-xs">
            {(user.name || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold truncate max-w-[140px] text-[#0B192C] dark:text-white">
              {user.name}
            </span>
            <span className="text-[10px] text-[#0A4DA6] font-black tracking-wider">
              {t(getFormattedRole(user.role))}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-all rounded-full text-xs font-black cursor-pointer"
        >
          <LogOut size={14} />
          <span>{t("Sign Out")}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F0F4F9] dark:bg-[#070F1B] flex flex-col font-sans text-left">
      {/* ── Unified Top Navigation Bar (Attaches Sidebar Brand & Dashboard Navbar into One Header) ── */}
      <header className="w-full bg-white dark:bg-[#0B192C] text-[#0B192C] dark:text-white border-b border-blue-100 dark:border-slate-800 shadow-sm sticky top-0 z-30 px-4 lg:px-6 py-3 flex items-center justify-between gap-4 lg:gap-8">
        {/* Left: Brand Logo + Mobile Menu */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-full hover:bg-blue-50 text-[#0B192C] dark:text-white transition-colors"
            aria-label={t("Open navigation menu")}
          >
            <Menu size={20} />
          </button>

          {/* Desktop Attached Brand Logo & Title */}
          <Link
            to="/"
            className="hidden lg:flex items-center gap-3 group cursor-pointer shrink-0"
          >
            <div className="flex items-center justify-center p-2 bg-white rounded-xl border border-blue-100 shadow-sm group-hover:border-[#0A4DA6]/60 transition-all">
              <img
                src="/logo/logo.png"
                alt="Tirvona"
                className="w-8 h-8 object-contain group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg leading-tight tracking-tight text-[#0B192C] dark:text-white group-hover:text-[#0A4DA6] transition-colors">
                Tirvona
              </span>
              <span className="text-[10px] font-extrabold text-[#0A4DA6] tracking-wider leading-none">
                {t(getFormattedRole(user?.role))}
              </span>
            </div>
          </Link>
        </div>

        {/* Middle: Global search across console pages and records */}
        <div className="flex-1 max-w-2xl mx-auto hidden md:block">
          <GlobalSearch links={searchableLinks} />
        </div>

        {/* Right: Notifications + Public Portal Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setLanguageOpen((open) => !open)}
              className="h-9 px-3 rounded-full border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-[#0A4DA6] dark:text-blue-300 flex items-center gap-1.5 hover:bg-blue-50 dark:hover:bg-slate-800"
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

          {/* Notifications Dropdown */}
          <NotificationDropdown />

          {/* Public Portal Action Button */}
          <Link
            to="/public"
            className="text-xs font-extrabold px-4 py-2 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white transition-all flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/20 cursor-pointer shrink-0"
          >
            <Globe size={14} className="text-[#E58C28]" /> {t("Public Portal")}{" "}
            <ArrowRight size={12} />
          </Link>
        </div>
      </header>

      {/* ── Main Layout Body (Sidebar + Content Workspace Attached Below Header) ── */}
      <div className="flex flex-row flex-grow min-h-0">
        {/* ── Desktop Left Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-[#0B192C] text-[#0B192C] dark:text-white border-r border-blue-100 dark:border-slate-800 shadow-sm shrink-0 h-[calc(100vh-61px)] sticky top-[61px]">
          {renderSidebarContent(false)}
        </aside>

        {/* ── Mobile & Tablet Drawer ── */}
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

        {/* ── Main Workspace Area ── */}
        <main className="flex-grow p-4 lg:p-6 pb-12 lg:pb-16 overflow-y-auto min-w-0 bg-[#F0F4F9] dark:bg-[#070F1B]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default DashboardLayout;
