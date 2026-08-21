import { useState, useEffect, useCallback } from 'react';
import { leadApi } from '../services/leadApi';
import { toApiLead, fromApiLead, toApprovedAshram } from '../utils/leadPayload';

export function useLeadStorage(isSignedIn = false) {
  const [leads, setLeads] = useState([]);
  const [approvedAshrams, setApprovedAshrams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const refreshAll = useCallback(async () => {
    if (!isSignedIn) {
      setLeads([]);
      setApprovedAshrams([]);
      return;
    }

    setLoading(true);
    try {
      const page = await leadApi.listMyLeads({ limit: 100 });
      const rows = page.items || [];
      setLeads(rows.map(fromApiLead));
      setApprovedAshrams(
        rows
          .filter((row) => row.status === 'approved' || row.status === 'converted')
          .map(toApprovedAshram)
      );
    } catch (error) {
      setLeads([]);
      setApprovedAshrams([]);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const addLead = async (leadData) => {
    if (!isSignedIn) {
      showToast('Sign in with a Super Admin-created account first.', 'error');
      return null;
    }

    try {
      const created = await leadApi.createLead(toApiLead(leadData));
      await refreshAll();
      showToast(`"${created.name}" submitted for Tirvona review`);
      return fromApiLead(created);
    } catch (error) {
      showToast(error.message, 'error');
      return null;
    }
  };

  const approveLead = async (leadId) => {
    if (isSignedIn) {
      showToast(
        'Approval is handled by the Tirvona admin team in the console.',
        'info'
      );
      return;
    }
    showToast('Sign in with an authorised account first.', 'error');
  };

  const removeLead = async (leadId) => {
    if (!isSignedIn) {
      showToast('Sign in with an authorised account first.', 'error');
      return;
    }

    try {
      await leadApi.deleteLead(leadId);
      await refreshAll();
      showToast('Lead deleted');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const updateAppointment = async (leadId, payload) => {
    if (!isSignedIn) {
      showToast('Sign in with an authorised account first.', 'error');
      return false;
    }

    try {
      const existingLead = leads.find((l) => (l.id || l._id) === leadId);
      const mergedLead = {
        ...(existingLead || {}),
        ...(payload || {}),
        meeting: payload?.meeting || payload || existingLead?.meeting
      };
      const apiPayload = toApiLead(mergedLead);
      await leadApi.updateLead(leadId, apiPayload);
      await refreshAll();
      showToast(
        apiPayload.meeting?.requested && apiPayload.meeting?.time
          ? 'Appointment scheduled successfully!'
          : 'Appointment updated.'
      );
      return true;
    } catch (error) {
      showToast(error.message || 'Failed to update appointment', 'error');
      return false;
    }
  };

  return {
    leads,
    approvedAshrams,
    loading,
    toast,
    showToast,
    addLead,
    approveLead,
    removeLead,
    updateAppointment,
    refreshAll
  };
}
