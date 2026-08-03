import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { v2 as cloudinary } from "cloudinary";
import { ConfigService } from "@nestjs/config";
@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {
    if (this.config.get<string>("cloudinaryCloudName"))
      cloudinary.config({
        cloud_name: this.config.get<string>("cloudinaryCloudName"),
        api_key: this.config.get<string>("cloudinaryApiKey"),
        api_secret: this.config.get<string>("cloudinaryApiSecret"),
        secure: true,
      });
  }
  async upload(
    file: Express.Multer.File | undefined,
    folder?: string,
  ): Promise<any> {
    if (!file)
      throw new BadRequestException(
        'No file provided (expected form field "file")',
      );
    if (!this.hasExpectedSignature(file))
      throw new BadRequestException(
        "File content does not match its declared type",
      );
    const configured = Boolean(
      this.config.get<string>("cloudinaryCloudName") &&
      this.config.get<string>("cloudinaryApiKey") &&
      this.config.get<string>("cloudinaryApiSecret"),
    );
    // No base64 fallback in any environment. A data: URI is persisted into the
    // record that references it, and a single inline image is enough to push a
    // listing query past the client timeout.
    if (!configured)
      throw new ServiceUnavailableException(
        "File storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      );
    try {
      const safeFolder =
        String(folder ?? "uploads")
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "-")
          .slice(0, 50) || "uploads";
      const result: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `${this.config.get<string>("cloudinaryFolder") ?? "tirvona"}/${safeFolder}`,
            resource_type:
              file.mimetype === "application/pdf" ? "raw" : "image",
          },
          (error, value) => (error ? reject(error) : resolve(value)),
        );
        stream.end(file.buffer);
      });
      return {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        bytes: result.bytes,
        format: result.format,
      };
    } catch {
      throw new BadGatewayException("Image upload failed. Please try again.");
    }
  }

  private hasExpectedSignature(file: Express.Multer.File): boolean {
    const bytes = file.buffer;
    if (file.mimetype === "image/jpeg")
      return (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );
    if (file.mimetype === "image/png")
      return bytes
        .subarray(0, 8)
        .equals(Buffer.from("89504e470d0a1a0a", "hex"));
    if (file.mimetype === "image/gif")
      return ["GIF87a", "GIF89a"].includes(
        bytes.subarray(0, 6).toString("ascii"),
      );
    if (file.mimetype === "image/webp")
      return (
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP"
      );
    if (file.mimetype === "application/pdf")
      return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    return false;
  }
}
