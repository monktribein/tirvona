import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import AshramDetailPage from './pages/AshramDetailPage';
import FaqPage from './pages/FaqPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
// Company
import AboutPage from './pages/AboutPage';
import CareersPage from './pages/CareersPage';
import PartnerPage from './pages/PartnerPage';
import PressPage from './pages/PressPage';
// Support
import HelpCenterPage from './pages/HelpCenterPage';
import ContactPage from './pages/ContactPage';
// Static Policy + Info Pages
import {
  CancellationPolicyPage,
  GovtGuidelinesPage,
  OwnerGuidePage,
  StayPoliciesPage,
  TermsPage,
  PrivacyPage,
  RefundPolicyPage,
  CookiePolicyPage,
} from './pages/StaticPages';
import CustomerDashboard from './pages/CustomerDashboard';
import SupportTicketsPage from './pages/SupportTicketsPage';
import OwnerDashboard from './pages/OwnerDashboard';
import ManageAshramsPage from './pages/ManageAshramsPage';
import AddAshramWizardPage from './pages/AddAshramWizardPage';
import ManageRoomsPage from './pages/ManageRoomsPage';
import InventoryCalendarPage from './pages/InventoryCalendarPage';
import OwnerUsersPage from './pages/OwnerUsersPage';
import OwnerOffersPage from './pages/OwnerOffersPage';
import ReceptionCheckinPage from './pages/ReceptionCheckinPage';
import HousekeepingPage from './pages/HousekeepingPage';
import AdminDashboard from './pages/AdminDashboard';
import VerificationQueuePage from './pages/VerificationQueuePage';
import UserManagementPage from './pages/UserManagementPage';
import AuditLogsPage from './pages/AuditLogsPage';

// Protected Route Wrapper Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center font-bold">Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Scroll to top on navigation or search query change
const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search]);

  return null;
};

const AppContent: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/ashram/:id" element={<AshramDetailPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Company */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/partner" element={<PartnerPage />} />
          <Route path="/press" element={<PressPage />} />
          {/* Support */}
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/cancellation-policy" element={<CancellationPolicyPage />} />
          {/* Information */}
          <Route path="/govt-guidelines" element={<GovtGuidelinesPage />} />
          <Route path="/owner-guide" element={<OwnerGuidePage />} />
          <Route path="/stay-policies" element={<StayPoliciesPage />} />
          {/* Legal */}
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />
        </Route>

        {/* Authenticated Customer Routes */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<CustomerDashboard />} />
        </Route>

        {/* Unified Dashboard Routes for Owners & Staff */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['owner', 'manager', 'reception', 'housekeeping']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/owner/dashboard" element={<OwnerDashboard />} />
          <Route path="/owner/ashrams" element={<ManageAshramsPage />} />
          <Route path="/owner/ashrams/add" element={<AddAshramWizardPage />} />
          <Route path="/owner/rooms" element={<ManageRoomsPage />} />
          <Route path="/owner/calendar" element={<InventoryCalendarPage />} />
          <Route path="/owner/offers" element={<OwnerOffersPage />} />
          <Route path="/owner/users" element={<OwnerUsersPage />} />
          <Route path="/staff/reception" element={<ReceptionCheckinPage />} />
          <Route path="/staff/housekeeping" element={<HousekeepingPage />} />
        </Route>

        {/* Support Tickets shared across Roles */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['customer', 'owner', 'manager', 'support', 'super_admin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/support" element={<SupportTicketsPage />} />
        </Route>

        {/* Government Official & Super Admin Dashboard Routes */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['district_officer', 'govt_admin', 'super_admin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/verifications" element={<VerificationQueuePage />} />
          <Route path="/admin/users" element={<UserManagementPage />} />
          <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
