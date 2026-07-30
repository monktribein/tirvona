import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import NotificationDropdown from '../../../components/shared/NotificationDropdown';
import {
  LayoutDashboard,
  Home,
  Bed,
  Calendar,
  History,
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
  Sparkles,
  MapPin,
  Compass,
  ShoppingBag,
  Image,
  CalendarDays,
  BarChart3,
  Settings,
  Search,
  Bell,
  User,
  ShieldCheck,
  Sun,
  Globe,
  ArrowRight,
  Landmark
} from 'lucide-react';

interface NavGroup {
  groupName: string;
  icon: React.ReactNode;
  links: { label: string; path: string }[];
}

const getFormattedRole = (role?: string): string => {
  if (!role) return 'User';
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'owner':
    case 'stay_admin':
      return 'Stay Admin';
    case 'banner_manager':
      return 'BannerBoy';
    case 'support':
      return 'Support';
    case 'reception':
      return 'Reception';
    case 'district_officer':
    case 'district_admin':
      return 'District Admin';
    case 'govt_admin':
    case 'government_admin':
      return 'Government Admin';
    case 'customer':
    case 'pilgrim':
      return 'Customer';
    case 'volunteer':
      return 'Volunteer';
    case 'manager':
      return 'Manager';
    case 'housekeeping':
      return 'Housekeeping';
    default:
      return role
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
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
          (l.path !== '/admin/dashboard' && location.pathname.startsWith(l.path))
      )
    );

    if (activeGroup) {
      setOpenGroups({ [activeGroup.groupName]: true });
      sessionStorage.setItem('sidebar_open_group', activeGroup.groupName);
    } else {
      const savedGroup = sessionStorage.getItem('sidebar_open_group');
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
        sessionStorage.removeItem('sidebar_open_group');
        return {};
      } else {
        sessionStorage.setItem('sidebar_open_group', groupName);
        return { [groupName]: true };
      }
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sidebar_open_group');
    logout();
    navigate('/');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  // Super Admin Categorized Navigation Groups
  const superAdminGroups: NavGroup[] = [
    {
      groupName: 'APPROVAL CENTER',
      icon: <FileCheck size={15} />,
      links: [
        { label: '📥 All Requests', path: '/admin/approvals/all' },
        { label: '🏨 Ashram Requests', path: '/admin/approvals/ashram' },
        { label: '🛏 Room Category Requests', path: '/admin/approvals/room-category' },
        { label: '🏠 Room Requests', path: '/admin/approvals/room' },
        { label: '🛁 Amenities & Facilities', path: '/admin/approvals/amenities' },
        { label: '💰 Pricing Change Requests', path: '/admin/approvals/pricing' },
        { label: '🎁 Offers & Coupons', path: '/admin/approvals/offer' },
        { label: '🖼 Gallery & Media', path: '/admin/approvals/gallery' },
        { label: '🙋 Volunteer & Careers', path: '/admin/approvals/volunteer' },
        { label: '🛍 Marketplace Products', path: '/admin/approvals/marketplace' },
        { label: '🚕 Local Services', path: '/admin/approvals/service' },
        { label: '📰 Blogs & Articles', path: '/admin/approvals/blog' },
        { label: '🎉 Events & Festivals', path: '/admin/approvals/event' },
        { label: '🛕 Temple Directory', path: '/admin/approvals/temple' },
        { label: '📢 Banner & CMS', path: '/admin/approvals/banner' },
        { label: '⚙ Other Requests', path: '/admin/approvals/other' },
      ],
    },
    {
      groupName: 'USER MANAGEMENT',
      icon: <Users size={15} />,
      links: [
        { label: 'Users & IAM', path: '/admin/users' },
        { label: 'Pilgrims', path: '/admin/manage/users/pilgrims' },
        { label: 'Owners', path: '/admin/manage/users/owners' },
        { label: 'Banner Managers', path: '/admin/manage/users/banner-managers' },
        { label: 'Content Managers', path: '/admin/manage/users/content-managers' },
        { label: 'Staff Members', path: '/admin/manage/users/staff' },
        { label: 'Roles & Permissions', path: '/admin/manage/users/roles' },
      ],
    },
    {
      groupName: 'INSTITUTION MASTER DATA',
      icon: <Landmark size={15} />,
      links: [
        { label: 'Institution Profiles', path: '/admin/manage/institution' },
        { label: 'Trust & Legal Bodies', path: '/admin/manage/institution/trusts' },
        { label: 'Contacts Directory', path: '/admin/manage/institution_contacts' },
        { label: 'Locations & GPS', path: '/admin/manage/institution_locations' },
        { label: 'Quality & Audit', path: '/admin/manage/institution_audits' },
      ],
    },
    {
      groupName: 'ASHRAM MANAGEMENT',
      icon: <Building size={15} />,
      links: [
        { label: 'All Ashrams', path: '/admin/manage/ashrams/all' },
        { label: 'Pending Verification', path: '/admin/verifications' },
        { label: 'Approved Ashrams', path: '/admin/manage/ashrams/approved' },
        { label: 'Rejected Ashrams', path: '/admin/manage/ashrams/rejected' },
        { label: 'Amenities', path: '/admin/manage/ashrams/amenities' },
        { label: 'Categories', path: '/admin/manage/ashrams/categories' },
        { label: 'Facilities', path: '/admin/manage/ashrams/facilities' },
        { label: 'Room Categories', path: '/admin/manage/ashrams/room-categories' },
        { label: 'Category Approvals', path: '/admin/approvals/room-categories' },
      ],
    },
    {
      groupName: 'ROOM MANAGEMENT',
      icon: <Bed size={15} />,
      links: [
        { label: 'Category Approvals', path: '/admin/approvals/room-categories' },
        { label: 'Rooms', path: '/admin/manage/rooms/all' },
        { label: 'Availability', path: '/admin/manage/rooms/availability' },
        { label: 'Pricing', path: '/admin/manage/rooms/pricing' },
        { label: 'Platform Pricing', path: '/admin/settings/pricing' },
        { label: 'Season Pricing', path: '/admin/manage/rooms/season-pricing' },
        { label: 'Inventory', path: '/admin/manage/rooms/inventory' },
      ],
    },
    {
      groupName: 'BOOKINGS',
      icon: <Calendar size={15} />,
      links: [
        { label: 'All Bookings', path: '/admin/manage/bookings/all' },
        { label: 'Pending Bookings', path: '/admin/manage/bookings/pending' },
        { label: 'Confirmed Bookings', path: '/admin/manage/bookings/confirmed' },
        { label: 'Completed Stays', path: '/admin/manage/bookings/completed' },
        { label: 'Cancelled', path: '/admin/manage/bookings/cancelled' },
        { label: 'Refund Requests', path: '/admin/manage/bookings/refunds' },
      ],
    },
    {
      groupName: 'OFFERS & BLOGS',
      icon: <Tag size={15} />,
      links: [
        { label: 'All Offers', path: '/admin/manage/offers/all' },
        { label: 'Featured Offers', path: '/admin/manage/offers/featured' },
        { label: 'All Blogs', path: '/admin/manage/blogs/all' },
        { label: 'Blog Categories', path: '/admin/manage/blogs/categories' },
        { label: 'Author Approvals', path: '/admin/manage/blogs/authors' },
      ],
    },
    {
      groupName: 'PLANNER & CIRCUITS',
      icon: <Compass size={15} />,
      links: [
        { label: 'Spiritual Circuits', path: '/admin/manage/planner/circuits' },
        { label: 'Temple Directory', path: '/admin/manage/planner/temples' },
        { label: 'Yatra Routes', path: '/admin/manage/planner/routes' },
        { label: 'Itineraries', path: '/admin/manage/planner/itineraries' },
        { label: 'Ritual Packages', path: '/admin/manage/planner/rituals' },
      ],
    },
    {
      groupName: 'LOCAL HUB',
      icon: <Compass size={15} />,
      links: [
        { label: 'Transport', path: '/admin/manage/local/transport' },
        { label: 'Guides', path: '/admin/manage/local/guides' },
        { label: 'Restaurants', path: '/admin/manage/local/restaurants' },
        { label: 'Medical', path: '/admin/manage/local/medical' },
        { label: 'Emergency', path: '/admin/manage/local/emergency' },
        { label: 'Shops', path: '/admin/manage/local/shops' },
        { label: 'Photography', path: '/admin/manage/local/photography' },
        { label: 'Events', path: '/admin/manage/local/events' },
      ],
    },
    {
      groupName: 'MARKETPLACE',
      icon: <ShoppingBag size={15} />,
      links: [
        { label: 'Products', path: '/admin/manage/marketplace/products' },
        { label: 'Categories', path: '/admin/manage/marketplace/categories' },
        { label: 'Vendors', path: '/admin/manage/marketplace/vendors' },
        { label: 'Orders', path: '/admin/manage/marketplace/orders' },
        { label: 'Waitlist', path: '/admin/manage/marketplace/waitlist' },
        { label: 'Newsletter', path: '/admin/manage/marketplace/newsletter' },
      ],
    },
    {
      groupName: 'BANNER MANAGEMENT',
      icon: <Image size={15} />,
      links: [
        { label: 'Homepage Banner', path: '/admin/manage/banner/homepage' },
        { label: 'Hero Slider', path: '/admin/manage/banner/hero-slider' },
        { label: 'Offers Banner', path: '/admin/manage/banner/offers' },
        { label: 'Blog Banner', path: '/admin/manage/banner/blog' },
        { label: 'Marketplace Banner', path: '/admin/manage/banner/marketplace' },
        { label: 'Destination Banner', path: '/admin/manage/banner/destination' },
        { label: 'Upload Media', path: '/admin/manage/banner/upload' },
        { label: 'Approval Queue', path: '/admin/manage/banner/approval' },
      ],
    },
    {
      groupName: 'REPORTS & AUDIT',
      icon: <BarChart3 size={15} />,
      links: [
        { label: 'Revenue Reports', path: '/admin/manage/reports/revenue' },
        { label: 'Booking Telemetry', path: '/admin/manage/reports/bookings' },
        { label: 'System Audit Logs', path: '/admin/audit-logs' },
      ],
    },
    {
      groupName: 'ENTERPRISE NOTIFICATIONS',
      icon: <Bell size={15} />,
      links: [
        { label: 'Dashboard', path: '/admin/enterprise-notifications/dashboard' },
        { label: 'All Notifications', path: '/admin/enterprise-notifications/all' },
        { label: 'System Activities', path: '/admin/enterprise-notifications/activities' },
        { label: 'Authentication Logs', path: '/admin/enterprise-notifications/auth-logs' },
        { label: 'Bookings Telemetry', path: '/admin/enterprise-notifications/bookings' },
        { label: 'Payment Audit', path: '/admin/enterprise-notifications/payments' },
        { label: 'Banner CMS Queue', path: '/admin/enterprise-notifications/cms' },
        { label: 'Audit Timeline', path: '/admin/enterprise-notifications/timeline' },
      ],
    },
  ];

  const ownerGroups: NavGroup[] = [
    {
      groupName: 'ASHRAM MANAGEMENT',
      icon: <Building size={15} />,
      links: [
        { label: 'Manage Ashrams', path: '/owner/ashrams' },
        { label: 'Add-On Services', path: '/owner/add-ons' },
      ],
    },
    {
      groupName: 'ROOM MANAGEMENT',
      icon: <Bed size={15} />,
      links: [
        { label: 'Manage Rooms', path: '/owner/rooms' },
        { label: 'Inventory Calendar', path: '/owner/calendar' },
      ],
    },
    {
      groupName: 'OFFERS & DEALS',
      icon: <Tag size={15} />,
      links: [
        { label: 'Offers & Deals', path: '/owner/offers' },
      ],
    },
    {
      groupName: 'VOLUNTEER & CAREERS',
      icon: <Heart size={15} />,
      links: [
        { label: 'Volunteer & Careers', path: '/owner/volunteer' },
      ],
    },
    {
      groupName: 'STAFF & USERS',
      icon: <Users size={15} />,
      links: [
        { label: 'Users & Guests', path: '/owner/users' },
        { label: 'Staff Management', path: '/owner/staff' },
      ],
    },
  ];

  const bannerBoyGroups: NavGroup[] = [
    {
      groupName: 'BANNER MANAGEMENT',
      icon: <Image size={15} />,
      links: [
        { label: 'Banner Management', path: '/bannerboy/dashboard' },
        { label: 'Homepage CMS', path: '/bannerboy/dashboard' },
        { label: 'Media Library', path: '/bannerboy/dashboard' },
      ],
    },
    {
      groupName: 'COMMUNICATIONS & APPROVALS',
      icon: <Bell size={15} />,
      links: [
        { label: 'Announcements', path: '/bannerboy/dashboard' },
        { label: 'Pending Approvals', path: '/bannerboy/dashboard' },
        { label: 'My Activity', path: '/bannerboy/dashboard' },
        { label: 'CMS Profile', path: '/bannerboy/dashboard' },
      ],
    },
  ];

  const districtAdminGroups: NavGroup[] = [
    {
      groupName: 'VERIFICATIONS & ASHRAMS',
      icon: <FileCheck size={15} />,
      links: [
        { label: 'Verification Queue', path: '/admin/verifications' },
        { label: 'Approved Ashrams', path: '/admin/manage/ashrams/approved' },
      ],
    },
    {
      groupName: 'REPORTS & AUDIT',
      icon: <BarChart3 size={15} />,
      links: [
        { label: 'Audit Logs', path: '/admin/audit-logs' },
        { label: 'Staff Management', path: '/admin/users' },
      ],
    },
  ];

  const standardGroups: NavGroup[] = [
    {
      groupName: 'SYSTEM & AUDIT',
      icon: <FileCheck size={15} />,
      links: [
        { label: 'Verification Queue', path: '/admin/verifications' },
        { label: 'Audit Logs', path: '/admin/audit-logs' },
        { label: 'Staff Management', path: '/admin/users' },
      ],
    },
  ];

  // Helper to resolve active role's navigation structure
  const getRoleNavData = () => {
    if (user?.role === 'super_admin') {
      return {
        topLink: { label: 'Executive Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={16} className="text-[#E58C28]" /> },
        groups: superAdminGroups,
      };
    }
    if (['owner', 'stay_admin', 'manager', 'reception', 'housekeeping'].includes(user?.role || '')) {
      return {
        topLink: { label: 'Overview Dashboard', path: '/owner/dashboard', icon: <LayoutDashboard size={16} className="text-[#E58C28]" /> },
        groups: ownerGroups,
      };
    }
    if (user?.role === 'banner_manager') {
      return {
        topLink: { label: 'CMS Dashboard', path: '/bannerboy/dashboard', icon: <LayoutDashboard size={16} className="text-[#E58C28]" /> },
        groups: bannerBoyGroups,
      };
    }
    if (['district_officer', 'district_admin', 'govt_admin', 'government_admin'].includes(user?.role || '')) {
      return {
        topLink: { label: 'District Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={16} className="text-[#E58C28]" /> },
        groups: districtAdminGroups,
      };
    }
    return {
      topLink: { label: 'Executive Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={16} className="text-[#E58C28]" /> },
      groups: standardGroups,
    };
  };

  const navData = getRoleNavData();

  // Auto-expand ONLY the single parent group that contains the current active route
  React.useEffect(() => {
    const activeGroup = navData.groups.find((group) =>
      group.links.some(
        (l) =>
          location.pathname === l.path ||
          (l.path !== navData.topLink.path && location.pathname.startsWith(l.path))
      )
    );

    if (activeGroup) {
      setOpenGroups({ [activeGroup.groupName]: true });
      sessionStorage.setItem('sidebar_open_group', activeGroup.groupName);
    } else {
      const savedGroup = sessionStorage.getItem('sidebar_open_group');
      if (savedGroup) {
        setOpenGroups({ [savedGroup]: true });
      } else {
        setOpenGroups({});
      }
    }
  }, [location.pathname, user?.role]);

  const renderSidebarContent = (isMobile = false) => (
    <>
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80 flex flex-col items-center text-center space-y-3">
        <Link
          to="/"
          className="group flex flex-col items-center space-y-2.5 cursor-pointer"
          onClick={isMobile ? () => setSidebarOpen(false) : undefined}
        >
          {/* White Logo Container */}
          <div className="flex items-center justify-center p-3.5 bg-white rounded-[18px] border border-gray-200/80 shadow-none group-hover:border-[#E58C28]/60 transition-all duration-300">
            <img
              src="/logo/logo.png"
              alt="Tirvona"
              className="w-14 h-14 object-contain group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="flex flex-col items-center">
            <span className="font-black text-xl tracking-tight text-white group-hover:text-[#E58C28] transition-colors">
              Tirvona
            </span>
            <span className="text-xs font-semibold text-[#E58C28] tracking-wide mt-0.5">
              {getFormattedRole(user?.role)}
            </span>
          </div>
        </Link>
      </div>

      {/* Links Navigation */}
      <nav className="flex-grow p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-210px)] scrollbar-thin">
        <div className="space-y-3">
          {/* Main Role Overview Link */}
          {navData.topLink && (
            <Link
              to={navData.topLink.path}
              onClick={isMobile ? () => setSidebarOpen(false) : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black transition-all ${
                location.pathname === navData.topLink.path
                  ? 'bg-[#0A4DA6] text-white shadow-lg shadow-[#0A4DA6]/30 border-l-4 border-[#E58C28]'
                  : 'text-gray-300 hover:bg-slate-850 hover:text-white'
              }`}
            >
              {navData.topLink.icon}
              <span>{navData.topLink.label}</span>
            </Link>
          )}

          {/* Categorized Dropdown Groups (All Collapsed By Default) */}
          {navData.groups.map((group) => {
            const isOpen = openGroups[group.groupName] ?? false;
            const hasActiveLink = group.links.some((l) => location.pathname === l.path);

            return (
              <div key={group.groupName} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.groupName)}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-[10px] font-black uppercase tracking-wider transition-colors text-left rounded-xl ${
                    hasActiveLink ? 'text-[#E58C28] bg-white/5' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {group.icon}
                    <span>{group.groupName}</span>
                  </div>
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>

                {isOpen && (
                  <div className="pl-4 space-y-1 border-l border-slate-800 ml-3">
                    {group.links.map((link) => {
                      const isActive = location.pathname === link.path;
                      return (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={isMobile ? () => setSidebarOpen(false) : undefined}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                            isActive
                              ? 'bg-[#0A4DA6] text-white shadow-md border-l-2 border-[#E58C28]'
                              : 'text-gray-400 hover:text-white hover:bg-slate-850'
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
      <div className="p-4 border-t border-slate-800 space-y-3 shrink-0">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-[#E58C28]/20 border border-[#E58C28]/50 flex items-center justify-center font-black text-[#E58C28] text-xs">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold truncate max-w-[140px] text-white">{user.name}</span>
            <span className="text-[10px] text-[#E58C28] font-black tracking-wider">{getFormattedRole(user.role)}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all rounded-full text-xs font-black cursor-pointer"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] flex flex-row font-sans text-left">
      {/* ── Desktop Left Sidebar (Dark Navy Backdrop Matching Landing Page Footer & Dark Sections) ── */}
      <aside className="hidden lg:flex flex-col w-72 bg-[#0B192C] text-white border-r border-slate-800 shadow-2xl shrink-0 h-screen sticky top-0 z-30">
        {renderSidebarContent(false)}
      </aside>

      {/* ── Mobile & Tablet Overlay Drawer ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Mobile Sidebar */}
          <aside className="relative flex flex-col w-72 max-w-[85vw] bg-[#0B192C] text-white border-r border-slate-800 shadow-2xl h-full z-10">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors z-20"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* ── Right Workspace ── */}
      <div className="flex-grow flex flex-col min-w-0">
        
        {/* Floating Pill Top Navigation Header (Matching Landing Page Top Bar in Image 2) */}
        <header className="py-4 px-6 lg:px-8 shrink-0 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-xl border border-gray-200/80 dark:border-slate-800 rounded-full px-6 py-3 shadow-lg shadow-gray-200/40 dark:shadow-none flex justify-between items-center">
            
            {/* Left: Mobile Menu & Govt Badge */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-[#0B192C] dark:text-white"
              >
                <Menu size={18} />
              </button>
              <span className="px-3.5 py-1 bg-[#E58C28]/15 text-[#E58C28] border border-[#E58C28]/30 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                🇮🇳 Government Enterprise
              </span>
              <h1 className="hidden sm:block text-xs font-black text-[#0B192C] dark:text-white tracking-tight uppercase">
                {location.pathname.split('/').pop()?.replace(/-/g, ' ') || 'Super Admin Console'}
              </h1>
            </div>

            {/* Right: Quick Search + Notifications + Blue Action Pill Button */}
            <div className="flex items-center gap-3">
              <div className="relative hidden md:block w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Search modules, ashrams..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-medium focus:outline-none focus:border-[#0A4DA6]"
                />
              </div>

              {/* Active Notifications Bell */}
              <NotificationDropdown />

              {/* Solid Blue Action Pill (Matching Sign Up / Book Now Button in Landing Page Image 2) */}
              <Link
                to="/"
                className="text-xs font-extrabold px-5 py-2 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white transition-all flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/25 cursor-pointer"
              >
                <Globe size={14} className="text-[#E58C28]" /> Public Portal <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </header>

        {/* Content Workspace */}
        <main className="flex-grow p-6 lg:p-8 pb-12 lg:pb-16 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default DashboardLayout;
