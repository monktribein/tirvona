// Parking System — module public surface.
//
// Everything the rest of the app may import from this module is re-exported
// here. App.tsx imports pages from this barrel; nothing else outside
// src/modules/parking reaches into its internals.

// Types
export type * from "./types/parking.types";

// Services
export {
  parkingDiscoveryService,
  parkingBookingService,
  parkingScanService,
  parkingPartnerService,
  parkingAdminService,
} from "./services/parking.service";

// Utilities
export * from "./utils/parkingFormat";

// Components
export { default as ParkingCard } from "./components/ParkingCard";
export { default as ParkingStatusBadge } from "./components/ParkingStatusBadge";
export { default as ParkingAmenityList } from "./components/ParkingAmenityList";
export { default as ParkingQrTicket } from "./components/ParkingQrTicket";
export { default as ParkingSearchBar } from "./components/ParkingSearchBar";
export { default as ParkingFilterPanel } from "./components/ParkingFilterPanel";
export { default as ParkingStatTile } from "./components/ParkingStatTile";
export { default as VehicleTypePicker } from "./components/VehicleTypePicker";

// Pages
export { default as ParkingHubPage } from "./pages/ParkingHubPage";
export { default as ParkingDetailPage } from "./pages/ParkingDetailPage";
export { default as ParkingCheckoutPage } from "./pages/ParkingCheckoutPage";
export { default as ParkingBookingDetailPage } from "./pages/ParkingBookingDetailPage";
export { default as ParkingMyBookingsPage } from "./pages/ParkingMyBookingsPage";
export { default as ParkingGuardPanelPage } from "./pages/ParkingGuardPanelPage";
export { default as ParkingPartnerDashboardPage } from "./pages/ParkingPartnerDashboardPage";
