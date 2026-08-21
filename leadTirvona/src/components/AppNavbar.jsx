import React, { useState, useEffect } from 'react';
import { PlusCircle, LayoutDashboard, Building2, Menu, X, UserCheck, MapPin, ArrowLeft } from 'lucide-react';
import LoginModal from './LoginModal';
import AttendanceModal from './AttendanceModal';
import { useLanguage } from '../context/LanguageContext';

export default function AppNavbar({
  activePage,
  setActivePage,
  leadCount,
  approvedCount,
  agent,
  attendanceState,
  onAttendanceUpdated,
  onLogin,
  onLogout,
  onBackToSupervisorConsole = null
}) {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const user = agent;

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

  const handleLoginSuccess = async (phone, password, remember) => {
    const signedIn = await onLogin(phone, password, remember);
    setIsAttendanceModalOpen(true);
    return signedIn;
  };

  const handleLogout = () => {
    onLogout();
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 pt-3 pb-2 transition-all duration-300 ease-in-out transform ${
          showHeader || mobileMenuOpen
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-full px-5 sm:px-8 py-2.5 flex items-center justify-between gap-6 w-full shadow-[0_2px_20px_-4px_rgba(0,0,0,0.06)]">
            
            <div className="flex items-center shrink-0">
              <a href="https://tirvona.com" target="_blank" rel="noopener noreferrer" className="flex items-center">
                <img
                  src="/logo.png"
                  alt="Tirvona"
                  className="h-8 sm:h-9 w-auto object-contain cursor-pointer hover:opacity-90 transition-opacity"
                />
              </a>
            </div>

            <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
              <button
                onClick={() => handleNavClick('create')}
                className={`text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activePage === 'create'
                    ? 'text-[#0A4DA6] font-extrabold'
                    : 'text-[#0B192C] hover:text-[#0A4DA6]'
                }`}
              >
                <PlusCircle size={15} className={activePage === 'create' ? 'text-[#0A4DA6]' : 'text-gray-400'} />
                <span>{t('Create Lead')}</span>
              </button>

              <button
                onClick={() => handleNavClick('dashboard')}
                className={`text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
                  activePage === 'dashboard'
                    ? 'text-[#0A4DA6] font-extrabold'
                    : 'text-[#0B192C] hover:text-[#0A4DA6]'
                }`}
              >
                <LayoutDashboard size={15} className={activePage === 'dashboard' ? 'text-[#0A4DA6]' : 'text-gray-400'} />
                <span>{t('Leads Dashboard')}</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full transition-colors ${
                  activePage === 'dashboard'
                    ? 'bg-[#0A4DA6] text-white'
                    : 'bg-blue-50 text-[#0A4DA6] border border-blue-100'
                }`}>
                  {leadCount}
                </span>
              </button>

              <button
                onClick={() => handleNavClick('approved')}
                className={`text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
                  activePage === 'approved'
                    ? 'text-[#0A4DA6] font-extrabold'
                    : 'text-[#0B192C] hover:text-[#0A4DA6]'
                }`}
              >
                <Building2 size={15} className={activePage === 'approved' ? 'text-[#0A4DA6]' : 'text-gray-400'} />
                <span>{t('Approved Ashrams')}</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full transition-colors ${
                  activePage === 'approved'
                    ? 'bg-[#0A4DA6] text-white'
                    : 'bg-blue-50 text-[#0A4DA6] border border-blue-100'
                }`}>
                  {approvedCount}
                </span>
              </button>
            </nav>

            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {user ? (
                <>
                  {onBackToSupervisorConsole && (
                    <button
                      onClick={onBackToSupervisorConsole}
                      className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-extrabold transition-all shadow-xs cursor-pointer"
                      title={t('Supervisor Console')}
                    >
                      <LayoutDashboard size={14} />
                      <span>{t('Supervisor Console')}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setIsAttendanceModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-[#0B192C] hover:text-[#0A4DA6] hover:bg-slate-50 border border-gray-200 rounded-full transition-colors cursor-pointer shadow-2xs"
                    title={t('Attendance')}
                  >
                    <MapPin size={13} className="text-[#0A4DA6]" />
                    <span>{t('Attendance')}</span>
                    {attendanceState?.checkedIn && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>

                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-[#0A4DA6] bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 rounded-full transition-colors cursor-pointer"
                    title={t('Sign Out')}
                  >
                    <div className="w-5 h-5 rounded-full bg-[#0A4DA6] text-white flex items-center justify-center text-[10px] font-black shrink-0">
                      {user.name?.slice(0, 1).toUpperCase() || 'U'}
                    </div>
                    <span className="hidden sm:inline">{user.name?.split(' ')[0] || 'User'}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-5 py-2 text-xs font-extrabold bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full transition-all shadow-xs cursor-pointer"
                >
                  {t('Sign In')}
                </button>
              )}

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-slate-700 hover:text-[#0A4DA6] rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden mt-2 bg-white border border-gray-200 rounded-2xl p-4 shadow-xl flex flex-col gap-2 transition-all">
              {onBackToSupervisorConsole && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onBackToSupervisorConsole();
                  }}
                  className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-[#0A4DA6] text-white font-extrabold text-xs shadow-xs"
                >
                  <LayoutDashboard size={16} />
                  <span>Supervisor Console</span>
                </button>
              )}

              <button
                onClick={() => handleNavClick('create')}
                className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition-colors ${
                  activePage === 'create' ? 'bg-[#0A4DA6] text-white' : 'text-[#0B192C] hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <PlusCircle size={16} />
                  <span>Create Lead</span>
                </span>
              </button>

              <button
                onClick={() => handleNavClick('dashboard')}
                className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition-colors ${
                  activePage === 'dashboard' ? 'bg-[#0A4DA6] text-white' : 'text-[#0B192C] hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard size={16} />
                  <span>Leads Dashboard</span>
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activePage === 'dashboard' ? 'bg-white/20 text-white' : 'bg-blue-50 text-[#0A4DA6]'
                }`}>
                  {leadCount}
                </span>
              </button>

              <button
                onClick={() => handleNavClick('approved')}
                className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition-colors ${
                  activePage === 'approved' ? 'bg-[#0A4DA6] text-white' : 'text-[#0B192C] hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Building2 size={16} />
                  <span>Approved Ashrams</span>
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activePage === 'approved' ? 'bg-white/20 text-white' : 'bg-blue-50 text-[#0A4DA6]'
                }`}>
                  {approvedCount}
                </span>
              </button>

              <div className="pt-2 border-t border-gray-100 mt-1 space-y-2">
                {user ? (
                  <>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setIsAttendanceModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 text-xs font-bold text-[#0B192C] hover:bg-slate-50"
                    >
                      <MapPin size={14} className="text-[#0A4DA6]" />
                      <span>Attendance Check-In</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 p-2 rounded-xl border border-red-200 text-xs font-bold text-red-600 bg-red-50"
                    >
                      <span>Sign Out ({user.name})</span>
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
                    Sign In
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </header>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <AttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        user={user}
        onAttendanceUpdated={onAttendanceUpdated}
      />
    </>
  );
}
