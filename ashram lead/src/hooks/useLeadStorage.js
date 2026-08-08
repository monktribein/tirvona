/**
 * useLeadStorage.js
 *
 * Responsibility: Custom React hook that manages all ashram lead and approved
 * ashram state. Acts as the single state bridge between localStorageService.js
 * and the UI pages.
 *
 * Exposes:
 *  - leads            → current field lead submissions from localStorage
 *  - approvedAshrams  → current Tirvona-converted approved entities
 *  - toast            → active toast notification message
 *  - addLead()        → submit a new field lead
 *  - approveLead()    → approve a pending lead and convert to ashram
 *  - deleteLead()     → remove a lead entry
 *  - resetToDemo()    → restore both lists to initial seed data
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getLeads,
  saveLead,
  updateLeadStatus,
  getApprovedAshrams,
  deleteLead as deleteLeadFromStorage,
  resetToInitialDemoData
} from '../utils/localStorageService';

export function useLeadStorage() {
  const [leads, setLeads] = useState([]);
  const [approvedAshrams, setApprovedAshrams] = useState([]);
  const [toast, setToast] = useState(null);

  const refreshAll = useCallback(() => {
    setLeads(getLeads());
    setApprovedAshrams(getApprovedAshrams());
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const addLead = (leadData) => {
    const created = saveLead(leadData);
    refreshAll();
    showToast(`Lead created for "${created.name}"`);
    return created;
  };

  const approveLead = (leadId) => {
    const updated = updateLeadStatus(leadId, 'approved');
    if (updated) {
      refreshAll();
      showToast(`"${updated.name}" approved and converted into Tirvona Ashram!`);
    }
  };

  const removeLead = (leadId) => {
    deleteLeadFromStorage(leadId);
    refreshAll();
    showToast('Lead entry removed');
  };

  const resetToDemo = () => {
    resetToInitialDemoData();
    refreshAll();
    showToast('Reset to initial demo data');
  };

  return {
    leads,
    approvedAshrams,
    toast,
    addLead,
    approveLead,
    removeLead,
    resetToDemo,
    refreshAll
  };
}
