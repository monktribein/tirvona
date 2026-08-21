import { IsObject, IsOptional, IsPhoneNumber, IsString } from "class-validator";
import type { WhatsAppTemplateValue } from "../types/whatsapp.types";

export class SendWhatsAppTemplateDto {
  @IsPhoneNumber() to: string;
  @IsString() templateKey: string;
  @IsObject() variables: Record<string, WhatsAppTemplateValue>;
  @IsString() idempotencyKey: string;
  @IsOptional() @IsString() correlationId?: string;
}

