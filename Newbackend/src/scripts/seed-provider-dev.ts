/**
 * Development-only sample providers.
 *
 *   PROVIDERS_ALLOW_DEV_FIXTURES=true npm run providers:seed-dev -- --password "dev-pass-123"
 *   PROVIDERS_ALLOW_DEV_FIXTURES=true npm run providers:seed-dev -- --remove
 *
 * Refuses to run when NODE_ENV=production, without PROVIDERS_ALLOW_DEV_FIXTURES=true,
 * and against any database that is not on this machine unless --allow-remote is
 * given. It prints the database host it is about to write to (never credentials).
 * Every record it creates is marked isDevFixture and is invisible to the public
 * API in production; --remove deletes them all.
 */
import { NestFactory } from "@nestjs/core";
import { getModelToken } from "../database/orm-nest";
import bcrypt from "bcryptjs";
import type { Model } from "../database/orm";
import { AppModule } from "../app.module";
import { applyDnsServersFromEnvironment } from "../config/environment";
import { configureDatabase } from "../database/database";
import {
  assertDevEnvironment,
  removeDevFixtures,
  seedDevFixtures,
  type FixtureModels,
} from "../modules/providers/dev/dev-fixtures";

const FLAG = (name: string) => process.argv.includes(name);
const out = (line = ""): void => void process.stdout.write(`${line}\n`);

function databaseHost(): string {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set");
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error("SUPABASE_DB_URL is not a valid URL");
  }
}

async function main(): Promise<void> {
  assertDevEnvironment();
  const host = databaseHost();
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  out(`Target database host: ${host}${local ? " (local)" : ""}`);
  if (!local && !FLAG("--allow-remote"))
    throw new Error(
      `${host} is not a local database. Fixtures are for a development database only; pass --allow-remote if you really mean this one.`,
    );

  const removing = FLAG("--remove");
  const passwordIndex = process.argv.indexOf("--password");
  const password = passwordIndex === -1 ? undefined : process.argv[passwordIndex + 1];
  if (!removing && (!password || password.startsWith("--") || password.length < 8))
    throw new Error("Pass the fixtures' login password explicitly: --password 'at-least-8-chars'");

  applyDnsServersFromEnvironment();
  configureDatabase();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  try {
    const model = (name: string) => app.get<Model<any>>(getModelToken(name));
    const models: FixtureModels = {
      User: model("User"),
      ProviderRitual: model("ProviderRitual"),
      ProviderRitualVariant: model("ProviderRitualVariant"),
      ProviderProfile: model("ProviderProfile"),
      ProviderPrivateProfile: model("ProviderPrivateProfile"),
      ProviderOffering: model("ProviderOffering"),
      ProviderAvailabilityRule: model("ProviderAvailabilityRule"),
      ProviderCalendarBlock: model("ProviderCalendarBlock"),
      ProviderBooking: model("ProviderBooking"),
      ProviderBookingStateHistory: model("ProviderBookingStateHistory"),
      ProviderConsultation: model("ProviderConsultation"),
      ProviderVerificationCase: model("ProviderVerificationCase"),
      ProviderVerificationEvidence: model("ProviderVerificationEvidence"),
    };
    if (removing) {
      const removed = await removeDevFixtures(models);
      out(`Removed ${removed.providers} fixture provider(s), ${removed.rituals} ritual(s), ${removed.users} user(s).`);
      return;
    }
    const summary = await seedDevFixtures(models, { passwordHash: await bcrypt.hash(password as string, 10) });
    out(`Created ${summary.providers} provider(s), ${summary.offerings} offering(s), ${summary.rituals} ritual(s), ${summary.users} user(s).`);
    out("Fixture logins (password as given):");
    for (const email of summary.loginEmails) out(`  ${email}`);
    out("They appear in the public API only while PROVIDERS_ALLOW_DEV_FIXTURES=true and NODE_ENV is not production.");
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
