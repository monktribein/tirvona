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
  static readonly SIZE_LIMITS: Record<"image" | "pdf" | "audio" | "video", number> =
    {
      image: 10 * 1024 * 1024,
      pdf: 10 * 1024 * 1024,
      audio: 10 * 1024 * 1024,
      video: 100 * 1024 * 1024,
    };
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
    options?: {
      imagesOnly?: boolean;
      /** Restrict to these detected kinds (checked from the file's bytes, not its name). */
      allowedKinds?: Array<"image" | "pdf" | "audio" | "video">;
    },
  ): Promise<any> {
    if (!file)
      throw new BadRequestException(
        'No file provided (expected form field "file")',
      );
    const detected = this.detectType(
      file.buffer,
      file.mimetype,
      file.originalname,
    );
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
    if (options?.allowedKinds && !options.allowedKinds.includes(detected.kind))
      throw new BadRequestException(
        `That file type is not allowed here. Allowed: ${options.allowedKinds
          .map((kind) => (kind === "image" ? "images (JPG, PNG, WEBP, GIF, AVIF, HEIC)" : kind.toUpperCase()))
          .join(", ")}.`,
      );
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
              detected.kind === "pdf"
                ? "raw"
                : detected.kind === "audio" || detected.kind === "video"
                  ? "video"
                  : "auto",
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
        mimeType: detected.mime,
        kind: detected.kind,
      };
    } catch (error) {
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

  private detectType(
    bytes: Buffer,
    fallbackMime?: string,
    originalFilename?: string,
  ): { mime: string; kind: "image" | "pdf" | "audio" | "video" } | null {
    const ascii = (start: number, end: number): string =>
      bytes.subarray(start, end).toString("ascii");

    // JPEG (SOI marker 0xFF, 0xD8)
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      return { mime: "image/jpeg", kind: "image" };
    }
    // PNG
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
      return { mime: "image/png", kind: "image" };
    }
    // GIF
    if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) {
      return { mime: "image/gif", kind: "image" };
    }
    // WEBP / WAVE
    if (bytes.length >= 12 && ascii(0, 4) === "RIFF") {
      const form = ascii(8, 12).toUpperCase();
      if (form === "WEBP") return { mime: "image/webp", kind: "image" };
      if (form === "WAVE") return { mime: "audio/wav", kind: "audio" };
    }
    // BMP
    if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
      return { mime: "image/bmp", kind: "image" };
    }
    // TIFF
    if (
      bytes.length >= 4 &&
      ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
        (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
    ) {
      return { mime: "image/tiff", kind: "image" };
    }
    // SVG
    if (
      bytes.length >= 4 &&
      (ascii(0, 5) === "<?xml" ||
        ascii(0, 4) === "<svg" ||
        ascii(0, Math.min(bytes.length, 512)).toLowerCase().includes("<svg"))
    ) {
      return { mime: "image/svg+xml", kind: "image" };
    }
    // PDF
    if (bytes.length >= 5 && ascii(0, 5) === "%PDF-") {
      return { mime: "application/pdf", kind: "pdf" };
    }
    // WebM
    if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex"))) {
      return { mime: "video/webm", kind: "video" };
    }
    // OGG
    if (bytes.length >= 4 && ascii(0, 4) === "OggS") {
      return { mime: "audio/ogg", kind: "audio" };
    }
    // FLAC
    if (bytes.length >= 4 && ascii(0, 4) === "fLaC") {
      return { mime: "audio/flac", kind: "audio" };
    }
    // MP3
    if (
      (bytes.length >= 3 && ascii(0, 3) === "ID3") ||
      (bytes.length >= 2 &&
        bytes[0] === 0xff &&
        (bytes[1] & 0xe0) === 0xe0 &&
        bytes[1] !== 0xf1 &&
        bytes[1] !== 0xf9)
    ) {
      return { mime: "audio/mpeg", kind: "audio" };
    }
    // AAC
    if (
      bytes.length >= 2 &&
      bytes[0] === 0xff &&
      (bytes[1] === 0xf1 || bytes[1] === 0xf9)
    ) {
      return { mime: "audio/aac", kind: "audio" };
    }
    // ISOBMFF / ftyp container (HEIC, HEIF, AVIF, MP4, MOV, M4A)
    if (bytes.length >= 12 && ascii(4, 8) === "ftyp") {
      const ftypChunk = ascii(8, Math.min(bytes.length, 64)).toLowerCase();
      if (ftypChunk.startsWith("avi") || ftypChunk.includes("avif") || ftypChunk.includes("avis")) {
        return { mime: "image/avif", kind: "image" };
      }
      if (
        [
          "heic",
          "heix",
          "hevc",
          "heim",
          "heis",
          "hevm",
          "hevs",
          "heif",
          "mif1",
          "msf1",
        ].some((b) => ftypChunk.includes(b))
      ) {
        return { mime: "image/heic", kind: "image" };
      }
      if (ftypChunk.startsWith("m4a") || ftypChunk.startsWith("m4b")) {
        return { mime: "audio/mp4", kind: "audio" };
      }
      if (ftypChunk.startsWith("qt  ")) {
        return { mime: "video/quicktime", kind: "video" };
      }
      if (
        ftypChunk.startsWith("mp4") ||
        ftypChunk.startsWith("iso") ||
        ftypChunk.startsWith("avc") ||
        ftypChunk.startsWith("dash") ||
        ftypChunk.startsWith("m4v ")
      ) {
        return { mime: "video/mp4", kind: "video" };
      }
    }

    // Resilient fallback based on browser MIME and original extension
    const mime = (fallbackMime || "").toLowerCase().trim();
    const ext = (originalFilename || "")
      .split(".")
      .pop()
      ?.toLowerCase()
      .trim();

    if (
      mime.startsWith("image/") ||
      [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "avif",
        "heic",
        "heif",
        "bmp",
        "tiff",
        "svg",
      ].includes(ext || "")
    ) {
      const resolvedMime =
        mime.startsWith("image/")
          ? mime
          : ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : ext === "heic" || ext === "heif"
                ? "image/heic"
                : ext === "gif"
                  ? "image/gif"
                  : ext === "avif"
                    ? "image/avif"
                    : ext === "bmp"
                      ? "image/bmp"
                      : ext === "svg"
                        ? "image/svg+xml"
                        : "image/jpeg";
      return { mime: resolvedMime, kind: "image" };
    }

    if (
      mime.startsWith("video/") ||
      ["mp4", "webm", "mov", "m4v", "mkv"].includes(ext || "")
    ) {
      return { mime: mime.startsWith("video/") ? mime : "video/mp4", kind: "video" };
    }

    if (
      mime.startsWith("audio/") ||
      ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext || "")
    ) {
      return { mime: mime.startsWith("audio/") ? mime : "audio/mpeg", kind: "audio" };
    }

    if (mime === "application/pdf" || ext === "pdf") {
      return { mime: "application/pdf", kind: "pdf" };
    }

    return null;
  }
}
