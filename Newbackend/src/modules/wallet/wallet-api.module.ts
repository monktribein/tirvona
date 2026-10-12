import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { NotificationsModule } from "../notifications/notifications.module";
import { User, UserSchema } from "../users/infrastructure/persistence/user.schema";
import { WalletAccountService } from "./application/wallet-account.service";
import { WalletModule } from "./wallet.module";
import {
  WalletAdminController,
  WalletController,
} from "./presentation/wallet.controller";

/**
 * The wallet's HTTP surface: the pilgrim's statement and transfer requests,
 * and the admin console. Kept apart from `WalletModule` because it needs
 * `NotificationsModule`, which itself imports the booking modules that
 * depend on the wallet ledger.
 */
@Module({
  imports: [
    WalletModule,
    NotificationsModule,
    OrmModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [WalletController, WalletAdminController],
  providers: [WalletAccountService],
})
export class WalletApiModule {}
