/**
 * LeadCard.jsx — Compact Horizontal Row Layout
 * Three sections: Name | Date | Action Icons (Call, WhatsApp, Edit, Delete)
 */
import React from 'react';
import {
  Phone, Trash2, Pencil, MapPin, MessageCircle
} from 'lucide-react';
import { formatDate } from '../utils/formatDate';

export default function LeadCard({ lead, onApprove, onDelete, onEdit }) {
  const phone = lead.contact?.phone || '';
  // Clean phone number for tel: and wa.me links
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const waPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 shadow-xs hover:shadow-md transition-all duration-200 flex items-center gap-3">

      {/* Section 1 — Name, Location & Status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3
            className="text-sm font-bold text-[#0F172A] truncate"
            title={lead.name}
          >
            {lead.name}
          </h3>
          <span className={`shrink-0 text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
            lead.status === 'approved'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {lead.status === 'approved' ? '✓ Approved' : 'Pending'}
          </span>
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

      {/* Section 2 — Date */}
      <div className="shrink-0 text-right hidden sm:block">
        {lead.createdAt && (
          <span className="text-[11px] font-semibold text-[#64748B] whitespace-nowrap">
            {formatDate(lead.createdAt)}
          </span>
        )}
      </div>

      {/* Section 3 — Action Icons */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Phone Call */}
        {cleanPhone && (
          <a
            href={`tel:${cleanPhone}`}
            className="p-2 rounded-full text-[#0A4DA6] hover:bg-[#0A4DA6]/10 transition-colors"
            title={`Call ${phone}`}
          >
            <Phone size={16} />
          </a>
        )}

        {/* WhatsApp */}
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

        {/* Edit */}
        {onEdit && (
          <button
            onClick={() => onEdit(lead)}
            className="p-2 rounded-full text-slate-400 hover:text-[#0A4DA6] hover:bg-[#0A4DA6]/10 transition-colors cursor-pointer"
            title="Edit lead"
          >
            <Pencil size={16} />
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => {
            if (confirm(`Delete lead "${lead.name}"?`)) onDelete(lead.id);
          }}
          className="p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          title="Delete lead"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
