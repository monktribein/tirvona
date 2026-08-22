import React, { useState, useEffect } from 'react';
import { X, Calendar, Phone, MapPin, User, Loader2, CheckCircle2, MessageCircle } from 'lucide-react';

export default function AppointmentModal({ isOpen, onClose, lead, onSaveAppointment }) {
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingMode, setMeetingMode] = useState('In-person');
  const [interest, setInterest] = useState('Interested');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setMeetingTime(lead.meeting?.time || '');
      setMeetingMode(lead.meeting?.mode || 'In-person');
      setInterest(lead.interest || 'Interested');
      setNotes(lead.notes || '');
    }
  }, [lead]);

  // Lock background body scroll and pause Lenis smooth scroll while modal is open
  useEffect(() => {
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

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!meetingTime) {
      alert('Please select an appointment date and time.');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveAppointment(lead.id || lead._id, {
        ...lead,
        name: lead.name,
        meeting: {
          requested: true,
          time: meetingTime,
          mode: meetingMode
        },
        interest,
        notes
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAppointment = async () => {
    if (!confirm('Remove this booked appointment?')) return;
    setIsSaving(true);
    try {
      await onSaveAppointment(lead.id || lead._id, {
        ...lead,
        name: lead.name,
        meeting: {
          requested: false,
          time: '',
          mode: ''
        },
        interest,
        notes
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]";
  const labelClass = "text-xs font-bold text-[#64748B] tracking-wider block mb-1.5";

  const interestOptions = [
    { id: 'Interested', label: 'Interested', desc: 'Wants to join Tirvona' },
    { id: 'Not Interested', label: 'Not Interested', desc: 'Declined current onboarding' },
    { id: 'Follow-up Required', label: 'Follow-up Required', desc: 'Needs proposal discussion' },
  ];

  return (
    <div 
      data-lenis-prevent="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain"
    >
      <div 
        data-lenis-prevent="true"
        className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 w-full max-w-xl shadow-xl relative animate-scaleUp text-left my-8 overscroll-contain"
      >
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#64748B] hover:text-[#0F172A] rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#E2E8F0]">
          <div className="w-11 h-11 rounded-2xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center shrink-0">
            <Calendar size={22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A]">
              Book Appointment &amp; Set Lead Status
            </h2>
            <p className="text-xs text-[#64748B] font-medium">
              Schedule visit or meeting and update owner interest
            </p>
          </div>
        </div>

        {/* Lead Details Overview Card */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-[#0F172A]">{lead.name}</span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${
              lead.status === 'approved'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/25'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${lead.status === 'approved' ? 'bg-emerald-500' : 'bg-[#0A4DA6]'}`} />
              <span>{lead.status === 'approved' ? 'Approved' : 'Pending Review'}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#64748B] pt-1">
            {lead.contact?.ownerName && (
              <div className="flex items-center gap-1.5 truncate">
                <User size={13} className="text-[#0A4DA6] shrink-0" />
                <span className="font-semibold text-[#0F172A]">Contact:</span>
                <span className="truncate">{lead.contact.ownerName}</span>
              </div>
            )}
            {lead.contact?.phone && (
              <div className="flex items-center gap-1.5 truncate">
                <Phone size={13} className="text-[#0A4DA6] shrink-0" />
                <span className="font-semibold text-[#0F172A]">Phone:</span>
                <span>{lead.contact.phone}</span>
              </div>
            )}
            {(lead.location?.city || lead.location?.state) && (
              <div className="flex items-center gap-1.5 truncate sm:col-span-2">
                <MapPin size={13} className="text-[#0A4DA6] shrink-0" />
                <span className="font-semibold text-[#0F172A]">Location:</span>
                <span className="truncate">
                  {lead.location.city}{lead.location.state ? `, ${lead.location.state}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Appointment Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          
          {/* SECTION 1: Owner Interest Level (3 Cards) */}
          <div>
            <label className={labelClass}>Owner Interest Level</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {interestOptions.map((item) => (
                <label
                  key={item.id}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-0.5 ${
                    interest === item.id
                      ? 'border-[#0A4DA6] bg-[#0A4DA6]/5 shadow-xs ring-1 ring-[#0A4DA6]/20'
                      : 'border-[#E2E8F0] bg-[#F8FAFC]/50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-[#0F172A]">{item.label}</span>
                    <input
                      type="radio"
                      name="modalInterest"
                      value={item.id}
                      checked={interest === item.id}
                      onChange={() => setInterest(item.id)}
                      className="accent-[#0A4DA6] w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <span className="text-[10px] text-[#64748B] font-medium leading-tight">{item.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* SECTION 2: Date & Time + Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Appointment Date &amp; Time <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="datetime-local"
                required
                className={inputClass}
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Meeting Mode</label>
              <select
                className={inputClass}
                value={meetingMode}
                onChange={(e) => setMeetingMode(e.target.value)}
              >
                <option value="In-person">In-person Ashram Visit</option>
                <option value="Call">Phone / WhatsApp Call</option>
                <option value="Video Call">Online Video Call</option>
              </select>
            </div>
          </div>

          {/* SECTION 3: Notes */}
          <div>
            <label className={labelClass}>Appointment / Discussion Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Discuss onboarding terms, inventory details, or verification schedule..."
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0]">
            {lead.meeting?.requested && lead.meeting?.time ? (
              <button
                type="button"
                onClick={handleClearAppointment}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-full border border-red-200 text-xs font-extrabold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                Cancel Appointment
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-full border border-gray-200 text-xs font-bold text-[#64748B] hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSaving && <Loader2 size={13} className="animate-spin" />}
                <span>{isSaving ? 'Saving...' : 'Book Appointment'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
