import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { PlatformSettingsService } from "./application/platform-settings.service";
import { PlatformSettingsSchema } from "./infrastructure/platform-settings.schema";
import { PlatformSettingsController } from "./presentation/platform-settings.controller";
@Module({
  imports: [
    OrmModule.forFeature([
      { name: "PlatformSettings", schema: PlatformSettingsSchema },
    ]),
  ],
  controllers: [PlatformSettingsController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService, OrmModule],
})
export class PlatformSettingsModule {}
