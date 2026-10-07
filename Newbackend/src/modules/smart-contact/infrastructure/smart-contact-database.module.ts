import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DRIVER_URI, SMART_CONTACT_DATABASE } from "../../../database/database";
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

@Module({
  imports: [
    // Postgres schema "smart_contact" (see src/database).
    MongooseModule.forRoot(DRIVER_URI, {
      connectionName: SMART_CONTACT_CONNECTION,
      dbName: SMART_CONTACT_DATABASE,
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
