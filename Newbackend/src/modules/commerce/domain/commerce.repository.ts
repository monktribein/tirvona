export const COMMERCE_REPOSITORY = Symbol("COMMERCE_REPOSITORY");
export interface CommerceRepository {
  list(
    model: string,
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    skip: number,
    limit: number,
  ): Promise<any[]>;
  count(model: string, filter: Record<string, unknown>): Promise<number>;
  one(model: string, filter: Record<string, unknown>): Promise<any | null>;
  create(model: string, payload: Record<string, unknown>): Promise<any>;
  update(
    model: string,
    id: string,
    payload: Record<string, unknown>,
  ): Promise<any | null>;
  remove(model: string, id: string): Promise<any | null>;
}
