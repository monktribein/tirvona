import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CommerceService } from "./application/commerce.service";
import { COMMERCE_REPOSITORY } from "./domain/commerce.repository";
import { COMMERCE_MODELS } from "./infrastructure/persistence/commerce.schemas";
import { MongooseCommerceRepository } from "./infrastructure/persistence/mongoose-commerce.repository";
import {
  EnterpriseServicesController,
  MarketplaceController,
  MarketplaceHubController,
} from "./presentation/commerce.controllers";
@Module({
  imports: [MongooseModule.forFeature(COMMERCE_MODELS)],
  controllers: [
    MarketplaceController,
    MarketplaceHubController,
    EnterpriseServicesController,
  ],
  providers: [
    CommerceService,
    { provide: COMMERCE_REPOSITORY, useClass: MongooseCommerceRepository },
  ],
})
export class CommerceModule {}
