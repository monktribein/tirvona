import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { WalletService } from "./application/wallet.service";
import { WALLET_MODELS } from "./infrastructure/wallet.schemas";

/**
 * The wallet ledger, with no dependencies of its own, so every module that
 * takes or refunds money (stays, day stays, parking, aarti, marketplace) can
 * import it without an import cycle. The HTTP surface lives in
 * `WalletApiModule`.
 */
@Module({
  imports: [OrmModule.forFeature(WALLET_MODELS)],
  providers: [WalletService],
  exports: [OrmModule, WalletService],
})
export class WalletModule {}
