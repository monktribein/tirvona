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
import { CartProvider } from "./contexts/CartContext";
import { ToastProvider } from "./contexts/ToastContext";
import { CurrencyProvider, useCurrency } from "./contexts/CurrencyContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { installAutomaticTextCase } from "./utils/textCase";

import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import PageLoader from "./components/PageLoader";
import AuthReturnRestorer from "./components/AuthReturnRestorer";

const HomePage = lazy(() => import("./pages/HomePage"));
const BannerDetailPage = lazy(() => import("./pages/BannerDetailPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const AshramDetailPage = lazy(() => import("./pages/AshramDetailPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const PartnerPage = lazy(() => import("./pages/PartnerPage"));
const PressPage = lazy(() => import("./pages/PressPage"));
const HelpCenterPage = lazy(() => import("./pages/HelpCenterPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
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
const OwnerAddOnsPage = lazy(() => import("./pages/owner/OwnerAddOnsPage"));
const OwnerBookingCenterPage = lazy(
  () => import("./pages/OwnerBookingCenterPage"),
);
const PayoutManagementPage = lazy(
  () => import("./admin/payouts/PayoutManagementPage"),
);
const OwnerParkingSetupPage = lazy(
  () => import("./pages/owner/OwnerParkingSetupPage"),
);
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const SelfBookingPage = lazy(
  () => import("./pages/owner/SelfBookingPage"),
);
const OfflineInventoryPage = lazy(
  () => import("./pages/owner/OfflineInventoryPage"),
);
const OffersPage = lazy(() => import("./pages/OffersPage"));
const OfferDetailPage = lazy(() => import("./pages/OfferDetailPage"));
const MarketplaceCategoriesPage = lazy(
  () => import("./pages/MarketplaceCategoriesPage"),
);
const MarketplaceCategoryDetailPage = lazy(
  () => import("./pages/MarketplaceCategoryDetailPage"),
);
const StaffManagementPage = lazy(() => import("./pages/StaffManagementPage"));
const OwnerGuestsPage = lazy(() => import("./pages/OwnerGuestsPage"));
const ReceptionCheckinPage = lazy(() => import("./pages/ReceptionCheckinPage"));
const HousekeepingPage = lazy(() => import("./pages/HousekeepingPage"));
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
const AartiHubPage = lazy(() => import("./modules/aarti/pages/AartiHubPage"));
const AartiDetailPage = lazy(
  () => import("./modules/aarti/pages/AartiDetailPage"),
);
const AartiCheckoutPage = lazy(
  () => import("./modules/aarti/pages/AartiCheckoutPage"),
);
const AartiBookingDetailPage = lazy(
  () => import("./modules/aarti/pages/AartiBookingDetailPage"),
);
const AartiMyBookingsPage = lazy(
  () => import("./modules/aarti/pages/AartiMyBookingsPage"),
);
const AartiGatePage = lazy(() => import("./modules/aarti/pages/AartiGatePage"));
const LivePoojaPage = lazy(
  () => import("./modules/aarti/pages/LivePoojaPage"),
);
const OwnerAartiSessionsPage = lazy(
  () => import("./modules/aarti/pages/OwnerAartiSessionsPage"),
);
const OwnerLivePoojaPage = lazy(
  () => import("./modules/aarti/pages/OwnerLivePoojaPage"),
);
const OwnerAartiBookingsPage = lazy(
  () => import("./modules/aarti/pages/OwnerAartiBookingsPage"),
);
const AartiControlCenterPage = lazy(
  () => import("./admin/aarti/pages/AartiControlCenterPage"),
);
const AartiApprovalsPage = lazy(
  () => import("./admin/aarti/pages/AartiApprovalsPage"),
);
const ParkingPartnerDashboardPage = lazy(
  () => import("./modules/parking/pages/ParkingPartnerDashboardPage"),
);
const ParkingRoleDashboardPage = lazy(
  () => import("./modules/parking/pages/ParkingRoleDashboardPage"),
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
const AdminOffersPage = lazy(
  () => import("./admin/offers/AdminOffersPage"),
);
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
const ParkingControlCenterPage = lazy(
  () => import("./admin/parking/pages/ParkingControlCenterPage"),
);
const ParkingStaffRolesPage = lazy(
  () => import("./admin/parking/pages/ParkingStaffRolesPage"),
);
const RefundRequestsPage = lazy(
  () => import("./admin/refunds/pages/RefundRequestsPage"),
);
const RefundRequestDetailPage = lazy(
  () => import("./admin/refunds/pages/RefundRequestDetailPage"),
);
const RefundPoliciesPage = lazy(
  () => import("./admin/refunds/pages/RefundPoliciesPage"),
);

const LeadCollectionPage = lazy(
  () => import("./admin/leads/pages/LeadCollectionPage"),
);
const LeadAgentsPage = lazy(() => import("./admin/leads/pages/LeadAgentsPage"));

const SmartContactProfilesPage = lazy(
  () => import("./admin/smart-contact/pages/SmartContactProfilesPage"),
);
const SmartContactProfileDetailPage = lazy(
  () => import("./admin/smart-contact/pages/SmartContactProfileDetailPage"),
);
const SmartContactAnalyticsPage = lazy(
  () => import("./admin/smart-contact/pages/SmartContactAnalyticsPage"),
);

const namedPage = <T extends Record<string, React.ComponentType<any>>>(
  loader: () => Promise<T>,
  name: keyof T,
) => lazy(() => loader().then((module) => ({ default: module[name] })));
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
const EventsHubPage = lazy(
  () => import("./modules/events/pages/EventsHubPage"),
);
const EventDetailPage = lazy(
  () => import("./modules/events/pages/EventDetailPage"),
);
const EventMyPassesPage = lazy(
  () => import("./modules/events/pages/EventMyPassesPage"),
);
const EventPassPage = lazy(
  () => import("./modules/events/pages/EventPassPage"),
);
const EventGatePage = lazy(
  () => import("./modules/events/pages/EventGatePage"),
);
const OwnerEventsPage = lazy(
  () => import("./modules/events/pages/OwnerEventsPage"),
);
const OwnerEventRegistrationsPage = lazy(
  () => import("./modules/events/pages/OwnerEventRegistrationsPage"),
);
const EventControlCenterPage = lazy(
  () => import("./admin/events/pages/EventControlCenterPage"),
);
const EventApprovalsPage = lazy(
  () => import("./admin/events/pages/EventApprovalsPage"),
);
const CircuitsHubPage = lazy(
  () => import("./modules/pilgrimage/pages/CircuitsHubPage"),
);
const CircuitDetailPage = lazy(
  () => import("./modules/pilgrimage/pages/CircuitDetailPage"),
);
const ItineraryPlannerPage = lazy(
  () => import("./modules/pilgrimage/pages/ItineraryPlannerPage"),
);
const OwnerCircuitsPage = lazy(
  () => import("./modules/pilgrimage/pages/OwnerCircuitsPage"),
);
const CircuitControlCenterPage = lazy(
  () => import("./admin/pilgrimage/pages/CircuitControlCenterPage"),
);
const CircuitApprovalsPage = lazy(
  () => import("./admin/pilgrimage/pages/CircuitApprovalsPage"),
);
const LocalServicesHubPage = lazy(() => import("./pages/LocalServicesHubPage"));
const ServicesHubPage = lazy(() => import("./pages/ServicesHubPage"));
const MarketplaceHubPage = lazy(() => import("./pages/MarketplaceHubPage"));
const MarketplaceProductDetailPage = lazy(
  () => import("./pages/MarketplaceProductDetailPage"),
);
const MarketplaceCheckoutPage = lazy(
  () => import("./pages/MarketplaceCheckoutPage"),
);
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

const ProfileMainPage = lazy(() => import("./pages/profile/ProfileMainPage"));

import {
  getRoleDefaultDashboard,
  hasRoleAccess,
} from "./utils/roleRedirect";
import { setGuestPendingIntent } from "./utils/guestGate";
import { smoothScrollEngine } from "./utils/smoothScroll";

const RoleAwareHome: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <HomePage />;

  const dashboard = getRoleDefaultDashboard(
    user.role,
    user.parkingRoles,
    user.email,
  );

  return dashboard === "/profile" ? (
    <HomePage />
  ) : (
    <Navigate to={dashboard} replace />
  );
};

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
    return (
      <Navigate
        to={getRoleDefaultDashboard(
          user.role,
          user.parkingRoles,
          user.email,
        )}
        replace
      />
    );
  }

  return <>{children}</>;
};

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
  useCurrency();
  useLanguage();
  useEffect(() => {
    smoothScrollEngine.init();
    const removeAutomaticTextCase = installAutomaticTextCase();
    return () => {
      removeAutomaticTextCase();
      smoothScrollEngine.destroy();
    };
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthReturnRestorer />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<RoleAwareHome />} />
            <Route path="/public" element={<HomePage />} />
            <Route path="/featured-banner/:bannerSlug" element={<BannerDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            {/* canonical, id-free */}
            {/* city listing: /ashrams/haridwar */}
            <Route path="/ashrams" element={<SearchPage />} />
            <Route path="/ashrams/:city" element={<SearchPage />} />
            <Route path="/ashrams/:city/:ashramSlug" element={<AshramDetailPage />} />
            <Route path="/ashrams/:city/:ashramSlug/book" element={<AshramDetailPage />} />
            {/* legacy: nginx 301s these in production; kept so dev and any
                missed link still resolve instead of 404ing */}
            <Route path="/ashram/:id" element={<AshramDetailPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/reset-password/:token"
              element={<ResetPasswordPage />}
            />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/partner" element={<PartnerPage />} />
            <Route path="/press" element={<PressPage />} />
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route
              path="/cancellation-policy"
              element={<CancellationPolicyPage />}
            />
            <Route path="/govt-guidelines" element={<GovtGuidelinesPage />} />
            <Route path="/owner-guide" element={<OwnerGuidePage />} />
            <Route path="/stay-policies" element={<StayPoliciesPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/refund-policy" element={<RefundPolicyPage />} />
            <Route path="/cookie-policy" element={<CookiePolicyPage />} />
            <Route path="/offers" element={<OffersPage />} />
            <Route path="/offers/:promoCode" element={<OfferDetailPage />} />
            <Route path="/offers/category/:category" element={<OffersPage />} />
            <Route path="/offers/city/:city" element={<OffersPage />} />
            <Route
              path="/marketplace/categories"
              element={<MarketplaceCategoriesPage />}
            />
            <Route
              path="/marketplace/products/:productSlug"
              element={<MarketplaceProductDetailPage />}
            />
            {/* legacy; nginx 301s these in production */}
            <Route
              path="/marketplace/product/:idOrSlug"
              element={<MarketplaceProductDetailPage />}
            />
            <Route
              path="/marketplace/category/:slug"
              element={<MarketplaceCategoryDetailPage />}
            />

            <Route
              path="/pilgrimage-circuits"
              element={<CircuitsHubPage />}
            />
            <Route
              path="/pilgrimage-circuits/:slug"
              element={<CircuitDetailPage />}
            />
            <Route path="/circuits" element={<CircuitsHubPage />} />
            <Route
              path="/circuits/:slug"
              element={<CircuitDetailPage />}
            />
            <Route path="/destinations" element={<CircuitsHubPage />} />
            <Route
              path="/destinations/:city"
              element={<CircuitDetailPage />}
            />
            <Route path="/temples" element={<TemplesPage />} />
            <Route path="/temples/:slug" element={<TempleDetailPage />} />
            <Route path="/events" element={<EventsHubPage />} />
            <Route path="/events/:idOrSlug" element={<EventDetailPage />} />
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

            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />
            <Route path="/video/:slug" element={<VideoDetailPage />} />

            <Route
              path="/destinations/planner"
              element={<ItineraryPlannerPage />}
            />
            <Route path="/local" element={<LocalServicesHubPage />} />
            <Route path="/services" element={<ServicesHubPage />} />
            <Route path="/marketplace" element={<MarketplaceHubPage />} />
            <Route path="/volunteer" element={<VolunteerHubPage />} />
            <Route
              path="/volunteer/:jobSlug"
              element={<VolunteerJobDetailPage />}
            />
            <Route
              path="/volunteer/job/:jobId"
              element={<VolunteerJobDetailPage />}
            />
            <Route path="/careers" element={<VolunteerHubPage />} />

            <Route path="/parking" element={<ParkingHubPage />} />
            <Route
              path="/parking/:city/:ashramSlug"
              element={<ParkingDetailPage />}
            />
            <Route path="/parking/:slug" element={<ParkingDetailPage />} />

            <Route path="/aarti" element={<AartiHubPage />} />
            <Route path="/live-pooja" element={<LivePoojaPage />} />
            <Route
              path="/aarti/:city/:ashramSlug"
              element={<AartiDetailPage />}
            />
            <Route
              path="/pooja/:city/:ashramSlug"
              element={<AartiDetailPage />}
            />
            {/* legacy; nginx 301s these in production */}
            <Route path="/aarti/:id" element={<AartiDetailPage />} />

          </Route>

          <Route
            element={
              <ProtectedRoute>
                <PublicLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/booking/:bookingReference"
              element={<BookingDetailPage />}
            />
            <Route
              path="/profile/bookings/:bookingReference"
              element={<BookingDetailPage />}
            />
            <Route
              path="/marketplace/checkout"
              element={<MarketplaceCheckoutPage />}
            />
            <Route path="/profile" element={<ProfileMainPage />} />
            <Route path="/profile/bookings" element={<ProfileMainPage />} />
            <Route path="/profile/history" element={<ProfileMainPage />} />
            <Route path="/profile/volunteer" element={<ProfileMainPage />} />
            <Route path="/profile/articles" element={<ProfileMainPage />} />
            <Route path="/profile/blogs" element={<ProfileMainPage />} />
            <Route path="/profile/orders" element={<ProfileMainPage />} />
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

          <Route
            element={
              <ProtectedRoute>
                <PublicLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/parking/checkout" element={<ParkingCheckoutPage />} />
            <Route
              path="/parking/booking/:bookingReference"
              element={<ParkingBookingDetailPage />}
            />
            <Route path="/aarti/checkout" element={<AartiCheckoutPage />} />
            <Route
              path="/aarti/booking/:bookingReference"
              element={<AartiBookingDetailPage />}
            />
            <Route path="/profile/aarti" element={<AartiMyBookingsPage />} />
            <Route path="/profile/events" element={<EventMyPassesPage />} />
            <Route path="/events/pass/:passCode" element={<EventPassPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/parking/dashboard" element={<ParkingRoleDashboardPage />} />
            <Route path="/parking/staff" element={<ParkingStaffRolesPage />} />
            <Route
              path="/admin/parking/dashboard"
              element={<ParkingRoleDashboardPage />}
            />
            <Route path="/parking/gate" element={<ParkingGuardPanelPage />} />
            <Route
              path="/parking/partner"
              element={<ParkingPartnerDashboardPage />}
            />
            <Route
              path="/parking/my-bookings"
              element={<ParkingMyBookingsPage />}
            />
            <Route path="/aarti/gate" element={<AartiGatePage />} />
            <Route path="/events/gate" element={<EventGatePage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["ashram_owner", "ashram_admin", "owner", "stay_admin", "manager"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/owner/ashrams" element={<ManageAshramsPage />} />
            <Route path="/ashram-admin/ashrams" element={<ManageAshramsPage />} />
            <Route path="/ashram-owner/ashrams" element={<ManageAshramsPage />} />
            <Route path="/owner/add-ons" element={<OwnerAddOnsPage />} />
            <Route path="/ashram-admin/add-ons" element={<OwnerAddOnsPage />} />
            <Route path="/ashram-owner/add-ons" element={<OwnerAddOnsPage />} />
            <Route
              path="/admin/manage/ashrams/add-ons"
              element={<OwnerAddOnsPage />}
            />
            <Route path="/owner/rooms" element={<ManageRoomsPage />} />
            <Route path="/ashram-admin/rooms" element={<ManageRoomsPage />} />
            <Route path="/ashram-owner/rooms" element={<ManageRoomsPage />} />
            <Route path="/owner/calendar" element={<InventoryCalendarPage />} />
            <Route path="/ashram-admin/calendar" element={<InventoryCalendarPage />} />
            <Route path="/ashram-owner/calendar" element={<InventoryCalendarPage />} />
            <Route path="/owner/check-in-out" element={<ReceptionCheckinPage />} />
            <Route path="/ashram-admin/check-in-out" element={<ReceptionCheckinPage />} />
            <Route path="/ashram-owner/check-in-out" element={<ReceptionCheckinPage />} />
            <Route path="/owner/parking/staff" element={<ParkingStaffRolesPage />} />
            <Route path="/ashram-admin/parking/staff" element={<ParkingStaffRolesPage />} />
            <Route path="/ashram-owner/parking/staff" element={<ParkingStaffRolesPage />} />
            <Route path="/owner/volunteer" element={<OwnerVolunteerPage />} />
            <Route path="/ashram-admin/volunteer" element={<OwnerVolunteerPage />} />
            <Route path="/ashram-owner/volunteer" element={<OwnerVolunteerPage />} />
            <Route
              path="/owner/articles"
              element={<OwnerVisitorArticlesPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["ashram_owner", "ashram_admin", "owner", "stay_admin", "manager", "staff"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/owner/dashboard" element={<OwnerDashboard />} />
            <Route path="/ashram-admin/dashboard" element={<OwnerDashboard />} />
            <Route path="/ashram-owner/dashboard" element={<OwnerDashboard />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["ashram_owner", "ashram_admin", "owner", "stay_admin"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/owner/ashrams/add"
              element={<AddAshramWizardPage />}
            />
            <Route path="/ashram-admin/ashrams/add" element={<AddAshramWizardPage />} />
            <Route path="/ashram-owner/ashrams/add" element={<AddAshramWizardPage />} />
            <Route path="/owner/users" element={<OwnerGuestsPage />} />
            <Route path="/ashram-admin/users" element={<OwnerGuestsPage />} />
            <Route path="/ashram-owner/users" element={<OwnerGuestsPage />} />
            <Route path="/owner/staff" element={<StaffManagementPage />} />
            <Route path="/ashram-admin/staff" element={<StaffManagementPage />} />
            <Route path="/ashram-owner/staff" element={<StaffManagementPage />} />
            <Route
              path="/owner/bookings"
              element={
                <OwnerBookingCenterPage key="owner-bookings" initialView="bookings" />
              }
            />
            <Route
              path="/owner/payments"
              element={
                <OwnerBookingCenterPage key="owner-payments" initialView="payments" />
              }
            />
            <Route path="/ashram-admin/bookings" element={<OwnerBookingCenterPage key="ashram-admin-bookings" initialView="bookings" />} />
            <Route path="/ashram-owner/bookings" element={<OwnerBookingCenterPage key="ashram-owner-bookings" initialView="bookings" />} />
            <Route path="/ashram-admin/payments" element={<OwnerBookingCenterPage key="ashram-admin-payments" initialView="payments" />} />
            <Route path="/ashram-owner/payments" element={<OwnerBookingCenterPage key="ashram-owner-payments" initialView="payments" />} />
            <Route path="/owner/payouts" element={<PayoutManagementPage />} />
            <Route path="/ashram-admin/payouts" element={<PayoutManagementPage />} />
            <Route path="/ashram-owner/payouts" element={<PayoutManagementPage />} />
            <Route path="/owner/offline-inventory" element={<OfflineInventoryPage />} />
            <Route path="/ashram-admin/offline-inventory" element={<OfflineInventoryPage />} />
            <Route path="/ashram-owner/offline-inventory" element={<OfflineInventoryPage />} />
            <Route path="/owner/self-booking" element={<SelfBookingPage />} />
            <Route path="/ashram-admin/self-booking" element={<SelfBookingPage />} />
            <Route path="/ashram-owner/self-booking" element={<SelfBookingPage />} />
            <Route path="/owner/tirvona-booking" element={<SelfBookingPage />} />
            <Route path="/ashram-admin/tirvona-booking" element={<SelfBookingPage />} />
            <Route path="/ashram-owner/tirvona-booking" element={<SelfBookingPage />} />
            {/* previous paths kept so existing links keep working */}
            <Route path="/owner/walk-in-booking" element={<SelfBookingPage />} />
            <Route path="/ashram-admin/walk-in-booking" element={<SelfBookingPage />} />
            <Route path="/ashram-owner/walk-in-booking" element={<SelfBookingPage />} />
            <Route
              path="/owner/parking"
              element={<OwnerParkingSetupPage />}
            />
            <Route path="/ashram-admin/parking" element={<OwnerParkingSetupPage />} />
            <Route path="/ashram-owner/parking" element={<OwnerParkingSetupPage />} />
            <Route path="/owner/aarti" element={<OwnerAartiSessionsPage />} />
            <Route path="/ashram-admin/aarti" element={<OwnerAartiSessionsPage />} />
            <Route path="/ashram-owner/aarti" element={<OwnerAartiSessionsPage />} />
            <Route path="/owner/aarti/bookings" element={<OwnerAartiBookingsPage />} />
            <Route
              path="/ashram-admin/aarti/bookings"
              element={<OwnerAartiBookingsPage />}
            />
            <Route
              path="/ashram-owner/aarti/bookings"
              element={<OwnerAartiBookingsPage />}
            />
            <Route path="/owner/live-pooja" element={<OwnerLivePoojaPage />} />
            <Route path="/ashram-admin/live-pooja" element={<OwnerLivePoojaPage />} />
            <Route path="/ashram-owner/live-pooja" element={<OwnerLivePoojaPage />} />
            <Route path="/owner/events" element={<OwnerEventsPage />} />
            <Route path="/ashram-admin/events" element={<OwnerEventsPage />} />
            <Route path="/ashram-owner/events" element={<OwnerEventsPage />} />
            <Route
              path="/owner/events/registrations"
              element={<OwnerEventRegistrationsPage />}
            />
            <Route
              path="/ashram-admin/events/registrations"
              element={<OwnerEventRegistrationsPage />}
            />
            <Route
              path="/ashram-owner/events/registrations"
              element={<OwnerEventRegistrationsPage />}
            />
            <Route path="/owner/circuits" element={<OwnerCircuitsPage />} />
            <Route path="/ashram-admin/circuits" element={<OwnerCircuitsPage />} />
            <Route path="/ashram-owner/circuits" element={<OwnerCircuitsPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["reception"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/staff/reception" element={<ReceptionCheckinPage />} />
            <Route path="/staff/self-booking" element={<SelfBookingPage />} />
            <Route path="/staff/walk-in-booking" element={<SelfBookingPage />} />
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
                allowedRoles={["ashram_owner", "ashram_admin", "owner", "stay_admin", "manager", "offer_manager"]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/owner/offers" element={<AdminOffersPage />} />
            <Route path="/ashram-admin/offers" element={<AdminOffersPage />} />
            <Route path="/ashram-owner/offers" element={<AdminOffersPage />} />
          </Route>



          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "customer",
                  "ashram_owner",
                  "ashram_admin",
                  "stay_admin",
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
              path="/admin/offline-inventory"
              element={<OfflineInventoryPage />}
            />
            <Route path="/admin/payouts" element={<PayoutManagementPage />} />
            <Route
              path="/admin/lead-collection/leads"
              element={<LeadCollectionPage />}
            />
            <Route
              path="/admin/lead-collection/agents"
              element={<LeadAgentsPage />}
            />
            <Route
              path="/admin/smart-contacts"
              element={<SmartContactProfilesPage />}
            />
            <Route
              path="/admin/smart-contacts/analytics"
              element={<SmartContactAnalyticsPage />}
            />
            <Route
              path="/admin/smart-contacts/:id"
              element={<SmartContactProfileDetailPage />}
            />
            <Route
              path="/admin/refunds/policies"
              element={<RefundPoliciesPage />}
            />
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
              path="/admin/parking/control"
              element={<ParkingControlCenterPage />}
            />
            <Route
              path="/admin/parking/roles"
              element={<ParkingStaffRolesPage />}
            />
            <Route
              path="/admin/aarti/control"
              element={<AartiControlCenterPage />}
            />
            <Route
              path="/admin/aarti/approvals/:approvalType?"
              element={<AartiApprovalsPage />}
            />
            <Route
              path="/admin/aarti/bookings"
              element={<OwnerAartiBookingsPage />}
            />
            <Route
              path="/admin/live-pooja"
              element={<OwnerLivePoojaPage />}
            />
            <Route
              path="/admin/events/control"
              element={<EventControlCenterPage />}
            />
            <Route
              path="/admin/events/approvals"
              element={<EventApprovalsPage />}
            />
            <Route
              path="/admin/events/registrations"
              element={<OwnerEventRegistrationsPage />}
            />
            <Route
              path="/admin/circuits/control"
              element={<CircuitControlCenterPage />}
            />
            <Route
              path="/admin/circuits/approvals"
              element={<CircuitApprovalsPage />}
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
              path="/admin/manage/ashrams/add"
              element={<AddAshramWizardPage />}
            />
            <Route
              path="/admin/manage/ashrams/edit/:id"
              element={<AddAshramWizardPage />}
            />
            <Route
              path="/admin/manage/aarti_sessions/:subKey?"
              element={<OwnerAartiSessionsPage />}
            />
            <Route
              path="/admin/manage/aarti_streams/:subKey?"
              element={<OwnerLivePoojaPage />}
            />
            <Route
              path="/admin/bookings/front-desk"
              element={<ReceptionCheckinPage />}
            />
            <Route path="/admin/manage/users/pilgrims" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/manage/users/owners" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/manage/users/content-managers" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/manage/users/staff" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/manage/users/roles" element={<Navigate to="/admin/users" replace />} />
            <Route
              path="/admin/manage/:moduleKey/:subKey?"
              element={<EnterpriseModulePage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "super_admin",
                  "national_admin",
                  "finance_manager",
                  "support",
                ]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/refunds" element={<RefundRequestsPage />} />
            <Route
              path="/admin/refunds/:id"
              element={<RefundRequestDetailPage />}
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
                  "offer_manager",
                  "content_manager",
                  "super_admin",
                  "national_admin",
                ]}
              >
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/admin/manage/offers/:subKey?"
              element={<AdminOffersPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["super_admin", "national_admin"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/volunteer" element={<OwnerVolunteerPage />} />
            <Route
              path="/admin/articles"
              element={<OwnerVisitorArticlesPage />}
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

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <AuthProvider>
            <NotificationProvider>
              <UserMemoryProvider>
                <BookingSearchProvider>
                  <CartProvider>
                    <AppContent />
                  </CartProvider>
                </BookingSearchProvider>
              </UserMemoryProvider>
            </NotificationProvider>
          </AuthProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </ToastProvider>
  );
};

export default App;
