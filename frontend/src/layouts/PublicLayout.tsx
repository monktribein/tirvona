import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  Compass, 
  HelpCircle, 
  LogOut, 
  User as UserIcon, 
  Menu, 
  X, 
  Bell, 
  Sun, 
  Moon, 
  ShieldCheck 
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
      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-card/85 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex justify-between items-center">
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-secondary to-primary flex items-center justify-center text-white font-bold shadow-md shadow-primary/20 transform group-hover:scale-105 transition-transform duration-200">
              T
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-secondary dark:text-white flex items-center gap-1">
                Tirthiva <ShieldCheck size={16} className="text-accent" />
              </span>
              <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">
                One Nation, One Spiritual Stay
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-semibold hover:text-primary transition-colors flex items-center gap-1.5 py-2">
              <Compass size={16} /> Explore
            </Link>
            <Link to="/faq" className="text-sm font-semibold hover:text-primary transition-colors flex items-center gap-1.5 py-2">
              <HelpCircle size={16} /> FAQ
            </Link>

            {/* Dark Mode Toggle */}
            <button 
              onClick={toggleDarkMode} 
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 hover:text-[#ff9933] transition-all cursor-pointer"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notifications Indicator */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
                >
                  <Bell size={18} className="text-secondary dark:text-gray-300" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-80 bg-card border border-border rounded-xl shadow-xl p-4 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-sm">Notifications</h4>
                      <button onClick={markAllAsRead} className="text-xs text-primary font-semibold hover:underline cursor-pointer">
                        Mark all read
                      </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">No new notifications</p>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="p-2.5 rounded-lg bg-background border border-border text-xs">
                            <div className="font-semibold text-secondary dark:text-accent">{n.title}</div>
                            <div className="text-gray-500 mt-0.5">{n.message}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Profile Action buttons */}
            {user ? (
              <div className="flex items-center gap-3 border-l border-border pl-4">
                {/* Redirect Owner, Officer, or Admin to Dashboard directly */}
                {user.role !== 'customer' ? (
                  <Link
                    to={user.role === 'district_officer' || user.role === 'govt_admin' || user.role === 'super_admin' ? '/admin/dashboard' : '/owner/dashboard'}
                    className="text-xs font-semibold px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-all"
                  >
                    Control Panel
                  </Link>
                ) : (
                  <Link
                    to="/dashboard"
                    className="text-xs font-semibold px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-all"
                  >
                    My Trips
                  </Link>
                )}
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{user.name}</span>
                  <span className="text-[10px] text-gray-400 capitalize">{user.role.replace('_', ' ')}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 transition-all cursor-pointer"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 border-l border-border pl-4">
                <Link
                  to="/login"
                  className="text-sm font-semibold px-4 py-2 text-secondary dark:text-white hover:text-primary transition-all"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold px-4 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-md shadow-primary/15 hover:opacity-95 transition-all"
                >
                  Register
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-4">
            {user && (
              <div className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 relative">
                  <Bell size={18} />
                  {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger rounded-full" />}
                </button>
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[64px] sm:top-[80px] bg-card border-t border-border z-40 p-6 flex flex-col justify-between animate-in fade-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col gap-4">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold py-3 border-b border-border flex items-center gap-2"
            >
              <Compass size={18} /> Explore Stays
            </Link>
            <Link
              to="/faq"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold py-3 border-b border-border flex items-center gap-2"
            >
              <HelpCircle size={18} /> Help & FAQs
            </Link>
            {user && (
              <Link
                to={user.role !== 'customer' ? '/owner/dashboard' : '/dashboard'}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold py-3 border-b border-border flex items-center gap-2 text-primary"
              >
                <UserIcon size={18} /> Go to Dashboard
              </Link>
            )}
          </nav>

          <div className="flex flex-col gap-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="w-full py-3 bg-gray-100 dark:bg-slate-800 rounded-lg font-bold text-center flex items-center justify-center gap-2 cursor-pointer"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span>{darkMode ? 'Light' : 'Dark'} Mode</span>
            </button>

            {user ? (
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-3 bg-danger/10 text-danger border border-danger/20 rounded-lg font-bold text-center"
              >
                Logout Account
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 bg-gray-100 dark:bg-slate-800 rounded-lg font-bold text-center"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 bg-primary text-white rounded-lg font-bold text-center"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-secondary text-white border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              Tirthiva <ShieldCheck className="text-accent" size={18} />
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Eliminating manual paper logs to provide safe, verified, and digital booking accommodations for holy stays and spiritual retreats across the Indian subcontinent.
            </p>
            <div className="text-[10px] text-gray-400">
              Ministry of Tourism & IT Division, Government of India
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4 text-accent">Popular Retreats</h4>
            <ul className="text-xs space-y-2 text-gray-300">
              <li>Rishikesh Spiritual Valley</li>
              <li>Varanasi Dharamshalas</li>
              <li>Haridwar Ghat Stays</li>
              <li>Tirumala Pilgrim Hostels</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4 text-accent">Information</h4>
            <ul className="text-xs space-y-2 text-gray-300">
              <li><Link to="/faq" className="hover:underline">FAQs</Link></li>
              <li>Government Guidelines</li>
              <li>Owner Registration Guide</li>
              <li>Terms of Stay & Policies</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4 text-accent">National Helpline</h4>
            <div className="text-xs space-y-2 text-gray-300">
              <p>Toll Free: 1800-111-365 (Pilgrim Safety)</p>
              <p>Email: helpdesk@ashraybharat.gov.in</p>
              <p>Emergency Ashram Medical Desk Available 24/7</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/10 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} National Informatics Centre (NIC) India. All Rights Reserved. Designed in compliance with Digital India guidelines.
        </div>
      </footer>
    </div>
  );
};
export default PublicLayout;
