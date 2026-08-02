import React, { useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { UserMemoryProvider } from "./contexts/UserMemoryContext";
import { BookingSearchProvider } from "./contexts/BookingSearchContext";

// Layouts (eager — always needed)
import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import PageLoader from "./components/PageLoader";
import AuthReturnRestorer from "./components/AuthReturnRestorer";

// Pages (lazy — code-split so each route loads its own chunk)
const HomePage = lazy(() => import("./pages/HomePage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const AshramDetailPage = lazy(() => import("./pages/AshramDetailPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
// Company
const AboutPage = lazy(() => import("./pages/AboutPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const PartnerPage = lazy(() => import("./pages/PartnerPage"));
const PressPage = lazy(() => import("./pages/PressPage"));
// Support
const HelpCenterPage = lazy(() => import("./pages/HelpCenterPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
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
} from "./pages/StaticPages";
const SupportTicketsPage = lazy(() => import("./pages/SupportTicketsPage"));
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"));
const ManageAshramsPage = lazy(() => import("./pages/ManageAshramsPage"));
const AddAshramWizardPage = lazy(() => import("./pages/AddAshramWizardPage"));
const ManageRoomsPage = lazy(() => import("./pages/ManageRoomsPage"));
const InventoryCalendarPage = lazy(
  () => import("./pages/InventoryCalendarPage"),
);
const OwnerVisitorArticlesPage = lazy(
  () => import("./admin/content/OwnerVisitorArticlesPage"),
);
const OwnerOffersPage = lazy(() => import("./pages/OwnerOffersPage"));
const OwnerAddOnsPage = lazy(() => import("./pages/owner/OwnerAddOnsPage"));
const OffersPage = lazy(() => import("./pages/OffersPage"));
const OfferDetailPage = lazy(() => import("./pages/OfferDetailPage"));
const MarketplaceCategoriesPage = lazy(
  () => import("./pages/MarketplaceCategoriesPage"),
);
const MarketplaceCategoryDetailPage = lazy(
  () => import("./pages/MarketplaceCategoryDetailPage"),
);
const StaffManagementPage = lazy(() => import("./pages/StaffManagementPage"));
const ReceptionCheckinPage = lazy(() => import("./pages/ReceptionCheckinPage"));
const HousekeepingPage = lazy(() => import("./pages/HousekeepingPage"));
const BannerBoyDashboard = lazy(() => import("./pages/BannerBoyDashboard"));
// Parking System — a self-contained module. Lazy-loaded so it ships as its own
// chunk and adds nothing to the initial bundle of any existing route.
const ParkingHubPage = lazy(
  () => import("./modules/parking/pages/ParkingHubPage"),
);
const ParkingDetailPage = lazy(
  () => import("./modules/parking/pages/ParkingDetailPage"),
);
const ParkingCheckoutPage = lazy(
  () => import("./modules/parking/pages/ParkingCheckoutPage"),
);
const ParkingBookingDetailPage = lazy(
  () => import("./modules/parking/pages/ParkingBookingDetailPage"),
);
const ParkingMyBookingsPage = lazy(
  () => import("./modules/parking/pages/ParkingMyBookingsPage"),
);
const ParkingGuardPanelPage = lazy(
  () => import("./modules/parking/pages/ParkingGuardPanelPage"),
);
const ParkingPartnerDashboardPage = lazy(
  () => import("./modules/parking/pages/ParkingPartnerDashboardPage"),
);

const AdminDashboard = lazy(
  () => import("./admin/dashboard/pages/AdminDashboard"),
);
const VerificationQueuePage = lazy(
  () => import("./admin/ashrams/pages/VerificationQueuePage"),
);
const UserManagementPage = lazy(
  () => import("./admin/users/pages/UserManagementPage"),
);
const AuditLogsPage = lazy(() => import("./admin/reports/pages/AuditLogsPage"));
const EnterpriseModulePage = lazy(
  () => import("./admin/shared/components/EnterpriseModulePage"),
);
const AdminPlatformSettingsPage = lazy(
  () => import("./pages/admin/AdminPlatformSettingsPage"),
);
const EnterpriseNotificationCenterPage = lazy(() =>
  import("./admin/notifications/pages/EnterpriseNotificationCenterPage").then(
    (m) => ({ default: m.EnterpriseNotificationCenterPage }),
  ),
);
const RoomCategoryApprovalsPage = lazy(
  () => import("./admin/approvals/pages/RoomCategoryApprovalsPage"),
);
const CentralApprovalCenterPage = lazy(
  () => import("./admin/approvals/pages/CentralApprovalCenterPage"),
);
const AdminMarketplaceProductsPage = lazy(
  () => import("./admin/marketplace/pages/AdminMarketplaceProductsPage"),
);

// Sacred Services Ecosystem & Media Hub Pages
const namedPage = <T extends Record<string, React.ComponentType<any>>>(
  loader: () => Promise<T>,
  name: keyof T,
) => lazy(() => loader().then((module) => ({ default: module[name] })));
const PilgrimageCircuitsPage = namedPage(
  () => import("./pages/PilgrimageCircuitsPage"),
  "PilgrimageCircuitsPage",
);
const PilgrimageCircuitDetailPage = namedPage(
  () => import("./pages/PilgrimageCircuitDetailPage"),
  "PilgrimageCircuitDetailPage",
);
const TemplesPage = namedPage(
  () => import("./pages/TemplesPage"),
  "TemplesPage",
);
const TempleDetailPage = namedPage(
  () => import("./pages/TempleDetailPage"),
  "TempleDetailPage",
);
const SacredDirectoryModulePage = namedPage(
  () => import("./pages/SacredDirectoryModulePage"),
  "SacredDirectoryModulePage",
);
const BlogListPage = namedPage(
  () => import("./pages/BlogListPage"),
  "BlogListPage",
);
const BlogDetailPage = namedPage(
  () => import("./pages/BlogDetailPage"),
  "BlogDetailPage",
);
const VideoDetailPage = namedPage(
  () => import("./pages/VideoDetailPage"),
  "VideoDetailPage",
);
const PilgrimagePlannerPage = namedPage(
  () => import("./pages/PilgrimagePlannerPage"),
  "PilgrimagePlannerPage",
);
const EventsFestivalsPage = lazy(() => import("./pages/EventsFestivalsPage"));
const LocalServicesHubPage = lazy(() => import("./pages/LocalServicesHubPage"));
const ServicesHubPage = lazy(() => import("./pages/ServicesHubPage"));
const MarketplaceHubPage = lazy(() => import("./pages/MarketplaceHubPage"));
const VolunteerHubPage = lazy(() => import("./pages/VolunteerHubPage"));
const VolunteerJobDetailPage = lazy(
  () => import("./pages/VolunteerJobDetailPage"),
);
const BookingDetailPage = lazy(
  () => import("./pages/profile/BookingDetailPage"),
);
const OwnerVolunteerPage = lazy(
  () => import("./pages/owner/OwnerVolunteerPage"),
);

// Customer Profile Pages
const ProfileMainPage = lazy(() => import("./pages/profile/ProfileMainPage"));

import { hasRoleAccess } from "./utils/roleRedirect";
import { setGuestPendingIntent } from "./utils/guestGate";

// Protected Route Wrapper Component
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    const attemptedUrl = location.pathname + location.search;
    setGuestPendingIntent({ type: "generic", returnUrl: attemptedUrl });
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(attemptedUrl)}`}
        replace
      />
    );
  }

  if (allowedRoles && !hasRoleAccess(user.role, allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Scroll to top on navigation or search query change
const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search]);

  return null;
};

const AppContent: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthReturnRestorer />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/ashram/:id" element={<AshramDetailPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            {/* Company */}
            <Route path="/about" element={<AboutPage />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/partner" element={<PartnerPage />} />
            <Route path="/press" element={<PressPage />} />
            {/* Support */}
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route
              path="/cancellation-policy"
              element={<CancellationPolicyPage />}
            />
            {/* Information */}
            <Route path="/govt-guidelines" element={<GovtGuidelinesPage />} />
            <Route path="/owner-guide" element={<OwnerGuidePage />} />
            <Route path="/stay-policies" element={<StayPoliciesPage />} />
            {/* Legal */}
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/refund-policy" element={<RefundPolicyPage />} />
            <Route path="/cookie-policy" element={<CookiePolicyPage />} />
            {/* Offers & Promotions Directory */}
            <Route path="/offers" element={<OffersPage />} />
            <Route path="/offers/:offerId" element={<OfferDetailPage />} />
            <Route path="/offers/category/:category" element={<OffersPage />} />
            <Route path="/offers/city/:city" element={<OffersPage />} />
            {/* Marketplace Directory & Dedicated Landing Pages */}
            <Route
              path="/marketplace/categories"
              element={<MarketplaceCategoriesPage />}
            />
            <Route
              path="/marketplace/category/:slug"
              element={<MarketplaceCategoryDetailPage />}
            />

            {/* Sacred Services Ecosystem Modules */}
            <Route
              path="/pilgrimage-circuits"
              element={<PilgrimageCircuitsPage />}
            />
            <Route
              path="/pilgrimage-circuits/:slug"
              element={<PilgrimageCircuitDetailPage />}
            />
            <Route path="/temples" element={<TemplesPage />} />
            <Route path="/temples/:slug" element={<TempleDetailPage />} />
            <Route path="/events" element={<EventsFestivalsPage />} />
            <Route path="/events/:slug" element={<EventsFestivalsPage />} />
            <Route
              path="/travel-guides"
              element={<SacredDirectoryModulePage />}
            />
            <Route
              path="/local-guides"
              element={<SacredDirectoryModulePage />}
            />
            <Route path="/transport" element={<SacredDirectoryModulePage />} />
            <Route
              path="/restaurants"
              element={<SacredDirectoryModulePage />}
            />
            <Route path="/shops" element={<SacredDirectoryModulePage />} />
            <Route path="/puja-items" element={<SacredDirectoryModulePage />} />
            <Route
              path="/religious-products"
              element={<SacredDirectoryModulePage />}
            />
            <Route path="/books" element={<SacredDirectoryModulePage />} />
            <Route
              path="/handicrafts"
              element={<SacredDirectoryModulePage />}
            />

            {/* Spiritual Media & Knowledge Hub Routes */}
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />
            <Route path="/video/:slug" element={<VideoDetailPage />} />

            {/* Dedicated Cards Routes */}
            <Route
              path="/destinations/planner"
              element={<PilgrimagePlannerPage />}
            />
            <Route path="/local" element={<LocalServicesHubPage />} />
            <Route path="/services" element={<ServicesHubPage />} />
            <Route path="/marketplace" element={<MarketplaceHubPage />} />
            <Route path="/volunteer" element={<VolunteerHubPage />} />
            <Route
              path="/volunteer/:jobId"
              element={<VolunteerJobDetailPage />}
            />
            <Route
              path="/volunteer/job/:jobId"
              element={<VolunteerJobDetailPage />}
            />
            <Route path="/careers" element={<VolunteerHubPage />} />

            {/* ── Parking System (public discovery) ──
              Static segments are declared before the `/parking/:slug` catch-all
              so a listing slug can never shadow them. */}
            <Route path="/parking" element={<ParkingHubPage />} />
            <Route path="/parking/:slug" element={<ParkingDetailPage />} />

          </Route>

          {/* Customer account and booking data always require a live session. */}
          <Route
            element={
              <ProtectedRoute>
                <PublicLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/booking/:id" element={<BookingDetailPage />} />
            <Route
              path="/profile/bookings/:id"
              element={<BookingDetailPage />}
            />
            <Route path="/profile" element={<ProfileMainPage />} />
            <Route path="/profile/bookings" element={<ProfileMainPage />} />
            <Route path="/profile/history" element={<ProfileMainPage />} />
            <Route path="/profile/articles" element={<ProfileMainPage />} />
            <Route path="/profile/blogs" element={<ProfileMainPage />} />
            <Route path="/profile/wishlist" element={<ProfileMainPage />} />
            <Route path="/profile/coupons" element={<ProfileMainPage />} />
            <Route path="/profile/payments" element={<ProfileMainPage />} />
            <Route path="/profile/settings" element={<ProfileMainPage />} />
            <Route
              path="/profile/notifications"
              element={<ProfileMainPage />}
            />
            <Route
              path="/dashboard"
              element={<Navigate to="/profile" replace />}
            />
          </Route>

          {/* ── Parking System (authenticated) ──
            Only a signed-in session is required here, deliberately: parking
            roles are grants in the `parking_staff` collection, not values of
            `User.role`, so `allowedRoles` cannot express them. The real
            authorisation is the capability check the parking API performs on
            every request, and each panel renders an explicit "not assigned"
            state when the caller holds no grant. React Router ranks these
            static paths above `/parking/:slug`, so no listing slug can shadow
            them. */}
          <Route
            element={
              <ProtectedRoute>
                <PublicLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/parking/checkout" element={<ParkingCheckoutPage />} />
            <Route
              path="/parking/my-bookings"
              element={<ParkingMyBookingsPage />}
            />
            <Route
              path="/parking/booking/:id"
              element={<ParkingBookingDetailPage />}
            />
            <Route path="/parking/gate" element={<ParkingGuardPanelPage />} />
            <Route
              path="/parking/partner"
              element={<ParkingPartnerDashboardPage />}
            />
          </Route>

          {/* Property management. Staff portals are isolated below so a reception
            or housekeeping account cannot open owner administration pages. */}
          <Route
            element={
              <ProtectedRoute allowedRoles={["owner", "manager"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/owner/ashrams" element={<ManageAshramsPage />} />
            <Route path="/owner/add-ons" element={<OwnerAddOnsPage />} />
            <Route
              path="/admin/manage/ashrams/add-ons"
              element={<OwnerAddOnsPage />}
            />
            <Route path="/owner/rooms" element={<ManageRoomsPage />} />
            <Route path="/owner/calendar" element={<InventoryCalendarPage />} />
            <Route path="/owner/volunteer" element={<OwnerVolunteerPage />} />
            <Route
              path="/owner/articles"
              element={<OwnerVisitorArticlesPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["owner", "manager", "staff"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/owner/dashboard" element={<OwnerDashboard />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/owner/ashrams/add"
              element={<AddAshramWizardPage />}
            />
            <Route path="/owner/users" element={<StaffManagementPage />} />
            <Route path="/owner/staff" element={<StaffManagementPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["reception"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/staff/reception" element={<ReceptionCheckinPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["housekeeping"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/staff/housekeeping" element={<HousekeepingPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={["owner", "manager", "offer_manager"]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/owner/offers" element={<OwnerOffersPage />} />
          </Route>

          {/* BannerBoy CMS Portal using Shared Enterprise DashboardLayout */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "banner_manager",
                  "content_manager",
                  "super_admin",
                ]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/bannerboy/dashboard"
              element={<BannerBoyDashboard />}
            />
          </Route>

          {/* Support Tickets shared across Roles */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "customer",
                  "owner",
                  "manager",
                  "support",
                  "super_admin",
                ]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/support" element={<SupportTicketsPage />} />
          </Route>

          {/* Jurisdiction-scoped verification roles */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "inspector",
                  "district_officer",
                  "state_admin",
                  "govt_admin",
                  "government_admin",
                  "national_admin",
                  "super_admin",
                ]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route
              path="/admin/verifications"
              element={<VerificationQueuePage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={["govt_admin", "government_admin", "super_admin"]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/users" element={<UserManagementPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            <Route
              path="/admin/settings/pricing"
              element={<AdminPlatformSettingsPage />}
            />
            <Route
              path="/admin/manage/platform-settings"
              element={<AdminPlatformSettingsPage />}
            />
            <Route
              path="/admin/enterprise-notifications/:subSection?"
              element={<EnterpriseNotificationCenterPage />}
            />
            <Route
              path="/admin/approvals/room-categories"
              element={<RoomCategoryApprovalsPage />}
            />
            <Route
              path="/admin/approvals/:moduleType?"
              element={<CentralApprovalCenterPage />}
            />
            <Route
              path="/admin/manage/:moduleKey/:subKey?"
              element={<EnterpriseModulePage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={["marketplace_manager", "super_admin"]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/admin/manage/marketplace/products"
              element={<AdminMarketplaceProductsPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "blog_manager",
                  "content_manager",
                  "super_admin",
                ]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/admin/manage/blogs/:subKey?"
              element={<EnterpriseModulePage moduleName="blogs" />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "local_manager",
                  "service_manager",
                  "super_admin",
                ]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/admin/manage/local/:subKey?"
              element={<EnterpriseModulePage moduleName="local" />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["finance_manager", "super_admin"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/admin/manage/bookings/:subKey?"
              element={<EnterpriseModulePage moduleName="bookings" />}
            />
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
        <UserMemoryProvider>
          <BookingSearchProvider>
            <AppContent />
          </BookingSearchProvider>
        </UserMemoryProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
