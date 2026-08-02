import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PlatformSettingsService } from "./application/platform-settings.service";
import { PlatformSettingsSchema } from "./infrastructure/platform-settings.schema";
import { PlatformSettingsController } from "./presentation/platform-settings.controller";
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "PlatformSettings", schema: PlatformSettingsSchema },
    ]),
  ],
  controllers: [PlatformSettingsController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService, MongooseModule],
})
export class PlatformSettingsModule {}
