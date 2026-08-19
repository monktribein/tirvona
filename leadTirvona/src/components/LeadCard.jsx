/**
 * LeadCard.jsx — Compact Horizontal Row Layout
 * Three sections: Name | Date | Action Icons (Call, WhatsApp, Edit, Delete)
 */
import React from 'react';
import {
  Phone, Trash2, Pencil, MapPin, MessageCircle, Calendar
} from 'lucide-react';
import { formatDate } from '../utils/formatDate';

export default function LeadCard({ lead, onApprove, onDelete, onEdit, onBookAppointment }) {
  const phone = lead.contact?.phone || '';
  // Clean phone number for tel: and wa.me links
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const waPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 sm:px-4 sm:py-3.5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">

      {/* Section 1 — Name, Location & Status */}
      <div className="flex-1 min-w-0 w-full sm:w-auto">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <h3
            className="text-sm font-extrabold text-[#0F172A] truncate max-w-full sm:max-w-xs"
            title={lead.name}
          >
            {lead.name}
          </h3>
          <span className={`shrink-0 text-[10px] font-bold tracking-wide px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${
            lead.status === 'approved'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/25'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${lead.status === 'approved' ? 'bg-emerald-500' : 'bg-[#0A4DA6]'}`} />
            <span>{lead.status === 'approved' ? 'Approved' : 'Pending Review'}</span>
          </span>

          {lead.fieldVerified ? (
            <span className="shrink-0 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
              <span>✓ Field Verified ({lead.fieldVerifiedByName || lead.assignedAgentName || 'Agent'})</span>
            </span>
          ) : lead.assignedAgentName ? (
            <span className="shrink-0 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
              <span>Assigned: {lead.assignedAgentName}</span>
            </span>
          ) : null}
        </div>
        {(lead.location?.city || lead.location?.state) && (
          <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5 truncate">
            <MapPin size={11} className="text-[#0A4DA6] shrink-0" />
            <span className="truncate">
              {lead.location.city}{lead.location.state ? `, ${lead.location.state}` : ''}
            </span>
          </p>
        )}
      </div>

      {/* Section 2 & 3 — Date & Action Icons */}
      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t border-slate-100 sm:border-0">
        {lead.createdAt && (
          <span className="text-[10px] sm:text-[11px] font-semibold text-[#64748B] whitespace-nowrap block sm:hidden">
            {formatDate(lead.createdAt)}
          </span>
        )}

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
