import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import { AppModule } from "../app.module";
import { applyDnsServersFromEnvironment } from "../config/environment";

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
      if (!current || isCurrent(current)) continue;
      await target.dropIndex(index);
      process.stdout.write(`Dropped stale index: ${collection}.${index}
`);
    } catch (error: unknown) {
      const code = (error as { codeName?: string })?.codeName;
      if (code !== "NamespaceNotFound" && code !== "IndexNotFound") throw error;
    }
  }
}

async function createIndexes(): Promise<void> {
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
