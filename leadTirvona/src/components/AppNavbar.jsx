/**
 * AppNavbar.jsx — Tirvona Floating Navbar with Login & Attendance Popup Integration
 */
import React, { useState, useEffect } from 'react';
import { PlusCircle, LayoutDashboard, Building2, Menu, X, UserCheck, MapPin } from 'lucide-react';
import LoginModal from './LoginModal';
import AttendanceModal from './AttendanceModal';

export default function AppNavbar({
  activePage,
  setActivePage,
  leadCount,
  approvedCount,
  agent,
  onLogin,
  onLogout
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceState, setAttendanceState] = useState(null);
  // The session itself lives in App via useLeadAuth; the navbar only renders it.
  const user = agent;

  // Exact Tirvona scroll listener logic
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

  const handleNavClick = (page) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  // Authenticate, then immediately open the Attendance geotag popup. Errors
  // are thrown back to the modal, which is where they are shown.
  const handleLoginSuccess = async (phone, password) => {
    const signedIn = await onLogin(phone, password);
    setIsAttendanceModalOpen(true);
    return signedIn;
  };

  const handleLogout = () => {
    onLogout();
    setAttendanceState(null);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 pt-2 sm:pt-3 pb-2 sm:pb-3 pointer-events-none transition-all duration-300 ease-in-out transform ${
          showHeader || mobileMenuOpen
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pointer-events-auto">
          
          {/* Floating Rounded Navbar Container */}
          <div className="bg-white/95 backdrop-blur-md border border-[#E58C28]/40 rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between w-full shadow-sm hover:shadow-md transition-shadow relative">
            
            {/* Left Brand Logo Image */}
            <div className="flex items-center shrink-0">
              <a href="https://tirvona.com" target="_blank" rel="noopener noreferrer">
                <img
                  src="/logo.png"
                  alt="Tirvona Sacred Destinations"
                  className="h-8 sm:h-9 w-auto object-contain cursor-pointer hover:scale-105 transition-transform"
                />
              </a>
            </div>

            {/* Centered Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 sm:gap-2 absolute left-1/2 -translate-x-1/2">
              <button
                onClick={() => handleNavClick('create')}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full font-bold text-xs sm:text-[13px] tracking-tight transition-all cursor-pointer ${
                  activePage === 'create'
                    ? 'bg-[#0A4DA6] text-white shadow-xs'
                    : 'text-slate-700 hover:text-[#0A4DA6] hover:bg-slate-100/90'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <PlusCircle size={14} />
                  <span>Create Lead</span>
                </span>
              </button>

              <button
                onClick={() => handleNavClick('dashboard')}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full font-bold text-xs sm:text-[13px] tracking-tight transition-all cursor-pointer ${
                  activePage === 'dashboard'
                    ? 'bg-[#0A4DA6] text-white shadow-xs'
                    : 'text-slate-700 hover:text-[#0A4DA6] hover:bg-slate-100/90'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <LayoutDashboard size={14} />
                  <span>Leads Dashboard</span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    activePage === 'dashboard' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {leadCount}
                  </span>
                </span>
              </button>

              <button
                onClick={() => handleNavClick('approved')}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full font-bold text-xs sm:text-[13px] tracking-tight transition-all cursor-pointer ${
                  activePage === 'approved'
                    ? 'bg-[#0A4DA6] text-white shadow-xs'
                    : 'text-slate-700 hover:text-[#0A4DA6] hover:bg-slate-100/90'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Building2 size={14} />
                  <span>Approved Ashrams</span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    activePage === 'approved' ? 'bg-white/20 text-white' : 'bg-[#0A4DA6]/10 text-[#0A4DA6]'
                  }`}>
                    {approvedCount}
                  </span>
                </span>
              </button>
            </nav>

            {/* Right Side Login / Attendance Button */}
            <div className="flex items-center gap-2 shrink-0">
              {user ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAttendanceModalOpen(true)}
                    className="text-xs font-extrabold text-white bg-[#0A4DA6] hover:bg-[#083D85] transition-all px-3.5 py-1.5 rounded-full flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Open Attendance Check-In / Check-Out Modal"
                  >
                    <MapPin size={13} />
                    <span>Attendance</span>
                    {attendanceState?.checkedIn && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>

                  <button
                    onClick={handleLogout}
                    className="hidden sm:flex text-xs font-extrabold text-[#0A4DA6] bg-[#0A4DA6]/10 hover:bg-[#0A4DA6]/20 transition-all px-3.5 py-1.5 rounded-full border border-[#0A4DA6]/20 items-center gap-1.5 cursor-pointer"
                    title="Click to logout"
                  >
                    <UserCheck size={13} />
                    <span>{user.name?.split(' ')[0] || 'Agent'}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="text-xs font-extrabold text-[#0A4DA6] hover:text-white hover:bg-[#0A4DA6] transition-all px-4 py-1.5 rounded-full border border-[#0A4DA6] flex items-center justify-center cursor-pointer shadow-2xs"
                >
                  Login
                </button>
              )}

              {/* Mobile Hamburger Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-slate-700 hover:text-[#0A4DA6] rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

          </div>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-2 bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-lg flex flex-col gap-2 transition-all">
              <button
                onClick={() => handleNavClick('create')}
                className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-sm transition-colors ${
                  activePage === 'create' ? 'bg-[#0A4DA6] text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <PlusCircle size={16} />
                  <span>Create Lead Entry</span>
                </span>
              </button>

              <button
                onClick={() => handleNavClick('dashboard')}
                className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-sm transition-colors ${
                  activePage === 'dashboard' ? 'bg-[#0A4DA6] text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard size={16} />
                  <span>Leads Dashboard</span>
                </span>
                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                  activePage === 'dashboard' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800'
                }`}>
                  {leadCount}
                </span>
              </button>

              <button
                onClick={() => handleNavClick('approved')}
                className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-sm transition-colors ${
                  activePage === 'approved' ? 'bg-[#0A4DA6] text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Building2 size={16} />
                  <span>Approved Ashrams</span>
                </span>
                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                  activePage === 'approved' ? 'bg-white/20 text-white' : 'bg-[#0A4DA6]/10 text-[#0A4DA6]'
                }`}>
                  {approvedCount}
                </span>
              </button>

              <div className="pt-2 border-t border-[#E2E8F0] mt-1 space-y-2">
                {user ? (
                  <>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setIsAttendanceModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#0A4DA6] text-xs font-bold text-white shadow-xs"
                    >
                      <MapPin size={14} />
                      <span>Open Attendance Check-In</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 p-2 rounded-xl border border-red-200 text-xs font-bold text-red-600 bg-red-50"
                    >
                      <span>Logout Agent</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsLoginModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#0A4DA6] text-xs font-bold text-white shadow-xs"
                  >
                    Login
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </header>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Attendance Check-In / Check-Out Geotag Modal */}
      <AttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        user={user}
        onAttendanceUpdated={(record) => setAttendanceState(record)}
      />
    </>
  );
}
