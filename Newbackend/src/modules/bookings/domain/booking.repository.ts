import type { ClientSession } from "mongoose";

export const BOOKING_REPOSITORY = Symbol("BOOKING_REPOSITORY");
export interface BookingRepository {
  holdInventory(input: {
    ashramId: string;
    roomId: string;
    dates: Date[];
    count: number;
    capacity: number;
    session: ClientSession;
  }): Promise<void>;
  confirmInventory(input: {
    roomId: string;
    dates: Date[];
    count: number;
    session: ClientSession;
  }): Promise<void>;
  releaseInventory(input: {
    roomId: string;
    dates: Date[];
    count: number;
    state: "held" | "booked";
    session: ClientSession;
  }): Promise<void>;
}
