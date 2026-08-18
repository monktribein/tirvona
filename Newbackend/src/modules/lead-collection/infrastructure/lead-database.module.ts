import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { leadCollectionConfig } from "../config/lead-collection.config";
import {
  LEAD_CONNECTION,
  LEAD_MODEL,
  LEAD_REGION_MODEL,
  LEAD_USER_MODEL,
} from "../domain/lead-collection.constants";
import { LeadSchema } from "./persistence/lead.schema";
import { LeadRegionSchema } from "./persistence/lead-region.schema";
import { LeadUserSchema } from "./persistence/lead-user.schema";

/**
 * A second, named Mongoose connection pointed at the lead database.
 *
 * This is what makes the isolation structural rather than a naming
 * convention: nothing in the lead module can reach a platform model, because
 * its models are registered against `LEAD_CONNECTION` and the platform's are
 * registered against the default one. Repointing `LEAD_MONGODB_URI` at a
 * different cluster is then a config change, not a migration.
 *
 * The pool is deliberately small — the lead app is a handful of field agents
 * and one admin console, not public traffic.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      connectionName: LEAD_CONNECTION,
      useFactory: () => {
        const config = leadCollectionConfig();
        return {
          uri: config.mongoUri,
          dbName: config.mongoDbName,
          autoIndex: process.env.NODE_ENV !== "production",
          minPoolSize: 1,
          maxPoolSize: 5,
          serverSelectionTimeoutMS: 10_000,
          socketTimeoutMS: 45_000,
        };
      },
    }),
    MongooseModule.forFeature(
      [
        { name: LEAD_USER_MODEL, schema: LeadUserSchema },
        { name: LEAD_MODEL, schema: LeadSchema },
        { name: LEAD_REGION_MODEL, schema: LeadRegionSchema },
      ],
      LEAD_CONNECTION,
    ),
  ],
  exports: [MongooseModule],
})
export class LeadDatabaseModule {}
