/**
 * DocumentCollectionModal.jsx — Tirvona Onboarding & Document Checklist™ Collection Modal
 * Allows Field Executives to collect and upload required verification documents for ashrams.
 */
import React, { useState, useEffect } from 'react';
import {
  X, FileText, Camera, Upload, CheckCircle2, AlertCircle, Trash2,
  Building2, Landmark, Hotel, ShieldCheck, Eye, ExternalLink, RefreshCw, AlertTriangle
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { fileToBase64 } from '../utils/fileToBase64';

export const CHECKLIST_CATEGORIES = {
  INSTITUTION_TRUST: 'institution_trust',
  COMMERCIAL_STAY: 'commercial_stay'
};

export const CHECKLIST_ITEMS_CONFIG = {
  [CHECKLIST_CATEGORIES.INSTITUTION_TRUST]: [
    { id: 'trust_reg', name: 'Trust / Society / Institution Registration, as applicable', required: false },
    { id: 'rep_id', name: 'Authorized Representative ID', required: false },
    { id: 'auth_proof', name: 'Authorization / Authority Proof', required: false },
    { id: 'pan_doc', name: 'PAN, as applicable', required: false },
    { id: 'gst_doc', name: 'GST, where applicable', required: false },
    { id: 'prop_auth', name: 'Property / Operational Authorization, as applicable', required: false },
    { id: 'bank_details', name: 'Bank / Payment Details', required: false }
  ],
  [CHECKLIST_CATEGORIES.COMMERCIAL_STAY]: [
    { id: 'owner_id', name: 'Owner / Entity Identification', required: false },
    { id: 'pan_doc', name: 'PAN', required: false },
    { id: 'gst_doc', name: 'GST, where applicable', required: false },
    { id: 'licence_doc', name: 'Applicable Registration / Licence', required: false },
    { id: 'auth_person_id', name: 'Authorized Person ID', required: false },
    { id: 'prop_auth', name: 'Property / Operational Authorization', required: false },
    { id: 'bank_details', name: 'Bank / Payment Details', required: false }
  ]
};

// Robust helper to detect lead's document checklist category
export const getLeadDocumentCategory = (lead) => {
  if (!lead) return CHECKLIST_CATEGORIES.INSTITUTION_TRUST;

  // 1. Check if documentChecklist explicitly specifies category
  if (lead.documentChecklist?.category) {
    return lead.documentChecklist.category;
  }

  // 2. Detect by item keys in saved items
  const items = lead.documentChecklist?.items || {};
  const hasInstitutionKeys = Boolean(items.trust_reg || items.rep_id || items.auth_proof);
  const hasCommercialKeys = Boolean(items.owner_id || items.licence_doc || items.auth_person_id);

  if (hasInstitutionKeys && !hasCommercialKeys) return CHECKLIST_CATEGORIES.INSTITUTION_TRUST;
  if (hasCommercialKeys && !hasInstitutionKeys) return CHECKLIST_CATEGORIES.COMMERCIAL_STAY;

  // 3. Check direct lead documentCategory field
  if (lead.documentCategory) {
    return lead.documentCategory;
  }

  return CHECKLIST_CATEGORIES.INSTITUTION_TRUST;
};

export default function DocumentCollectionModal({
  isOpen,
  onClose,
  lead,
  onSaveDocuments,
  showToast = () => {}
}) {
  const { t } = useLanguage();

  const [category, setCategory] = useState(getLeadDocumentCategory(lead));

  const [itemsState, setItemsState] = useState({});
  const [otherDocs, setOtherDocs] = useState([]);
  const [newOtherDocName, setNewOtherDocName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

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

  // Initialize or restore state when modal opens or lead changes
  useEffect(() => {
    if (!isOpen || !lead) return;

    // Prioritize the category where the documents were actually saved
    const initialCategory = getLeadDocumentCategory(lead);
    setCategory(initialCategory);

    const savedChecklist = lead.documentChecklist?.items || {};
    
    // Restore state for all possible checklist item keys across categories
    const initialItems = {};
    const allConfigItems = [
      ...(CHECKLIST_ITEMS_CONFIG[CHECKLIST_CATEGORIES.INSTITUTION_TRUST] || []),
      ...(CHECKLIST_ITEMS_CONFIG[CHECKLIST_CATEGORIES.COMMERCIAL_STAY] || [])
    ];
    
    allConfigItems.forEach((item) => {
      const existing = savedChecklist[item.id] || {};
      initialItems[item.id] = {
        received: Boolean(existing.received || existing.imageUrl),
        imageUrl: existing.imageUrl || '',
        isPdf: Boolean(existing.isPdf),
        verified: Boolean(existing.verified),
        uploadedAt: existing.uploadedAt || null,
        note: existing.note || ''
      };
    });

    // Also preserve any custom or additional item keys in savedChecklist
    Object.keys(savedChecklist).forEach((key) => {
      if (!initialItems[key]) {
        const existing = savedChecklist[key] || {};
        initialItems[key] = {
          received: Boolean(existing.received || existing.imageUrl),
          imageUrl: existing.imageUrl || '',
          isPdf: Boolean(existing.isPdf),
          verified: Boolean(existing.verified),
          uploadedAt: existing.uploadedAt || null,
          note: existing.note || ''
        };
      }
    });

    setItemsState(initialItems);
    setOtherDocs(lead.documentChecklist?.otherDocuments || []);
  }, [isOpen, lead]);

  // When switching category, ensure checklist items are prepared and preserve existing data
  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    const configItems = CHECKLIST_ITEMS_CONFIG[newCat] || [];
    const savedChecklist = lead?.documentChecklist?.items || {};
    const updated = { ...itemsState };
    configItems.forEach((item) => {
      if (!updated[item.id]) {
        const existing = savedChecklist[item.id] || {};
        updated[item.id] = {
          received: Boolean(existing.received || existing.imageUrl),
          imageUrl: existing.imageUrl || '',
          isPdf: Boolean(existing.isPdf),
          verified: Boolean(existing.verified),
          uploadedAt: existing.uploadedAt || null,
          note: existing.note || ''
        };
      }
    });
    setItemsState(updated);
  };

  // Toggle Received Status Checkbox
  const toggleItemReceived = (itemId) => {
    setItemsState((prev) => {
      const current = prev[itemId] || {};
      const nextReceived = !current.received;
      return {
        ...prev,
        [itemId]: {
          ...current,
          received: nextReceived,
          ...(nextReceived ? {} : { imageUrl: '', isPdf: false, uploadedAt: null, verified: false })
        }
      };
    });
  };

  // Handle Document File Upload
  const handleFileUpload = async (itemId, file) => {
    if (!file) return;
    try {
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const base64 = await fileToBase64(file);

      setItemsState((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          received: true,
          imageUrl: base64,
          isPdf,
          uploadedAt: new Date().toISOString()
        }
      }));

      showToast('Document uploaded successfully', 'success');
    } catch (err) {
      showToast('Could not process file: ' + err.message, 'error');
    }
  };

  // Remove document attachment
  const handleRemoveFile = (itemId) => {
    setItemsState((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        received: false,
        imageUrl: '',
        isPdf: false,
        uploadedAt: null,
        verified: false
      }
    }));
    showToast('Document removed', 'info');
  };

  // Add Other Document File
  const handleAddOtherDoc = async (file) => {
    if (!file) return;
    try {
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const base64 = await fileToBase64(file);
      const name = newOtherDocName.trim() || `Additional Document ${otherDocs.length + 1}`;

      setOtherDocs((prev) => [
        ...prev,
        {
          id: 'other_' + Date.now(),
          name,
          imageUrl: base64,
          isPdf,
          uploadedAt: new Date().toISOString()
        }
      ]);
      setNewOtherDocName('');
      showToast('Additional document attached', 'success');
    } catch (err) {
      showToast('Error uploading other doc: ' + err.message, 'error');
    }
  };

  // Remove Other Document
  const handleRemoveOtherDoc = (idx) => {
    setOtherDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit and Save Checklist
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lead) return;

    setIsSaving(true);
    try {
      const configItems = CHECKLIST_ITEMS_CONFIG[category] || [];
      const imagesList = [];

      // Gather all uploaded images from checklist & other docs
      Object.values(itemsState).forEach((item) => {
        if (item.imageUrl) imagesList.push(item.imageUrl);
      });
      otherDocs.forEach((doc) => {
        if (doc.imageUrl) imagesList.push(doc.imageUrl);
      });

      const totalReceived = configItems.filter((it) => itemsState[it.id]?.received || itemsState[it.id]?.imageUrl).length;
      const isComplete = totalReceived >= configItems.length && configItems.length > 0;

      const nowIso = new Date().toISOString();
      const checklistPayload = {
        category,
        categoryName: category === CHECKLIST_CATEGORIES.INSTITUTION_TRUST ? 'Institution / Trust Properties' : 'Commercial Guest House / Stay',
        items: itemsState,
        otherDocuments: otherDocs,
        totalRequired: configItems.length,
        totalReceived,
        isComplete,
        submittedAt: nowIso
      };

      const updatedLead = {
        ...lead,
        documentCategory: category,
        documentChecklist: checklistPayload,
        docUpdatedAt: nowIso,
        updatedAt: nowIso,
        docVerificationStatus: lead.docVerificationStatus === 'verified'
          ? 'verified'
          : totalReceived > 0
          ? (lead.docVerificationStatus === 'needs_reupload' ? 'needs_reupload' : 'pending')
          : null,
        images: imagesList.length > 0 ? imagesList : (lead.images || [])
      };

      if (onSaveDocuments) {
        await onSaveDocuments(updatedLead, lead.id || lead._id);
      }

      showToast('Documents & checklist saved successfully!', 'success');
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to save documents', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !lead) return null;

  const currentItems = CHECKLIST_ITEMS_CONFIG[category] || [];
  const completedCount = currentItems.filter((it) => itemsState[it.id]?.received || itemsState[it.id]?.imageUrl).length;

  return (
    <div 
      data-lenis-prevent="true"
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-fadeIn overscroll-contain"
    >
      <div 
        data-lenis-prevent="true"
        className="bg-white border border-[#E2E8F0] w-full max-w-3xl max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-left animate-scaleUp overscroll-contain"
      >
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0 bg-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-extrabold text-[#0F172A] truncate">
                {t('Document & Verification Checklist™')}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-[#0A4DA6] border border-blue-200">
                Page 2 — Onboarding
              </span>
            </div>
            <p className="text-xs text-[#64748B] font-medium mt-0.5 truncate">
              {lead.name} · {lead.location?.city || lead.address}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form 
          data-lenis-prevent="true"
          onSubmit={handleSubmit} 
          className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 overscroll-contain"
        >
          
          {/* STEP 1: CATEGORY SELECTION */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-[#475569] block tracking-wider uppercase">
              1. Select Property Type / Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Option A: Institution / Trust */}
              <button
                type="button"
                onClick={() => handleCategoryChange(CHECKLIST_CATEGORIES.INSTITUTION_TRUST)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                  category === CHECKLIST_CATEGORIES.INSTITUTION_TRUST
                    ? 'border-[#0A4DA6] bg-blue-50/50 ring-2 ring-[#0A4DA6]/20'
                    : 'border-[#E2E8F0] hover:border-gray-300 bg-white'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  category === CHECKLIST_CATEGORIES.INSTITUTION_TRUST ? 'bg-[#0A4DA6] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <Landmark size={20} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-[#0F172A]">Institution / Trust Properties</h4>
                  <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
                    Ashrams, Dharmashalas, Religious &amp; Charitable Trusts
                  </p>
                </div>
              </button>

              {/* Option B: Commercial Guest House / Stay */}
              <button
                type="button"
                onClick={() => handleCategoryChange(CHECKLIST_CATEGORIES.COMMERCIAL_STAY)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                  category === CHECKLIST_CATEGORIES.COMMERCIAL_STAY
                    ? 'border-[#0A4DA6] bg-blue-50/50 ring-2 ring-[#0A4DA6]/20'
                    : 'border-[#E2E8F0] hover:border-gray-300 bg-white'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  category === CHECKLIST_CATEGORIES.COMMERCIAL_STAY ? 'bg-[#0A4DA6] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <Hotel size={20} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-[#0F172A]">Commercial Guest House / Stay</h4>
                  <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
                    Private Guest Houses, Hotels, Homestays &amp; Commercial Units
                  </p>
                </div>
              </button>

            </div>
          </div>

          {/* STEP 2: DOCUMENT CHECKLIST TABLE */}
          <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-[#0F172A] tracking-tight">
                  2. Document Checklist ({completedCount} of {currentItems.length} Received)
                </h3>
                <p className="text-[11px] text-[#64748B] font-medium">
                  Tick received documents and attach photos/PDFs for verifier audit.
                </p>
              </div>
              <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(completedCount / currentItems.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {currentItems.map((item, index) => {
                const state = itemsState[item.id] || {};
                const hasFile = Boolean(state.imageUrl);

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      state.received || hasFile
                        ? 'border-blue-200 bg-blue-50/20'
                        : 'border-[#E2E8F0] bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {/* Left: Checkbox & Name */}
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          id={`chk_${item.id}`}
                          checked={state.received || hasFile}
                          onChange={() => toggleItemReceived(item.id)}
                          className="w-4 h-4 mt-0.5 text-[#0A4DA6] rounded border-gray-300 focus:ring-[#0A4DA6] cursor-pointer"
                        />
                        <label htmlFor={`chk_${item.id}`} className="cursor-pointer">
                          <span className="text-xs sm:text-sm font-extrabold text-[#0F172A] block">
                            {index + 1}. {item.name}
                          </span>
                          <span className="text-[10px] text-[#64748B] font-semibold">
                            {state.received ? '✓ Marked as Received' : 'Pending Document'}
                          </span>
                        </label>
                      </div>

                      {/* Right: Upload Button or Preview Thumbnail */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {hasFile ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewFile(state.imageUrl)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#0A4DA6] hover:bg-slate-50 cursor-pointer shadow-2xs"
                            >
                              <Eye size={13} />
                              <span>Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(item.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Remove file"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] hover:border-[#0A4DA6] rounded-xl text-xs font-extrabold text-[#0A4DA6] hover:bg-blue-50/50 cursor-pointer transition-all shadow-2xs">
                            <Camera size={14} />
                            <span>Capture / Upload</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleFileUpload(item.id, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 3: OTHER DOCUMENTS / FREE-FORM ATTACHMENTS */}
          <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                  3. Other Documents &amp; Supporting Photos
                </h4>
                <p className="text-[10px] text-[#64748B] font-medium">
                  Additional NOCs, electricity bills, photos or premises agreements.
                </p>
              </div>
            </div>

            {/* Existing Other Docs */}
            {otherDocs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {otherDocs.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={15} className="text-[#0A4DA6] shrink-0" />
                      <span className="font-bold text-[#0F172A] truncate">{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewFile(doc.imageUrl)}
                        className="p-1 text-[#0A4DA6] hover:bg-blue-50 rounded"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveOtherDoc(idx)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Other Doc Input & Upload */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                placeholder="Document label (e.g., Electricity Bill, Ashram Map)"
                value={newOtherDocName}
                onChange={(e) => setNewOtherDocName(e.target.value)}
                className="w-full sm:flex-1 min-h-[40px] px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20"
              />
              <label className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold cursor-pointer transition-colors shrink-0">
                <Upload size={14} />
                <span>Upload File</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleAddOtherDoc(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          </div>


          {/* Modal Actions Footer */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-extrabold border border-[#E2E8F0] text-[#64748B] hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-full text-xs font-extrabold bg-[#0A4DA6] hover:bg-[#083D85] text-white shadow-md shadow-[#0A4DA6]/20 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isSaving ? 'Saving Documents...' : 'Save & Submit Checklist'}
            </button>
          </div>

        </form>
      </div>

      {/* QUICK FULLSCREEN PREVIEW LIGHTBOX */}
      {previewFile && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[85vh] bg-white rounded-2xl p-2 shadow-2xl overflow-hidden">
            <button
              onClick={() => setPreviewFile(null)}
              className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black text-white rounded-full transition-colors z-10"
            >
              <X size={18} />
            </button>
            {previewFile.startsWith('data:application/pdf') || previewFile.endsWith('.pdf') ? (
              <iframe src={previewFile} title="PDF Preview" className="w-[80vw] h-[75vh] max-w-4xl" />
            ) : (
              <img src={previewFile} alt="Preview" className="max-h-[80vh] max-w-full object-contain rounded-xl" />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
