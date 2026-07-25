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
  ChevronUp,
  ChevronRight,
  LayoutDashboard,
  Grid,
  ArrowRight,
  Headphones,
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
  const { unreadCount, notifications, markAllAsRead, removeNotification } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [showHeader, setShowHeader] = useState(true);

  // Hide header on scroll down, show on scroll up
  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY <= 40) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShowHeader(false);
      } else if (currentScrollY < lastScrollY) {
        setShowHeader(true);
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    { label: 'Destinations', to: '/search', hasDropdown: true },
    { label: 'Stay', to: '/search', hasDropdown: true },
    { label: 'Darshan & Seva', to: '/faq', hasDropdown: true },
    { label: 'Tirvona Local', to: '/faq', hasDropdown: true },
    { label: 'Marketplace', to: '/faq', hasDropdown: true },
    { label: 'Events', to: '/faq', hasDropdown: false },
    { label: 'Blog', to: '/faq', hasDropdown: false },
  ];

  const isHomePage = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">

      {/* ── Sticky Header (Floating Rounded Navbar - Hide on Scroll Down, Show on Scroll Up) ── */}
      <header className={`sticky top-0 z-50 pt-3 pb-3 ${isHomePage ? '-mb-20 lg:-mb-24' : 'mb-2 sm:mb-4'} pointer-events-none transition-all duration-300 ease-in-out transform ${
        showHeader || drawerOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-auto">

          {/* Simple Clean Single Floating Navbar Container */}
          <div className="bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-md border border-gray-200/90 dark:border-slate-800 rounded-full px-5 lg:px-6 py-2.5 flex items-center justify-between w-full shadow-sm hover:shadow-md transition-shadow">

            {/* Left Brand Logo Image */}
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <img
                src="/logo/logo.png"
                alt="Tirvona Sacred Destinations"
                className="h-8 sm:h-9 lg:h-10 w-auto object-contain group-hover:scale-105 transition-transform"
              />
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs xl:text-sm font-medium text-[#1E293B] dark:text-gray-200">
                {navLinks.map(link => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="hover:text-[#0A4DA6] dark:hover:text-[#E58C28] transition-colors py-1 flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <span>{link.label}</span>
                    {link.hasDropdown && <ChevronDown size={13} className="text-slate-400 dark:text-slate-500 stroke-[2.5]" />}
                  </Link>
                ))}
              </nav>

              {/* Mobile spacer / menu title */}
              <div className="lg:hidden flex-1 pl-3 text-xs font-semibold text-gray-500">
                Menu
              </div>

              {/* Right Side Action & Utility Area */}
              <div className="flex items-center gap-2 lg:gap-3">

                {/* Currency selector inside navbar */}
                <button className="hidden sm:flex text-slate-600 dark:text-gray-300 hover:text-[#D4AF37] transition-colors text-xs font-semibold items-center gap-0.5 cursor-pointer px-1.5 py-1">
                  <span>₹ INR</span><ChevronDown size={11} />
                </button>

                {/* Language globe inside navbar */}
                <button className="hidden sm:flex text-slate-600 dark:text-gray-300 hover:text-[#0A4DA6] transition-colors cursor-pointer p-1" title="Languages">
                  <Globe size={15} />
                </button>

                {/* User Auth / Action Buttons */}
                {user ? (
                  <div className="flex items-center gap-2">
                    <Link
                      to={getDashboardPath()}
                      className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 hover:bg-[#0A4DA6]/20 transition-all"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="p-1.5 rounded-full bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-all cursor-pointer"
                      title="Logout"
                    >
                      <LogOut size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      to="/login"
                      className="text-xs font-bold text-slate-700 dark:text-white hover:text-[#0A4DA6] transition-colors px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="text-xs font-bold text-white bg-[#0A4DA6] hover:bg-[#083b80] transition-colors px-4 py-2 rounded-full shadow-sm"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}

                {/* Mobile Drawer Hamburger */}
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="lg:hidden p-1.5 text-slate-700 dark:text-gray-200 cursor-pointer"
                  aria-label="Open menu"
                >
                  <Menu size={20} />
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

      {/* ── Footer matching exact reference image design ── */}
      <footer className="bg-[#0B192C] text-gray-400 pt-14 sm:pt-16 pb-0 relative overflow-hidden border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Top 5-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-6 pb-10 sm:pb-14">
            
            {/* Col 1: Brand & Help Callout — lg:col-span-3 */}
            <div className="lg:col-span-3 space-y-4">
              <Link to="/" className="flex items-center gap-2.5">
                <img src={logo} alt="Tirvona" className="w-10 h-10 object-contain" />
                <div className="flex flex-col leading-none">
                  <span className="text-xl font-black text-white">tirvona<span className="text-[#D4AF37] text-[10px] align-super">™</span></span>
                  <span className="text-[8px] font-bold tracking-widest text-[#E58C28] uppercase">One Nation, One Spiritual Stay</span>
                </div>
              </Link>
              <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                We take care of every detail so you can travel with confidence, comfort & spiritual peace.
              </p>
              
              {/* Need Help Callout */}
              <div className="pt-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#E58C28] shrink-0">
                  <Headphones size={20} />
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 dark:text-gray-400 font-bold uppercase tracking-wider">Need help? Call us</span>
                  <a href="tel:+917836055511" className="text-sm sm:text-base font-black text-white hover:text-[#E58C28] transition-colors">
                    +91 78360 55511
                  </a>
                </div>
              </div>
            </div>

            {/* Col 2: Quick Links — lg:col-span-2 */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-sm font-extrabold text-white">Quick Links</h4>
              <ul className="text-xs space-y-2.5 text-gray-400 font-medium">
                <li><Link to="/search" className="hover:text-white transition-colors">Ashram Bookings</Link></li>
                <li><Link to="/search" className="hover:text-white transition-colors">Destinations</Link></li>
                <li><Link to="/search" className="hover:text-white transition-colors">Pilgrimage Circuits</Link></li>
                <li><Link to="/search" className="hover:text-white transition-colors">Stay Types</Link></li>
                <li><Link to="/faq" className="hover:text-white transition-colors">How It Works</Link></li>
              </ul>
            </div>

            {/* Col 3: Popular Services — lg:col-span-2 */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-sm font-extrabold text-white">Popular Services</h4>
              <ul className="text-xs space-y-2.5 text-gray-400 font-medium">
                <li><Link to="/search" className="hover:text-white transition-colors">Ashram Reservations</Link></li>
                <li><Link to="/search" className="hover:text-white transition-colors">Temple Darshan & Seva</Link></li>
                <li><Link to="/search" className="hover:text-white transition-colors">Mahaprasad Delivery</Link></li>
                <li><Link to="/faq" className="hover:text-white transition-colors">Travel Insurance</Link></li>
                <li><Link to="/faq" className="hover:text-white transition-colors">Tour Guide Services</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Yatra Assistance</Link></li>
              </ul>
            </div>

            {/* Col 4: Newsletter — lg:col-span-3 */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-sm font-extrabold text-white">Newsletter</h4>
              <p className="text-xs text-gray-400">Get every sacred travel news update</p>
              <form onSubmit={e => e.preventDefault()} className="space-y-2.5 pt-1">
                <input
                  type="email"
                  placeholder="Email address"
                  className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-xs text-white placeholder:text-gray-400 focus:outline-none focus:border-[#E58C28]"
                />
                <button
                  type="submit"
                  className="w-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold py-2.5 px-5 rounded-full flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span>Subscribe</span>
                  <div className="w-5 h-5 rounded-full bg-white text-[#0A4DA6] flex items-center justify-center">
                    <ArrowRight size={12} className="stroke-[3]" />
                  </div>
                </button>
              </form>
            </div>

            {/* Col 5: Follow Us — lg:col-span-2 */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-sm font-extrabold text-white">Follow Us</h4>
              <div className="flex items-center gap-3 pt-1">
                {/* Facebook */}
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-[#0A4DA6] hover:border-[#0A4DA6] text-gray-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs group"
                  title="Facebook"
                >
                  <svg className="w-4 h-4 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-[#0A4DA6] hover:border-[#0A4DA6] text-gray-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs group"
                  title="Instagram"
                >
                  <svg className="w-4 h-4 stroke-current fill-none transition-transform group-hover:scale-110" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </a>

                {/* YouTube */}
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-[#0A4DA6] hover:border-[#0A4DA6] text-gray-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs group"
                  title="YouTube"
                >
                  <svg className="w-4 h-4 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>

          </div>

          {/* GIANT TYPOGRAPHY WATERMARK WITH IMAGE MASK (Matching Reference Screenshot) */}
          <div className="py-8 sm:py-12 text-center border-t border-slate-800/80 select-none overflow-hidden">
            <h1
              className="text-5xl sm:text-8xl lg:text-[140px] font-black uppercase tracking-tight leading-none text-transparent bg-clip-text bg-cover bg-center"
              style={{
                backgroundImage: "url('https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1600&q=80')",
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontFamily: "Satoshi, 'General Sans', Inter, sans-serif",
                letterSpacing: '-0.04em',
              }}
            >
              Sacred Yatra
            </h1>
          </div>

        </div>

        {/* BOTTOM SUB-FOOTER BAR WITH WAVY SOFT CREAM BACKGROUND (Matching Reference Screenshot) */}
        <div className="bg-[#071322] text-gray-400 pt-6 pb-6 border-t border-slate-800 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold">
            
            {/* Left Copyright */}
            <div className="text-gray-400">
              © {new Date().getFullYear()} <span className="text-white font-extrabold">Tirvona</span>. All Rights Reserved.
            </div>

            {/* Right Links */}
            <div className="flex items-center gap-6 text-xs font-medium text-gray-400">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy policy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
              <Link to="/faq" className="hover:text-white transition-colors">FAQs</Link>
            </div>

            {/* Scroll To Top Button */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-9 h-9 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 cursor-pointer shrink-0"
              title="Back to Top"
            >
              <ChevronUp size={18} className="stroke-[3]" />
            </button>

          </div>
        </div>

      </footer>
    </div>
  );
};
export default PublicLayout;
