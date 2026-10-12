/**
 * Pandit / Acharya / Jyotishi module. Everything for this domain lives in this folder,
 * served by the main Tirvona app on tirvona.com (no separate app or subdomain):
 *
 *   provider/   the pandit's own console      /provider/dashboard, /provider/wallet, ...
 *   public/     devotee-facing pages          /pandits, /provider/:id
 *   admin/      Tirvona admin pages           /admin/pandits/*
 *   components/ shared pieces (consultation chat)
 *   services/   API client for /api/v2 (backend: Newbackend/src/modules/providers)
 *   types/      API types
 *   ui.tsx      the module's UI kit
 *
 * Pages are lazy-loaded by path in App.tsx; other parts of the app import from here.
 */
export type * from "./types/provider.types";

export {
  providerPublicService,
  providerSelfService,
  pujaBookingService,
  consultationService,
  verificationCaseService,
  providerAdminService,
  ritualAdminService,
  ritualCatalogService,
  providerWalletService,
  providerWalletAdminService,
} from "./services/provider.service";

export { ConsultationChatModal } from "./components/ConsultationChatModal";
export { StatusBadge, formatMinor } from "./ui";
