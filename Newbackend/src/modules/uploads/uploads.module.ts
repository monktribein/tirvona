import { Module } from "@nestjs/common";
import { UploadsService } from "./application/uploads.service";
import { UploadsController } from "./presentation/uploads.controller";
@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
