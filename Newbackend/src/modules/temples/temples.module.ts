import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Schema } from "mongoose";
import { TemplesController } from "./presentation/temples.controller";
import { TemplesService } from "./application/temples.service";
import { TempleSchema, TempleAartiSchema, TempleFestivalSchema } from "./infrastructure/persistence/temple.schemas";
import { AshramSchema } from "../ashrams/infrastructure/persistence/ashram.schemas";
import { ParkingLocationSchema } from "../parking/infrastructure/persistence/parking-catalogue.schemas";
import { PARKING_MODEL } from "../parking/domain/parking.constants";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Temple", schema: TempleSchema },
      { name: "TempleAarti", schema: TempleAartiSchema },
      { name: "TempleFestival", schema: TempleFestivalSchema },
      { name: "Ashram", schema: AshramSchema },
      { name: PARKING_MODEL.Location, schema: ParkingLocationSchema },
      // Read-only: powers the best-effort "nearby prasad / local services"
      // block. Permissive schema on the shared collection — matches the
      // content module's own registration so init order is irrelevant.
      { name: "LocalServiceItem", schema: new Schema({}, { strict: false, timestamps: true, collection: "localserviceitems" }) }
    ])
  ],
  controllers: [TemplesController],
  providers: [TemplesService],
  exports: [MongooseModule, TemplesService]
})
export class TemplesModule {}
