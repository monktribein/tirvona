import React from 'react';
import {
  Phone, Trash2, Pencil, MapPin, MessageCircle, Calendar, FileCheck
} from 'lucide-react';
import { formatDate } from '../utils/formatDate';

export default function LeadCard({ lead, onApprove, onDelete, onEdit, onBookAppointment, onOpenDocuments }) {
  const phone = lead.contact?.phone || '';
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const waPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;
  // Document checklist calculation
  const documentChecklist = lead.documentChecklist;
  const savedItems = documentChecklist?.items || {};
  const receivedCount = Object.values(savedItems).filter((it) => Boolean(it.received || it.imageUrl)).length;
  const otherDocsCount = Array.isArray(documentChecklist?.otherDocuments) ? documentChecklist.otherDocuments.length : 0;
  const totalReceived = receivedCount + otherDocsCount;
  const totalRequired = documentChecklist?.totalRequired || 7;
  const hasDocs = totalReceived > 0;
  const isComplete = receivedCount >= totalRequired && totalRequired > 0;
  const isVerified = lead.docVerificationStatus === 'verified' || lead.documentVerified;
  const isReupload = lead.docVerificationStatus === 'needs_reupload';

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 sm:px-4 sm:py-3.5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
      {/* Section 1 — Name, Location & Status */}
      <div className="flex-1 min-w-0 w-full sm:w-auto">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <h3
            className="text-sm font-extrabold text-[#0F172A] truncate max-w-full sm:max-w-xs"
            title={lead.name}
          >
            {lead.name}
          </h3>
          
          {/* Status Badge */}
          <span
            className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full border shrink-0 ${
              lead.status === 'approved'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : lead.status === 'rejected'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-blue-50 text-[#0A4DA6] border-blue-200'
            }`}
          >
            {lead.status === 'approved' ? 'Approved' : lead.status === 'rejected' ? 'Rejected' : 'Pending'}
          </span>

          {/* Document Verification & Completion Badge */}
          {hasDocs && (
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 hidden md:inline-flex items-center gap-1 ${
              isVerified
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isReupload
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : isComplete
                ? 'bg-blue-50 text-[#0A4DA6] border-blue-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <FileCheck size={10} />
              <span>
                {isVerified
                  ? 'Docs Verified'
                  : isReupload
                  ? 'Re-upload Req.'
                  : isComplete
                  ? `Docs Complete (${receivedCount}/${totalRequired})`
                  : `Docs Incomplete (${receivedCount}/${totalRequired})`}
              </span>
            </span>
          )}
        </div>

        {/* Location & Address */}
        {lead.location?.city && (
          <p className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5 truncate">
            <MapPin size={11} className="text-[#0A4DA6] shrink-0" />
            <span className="truncate">
              {lead.location.city}{lead.location.state ? `, ${lead.location.state}` : ''}
            </span>
          </p>
        )}
      </div>
      <div className="shrink-0 text-right hidden sm:block">
      {/* Section 2 & 3 — Date & Action Icons */}
      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t border-slate-100 sm:border-0">
        {lead.createdAt && (
          <span className="text-[10px] sm:text-[11px] font-semibold text-[#64748B] whitespace-nowrap block sm:hidden">
            {formatDate(lead.createdAt)}
          </span>
        )}

      <div className="flex items-center gap-1 shrink-0">
        {cleanPhone && (
          <a
            href={`tel:${cleanPhone}`}
            className="p-2 rounded-full text-[#0A4DA6] hover:bg-[#0A4DA6]/10 transition-colors"
            title={`Call ${phone}`}
          >
            <Phone size={16} />
          </a>
        )}

        {cleanPhone && (
          <a
            href={`https://wa.me/${waPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors"
            title={`WhatsApp ${phone}`}
          >
            <MessageCircle size={16} />
          </a>
        )}

        {onEdit && (
          <button
            onClick={() => onEdit(lead)}
            className="p-2 rounded-full text-slate-400 hover:text-[#0A4DA6] hover:bg-[#0A4DA6]/10 transition-colors cursor-pointer"
            title="Edit lead"
          >
            <Pencil size={16} />
          </button>
        )}

        <button
          onClick={() => {
            if (confirm(`Delete lead "${lead.name}"?`)) onDelete(lead.id);
          }}
          className="p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          title="Delete lead"
        >
          <Trash2 size={16} />
        </button>
        {lead.createdAt && (
          <span className="text-[11px] font-semibold text-[#64748B] whitespace-nowrap hidden sm:block mr-2">
            {formatDate(lead.createdAt)}
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
          {/* Book Appointment Button (Hidden for Field Agent) */}
          {onBookAppointment && (
            <button
              onClick={() => onBookAppointment(lead)}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                lead.meeting?.requested && lead.meeting?.time
                  ? 'bg-[#0A4DA6] text-white border border-[#0A4DA6] hover:bg-[#083D85]'
                  : 'bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 hover:bg-[#0A4DA6] hover:text-white'
              }`}
              title={lead.meeting?.requested && lead.meeting?.time ? `Appointment: ${lead.meeting.time} (${lead.meeting.mode || 'In-person'})` : 'Book an Appointment'}
            >
              <Calendar size={12} className={lead.meeting?.requested && lead.meeting?.time ? 'text-white' : 'text-[#0A4DA6]'} />
              <span className="whitespace-nowrap">
                {lead.meeting?.requested && lead.meeting?.time ? 'Appointment Set' : 'Book Appointment'}
              </span>
            </button>
          )}

          {/* Document Checklist Collection Button */}
          {onOpenDocuments && (
            <button
              onClick={() => onOpenDocuments(lead)}
              className={`p-1.5 sm:p-2 rounded-full border transition-all cursor-pointer ${
                isVerified
                  ? 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 shadow-2xs'
                  : isReupload
                  ? 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100 shadow-2xs'
                  : isComplete
                  ? 'text-[#0A4DA6] bg-blue-50 border-blue-200 hover:bg-blue-100 shadow-2xs'
                  : hasDocs
                  ? 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100 shadow-2xs'
                  : 'text-slate-400 bg-slate-50 border-slate-200 hover:text-[#0A4DA6] hover:bg-blue-50 hover:border-blue-200'
              }`}
              title={
                isVerified
                  ? `Documents Verified (${receivedCount}/${totalRequired})`
                  : isReupload
                  ? `Re-upload Required: Action Needed`
                  : isComplete
                  ? `Checklist Complete: All ${receivedCount}/${totalRequired} Documents Collected`
                  : hasDocs
                  ? `Checklist Incomplete: ${receivedCount}/${totalRequired} Documents Collected`
                  : 'Collect Onboarding Documents (0 Submitted)'
              }
            >
              <FileCheck size={15} />
            </button>
          )}

          {/* Phone Call */}
          {cleanPhone && (
            <a
              href={`tel:${cleanPhone}`}
              className="p-1.5 sm:p-2 rounded-full text-[#0A4DA6] hover:bg-[#0A4DA6]/10 transition-colors"
              title={`Call ${phone}`}
            >
              <Phone size={15} />
            </a>
          )}

          {/* WhatsApp */}
          {cleanPhone && (
            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 sm:p-2 rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors"
              title={`WhatsApp ${phone}`}
            >
              <MessageCircle size={15} />
            </a>
          )}

          {/* Edit */}
          {onEdit && (
            <button
              onClick={() => onEdit(lead)}
              className="p-1.5 sm:p-2 rounded-full text-slate-400 hover:text-[#0A4DA6] hover:bg-[#0A4DA6]/10 transition-colors cursor-pointer"
              title="Edit lead"
            >
              <Pencil size={15} />
            </button>
          )}

          {/* Delete — only shown when onDelete is provided (e.g. Supervisor) */}
          {onDelete && (
            <button
              onClick={() => {
                if (confirm(`Delete lead "${lead.name}"?`)) onDelete(lead.id);
              }}
              className="p-1.5 sm:p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="Delete lead"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
