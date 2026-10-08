import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuditModule } from "../audit/audit.module";
import { WalletModule } from "../wallet/wallet.module";
import { MarketplaceAddressSchema } from "../commerce/infrastructure/persistence/marketplace-address.schemas";
import { payoutConfig } from "../payouts/config/payout.config";
import { BankAccountCrypto } from "../payouts/infrastructure/bank-account.crypto";
import { RazorpayXPayoutProvider } from "../payouts/providers/razorpayx-payout.provider";
import { CategoryService } from "./application/category.service";
import { DashboardService } from "./application/dashboard.service";
import { InventoryService } from "./application/inventory.service";
import { LedgerService } from "./application/ledger.service";
import { MarketplaceAuditService } from "./application/marketplace-audit.service";
import { MarketplaceSettingsService } from "./application/marketplace-settings.service";
import { OrderService } from "./application/order.service";
import { MARKETPLACE_PAYOUT_PROVIDER, PayoutService } from "./application/payout.service";
import { ProductService } from "./application/product.service";
import { ReviewService } from "./application/review.service";
import { VendorService } from "./application/vendor.service";
import { MARKETPLACE_MODELS } from "./infrastructure/marketplace.schemas";
import { MarketplaceAdminController } from "./presentation/marketplace-admin.controller";
import { MarketplaceCustomerController } from "./presentation/marketplace-customer.controller";
import { MarketplacePublicController } from "./presentation/marketplace-public.controller";
import { MarketplaceVendorController } from "./presentation/marketplace-vendor.controller";

/**
 * Multi-vendor marketplace. Lives entirely in this folder and reuses, without
 * modifying: users/auth (JWT + RolesGuard), audit_logs (AuditModule), the
 * customer address book (marketplace_addresses), Razorpay keys, and the
 * payouts module's bank-account encryption + RazorpayX provider.
 * See ./README.md.
 */
@Module({
  imports: [
    ConfigModule.forFeature(payoutConfig),
    AuditModule,
    WalletModule,
    MongooseModule.forFeature([
      ...MARKETPLACE_MODELS,
      { name: "MarketplaceAddress", schema: MarketplaceAddressSchema },
    ]),
  ],
  controllers: [
    MarketplacePublicController,
    MarketplaceCustomerController,
    MarketplaceVendorController,
    MarketplaceAdminController,
  ],
  providers: [
    BankAccountCrypto,
    RazorpayXPayoutProvider,
    { provide: MARKETPLACE_PAYOUT_PROVIDER, useExisting: RazorpayXPayoutProvider },
    MarketplaceAuditService,
    MarketplaceSettingsService,
    VendorService,
    CategoryService,
    InventoryService,
    ProductService,
    LedgerService,
    OrderService,
    PayoutService,
    ReviewService,
    DashboardService,
  ],
  exports: [OrderService, MongooseModule],
})
export class MarketplaceModule {}
