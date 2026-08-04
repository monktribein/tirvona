import {
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
  // No MIME allowlist here on purpose: the declared type is chosen by the
  // browser and is wrong often enough to reject valid photos. UploadsService
  // identifies the file from its magic bytes, which is both more permissive
  // for real images and stricter for anything pretending to be one.
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("folder") folder?: string,
  ) {
    return { success: true, data: await this.service.upload(file, folder) };
  }
}
