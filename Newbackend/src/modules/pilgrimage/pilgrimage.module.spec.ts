import "reflect-metadata";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import { TransactionService } from "../../common/database/transaction.service";
import { PilgrimageModule } from "./pilgrimage.module";
import { PILGRIMAGE_MODEL } from "./domain/pilgrimage.constants";
import { PilgrimageAccessService } from "./application/pilgrimage-access.service";
import { PilgrimageDiscoveryService } from "./application/pilgrimage-discovery.service";
import { PilgrimageManagementService } from "./application/pilgrimage-management.service";
import { PilgrimagePlannerService } from "./application/pilgrimage-planner.service";
import { PilgrimagePublicController } from "./presentation/controllers/pilgrimage-public.controller";
import { PilgrimageOwnerController } from "./presentation/controllers/pilgrimage-owner.controller";
import { PilgrimageAdminController } from "./presentation/controllers/pilgrimage-admin.controller";

/**
 * Stands in for the app's `@Global` CommonModule and ConfigModule, which this
 * module relies on ambiently exactly as ParkingModule does.
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
 * Proves the module's dependency graph resolves without a database. Every model
 * token is stubbed, so a missing `forFeature` registration or a service
 * injecting a model the module never declared fails here rather than at
 * container boot in production.
 */
const compile = async () => {
  const builder = Test.createTestingModule({
    imports: [AmbientStubModule, PilgrimageModule],
  });
  for (const name of Object.values(PILGRIMAGE_MODEL)) {
    builder.overrideProvider(getModelToken(name)).useValue({});
  }
  return builder.compile();
};

describe("PilgrimageModule", () => {
  it("resolves every provider it declares", async () => {
    const module = await compile();
    expect(module.get(PilgrimageAccessService)).toBeDefined();
    expect(module.get(PilgrimageDiscoveryService)).toBeDefined();
    expect(module.get(PilgrimagePlannerService)).toBeDefined();
    expect(module.get(PilgrimageManagementService)).toBeDefined();
    await module.close();
  });

  it("resolves every controller it declares", async () => {
    const module = await compile();
    expect(module.get(PilgrimagePublicController)).toBeDefined();
    expect(module.get(PilgrimageOwnerController)).toBeDefined();
    expect(module.get(PilgrimageAdminController)).toBeDefined();
    await module.close();
  });

  it("registers a model for every name the domain declares", () => {
    const names = Object.values(PILGRIMAGE_MODEL);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("PilgrimageCircuitListing");
    expect(names).toContain("PilgrimageStop");
    expect(names).toContain("PilgrimageAshramRef");
  });
});
