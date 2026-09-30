import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
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
  ValidateNested,
} from "class-validator";
import {
  LINKABLE_ENTITY_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "../domain/support.constants";

/** Trims and drops control characters (keeps newlines/tabs). Text is stored and rendered as plain text. */
const clean = ({ value }: { value: unknown }) =>
  typeof value === "string"
    ? // eslint-disable-next-line no-control-regex -- stripping control characters is the point
      value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()
    : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toUpperCase() : value;
const csv = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.split(",").map((v) => v.trim()).filter(Boolean) : value;

export class RelatedEntityDto {
  @IsIn(LINKABLE_ENTITY_TYPES) type!: string;
  @IsOptional() @IsMongoId() entityId?: string;
  @IsOptional() @Transform(clean) @IsString() @MaxLength(120) reference?: string;
}

export class CreateTicketDto {
  @Transform(clean) @IsString() @MinLength(3) @MaxLength(200) subject!: string;
  @Transform(clean) @IsString() @MinLength(10) @MaxLength(5000) description!: string;
  @Transform(clean) @IsString() @MaxLength(60) category!: string;
  @IsOptional() @ValidateNested() @Type(() => RelatedEntityDto) relatedEntity?: RelatedEntityDto;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE) @IsMongoId({ each: true })
  attachmentIds?: string[];
}

/** Staff raising a ticket for a customer (phone call, walk-in, email). */
export class AdminCreateTicketDto extends CreateTicketDto {
  @IsMongoId() userId!: string;
  @IsOptional() @Transform(upper) @IsIn(TICKET_PRIORITIES) priority?: string;
  @IsOptional() @IsMongoId() assignedTo?: string;
}

export class ReplyDto {
  @Transform(clean) @IsString() @MinLength(1) @MaxLength(5000) body!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE) @IsMongoId({ each: true })
  attachmentIds?: string[];
}

export class StaffReplyDto extends ReplyDto {
  /** true = internal note, never shown to the customer. */
  @IsOptional() @IsBoolean() internal?: boolean;
  /** Optional status to move to with this reply, e.g. WAITING_FOR_USER. */
  @IsOptional() @Transform(upper) @IsIn(TICKET_STATUSES) status?: string;
}

export class UpdateTicketDto {
  @IsOptional() @Transform(upper) @IsIn(TICKET_STATUSES) status?: string;
  @IsOptional() @Transform(upper) @IsIn(TICKET_PRIORITIES) priority?: string;
  @IsOptional() @Transform(clean) @IsString() @MaxLength(60) category?: string;
  /** Shown on the timeline next to the change. */
  @IsOptional() @Transform(clean) @IsString() @MaxLength(500) note?: string;
}

export class AssignTicketDto {
  /** null / omitted = unassign. */
  @IsOptional() @IsMongoId() assigneeId?: string | null;
}

export class EscalateTicketDto {
  @Transform(clean) @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class LinkEntityDto {
  /** Omit to remove the link. */
  @IsOptional() @ValidateNested() @Type(() => RelatedEntityDto) relatedEntity?: RelatedEntityDto;
}

export class ReopenDto {
  @IsOptional() @Transform(clean) @IsString() @MaxLength(1000) reason?: string;
}

export class MyTicketsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  /** "active" | "finished" | a single status */
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @IsOptional() @Transform(clean) @IsString() @MaxLength(100) search?: string;
}

export const TICKET_VIEWS = ["all", "mine", "unassigned", "urgent", "escalated", "overdue"] as const;
export const TICKET_SORTS = ["newest", "oldest", "priority", "activity", "due"] as const;

export class AdminTicketsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsIn(TICKET_VIEWS) view?: string;
  @IsOptional() @Transform(csv) @IsArray() @IsIn(TICKET_STATUSES, { each: true }) status?: string[];
  @IsOptional() @Transform(csv) @IsArray() @IsIn(TICKET_PRIORITIES, { each: true }) priority?: string[];
  @IsOptional() @Transform(clean) @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsMongoId() assignedTo?: string;
  @IsOptional() @IsMongoId() userId?: string;
  @IsOptional() @IsIn(LINKABLE_ENTITY_TYPES) entityType?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @Transform(clean) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(TICKET_SORTS) sort?: string;
}

export class LinkableQueryDto {
  @IsIn(LINKABLE_ENTITY_TYPES) type!: string;
}

export class UserSearchQueryDto {
  @Transform(clean) @IsString() @MinLength(2) @MaxLength(100) search!: string;
}

export class CreateSupportCategoryDto {
  @Matches(/^[a-z][a-z0-9_]{1,39}$/, {
    message: "key must be 2-40 lower-case letters, digits or underscores, starting with a letter",
  })
  key!: string;
  @Transform(clean) @IsString() @MinLength(2) @MaxLength(60) label!: string;
  @IsOptional() @Transform(clean) @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) sortOrder?: number;
  @IsOptional() @Transform(upper) @IsIn(TICKET_PRIORITIES) defaultPriority?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) entityTypes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) handlerRoles?: string[];
}

/** Everything but the key, which tickets reference and therefore never changes. */
export class UpdateSupportCategoryDto {
  @IsOptional() @Transform(clean) @IsString() @MinLength(2) @MaxLength(60) label?: string;
  @IsOptional() @Transform(clean) @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) sortOrder?: number;
  @IsOptional() @Transform(upper) @IsIn(TICKET_PRIORITIES) defaultPriority?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) entityTypes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) handlerRoles?: string[];
}

// ------------------------------------------------ legacy (first version) payloads
/** `POST /support` as the old page sent it: title/description/category. */
export class LegacyCreateTicketDto {
  @Transform(clean) @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @Transform(clean) @IsString() @MinLength(2) @MaxLength(5000) description!: string;
  @Transform(clean) @IsString() @MaxLength(60) category!: string;
}
export class TicketMessageDto {
  @Transform(clean) @IsString() @MinLength(1) @MaxLength(5000) text!: string;
}
