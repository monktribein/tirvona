import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { memoryStorage } from "multer";
import { Public } from "../../../common/decorators/public.decorator";
import { UploadsService } from "../../uploads/application/uploads.service";
import { LeadAgentGuard } from "./guards/lead-agent.guard";

/** Cloudinary uploads authenticated with the field-agent token scope. */
@Public()
@UseGuards(LeadAgentGuard)
@Controller("lead-collection/agent/uploads")
export class LeadUploadController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("source") source?: string,
  ) {
    const captureSource = source === "camera" ? "camera" : "picker";
    return {
      success: true,
      data: {
        ...(await this.uploads.upload(file, "lead-ashrams", {
          imagesOnly: captureSource === "camera",
        })),
        captureSource,
      },
    };
  }
}
