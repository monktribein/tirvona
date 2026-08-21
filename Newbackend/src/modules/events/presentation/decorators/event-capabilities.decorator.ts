import { SetMetadata } from "@nestjs/common";
export const EVENT_CAPABILITIES_KEY = "eventCapabilities";
export const EventCapabilities = (...capabilities: string[]) =>
  SetMetadata(EVENT_CAPABILITIES_KEY, capabilities);
