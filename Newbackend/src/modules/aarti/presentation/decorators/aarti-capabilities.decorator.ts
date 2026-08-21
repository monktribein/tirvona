import { SetMetadata } from "@nestjs/common";
export const AARTI_CAPABILITIES_KEY = "aartiCapabilities";
export const AartiCapabilities = (...capabilities: string[]) =>
  SetMetadata(AARTI_CAPABILITIES_KEY, capabilities);
