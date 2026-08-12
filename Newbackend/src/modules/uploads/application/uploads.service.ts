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
    options?: { imagesOnly?: boolean },
  ): Promise<any> {
    if (!file)
      throw new BadRequestException(
        'No file provided (expected form field "file")',
      );
    const detected = this.detectType(file.buffer);
    if (!detected)
      throw new BadRequestException(
        `That file type is not supported. Allowed: JPG, PNG, WEBP, GIF, AVIF, HEIC, PDF${
          file.mimetype ? ` (the browser sent it as "${file.mimetype}")` : ""
        }.`,
      );
    if (options?.imagesOnly && detected.isPdf)
      throw new BadRequestException(
        "Camera captures must be an image. Use the attachment picker to upload a PDF.",
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
            resource_type: detected.isPdf ? "raw" : "image",
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
    } catch (error) {
      // Pass the provider's reason through — "Invalid image file" is
      // actionable, a bare "upload failed" is not.
      const raw = error as {
        message?: unknown;
        error?: { message?: unknown } | string;
      };
      const nested =
        typeof raw?.error === "string" ? raw.error : raw?.error?.message;
      const reason = String(raw?.message ?? nested ?? "").slice(0, 200);
      throw new BadGatewayException(
        reason
          ? `File upload failed: ${reason}`
          : "File upload failed. Please try again.",
      );
    }
  }

  /**
   * Identifies a file from its magic bytes rather than the declared MIME type.
   * Browsers are unreliable here — Windows reports `application/octet-stream`
   * or an empty type for extensions it does not recognise, and phone cameras
   * produce HEIC/AVIF — so trusting the header rejected perfectly good photos.
   * Reading the content is also the stricter check: a renamed executable is
   * turned away no matter what type it claims.
   */
  private detectType(bytes: Buffer): { mime: string; isPdf: boolean } | null {
    const ascii = (start: number, end: number): string =>
      bytes.subarray(start, end).toString("ascii");

    if (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    )
      return { mime: "image/jpeg", isPdf: false };
    if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
      return { mime: "image/png", isPdf: false };
    if (["GIF87a", "GIF89a"].includes(ascii(0, 6)))
      return { mime: "image/gif", isPdf: false };
    if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
      return { mime: "image/webp", isPdf: false };
    if (ascii(0, 5) === "%PDF-") return { mime: "application/pdf", isPdf: true };
    // HEIC/HEIF/AVIF are ISO base media files: a "ftyp" box names the brand.
    if (bytes.length >= 12 && ascii(4, 8) === "ftyp") {
      const brand = ascii(8, 12).toLowerCase();
      if (brand.startsWith("avi")) return { mime: "image/avif", isPdf: false };
      if (
        ["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]
          .includes(brand)
      )
        return { mime: "image/heic", isPdf: false };
    }
    return null;
  }
}
