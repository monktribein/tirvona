import { Injectable } from "@nestjs/common";
import { WHATSAPP_TEMPLATE } from "../constants/whatsapp.constants";
import type { WhatsAppProviderResult } from "../types/whatsapp.types";
import { WhatsAppTemplateService } from "./whatsapp-template.service";

@Injectable()
export class WhatsAppOtpService {
  constructor(private readonly templates: WhatsAppTemplateService) {}

  sendAuthenticationOtp(input: {
    phone: string;
    code: string;
    expiresInMinutes: number;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<WhatsAppProviderResult> {
    return this.templates.send({
      to: input.phone,
      templateKey: WHATSAPP_TEMPLATE.AUTH_OTP,
      variables: {
        otp: input.code,
        expires_in_minutes: input.expiresInMinutes,
      },
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
    });
  }
}
