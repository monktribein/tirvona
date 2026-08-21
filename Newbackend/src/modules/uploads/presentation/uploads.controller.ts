import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthenticatedUploadThrottle } from "../../../common/throttling/rate-limit.decorators";
import { memoryStorage } from "multer";
import { UploadsService } from "../application/uploads.service";
@Controller("uploads")
export class UploadsController {
  constructor(private readonly service: UploadsService) {}
  @Post()
  @AuthenticatedUploadThrottle(20, 900_000)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: UploadsService.MAX_UPLOAD_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("folder") folder?: string,
  ) {
    return { success: true, data: await this.service.upload(file, folder) };
  }
}
