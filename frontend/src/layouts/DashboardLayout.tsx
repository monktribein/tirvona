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
  ClipboardList
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
      return [
        { label: 'Overview', path: '/owner/dashboard', icon: <LayoutDashboard size={18} /> },
        { label: 'My Ashrams', path: '/owner/ashrams', icon: <Home size={18} /> },
        { label: 'Manage Rooms', path: '/owner/rooms', icon: <Bed size={18} /> },
        { label: 'Rate Calendar', path: '/owner/calendar', icon: <Calendar size={18} /> },
        { label: 'Support Tickets', path: '/support', icon: <LifeBuoy size={18} /> },
      ];
    }
    
    if (role === 'manager' || role === 'reception') {
      return [
        { label: 'Reception Desk', path: '/staff/reception', icon: <LayoutDashboard size={18} /> },
        { label: 'Housekeeping Grid', path: '/staff/housekeeping', icon: <ClipboardList size={18} /> },
        { label: 'Room Calendar', path: '/owner/calendar', icon: <Calendar size={18} /> },
        { label: 'Support', path: '/support', icon: <LifeBuoy size={18} /> },
      ];
    }

    if (role === 'housekeeping') {
      return [
        { label: 'Housekeeping Status', path: '/staff/housekeeping', icon: <ClipboardList size={18} /> },
      ];
    }

    if (role === 'district_officer' || role === 'govt_admin' || role === 'super_admin') {
      const baseLinks = [
        { label: 'Admin Console', path: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
        { label: 'Verification Queue', path: '/admin/verifications', icon: <FileCheck size={18} /> },
        { label: 'Registered Users', path: '/admin/users', icon: <Users size={18} /> },
      ];
      if (role === 'super_admin') {
        baseLinks.push({ label: 'Audit Logs', path: '/admin/audit-logs', icon: <ShieldAlert size={18} /> });
      }
      return baseLinks;
    }

    // Fallback Customer links
    return [
      { label: 'My Bookings', path: '/dashboard', icon: <History size={18} /> },
      { label: 'Support Tickets', path: '/support', icon: <LifeBuoy size={18} /> },
    ];
  };

  const links = getSidebarLinks();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-secondary text-white border-r border-white/5 z-20">
        {/* Brand */}
        <div className="h-20 flex items-center px-6 border-b border-white/10 gap-3">
          <img src={logo} alt="Tirvona Logo" className="w-8 h-8 object-contain rounded-lg" />
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-wide">Tirvona</span>
            <span className="text-[10px] text-gray-400 capitalize">{user.role.replace('_', ' ')} Dashboard</span>
          </div>
        </div>

        {/* Links Navigation */}
        <nav className="flex-grow p-4 space-y-1">
          {links.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  isActive 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile bottom bar */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-bold text-accent">
              {user.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold truncate max-w-[140px]">{user.name}</span>
              <span className="text-[10px] text-gray-400 capitalize">{user.role.replace('_', ' ')}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-danger/10 text-danger border border-danger/25 hover:bg-danger/20 transition-all rounded-lg text-xs font-bold cursor-pointer"
          >
            <LogOut size={14} />
            <span>Logout Account</span>
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile Menu Drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-secondary text-white h-full p-6 animate-in slide-in-from-left duration-200">
            <button 
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/5 rounded-lg"
            >
              <X size={20} />
            </button>

            <div className="h-12 flex items-center mb-6 gap-3">
              <img src={logo} alt="Tirvona Logo" className="w-8 h-8 object-contain rounded-lg" />
              <span className="font-bold text-sm tracking-wide">Tirvona</span>
            </div>

            <nav className="flex-grow space-y-1">
              {links.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                      isActive ? 'bg-primary text-white shadow-md' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 bg-danger/15 text-danger rounded-lg text-xs font-bold"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Right Column Layout */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 bg-card border-b border-border flex justify-between items-center px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-bold text-secondary dark:text-white capitalize">
              {location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              to="/"
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-gray-600 dark:text-gray-300"
            >
              <Home size={14} /> View Portal
            </Link>

            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm">
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
