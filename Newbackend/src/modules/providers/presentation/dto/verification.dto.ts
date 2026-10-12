import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  EVIDENCE_TYPES,
  MAX_VERIFICATION_VALIDITY_DAYS,
  VERIFICATION_CASE_STATUSES,
  VERIFICATION_CASE_TYPES,
  VERIFICATION_DECISIONS,
} from "../../domain/provider.constants";
import { PageQueryDto, QueryBoolean } from "./common.dto";

const trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));

/** Documents the verification flow accepts; the uploads module detects the real type from the bytes. */
export const EVIDENCE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export class OpenVerificationCaseDto {
  /** Defaults to IDENTITY. TRUST_REVIEW can only be opened by reviewers. */
  @IsOptional() @IsIn(VERIFICATION_CASE_TYPES) verificationType?: string;
  /** Reviewers/ops open a case for a provider; a provider's own id is implied and any other value is refused. */
  @IsOptional() @IsMongoId() providerId?: string;
  @IsOptional() @trim() @IsString() @MaxLength(500) notes?: string;
}

export class AddEvidenceDto {
  @IsIn(EVIDENCE_TYPES) evidenceType: string;
  /** Reference returned by the uploads module (never rendered back to the provider). */
  @trim() @IsString() @MinLength(3) @MaxLength(500) storageKey: string;
  /** SHA-256 of the file bytes, lowercase hex. */
  @Matches(/^[A-Fa-f0-9]{64}$/, { message: "sha256 must be 64 hexadecimal characters" }) sha256: string;
  @IsOptional() @IsIn(EVIDENCE_MIME_TYPES) mimeType?: string;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_EVIDENCE_BYTES) sizeBytes?: number;
  @IsOptional() @trim() @IsString() @MaxLength(100) label?: string;
}

export class DecideVerificationDto {
  @IsIn(VERIFICATION_DECISIONS) decision: string;
  /** Checked against the controlled allow-list for the decision. */
  @trim() @IsString() @MaxLength(60) reasonCode: string;
  /** Shown to the provider. */
  @IsOptional() @trim() @IsString() @MaxLength(500) providerMessage?: string;
  /** Reviewer-only; never returned to the provider. */
  @IsOptional() @trim() @IsString() @MaxLength(2000) internalNote?: string;
  @IsOptional() @IsInt() @Min(30) @Max(MAX_VERIFICATION_VALIDITY_DAYS) validityDays?: number;
}

export class VerificationQueueQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(VERIFICATION_CASE_STATUSES) status?: string;
  @IsOptional() @IsIn(VERIFICATION_CASE_TYPES) verificationType?: string;
  @IsOptional() @IsMongoId() providerId?: string;
  /** Reviewer queue only: just the cases assigned to me. */
  @IsOptional() @QueryBoolean() @IsBoolean() assignedToMe?: boolean;
}

export class AdminProviderQueryDto extends PageQueryDto {
  @IsOptional() @trim() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() @IsString() @MaxLength(30) verificationLevel?: string;
}
