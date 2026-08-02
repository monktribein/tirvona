import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SupportService } from "./application/support.service";
import { SupportTicketSchema } from "./infrastructure/support.schema";
import { SupportController } from "./presentation/support.controller";
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "SupportTicket", schema: SupportTicketSchema },
    ]),
  ],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
