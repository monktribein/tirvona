import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { smartContactConfig } from "../config/smart-contact.config";
import {
  SMART_CONTACT_AUDIT_MODEL,
  SMART_CONTACT_CONNECTION,
  SMART_CONTACT_EVENT_MODEL,
  SMART_CONTACT_PROFILE_MODEL,
  SMART_CONTACT_QR_MODEL,
} from "../domain/smart-contact.constants";
import { SmartContactAuditSchema } from "./persistence/smart-contact-audit.schema";
import { SmartContactEventSchema } from "./persistence/smart-contact-event.schema";
import { SmartContactProfileSchema } from "./persistence/smart-contact-profile.schema";
import { SmartContactQrCodeSchema } from "./persistence/smart-contact-qr-code.schema";

/**
 * A third, named Mongoose connection pointed at the Smart Contact database.
 *
 * Same reasoning as `LeadDatabaseModule`: registering these four models
 * against `SMART_CONTACT_CONNECTION` makes the isolation structural rather
 * than a naming convention. No injector in this module can resolve a platform
 * model, and no platform module can resolve one of these — a `populate()`
 * across the boundary does not compile, let alone run. Repointing
 * `SMART_CONTACT_MONGODB_URI` at its own cluster then becomes a config change,
 * which is what spec §43 needs for the module to become a shared NEP service.
 *
 * The pool is small on purpose. Public contact pages are read-heavy but
 * low-volume per profile, and the writes are single-document event inserts.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      connectionName: SMART_CONTACT_CONNECTION,
      useFactory: () => {
        const config = smartContactConfig();
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
        { name: SMART_CONTACT_PROFILE_MODEL, schema: SmartContactProfileSchema },
        { name: SMART_CONTACT_QR_MODEL, schema: SmartContactQrCodeSchema },
        { name: SMART_CONTACT_EVENT_MODEL, schema: SmartContactEventSchema },
        { name: SMART_CONTACT_AUDIT_MODEL, schema: SmartContactAuditSchema },
      ],
      SMART_CONTACT_CONNECTION,
    ),
  ],
  exports: [MongooseModule],
})
export class SmartContactDatabaseModule {}
