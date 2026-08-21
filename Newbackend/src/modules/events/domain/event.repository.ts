import type { ClientSession, HydratedDocument } from "mongoose";

export const EVENT_REPOSITORY = Symbol("EVENT_REPOSITORY");
export type EventDocument = HydratedDocument<Record<string, unknown>>;

export interface EventRepository {
  findEventById(id: string, session?: ClientSession): Promise<any | null>;
  findEventBySlugOrId(idOrSlug: string): Promise<any | null>;
  reserveSeats(input: {
    eventId: string;
    date: Date;
    seats: number;
    capacity: number;
    session: ClientSession;
  }): Promise<{ ok: boolean; remaining?: number }>;
  releaseSeats(input: {
    eventId: string;
    date: Date;
    seats: number;
    session: ClientSession;
  }): Promise<void>;
  findRegistration(id: string, session?: ClientSession): Promise<any | null>;
  findRegistrationForCustomer(
    id: string,
    customerId: string,
  ): Promise<any | null>;
  listRegistrations(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{ items: any[]; total: number }>;
}
