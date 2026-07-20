import React, { useState } from 'react';
import logo from '../assets/logo.png';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  HelpCircle, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  Sun, 
  Moon, 
  Globe, 
  ChevronDown
} from 'lucide-react';

export const PublicLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { unreadCount, notifications, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#070F1B]/95 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Top small utilities bar — hidden on mobile */}
          <div className="hidden lg:flex justify-end items-center gap-6 h-9 text-xs border-b border-gray-50 dark:border-slate-800/50">
            <Link to="/faq" className="text-gray-500 hover:text-primary transition-colors font-medium">
              Help
            </Link>
            <button className="text-gray-500 hover:text-[#D4AF37] transition-colors font-medium flex items-center gap-1 cursor-pointer">
              <span>₹ INR</span>
              <ChevronDown size={10} />
            </button>
            <button className="text-gray-500 hover:text-primary transition-colors cursor-pointer" title="Languages">
              <Globe size={13} />
            </button>
            {/* Dark Mode Switcher */}
            <button 
              onClick={toggleDarkMode}
              className="p-1 rounded-full text-gray-400 hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              {darkMode ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>

          {/* Main Logo & Navigation row */}
          <div className="h-16 lg:h-20 flex justify-between items-center">
            
            {/* Logo Section */}
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <img src={logo} alt="Tirvona Logo" className="w-9 h-9 lg:w-11 lg:h-11 object-contain" />
              <div className="flex flex-col leading-tight">
                <span className="text-lg lg:text-xl font-black tracking-tight text-[#0B192C] dark:text-white flex items-center leading-none">
                  tirvona<span className="text-[#D4AF37] text-[9px] align-super ml-0.5">™</span>
                </span>
                <span className="text-[6.5px] lg:text-[7.5px] text-gray-400 dark:text-gray-500 font-extrabold tracking-wider uppercase mt-0.5">
                  CONNECTING SACRED DESTINATIONS. EMPOWERING COMMUNITIES.
                </span>
              </div>
            </Link>

            {/* Navigation links — aligned to logo left-of-center */}
            <nav className="hidden lg:flex items-center gap-6 xl:gap-8 font-medium text-xs xl:text-sm text-[#0B192C] dark:text-gray-200">
              <Link to="/search" className="hover:text-primary transition-colors py-2 font-semibold">
                Destinations
              </Link>
              <Link to="/search" className="hover:text-primary transition-colors py-2 font-semibold">
                Stay
              </Link>
              <Link to="/faq" className="hover:text-primary transition-colors py-2 font-semibold">
                Darshan & Seva
              </Link>
              <Link to="/faq" className="hover:text-primary transition-colors py-2 font-semibold">
                Tirvona Local
              </Link>
              <Link to="/faq" className="hover:text-primary transition-colors py-2 font-semibold">
                Marketplace
              </Link>
              <Link to="/faq" className="hover:text-primary transition-colors py-2 font-semibold">
                Events
              </Link>
              <Link to="/faq" className="hover:text-primary transition-colors py-2 font-semibold">
                Blog
              </Link>
            </nav>

            {/* Auth Buttons */}
            <div className="hidden lg:flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3 border-l border-gray-100 dark:border-slate-800 pl-4">
                  {/* Notifications Indicator */}
                  <div className="relative">
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
                          <button onClick={markAllAsRead} className="text-[10px] text-primary font-semibold hover:underline cursor-pointer">
                            Mark all read
                          </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <p className="text-[10px] text-gray-500 text-center py-4">No new notifications</p>
                          ) : (
                            notifications.map((n) => (
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
                    to={user.role !== 'customer' ? (['district_officer', 'govt_admin', 'super_admin'].includes(user.role) ? '/admin/dashboard' : '/owner/dashboard') : '/dashboard'}
                    className="text-xs font-bold px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-all animate-none"
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
                  <Link
                    to="/login"
                    className="text-xs font-bold px-5 py-2 text-[#0B192C] dark:text-white border border-gray-200 dark:border-slate-700 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="text-xs font-bold px-5 py-2 bg-primary text-white rounded-full hover:bg-opacity-90 shadow-md shadow-primary/10 transition-all"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu & Action Button */}
            <div className="flex lg:hidden items-center gap-3">
              {user && (
                <div className="relative">
                  <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 relative text-gray-700 dark:text-gray-300">
                    <Bell size={18} />
                    {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger rounded-full" />}
                  </button>
                </div>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-[64px] bg-white dark:bg-[#070F1B] border-t border-border z-40 p-6 flex flex-col justify-between animate-in fade-in slide-in-from-top-4 duration-200 overflow-y-auto">
          <nav className="flex flex-col gap-2">
            <Link to="/search" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold py-3 border-b border-gray-50 dark:border-slate-800 text-gray-700 dark:text-gray-200">
              Destinations
            </Link>
            <Link to="/search" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold py-3 border-b border-gray-50 dark:border-slate-800 text-gray-700 dark:text-gray-200">
              Stay
            </Link>
            <Link to="/faq" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold py-3 border-b border-gray-50 dark:border-slate-800 text-gray-700 dark:text-gray-200">
              Darshan & Seva
            </Link>
            <Link to="/faq" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold py-3 border-b border-gray-50 dark:border-slate-800 text-gray-700 dark:text-gray-200">
              Tirvona Local
            </Link>
            <Link to="/faq" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold py-3 border-b border-gray-50 dark:border-slate-800 text-gray-700 dark:text-gray-200">
              Marketplace
            </Link>
            <Link to="/faq" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold py-3 border-b border-gray-50 dark:border-slate-800 text-gray-700 dark:text-gray-200">
              Events
            </Link>
            <Link to="/faq" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold py-3 border-b border-gray-50 dark:border-slate-800 text-gray-700 dark:text-gray-200">
              Blog
            </Link>
            {user && (
              <Link
                to={user.role !== 'customer' ? '/owner/dashboard' : '/dashboard'}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-semibold py-3 border-b border-gray-50 dark:border-slate-800 text-primary"
              >
                Dashboard
              </Link>
            )}
          </nav>

          <div className="flex flex-col gap-3 mt-6">
            <div className="flex justify-between items-center py-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Globe size={13} /> Currency</span>
              <span className="font-bold text-gray-700 dark:text-gray-200">₹ INR</span>
            </div>
            
            <button
              onClick={toggleDarkMode}
              className="w-full py-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold text-xs text-center flex items-center justify-center gap-2 cursor-pointer text-gray-700 dark:text-gray-200"
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              <span>{darkMode ? 'Light' : 'Dark'} Mode</span>
            </button>

            {user ? (
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 bg-danger/10 text-danger border border-danger/20 rounded-xl font-bold text-xs text-center"
              >
                Logout Account
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold text-center text-xs text-gray-700 dark:text-gray-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 bg-primary text-white rounded-xl font-bold text-center text-xs"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[#0B192C] text-gray-400 pt-16 pb-10 px-6 sm:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-9 gap-8">

          {/* Brand Col — spans 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo} alt="Tirvona Logo" className="w-10 h-10 object-contain" />
              <div className="flex flex-col leading-none">
                <span className="text-lg font-black text-white">
                  tirvona<span className="text-[#D4AF37] text-[9px] align-super">™</span>
                </span>
                <span className="text-[8px] font-bold tracking-widest text-[#D4AF37] uppercase">
                  One Nation, One Spiritual Stay
                </span>
              </div>
            </Link>
            <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
              Eliminating manual paper logs to provide safe, verified, and digital booking accommodations for holy stays and spiritual retreats across the Indian subcontinent.
            </p>
            {/* Ministry Badge */}
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#D4AF37"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              <span className="text-[9px] font-bold text-gray-300 leading-tight">Ministry of Tourism & IT Division<br/>Government of India</span>
            </div>
            {/* Social Icons */}
            <div className="flex items-center gap-4 text-gray-500 pt-1">
              <a href="#" className="hover:text-[#D4AF37] transition-colors" title="Facebook">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M9 8H7v3h2v9h3v-9h3.6l.4-3H12V6c0-.9.1-1.2 1-1.2h2V2h-3c-3.1 0-4 1.4-4 4.1V8z"/></svg>
              </a>
              <a href="#" className="hover:text-[#D4AF37] transition-colors" title="Instagram">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
              <a href="#" className="hover:text-[#D4AF37] transition-colors" title="Youtube">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
              <a href="#" className="hover:text-[#D4AF37] transition-colors" title="Twitter">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
              </a>
              <a href="#" className="hover:text-[#D4AF37] transition-colors" title="Linkedin">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>

          {/* Company Col */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-5">Company</h4>
            <ul className="text-xs space-y-3">
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Partner With Us</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Press & Media</a></li>
            </ul>
          </div>

          {/* Support Col */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-5">Support</h4>
            <ul className="text-xs space-y-3">
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Contact Us</a></li>
              <li><Link to="/faq" className="hover:text-[#D4AF37] transition-colors">FAQs</Link></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Cancellation Policy</a></li>
            </ul>
          </div>

          {/* Popular Retreats Col — NEW from reference */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#D4AF37] mb-5">Popular Retreats</h4>
            <ul className="text-xs space-y-3">
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Rishikesh Spiritual Valley</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Varanasi Dharamshalas</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Haridwar Ghat Stays</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Vrindavan Pilgrim Hostels</a></li>
            </ul>
          </div>

          {/* Information Col — NEW from reference */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#D4AF37] mb-5">Information</h4>
            <ul className="text-xs space-y-3">
              <li><Link to="/faq" className="hover:text-[#D4AF37] transition-colors">FAQs</Link></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Government Guidelines</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Owner Registration Guide</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Terms of Stay & Policies</a></li>
            </ul>
          </div>

          {/* Legal Col */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-5">Legal</h4>
            <ul className="text-xs space-y-3">
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Terms of Use</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Refund Policy</a></li>
              <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Cookie Policy</a></li>
            </ul>
          </div>

          {/* Download App + National Helpline — spans 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Download App */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-4">Download App</h4>
              <div className="flex flex-col gap-2.5">
                <a href="#" className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/15 transition-colors cursor-pointer">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0"><path d="M3.18 23.76c.38.22.82.24 1.22.06L16.6 12 12.34 7.74 3.18 23.76zm16.46-13.1L17.1 9.3 12.34 12l4.76 2.7 2.54-1.38a1.4 1.4 0 000-2.66zM2.32 1.16a1.4 1.4 0 00-.32.9v19.88c0 .33.1.65.32.9l.1.09L12.34 12.1v-.2L2.42 1.07l-.1.09zm9.83 10.72l-9.6 9.6 11.38-6.55-1.78-3.05z"/></svg>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-gray-400 leading-none">Get it on</span>
                    <span className="text-[11px] font-bold text-white leading-tight">Google Play</span>
                  </div>
                </a>
                <a href="#" className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/15 transition-colors cursor-pointer">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-gray-400 leading-none">Download on the</span>
                    <span className="text-[11px] font-bold text-white leading-tight">App Store</span>
                  </div>
                </a>
              </div>
            </div>

            {/* National Helpline — NEW from reference */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#D4AF37] mb-4">Contact Us</h4>
              <ul className="text-xs space-y-2.5 text-gray-400">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#D4AF37] mt-px">📞</span>
                  <span><span className="font-bold text-white">+91 78360 55511</span><br/><span className="text-[10px]">NKTech Technology Support</span></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#D4AF37] mt-px">✉</span>
                  <a href="mailto:info@nktech.in" className="hover:text-[#D4AF37] transition-colors break-all">info@nktech.in</a>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#D4AF37] mt-px shrink-0">📍</span>
                  <span className="leading-relaxed">3rd Floor, ITHUM TOWER, 307B,<br/>A A-40, Sector 62, Noida,<br/>Uttar Pradesh 201301</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#D4AF37] mt-px">🏥</span>
                  <span>Emergency Ashram Medical Desk Available <span className="font-bold text-white">24/7</span></span>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Bottom Banner */}
        <div className="max-w-7xl mx-auto mt-14 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-gray-500">
          <div className="text-center sm:text-left leading-relaxed">
            © {new Date().getFullYear()} NKTech Technology. All Rights Reserved.<br/>
            Designed in compliance with Digital India guidelines.
          </div>
          <div className="flex items-center gap-2 font-medium text-gray-500">
            <span>Made with ❤️ in India</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default PublicLayout;

