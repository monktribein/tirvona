import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CommerceService } from "./application/commerce.service";
import { MarketplaceOrderService } from "./application/marketplace-order.service";
import { COMMERCE_REPOSITORY } from "./domain/commerce.repository";
import { COMMERCE_MODELS } from "./infrastructure/persistence/commerce.schemas";
import { MARKETPLACE_ORDER_MODELS } from "./infrastructure/persistence/marketplace-order.schemas";
import { MongooseCommerceRepository } from "./infrastructure/persistence/mongoose-commerce.repository";
import {
  EnterpriseServicesController,
  MarketplaceController,
  MarketplaceHubController,
} from "./presentation/commerce.controllers";
import { MarketplaceOrderController } from "./presentation/marketplace-order.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      ...COMMERCE_MODELS,
      ...MARKETPLACE_ORDER_MODELS,
    ]),
  ],
  controllers: [
    MarketplaceOrderController,
    MarketplaceController,
    MarketplaceHubController,
    EnterpriseServicesController,
  ],
  providers: [
    CommerceService,
    MarketplaceOrderService,
    { provide: COMMERCE_REPOSITORY, useClass: MongooseCommerceRepository },
  ],
  exports: [MongooseModule],
})
export class CommerceModule {}
