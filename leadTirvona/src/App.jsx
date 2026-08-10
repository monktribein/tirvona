/**
 * App.jsx — Clean Header & Footer Root
 */
import React, { useState } from 'react';
import AppNavbar from './components/AppNavbar';
import ToastNotification from './components/ToastNotification';
import CreateLeadPage from './pages/CreateLeadPage';
import LeadsDashboardPage from './pages/LeadsDashboardPage';
import ApprovedAshramsPage from './pages/ApprovedAshramsPage';
import { useLeadStorage } from './hooks/useLeadStorage';
import { useLeadAuth } from './hooks/useLeadAuth';

export default function App() {
  const [activePage, setActivePage] = useState('create');
  const { agent, isSignedIn, login, logout } = useLeadAuth();
  // The session drives the data source: signed in reads the API, signed out
  // falls back to the local demo set.
  const { leads, approvedAshrams, toast, addLead, approveLead, removeLead } =
    useLeadStorage(isSignedIn);

  const handlePageChange = (page) => {
    setActivePage(page);
    if (window.lenisInstance) {
      window.lenisInstance.scrollTo(0, { duration: 1.2 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]/70 font-sans antialiased selection:bg-[#0A4DA6]/10 selection:text-[#0A4DA6]">
      <AppNavbar
        activePage={activePage}
        setActivePage={handlePageChange}
        leadCount={leads.length}
        approvedCount={approvedAshrams.length}
        agent={agent}
        onLogin={login}
        onLogout={logout}
      />

      <main className="flex-1 transition-opacity duration-300 ease-in-out">
        {activePage === 'create' && (
          <CreateLeadPage
            onSubmitLead={addLead}
            onSuccessNavigate={() => handlePageChange('dashboard')}
          />
        )}
        {activePage === 'dashboard' && (
          <LeadsDashboardPage
            leads={leads}
            onApproveLead={approveLead}
            onDeleteLead={removeLead}
            onNavigateCreate={() => handlePageChange('create')}
          />
        )}
        {activePage === 'approved' && (
          <ApprovedAshramsPage
            approvedAshrams={approvedAshrams}
            onNavigateLeads={() => handlePageChange('dashboard')}
          />
        )}
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
