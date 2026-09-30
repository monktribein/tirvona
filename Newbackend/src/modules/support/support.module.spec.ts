/**
 * Proves the module's dependency graph resolves: every provider and
 * controller declared in SupportModule can be constructed, with models and
 * cross-module services replaced by stand-ins (no database needed).
 */
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import { InAppNotificationService } from "../notifications/application/in-app-notification.service";
import { UploadsService } from "../uploads/application/uploads.service";
import { SupportTicketService } from "./application/support-ticket.service";
import { SUPPORT_MODELS } from "./infrastructure/support.schema";
import { SupportAdminController } from "./presentation/support-admin.controller";
import { SupportController } from "./presentation/support.controller";
import { SupportModule } from "./support.module";

describe("SupportModule wiring", () => {
  it("constructs every provider and controller", async () => {
    const providers = Reflect.getMetadata("providers", SupportModule) as any[];
    const controllers = Reflect.getMetadata("controllers", SupportModule) as any[];
    const modelNames = [...SUPPORT_MODELS.map((m) => m.name), "User", "AuditLog"];
    const moduleRef = await Test.createTestingModule({
      controllers,
      providers: [
        ...providers,
        ...modelNames.map((name) => ({ provide: getModelToken(name), useValue: {} })),
        { provide: getConnectionToken(), useValue: { collection: () => ({}) } },
        { provide: UploadsService, useValue: {} },
        { provide: InAppNotificationService, useValue: { notifyUsers: async () => undefined } },
      ],
    }).compile();
    expect(moduleRef.get(SupportTicketService)).toBeDefined();
    expect(moduleRef.get(SupportController)).toBeDefined();
    expect(moduleRef.get(SupportAdminController)).toBeDefined();
    expect(controllers).toHaveLength(2);
  });
});
