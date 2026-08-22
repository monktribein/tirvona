/**
 * DocumentVerifierDashboard.jsx — Tirvona Document Verification & Compliance Console
 * Allows Document Verifiers to audit, inspect, and approve the 7-item Onboarding & Document Checklist™.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  FileCheck, FileText, CheckCircle2, XCircle, AlertCircle, Search, Eye,
  Building2, MapPin, Phone, MessageCircle, User, Calendar, Download,
  ExternalLink, ArrowLeft, RefreshCw, ZoomIn, ZoomOut, RotateCw, X,
  ShieldCheck, Clock, Check, AlertTriangle, Landmark, Hotel, CheckSquare, Square
} from 'lucide-react';
import { formatDate } from '../utils/formatDate';
import { useLanguage } from '../context/LanguageContext';
import { CHECKLIST_CATEGORIES, CHECKLIST_ITEMS_CONFIG, getLeadDocumentCategory } from '../components/DocumentCollectionModal';

export default function DocumentVerifierDashboard({
  leads = [],
  agent = null,
  onSaveLead = null,
  onRefresh = null,
  showToast = () => {}
}) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'has_docs' | 'pending' | 'verified' | 'reupload'
  const [selectedLead, setSelectedLead] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null); // { url, isPdf, title }
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [verifierNotes, setVerifierNotes] = useState('');
  const [verifiedItemsState, setVerifiedItemsState] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  // Lock background body scroll and pause Lenis smooth scroll while modal or doc preview is open
  useEffect(() => {
    if (selectedLead || previewDoc) {
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
  }, [selectedLead, previewDoc]);

  // Helper to determine document verification status
  const getDocStatus = (lead) => {
    if (lead.docVerificationStatus === 'verified' || lead.documentVerified) return 'verified';
    if (lead.docVerificationStatus === 'needs_reupload') return 'needs_reupload';

    const savedItems = lead.documentChecklist?.items || {};
    const receivedCount = Object.values(savedItems).filter((it) => Boolean(it.received || it.imageUrl)).length;
    const otherDocsCount = Array.isArray(lead.documentChecklist?.otherDocuments) ? lead.documentChecklist.otherDocuments.length : 0;
    const totalReceived = receivedCount + otherDocsCount;

    if (totalReceived === 0) return 'no_docs';
    return lead.docVerificationStatus || 'pending';
  };

  // Helper to check if lead has any documents attached
  const checkHasDocs = (lead) => {
    const savedItems = lead.documentChecklist?.items || {};
    const receivedCount = Object.values(savedItems).filter((it) => Boolean(it.received || it.imageUrl)).length;
    const otherDocsCount = Array.isArray(lead.documentChecklist?.otherDocuments) ? lead.documentChecklist.otherDocuments.length : 0;
    return (receivedCount + otherDocsCount) > 0;
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    const list = leads.filter((lead) => {
      const status = getDocStatus(lead);
      const hasDocs = checkHasDocs(lead);

      // Filter Tab
      if (activeFilter === 'has_docs' && !hasDocs) return false;
      if (activeFilter === 'pending' && status !== 'pending') return false;
      if (activeFilter === 'verified' && status !== 'verified') return false;
      if (activeFilter === 'reupload' && status !== 'needs_reupload') return false;

      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const name = (lead.name || '').toLowerCase();
        const city = (lead.location?.city || '').toLowerCase();
        const contactName = (lead.contact?.name || lead.contact?.ownerName || '').toLowerCase();
        const contactPhone = (lead.contact?.phone || '').toLowerCase();
        const agentName = (lead.assignedAgentName || lead.fieldVerifiedByName || '').toLowerCase();
        return (
          name.includes(query) ||
          city.includes(query) ||
          contactName.includes(query) ||
          contactPhone.includes(query) ||
          agentName.includes(query)
        );
      }

      return true;
    });

    return [...list].sort((a, b) => {
      const aHasDocs = checkHasDocs(a);
      const bHasDocs = checkHasDocs(b);

      // 1. Leads with uploaded documents on top
      if (aHasDocs && !bHasDocs) return -1;
      if (!aHasDocs && bHasDocs) return 1;

      // 2. Newest change/submission on top, old on bottom
      const aTime = new Date(a.documentChecklist?.submittedAt || a.docUpdatedAt || a.docVerifiedAt || a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.documentChecklist?.submittedAt || b.docUpdatedAt || b.docVerifiedAt || b.updatedAt || b.createdAt || 0).getTime();

      return bTime - aTime;
    });
  }, [leads, activeFilter, searchQuery]);

  // Metric counts
  const stats = useMemo(() => {
    let hasDocsCount = 0;
    let pendingCount = 0;
    let verifiedCount = 0;
    let reuploadCount = 0;

    leads.forEach((lead) => {
      const hasDocs = checkHasDocs(lead);
      const status = getDocStatus(lead);
      if (hasDocs) hasDocsCount++;
      if (status === 'pending') pendingCount++;
      if (status === 'verified') verifiedCount++;
      if (status === 'needs_reupload') reuploadCount++;
    });

    return {
      total: leads.length,
      hasDocs: hasDocsCount,
      pending: pendingCount,
      verified: verifiedCount,
      reupload: reuploadCount
    };
  }, [leads]);

  // Open Lead Inspection Modal
  const handleOpenLead = (lead) => {
    const freshLead = leads.find((l) => (l.id || l._id) === (lead.id || lead._id)) || lead;
    const cat = getLeadDocumentCategory(freshLead);
    setSelectedLead(freshLead);
    setVerifierNotes(freshLead.docVerificationNotes || freshLead.verificationNotes || '');

    // Initialize individual item verified checkmarks from saved checklist
    const configItems = CHECKLIST_ITEMS_CONFIG[cat] || [];
    const savedItems = freshLead.documentChecklist?.items || {};

    const initialVerifiedState = {};
    configItems.forEach((it) => {
      initialVerifiedState[it.id] = Boolean(savedItems[it.id]?.verified || freshLead.docVerificationStatus === 'verified');
    });
    setVerifiedItemsState(initialVerifiedState);
  };

  // Close Inspection Modal
  const handleCloseLead = () => {
    setSelectedLead(null);
    setPreviewDoc(null);
    setVerifierNotes('');
    setVerifiedItemsState({});
  };

  // Toggle individual checklist item verification
  const toggleItemVerified = (itemId) => {
    setVerifiedItemsState((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Mark all items verified
  const handleVerifyAllChecklistItems = () => {
    const cat = getLeadDocumentCategory(selectedLead);
    const configItems = CHECKLIST_ITEMS_CONFIG[cat] || [];
    const updated = {};
    configItems.forEach((it) => {
      updated[it.id] = true;
    });
    setVerifiedItemsState(updated);
  };

  // Update Document Verification Status & Save
  const handleSetDocStatus = async (newStatus) => {
    if (!selectedLead) return;
    setIsUpdating(true);
    try {
      const cat = getLeadDocumentCategory(selectedLead);
      const currentItems = selectedLead.documentChecklist?.items || {};
      
      // Update individual items verified status
      const updatedItems = { ...currentItems };
      Object.keys(verifiedItemsState).forEach((itemId) => {
        if (updatedItems[itemId]) {
          updatedItems[itemId] = {
            ...updatedItems[itemId],
            verified: newStatus === 'verified' ? true : Boolean(verifiedItemsState[itemId])
          };
        } else {
          updatedItems[itemId] = {
            verified: newStatus === 'verified' ? true : Boolean(verifiedItemsState[itemId])
          };
        }
      });

      const updatedChecklist = {
        ...(selectedLead.documentChecklist || {}),
        category: cat,
        items: updatedItems,
        lastAuditedAt: new Date().toISOString(),
        auditedBy: agent?.name || 'Document Verifier'
      };

      const updatedData = {
        ...selectedLead,
        documentChecklist: updatedChecklist,
        docVerificationStatus: newStatus,
        documentVerified: newStatus === 'verified',
        docVerifiedAt: newStatus === 'verified' ? new Date().toISOString() : null,
        docVerifiedByName: agent?.name || 'Document Verifier',
        docVerifiedById: agent?._id || agent?.id,
        docVerificationNotes: verifierNotes.trim()
      };

      if (onSaveLead) {
        await onSaveLead(updatedData, selectedLead.id || selectedLead._id);
      }

      showToast(
        newStatus === 'verified'
          ? '✓ Lead Documents Verified & Confirmed!'
          : newStatus === 'needs_reupload'
          ? '⚠ Document Re-upload Requested'
          : 'Document status updated',
        'success'
      );

      setSelectedLead(updatedData);
    } catch (err) {
      showToast(err.message || 'Could not update document status', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 text-left">
      
      {/* Top Header Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0A4DA6] flex items-center justify-center shrink-0 shadow-2xs">
            <FileCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                {t('Document Verification Console')}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-[#0A4DA6] border border-blue-200/80">
                {t('KYC & Audit')}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#64748B] font-medium mt-0.5">
              Review and audit Onboarding &amp; Document Checklists collected by field executives.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {agent?.district && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-gray-200 rounded-full text-xs font-bold text-[#0F172A]">
              <MapPin size={13} className="text-[#0A4DA6]" />
              <span className="capitalize">{agent.district}, {agent.state}</span>
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-slate-600 hover:text-[#0A4DA6] hover:bg-slate-50 border border-gray-200 rounded-full transition-colors cursor-pointer"
              title="Refresh leads"
            >
              <RefreshCw size={15} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setActiveFilter('all')}
          className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all ${
            activeFilter === 'all' ? 'border-[#0A4DA6] ring-2 ring-[#0A4DA6]/15' : 'border-[#E2E8F0] hover:border-gray-300'
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
            {t('Total Leads')}
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0F172A] mt-1.5">{stats.total}</div>
          <div className="text-[10px] text-[#64748B] font-medium mt-0.5">All submitted properties</div>
        </div>

        <div
          onClick={() => setActiveFilter('has_docs')}
          className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all ${
            activeFilter === 'has_docs' ? 'border-[#0A4DA6] ring-2 ring-[#0A4DA6]/15' : 'border-[#E2E8F0] hover:border-gray-300'
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-bold text-[#0A4DA6] uppercase tracking-wider">
            {t('With Checklists')}
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0A4DA6] mt-1.5">{stats.hasDocs}</div>
          <div className="text-[10px] text-[#64748B] font-medium mt-0.5">Checklist / docs submitted</div>
        </div>

        <div
          onClick={() => setActiveFilter('pending')}
          className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all ${
            activeFilter === 'pending' ? 'border-amber-500 ring-2 ring-amber-500/15' : 'border-[#E2E8F0] hover:border-gray-300'
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-bold text-amber-600 uppercase tracking-wider">
            {t('Pending Audit')}
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1.5">{stats.pending}</div>
          <div className="text-[10px] text-[#64748B] font-medium mt-0.5">Needs document audit</div>
        </div>

        <div
          onClick={() => setActiveFilter('verified')}
          className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all ${
            activeFilter === 'verified' ? 'border-emerald-500 ring-2 ring-emerald-500/15' : 'border-[#E2E8F0] hover:border-gray-300'
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
            {t('Docs Verified')}
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-1.5">{stats.verified}</div>
          <div className="text-[10px] text-[#64748B] font-medium mt-0.5">Fully approved onboarding</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search ashram, city, contact or field executive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[42px] pl-10 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Leads', count: stats.total },
            { id: 'has_docs', label: 'Has Checklist', count: stats.hasDocs },
            { id: 'pending', label: 'Pending', count: stats.pending },
            { id: 'verified', label: 'Verified', count: stats.verified },
            { id: 'reupload', label: 'Re-upload Req.', count: stats.reupload },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-[#0A4DA6] text-white shadow-xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <FileCheck size={24} />
          </div>
          <h3 className="text-base font-extrabold text-[#0F172A]">No Leads Found</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto font-medium">
            {searchQuery
              ? 'No ashram leads match your search criteria. Try a different search term.'
              : 'No leads available in this category.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLeads.map((lead) => {
            const docStatus = getDocStatus(lead);
            const phone = lead.contact?.phone || '';
            const cleanPhone = phone.replace(/[^0-9+]/g, '');
            const waPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;

            const categoryKey = getLeadDocumentCategory(lead);
            const categoryLabel =
              categoryKey === CHECKLIST_CATEGORIES.INSTITUTION_TRUST
                ? 'Institution / Trust'
                : categoryKey === CHECKLIST_CATEGORIES.COMMERCIAL_STAY
                ? 'Commercial Stay'
                : 'Property Documents';

            const savedItems = lead.documentChecklist?.items || {};
            const receivedCount = Object.values(savedItems).filter((it) => it.received || it.imageUrl).length;
            const totalItems = (CHECKLIST_ITEMS_CONFIG[categoryKey] || []).length || 7;

            return (
              <div
                key={lead.id || lead._id}
                className="bg-white border border-[#E2E8F0] hover:border-blue-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5"
              >
                {/* Header & Status */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] truncate" title={lead.name}>
                          {lead.name}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-extrabold border border-slate-200">
                          {categoryLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5 truncate">
                        <MapPin size={11} className="text-[#0A4DA6] shrink-0" />
                        <span className="truncate">
                          {lead.location?.city || lead.address || 'Address not specified'}
                          {lead.location?.state ? `, ${lead.location.state}` : ''}
                        </span>
                      </p>
                    </div>

                    {/* Document Status Badge */}
                    <span
                      className={`shrink-0 text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${
                        docStatus === 'verified'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : docStatus === 'needs_reupload'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : receivedCount >= totalItems && totalItems > 0
                          ? 'bg-blue-50 text-[#0A4DA6] border-blue-200'
                          : receivedCount > 0
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {docStatus === 'verified' ? (
                        <>
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          <span>Docs Verified</span>
                        </>
                      ) : docStatus === 'needs_reupload' ? (
                        <>
                          <AlertTriangle size={11} className="text-rose-600" />
                          <span>Re-upload Req.</span>
                        </>
                      ) : receivedCount >= totalItems && totalItems > 0 ? (
                        <>
                          <FileCheck size={11} className="text-[#0A4DA6]" />
                          <span>Docs Complete ({receivedCount}/{totalItems})</span>
                        </>
                      ) : receivedCount > 0 ? (
                        <>
                          <Clock size={11} className="text-amber-600" />
                          <span>Docs Incomplete ({receivedCount}/{totalItems})</span>
                        </>
                      ) : (
                        <span>No Documents</span>
                      )}
                    </span>
                  </div>

                  {/* Attribution Details */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase block">Captured By</span>
                      <span className="font-extrabold text-[#0F172A] truncate block">
                        {lead.assignedAgentName || lead.fieldVerifiedByName || 'Field Executive'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase block">Contact Person</span>
                      <span className="font-extrabold text-[#0F172A] truncate block">
                        {lead.contact?.name || lead.contact?.ownerName || 'Manager'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Checklist Progress & Action Bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {receivedCount > 0 ? (
                      <span className="text-xs font-bold text-[#0A4DA6] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 flex items-center gap-1.5">
                        <FileCheck size={12} className="text-[#0A4DA6]" />
                        <span>{receivedCount}/{totalItems} Docs Collected</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        Pending Field Upload
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {cleanPhone && (
                      <a
                        href={`tel:${cleanPhone}`}
                        className="p-2 rounded-full text-[#0A4DA6] hover:bg-blue-50 transition-colors"
                        title={`Call ${phone}`}
                      >
                        <Phone size={14} />
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
                        <MessageCircle size={14} />
                      </a>
                    )}
                    <button
                      onClick={() => handleOpenLead(lead)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-extrabold transition-all shadow-xs cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Inspect Docs</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LEAD DOCUMENT INSPECTION MODAL */}
      {selectedLead && (
        <div 
          data-lenis-prevent="true"
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-fadeIn overscroll-contain"
        >
          <div 
            data-lenis-prevent="true"
            className="bg-white border border-[#E2E8F0] w-full max-w-4xl max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-left animate-scaleUp overscroll-contain"
          >
            
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-xl font-extrabold text-[#0F172A] truncate">
                    {selectedLead.name}
                  </h2>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      getDocStatus(selectedLead) === 'verified'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : getDocStatus(selectedLead) === 'needs_reupload'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {getDocStatus(selectedLead) === 'verified'
                      ? '✓ Verified & Confirmed'
                      : getDocStatus(selectedLead) === 'needs_reupload'
                      ? '⚠ Re-upload Required'
                      : '⏳ Pending Audit'}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">
                  {selectedLead.location?.city || selectedLead.address} · Submitted by{' '}
                  <strong className="text-[#0F172A]">{selectedLead.assignedAgentName || selectedLead.fieldVerifiedByName || 'Field Executive'}</strong> on{' '}
                  {formatDate(selectedLead.createdAt)}
                </p>
              </div>

              <button
                onClick={handleCloseLead}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div 
              data-lenis-prevent="true"
              className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 overscroll-contain"
            >
              
              {/* Ashram & Property Type Banner */}
              {(() => {
                const activeCat = getLeadDocumentCategory(selectedLead);
                return (
                  <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0A4DA6] flex items-center justify-center shrink-0">
                        {activeCat === CHECKLIST_CATEGORIES.COMMERCIAL_STAY ? (
                          <Hotel size={20} />
                        ) : (
                          <Landmark size={20} />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#64748B] uppercase block">Selected Category (Field Agent Selection)</span>
                        <span className="text-sm font-extrabold text-[#0F172A] mt-0.5 block">
                          {activeCat === CHECKLIST_CATEGORIES.COMMERCIAL_STAY
                            ? 'Commercial Guest House / Stay'
                            : 'Institution / Trust Properties'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleVerifyAllChecklistItems}
                        className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-extrabold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={13} />
                        <span>Check All as Verified</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* 7. OFFICIAL DOCUMENT CHECKLIST AUDIT TABLE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                    <FileCheck size={18} className="text-[#0A4DA6]" />
                    <span>7. Tirvona Onboarding Document Checklist™</span>
                  </h3>
                  <span className="text-xs font-bold text-[#64748B]">Page 2 — Document Verification</span>
                </div>

                {(() => {
                  const cat = getLeadDocumentCategory(selectedLead);
                  const configItems = CHECKLIST_ITEMS_CONFIG[cat] || [];
                  const savedItems = selectedLead.documentChecklist?.items || {};

                  return (
                    <div className="border border-[#E2E8F0] rounded-2xl overflow-hidden overflow-x-auto shadow-2xs">
                      <table className="w-full min-w-[520px] text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 border-b border-[#E2E8F0] text-[11px] font-extrabold text-[#475569] uppercase tracking-wider">
                            <th className="py-3 px-4">#</th>
                            <th className="py-3 px-4">Document Name</th>
                            <th className="py-3 px-3 text-center">Field Status</th>
                            <th className="py-3 px-4 text-center">Attachment Preview</th>
                            <th className="py-3 px-4 text-center">Verifier Check</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {configItems.map((item, idx) => {
                            const itemData = savedItems[item.id] || {};
                            const hasFile = Boolean(itemData.imageUrl);
                            const isVerified = Boolean(verifiedItemsState[item.id]);

                            return (
                              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                                
                                {/* Document Name */}
                                <td className="py-3 px-4">
                                  <span className="font-extrabold text-[#0F172A] block">
                                    {item.name}
                                  </span>
                                </td>

                                {/* Field Collection Status */}
                                <td className="py-3 px-3 text-center">
                                  {itemData.received || hasFile ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <Check size={11} />
                                      <span>Received</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200">
                                      <span>Pending</span>
                                    </span>
                                  )}
                                </td>

                                {/* Attachment Preview */}
                                <td className="py-3 px-4 text-center">
                                  {hasFile ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPreviewDoc({ url: itemData.imageUrl, isPdf: itemData.isPdf, title: item.name });
                                          setZoomLevel(1);
                                          setRotation(0);
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-[#0A4DA6] border border-blue-200 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                                      >
                                        <Eye size={13} />
                                        <span>View Document</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 font-semibold italic">Not uploaded</span>
                                  )}
                                </td>

                                {/* Verifier Verification Checkbox */}
                                <td className="py-3 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleItemVerified(item.id)}
                                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold transition-all cursor-pointer border ${
                                      isVerified
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                        : 'bg-white text-slate-500 border-gray-300 hover:border-emerald-500 hover:text-emerald-600'
                                    }`}
                                  >
                                    {isVerified ? (
                                      <>
                                        <CheckCircle2 size={13} />
                                        <span>Verified</span>
                                      </>
                                    ) : (
                                      <span>Verify</span>
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Other Documents & Supporting Attachments */}
              {selectedLead.documentChecklist?.otherDocuments?.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                    Other Supporting Documents ({selectedLead.documentChecklist.otherDocuments.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedLead.documentChecklist.otherDocuments.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={16} className="text-[#0A4DA6] shrink-0" />
                          <span className="font-extrabold text-[#0F172A] truncate">{doc.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDoc({ url: doc.imageUrl, isPdf: doc.isPdf, title: doc.name });
                            setZoomLevel(1);
                            setRotation(0);
                          }}
                          className="px-2.5 py-1 bg-white border border-gray-200 hover:border-[#0A4DA6] rounded-lg text-xs font-bold text-[#0A4DA6] cursor-pointer"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discussion Notes From Field Executive */}
              {selectedLead.agentNotes && (
                <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1">
                  <span className="text-[11px] font-extrabold text-[#0A4DA6] uppercase tracking-wider block">
                    Field Executive Discussion Notes
                  </span>
                  <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap">
                    {selectedLead.agentNotes}
                  </p>
                </div>
              )}

              {/* Verifier Notes & Audit Feedback */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">
                  Verifier Audit Feedback &amp; Notes
                </label>
                <textarea
                  rows={2}
                  value={verifierNotes}
                  onChange={(e) => setVerifierNotes(e.target.value)}
                  placeholder="e.g., Trust deed matches mathura address. Representative Aadhaar card verified..."
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6]"
                />
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 sm:p-6 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCloseLead}
                className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 text-slate-700 hover:bg-white rounded-full text-xs font-extrabold cursor-pointer transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleSetDocStatus('needs_reupload')}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <AlertTriangle size={14} />
                  <span>Request Re-upload</span>
                </button>

                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleSetDocStatus('verified')}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  <span>{isUpdating ? 'Saving...' : 'Approve & Confirm Lead'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX / PDF VIEWER */}
      {previewDoc && (
        <div 
          data-lenis-prevent="true"
          className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex flex-col animate-fadeIn overscroll-contain"
        >
          {/* Top Bar */}
          <div className="px-4 py-3 bg-black/40 border-b border-white/10 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold">{previewDoc.title}</span>
              <a
                href={previewDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-full text-[11px] font-bold text-white transition-colors"
              >
                <ExternalLink size={12} />
                <span>Open in New Tab</span>
              </a>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {!previewDoc.isPdf && (
                <>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                    className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10"
                    title="Zoom in"
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                    className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10"
                    title="Zoom out"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10"
                    title="Rotate"
                  >
                    <RotateCw size={18} />
                  </button>
                </>
              )}
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Viewer Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {previewDoc.isPdf || previewDoc.url?.startsWith('data:application/pdf') || previewDoc.url?.endsWith('.pdf') ? (
              <iframe
                src={previewDoc.url}
                title="PDF Document Viewer"
                className="w-full h-full max-w-5xl rounded-xl bg-white shadow-2xl"
              />
            ) : (
              <img
                src={previewDoc.url}
                alt="Document preview"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease'
                }}
                className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
