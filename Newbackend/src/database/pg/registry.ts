/**
 * Model collection -> Postgres table mapping used by the storage driver.
 *
 * The concrete mapping lives in registry.generated.ts, maintained by
 * `npm run db:generate` (database/generate.js) from the Mongoose models.
 * Every model collection maps to one table:
 *
 *   id      text PRIMARY KEY   the document _id (ObjectId hex) — never changes
 *   <col>   typed column       one per known top-level field
 *   _nulls  text[]             fields explicitly stored as null (vs. absent)
 *   _extra  jsonb              anything that does not fit its column type, and
 *                              fields not known to the registry (schemaless
 *                              writes). Lossless by construction.
 */
export type ScalarKind = "objectId" | "string" | "number" | "date" | "boolean";
export type ColumnKind = ScalarKind | `${ScalarKind}[]` | "json";

export interface ColumnDef {
  /** Field name in the model document. */
  field: string;
  /** Column name in Postgres (snake_case). */
  column: string;
  kind: ColumnKind;
}

export interface IndexDef {
  name: string;
  keys: Record<string, number | string>;
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: Record<string, unknown>;
  expireAfterSeconds?: number;
  /** Only enforced indexes become unique constraints / TTL sweeps; the rest are plain lookup indexes. */
  enforced?: boolean;
}

export interface TableDef {
  /** Logical database of the Mongoose connection (see src/database/database.ts). */
  database: string;
  collection: string;
  /** Postgres schema and table. */
  schema: string;
  table: string;
  idKind: "objectId" | "string";
  columns: ColumnDef[];
  indexes: IndexDef[];
}

export interface Registry {
  version: number;
  /** Logical connection database name -> Postgres schema. "" is the main connection. */
  databases: Record<string, string>;
  tables: TableDef[];
}

export const PG_TYPES: Record<ColumnKind, string> = {
  objectId: "text",
  string: "text",
  number: "double precision",
  date: "timestamptz",
  boolean: "boolean",
  "objectId[]": "text[]",
  "string[]": "text[]",
  "number[]": "double precision[]",
  "date[]": "timestamptz[]",
  "boolean[]": "boolean[]",
  json: "jsonb",
};

export class RegistryIndex {
  private readonly byKey = new Map<string, TableDef>();
  private readonly fieldMaps = new Map<TableDef, Map<string, ColumnDef>>();

  constructor(readonly registry: Registry) {
    for (const t of registry.tables) {
      this.byKey.set(`${t.schema}.${t.collection}`, t);
      this.fieldMaps.set(t, new Map(t.columns.map((c) => [c.field, c])));
    }
  }

  schemaForDb(dbName: string | undefined): string {
    const name = dbName ?? "";
    const schema = this.registry.databases[name];
    if (!schema) {
      throw new Error(
        `No Postgres schema is mapped for connection database "${name}". Add it to the registry.`,
      );
    }
    return schema;
  }

  table(schema: string, collection: string): TableDef {
    const t = this.byKey.get(`${schema}.${collection}`);
    if (!t) {
      throw new Error(
        `Collection "${collection}" (schema ${schema}) has no table in the registry. ` +
          "Regenerate the registry and apply the schema migration.",
      );
    }
    return t;
  }

  column(table: TableDef, field: string): ColumnDef | undefined {
    return this.fieldMaps.get(table)!.get(field);
  }
}
