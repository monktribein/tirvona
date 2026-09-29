/**
 * Creates the vendor marketplace indexes (production runs with autoIndex off).
 *
 *   npx ts-node src/modules/marketplace/scripts/create-marketplace-indexes.ts
 *
 * Safe to re-run.
 */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../../app.module";
import { applyDnsServersFromEnvironment } from "../../../config/environment";
import { MarketplaceIndexService } from "../application/marketplace-index.service";

async function run(): Promise<void> {
  applyDnsServersFromEnvironment();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  try {
    const result = await app.get(MarketplaceIndexService).ensureIndexes();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.failed.length) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  process.stderr.write(`Marketplace index creation failed: ${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
