import { Module } from "@nestjs/common";
import { OrmModule } from "../../../database/orm-nest";
import { DRIVER_URI, LEAD_DATABASE, configureDatabase } from "../../../database/database";
import {
  LEAD_ATTENDANCE_MODEL,
  LEAD_CONNECTION,
  LEAD_LOCATION_PING_MODEL,
  LEAD_MODEL,
  LEAD_REGION_MODEL,
  LEAD_USER_MODEL,
} from "../domain/lead-collection.constants";
import { LeadSchema } from "./persistence/lead.schema";
import { LeadRegionSchema } from "./persistence/lead-region.schema";
import { LeadUserSchema } from "./persistence/lead-user.schema";
import { LeadAttendanceSchema } from "./persistence/lead-attendance.schema";
import { LeadLocationPingSchema } from "./persistence/lead-location-ping.schema";

@Module({
  imports: [
    OrmModule.forRootAsync({
      connectionName: LEAD_CONNECTION,
      useFactory: () => {
        configureDatabase();
        return { uri: DRIVER_URI, dbName: LEAD_DATABASE };
      },
    }),
    OrmModule.forFeature(
      [
        { name: LEAD_USER_MODEL, schema: LeadUserSchema },
        { name: LEAD_MODEL, schema: LeadSchema },
        { name: LEAD_REGION_MODEL, schema: LeadRegionSchema },
        { name: LEAD_ATTENDANCE_MODEL, schema: LeadAttendanceSchema },
        { name: LEAD_LOCATION_PING_MODEL, schema: LeadLocationPingSchema },
      ],
      LEAD_CONNECTION,
    ),
  ],
  exports: [OrmModule],
})
export class LeadDatabaseModule {}
