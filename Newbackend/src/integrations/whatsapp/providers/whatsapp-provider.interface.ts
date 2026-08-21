import type {
  WhatsAppProviderRequest,
  WhatsAppProviderResult,
} from "../types/whatsapp.types";

export interface WhatsAppProvider {
  sendMessage(
    request: WhatsAppProviderRequest,
  ): Promise<WhatsAppProviderResult>;
}
