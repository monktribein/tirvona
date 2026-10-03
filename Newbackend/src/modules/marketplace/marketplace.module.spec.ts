/**
 * Proves the module's dependency graph resolves: every provider and
 * controller declared in MarketplaceModule can be constructed, with models
 * replaced by in-memory stand-ins (no database needed).
 */
import { ConfigService } from "@nestjs/config";
import { getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import { TransactionService } from "../../common/database/transaction.service";
import { payoutConfig } from "../payouts/config/payout.config";
import { MarketplaceModule } from "./marketplace.module";
import { OrderService } from "./application/order.service";
import { MarketplaceAdminController } from "./presentation/marketplace-admin.controller";
import { MARKETPLACE_MODELS } from "./infrastructure/marketplace.schemas";
import { WalletService } from "../wallet/application/wallet.service";

describe("MarketplaceModule wiring", () => {
  it("constructs every provider and controller", async () => {
    const providers = Reflect.getMetadata("providers", MarketplaceModule) as any[];
    const controllers = Reflect.getMetadata("controllers", MarketplaceModule) as any[];
    const modelNames = [...MARKETPLACE_MODELS.map((m) => m.name), "MarketplaceAddress", "AuditLog"];
    const moduleRef = await Test.createTestingModule({
      controllers,
      providers: [
        ...providers,
        ...modelNames.map((name) => ({ provide: getModelToken(name), useValue: {} })),
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: TransactionService, useValue: { run: (w: any) => w() } },
        { provide: payoutConfig.KEY, useValue: { enabled: false } },
        { provide: WalletService, useValue: {} },
      ],
    }).compile();
    expect(moduleRef.get(OrderService)).toBeDefined();
    expect(moduleRef.get(MarketplaceAdminController)).toBeDefined();
    expect(controllers).toHaveLength(4);
  });
});
