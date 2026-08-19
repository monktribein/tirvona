/**
 * App.jsx — Clean Header & Footer Root
 */
import React, { useState } from 'react';
import AppNavbar from './components/AppNavbar';
import ToastNotification from './components/ToastNotification';
import CreateLeadPage from './pages/CreateLeadPage';
import LeadsDashboardPage from './pages/LeadsDashboardPage';
import ApprovedAshramsPage from './pages/ApprovedAshramsPage';
import SupervisorDashboard from './pages/SupervisorDashboard';
import { useLeadStorage } from './hooks/useLeadStorage';
import { useLeadAuth } from './hooks/useLeadAuth';
import { leadApi } from './services/leadApi';
import { toApiLead } from './utils/leadPayload';

export default function App() {
  const [activePage, setActivePage] = useState('create');
  const [attendanceState, setAttendanceState] = useState(null);
  const { agent, checking, isSignedIn, login, logout } = useLeadAuth();
  // The session drives the data source: signed in reads the API, signed out
  // falls back to the local demo set.
  const {
    leads,
    approvedAshrams,
    toast,
    showToast,
    addLead,
    approveLead,
    removeLead,
    updateAppointment,
    refreshAll
  } = useLeadStorage(isSignedIn);

  const handlePageChange = (page) => {
    if (page !== 'create') {
      setEditingLeadData(null);
    }
    setActivePage(page);
    if (window.lenisInstance) {
      window.lenisInstance.scrollTo(0, { duration: 1.2 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogout = () => {
    logout();
    setAttendanceState(null);
  };

  const [supervisorMode, setSupervisorMode] = useState('console'); // 'console' | 'field_portal'
  const [editingLeadData, setEditingLeadData] = useState(null);

  const handleOpenFieldPortal = (lead = null) => {
    setEditingLeadData(lead);
    setSupervisorMode('field_portal');
    setActivePage('create');
  };

  const handleBackToConsole = () => {
    setSupervisorMode('console');
    setEditingLeadData(null);
  };

  const handleSaveLead = async (leadPayload, leadId = null) => {
    if (leadId) {
      try {
        const apiPayload = toApiLead(leadPayload);
        await leadApi.updateLead(leadId, apiPayload);
        await refreshAll();
        showToast('Lead verification and details updated!');
        setSupervisorMode('console');
        setEditingLeadData(null);
        return true;
      } catch (err) {
        console.error('Failed to update lead:', err);
        showToast(err?.message || 'Failed to update lead', 'error');
        return null;
      }
    }
    return addLead(leadPayload);
  };

  if (isSignedIn && agent?.role === 'field_supervisor' && supervisorMode === 'console') {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <SupervisorDashboard
          supervisor={agent}
          onLogout={handleLogout}
          onOpenFieldPortal={handleOpenFieldPortal}
        />
        <footer className="mt-auto text-center py-4 px-6 border-t border-[#E2E8F0] bg-white flex items-center justify-center">
          <a
            href="https://tirvona.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[#0B192C] hover:text-[#0A4DA6] transition-colors group"
          >
            <img
              src="/logo.png"
              alt="Tirvona Logo"
              className="h-6 w-auto object-contain group-hover:scale-105 transition-transform"
            />
            <span>Tirvona</span>
          </a>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]/70 font-sans antialiased selection:bg-[#0A4DA6]/10 selection:text-[#0A4DA6]">
      <AppNavbar
        activePage={activePage}
        setActivePage={handlePageChange}
        leadCount={isSignedIn ? leads.length : 0}
        approvedCount={isSignedIn ? approvedAshrams.length : 0}
        agent={agent}
        attendanceState={attendanceState}
        onAttendanceUpdated={setAttendanceState}
        onLogin={login}
        onLogout={handleLogout}
        onBackToSupervisorConsole={agent?.role === 'field_supervisor' ? handleBackToConsole : null}
      />

      <main className="flex-1 transition-opacity duration-300 ease-in-out">
        {checking ? (
          <div className="max-w-xl mx-auto my-20 p-8 text-center text-sm font-bold text-[#64748B]">
            Verifying field-agent access...
          </div>
        ) : !isSignedIn ? (
          <div className="max-w-xl mx-auto my-20 bg-white border border-[#E2E8F0] rounded-3xl p-8 text-center shadow-xs">
            <h1 className="text-xl font-extrabold text-[#0F172A]">Authorised agents only</h1>
            <p className="text-sm text-[#64748B] mt-2">
              Sign in with the phone number and password issued by a Tirvona Super Admin.
            </p>
          </div>
        ) : activePage === 'create' ? (
          <CreateLeadPage
            agentRole={agent?.role}
            onSubmitLead={handleSaveLead}
            onSuccessNavigate={() => {
              setEditingLeadData(null);
              if (agent?.role === 'field_supervisor') {
                handleBackToConsole();
              } else {
                handlePageChange('dashboard');
              }
            }}
            attendanceCoordinates={attendanceState?.checkInCoords}
            assignedJurisdiction={{
              state: agent?.state,
              district: agent?.district
            }}
            editingLead={editingLeadData}
            onBackToConsole={agent?.role === 'field_supervisor' ? handleBackToConsole : null}
          />
        ) : activePage === 'dashboard' ? (
          <LeadsDashboardPage
            agentRole={agent?.role}
            leads={leads}
            onApproveLead={approveLead}
            onDeleteLead={agent?.role === 'field_supervisor' ? removeLead : null}
            onNavigateCreate={() => handlePageChange('create')}
            onEditLead={(lead) => {
              setEditingLeadData(lead);
              handlePageChange('create');
            }}
            onUpdateAppointment={agent?.role !== 'field_agent' ? updateAppointment : null}
          />
        ) : activePage === 'approved' ? (
          <ApprovedAshramsPage
            approvedAshrams={approvedAshrams}
            onNavigateLeads={() => handlePageChange('dashboard')}
          />
        ) : null}
      </main>

      <ToastNotification toast={toast} />

      {/* Footer — Tirvona Logo + Link */}
      <footer className="mt-auto text-center py-4 px-6 border-t border-[#E2E8F0] bg-white flex items-center justify-center">
        <a
          href="https://tirvona.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#0B192C] hover:text-[#0A4DA6] transition-colors group"
        >
          <img
            src="/logo.png"
            alt="Tirvona Logo"
            className="h-6 w-auto object-contain group-hover:scale-105 transition-transform"
          />
          <span>Tirvona</span>
        </a>
      </footer>
    </div>
  );
}
