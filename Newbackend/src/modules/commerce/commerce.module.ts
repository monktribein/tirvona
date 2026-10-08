import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CommerceService } from "./application/commerce.service";
import { MarketplaceAddressService } from "./application/marketplace-address.service";
import { COMMERCE_REPOSITORY } from "./domain/commerce.repository";
import { COMMERCE_MODELS } from "./infrastructure/persistence/commerce.schemas";
import { MARKETPLACE_ADDRESS_MODELS } from "./infrastructure/persistence/marketplace-address.schemas";
import { MongooseCommerceRepository } from "./infrastructure/persistence/mongoose-commerce.repository";
import {
  EnterpriseServicesController,
  MarketplaceHubController,
} from "./presentation/commerce.controllers";
import { MarketplaceAddressController } from "./presentation/marketplace-address.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      ...COMMERCE_MODELS,
      ...MARKETPLACE_ADDRESS_MODELS,
    ]),
  ],
  controllers: [
    MarketplaceAddressController,
    MarketplaceHubController,
    EnterpriseServicesController,
  ],
  providers: [
    CommerceService,
    MarketplaceAddressService,
    { provide: COMMERCE_REPOSITORY, useClass: MongooseCommerceRepository },
  ],
  exports: [MongooseModule, MarketplaceAddressService],
})
export class CommerceModule {}
