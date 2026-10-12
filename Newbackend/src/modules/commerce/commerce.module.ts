import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { CommerceService } from "./application/commerce.service";
import { MarketplaceAddressService } from "./application/marketplace-address.service";
import { COMMERCE_REPOSITORY } from "./domain/commerce.repository";
import { COMMERCE_MODELS } from "./infrastructure/persistence/commerce.schemas";
import { MARKETPLACE_ADDRESS_MODELS } from "./infrastructure/persistence/marketplace-address.schemas";
import { PgCommerceRepository } from "./infrastructure/persistence/pg-commerce.repository";
import {
  EnterpriseServicesController,
  MarketplaceHubController,
} from "./presentation/commerce.controllers";
import { MarketplaceAddressController } from "./presentation/marketplace-address.controller";

@Module({
  imports: [
    OrmModule.forFeature([
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
    { provide: COMMERCE_REPOSITORY, useClass: PgCommerceRepository },
  ],
  exports: [OrmModule, MarketplaceAddressService],
})
export class CommerceModule {}
