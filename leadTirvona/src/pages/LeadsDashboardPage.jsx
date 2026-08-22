import React, { useState, useMemo } from 'react';
import { Search, PlusCircle, Filter } from 'lucide-react';
import LeadCard from '../components/LeadCard';
import AppointmentModal from '../components/AppointmentModal';
import DocumentCollectionModal from '../components/DocumentCollectionModal';

export default function LeadsDashboardPage({
  agent = null,
  agentRole = null,
  leads = [],
  onApproveLead,
  onDeleteLead,
  onNavigateCreate,
  onEditLead,
  onUpdateAppointment,
  onSaveLead = null,
  showToast = () => {}
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [interestFilter, setInterestFilter] = useState('ALL');
  const [selectedLeadForAppointment, setSelectedLeadForAppointment] = useState(null);
  const [selectedLeadForDocs, setSelectedLeadForDocs] = useState(null);

  // Base list of leads scoped to the current user
  const scopedLeads = useMemo(() => {
    if (agent?.role === 'lead_executive' && agent?.id) {
      const myId = String(agent.id || agent._id || '').trim();
      return leads.filter((lead) => {
        const leadCapturedBy = String(lead.capturedBy?._id || lead.capturedBy || lead.capturedById || '').trim();
        return !leadCapturedBy || leadCapturedBy === myId;
      });
    }
    return leads;
  }, [leads, agent]);

  // Metric counts derived accurately from scopedLeads
  const pendingCount     = useMemo(() => scopedLeads.filter((l) => l.status === 'pending').length, [scopedLeads]);
  const approvedCount    = useMemo(() => scopedLeads.filter((l) => l.status === 'approved' || l.status === 'converted').length, [scopedLeads]);
  const appointmentCount = useMemo(() => scopedLeads.filter((l) => Boolean(l.meeting?.requested && l.meeting?.time)).length, [scopedLeads]);

  const filtered = useMemo(() => {
    return scopedLeads
      .filter((lead) => {
        const q = searchQuery.toLowerCase().trim();
        const matchSearch = !q
          || (lead.name || '').toLowerCase().includes(q)
          || (lead.location?.city || '').toLowerCase().includes(q)
          || (lead.contact?.ownerName || '').toLowerCase().includes(q);
        const matchStatus = statusFilter === 'ALL' || lead.status === statusFilter;
        const matchInterest = interestFilter === 'ALL' || lead.interest === interestFilter;
        return matchSearch && matchStatus && matchInterest;
      })
      .sort((a, b) => {
        const aSaved = a.documentChecklist?.items || {};
        const aDocsCount = Object.values(aSaved).filter((it) => it.received || it.imageUrl).length + (a.documentChecklist?.otherDocuments?.length || 0);
        const bSaved = b.documentChecklist?.items || {};
        const bDocsCount = Object.values(bSaved).filter((it) => it.received || it.imageUrl).length + (b.documentChecklist?.otherDocuments?.length || 0);

        const aHasDocs = aDocsCount > 0;
        const bHasDocs = bDocsCount > 0;

        // Leads with uploaded documents on top
        if (aHasDocs && !bHasDocs) return -1;
        if (!aHasDocs && bHasDocs) return 1;

        // Newest change/submission on top
        const aTime = new Date(a.documentChecklist?.submittedAt || a.docUpdatedAt || a.docVerifiedAt || a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.documentChecklist?.submittedAt || b.docUpdatedAt || b.docVerifiedAt || b.updatedAt || b.createdAt || 0).getTime();

        return bTime - aTime;
      });
  }, [scopedLeads, searchQuery, statusFilter, interestFilter]);

  const inputClass = "w-full min-h-[44px] px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]";

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 text-left">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Ashram Onboarding Leads Dashboard
          </h1>
          <p className="text-[11px] sm:text-xs text-[#64748B] font-medium mt-0.5">
            Field Submitted Leads &amp; Admin Approval Simulator
          </p>
        </div>
        {agentRole !== 'field_agent' && (
          <button
            onClick={onNavigateCreate}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 min-h-[44px] bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold rounded-full text-xs sm:text-sm shadow-sm transition-all cursor-pointer shrink-0"
          >
            <PlusCircle size={16} />
            New Lead Entry
          </button>
        )}
      </div>

      {/* Stats Summary Cards */}
      <div className={`grid gap-3 sm:gap-4 ${onUpdateAppointment ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {[
          { label: 'Total Submitted',      value: scopedLeads.length },
          { label: 'Pending Approval',     value: pendingCount },
          { label: 'Approved & Converted', value: approvedCount },
          ...(onUpdateAppointment ? [{ label: 'Total Appointments', value: appointmentCount }] : []),
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-[#64748B] block">{stat.label}</span>
              <span className="text-xl sm:text-2xl font-extrabold text-[#0F172A] mt-0.5 block">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search leads by Stay Name, City, or Contact..."
            className={`${inputClass} pl-10 sm:pl-11`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-[#64748B] shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputClass}
            >
              <option value="ALL">All Statuses ({scopedLeads.length})</option>
              <option value="pending">Pending Approval ({pendingCount})</option>
              <option value="approved">Approved / Converted ({approvedCount})</option>
            </select>
          </div>

          {/* Interest Filter */}
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-[#64748B] shrink-0" />
            <select
              value={interestFilter}
              onChange={(e) => setInterestFilter(e.target.value)}
              className={inputClass}
            >
              <option value="ALL">All Owner Sentiment</option>
              <option value="Interested">Interested</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Follow-up Required">Follow-up Required</option>
            </select>
          </div>
        </div>
      </div>

      {/* Record Counter Banner */}
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] px-1">
        Showing {filtered.length} Lead Record(s)
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onApprove={onApproveLead}
              onDelete={onDeleteLead}
              onEdit={onEditLead}
              onBookAppointment={onUpdateAppointment ? (l) => setSelectedLeadForAppointment(l) : null}
              onOpenDocuments={(l) => setSelectedLeadForDocs(l)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-16 text-center space-y-3 sm:space-y-4 shadow-xs">
          <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A]">No Matching Leads Found</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto font-medium">
            No leads match your current search query or filter selections.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setInterestFilter('ALL'); }}
            className="px-5 py-2.5 min-h-[44px] bg-[#0A4DA6] text-white font-extrabold text-xs rounded-full shadow-sm hover:bg-[#083D85] transition-all inline-block cursor-pointer"
          >
            Clear Search Filters
          </button>
        </div>
      )}

      {/* Appointment Booking Modal */}
      <AppointmentModal
        isOpen={Boolean(selectedLeadForAppointment)}
        onClose={() => setSelectedLeadForAppointment(null)}
        lead={selectedLeadForAppointment}
        onSaveAppointment={async (leadId, meetingData) => {
          if (onUpdateAppointment) {
            await onUpdateAppointment(leadId, meetingData);
          }
        }}
      />

      {/* Document Collection & Checklist Modal */}
      <DocumentCollectionModal
        isOpen={Boolean(selectedLeadForDocs)}
        onClose={() => setSelectedLeadForDocs(null)}
        lead={leads.find((l) => (l.id || l._id) === (selectedLeadForDocs?.id || selectedLeadForDocs?._id)) || selectedLeadForDocs}
        onSaveDocuments={onSaveLead}
        showToast={showToast}
      />
    </div>
  );
}
