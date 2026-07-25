import React, { useState } from 'react';
import logo from '../assets/logo.png';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Home, 
  Bed, 
  Calendar, 
  History, 
  ShieldAlert, 
  Users, 
  Wrench, 
  LogOut, 
  FileCheck, 
  LifeBuoy, 
  Menu, 
  X,
  ClipboardList,
  Tag
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  // Define sidebar links based on active role
  const getSidebarLinks = () => {
    const role = user.role;

    if (role === 'owner') {
      const isMasterOwner = user.email === 'owner@tirvona.com' || user.role === 'super_admin';
      const links = [
        { label: 'Overview', path: '/owner/dashboard', icon: <LayoutDashboard size={16} /> },
        { label: 'My Ashrams', path: '/owner/ashrams', icon: <Home size={16} /> },
        { label: 'Manage Rooms', path: '/owner/rooms', icon: <Bed size={16} /> },
        { label: 'Rate Calendar', path: '/owner/calendar', icon: <Calendar size={16} /> },
        { label: 'Offers & Deals', path: '/owner/offers', icon: <Tag size={16} /> },
        { label: 'Staff', path: '/owner/staff', icon: <Users size={16} /> },
        { label: 'Housekeeping', path: '/staff/housekeeping', icon: <ClipboardList size={16} /> },
      ];
      if (isMasterOwner) {
        links.push({ label: 'Users & Staff', path: '/owner/users', icon: <Users size={16} /> });
      }
      links.push({ label: 'Support Tickets', path: '/support', icon: <LifeBuoy size={16} /> });
      return links;
    }
    
    if (role === 'manager' || role === 'reception') {
      return [
        { label: 'Reception Desk', path: '/staff/reception', icon: <LayoutDashboard size={16} /> },
        { label: 'Housekeeping Grid', path: '/staff/housekeeping', icon: <ClipboardList size={16} /> },
        { label: 'Room Calendar', path: '/owner/calendar', icon: <Calendar size={16} /> },
        { label: 'Support', path: '/support', icon: <LifeBuoy size={16} /> },
      ];
    }

    if (role === 'housekeeping') {
      return [
        { label: 'Housekeeping Status', path: '/staff/housekeeping', icon: <ClipboardList size={16} /> },
      ];
    }

    if (role === 'district_officer' || role === 'govt_admin' || role === 'super_admin') {
      const baseLinks = [
        { label: 'Admin Console', path: '/admin/dashboard', icon: <LayoutDashboard size={16} /> },
        { label: 'Verification Queue', path: '/admin/verifications', icon: <FileCheck size={16} /> },
        { label: 'Registered Users', path: '/admin/users', icon: <Users size={16} /> },
      ];
      if (role === 'super_admin') {
        baseLinks.push({ label: 'Audit Logs', path: '/admin/audit-logs', icon: <ShieldAlert size={16} /> });
      }
      return baseLinks;
    }

    // Fallback Customer links
    return [
      { label: 'My Bookings', path: '/dashboard', icon: <History size={16} /> },
      { label: 'Support Tickets', path: '/support', icon: <LifeBuoy size={16} /> },
    ];
  };

  const links = getSidebarLinks();

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#070F1B] text-foreground">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0B192C] text-white border-r border-slate-800 z-20">
        {/* Brand */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800 gap-3">
          <img src={logo} alt="Tirvona Logo" className="w-8 h-8 object-contain" />
          <div className="flex flex-col">
            <span className="font-black text-sm tracking-tight flex items-center">
              tirvona<span className="text-[#D4AF37] text-[8px] align-super">™</span>
            </span>
            <span className="text-[8px] text-gray-500 font-extrabold capitalize tracking-wide">{user.role.replace('_', ' ')} Panel</span>
          </div>
        </div>

        {/* Links Navigation */}
        <nav className="flex-grow p-4 space-y-1.5">
          {links.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold tracking-wide transition-all ${
                  isActive 
                    ? 'bg-primary text-white shadow-md shadow-primary/20' 
                    : 'text-gray-400 hover:bg-slate-850 hover:text-white'
                }`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile bottom bar */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/35 flex items-center justify-center font-black text-[#D4AF37] text-xs">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold truncate max-w-[140px]">{user.name}</span>
              <span className="text-[10px] text-gray-500 capitalize">{user.role.replace('_', ' ')}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 transition-all rounded-full text-xs font-bold cursor-pointer"
          >
            <LogOut size={12} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile Menu Drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-[#0B192C] text-white h-full p-6 animate-in slide-in-from-left duration-200">
            <button 
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/5 rounded-full"
            >
              <X size={20} />
            </button>

            <div className="h-12 flex items-center mb-6 gap-3">
              <img src={logo} alt="Tirvona Logo" className="w-8 h-8 object-contain" />
              <span className="font-black text-sm tracking-tight">tirvona<span className="text-[#D4AF37] text-[8px] align-super">™</span></span>
            </div>

            <nav className="flex-grow space-y-1">
              {links.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold transition-all ${
                      isActive ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 bg-danger/10 text-danger border border-danger/20 rounded-full text-xs font-bold"
              >
                <LogOut size={12} />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Right Column Layout */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 bg-white dark:bg-[#070F1B] border-b border-gray-100 dark:border-slate-800 flex justify-between items-center px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-sm font-extrabold text-[#0B192C] dark:text-white tracking-wide uppercase">
              {location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              to="/"
              className="text-xs font-semibold px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-[#0B192C] dark:text-gray-300"
            >
              <Home size={12} /> View Portal
            </Link>

            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs capitalize">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-grow p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default DashboardLayout;
