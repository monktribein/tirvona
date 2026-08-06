import React, { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import NotificationDropdown from "../../../components/shared/NotificationDropdown";
import GlobalSearch, {
  type SearchableLink,
} from "../components/GlobalSearch";
import { isParkingRole } from "../../../utils/roleRedirect";
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
    case "owner":
    case "stay_admin":
      return "Stay Admin";
    case "banner_manager":
      return "BannerBoy";
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
      groupName: "Approval center",
      icon: <FileCheck size={15} />,
      links: [
        { label: "📥 All Requests", path: "/admin/approvals/all" },
        { label: "🏨 Ashram Requests", path: "/admin/approvals/ashram" },
        {
          label: "🛏 Room Category Requests",
          path: "/admin/approvals/room-category",
        },
        { label: "🏠 Room Requests", path: "/admin/approvals/room" },
        {
          label: "🛁 Amenities & Facilities",
          path: "/admin/approvals/amenities",
        },
        {
          label: "💰 Pricing Change Requests",
          path: "/admin/approvals/pricing",
        },
        { label: "🎁 Offers & Coupons", path: "/admin/approvals/offer" },
        { label: "🖼 Gallery & Media", path: "/admin/approvals/gallery" },
        { label: "🙋 Volunteer & Careers", path: "/admin/approvals/volunteer" },
        {
          label: "🛍 Marketplace Products",
          path: "/admin/approvals/marketplace",
        },
        { label: "🚕 Local Services", path: "/admin/approvals/service" },
        { label: "📰 Blogs & Articles", path: "/admin/approvals/blog" },
        { label: "🎉 Events & Festivals", path: "/admin/approvals/event" },
        { label: "🛕 Temple Directory", path: "/admin/approvals/temple" },
        { label: "📢 Banner & CMS", path: "/admin/approvals/banner" },
        { label: "⚙ Other Requests", path: "/admin/approvals/other" },
      ],
    },
    {
      groupName: "User management",
      icon: <Users size={15} />,
      links: [
        { label: "Users & IAM", path: "/admin/users" },
        { label: "Pilgrims", path: "/admin/manage/users/pilgrims" },
        { label: "Owners", path: "/admin/manage/users/owners" },
        {
          label: "Banner Managers",
          path: "/admin/manage/users/banner-managers",
        },
        {
          label: "Content Managers",
          path: "/admin/manage/users/content-managers",
        },
        { label: "Staff Members", path: "/admin/manage/users/staff" },
        { label: "Roles & Permissions", path: "/admin/manage/users/roles" },
      ],
    },
    {
      groupName: "Institution master data",
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
      groupName: "Ashram management",
      icon: <Building size={15} />,
      links: [
        { label: "All Ashrams", path: "/admin/manage/ashrams/all" },
        { label: "Pending Verification", path: "/admin/verifications" },
        { label: "Approved Ashrams", path: "/admin/manage/ashrams/approved" },
        { label: "Rejected Ashrams", path: "/admin/manage/ashrams/rejected" },
        { label: "Amenities", path: "/admin/manage/ashrams/amenities" },
        { label: "Categories", path: "/admin/manage/ashrams/categories" },
        { label: "Facilities", path: "/admin/manage/ashrams/facilities" },
        {
          label: "Room Categories",
          path: "/admin/manage/ashrams/room-categories",
        },
        {
          label: "Category Approvals",
          path: "/admin/approvals/room-categories",
        },
      ],
    },
    {
      groupName: "Room management",
      icon: <Bed size={15} />,
      links: [
        {
          label: "Category Approvals",
          path: "/admin/approvals/room-categories",
        },
        { label: "Rooms", path: "/admin/manage/rooms/all" },
        { label: "Availability", path: "/admin/manage/rooms/availability" },
        { label: "Pricing", path: "/admin/manage/rooms/pricing" },
        { label: "Platform Pricing", path: "/admin/settings/pricing" },
        { label: "Season Pricing", path: "/admin/manage/rooms/season-pricing" },
        { label: "Inventory", path: "/admin/manage/rooms/inventory" },
      ],
    },
    {
      groupName: "Bookings",
      icon: <Calendar size={15} />,
      links: [
        { label: "All Bookings", path: "/admin/manage/bookings/all" },
        { label: "Pending Bookings", path: "/admin/manage/bookings/pending" },
        {
          label: "Confirmed Bookings",
          path: "/admin/manage/bookings/confirmed",
        },
        { label: "Completed Stays", path: "/admin/manage/bookings/completed" },
        { label: "Cancelled", path: "/admin/manage/bookings/cancelled" },
        { label: "Refund Requests", path: "/admin/manage/bookings/refunds" },
      ],
    },
    {
      // Parking keeps one module key per collection rather than
      // parking/<section>: the console resolves a sub-key against a shared
      // alias table, where "bookings" already means ashram bookings.
      groupName: "Parking management",
      icon: <Car size={15} />,
      links: [
        { label: "⚡ Parking Console", path: "/parking/dashboard" },
        { label: "Control Center", path: "/admin/parking/control" },
        { label: "Staff & Roles", path: "/admin/parking/roles" },
        { label: "Partners", path: "/admin/manage/parking_partners/all" },
        {
          label: "Pending Partners",
          path: "/admin/manage/parking_partners/pending",
        },
        { label: "Locations", path: "/admin/manage/parking_locations/all" },
        { label: "Bookings", path: "/admin/manage/parking_bookings/all" },
        {
          label: "Vehicles On-Site",
          path: "/admin/manage/parking_bookings/checked_in",
        },
        { label: "Slot Types", path: "/admin/manage/parking_slot_types/all" },
        { label: "Slots", path: "/admin/manage/parking_slots/all" },
        { label: "Pricing Rules", path: "/admin/manage/parking_pricing/all" },
        {
          label: "Commissions",
          path: "/admin/manage/parking_commissions/pending",
        },
        {
          label: "Transactions",
          path: "/admin/manage/parking_transactions/all",
        },
        { label: "Scan Logs", path: "/admin/manage/parking_scan_logs/all" },
        { label: "Reviews", path: "/admin/manage/parking_reviews/all" },
      ],
    },
    {
      groupName: "Offers & blogs",
      icon: <Tag size={15} />,
      links: [
        { label: "All Offers", path: "/admin/manage/offers/all" },
        { label: "Featured Offers", path: "/admin/manage/offers/featured" },
        { label: "All Blogs", path: "/admin/manage/blogs/all" },
        { label: "Blog Categories", path: "/admin/manage/blogs/categories" },
        { label: "Author Approvals", path: "/admin/manage/blogs/authors" },
      ],
    },
    {
      groupName: "Planner & circuits",
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
      groupName: "Local hub",
      icon: <Compass size={15} />,
      links: [
        { label: "Transport", path: "/admin/manage/local/transport" },
        { label: "Guides", path: "/admin/manage/local/guides" },
        { label: "Restaurants", path: "/admin/manage/local/restaurants" },
        { label: "Medical", path: "/admin/manage/local/medical" },
        { label: "Emergency", path: "/admin/manage/local/emergency" },
        { label: "Shops", path: "/admin/manage/local/shops" },
        { label: "Photography", path: "/admin/manage/local/photography" },
        { label: "Events", path: "/admin/manage/local/events" },
      ],
    },
    {
      groupName: "Marketplace",
      icon: <ShoppingBag size={15} />,
      links: [
        { label: "Products", path: "/admin/manage/marketplace/products" },
        { label: "Categories", path: "/admin/manage/marketplace/categories" },
        { label: "Vendors", path: "/admin/manage/marketplace/vendors" },
        { label: "Orders", path: "/admin/manage/marketplace/orders" },
        { label: "Waitlist", path: "/admin/manage/marketplace/waitlist" },
        { label: "Newsletter", path: "/admin/manage/marketplace/newsletter" },
      ],
    },
    {
      groupName: "Banner management",
      icon: <Image size={15} />,
      links: [
        { label: "Homepage Banner", path: "/admin/manage/banner/homepage" },
        { label: "Hero Slider", path: "/admin/manage/banner/hero-slider" },
        { label: "Offers Banner", path: "/admin/manage/banner/offers" },
        { label: "Blog Banner", path: "/admin/manage/banner/blog" },
        {
          label: "Marketplace Banner",
          path: "/admin/manage/banner/marketplace",
        },
        {
          label: "Destination Banner",
          path: "/admin/manage/banner/destination",
        },
        { label: "Upload Media", path: "/admin/manage/banner/upload" },
        { label: "Approval Queue", path: "/admin/manage/banner/approval" },
      ],
    },
    {
      groupName: "Refund requests",
      icon: <Undo2 size={15} />,
      links: [
        { label: "Refund Queue", path: "/admin/refunds" },
        { label: "Refund Policies", path: "/admin/refunds/policies" },
      ],
    },
    {
      groupName: "Reports & audit",
      icon: <BarChart3 size={15} />,
      links: [
        { label: "Revenue Reports", path: "/admin/manage/reports/revenue" },
        { label: "Booking Telemetry", path: "/admin/manage/reports/bookings" },
        { label: "System Audit Logs", path: "/admin/audit-logs" },
      ],
    },
    {
      groupName: "Enterprise notifications",
      icon: <Bell size={15} />,
      links: [
        {
          label: "Dashboard",
          path: "/admin/enterprise-notifications/dashboard",
        },
        {
          label: "All Notifications",
          path: "/admin/enterprise-notifications/all",
        },
        {
          label: "System Activities",
          path: "/admin/enterprise-notifications/activities",
        },
        {
          label: "Authentication Logs",
          path: "/admin/enterprise-notifications/auth-logs",
        },
        {
          label: "Bookings Telemetry",
          path: "/admin/enterprise-notifications/bookings",
        },
        {
          label: "Payment Audit",
          path: "/admin/enterprise-notifications/payments",
        },
        {
          label: "Banner CMS Queue",
          path: "/admin/enterprise-notifications/cms",
        },
        {
          label: "Audit Timeline",
          path: "/admin/enterprise-notifications/timeline",
        },
      ],
    },
  ];

  const ownerGroups: NavGroup[] = [
    {
      groupName: "Ashram management",
      icon: <Building size={15} />,
      links: [
        { label: "Manage Ashrams", path: "/owner/ashrams" },
        { label: "Add-On Services", path: "/owner/add-ons" },
      ],
    },
    {
      groupName: "Room management",
      icon: <Bed size={15} />,
      links: [
        { label: "Manage Rooms", path: "/owner/rooms" },
        { label: "Inventory Calendar", path: "/owner/calendar" },
      ],
    },
    {
      groupName: "Offers & deals",
      icon: <Tag size={15} />,
      links: [{ label: "Offers & Deals", path: "/owner/offers" }],
    },
    {
      groupName: "Volunteer & careers",
      icon: <Heart size={15} />,
      links: [{ label: "Volunteer & Careers", path: "/owner/volunteer" }],
    },
    {
      groupName: "Staff & users",
      icon: <Users size={15} />,
      links: [
        { label: "Users & Guests", path: "/owner/users" },
        { label: "Staff Management", path: "/owner/staff" },
      ],
    },
  ];

  const bannerBoyGroups: NavGroup[] = [
    {
      groupName: "Banner management",
      icon: <Image size={15} />,
      links: [
        { label: "Banner Management", path: "/bannerboy/dashboard" },
        { label: "Homepage CMS", path: "/bannerboy/dashboard" },
        { label: "Media Library", path: "/bannerboy/dashboard" },
      ],
    },
    {
      groupName: "Communications & approvals",
      icon: <Bell size={15} />,
      links: [
        { label: "Announcements", path: "/bannerboy/dashboard" },
        { label: "Pending Approvals", path: "/bannerboy/dashboard" },
        { label: "My Activity", path: "/bannerboy/dashboard" },
        { label: "CMS Profile", path: "/bannerboy/dashboard" },
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
    if (userHasParkingRole) {
      return {
        topLink: {
          label: "Parking Console",
          path: "/parking/dashboard",
          icon: <Car size={16} className="text-[#E58C28]" />,
        },
        groups: parkingGroups,
      };
    }
    if (["owner", "stay_admin"].includes(user?.role || "")) {
      return {
        topLink: {
          label: "Overview Dashboard",
          path: "/owner/dashboard",
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
        groups: ownerGroups.map((group) => ({
          ...group,
          links: group.links.filter(
            (link) => !["/owner/staff", "/owner/users"].includes(link.path),
          ),
        })),
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
    if (["banner_manager", "content_manager"].includes(user?.role || "")) {
      return {
        topLink: {
          label: "CMS Dashboard",
          path: "/bannerboy/dashboard",
          icon: <LayoutDashboard size={16} className="text-[#E58C28]" />,
        },
        groups: bannerBoyGroups,
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
    { label: navData.topLink.label, path: navData.topLink.path, group: "Overview" },
    ...navData.groups.flatMap((group) =>
      group.links.map((link) => ({
        label: link.label,
        path: link.path,
        group: group.groupName,
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
              {getFormattedRole(user?.role)}
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
              <span>{navData.topLink.label}</span>
            </Link>
          )}

          {/* Categorized Dropdown Groups (All Collapsed By Default) */}
          {navData.groups.map((group) => {
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
                    <span>{group.groupName}</span>
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
                          <span className="truncate">{link.label}</span>
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
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold truncate max-w-[140px] text-[#0B192C] dark:text-white">
              {user.name}
            </span>
            <span className="text-[10px] text-[#0A4DA6] font-black tracking-wider">
              {getFormattedRole(user.role)}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-all rounded-full text-xs font-black cursor-pointer"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
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
            aria-label="Open navigation menu"
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
                {getFormattedRole(user?.role)}
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
          {/* Notifications Dropdown */}
          <NotificationDropdown />

          {/* Public Portal Action Button */}
          <Link
            to="/"
            className="text-xs font-extrabold px-4 py-2 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white transition-all flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/20 cursor-pointer shrink-0"
          >
            <Globe size={14} className="text-[#E58C28]" /> Public Portal{" "}
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
                aria-label="Close menu"
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
