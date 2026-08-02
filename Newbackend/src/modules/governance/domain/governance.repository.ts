export const GOVERNANCE_REPOSITORY = Symbol("GOVERNANCE_REPOSITORY");
export interface GovernanceRepository {
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
  updateMany(
    model: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<number>;
  remove(model: string, filter: Record<string, unknown>): Promise<any | null>;
  removeMany(model: string, filter: Record<string, unknown>): Promise<number>;
}
