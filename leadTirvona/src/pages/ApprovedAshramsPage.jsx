import React from 'react';
import { ArrowLeft } from 'lucide-react';
import ApprovedAshramCard from '../components/ApprovedAshramCard';

export default function ApprovedAshramsPage({ approvedAshrams, onNavigateLeads }) {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Converted Tirvona Stays
          </h1>
          <p className="text-[11px] sm:text-xs text-[#64748B] font-medium mt-0.5">
            Verified &amp; Active Onboarded Properties
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-2 sm:py-2.5 rounded-xl text-xs text-[#0F172A] font-bold shrink-0 self-start sm:self-auto">
          <span><strong>{approvedAshrams.length}</strong> Active Entities</span>
        </div>
      </div>

      {approvedAshrams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {approvedAshrams.map((ashram) => (
            <ApprovedAshramCard key={ashram.id} ashram={ashram} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-16 text-center space-y-3 sm:space-y-4 shadow-xs">
          <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A]">No Approved Stays Yet</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto font-medium">
            You have not approved any submitted field leads yet.
          </p>
          <button
            onClick={onNavigateLeads}
            className="px-5 py-2.5 min-h-[44px] bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold text-xs rounded-full shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={14} /> Go to Leads Dashboard &amp; Approve
          </button>
        </div>
      )}
    </div>
  );
}
