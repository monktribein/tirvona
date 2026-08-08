/**
 * LeadCard.jsx — Clean & Spacious Tirvona Property Card
 * Single-line stay title truncation, clean spacing, and modern status pill badge.
 */
import React, { useState } from 'react';
import {
  MapPin, Phone, User, Calendar, Clock,
  CheckCircle2, ExternalLink, Trash2, FileText, Camera
} from 'lucide-react';
import { formatDate, formatMeetingDateTime, buildGoogleMapsUrl } from '../utils/formatDate';

export default function LeadCard({ lead, onApprove, onDelete }) {
  const [showFullNotes, setShowFullNotes] = useState(false);
  const mapsUrl = buildGoogleMapsUrl(lead.location?.coordinates?.lat, lead.location?.coordinates?.lng);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full min-w-[300px] sm:min-w-[350px]">
      <div>
        
        {/* Top Header Row — Single Line Title + Horizontal Badges */}
        <div className="flex items-start justify-between gap-3 mb-3.5 pb-3 border-b border-[#E2E8F0]">
          <div className="min-w-0 flex-1">
            {/* Single Line Stay Name with Truncation (...) */}
            <h3 className="text-base font-extrabold text-[#0F172A] tracking-tight truncate" title={lead.name}>
              {lead.name}
            </h3>
            <p className="text-xs font-medium text-[#64748B] flex items-center gap-1 mt-1 truncate">
              <MapPin size={13} className="text-[#0A4DA6] shrink-0" />
              <span className="truncate">
                {lead.location.address ? `${lead.location.address}, ` : ''}{lead.location.city}, {lead.location.state}
              </span>
            </p>
          </div>

          {/* Badges Stack */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] font-extrabold tracking-wider px-2.5 py-0.5 rounded-full uppercase bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20">
              {lead.interest}
            </span>
            <span className={`text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${
              lead.status === 'approved'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {lead.status === 'approved' ? '✓ Approved' : '⏳ Pending'}
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs py-3 px-3.5 bg-[#F8FAFC] rounded-xl mb-3.5 border border-[#E2E8F0]">
          {lead.contact.ownerName && (
            <div className="flex items-center gap-1.5 text-[#64748B] font-medium truncate">
              <User size={13} className="text-[#0A4DA6] shrink-0" />
              <span className="truncate">Contact: <strong className="text-[#0F172A] font-bold">{lead.contact.ownerName}</strong></span>
            </div>
          )}
          {lead.contact.phone && (
            <div className="flex items-center gap-1.5 text-[#64748B] font-medium">
              <Phone size={13} className="text-[#0A4DA6] shrink-0" />
              <strong className="text-[#0F172A] font-bold">{lead.contact.phone}</strong>
            </div>
          )}
          {lead.location.coordinates?.lat && lead.location.coordinates?.lng && (
            <div className="flex items-center gap-1.5 text-[#64748B] font-medium sm:col-span-2">
              <MapPin size={13} className="text-[#0A4DA6] shrink-0" />
              <span>GPS: <strong className="text-[#0F172A] font-bold">{lead.location.coordinates.lat}, {lead.location.coordinates.lng}</strong></span>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[#0A4DA6] hover:underline font-bold flex items-center gap-0.5 ml-auto">
                  Map <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}
          {lead.createdAt && (
            <div className="flex items-center gap-1.5 text-[#64748B] font-medium sm:col-span-2">
              <Calendar size={13} className="text-[#0A4DA6] shrink-0" />
              <span>Submitted: <strong className="text-[#0F172A] font-bold">{formatDate(lead.createdAt)}</strong></span>
            </div>
          )}
        </div>

        {/* Room Inventory Stats */}
        {lead.roomInventory && (lead.roomInventory.totalRooms || lead.roomInventory.roomPrice) && (
          <div className="mb-3.5 p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-xs">
            {lead.roomInventory.totalRooms && (
              <div>
                <span className="text-[10px] font-bold text-[#64748B] block">Total</span>
                <strong className="text-[#0F172A] font-extrabold">{lead.roomInventory.totalRooms} rms</strong>
              </div>
            )}
            {lead.roomInventory.roomPrice && (
              <div>
                <span className="text-[10px] font-bold text-[#64748B] block">Price</span>
                <strong className="text-[#0A4DA6] font-extrabold">₹{lead.roomInventory.roomPrice}</strong>
              </div>
            )}
            {lead.roomInventory.onlineRooms && (
              <div>
                <span className="text-[10px] font-bold text-[#64748B] block">Online</span>
                <strong className="text-[#0F172A] font-extrabold">{lead.roomInventory.onlineRooms}</strong>
              </div>
            )}
            {lead.roomInventory.offlineRooms && (
              <div>
                <span className="text-[10px] font-bold text-[#64748B] block">Offline</span>
                <strong className="text-[#0F172A] font-extrabold">{lead.roomInventory.offlineRooms}</strong>
              </div>
            )}
          </div>
        )}

        {/* Discussion Notes Snippet */}
        {lead.notes && (
          <div className="mb-3.5 p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] mb-1">
              <FileText size={13} className="text-[#0A4DA6]" />
              <span>Discussion Notes</span>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              {showFullNotes || lead.notes.length <= 100
                ? lead.notes
                : `${lead.notes.slice(0, 100)}...`}
            </p>
            {lead.notes.length > 100 && (
              <button
                onClick={() => setShowFullNotes(!showFullNotes)}
                className="text-[11px] font-bold text-[#0A4DA6] hover:underline mt-1 block cursor-pointer"
              >
                {showFullNotes ? 'Show Less' : 'Read Full Notes'}
              </button>
            )}
          </div>
        )}

        {/* Meeting Request Indicator */}
        {lead.meeting?.requested && (
          <div className="mb-3.5 p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs flex items-center justify-between text-amber-900 font-medium">
            <span className="flex items-center gap-1 font-bold">
              <Clock size={13} className="text-amber-600" />
              <span>Meeting ({lead.meeting.mode || 'Call'})</span>
            </span>
            <span className="text-[11px] font-bold text-amber-700">
              {formatMeetingDateTime(lead.meeting.time)}
            </span>
          </div>
        )}

        {/* Photo Gallery Thumbnails */}
        {lead.images && lead.images.length > 0 && (
          <div className="mb-3.5 space-y-1">
            <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1">
              <Camera size={12} className="text-[#0A4DA6]" />
              <span>Attached Photos ({lead.images.length})</span>
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {lead.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Attachment ${idx + 1}`}
                  className="w-11 h-11 object-cover rounded-lg border border-[#E2E8F0] shrink-0"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card Action Buttons */}
      <div className="pt-3 border-t border-[#E2E8F0] flex items-center gap-2">
        {lead.status === 'pending' ? (
          <button
            onClick={() => onApprove(lead)}
            className="flex-1 min-h-[42px] bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold rounded-full text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 size={15} />
            <span>Approve &amp; Convert</span>
          </button>
        ) : (
          <div className="flex-1 min-h-[42px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold rounded-full text-xs flex items-center justify-center gap-1.5 select-none">
            <CheckCircle2 size={15} />
            <span>Approved &amp; Converted</span>
          </div>
        )}

        <button
          onClick={() => {
            if (confirm(`Delete lead entry "${lead.name}"?`)) onDelete(lead.id);
          }}
          className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
          title="Delete lead entry"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
