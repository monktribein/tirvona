import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { memoryStorage } from "multer";
import { UploadsService } from "../application/uploads.service";
@Controller("uploads")
export class UploadsController {
  constructor(private readonly service: UploadsService) {}
  @Post()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, done) =>
        [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "application/pdf",
        ].includes(file.mimetype)
          ? done(null, true)
          : done(
              new BadRequestException(
                "Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, PDF.",
              ),
              false,
            ),
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("folder") folder?: string,
  ) {
    return { success: true, data: await this.service.upload(file, folder) };
  }
}
