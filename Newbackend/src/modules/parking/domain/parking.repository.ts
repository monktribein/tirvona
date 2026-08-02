import type { ClientSession, HydratedDocument } from "mongoose";

export const PARKING_REPOSITORY = Symbol("PARKING_REPOSITORY");
export type ParkingDocument = HydratedDocument<Record<string, unknown>>;

export interface ParkingRepository {
  findLocationById(id: string, session?: ClientSession): Promise<any | null>;
  findLocationBySlugOrId(idOrSlug: string): Promise<any | null>;
  findSlotType(
    id: string,
    locationId?: string,
    session?: ClientSession,
  ): Promise<any | null>;
  reserveInventory(input: {
    locationId: string;
    slotTypeId: string;
    dates: Date[];
    units: number;
    capacity: number;
    session: ClientSession;
  }): Promise<{ ok: boolean; failedDate?: string }>;
  releaseInventory(input: {
    slotTypeId: string;
    dates: Date[];
    units: number;
    session: ClientSession;
  }): Promise<void>;
  findBooking(id: string, session?: ClientSession): Promise<any | null>;
  findBookingForCustomer(id: string, customerId: string): Promise<any | null>;
  listBookings(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{ items: any[]; total: number }>;
}
