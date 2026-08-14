export const COMMUNITY_REPOSITORY = Symbol("COMMUNITY_REPOSITORY");
export interface CommunityRepository {
  list(
    model: string,
    filter?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<any[]>;
  one(
    model: string,
    filter: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<any | null>;
  count(model: string, filter?: Record<string, unknown>): Promise<number>;
  create(model: string, payload: Record<string, unknown>): Promise<any>;
  update(
    model: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    upsert?: boolean,
  ): Promise<any | null>;
  remove(model: string, filter: Record<string, unknown>): Promise<any | null>;
  /** Clears dependent rows (an article's comments, likes, status history). */
  removeMany(model: string, filter: Record<string, unknown>): Promise<number>;
}
