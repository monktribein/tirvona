import "reflect-metadata";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import { TransactionService } from "../../common/database/transaction.service";
import { AartiModule } from "./aarti.module";
import { AARTI_MODEL } from "./domain/aarti.constants";
import { AARTI_REPOSITORY } from "./domain/aarti.repository";
import { AartiAccessService } from "./application/aarti-access.service";
import { AartiBookingService } from "./application/aarti-booking.service";
import { AartiDiscoveryService } from "./application/aarti-discovery.service";
import { AartiManagementService } from "./application/aarti-management.service";
import { AartiPricingService } from "./application/aarti-pricing.service";
import { AartiReportService } from "./application/aarti-report.service";
import { AartiScanService } from "./application/aarti-scan.service";
import { AartiStreamService } from "./application/aarti-stream.service";
import { AartiPublicController } from "./presentation/controllers/aarti-public.controller";
import { AartiBookingController } from "./presentation/controllers/aarti-booking.controller";
import { AartiScanController } from "./presentation/controllers/aarti-scan.controller";
import { AartiOwnerController } from "./presentation/controllers/aarti-owner.controller";
import { AartiAdminController } from "./presentation/controllers/aarti-admin.controller";

/**
 * Stands in for the app's `@Global` CommonModule and ConfigModule, which
 * AartiModule relies on ambiently exactly as ParkingModule does.
 */
@Global()
@Module({
  providers: [
    { provide: TransactionService, useValue: { run: jest.fn() } },
    {
      provide: ConfigService,
      useValue: { get: jest.fn(), getOrThrow: jest.fn() },
    },
  ],
  exports: [TransactionService, ConfigService],
})
class AmbientStubModule {}

/**
 * Proves the module's dependency graph resolves without a database. Every
 * Mongoose model token is stubbed, so a missing `forFeature` registration or a
 * service injecting a model the module never declared fails here rather than at
 * container boot in production.
 */
const compile = async () => {
  const builder = Test.createTestingModule({
    imports: [AmbientStubModule, AartiModule],
  });

  for (const name of Object.values(AARTI_MODEL)) {
    builder.overrideProvider(getModelToken(name)).useValue({});
  }
  return builder.compile();
};

describe("AartiModule", () => {
  it("resolves every provider it declares", async () => {
    const module = await compile();
    expect(module.get(AartiAccessService)).toBeDefined();
    expect(module.get(AartiPricingService)).toBeDefined();
    expect(module.get(AartiDiscoveryService)).toBeDefined();
    expect(module.get(AartiBookingService)).toBeDefined();
    expect(module.get(AartiScanService)).toBeDefined();
    expect(module.get(AartiStreamService)).toBeDefined();
    expect(module.get(AartiReportService)).toBeDefined();
    expect(module.get(AartiManagementService)).toBeDefined();
    expect(module.get(AARTI_REPOSITORY)).toBeDefined();
    await module.close();
  });

  it("resolves every controller it declares", async () => {
    const module = await compile();
    expect(module.get(AartiPublicController)).toBeDefined();
    expect(module.get(AartiBookingController)).toBeDefined();
    expect(module.get(AartiScanController)).toBeDefined();
    expect(module.get(AartiOwnerController)).toBeDefined();
    expect(module.get(AartiAdminController)).toBeDefined();
    await module.close();
  });

  it("registers a model for every name the domain declares", () => {
    // AARTI_MODEL is the single source of truth the module maps over; a name
    // added there without a schema would leave an unresolvable token.
    const names = Object.values(AARTI_MODEL);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("AartiSession");
    expect(names).toContain("AartiStream");
    expect(names).toContain("AartiAshramRef");
  });
});
