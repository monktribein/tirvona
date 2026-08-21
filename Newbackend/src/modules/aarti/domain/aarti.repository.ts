import type { ClientSession, HydratedDocument } from "mongoose";

export const AARTI_REPOSITORY = Symbol("AARTI_REPOSITORY");
export type AartiDocument = HydratedDocument<Record<string, unknown>>;

export interface AartiRepository {
  findSessionById(id: string, session?: ClientSession): Promise<any | null>;
  findSessionBySlugOrId(idOrSlug: string): Promise<any | null>;
  findPassType(
    id: string,
    sessionId?: string,
    session?: ClientSession,
  ): Promise<any | null>;
  reserveSeats(input: {
    sessionId: string;
    passTypeId: string;
    date: Date;
    seats: number;
    capacity: number;
    session: ClientSession;
  }): Promise<{ ok: boolean; remaining?: number }>;
  releaseSeats(input: {
    passTypeId: string;
    date: Date;
    seats: number;
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
