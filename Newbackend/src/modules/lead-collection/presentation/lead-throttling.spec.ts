import { LeadAdminController } from "./lead-admin.controller";
import { LeadAgentController } from "./lead-agent.controller";
import { LeadAuthController } from "./lead-auth.controller";
import { LeadSupervisorController } from "./lead-supervisor.controller";
import { LeadUploadController } from "./lead-upload.controller";

describe("LeadTirvona throttling", () => {
  const controllers = [
    LeadAuthController,
    LeadAgentController,
    LeadAdminController,
    LeadSupervisorController,
    LeadUploadController,
  ];

  it.each(controllers.map((controller) => [controller.name, controller] as const))(
    "%s skips both global rate limiters",
    (_name, controller) => {
      expect(Reflect.getMetadata("THROTTLER:SKIPdefault", controller)).toBe(true);
      expect(Reflect.getMetadata("THROTTLER:SKIPipAbuse", controller)).toBe(true);
    },
  );
});
