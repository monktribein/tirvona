import React from 'react';
import { MapPin, ShieldCheck, Phone, User, Calendar, CheckCircle2 } from 'lucide-react';
import { formatDate } from '../utils/formatDate';

export default function ApprovedAshramCard({ ashram }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-sm transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4 mb-4">
          <div>
            <h3 className="text-lg font-extrabold text-[#0F172A] leading-snug">{ashram.name}</h3>
            <p className="text-xs font-bold text-[#64748B] flex items-center gap-1.5 mt-1">
              <MapPin size={13} className="text-[#0A4DA6] shrink-0" />
              <span>{ashram.address ? `${ashram.address}, ` : ''}{ashram.city}, {ashram.state}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20">
              <ShieldCheck size={13} />
              Tirvona Verified Entity
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
          <div className="flex items-center gap-2 text-[#64748B]">
            <User size={13} className="text-[#0A4DA6] shrink-0" />
            <span>Contact: <strong className="text-[#0F172A] font-bold">{ashram.trusteeName || 'N/A'}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-[#64748B]">
            <Phone size={13} className="text-[#0A4DA6] shrink-0" />
            <span>Phone: <strong className="text-[#0F172A] font-bold">{ashram.contactNumber || 'N/A'}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-[#64748B]">
            <Calendar size={13} className="text-[#0A4DA6] shrink-0" />
            <span>Approved: <strong className="text-[#0F172A] font-bold">{formatDate(ashram.approvedAt)}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-[#64748B]">
            <CheckCircle2 size={13} className="text-[#0A4DA6] shrink-0" />
            <span>Status: <strong className="text-[#0A4DA6] font-extrabold uppercase tracking-wider">{ashram.status}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
