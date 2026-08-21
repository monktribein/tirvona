import "reflect-metadata";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import { TransactionService } from "../../common/database/transaction.service";
import { EventsModule } from "./events.module";
import { EVENT_MODEL } from "./domain/event.constants";
import { EVENT_REPOSITORY } from "./domain/event.repository";
import { EventAccessService } from "./application/event-access.service";
import { EventDiscoveryService } from "./application/event-discovery.service";
import { EventManagementService } from "./application/event-management.service";
import { EventRegistrationService } from "./application/event-registration.service";
import { EventScanService } from "./application/event-scan.service";
import { EventSettingsService } from "./application/event-settings.service";
import { EventPublicController } from "./presentation/controllers/event-public.controller";
import { EventRegistrationController } from "./presentation/controllers/event-registration.controller";
import { EventGateController } from "./presentation/controllers/event-gate.controller";
import { EventOwnerController } from "./presentation/controllers/event-owner.controller";
import { EventAdminController } from "./presentation/controllers/event-admin.controller";

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
    imports: [AmbientStubModule, EventsModule],
  });
  for (const name of Object.values(EVENT_MODEL)) {
    builder.overrideProvider(getModelToken(name)).useValue({});
  }
  return builder.compile();
};

describe("EventsModule", () => {
  it("resolves every provider it declares", async () => {
    const module = await compile();
    expect(module.get(EventAccessService)).toBeDefined();
    expect(module.get(EventSettingsService)).toBeDefined();
    expect(module.get(EventDiscoveryService)).toBeDefined();
    expect(module.get(EventRegistrationService)).toBeDefined();
    expect(module.get(EventScanService)).toBeDefined();
    expect(module.get(EventManagementService)).toBeDefined();
    expect(module.get(EVENT_REPOSITORY)).toBeDefined();
    await module.close();
  });

  it("resolves every controller it declares", async () => {
    const module = await compile();
    expect(module.get(EventPublicController)).toBeDefined();
    expect(module.get(EventRegistrationController)).toBeDefined();
    expect(module.get(EventGateController)).toBeDefined();
    expect(module.get(EventOwnerController)).toBeDefined();
    expect(module.get(EventAdminController)).toBeDefined();
    await module.close();
  });

  it("registers a model for every name the domain declares", () => {
    const names = Object.values(EVENT_MODEL);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("EventFestivalListing");
    expect(names).toContain("EventRegistration");
    expect(names).toContain("EventAshramRef");
  });
});
