import React, { useState } from 'react';
import { X, MapPin, Clock, CheckCircle2, LogOut, Navigation, AlertCircle, Calendar, ShieldCheck } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { buildGoogleMapsUrl } from '../utils/formatDate';
import { useLanguage } from '../context/LanguageContext';

export default function AttendanceModal({ isOpen, onClose, user, onAttendanceUpdated }) {
  const { t } = useLanguage();
  const { isCapturing, gpsError, captureCurrentLocation } = useGeolocation();
  const [attendance, setAttendance] = useState({
    checkedIn: false,
    checkInTime: null,
    checkInCoords: null,
    checkedOut: false,
    checkOutTime: null,
    checkOutCoords: null,
  });
  // Lock background body scroll and pause Lenis smooth scroll while modal is open
  React.useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      if (window.lenisInstance) {
        window.lenisInstance.stop();
      }
      return () => {
        document.body.style.overflow = originalOverflow || '';
        if (window.lenisInstance) {
          window.lenisInstance.start();
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isSupervisor = user?.role === 'supervisor' || user?.role === 'field_supervisor';
  const isLeadExecutive = user?.role === 'lead_executive';
  const roleTitle = isSupervisor
    ? t('Supervisor Attendance')
    : isLeadExecutive
    ? t('Lead Executive Attendance')
    : t('Field Executive Attendance');
  const roleSubtitle = isSupervisor
    ? `${user?.district ? `${user.district} ` : ''}District Geotag & Location Console`
    : isLeadExecutive
    ? `${user?.district ? `${user.district} ` : ''}Executive Geotag & Location Console`
    : 'Geotag Attendance & Location Check-In Console';
  const userInitials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : isSupervisor
    ? 'SP'
    : isLeadExecutive
    ? 'LE'
    : 'FE';
  const badgeLabel = isSupervisor
    ? t('Supervisor')
    : isLeadExecutive
    ? t('Lead Executive')
    : t('Active Shift');

  const handleCheckIn = () => {
    setStatusMsg('Capturing Geotag location...');
    captureCurrentLocation((coords) => {
      const now = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
      const record = {
        ...attendance,
        checkedIn: true,
        checkInTime: now,
        checkInCoords: coords,
      };
      setAttendance(record);
      setStatusMsg('✅ Check-In Attendance Marked with Geotag Location!');
      if (onAttendanceUpdated) onAttendanceUpdated(record);
    });
  };

  const handleCheckOut = () => {
    setStatusMsg('Capturing Geotag location for Check-Out...');
    captureCurrentLocation((coords) => {
      const now = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
      const record = {
        ...attendance,
        checkedOut: true,
        checkOutTime: now,
        checkOutCoords: coords,
      };
      setAttendance(record);
      setStatusMsg('✅ Check-Out Marked with Geotag Location!');
      if (onAttendanceUpdated) onAttendanceUpdated(record);
    });
  };

  const checkInMapsUrl = attendance.checkInCoords
    ? buildGoogleMapsUrl(attendance.checkInCoords.lat, attendance.checkInCoords.lng)
    : null;
  const checkOutMapsUrl = attendance.checkOutCoords
    ? buildGoogleMapsUrl(attendance.checkOutCoords.lat, attendance.checkOutCoords.lng)
    : null;

  return (
    <div 
      data-lenis-prevent="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-xs animate-fadeIn overscroll-contain"
    >
      
      <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-xl relative animate-scaleUp text-left space-y-5">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#64748B] hover:text-[#0F172A] rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close Modal"
        >
          <X size={18} />
        </button>

        <div className="text-center space-y-1.5">
          <div className="flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Tirvona Logo" className="h-10 w-auto object-contain" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
            {roleTitle}
          </h2>
          <p className="text-xs text-[#64748B] font-medium">
            {roleSubtitle}
          </p>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] font-extrabold flex items-center justify-center text-sm">
              {userInitials}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">{user?.name || (isSupervisor ? 'Field Supervisor' : 'Field Lead Agent')}</h3>
              <p className="text-xs font-medium text-[#64748B]">Phone: {user?.phone || '+91 9876543210'}</p>
            </div>
          </div>
          <span className={`text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border ${
            isSupervisor
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/20'
          }`}>
            {badgeLabel}
          </span>
        </div>

        {gpsError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {statusMsg && !gpsError && (
          <div className="p-3 bg-[#0A4DA6]/5 border border-[#0A4DA6]/20 rounded-xl text-xs font-bold text-[#0A4DA6] flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0 text-[#0A4DA6]" />
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3.5 pt-1">
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={isCapturing || attendance.checkedIn}
            className={`min-h-[52px] rounded-2xl font-extrabold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-xs ${
              attendance.checkedIn
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                : 'bg-[#0A4DA6] hover:bg-[#083D85] text-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <MapPin size={16} />
              <span>{attendance.checkedIn ? t('Checked In') : t('Check In')}</span>
            </div>
            {isCapturing && !attendance.checkedIn && (
              <span className="text-[10px] opacity-80 font-normal">Capturing Geotag...</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleCheckOut}
            disabled={isCapturing || !attendance.checkedIn || attendance.checkedOut}
            className={`min-h-[52px] rounded-2xl font-extrabold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-xs ${
              attendance.checkedOut
                ? 'bg-slate-100 text-slate-600 border border-slate-200 cursor-default'
                : !attendance.checkedIn
                ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                : 'bg-[#0B192C] hover:bg-slate-900 text-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <LogOut size={16} />
              <span>{attendance.checkedOut ? t('Checked Out') : t('Check Out')}</span>
            </div>
            {isCapturing && attendance.checkedIn && !attendance.checkedOut && (
              <span className="text-[10px] opacity-80 font-normal">Capturing Geotag...</span>
            )}
          </button>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-[#E2E8F0]">
          <h4 className="text-xs font-bold text-[#64748B] tracking-wider uppercase">
            {t('Attendance Log Record')}
          </h4>

          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1 text-xs">
            <div className="flex items-center justify-between font-extrabold text-[#0F172A]">
              <span className="flex items-center gap-1 text-[#0A4DA6]">
                <Clock size={13} /> {t('Check-In Status')}
              </span>
              <span>{attendance.checkedIn ? 'COMPLETED' : 'PENDING'}</span>
            </div>
            {attendance.checkedIn ? (
              <div className="text-[11px] text-[#64748B] space-y-0.5 pt-1 border-t border-[#E2E8F0]">
                <p><strong className="text-[#0F172A]">Time:</strong> {attendance.checkInTime}</p>
                <p><strong className="text-[#0F172A]">Geotag GPS:</strong> Lat {attendance.checkInCoords?.lat}, Lng {attendance.checkInCoords?.lng}</p>
                {checkInMapsUrl && (
                  <a href={checkInMapsUrl} target="_blank" rel="noopener noreferrer" className="text-[#0A4DA6] font-bold hover:underline inline-block mt-0.5">
                    📍 Open Location in Google Maps &rarr;
                  </a>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[#94A3B8]">Click Check In button to mark shift start location &amp; time</p>
            )}
          </div>

          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1 text-xs">
            <div className="flex items-center justify-between font-extrabold text-[#0F172A]">
              <span className="flex items-center gap-1 text-[#0B192C]">
                <Clock size={13} /> {t('Check-Out Status')}
              </span>
              <span>{attendance.checkedOut ? 'COMPLETED' : 'PENDING'}</span>
            </div>
            {attendance.checkedOut ? (
              <div className="text-[11px] text-[#64748B] space-y-0.5 pt-1 border-t border-[#E2E8F0]">
                <p><strong className="text-[#0F172A]">Time:</strong> {attendance.checkOutTime}</p>
                <p><strong className="text-[#0F172A]">Geotag GPS:</strong> Lat {attendance.checkOutCoords?.lat}, Lng {attendance.checkOutCoords?.lng}</p>
                {checkOutMapsUrl && (
                  <a href={checkOutMapsUrl} target="_blank" rel="noopener noreferrer" className="text-[#0A4DA6] font-bold hover:underline inline-block mt-0.5">
                    📍 Open Location in Google Maps &rarr;
                  </a>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[#94A3B8]">Check Out available after Check In</p>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-[#0F172A] font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
          >
            {isSupervisor ? t('Continue to Dashboard') : t('Continue to Field Dashboard')}
          </button>
        </div>

      </div>
    </div>
  );
}
