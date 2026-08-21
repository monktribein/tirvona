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
