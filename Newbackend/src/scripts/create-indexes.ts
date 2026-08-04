import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import { AppModule } from "../app.module";
import { applyDnsServersFromEnvironment } from "../config/environment";

async function createIndexes(): Promise<void> {
  // An Atlas SRV lookup uses the machine's resolver unless DNS_SERVERS is
  // applied first, exactly as main.ts does before booting.
  applyDnsServersFromEnvironment();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const connection = app.get<Connection>(getConnectionToken());
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
