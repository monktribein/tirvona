import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { PlatformSettingsService } from "./application/platform-settings.service";
import { AssistantConfigService } from "./application/assistant-config.service";
import { PlatformSettingsSchema } from "./infrastructure/platform-settings.schema";
import { PlatformSettingsController } from "./presentation/platform-settings.controller";
import { AssistantConfigController } from "./presentation/assistant-config.controller";
@Module({
  imports: [
    OrmModule.forFeature([
      { name: "PlatformSettings", schema: PlatformSettingsSchema },
    ]),
  ],
  controllers: [PlatformSettingsController, AssistantConfigController],
  providers: [PlatformSettingsService, AssistantConfigService],
  exports: [PlatformSettingsService, OrmModule],
})
export class PlatformSettingsModule {}
