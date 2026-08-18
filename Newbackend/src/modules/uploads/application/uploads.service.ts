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
  /** Per-kind ceilings, in bytes. Video is the only one that needs headroom. */
  static readonly SIZE_LIMITS: Record<"image" | "pdf" | "audio" | "video", number> =
    {
      image: 10 * 1024 * 1024,
      pdf: 10 * 1024 * 1024,
      audio: 10 * 1024 * 1024,
      video: 100 * 1024 * 1024,
    };
  /** What multer accepts before the per-kind check above runs. */
  static readonly MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

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
        `That file type is not supported. Allowed: JPG, PNG, WEBP, GIF, AVIF, HEIC, PDF, MP3, WAV, OGG, M4A, AAC, FLAC, MP4, WEBM, MOV${
          file.mimetype ? ` (the browser sent it as "${file.mimetype}")` : ""
        }.`,
      );
    if (options?.imagesOnly && detected.kind !== "image")
      throw new BadRequestException(
        "Camera captures must be an image. Use the attachment picker to upload a PDF.",
      );
    // Multer's ceiling has to admit the largest allowed file, so the real
    // per-type limits are enforced here: a 90 MB "photo" is not a photo.
    const limit = UploadsService.SIZE_LIMITS[detected.kind];
    if (file.buffer.length > limit)
      throw new BadRequestException(
        `That ${detected.kind} is ${(file.buffer.length / 1024 / 1024).toFixed(1)} MB. The limit for ${detected.kind} files is ${limit / 1024 / 1024} MB.`,
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
            // Cloudinary files audio under "video" — there is no separate
            // audio resource type. "raw" would upload it but strip the
            // streaming/transcoding the <audio>/<video> elements rely on.
            resource_type:
              detected.kind === "pdf"
                ? "raw"
                : detected.kind === "audio" || detected.kind === "video"
                  ? "video"
                  : "image",
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
  private detectType(
    bytes: Buffer,
  ): { mime: string; kind: "image" | "pdf" | "audio" | "video" } | null {
    const ascii = (start: number, end: number): string =>
      bytes.subarray(start, end).toString("ascii");

    if (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    )
      return { mime: "image/jpeg", kind: "image" };
    if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
      return { mime: "image/png", kind: "image" };
    if (["GIF87a", "GIF89a"].includes(ascii(0, 6)))
      return { mime: "image/gif", kind: "image" };
    // Both WEBP and WAV are RIFF containers; the form type at byte 8 splits them.
    if (ascii(0, 4) === "RIFF") {
      const form = ascii(8, 12);
      if (form === "WEBP") return { mime: "image/webp", kind: "image" };
      if (form === "WAVE") return { mime: "audio/wav", kind: "audio" };
    }
    if (ascii(0, 5) === "%PDF-")
      return { mime: "application/pdf", kind: "pdf" };
    // Matroska/WebM share one container magic; the DocType decides which.
    if (bytes.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex")))
      return { mime: "video/webm", kind: "video" };
    if (ascii(0, 4) === "OggS") return { mime: "audio/ogg", kind: "audio" };
    if (ascii(0, 4) === "fLaC") return { mime: "audio/flac", kind: "audio" };
    // MP3: either an ID3 tag, or a bare frame header (11 sync bits set).
    if (ascii(0, 3) === "ID3") return { mime: "audio/mpeg", kind: "audio" };
    if (
      bytes.length >= 2 &&
      bytes[0] === 0xff &&
      (bytes[1] & 0xe0) === 0xe0 &&
      // 0xFFF1/0xFFF9 is ADTS AAC, which shares the sync word.
      bytes[1] !== 0xf1 &&
      bytes[1] !== 0xf9
    )
      return { mime: "audio/mpeg", kind: "audio" };
    if (
      bytes.length >= 2 &&
      bytes[0] === 0xff &&
      (bytes[1] === 0xf1 || bytes[1] === 0xf9)
    )
      return { mime: "audio/aac", kind: "audio" };
    // HEIC/HEIF/AVIF and M4A are all ISO base media files: a "ftyp" box names
    // the brand, which is the only thing separating a photo from a ringtone.
    if (bytes.length >= 12 && ascii(4, 8) === "ftyp") {
      const brand = ascii(8, 12).toLowerCase();
      if (brand.startsWith("avi")) return { mime: "image/avif", kind: "image" };
      if (
        ["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]
          .includes(brand)
      )
        return { mime: "image/heic", kind: "image" };
      if (brand.startsWith("m4a") || brand.startsWith("m4b"))
        return { mime: "audio/mp4", kind: "audio" };
      // MP4 and QuickTime video share the ISO-BMFF container with HEIC and
      // M4A above, so the brand is the only thing that separates a phone video
      // from a phone photo.
      if (brand === "qt  ") return { mime: "video/quicktime", kind: "video" };
      if (
        brand.startsWith("mp4") ||
        brand.startsWith("iso") ||
        brand.startsWith("avc") ||
        brand.startsWith("dash") ||
        brand === "m4v "
      )
        return { mime: "video/mp4", kind: "video" };
    }
    return null;
  }
}
