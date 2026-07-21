import React, { useState, useEffect, useRef } from 'react';
import logo from '../assets/logo.png';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  LogOut,
  Menu,
  X,
  Bell,
  Sun,
  Moon,
  Globe,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
} from 'lucide-react';

// ─── Accordion item for mobile footer ────────────────────────────────────────
const FooterAccordion: React.FC<{ title: string; titleColor?: string; children: React.ReactNode }> = ({
  title,
  titleColor = 'text-white',
  children,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center py-4 text-left"
      >
        <span className={`text-xs font-extrabold uppercase tracking-wider ${titleColor}`}>{title}</span>
        <ChevronRight
          size={14}
          className={`text-gray-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 pb-4' : 'max-h-0'}`}
      >
        {children}
      </div>
    </div>
  );
};

// ─── Main Layout ──────────────────────────────────────────────────────────────
export const PublicLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { unreadCount, notifications, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
    setShowNotifications(false);
  }, [location.pathname]);

  // Close notification popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const toggleDarkMode = () => {
    setDarkMode(d => !d);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setDrawerOpen(false);
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (['district_officer', 'govt_admin', 'super_admin'].includes(user.role)) return '/admin/dashboard';
    if (user.role !== 'customer') return '/owner/dashboard';
    return '/dashboard';
  };

  const navLinks = [
    { label: 'Destinations', to: '/search' },
    { label: 'Stay', to: '/search' },
    { label: 'Darshan & Seva', to: '/faq' },
    { label: 'Tirvona Local', to: '/faq' },
    { label: 'Marketplace', to: '/faq' },
    { label: 'Events', to: '/faq' },
    { label: 'Blog', to: '/faq' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#070F1B]/95 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Desktop utility bar */}
          <div className="hidden lg:flex justify-end items-center gap-6 h-9 text-xs border-b border-gray-50 dark:border-slate-800/50">
            <Link to="/faq" className="text-gray-500 hover:text-primary transition-colors font-medium">Help</Link>
            <button className="text-gray-500 hover:text-[#D4AF37] transition-colors font-medium flex items-center gap-1 cursor-pointer">
              <span>₹ INR</span><ChevronDown size={10} />
            </button>
            <button className="text-gray-500 hover:text-primary transition-colors cursor-pointer" title="Languages">
              <Globe size={13} />
            </button>
            <button onClick={toggleDarkMode} className="p-1 rounded-full text-gray-400 hover:text-[#D4AF37] transition-colors cursor-pointer">
              {darkMode ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>

          {/* Main nav row */}
          <div className="h-16 lg:h-20 flex justify-between items-center gap-3">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <img src={logo} alt="Tirvona" className="w-8 h-8 lg:w-11 lg:h-11 object-contain" />
              <div className="flex flex-col leading-tight">
                <span className="text-base lg:text-xl font-black tracking-tight text-[#0B192C] dark:text-white flex items-center leading-none">
                  tirvona<span className="text-[#D4AF37] text-[8px] align-super ml-0.5">™</span>
                </span>
                <span className="hidden sm:block text-[6px] lg:text-[7.5px] text-gray-400 dark:text-gray-500 font-extrabold tracking-wider uppercase mt-0.5">
                  CONNECTING SACRED DESTINATIONS
                </span>
              </div>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden lg:flex items-center gap-6 xl:gap-8 font-medium text-xs xl:text-sm text-[#0B192C] dark:text-gray-200">
              {navLinks.map(link => (
                <Link key={link.label} to={link.to} className="hover:text-primary transition-colors py-2 font-semibold">
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Desktop auth */}
            <div className="hidden lg:flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3 border-l border-gray-100 dark:border-slate-800 pl-4">
                  <div className="relative" ref={notifRef}>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
                    >
                      <Bell size={15} className="text-[#0B192C] dark:text-gray-300" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-danger text-white rounded-full text-[8px] font-bold flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                    {showNotifications && (
                      <div className="absolute right-0 mt-3 w-80 bg-card border border-border rounded-xl shadow-xl p-4 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-xs">Notifications</h4>
                          <button onClick={markAllAsRead} className="text-[10px] text-primary font-semibold hover:underline cursor-pointer">Mark all read</button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <p className="text-[10px] text-gray-500 text-center py-4">No new notifications</p>
                          ) : (
                            notifications.map(n => (
                              <div key={n.id} className="p-2 rounded-lg bg-background border border-border text-[10px]">
                                <div className="font-semibold text-secondary dark:text-accent">{n.title}</div>
                                <div className="text-gray-500 mt-0.5">{n.message}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <Link
                    to={getDashboardPath()}
                    className="text-xs font-bold px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-all"
                  >
                    Dashboard
                  </Link>
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-none">{user.name}</span>
                    <span className="text-[9px] text-gray-400 capitalize mt-0.5">{user.role.replace('_', ' ')}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-full bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 transition-all cursor-pointer"
                    title="Logout"
                  >
                    <LogOut size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login" className="text-xs font-bold px-5 py-2 text-[#0B192C] dark:text-white border border-gray-200 dark:border-slate-700 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">Login</Link>
                  <Link to="/register" className="text-xs font-bold px-5 py-2 bg-primary text-white rounded-full hover:bg-opacity-90 shadow-md shadow-primary/10 transition-all">Sign Up</Link>
                </div>
              )}
            </div>

            {/* Mobile right side: Bell + Hamburger */}
            <div className="flex lg:hidden items-center gap-1">
              {/* Notification bell (mobile) */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell size={20} className="text-[#0B192C] dark:text-gray-200" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full" />
                  )}
                </button>
                {/* Mobile notification dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl p-4 z-50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-xs text-[#0B192C] dark:text-white">Notifications</h4>
                      <button onClick={markAllAsRead} className="text-[10px] text-primary font-semibold cursor-pointer">Mark all read</button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-3">No new notifications</p>
                      ) : (
                        notifications.slice(0, 5).map(n => (
                          <div key={n.id} className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 text-[10px]">
                            <div className="font-bold text-[#0B192C] dark:text-white">{n.title}</div>
                            <div className="text-gray-400 mt-0.5">{n.message}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Hamburger */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Open menu"
              >
                <Menu size={22} className="text-[#0B192C] dark:text-gray-200" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* ── Mobile Sliding Drawer ── */}
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer panel — slides from right */}
      <div
        className={`lg:hidden fixed top-0 right-0 h-full w-[85vw] max-w-[320px] bg-white dark:bg-[#0B192C] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
          <Link to="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2">
            <img src={logo} alt="Tirvona" className="w-8 h-8 object-contain" />
            <span className="font-black text-base text-[#0B192C] dark:text-white">
              tirvona<span className="text-[#D4AF37] text-[8px] align-super">™</span>
            </span>
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-grow overflow-y-auto px-5 py-4 space-y-1">

          {/* User info (if logged in) */}
          {user && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-sm flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-[#0B192C] dark:text-white block truncate">{user.name}</span>
                <span className="text-[10px] text-gray-400 capitalize">{user.role.replace(/_/g, ' ')}</span>
              </div>
            </div>
          )}

          {/* Nav links */}
          <nav className="space-y-0.5">
            {navLinks.map(link => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors"
              >
                {link.label}
                <ChevronRight size={14} className="text-gray-300" />
              </Link>
            ))}

            {/* Dashboard link if logged in */}
            {user && (
              <Link
                to={getDashboardPath()}
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl text-sm font-bold text-primary hover:bg-primary/5 transition-colors"
              >
                <span className="flex items-center gap-2"><LayoutDashboard size={15} /> Dashboard</span>
                <ChevronRight size={14} className="text-primary/50" />
              </Link>
            )}
          </nav>

          {/* Divider */}
          <div className="h-px bg-gray-100 dark:bg-slate-800 my-4" />

          {/* Utilities */}
          <div className="space-y-2">
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-between py-3 px-3 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors"
            >
              <span className="flex items-center gap-2">
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                {darkMode ? 'Light' : 'Dark'} Mode
              </span>
            </button>
            <div className="flex items-center justify-between py-3 px-3 rounded-xl text-sm text-gray-500">
              <span className="flex items-center gap-2"><Globe size={15} /> Currency</span>
              <span className="font-bold text-gray-700 dark:text-gray-200">₹ INR</span>
            </div>
          </div>
        </div>

        {/* Drawer footer — auth buttons */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-800 space-y-3">
          {user ? (
            <button
              onClick={handleLogout}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-danger/10 text-danger border border-danger/20 rounded-full font-bold text-sm"
            >
              <LogOut size={15} /> Logout
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/login"
                onClick={() => setDrawerOpen(false)}
                className="min-h-[48px] flex items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-full font-bold text-sm text-gray-700 dark:text-gray-200"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={() => setDrawerOpen(false)}
                className="min-h-[48px] flex items-center justify-center bg-primary text-white rounded-full font-bold text-sm shadow-md"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="bg-[#0B192C] text-gray-400 pt-10 pb-6">

        {/* ── Mobile footer (accordion) ── */}
        <div className="lg:hidden px-4 max-w-7xl mx-auto">

          {/* Brand — always visible, no toggle */}
          <div className="py-6 border-b border-white/10 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo} alt="Tirvona" className="w-9 h-9 object-contain" />
              <div className="flex flex-col leading-none">
                <span className="text-base font-black text-white">tirvona<span className="text-[#D4AF37] text-[8px] align-super">™</span></span>
                <span className="text-[8px] font-bold tracking-widest text-[#D4AF37] uppercase">One Nation, One Spiritual Stay</span>
              </div>
            </Link>
            <p className="text-xs text-gray-400 leading-relaxed">
              Eliminating manual paper logs to provide safe, verified, and digital booking accommodations for holy stays across India.
            </p>
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#D4AF37"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              <span className="text-[9px] font-bold text-gray-300 leading-tight">Ministry of Tourism & IT Division<br />Government of India</span>
            </div>
            {/* Social icons */}
            <div className="flex items-center gap-5 text-gray-500">
              {[
                { title: 'Facebook', path: 'M9 8H7v3h2v9h3v-9h3.6l.4-3H12V6c0-.9.1-1.2 1-1.2h2V2h-3c-3.1 0-4 1.4-4 4.1V8z' },
                { title: 'Twitter', path: 'M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z' },
              ].map(s => (
                <a key={s.title} href="#" className="hover:text-[#D4AF37] transition-colors" title={s.title}>
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d={s.path} /></svg>
                </a>
              ))}
            </div>
          </div>

          {/* Accordion columns */}
          <FooterAccordion title="Company">
            <ul className="text-xs space-y-3 text-gray-400">
              {['About Us', 'Careers', 'Partner With Us', 'Press & Media'].map(l => (
                <li key={l}><a href="#" className="hover:text-[#D4AF37] transition-colors">{l}</a></li>
              ))}
            </ul>
          </FooterAccordion>

          <FooterAccordion title="Support">
            <ul className="text-xs space-y-3 text-gray-400">
              {['Help Center', 'Contact Us'].map(l => <li key={l}><a href="#" className="hover:text-[#D4AF37]">{l}</a></li>)}
              <li><Link to="/faq" className="hover:text-[#D4AF37]">FAQs</Link></li>
              <li><a href="#" className="hover:text-[#D4AF37]">Cancellation Policy</a></li>
            </ul>
          </FooterAccordion>

          <FooterAccordion title="Popular Retreats" titleColor="text-[#D4AF37]">
            <ul className="text-xs space-y-3 text-gray-400">
              {['Rishikesh Spiritual Valley', 'Varanasi Dharamshalas', 'Haridwar Ghat Stays', 'Vrindavan Pilgrim Hostels'].map(l => (
                <li key={l}><a href="#" className="hover:text-[#D4AF37]">{l}</a></li>
              ))}
            </ul>
          </FooterAccordion>

          <FooterAccordion title="Information" titleColor="text-[#D4AF37]">
            <ul className="text-xs space-y-3 text-gray-400">
              <li><Link to="/faq" className="hover:text-[#D4AF37]">FAQs</Link></li>
              {['Government Guidelines', 'Owner Registration Guide', 'Terms of Stay & Policies'].map(l => (
                <li key={l}><a href="#" className="hover:text-[#D4AF37]">{l}</a></li>
              ))}
            </ul>
          </FooterAccordion>

          <FooterAccordion title="Legal">
            <ul className="text-xs space-y-3 text-gray-400">
              {['Terms of Use', 'Privacy Policy', 'Refund Policy', 'Cookie Policy'].map(l => (
                <li key={l}><a href="#" className="hover:text-[#D4AF37]">{l}</a></li>
              ))}
            </ul>
          </FooterAccordion>

          <FooterAccordion title="Download App">
            <div className="grid grid-cols-2 gap-3 pt-1">
              {[
                { store: 'Google Play', sub: 'Get it on', icon: 'M3.18 23.76c.38.22.82.24 1.22.06L16.6 12 12.34 7.74 3.18 23.76zm16.46-13.1L17.1 9.3 12.34 12l4.76 2.7 2.54-1.38a1.4 1.4 0 000-2.66zM2.32 1.16a1.4 1.4 0 00-.32.9v19.88c0 .33.1.65.32.9l.1.09L12.34 12.1v-.2L2.42 1.07l-.1.09zm9.83 10.72l-9.6 9.6 11.38-6.55-1.78-3.05z' },
                { store: 'App Store', sub: 'Download on the', icon: 'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z' },
              ].map(a => (
                <a key={a.store} href="#" className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/15 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0"><path d={a.icon} /></svg>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-gray-400 leading-none">{a.sub}</span>
                    <span className="text-[11px] font-bold text-white leading-tight">{a.store}</span>
                  </div>
                </a>
              ))}
            </div>
          </FooterAccordion>

          <FooterAccordion title="Contact Us" titleColor="text-[#D4AF37]">
            <ul className="text-xs space-y-3 text-gray-400">
              <li className="flex items-start gap-2"><span className="text-[#D4AF37]">📞</span><span><span className="font-bold text-white">+91 78360 55511</span><br /><span className="text-[10px]">NKTech Technology Support</span></span></li>
              <li className="flex items-start gap-2"><span className="text-[#D4AF37]">✉</span><a href="mailto:info@nktech.in" className="hover:text-[#D4AF37]">info@nktech.in</a></li>
              <li className="flex items-start gap-2"><span className="text-[#D4AF37] shrink-0">📍</span><span>3rd Floor, ITHUM TOWER, 307B, Sector 62, Noida, UP 201301</span></li>
              <li className="flex items-start gap-2"><span className="text-[#D4AF37]">🏥</span><span>Emergency Ashram Medical Desk <span className="font-bold text-white">24/7</span></span></li>
            </ul>
          </FooterAccordion>

          {/* Bottom */}
          <div className="pt-6 text-center text-[10px] text-gray-500 space-y-1">
            <p>© {new Date().getFullYear()} NKTech Technology. All Rights Reserved.</p>
            <p>Designed in compliance with Digital India guidelines.</p>
            <p className="flex items-center justify-center gap-1 pt-1">Made with ❤️ in India</p>
          </div>
        </div>

        {/* ── Desktop footer (original grid layout) ── */}
        <div className="hidden lg:block px-6 sm:px-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-9 gap-8">

            {/* Brand */}
            <div className="lg:col-span-2 space-y-4">
              <Link to="/" className="flex items-center gap-2.5">
                <img src={logo} alt="Tirvona" className="w-10 h-10 object-contain" />
                <div className="flex flex-col leading-none">
                  <span className="text-lg font-black text-white">tirvona<span className="text-[#D4AF37] text-[9px] align-super">™</span></span>
                  <span className="text-[8px] font-bold tracking-widest text-[#D4AF37] uppercase">One Nation, One Spiritual Stay</span>
                </div>
              </Link>
              <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                Eliminating manual paper logs to provide safe, verified, and digital booking accommodations for holy stays and spiritual retreats across the Indian subcontinent.
              </p>
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#D4AF37"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                <span className="text-[9px] font-bold text-gray-300 leading-tight">Ministry of Tourism & IT Division<br />Government of India</span>
              </div>
              <div className="flex items-center gap-4 text-gray-500 pt-1">
                <a href="#" className="hover:text-[#D4AF37] transition-colors" title="Facebook">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M9 8H7v3h2v9h3v-9h3.6l.4-3H12V6c0-.9.1-1.2 1-1.2h2V2h-3c-3.1 0-4 1.4-4 4.1V8z" /></svg>
                </a>
                <a href="#" className="hover:text-[#D4AF37] transition-colors" title="Instagram">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                </a>
                <a href="#" className="hover:text-[#D4AF37] transition-colors" title="Youtube">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                </a>
                <a href="#" className="hover:text-[#D4AF37] transition-colors" title="Twitter">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-5">Company</h4>
              <ul className="text-xs space-y-3">
                {['About Us', 'Careers', 'Partner With Us', 'Press & Media'].map(l => <li key={l}><a href="#" className="hover:text-[#D4AF37] transition-colors">{l}</a></li>)}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-5">Support</h4>
              <ul className="text-xs space-y-3">
                {['Help Center', 'Contact Us'].map(l => <li key={l}><a href="#" className="hover:text-[#D4AF37]">{l}</a></li>)}
                <li><Link to="/faq" className="hover:text-[#D4AF37]">FAQs</Link></li>
                <li><a href="#" className="hover:text-[#D4AF37]">Cancellation Policy</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#D4AF37] mb-5">Popular Retreats</h4>
              <ul className="text-xs space-y-3">
                {['Rishikesh Spiritual Valley', 'Varanasi Dharamshalas', 'Haridwar Ghat Stays', 'Vrindavan Pilgrim Hostels'].map(l => (
                  <li key={l}><a href="#" className="hover:text-[#D4AF37]">{l}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#D4AF37] mb-5">Information</h4>
              <ul className="text-xs space-y-3">
                <li><Link to="/faq" className="hover:text-[#D4AF37]">FAQs</Link></li>
                {['Government Guidelines', 'Owner Registration Guide', 'Terms of Stay & Policies'].map(l => (
                  <li key={l}><a href="#" className="hover:text-[#D4AF37]">{l}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-5">Legal</h4>
              <ul className="text-xs space-y-3">
                {['Terms of Use', 'Privacy Policy', 'Refund Policy', 'Cookie Policy'].map(l => (
                  <li key={l}><a href="#" className="hover:text-[#D4AF37]">{l}</a></li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-4">Download App</h4>
                <div className="flex flex-col gap-2.5">
                  <a href="#" className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/15 transition-colors">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0"><path d="M3.18 23.76c.38.22.82.24 1.22.06L16.6 12 12.34 7.74 3.18 23.76zm16.46-13.1L17.1 9.3 12.34 12l4.76 2.7 2.54-1.38a1.4 1.4 0 000-2.66zM2.32 1.16a1.4 1.4 0 00-.32.9v19.88c0 .33.1.65.32.9l.1.09L12.34 12.1v-.2L2.42 1.07l-.1.09zm9.83 10.72l-9.6 9.6 11.38-6.55-1.78-3.05z" /></svg>
                    <div className="flex flex-col"><span className="text-[8px] text-gray-400 leading-none">Get it on</span><span className="text-[11px] font-bold text-white leading-tight">Google Play</span></div>
                  </a>
                  <a href="#" className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/15 transition-colors">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                    <div className="flex flex-col"><span className="text-[8px] text-gray-400 leading-none">Download on the</span><span className="text-[11px] font-bold text-white leading-tight">App Store</span></div>
                  </a>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#D4AF37] mb-4">Contact Us</h4>
                <ul className="text-xs space-y-2.5 text-gray-400">
                  <li className="flex items-start gap-1.5"><span className="text-[#D4AF37] mt-px">📞</span><span><span className="font-bold text-white">+91 78360 55511</span><br /><span className="text-[10px]">NKTech Technology Support</span></span></li>
                  <li className="flex items-start gap-1.5"><span className="text-[#D4AF37] mt-px">✉</span><a href="mailto:info@nktech.in" className="hover:text-[#D4AF37] break-all">info@nktech.in</a></li>
                  <li className="flex items-start gap-1.5"><span className="text-[#D4AF37] mt-px shrink-0">📍</span><span className="leading-relaxed">3rd Floor, ITHUM TOWER, 307B,<br />Sector 62, Noida, UP 201301</span></li>
                  <li className="flex items-start gap-1.5"><span className="text-[#D4AF37] mt-px">🏥</span><span>Emergency Ashram Medical Desk <span className="font-bold text-white">24/7</span></span></li>
                </ul>
              </div>
            </div>

          </div>

          <div className="max-w-7xl mx-auto mt-14 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-gray-500">
            <div className="text-center sm:text-left leading-relaxed">
              © {new Date().getFullYear()} NKTech Technology. All Rights Reserved.<br />
              Designed in compliance with Digital India guidelines.
            </div>
            <div className="flex items-center gap-2 font-medium text-gray-500">
              <span>Made with ❤️ in India</span>
            </div>
          </div>
        </div>

      </footer>
    </div>
  );
};
export default PublicLayout;
