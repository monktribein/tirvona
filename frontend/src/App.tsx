import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Layouts (eager — always needed)
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Pages (lazy — code-split so each route loads its own chunk)
const HomePage = lazy(() => import('./pages/HomePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const AshramDetailPage = lazy(() => import('./pages/AshramDetailPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
// Company
const AboutPage = lazy(() => import('./pages/AboutPage'));
const CareersPage = lazy(() => import('./pages/CareersPage'));
const PartnerPage = lazy(() => import('./pages/PartnerPage'));
const PressPage = lazy(() => import('./pages/PressPage'));
// Support
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
// Static Policy + Info Pages (named exports → map to lazy default modules)
const CancellationPolicyPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.CancellationPolicyPage })));
const GovtGuidelinesPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.GovtGuidelinesPage })));
const OwnerGuidePage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.OwnerGuidePage })));
const StayPoliciesPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.StayPoliciesPage })));
const TermsPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.PrivacyPage })));
const RefundPolicyPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.RefundPolicyPage })));
const CookiePolicyPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.CookiePolicyPage })));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const SupportTicketsPage = lazy(() => import('./pages/SupportTicketsPage'));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'));
const ManageAshramsPage = lazy(() => import('./pages/ManageAshramsPage'));
const AddAshramWizardPage = lazy(() => import('./pages/AddAshramWizardPage'));
const ManageRoomsPage = lazy(() => import('./pages/ManageRoomsPage'));
const InventoryCalendarPage = lazy(() => import('./pages/InventoryCalendarPage'));
const OwnerUsersPage = lazy(() => import('./pages/OwnerUsersPage'));
const OwnerOffersPage = lazy(() => import('./pages/OwnerOffersPage'));
const ReceptionCheckinPage = lazy(() => import('./pages/ReceptionCheckinPage'));
const HousekeepingPage = lazy(() => import('./pages/HousekeepingPage'));
const StaffManagementPage = lazy(() => import('./pages/StaffManagementPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const VerificationQueuePage = lazy(() => import('./pages/VerificationQueuePage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));

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
      <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center font-bold text-sm text-gray-400">Loading…</div>}>
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
          <Route path="/owner/staff" element={<StaffManagementPage />} />
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
      </Suspense>
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
