import { IsBoolean, IsOptional } from "class-validator";

/**
 * Body of every "open payment" call: whether to apply the pilgrim's wallet
 * balance first. The split itself is always worked out on the server.
 */
export class UseWalletDto {
  @IsOptional() @IsBoolean() useWallet?: boolean;
}
