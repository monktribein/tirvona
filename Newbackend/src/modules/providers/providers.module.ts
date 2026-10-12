import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OrmModule } from "../../database/orm-nest";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { payoutConfig } from "../payouts/config/payout.config";
import { BankAccountCrypto } from "../payouts/infrastructure/bank-account.crypto";
import { UserSchema } from "../users/infrastructure/persistence/user.schema";
import { WalletModule } from "../wallet/wallet.module";
import { ProviderAuditService } from "./application/provider-audit.service";
import { ProviderAvailabilityService } from "./application/provider-availability.service";
import { ProviderBookingPaymentService } from "./application/provider-booking-payment.service";
import { ProviderBookingService } from "./application/provider-booking.service";
import { ProviderCalendarService } from "./application/provider-calendar.service";
import { ProviderConsultationService } from "./application/provider-consultation.service";
import { ProviderDiscoveryService } from "./application/provider-discovery.service";
import { ProviderIntegrityService } from "./application/provider-integrity.service";
import { ProviderMaintenanceService } from "./application/provider-maintenance.service";
import { ProviderOfferingService } from "./application/provider-offering.service";
import { ProviderProfileService } from "./application/provider-profile.service";
import { ProviderProjectionService } from "./application/provider-projection.service";
import { ProviderVerificationService } from "./application/provider-verification.service";
import { ProviderWalletService } from "./application/provider-wallet.service";
import { ProviderZoomService } from "./application/provider-zoom.service";
import { RitualCatalogService } from "./application/ritual-catalog.service";
import { IdempotencyInterceptor } from "./infrastructure/idempotency.interceptor";
import { PROVIDER_MODELS } from "./infrastructure/provider.schemas";
import { PROVIDER_WALLET_MODELS } from "./infrastructure/provider-wallet.schemas";
import { ProviderRequestContextInterceptor } from "./infrastructure/request-context";
import { ProviderBookingsController } from "./presentation/bookings.controller";
import { ConsultationsController } from "./presentation/consultations.controller";
import {
  AdminConsultationsController,
  AdminOfferingsController,
  AdminProviderBookingsController,
  AdminProvidersController,
  AdminRitualVariantsController,
  AdminRitualsController,
} from "./presentation/provider-admin.controller";
import { ProviderSelfController } from "./presentation/provider-self.controller";
import {
  AdminProviderWalletController,
  ProviderWalletController,
} from "./presentation/provider-wallet.controller";
import {
  ProvidersPublicController,
  RitualsPublicController,
} from "./presentation/providers-public.controller";
import { VerificationCasesController } from "./presentation/verification.controller";

/**
 * Pandit / Purohit / Acharya / Jyotishi provider domain (SRS M06, M07, M09,
 * M10, M12 subset, M18). See ./README.md for scope, contract decisions and
 * what is deliberately not here (quotes, payments, settlement).
 *
 * Reuses, without modifying: users/auth (global JWT + RolesGuard), audit_logs
 * (AuditModule), the in-app notification channel (NotificationsModule),
 * TransactionService (CommonModule) and the Postgres storage driver. Payments,
 * refunds, payouts and identity are NOT re-implemented: bookings keep opaque
 * payment references and expose state-transition hooks for those modules.
 */
@Module({
  imports: [
    AuditModule,
    NotificationsModule,
    WalletModule,
    OrmModule.forFeature(PROVIDER_MODELS),
    OrmModule.forFeature(PROVIDER_WALLET_MODELS),
    // The pandit's payout account number is sealed with the same key as ashram payout accounts.
    ConfigModule.forFeature(payoutConfig),
    // Admin onboarding looks an account up by id; the guard in OrmModule.forFeature makes a repeat registration of "User" safe.
    OrmModule.forFeature([{ name: "User", schema: UserSchema }]),
  ],
  controllers: [
    RitualsPublicController,
    ProvidersPublicController,
    ProviderSelfController,
    ProviderBookingsController,
    VerificationCasesController,
    ConsultationsController,
    AdminRitualsController,
    AdminRitualVariantsController,
    AdminProvidersController,
    AdminProviderBookingsController,
    AdminOfferingsController,
    AdminConsultationsController,
    ProviderWalletController,
    AdminProviderWalletController,
  ],
  providers: [
    ProviderRequestContextInterceptor,
    IdempotencyInterceptor,
    ProviderAuditService,
    ProviderProjectionService,
    ProviderCalendarService,
    RitualCatalogService,
    ProviderProfileService,
    ProviderOfferingService,
    ProviderAvailabilityService,
    ProviderVerificationService,
    ProviderDiscoveryService,
    ProviderBookingService,
    ProviderBookingPaymentService,
    ProviderConsultationService,
    ProviderZoomService,
    ProviderMaintenanceService,
    ProviderIntegrityService,
    ProviderWalletService,
    BankAccountCrypto,
  ],
  // Other modules (payments, support, ops tools) integrate through these, never through the models.
  exports: [
    ProviderBookingService,
    ProviderBookingPaymentService,
    ProviderProfileService,
    ProviderZoomService,
    ProviderWalletService,
  ],
})
export class ProvidersModule {}
