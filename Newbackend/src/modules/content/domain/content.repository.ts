export const CONTENT_REPOSITORY = Symbol("CONTENT_REPOSITORY");

export interface ContentRepository {
  list(
    model: string,
    filter?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<any[]>;
  one(
    model: string,
    filter: Record<string, unknown>,
    populate?: string[],
  ): Promise<any | null>;
  create(model: string, payload: Record<string, unknown>): Promise<any>;
  update(
    model: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<any | null>;
  remove(model: string, filter: Record<string, unknown>): Promise<any | null>;
  removeMany(model: string, filter: Record<string, unknown>): Promise<number>;
  count(model: string, filter?: Record<string, unknown>): Promise<number>;
}
