import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import { AppModule } from "../app.module";
import { applyDnsServersFromEnvironment } from "../config/environment";

/**
 * Indexes whose OPTIONS changed after they were first built.
 *
 * `createIndexes()` only creates what is missing — it will not alter an index
 * that already exists under the same name, and MongoDB rejects a redefinition
 * outright. So an index created `unique` that later needed a partial filter
 * silently keeps its original behaviour forever.
 *
 * Concretely: `booking_reviews.bookingId_1` was unique and unfiltered when a
 * review always belonged to a booking. Visitor reviews store `bookingId: null`,
 * and a unique index over nulls permits exactly ONE such document across the
 * whole collection — so the second visitor review anywhere on the platform
 * failed with a duplicate-key error.
 */
const STALE_INDEXES: {
  collection: string;
  index: string;
  isCurrent: (definition: Record<string, any>) => boolean;
}[] = [
  {
    collection: "booking_reviews",
    index: "bookingId_1",
    isCurrent: (definition) => Boolean(definition.partialFilterExpression),
  },
];

async function dropStaleIndexes(connection: Connection): Promise<void> {
  for (const { collection, index, isCurrent } of STALE_INDEXES) {
    try {
      const target = connection.collection(collection);
      const existing = await target.indexes();
      const current = existing.find((i) => i.name === index);
      // Once rebuilt in the new shape this becomes a no-op.
      if (!current || isCurrent(current)) continue;
      await target.dropIndex(index);
      process.stdout.write(`Dropped stale index: ${collection}.${index}
`);
    } catch (error: unknown) {
      // A missing collection or index is fine — nothing to migrate.
      const code = (error as { codeName?: string })?.codeName;
      if (code !== "NamespaceNotFound" && code !== "IndexNotFound") throw error;
    }
  }
}

async function createIndexes(): Promise<void> {
  // An Atlas SRV lookup uses the machine's resolver unless DNS_SERVERS is
  // applied first, exactly as main.ts does before booting.
  applyDnsServersFromEnvironment();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const connection = app.get<Connection>(getConnectionToken());
    await dropStaleIndexes(connection);
    for (const model of Object.values(connection.models)) {
      await model.createIndexes();
      process.stdout.write(`Indexes verified: ${model.modelName}\n`);
    }
  } finally {
    await app.close();
  }
}

void createIndexes().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`Index creation failed: ${message}\n`);
  process.exitCode = 1;
});
