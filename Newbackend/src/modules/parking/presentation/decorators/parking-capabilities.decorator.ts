import { SetMetadata } from "@nestjs/common";
export const PARKING_CAPABILITIES_KEY = "parkingCapabilities";
export const ParkingCapabilities = (...capabilities: string[]) =>
  SetMetadata(PARKING_CAPABILITIES_KEY, capabilities);
