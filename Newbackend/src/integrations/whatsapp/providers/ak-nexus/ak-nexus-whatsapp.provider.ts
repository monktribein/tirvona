import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../../config/whatsapp.config";
import { AK_NEXUS_PROVIDER_NAME } from "../../constants/whatsapp.constants";
import type {
  WhatsAppProviderRequest,
  WhatsAppProviderResult,
} from "../../types/whatsapp.types";
import type { WhatsAppProvider } from "../whatsapp-provider.interface";
import { AkNexusWhatsAppClient } from "./ak-nexus-whatsapp.client";

@Injectable()
export class AkNexusWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(AkNexusWhatsAppProvider.name);

  constructor(
    private readonly client: AkNexusWhatsAppClient,
    @Inject(whatsappConfig.KEY)
    private readonly config: ConfigType<typeof whatsappConfig>,
  ) {}

  async sendMessage(
    request: WhatsAppProviderRequest,
  ): Promise<WhatsAppProviderResult> {
    if (this.config.dryRun) {
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.dry_run",
          provider: AK_NEXUS_PROVIDER_NAME,
          messageType: request.messageType,
          idempotencyKey: request.idempotencyKey,
        }),
      );
      return {
        status: "skipped",
        provider: AK_NEXUS_PROVIDER_NAME,
        reason: "dry_run",
      };
    }
    return this.client.sendMessage(request);
  }
}
