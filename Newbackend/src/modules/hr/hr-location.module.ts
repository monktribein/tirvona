import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { HrEmployeeSchema, HrOfficeSchema } from "./infrastructure/persistence/hr.schemas";
import { HrLocationService } from "./application/hr-location.service";
import { AshramSchema } from "../ashrams/infrastructure/persistence/ashram.schemas";

/**
 * Just the HR office lookup behind the `hr` role's location scope, so the
 * Leads, Food, Temples and Pandit modules can use it without loading HR
 * Management itself.
 */
@Module({
  imports: [
    OrmModule.forFeature([
      { name: "HrEmployee", schema: HrEmployeeSchema },
      { name: "HrOffice", schema: HrOfficeSchema },
      { name: "Ashram", schema: AshramSchema },
    ]),
  ],
  providers: [HrLocationService],
  exports: [HrLocationService],
})
export class HrLocationModule {}
