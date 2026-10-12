-- ROLLBACK for migrations/0004_provider_wallet.sql
--
-- Not applied by `npm run db:migrate`. Run by hand, in a transaction, only when you
-- are sure the pandit wallet data should go.
--
--   1. Deploy code without the provider wallet (ProviderWalletService and its models) FIRST.
--   2. psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0004_provider_wallet.down.sql
--   3. Revert the registry / Drizzle generated files (or `npm run db:generate -- --prune`).
--
-- This drops DATA: pandit balances, the earnings ledger, payout accounts and
-- withdrawal history. Export it first; it is the record of what Tirvona owes pandits.

BEGIN;

DROP TABLE IF EXISTS "public"."provider_withdrawals";
DROP TABLE IF EXISTS "public"."provider_wallet_entries";
DROP TABLE IF EXISTS "public"."provider_payout_accounts";
DROP TABLE IF EXISTS "public"."provider_wallets";

-- Forget that the migration ran, so it can be applied again later.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0004_provider_wallet.sql';
  END IF;
END $$;

COMMIT;
