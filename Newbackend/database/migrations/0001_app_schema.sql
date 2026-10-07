-- Tirvona baseline schema for Supabase (190 tables). Applied at the 2026-10-06 cutover;

-- npm run db:migrate records it as applied on an existing database and runs it on an empty one.

BEGIN;

CREATE SCHEMA IF NOT EXISTS "leads";

REVOKE ALL ON SCHEMA "leads" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON SCHEMA "leads" FROM %s', r); END IF; END LOOP; END $$;

CREATE SCHEMA IF NOT EXISTS "smart_contact";

REVOKE ALL ON SCHEMA "smart_contact" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON SCHEMA "smart_contact" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_availability" (
  "id" text COLLATE "C" PRIMARY KEY,
  "session_id" text COLLATE "C",
  "pass_type_id" text COLLATE "C",
  "date" timestamptz,
  "total_capacity" double precision,
  "booked_count" double precision,
  "blocked_count" double precision,
  "custom_price" double precision,
  "is_closed" boolean,
  "note" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "is_verified" boolean,
  "status" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_availability" IS 'Tirvona model collection aarti_availability. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_availability"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_availability"."pass_type_id" IS 'model field: passTypeId';
COMMENT ON COLUMN "public"."aarti_availability"."total_capacity" IS 'model field: totalCapacity';
COMMENT ON COLUMN "public"."aarti_availability"."booked_count" IS 'model field: bookedCount';
COMMENT ON COLUMN "public"."aarti_availability"."blocked_count" IS 'model field: blockedCount';
COMMENT ON COLUMN "public"."aarti_availability"."custom_price" IS 'model field: customPrice';
COMMENT ON COLUMN "public"."aarti_availability"."is_closed" IS 'model field: isClosed';
COMMENT ON COLUMN "public"."aarti_availability"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_availability"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_availability"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."aarti_availability"."is_verified" IS 'model field: isVerified';
ALTER TABLE "public"."aarti_availability" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_availability_extra_372b84cd" ON "public"."aarti_availability" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_availability_ix_bdd27666" ON "public"."aarti_availability" USING btree ("session_id");
CREATE UNIQUE INDEX "aarti_availability_uq_399b1680" ON "public"."aarti_availability" USING btree ("pass_type_id", "date") NULLS NOT DISTINCT;
CREATE INDEX "aarti_availability_ix_167f4c9a" ON "public"."aarti_availability" USING btree ("session_id", "date");

REVOKE ALL ON "public"."aarti_availability" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_availability" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_bookings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_reference" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "session_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "pass_type_id" text COLLATE "C",
  "session_date" timestamptz,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "pass_count" double precision,
  "devotees" jsonb,
  "sankalp_name" text COLLATE "C",
  "sankalp_gotra" text COLLATE "C",
  "contact_name" text COLLATE "C",
  "contact_phone" text COLLATE "C",
  "contact_email" text COLLATE "C",
  "checked_in_at" timestamptz,
  "checked_in_count" double precision,
  "pricing" jsonb,
  "commission" jsonb,
  "status" text COLLATE "C",
  "payment_status" text COLLATE "C",
  "reservation_expires_at" timestamptz,
  "cancellation" jsonb,
  "history" jsonb,
  "notes" text COLLATE "C",
  "source" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_bookings" IS 'Tirvona model collection aarti_bookings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_bookings"."booking_reference" IS 'model field: bookingReference';
COMMENT ON COLUMN "public"."aarti_bookings"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."aarti_bookings"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_bookings"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_bookings"."pass_type_id" IS 'model field: passTypeId';
COMMENT ON COLUMN "public"."aarti_bookings"."session_date" IS 'model field: sessionDate';
COMMENT ON COLUMN "public"."aarti_bookings"."starts_at" IS 'model field: startsAt';
COMMENT ON COLUMN "public"."aarti_bookings"."ends_at" IS 'model field: endsAt';
COMMENT ON COLUMN "public"."aarti_bookings"."pass_count" IS 'model field: passCount';
COMMENT ON COLUMN "public"."aarti_bookings"."sankalp_name" IS 'model field: sankalpName';
COMMENT ON COLUMN "public"."aarti_bookings"."sankalp_gotra" IS 'model field: sankalpGotra';
COMMENT ON COLUMN "public"."aarti_bookings"."contact_name" IS 'model field: contactName';
COMMENT ON COLUMN "public"."aarti_bookings"."contact_phone" IS 'model field: contactPhone';
COMMENT ON COLUMN "public"."aarti_bookings"."contact_email" IS 'model field: contactEmail';
COMMENT ON COLUMN "public"."aarti_bookings"."checked_in_at" IS 'model field: checkedInAt';
COMMENT ON COLUMN "public"."aarti_bookings"."checked_in_count" IS 'model field: checkedInCount';
COMMENT ON COLUMN "public"."aarti_bookings"."payment_status" IS 'model field: paymentStatus';
COMMENT ON COLUMN "public"."aarti_bookings"."reservation_expires_at" IS 'model field: reservationExpiresAt';
COMMENT ON COLUMN "public"."aarti_bookings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_bookings"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_bookings"."version" IS 'model field: __v';
ALTER TABLE "public"."aarti_bookings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_bookings_extra_ebfd472f" ON "public"."aarti_bookings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "aarti_bookings_uq_de4e2fdb" ON "public"."aarti_bookings" USING btree ("booking_reference") NULLS NOT DISTINCT;
CREATE INDEX "aarti_bookings_ix_8331b51b" ON "public"."aarti_bookings" USING btree ("pass_type_id");
CREATE INDEX "aarti_bookings_ix_07bd3923" ON "public"."aarti_bookings" USING btree ("session_date");
CREATE INDEX "aarti_bookings_ix_1c5b4ce6" ON "public"."aarti_bookings" USING btree ("starts_at");
CREATE INDEX "aarti_bookings_ix_20b3ed65" ON "public"."aarti_bookings" USING btree ("status");
CREATE INDEX "aarti_bookings_ix_f9bfa183" ON "public"."aarti_bookings" USING btree ("payment_status");
CREATE INDEX "aarti_bookings_ix_e55dc705" ON "public"."aarti_bookings" USING btree ("customer_id", "created_at" DESC NULLS LAST);
CREATE INDEX "aarti_bookings_ix_36a27a82" ON "public"."aarti_bookings" USING btree ("session_id", "status", "session_date");
CREATE INDEX "aarti_bookings_ix_b58203d9" ON "public"."aarti_bookings" USING btree ("ashram_id", "status", "created_at" DESC NULLS LAST);
CREATE INDEX "aarti_bookings_ix_e553f74d" ON "public"."aarti_bookings" USING btree ("status", "reservation_expires_at");

REVOKE ALL ON "public"."aarti_bookings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_bookings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_commissions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "session_id" text COLLATE "C",
  "gross_amount" double precision,
  "commission_percent" double precision,
  "commission_amount" double precision,
  "ashram_earning" double precision,
  "currency" text COLLATE "C",
  "settlement_status" text COLLATE "C",
  "settled_at" timestamptz,
  "settlement_reference" text COLLATE "C",
  "payout_batch_id" text COLLATE "C",
  "reversed_at" timestamptz,
  "reversal_reason" text COLLATE "C",
  "notes" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_commissions" IS 'Tirvona model collection aarti_commissions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_commissions"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."aarti_commissions"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_commissions"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_commissions"."gross_amount" IS 'model field: grossAmount';
COMMENT ON COLUMN "public"."aarti_commissions"."commission_percent" IS 'model field: commissionPercent';
COMMENT ON COLUMN "public"."aarti_commissions"."commission_amount" IS 'model field: commissionAmount';
COMMENT ON COLUMN "public"."aarti_commissions"."ashram_earning" IS 'model field: ashramEarning';
COMMENT ON COLUMN "public"."aarti_commissions"."settlement_status" IS 'model field: settlementStatus';
COMMENT ON COLUMN "public"."aarti_commissions"."settled_at" IS 'model field: settledAt';
COMMENT ON COLUMN "public"."aarti_commissions"."settlement_reference" IS 'model field: settlementReference';
COMMENT ON COLUMN "public"."aarti_commissions"."payout_batch_id" IS 'model field: payoutBatchId';
COMMENT ON COLUMN "public"."aarti_commissions"."reversed_at" IS 'model field: reversedAt';
COMMENT ON COLUMN "public"."aarti_commissions"."reversal_reason" IS 'model field: reversalReason';
COMMENT ON COLUMN "public"."aarti_commissions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_commissions"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_commissions"."version" IS 'model field: __v';
ALTER TABLE "public"."aarti_commissions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_commissions_extra_1f4df3c3" ON "public"."aarti_commissions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "aarti_commissions_uq_68b24c9f" ON "public"."aarti_commissions" USING btree ("booking_id") NULLS NOT DISTINCT;
CREATE INDEX "aarti_commissions_ix_bdd27666" ON "public"."aarti_commissions" USING btree ("session_id");
CREATE INDEX "aarti_commissions_ix_c8ba7e6a" ON "public"."aarti_commissions" USING btree ("settlement_status");
CREATE INDEX "aarti_commissions_ix_ef517e8d" ON "public"."aarti_commissions" USING btree ("payout_batch_id");
CREATE INDEX "aarti_commissions_ix_b9650455" ON "public"."aarti_commissions" USING btree ("ashram_id", "settlement_status", "created_at");
CREATE INDEX "aarti_commissions_ix_284b9e36" ON "public"."aarti_commissions" USING btree ("settlement_status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."aarti_commissions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_commissions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_holidays" (
  "id" text COLLATE "C" PRIMARY KEY,
  "session_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "name" text COLLATE "C",
  "type" text COLLATE "C",
  "start_date" timestamptz,
  "end_date" timestamptz,
  "peak_multiplier" double precision,
  "is_closed" boolean,
  "note" text COLLATE "C",
  "is_active" boolean,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_holidays" IS 'Tirvona model collection aarti_holidays. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_holidays"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_holidays"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_holidays"."start_date" IS 'model field: startDate';
COMMENT ON COLUMN "public"."aarti_holidays"."end_date" IS 'model field: endDate';
COMMENT ON COLUMN "public"."aarti_holidays"."peak_multiplier" IS 'model field: peakMultiplier';
COMMENT ON COLUMN "public"."aarti_holidays"."is_closed" IS 'model field: isClosed';
COMMENT ON COLUMN "public"."aarti_holidays"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."aarti_holidays"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_holidays"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."aarti_holidays" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_holidays_extra_a175688a" ON "public"."aarti_holidays" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_holidays_ix_1df469bc" ON "public"."aarti_holidays" USING btree ("start_date");
CREATE INDEX "aarti_holidays_ix_91dbee2e" ON "public"."aarti_holidays" USING btree ("is_active");
CREATE INDEX "aarti_holidays_ix_3c51413c" ON "public"."aarti_holidays" USING btree ("is_active", "start_date", "end_date");

REVOKE ALL ON "public"."aarti_holidays" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_holidays" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_notifications" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "event" text COLLATE "C",
  "title" text COLLATE "C",
  "message" text COLLATE "C",
  "channel" text COLLATE "C",
  "status" text COLLATE "C",
  "recipient_phone" text COLLATE "C",
  "delivery_error" text COLLATE "C",
  "provider_message_id" text COLLATE "C",
  "sent_at" timestamptz,
  "read_at" timestamptz,
  "meta" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_notifications" IS 'Tirvona model collection aarti_notifications. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_notifications"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."aarti_notifications"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."aarti_notifications"."recipient_phone" IS 'model field: recipientPhone';
COMMENT ON COLUMN "public"."aarti_notifications"."delivery_error" IS 'model field: deliveryError';
COMMENT ON COLUMN "public"."aarti_notifications"."provider_message_id" IS 'model field: providerMessageId';
COMMENT ON COLUMN "public"."aarti_notifications"."sent_at" IS 'model field: sentAt';
COMMENT ON COLUMN "public"."aarti_notifications"."read_at" IS 'model field: readAt';
COMMENT ON COLUMN "public"."aarti_notifications"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_notifications"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_notifications"."version" IS 'model field: __v';
ALTER TABLE "public"."aarti_notifications" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_notifications_extra_d859b623" ON "public"."aarti_notifications" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_notifications_ix_2b29ad3b" ON "public"."aarti_notifications" USING btree ("event");
CREATE INDEX "aarti_notifications_ix_20b3ed65" ON "public"."aarti_notifications" USING btree ("status");
CREATE INDEX "aarti_notifications_ix_53637f3b" ON "public"."aarti_notifications" USING btree ("user_id", "created_at" DESC NULLS LAST);
CREATE INDEX "aarti_notifications_ix_38f5f0a0" ON "public"."aarti_notifications" USING btree ("user_id", "read_at");
CREATE INDEX "aarti_notifications_ix_3b44e6e0" ON "public"."aarti_notifications" USING btree ("booking_id", "event");

REVOKE ALL ON "public"."aarti_notifications" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_notifications" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_pass_types" (
  "id" text COLLATE "C" PRIMARY KEY,
  "session_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "name" text COLLATE "C",
  "code" text COLLATE "C",
  "description" text COLLATE "C",
  "base_price" double precision,
  "total_capacity" double precision,
  "max_per_booking" double precision,
  "perks" jsonb,
  "zone_label" text COLLATE "C",
  "includes_prasad" boolean,
  "includes_sankalp" boolean,
  "is_active" boolean,
  "display_order" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_pass_types" IS 'Tirvona model collection aarti_pass_types. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_pass_types"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_pass_types"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_pass_types"."base_price" IS 'model field: basePrice';
COMMENT ON COLUMN "public"."aarti_pass_types"."total_capacity" IS 'model field: totalCapacity';
COMMENT ON COLUMN "public"."aarti_pass_types"."max_per_booking" IS 'model field: maxPerBooking';
COMMENT ON COLUMN "public"."aarti_pass_types"."zone_label" IS 'model field: zoneLabel';
COMMENT ON COLUMN "public"."aarti_pass_types"."includes_prasad" IS 'model field: includesPrasad';
COMMENT ON COLUMN "public"."aarti_pass_types"."includes_sankalp" IS 'model field: includesSankalp';
COMMENT ON COLUMN "public"."aarti_pass_types"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."aarti_pass_types"."display_order" IS 'model field: displayOrder';
COMMENT ON COLUMN "public"."aarti_pass_types"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_pass_types"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_pass_types"."version" IS 'model field: __v';
ALTER TABLE "public"."aarti_pass_types" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_pass_types_extra_96d86281" ON "public"."aarti_pass_types" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_pass_types_ix_bdd27666" ON "public"."aarti_pass_types" USING btree ("session_id");
CREATE INDEX "aarti_pass_types_ix_91dbee2e" ON "public"."aarti_pass_types" USING btree ("is_active");
CREATE UNIQUE INDEX "aarti_pass_types_uq_17e79354" ON "public"."aarti_pass_types" USING btree ("session_id", "code") NULLS NOT DISTINCT;
CREATE INDEX "aarti_pass_types_ix_4b169b8f" ON "public"."aarti_pass_types" USING btree ("session_id", "is_active", "display_order");

REVOKE ALL ON "public"."aarti_pass_types" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_pass_types" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_payments" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "user_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "amount" double precision,
  "wallet_amount" double precision,
  "currency" text COLLATE "C",
  "purpose" text COLLATE "C",
  "method" text COLLATE "C",
  "status" text COLLATE "C",
  "transaction_id" text COLLATE "C",
  "gateway" jsonb,
  "failure_reason" text COLLATE "C",
  "paid_at" timestamptz,
  "refund" jsonb,
  "ip_address" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_payments" IS 'Tirvona model collection aarti_payments. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_payments"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."aarti_payments"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."aarti_payments"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_payments"."wallet_amount" IS 'model field: walletAmount';
COMMENT ON COLUMN "public"."aarti_payments"."transaction_id" IS 'model field: transactionId';
COMMENT ON COLUMN "public"."aarti_payments"."failure_reason" IS 'model field: failureReason';
COMMENT ON COLUMN "public"."aarti_payments"."paid_at" IS 'model field: paidAt';
COMMENT ON COLUMN "public"."aarti_payments"."ip_address" IS 'model field: ipAddress';
COMMENT ON COLUMN "public"."aarti_payments"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_payments"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_payments"."version" IS 'model field: __v';
ALTER TABLE "public"."aarti_payments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_payments_extra_d455dcf0" ON "public"."aarti_payments" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_payments_ix_fd6afe8d" ON "public"."aarti_payments" USING btree ("user_id");
CREATE INDEX "aarti_payments_ix_20b3ed65" ON "public"."aarti_payments" USING btree ("status");
CREATE INDEX "aarti_payments_ix_cbab8764" ON "public"."aarti_payments" USING btree ("transaction_id");
CREATE INDEX "aarti_payments_ix_360919b8" ON "public"."aarti_payments" USING btree ("booking_id", "status");
CREATE INDEX "aarti_payments_ix_b95dc735" ON "public"."aarti_payments" USING btree ("ashram_id", "status", "paid_at" DESC NULLS LAST);
CREATE INDEX "aarti_payments_ix_b79f1c74" ON "public"."aarti_payments" USING btree (("gateway" #> '{orderId}'));
CREATE UNIQUE INDEX "aarti_payments_uq_e4eb75de" ON "public"."aarti_payments" USING btree (("gateway" #> '{paymentId}')) WHERE ("gateway" #> '{paymentId}') IS NOT NULL;

REVOKE ALL ON "public"."aarti_payments" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_payments" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_pricing" (
  "id" text COLLATE "C" PRIMARY KEY,
  "session_id" text COLLATE "C",
  "pass_type_id" text COLLATE "C",
  "name" text COLLATE "C",
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "days_of_week" jsonb,
  "multiplier" double precision,
  "override_price" double precision,
  "tax_percent" double precision,
  "priority" double precision,
  "is_active" boolean,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_pricing" IS 'Tirvona model collection aarti_pricing. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_pricing"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_pricing"."pass_type_id" IS 'model field: passTypeId';
COMMENT ON COLUMN "public"."aarti_pricing"."valid_from" IS 'model field: validFrom';
COMMENT ON COLUMN "public"."aarti_pricing"."valid_until" IS 'model field: validUntil';
COMMENT ON COLUMN "public"."aarti_pricing"."days_of_week" IS 'model field: daysOfWeek';
COMMENT ON COLUMN "public"."aarti_pricing"."override_price" IS 'model field: overridePrice';
COMMENT ON COLUMN "public"."aarti_pricing"."tax_percent" IS 'model field: taxPercent';
COMMENT ON COLUMN "public"."aarti_pricing"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."aarti_pricing"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_pricing"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."aarti_pricing" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_pricing_extra_69bde349" ON "public"."aarti_pricing" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_pricing_ix_bdd27666" ON "public"."aarti_pricing" USING btree ("session_id");
CREATE INDEX "aarti_pricing_ix_91dbee2e" ON "public"."aarti_pricing" USING btree ("is_active");
CREATE INDEX "aarti_pricing_ix_5f23e595" ON "public"."aarti_pricing" USING btree ("session_id", "pass_type_id", "is_active");

REVOKE ALL ON "public"."aarti_pricing" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_pricing" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_qr_codes" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "session_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "token_hash" text COLLATE "C",
  "token" text COLLATE "C",
  "display_code" text COLLATE "C",
  "version" double precision,
  "issued_at" timestamptz,
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "entry_scanned_at" timestamptz,
  "scan_count" double precision,
  "status" text COLLATE "C",
  "revoked_reason" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version_2" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_qr_codes" IS 'Tirvona model collection aarti_qr_codes. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_qr_codes"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."aarti_qr_codes"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_qr_codes"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."aarti_qr_codes"."token_hash" IS 'model field: tokenHash';
COMMENT ON COLUMN "public"."aarti_qr_codes"."display_code" IS 'model field: displayCode';
COMMENT ON COLUMN "public"."aarti_qr_codes"."issued_at" IS 'model field: issuedAt';
COMMENT ON COLUMN "public"."aarti_qr_codes"."valid_from" IS 'model field: validFrom';
COMMENT ON COLUMN "public"."aarti_qr_codes"."valid_until" IS 'model field: validUntil';
COMMENT ON COLUMN "public"."aarti_qr_codes"."entry_scanned_at" IS 'model field: entryScannedAt';
COMMENT ON COLUMN "public"."aarti_qr_codes"."scan_count" IS 'model field: scanCount';
COMMENT ON COLUMN "public"."aarti_qr_codes"."revoked_reason" IS 'model field: revokedReason';
COMMENT ON COLUMN "public"."aarti_qr_codes"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_qr_codes"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_qr_codes"."version_2" IS 'model field: __v';
ALTER TABLE "public"."aarti_qr_codes" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_qr_codes_extra_f8eacdb9" ON "public"."aarti_qr_codes" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_qr_codes_ix_bdd27666" ON "public"."aarti_qr_codes" USING btree ("session_id");
CREATE INDEX "aarti_qr_codes_ix_435dc7a5" ON "public"."aarti_qr_codes" USING btree ("customer_id");
CREATE INDEX "aarti_qr_codes_ix_d462fecd" ON "public"."aarti_qr_codes" USING btree ("valid_until");
CREATE INDEX "aarti_qr_codes_ix_20b3ed65" ON "public"."aarti_qr_codes" USING btree ("status");
CREATE INDEX "aarti_qr_codes_ix_f7fd7d94" ON "public"."aarti_qr_codes" USING btree ("token_hash", "status");
CREATE INDEX "aarti_qr_codes_ix_736bc9b6" ON "public"."aarti_qr_codes" USING btree ("booking_id", "version" DESC NULLS LAST);
CREATE INDEX "aarti_qr_codes_ix_b8e2ab72" ON "public"."aarti_qr_codes" USING btree ("display_code");

REVOKE ALL ON "public"."aarti_qr_codes" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_qr_codes" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_reviews" (
  "id" text COLLATE "C" PRIMARY KEY,
  "session_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "rating" jsonb,
  "comment" text COLLATE "C",
  "images" jsonb,
  "status" text COLLATE "C",
  "moderation_note" text COLLATE "C",
  "moderated_by" text COLLATE "C",
  "ashram_response" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_reviews" IS 'Tirvona model collection aarti_reviews. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_reviews"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_reviews"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."aarti_reviews"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."aarti_reviews"."moderation_note" IS 'model field: moderationNote';
COMMENT ON COLUMN "public"."aarti_reviews"."moderated_by" IS 'model field: moderatedBy';
COMMENT ON COLUMN "public"."aarti_reviews"."ashram_response" IS 'model field: ashramResponse';
COMMENT ON COLUMN "public"."aarti_reviews"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_reviews"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."aarti_reviews" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_reviews_extra_91b16e23" ON "public"."aarti_reviews" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_reviews_ix_435dc7a5" ON "public"."aarti_reviews" USING btree ("customer_id");
CREATE INDEX "aarti_reviews_ix_20b3ed65" ON "public"."aarti_reviews" USING btree ("status");
CREATE UNIQUE INDEX "aarti_reviews_uq_68b24c9f" ON "public"."aarti_reviews" USING btree ("booking_id") NULLS NOT DISTINCT;
CREATE INDEX "aarti_reviews_ix_df21d4c7" ON "public"."aarti_reviews" USING btree ("session_id", "status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."aarti_reviews" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_reviews" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_scan_logs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "qr_code_id" text COLLATE "C",
  "session_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "scanned_by_user_id" text COLLATE "C",
  "scanned_by_staff_id" text COLLATE "C",
  "action" text COLLATE "C",
  "result" text COLLATE "C",
  "token_fingerprint" text COLLATE "C",
  "booking_reference" text COLLATE "C",
  "pass_count" double precision,
  "message" text COLLATE "C",
  "device_info" text COLLATE "C",
  "ip_address" text COLLATE "C",
  "scanned_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_scan_logs" IS 'Tirvona model collection aarti_scan_logs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_scan_logs"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."aarti_scan_logs"."qr_code_id" IS 'model field: qrCodeId';
COMMENT ON COLUMN "public"."aarti_scan_logs"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_scan_logs"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_scan_logs"."scanned_by_user_id" IS 'model field: scannedByUserId';
COMMENT ON COLUMN "public"."aarti_scan_logs"."scanned_by_staff_id" IS 'model field: scannedByStaffId';
COMMENT ON COLUMN "public"."aarti_scan_logs"."token_fingerprint" IS 'model field: tokenFingerprint';
COMMENT ON COLUMN "public"."aarti_scan_logs"."booking_reference" IS 'model field: bookingReference';
COMMENT ON COLUMN "public"."aarti_scan_logs"."pass_count" IS 'model field: passCount';
COMMENT ON COLUMN "public"."aarti_scan_logs"."device_info" IS 'model field: deviceInfo';
COMMENT ON COLUMN "public"."aarti_scan_logs"."ip_address" IS 'model field: ipAddress';
COMMENT ON COLUMN "public"."aarti_scan_logs"."scanned_at" IS 'model field: scannedAt';
COMMENT ON COLUMN "public"."aarti_scan_logs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_scan_logs"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_scan_logs"."version" IS 'model field: __v';
ALTER TABLE "public"."aarti_scan_logs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_scan_logs_extra_7f4a074f" ON "public"."aarti_scan_logs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_scan_logs_ix_c13d88d4" ON "public"."aarti_scan_logs" USING btree ("qr_code_id");
CREATE INDEX "aarti_scan_logs_ix_0752c4cb" ON "public"."aarti_scan_logs" USING btree ("scanned_by_user_id");
CREATE INDEX "aarti_scan_logs_ix_02cfbbe7" ON "public"."aarti_scan_logs" USING btree ("action");
CREATE INDEX "aarti_scan_logs_ix_e8872df6" ON "public"."aarti_scan_logs" USING btree ("scanned_at");
CREATE INDEX "aarti_scan_logs_ix_3cfaf518" ON "public"."aarti_scan_logs" USING btree ("session_id", "scanned_at" DESC NULLS LAST);
CREATE INDEX "aarti_scan_logs_ix_41534827" ON "public"."aarti_scan_logs" USING btree ("booking_id", "scanned_at" DESC NULLS LAST);
CREATE INDEX "aarti_scan_logs_ix_e6eba7ef" ON "public"."aarti_scan_logs" USING btree ("result", "scanned_at" DESC NULLS LAST);

REVOKE ALL ON "public"."aarti_scan_logs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_scan_logs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_sessions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "name" text COLLATE "C",
  "slug" text COLLATE "C",
  "kind" text COLLATE "C",
  "deity" text COLLATE "C",
  "description" text COLLATE "C",
  "ritual_notes" text COLLATE "C",
  "dress_code" text COLLATE "C",
  "instructions" text COLLATE "C",
  "terms_and_conditions" text COLLATE "C",
  "images" jsonb,
  "cover_image" text COLLATE "C",
  "venue" jsonb,
  "geo" jsonb,
  "latitude" double precision,
  "longitude" double precision,
  "google_maps_url" text COLLATE "C",
  "start_time" text COLLATE "C",
  "duration_minutes" double precision,
  "days_of_week" jsonb,
  "start_date" timestamptz,
  "end_date" timestamptz,
  "timezone" text COLLATE "C",
  "facilities" jsonb,
  "contact_phone" text COLLATE "C",
  "contact_email" text COLLATE "C",
  "total_capacity" double precision,
  "commission_percent" double precision,
  "is_featured" boolean,
  "allow_live_stream" boolean,
  "status" text COLLATE "C",
  "submitted_at" timestamptz,
  "approved_at" timestamptz,
  "approved_by" text COLLATE "C",
  "rejection_reason" text COLLATE "C",
  "rating" jsonb,
  "view_count" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "category" text COLLATE "C",
  "details" text COLLATE "C",
  "gallery" text[] COLLATE "C",
  "image" text COLLATE "C",
  "image_url" text COLLATE "C",
  "is_verified" boolean,
  "title" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_sessions" IS 'Tirvona model collection aarti_sessions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_sessions"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_sessions"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."aarti_sessions"."ritual_notes" IS 'model field: ritualNotes';
COMMENT ON COLUMN "public"."aarti_sessions"."dress_code" IS 'model field: dressCode';
COMMENT ON COLUMN "public"."aarti_sessions"."terms_and_conditions" IS 'model field: termsAndConditions';
COMMENT ON COLUMN "public"."aarti_sessions"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."aarti_sessions"."google_maps_url" IS 'model field: googleMapsUrl';
COMMENT ON COLUMN "public"."aarti_sessions"."start_time" IS 'model field: startTime';
COMMENT ON COLUMN "public"."aarti_sessions"."duration_minutes" IS 'model field: durationMinutes';
COMMENT ON COLUMN "public"."aarti_sessions"."days_of_week" IS 'model field: daysOfWeek';
COMMENT ON COLUMN "public"."aarti_sessions"."start_date" IS 'model field: startDate';
COMMENT ON COLUMN "public"."aarti_sessions"."end_date" IS 'model field: endDate';
COMMENT ON COLUMN "public"."aarti_sessions"."contact_phone" IS 'model field: contactPhone';
COMMENT ON COLUMN "public"."aarti_sessions"."contact_email" IS 'model field: contactEmail';
COMMENT ON COLUMN "public"."aarti_sessions"."total_capacity" IS 'model field: totalCapacity';
COMMENT ON COLUMN "public"."aarti_sessions"."commission_percent" IS 'model field: commissionPercent';
COMMENT ON COLUMN "public"."aarti_sessions"."is_featured" IS 'model field: isFeatured';
COMMENT ON COLUMN "public"."aarti_sessions"."allow_live_stream" IS 'model field: allowLiveStream';
COMMENT ON COLUMN "public"."aarti_sessions"."submitted_at" IS 'model field: submittedAt';
COMMENT ON COLUMN "public"."aarti_sessions"."approved_at" IS 'model field: approvedAt';
COMMENT ON COLUMN "public"."aarti_sessions"."approved_by" IS 'model field: approvedBy';
COMMENT ON COLUMN "public"."aarti_sessions"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."aarti_sessions"."view_count" IS 'model field: viewCount';
COMMENT ON COLUMN "public"."aarti_sessions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_sessions"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_sessions"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."aarti_sessions"."image_url" IS 'model field: imageUrl';
COMMENT ON COLUMN "public"."aarti_sessions"."is_verified" IS 'model field: isVerified';
ALTER TABLE "public"."aarti_sessions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_sessions_extra_28560f85" ON "public"."aarti_sessions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_sessions_ix_4c90543b" ON "public"."aarti_sessions" USING btree ("ashram_id");
CREATE INDEX "aarti_sessions_ix_8f882ef5" ON "public"."aarti_sessions" USING btree ("owner_id");
CREATE UNIQUE INDEX "aarti_sessions_uq_7a0923dd" ON "public"."aarti_sessions" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "aarti_sessions_ix_44590a62" ON "public"."aarti_sessions" USING btree ("kind");
CREATE INDEX "aarti_sessions_ix_dcf03ed6" ON "public"."aarti_sessions" USING btree (("venue" #> '{city}'));
CREATE INDEX "aarti_sessions_ix_90bc5a5a" ON "public"."aarti_sessions" USING btree (("venue" #> '{state}'));
CREATE INDEX "aarti_sessions_ix_d5e5ae6e" ON "public"."aarti_sessions" USING btree ("is_featured");
CREATE INDEX "aarti_sessions_ix_20b3ed65" ON "public"."aarti_sessions" USING btree ("status");
CREATE INDEX "aarti_sessions_ix_defbfda4" ON "public"."aarti_sessions" USING btree ("status", "is_featured" DESC NULLS LAST, "created_at" DESC NULLS LAST);
CREATE INDEX "aarti_sessions_ix_20e39220" ON "public"."aarti_sessions" USING btree ("ashram_id", "status");
CREATE INDEX "aarti_sessions_ix_066aeca0" ON "public"."aarti_sessions" USING btree (("venue" #> '{city}'), "status");
CREATE INDEX "aarti_sessions_ix_f349009c" ON "public"."aarti_sessions" USING btree ("owner_id", "status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."aarti_sessions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_sessions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_settings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "scope" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "session_id" text COLLATE "C",
  "reservation_hold_minutes" double precision,
  "gate_opens_before_minutes" double precision,
  "gate_closes_after_minutes" double precision,
  "no_show_after_minutes" double precision,
  "commission_percent" double precision,
  "tax_percent" double precision,
  "max_passes_per_booking" double precision,
  "booking_opens_days_ahead" double precision,
  "booking_closes_before_minutes" double precision,
  "free_cancellation_hours" double precision,
  "refund_percent_inside_window" double precision,
  "refund_percent_outside_window" double precision,
  "qr_validity_buffer_minutes" double precision,
  "allow_online_booking" boolean,
  "allow_cancellation" boolean,
  "require_devotee_names" boolean,
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_settings" IS 'Tirvona model collection aarti_settings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_settings"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_settings"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_settings"."reservation_hold_minutes" IS 'model field: reservationHoldMinutes';
COMMENT ON COLUMN "public"."aarti_settings"."gate_opens_before_minutes" IS 'model field: gateOpensBeforeMinutes';
COMMENT ON COLUMN "public"."aarti_settings"."gate_closes_after_minutes" IS 'model field: gateClosesAfterMinutes';
COMMENT ON COLUMN "public"."aarti_settings"."no_show_after_minutes" IS 'model field: noShowAfterMinutes';
COMMENT ON COLUMN "public"."aarti_settings"."commission_percent" IS 'model field: commissionPercent';
COMMENT ON COLUMN "public"."aarti_settings"."tax_percent" IS 'model field: taxPercent';
COMMENT ON COLUMN "public"."aarti_settings"."max_passes_per_booking" IS 'model field: maxPassesPerBooking';
COMMENT ON COLUMN "public"."aarti_settings"."booking_opens_days_ahead" IS 'model field: bookingOpensDaysAhead';
COMMENT ON COLUMN "public"."aarti_settings"."booking_closes_before_minutes" IS 'model field: bookingClosesBeforeMinutes';
COMMENT ON COLUMN "public"."aarti_settings"."free_cancellation_hours" IS 'model field: freeCancellationHours';
COMMENT ON COLUMN "public"."aarti_settings"."refund_percent_inside_window" IS 'model field: refundPercentInsideWindow';
COMMENT ON COLUMN "public"."aarti_settings"."refund_percent_outside_window" IS 'model field: refundPercentOutsideWindow';
COMMENT ON COLUMN "public"."aarti_settings"."qr_validity_buffer_minutes" IS 'model field: qrValidityBufferMinutes';
COMMENT ON COLUMN "public"."aarti_settings"."allow_online_booking" IS 'model field: allowOnlineBooking';
COMMENT ON COLUMN "public"."aarti_settings"."allow_cancellation" IS 'model field: allowCancellation';
COMMENT ON COLUMN "public"."aarti_settings"."require_devotee_names" IS 'model field: requireDevoteeNames';
COMMENT ON COLUMN "public"."aarti_settings"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."aarti_settings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_settings"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."aarti_settings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_settings_extra_ca4a9c54" ON "public"."aarti_settings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_settings_ix_5cee787c" ON "public"."aarti_settings" USING btree ("scope");
CREATE INDEX "aarti_settings_ix_e5685a4c" ON "public"."aarti_settings" USING btree ("scope", "ashram_id", "session_id");

REVOKE ALL ON "public"."aarti_settings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_settings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_staff" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "session_ids" jsonb,
  "aarti_role" text COLLATE "C",
  "capability_overrides" jsonb,
  "employee_code" text COLLATE "C",
  "phone" text COLLATE "C",
  "shift" text COLLATE "C",
  "status" text COLLATE "C",
  "last_active_at" timestamptz,
  "created_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_staff" IS 'Tirvona model collection aarti_staff. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_staff"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."aarti_staff"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_staff"."session_ids" IS 'model field: sessionIds';
COMMENT ON COLUMN "public"."aarti_staff"."aarti_role" IS 'model field: aartiRole';
COMMENT ON COLUMN "public"."aarti_staff"."capability_overrides" IS 'model field: capabilityOverrides';
COMMENT ON COLUMN "public"."aarti_staff"."employee_code" IS 'model field: employeeCode';
COMMENT ON COLUMN "public"."aarti_staff"."last_active_at" IS 'model field: lastActiveAt';
COMMENT ON COLUMN "public"."aarti_staff"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."aarti_staff"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_staff"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."aarti_staff" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_staff_extra_5f85da4a" ON "public"."aarti_staff" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_staff_ix_fd6afe8d" ON "public"."aarti_staff" USING btree ("user_id");
CREATE INDEX "aarti_staff_ix_4c90543b" ON "public"."aarti_staff" USING btree ("ashram_id");
CREATE INDEX "aarti_staff_ix_0c8b4f38" ON "public"."aarti_staff" USING btree ("aarti_role");
CREATE INDEX "aarti_staff_ix_20b3ed65" ON "public"."aarti_staff" USING btree ("status");
CREATE INDEX "aarti_staff_ix_9b647de0" ON "public"."aarti_staff" USING btree ("user_id", "status");
CREATE INDEX "aarti_staff_ix_892a61b7" ON "public"."aarti_staff" USING btree ("ashram_id", "aarti_role", "status");

REVOKE ALL ON "public"."aarti_staff" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_staff" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_streams" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "session_id" text COLLATE "C",
  "title" text COLLATE "C",
  "slug" text COLLATE "C",
  "description" text COLLATE "C",
  "deity" text COLLATE "C",
  "provider" text COLLATE "C",
  "stream_url" text COLLATE "C",
  "embed_url" text COLLATE "C",
  "thumbnail_url" text COLLATE "C",
  "venue_name" text COLLATE "C",
  "city" text COLLATE "C",
  "state" text COLLATE "C",
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "recurrence_days" jsonb,
  "is_live" boolean,
  "is_featured" boolean,
  "status" text COLLATE "C",
  "submitted_at" timestamptz,
  "approved_at" timestamptz,
  "approved_by" text COLLATE "C",
  "rejection_reason" text COLLATE "C",
  "view_count" double precision,
  "last_live_at" timestamptz,
  "display_order" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_streams" IS 'Tirvona model collection aarti_streams. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_streams"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_streams"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."aarti_streams"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_streams"."stream_url" IS 'model field: streamUrl';
COMMENT ON COLUMN "public"."aarti_streams"."embed_url" IS 'model field: embedUrl';
COMMENT ON COLUMN "public"."aarti_streams"."thumbnail_url" IS 'model field: thumbnailUrl';
COMMENT ON COLUMN "public"."aarti_streams"."venue_name" IS 'model field: venueName';
COMMENT ON COLUMN "public"."aarti_streams"."starts_at" IS 'model field: startsAt';
COMMENT ON COLUMN "public"."aarti_streams"."ends_at" IS 'model field: endsAt';
COMMENT ON COLUMN "public"."aarti_streams"."recurrence_days" IS 'model field: recurrenceDays';
COMMENT ON COLUMN "public"."aarti_streams"."is_live" IS 'model field: isLive';
COMMENT ON COLUMN "public"."aarti_streams"."is_featured" IS 'model field: isFeatured';
COMMENT ON COLUMN "public"."aarti_streams"."submitted_at" IS 'model field: submittedAt';
COMMENT ON COLUMN "public"."aarti_streams"."approved_at" IS 'model field: approvedAt';
COMMENT ON COLUMN "public"."aarti_streams"."approved_by" IS 'model field: approvedBy';
COMMENT ON COLUMN "public"."aarti_streams"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."aarti_streams"."view_count" IS 'model field: viewCount';
COMMENT ON COLUMN "public"."aarti_streams"."last_live_at" IS 'model field: lastLiveAt';
COMMENT ON COLUMN "public"."aarti_streams"."display_order" IS 'model field: displayOrder';
COMMENT ON COLUMN "public"."aarti_streams"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_streams"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_streams"."version" IS 'model field: __v';
ALTER TABLE "public"."aarti_streams" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_streams_extra_e82a2f66" ON "public"."aarti_streams" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_streams_ix_4c90543b" ON "public"."aarti_streams" USING btree ("ashram_id");
CREATE INDEX "aarti_streams_ix_8f882ef5" ON "public"."aarti_streams" USING btree ("owner_id");
CREATE UNIQUE INDEX "aarti_streams_uq_7a0923dd" ON "public"."aarti_streams" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "aarti_streams_ix_9e1bd0bf" ON "public"."aarti_streams" USING btree ("city");
CREATE INDEX "aarti_streams_ix_1c5b4ce6" ON "public"."aarti_streams" USING btree ("starts_at");
CREATE INDEX "aarti_streams_ix_31e3726a" ON "public"."aarti_streams" USING btree ("is_live");
CREATE INDEX "aarti_streams_ix_d5e5ae6e" ON "public"."aarti_streams" USING btree ("is_featured");
CREATE INDEX "aarti_streams_ix_20b3ed65" ON "public"."aarti_streams" USING btree ("status");
CREATE INDEX "aarti_streams_ix_b0066c30" ON "public"."aarti_streams" USING btree ("status", "is_featured" DESC NULLS LAST, "starts_at" DESC NULLS LAST);
CREATE INDEX "aarti_streams_ix_20e39220" ON "public"."aarti_streams" USING btree ("ashram_id", "status");
CREATE INDEX "aarti_streams_ix_06bc4f25" ON "public"."aarti_streams" USING btree ("status", "starts_at", "ends_at");

REVOKE ALL ON "public"."aarti_streams" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_streams" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."aarti_transactions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "payment_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "session_id" text COLLATE "C",
  "type" text COLLATE "C",
  "amount" double precision,
  "currency" text COLLATE "C",
  "direction" text COLLATE "C",
  "description" text COLLATE "C",
  "reference" text COLLATE "C",
  "meta" jsonb,
  "recorded_by" text COLLATE "C",
  "occurred_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."aarti_transactions" IS 'Tirvona model collection aarti_transactions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."aarti_transactions"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."aarti_transactions"."payment_id" IS 'model field: paymentId';
COMMENT ON COLUMN "public"."aarti_transactions"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."aarti_transactions"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."aarti_transactions"."recorded_by" IS 'model field: recordedBy';
COMMENT ON COLUMN "public"."aarti_transactions"."occurred_at" IS 'model field: occurredAt';
COMMENT ON COLUMN "public"."aarti_transactions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."aarti_transactions"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."aarti_transactions"."version" IS 'model field: __v';
ALTER TABLE "public"."aarti_transactions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "aarti_transactions_extra_1d56ae27" ON "public"."aarti_transactions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "aarti_transactions_ix_caf0121a" ON "public"."aarti_transactions" USING btree ("booking_id");
CREATE INDEX "aarti_transactions_ix_80649481" ON "public"."aarti_transactions" USING btree ("payment_id");
CREATE UNIQUE INDEX "aarti_transactions_uq_43515549" ON "public"."aarti_transactions" USING btree ("reference") NULLS NOT DISTINCT;
CREATE INDEX "aarti_transactions_ix_8e3be854" ON "public"."aarti_transactions" USING btree ("occurred_at");
CREATE INDEX "aarti_transactions_ix_c44cc40d" ON "public"."aarti_transactions" USING btree ("ashram_id", "type", "occurred_at" DESC NULLS LAST);
CREATE INDEX "aarti_transactions_ix_8e2bf058" ON "public"."aarti_transactions" USING btree ("session_id", "occurred_at" DESC NULLS LAST);
CREATE INDEX "aarti_transactions_ix_88e4b838" ON "public"."aarti_transactions" USING btree ("type", "occurred_at" DESC NULLS LAST);

REVOKE ALL ON "public"."aarti_transactions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."aarti_transactions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."activitylogs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "activity_id" text COLLATE "C",
  "user_id" text COLLATE "C",
  "timestamp" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "action" text COLLATE "C",
  "description" text COLLATE "C",
  "module" text COLLATE "C",
  "role" text COLLATE "C",
  "severity" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."activitylogs" IS 'Tirvona model collection activitylogs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."activitylogs"."activity_id" IS 'model field: activityId';
COMMENT ON COLUMN "public"."activitylogs"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."activitylogs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."activitylogs"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."activitylogs"."version" IS 'model field: __v';
ALTER TABLE "public"."activitylogs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "activitylogs_extra_68dcb1bd" ON "public"."activitylogs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "activitylogs_uq_4627fedb" ON "public"."activitylogs" USING btree ("activity_id") NULLS NOT DISTINCT;
CREATE INDEX "activitylogs_ix_c29811c4" ON "public"."activitylogs" USING btree ("timestamp");
CREATE INDEX "activitylogs_ix_080c2215" ON "public"."activitylogs" USING btree ("timestamp" DESC NULLS LAST);
CREATE INDEX "activitylogs_ix_9491ad72" ON "public"."activitylogs" USING btree ("user_id", "timestamp" DESC NULLS LAST);
CREATE INDEX "activitylogs_ix_785fd5ee" ON "public"."activitylogs" USING btree ("module", "timestamp" DESC NULLS LAST);
CREATE INDEX "activitylogs_ix_ba758ae1" ON "public"."activitylogs" USING btree ("action", "timestamp" DESC NULLS LAST);
CREATE INDEX "activitylogs_ix_1d4efdd6" ON "public"."activitylogs" USING btree ("severity", "timestamp" DESC NULLS LAST);
CREATE INDEX "activitylogs_ix_fd6afe8d" ON "public"."activitylogs" USING btree ("user_id");
CREATE INDEX "activitylogs_ix_0fd3975b" ON "public"."activitylogs" USING btree ("module");
CREATE INDEX "activitylogs_ix_02cfbbe7" ON "public"."activitylogs" USING btree ("action");
CREATE INDEX "activitylogs_ix_b69d296c" ON "public"."activitylogs" USING btree ("severity");

REVOKE ALL ON "public"."activitylogs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."activitylogs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."approval_requests" (
  "id" text COLLATE "C" PRIMARY KEY,
  "request_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "stay_admin_id" text COLLATE "C",
  "reviewed_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."approval_requests" IS 'Tirvona model collection approval_requests. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."approval_requests"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."approval_requests"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."approval_requests"."stay_admin_id" IS 'model field: stayAdminId';
COMMENT ON COLUMN "public"."approval_requests"."reviewed_by" IS 'model field: reviewedBy';
COMMENT ON COLUMN "public"."approval_requests"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."approval_requests"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."approval_requests" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "approval_requests_extra_d26beaad" ON "public"."approval_requests" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "approval_requests_uq_36e5cac1" ON "public"."approval_requests" USING btree ("request_id") NULLS NOT DISTINCT;
CREATE INDEX "approval_requests_ix_a1cd3c17" ON "public"."approval_requests" USING btree ("stay_admin_id");

REVOKE ALL ON "public"."approval_requests" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."approval_requests" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."ashrams" (
  "id" text COLLATE "C" PRIMARY KEY,
  "owner_id" text COLLATE "C",
  "ashram_code" text COLLATE "C",
  "slug" text COLLATE "C",
  "city_slug" text COLLATE "C",
  "name" text COLLATE "C",
  "tagline" text COLLATE "C",
  "ashram_type" text COLLATE "C",
  "languages" text COLLATE "C",
  "primary_languages" jsonb,
  "established_year" text COLLATE "C",
  "founded_by" text COLLATE "C",
  "description" text COLLATE "C",
  "history" text COLLATE "C",
  "contact" jsonb,
  "trust" jsonb,
  "activities" jsonb,
  "daily_schedule" text COLLATE "C",
  "special_events" text COLLATE "C",
  "pricing" jsonb,
  "policies" jsonb,
  "food" jsonb,
  "transport" jsonb,
  "medical" jsonb,
  "nearby_attractions" jsonb,
  "rules" jsonb,
  "address" jsonb,
  "amenities" jsonb,
  "add_on_services" jsonb,
  "documents" jsonb,
  "images" jsonb,
  "virtual_tour360" jsonb,
  "videos" jsonb,
  "rating" jsonb,
  "is_verified" boolean,
  "status" text COLLATE "C",
  "rejection_reason" text COLLATE "C",
  "booking_paused" boolean,
  "booking_paused_at" timestamptz,
  "availability_request" jsonb,
  "inspection_details" jsonb,
  "day_stay_config" jsonb,
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "deleted_at" timestamptz,
  "deleted_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "category" text COLLATE "C",
  "city" text COLLATE "C",
  "cover_image" text COLLATE "C",
  "device_type" text COLLATE "C",
  "district" text COLLATE "C",
  "email" text COLLATE "C",
  "fire_safety_certificate_url" text COLLATE "C",
  "gallery" text[] COLLATE "C",
  "image" text COLLATE "C",
  "image_url" text COLLATE "C",
  "land_ownership_url" text COLLATE "C",
  "phone" text COLLATE "C",
  "pincode" text COLLATE "C",
  "section" text COLLATE "C",
  "state" text COLLATE "C",
  "street" text COLLATE "C",
  "title" text COLLATE "C",
  "trust_deed_url" text COLLATE "C",
  "upload_notes" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."ashrams" IS 'Tirvona model collection ashrams. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."ashrams"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."ashrams"."ashram_code" IS 'model field: ashramCode';
COMMENT ON COLUMN "public"."ashrams"."city_slug" IS 'model field: citySlug';
COMMENT ON COLUMN "public"."ashrams"."ashram_type" IS 'model field: ashramType';
COMMENT ON COLUMN "public"."ashrams"."primary_languages" IS 'model field: primaryLanguages';
COMMENT ON COLUMN "public"."ashrams"."established_year" IS 'model field: establishedYear';
COMMENT ON COLUMN "public"."ashrams"."founded_by" IS 'model field: foundedBy';
COMMENT ON COLUMN "public"."ashrams"."daily_schedule" IS 'model field: dailySchedule';
COMMENT ON COLUMN "public"."ashrams"."special_events" IS 'model field: specialEvents';
COMMENT ON COLUMN "public"."ashrams"."nearby_attractions" IS 'model field: nearbyAttractions';
COMMENT ON COLUMN "public"."ashrams"."add_on_services" IS 'model field: addOnServices';
COMMENT ON COLUMN "public"."ashrams"."virtual_tour360" IS 'model field: virtualTour360';
COMMENT ON COLUMN "public"."ashrams"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."ashrams"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."ashrams"."booking_paused" IS 'model field: bookingPaused';
COMMENT ON COLUMN "public"."ashrams"."booking_paused_at" IS 'model field: bookingPausedAt';
COMMENT ON COLUMN "public"."ashrams"."availability_request" IS 'model field: availabilityRequest';
COMMENT ON COLUMN "public"."ashrams"."inspection_details" IS 'model field: inspectionDetails';
COMMENT ON COLUMN "public"."ashrams"."day_stay_config" IS 'model field: dayStayConfig';
COMMENT ON COLUMN "public"."ashrams"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."ashrams"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."ashrams"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."ashrams"."deleted_by" IS 'model field: deletedBy';
COMMENT ON COLUMN "public"."ashrams"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."ashrams"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."ashrams"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."ashrams"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."ashrams"."device_type" IS 'model field: deviceType';
COMMENT ON COLUMN "public"."ashrams"."fire_safety_certificate_url" IS 'model field: fireSafetyCertificateUrl';
COMMENT ON COLUMN "public"."ashrams"."image_url" IS 'model field: imageUrl';
COMMENT ON COLUMN "public"."ashrams"."land_ownership_url" IS 'model field: landOwnershipUrl';
COMMENT ON COLUMN "public"."ashrams"."trust_deed_url" IS 'model field: trustDeedUrl';
COMMENT ON COLUMN "public"."ashrams"."upload_notes" IS 'model field: uploadNotes';
ALTER TABLE "public"."ashrams" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "ashrams_extra_d7f3133d" ON "public"."ashrams" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "ashrams_uq_cc0ffcf1" ON "public"."ashrams" USING btree ("ashram_code") WHERE "ashram_code" IS NOT NULL;
CREATE INDEX "ashrams_ix_97852cf5" ON "public"."ashrams" USING btree ("slug") WHERE "slug" IS NOT NULL;
CREATE INDEX "ashrams_ix_c80d9343" ON "public"."ashrams" USING btree ("city_slug") WHERE "city_slug" IS NOT NULL;
CREATE INDEX "ashrams_ix_20b3ed65" ON "public"."ashrams" USING btree ("status");
CREATE INDEX "ashrams_ix_80e609ca" ON "public"."ashrams" USING btree ("booking_paused");
CREATE INDEX "ashrams_ix_290ee89e" ON "public"."ashrams" USING btree (("day_stay_config" #> '{enabled}'));
CREATE INDEX "ashrams_ix_460c8d22" ON "public"."ashrams" USING btree (("day_stay_config" #> '{verificationStatus}'));
CREATE UNIQUE INDEX "ashrams_uq_a6a2d266" ON "public"."ashrams" USING btree (("trust" #> '{trustRegNo}')) NULLS NOT DISTINCT WHERE jsonb_typeof(("trust" #> '{trustRegNo}')) = 'string' AND (("trust" #> '{trustRegNo}') #>> '{}') > '';
CREATE UNIQUE INDEX "ashrams_uq_14ca5212" ON "public"."ashrams" USING btree (("trust" #> '{panNo}')) NULLS NOT DISTINCT WHERE jsonb_typeof(("trust" #> '{panNo}')) = 'string' AND (("trust" #> '{panNo}') #>> '{}') > '';
CREATE UNIQUE INDEX "ashrams_uq_149e964b" ON "public"."ashrams" USING btree ("city_slug", "slug") NULLS NOT DISTINCT WHERE "city_slug" IS NOT NULL AND "slug" IS NOT NULL;
CREATE INDEX "ashrams_ix_8f882ef5" ON "public"."ashrams" USING btree ("owner_id");
CREATE INDEX "ashrams_ix_a715e4d7" ON "public"."ashrams" USING btree ("status", ("address" #> '{city}'), ("rating" #> '{average}') DESC NULLS LAST);
CREATE INDEX "ashrams_ix_e5cd4674" ON "public"."ashrams" USING btree ("status", ("rating" #> '{average}') DESC NULLS LAST);
CREATE INDEX "ashrams_ix_5ab0a035" ON "public"."ashrams" USING btree (("day_stay_config" #> '{enabled}'), ("day_stay_config" #> '{verificationStatus}'));
CREATE INDEX "ashrams_ix_d45b6435" ON "public"."ashrams" USING btree ("status", ("address" #> '{city}'));
CREATE INDEX "ashrams_ix_2285f1b0" ON "public"."ashrams" USING btree ("is_verified", "status");

REVOKE ALL ON "public"."ashrams" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."ashrams" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."audit_logs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "action" text COLLATE "C",
  "module" text COLLATE "C",
  "details" jsonb,
  "before" jsonb,
  "after" jsonb,
  "ip_address" text COLLATE "C",
  "user_agent" text COLLATE "C",
  "request_id" text COLLATE "C",
  "timestamp" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."audit_logs" IS 'Tirvona model collection audit_logs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."audit_logs"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."audit_logs"."ip_address" IS 'model field: ipAddress';
COMMENT ON COLUMN "public"."audit_logs"."user_agent" IS 'model field: userAgent';
COMMENT ON COLUMN "public"."audit_logs"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."audit_logs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."audit_logs"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."audit_logs"."version" IS 'model field: __v';
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "audit_logs_extra_8e4da115" ON "public"."audit_logs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "audit_logs_ix_02cfbbe7" ON "public"."audit_logs" USING btree ("action");
CREATE INDEX "audit_logs_ix_0fd3975b" ON "public"."audit_logs" USING btree ("module");
CREATE INDEX "audit_logs_ix_c29811c4" ON "public"."audit_logs" USING btree ("timestamp");
CREATE INDEX "audit_logs_ix_7836fb41" ON "public"."audit_logs" USING btree ("module", "action", "timestamp" DESC NULLS LAST);

REVOKE ALL ON "public"."audit_logs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."audit_logs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."auditlogs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "action" text COLLATE "C",
  "details" jsonb,
  "ip_address" text COLLATE "C",
  "module" text COLLATE "C",
  "timestamp" timestamptz,
  "user_agent" text COLLATE "C",
  "user_id" jsonb,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."auditlogs" IS 'Tirvona model collection auditlogs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."auditlogs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."auditlogs"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."auditlogs"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."auditlogs"."ip_address" IS 'model field: ipAddress';
COMMENT ON COLUMN "public"."auditlogs"."user_agent" IS 'model field: userAgent';
COMMENT ON COLUMN "public"."auditlogs"."user_id" IS 'model field: userId';
ALTER TABLE "public"."auditlogs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "auditlogs_extra_9f5bb3ea" ON "public"."auditlogs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "auditlogs_ix_080c2215" ON "public"."auditlogs" USING btree ("timestamp" DESC NULLS LAST);
CREATE INDEX "auditlogs_ix_785fd5ee" ON "public"."auditlogs" USING btree ("module", "timestamp" DESC NULLS LAST);
CREATE INDEX "auditlogs_ix_9491ad72" ON "public"."auditlogs" USING btree ("user_id", "timestamp" DESC NULLS LAST);
CREATE INDEX "auditlogs_ix_ba758ae1" ON "public"."auditlogs" USING btree ("action", "timestamp" DESC NULLS LAST);
CREATE INDEX "auditlogs_ix_fd6afe8d" ON "public"."auditlogs" USING btree ("user_id");
CREATE INDEX "auditlogs_ix_0fd3975b" ON "public"."auditlogs" USING btree ("module");

REVOKE ALL ON "public"."auditlogs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."auditlogs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."auth_challenges" (
  "id" text COLLATE "C" PRIMARY KEY,
  "token_hash" text COLLATE "C",
  "code_hash" text COLLATE "C",
  "purpose" text COLLATE "C",
  "identifier" text COLLATE "C",
  "payload" jsonb,
  "attempts" double precision,
  "max_attempts" double precision,
  "resend_available_at" timestamptz,
  "verified_at" timestamptz,
  "consumed_at" timestamptz,
  "expires_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."auth_challenges" IS 'Tirvona model collection auth_challenges. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."auth_challenges"."token_hash" IS 'model field: tokenHash';
COMMENT ON COLUMN "public"."auth_challenges"."code_hash" IS 'model field: codeHash';
COMMENT ON COLUMN "public"."auth_challenges"."max_attempts" IS 'model field: maxAttempts';
COMMENT ON COLUMN "public"."auth_challenges"."resend_available_at" IS 'model field: resendAvailableAt';
COMMENT ON COLUMN "public"."auth_challenges"."verified_at" IS 'model field: verifiedAt';
COMMENT ON COLUMN "public"."auth_challenges"."consumed_at" IS 'model field: consumedAt';
COMMENT ON COLUMN "public"."auth_challenges"."expires_at" IS 'model field: expiresAt';
COMMENT ON COLUMN "public"."auth_challenges"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."auth_challenges"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."auth_challenges"."version" IS 'model field: __v';
ALTER TABLE "public"."auth_challenges" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "auth_challenges_extra_83a7a91e" ON "public"."auth_challenges" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "auth_challenges_uq_d65c364f" ON "public"."auth_challenges" USING btree ("token_hash") NULLS NOT DISTINCT;
CREATE INDEX "auth_challenges_ix_618c3557" ON "public"."auth_challenges" USING btree ("purpose");
CREATE INDEX "auth_challenges_ix_d113755e" ON "public"."auth_challenges" USING btree ("identifier");
CREATE INDEX "auth_challenges_ix_9c74f8a1" ON "public"."auth_challenges" USING btree ("expires_at");
CREATE INDEX "auth_challenges_ix_82f2d12e" ON "public"."auth_challenges" USING btree ("identifier", "purpose", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."auth_challenges" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."auth_challenges" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."banners" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "category" text COLLATE "C",
  "cover_image" text COLLATE "C",
  "created_by" text COLLATE "C",
  "device_type" text COLLATE "C",
  "gallery" text[] COLLATE "C",
  "image" text COLLATE "C",
  "images" text[] COLLATE "C",
  "image_url" text COLLATE "C",
  "is_verified" boolean,
  "link_url" text COLLATE "C",
  "section" text COLLATE "C",
  "status" text COLLATE "C",
  "title" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."banners" IS 'Tirvona model collection banners. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."banners"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."banners"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."banners"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."banners"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."banners"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."banners"."device_type" IS 'model field: deviceType';
COMMENT ON COLUMN "public"."banners"."image_url" IS 'model field: imageUrl';
COMMENT ON COLUMN "public"."banners"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."banners"."link_url" IS 'model field: linkUrl';
ALTER TABLE "public"."banners" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "banners_extra_2f83e48a" ON "public"."banners" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "banners_ix_82abfc2f" ON "public"."banners" USING btree ("status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."banners" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."banners" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."blogauthors" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."blogauthors" IS 'Tirvona model collection blogauthors. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."blogauthors"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."blogauthors"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."blogauthors" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "blogauthors_extra_7badb112" ON "public"."blogauthors" USING gin ("_extra") WHERE "_extra" IS NOT NULL;

REVOKE ALL ON "public"."blogauthors" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."blogauthors" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."blogcomments" (
  "id" text COLLATE "C" PRIMARY KEY,
  "post_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "comment" text COLLATE "C",
  "rating" double precision,
  "status" text COLLATE "C",
  "user_email" text COLLATE "C",
  "user_name" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."blogcomments" IS 'Tirvona model collection blogcomments. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."blogcomments"."post_id" IS 'model field: postId';
COMMENT ON COLUMN "public"."blogcomments"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."blogcomments"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."blogcomments"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."blogcomments"."user_email" IS 'model field: userEmail';
COMMENT ON COLUMN "public"."blogcomments"."user_name" IS 'model field: userName';
ALTER TABLE "public"."blogcomments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "blogcomments_extra_4355d0e1" ON "public"."blogcomments" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "blogcomments_ix_8932c5db" ON "public"."blogcomments" USING btree ("post_id");
CREATE INDEX "blogcomments_ix_18319c2d" ON "public"."blogcomments" USING btree ("post_id", "status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."blogcomments" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."blogcomments" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."blogposts" (
  "id" text COLLATE "C" PRIMARY KEY,
  "author_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "author" jsonb,
  "author_name" text COLLATE "C",
  "category" text COLLATE "C",
  "content" text COLLATE "C",
  "content_type" text COLLATE "C",
  "cover_image" text COLLATE "C",
  "excerpt" text COLLATE "C",
  "gallery" text[] COLLATE "C",
  "image" text COLLATE "C",
  "images" text[] COLLATE "C",
  "image_url" text COLLATE "C",
  "is_verified" boolean,
  "likes" double precision,
  "name" text COLLATE "C",
  "published_at" jsonb,
  "slug" text COLLATE "C",
  "status" text COLLATE "C",
  "tags" text COLLATE "C",
  "title" text COLLATE "C",
  "views" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."blogposts" IS 'Tirvona model collection blogposts. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."blogposts"."author_id" IS 'model field: authorId';
COMMENT ON COLUMN "public"."blogposts"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."blogposts"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."blogposts"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."blogposts"."author_name" IS 'model field: authorName';
COMMENT ON COLUMN "public"."blogposts"."content_type" IS 'model field: contentType';
COMMENT ON COLUMN "public"."blogposts"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."blogposts"."image_url" IS 'model field: imageUrl';
COMMENT ON COLUMN "public"."blogposts"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."blogposts"."published_at" IS 'model field: publishedAt';
ALTER TABLE "public"."blogposts" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "blogposts_extra_78a72c79" ON "public"."blogposts" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "blogposts_ix_2670e9f6" ON "public"."blogposts" USING btree ("status", "category", "created_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "blogposts_uq_7a0923dd" ON "public"."blogposts" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "blogposts_ix_82abfc2f" ON "public"."blogposts" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "blogposts_ix_c4e5ceaa" ON "public"."blogposts" USING btree ("status", "content_type", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."blogposts" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."blogposts" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_addons" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "name" text COLLATE "C",
  "price" double precision,
  "unit" text COLLATE "C",
  "unit_label" text COLLATE "C",
  "category" text COLLATE "C",
  "max_quantity" double precision,
  "enabled" boolean,
  "icon_url" text COLLATE "C",
  "description" text COLLATE "C",
  "created_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_addons" IS 'Tirvona model collection booking_addons. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_addons"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_addons"."unit_label" IS 'model field: unitLabel';
COMMENT ON COLUMN "public"."booking_addons"."max_quantity" IS 'model field: maxQuantity';
COMMENT ON COLUMN "public"."booking_addons"."icon_url" IS 'model field: iconUrl';
COMMENT ON COLUMN "public"."booking_addons"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."booking_addons"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_addons"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_addons"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_addons" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_addons_extra_a6f63bd0" ON "public"."booking_addons" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_addons_ix_c3e45049" ON "public"."booking_addons" USING btree ("ashram_id", "enabled");

REVOKE ALL ON "public"."booking_addons" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_addons" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_audit_logs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "action" text COLLATE "C",
  "module" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "before" jsonb,
  "after" jsonb,
  "details" jsonb,
  "request_id" text COLLATE "C",
  "ip_address" text COLLATE "C",
  "user_agent" text COLLATE "C",
  "occurred_at" timestamptz,
  "timestamp" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_audit_logs" IS 'Tirvona model collection booking_audit_logs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_audit_logs"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."booking_audit_logs"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_audit_logs"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_audit_logs"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."booking_audit_logs"."ip_address" IS 'model field: ipAddress';
COMMENT ON COLUMN "public"."booking_audit_logs"."user_agent" IS 'model field: userAgent';
COMMENT ON COLUMN "public"."booking_audit_logs"."occurred_at" IS 'model field: occurredAt';
COMMENT ON COLUMN "public"."booking_audit_logs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_audit_logs"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_audit_logs"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_audit_logs_extra_90af3c37" ON "public"."booking_audit_logs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_audit_logs_ix_0fd3975b" ON "public"."booking_audit_logs" USING btree ("module");
CREATE INDEX "booking_audit_logs_ix_c929bf0c" ON "public"."booking_audit_logs" USING btree ("ashram_id", "occurred_at" DESC NULLS LAST);
CREATE INDEX "booking_audit_logs_ix_56d7950c" ON "public"."booking_audit_logs" USING btree ("booking_id", "occurred_at" DESC NULLS LAST);

REVOKE ALL ON "public"."booking_audit_logs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_audit_logs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_bookings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "reservation_number" text COLLATE "C",
  "identity_code" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "booking_source" text COLLATE "C",
  "booking_type" text COLLATE "C",
  "day_stay_details" jsonb,
  "channel" text COLLATE "C",
  "walk_in_guest" jsonb,
  "booked_by" text COLLATE "C",
  "rooms" jsonb,
  "check_in_date" timestamptz,
  "check_out_date" timestamptz,
  "occupied_dates" jsonb,
  "guests_count" double precision,
  "rooms_booked_count" double precision,
  "status" text COLLATE "C",
  "services" jsonb,
  "pricing" jsonb,
  "offer_id" text COLLATE "C",
  "applied_offer_id" text COLLATE "C",
  "offer_name" text COLLATE "C",
  "promo_code" text COLLATE "C",
  "discount_type" text COLLATE "C",
  "discount_percentage" double precision,
  "reservation_expires_at" timestamptz,
  "payment_link" jsonb,
  "payment_summary" jsonb,
  "assigned_room_numbers" jsonb,
  "payment_mode" text COLLATE "C",
  "gateway_status" text COLLATE "C",
  "special_requests" text COLLATE "C",
  "payment_status" text COLLATE "C",
  "check_in_code" text COLLATE "C",
  "checked_in_at" timestamptz,
  "checked_in_by" text COLLATE "C",
  "checked_out_at" timestamptz,
  "checked_out_by" text COLLATE "C",
  "checkin_reminder_sent_at" timestamptz,
  "cancellation" jsonb,
  "deleted_at" timestamptz,
  "deleted_by" text COLLATE "C",
  "version" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version_2" double precision,
  "assigned_room_number" text COLLATE "C",
  "room_id" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_bookings" IS 'Tirvona model collection booking_bookings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_bookings"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_bookings"."reservation_number" IS 'model field: reservationNumber';
COMMENT ON COLUMN "public"."booking_bookings"."identity_code" IS 'model field: identityCode';
COMMENT ON COLUMN "public"."booking_bookings"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."booking_bookings"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."booking_bookings"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_bookings"."booking_source" IS 'model field: bookingSource';
COMMENT ON COLUMN "public"."booking_bookings"."booking_type" IS 'model field: bookingType';
COMMENT ON COLUMN "public"."booking_bookings"."day_stay_details" IS 'model field: dayStayDetails';
COMMENT ON COLUMN "public"."booking_bookings"."walk_in_guest" IS 'model field: walkInGuest';
COMMENT ON COLUMN "public"."booking_bookings"."booked_by" IS 'model field: bookedBy';
COMMENT ON COLUMN "public"."booking_bookings"."check_in_date" IS 'model field: checkInDate';
COMMENT ON COLUMN "public"."booking_bookings"."check_out_date" IS 'model field: checkOutDate';
COMMENT ON COLUMN "public"."booking_bookings"."occupied_dates" IS 'model field: occupiedDates';
COMMENT ON COLUMN "public"."booking_bookings"."guests_count" IS 'model field: guestsCount';
COMMENT ON COLUMN "public"."booking_bookings"."rooms_booked_count" IS 'model field: roomsBookedCount';
COMMENT ON COLUMN "public"."booking_bookings"."offer_id" IS 'model field: offerId';
COMMENT ON COLUMN "public"."booking_bookings"."applied_offer_id" IS 'model field: appliedOfferId';
COMMENT ON COLUMN "public"."booking_bookings"."offer_name" IS 'model field: offerName';
COMMENT ON COLUMN "public"."booking_bookings"."promo_code" IS 'model field: promoCode';
COMMENT ON COLUMN "public"."booking_bookings"."discount_type" IS 'model field: discountType';
COMMENT ON COLUMN "public"."booking_bookings"."discount_percentage" IS 'model field: discountPercentage';
COMMENT ON COLUMN "public"."booking_bookings"."reservation_expires_at" IS 'model field: reservationExpiresAt';
COMMENT ON COLUMN "public"."booking_bookings"."payment_link" IS 'model field: paymentLink';
COMMENT ON COLUMN "public"."booking_bookings"."payment_summary" IS 'model field: paymentSummary';
COMMENT ON COLUMN "public"."booking_bookings"."assigned_room_numbers" IS 'model field: assignedRoomNumbers';
COMMENT ON COLUMN "public"."booking_bookings"."payment_mode" IS 'model field: paymentMode';
COMMENT ON COLUMN "public"."booking_bookings"."gateway_status" IS 'model field: gatewayStatus';
COMMENT ON COLUMN "public"."booking_bookings"."special_requests" IS 'model field: specialRequests';
COMMENT ON COLUMN "public"."booking_bookings"."payment_status" IS 'model field: paymentStatus';
COMMENT ON COLUMN "public"."booking_bookings"."check_in_code" IS 'model field: checkInCode';
COMMENT ON COLUMN "public"."booking_bookings"."checked_in_at" IS 'model field: checkedInAt';
COMMENT ON COLUMN "public"."booking_bookings"."checked_in_by" IS 'model field: checkedInBy';
COMMENT ON COLUMN "public"."booking_bookings"."checked_out_at" IS 'model field: checkedOutAt';
COMMENT ON COLUMN "public"."booking_bookings"."checked_out_by" IS 'model field: checkedOutBy';
COMMENT ON COLUMN "public"."booking_bookings"."checkin_reminder_sent_at" IS 'model field: checkinReminderSentAt';
COMMENT ON COLUMN "public"."booking_bookings"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."booking_bookings"."deleted_by" IS 'model field: deletedBy';
COMMENT ON COLUMN "public"."booking_bookings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_bookings"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_bookings"."version_2" IS 'model field: __v';
COMMENT ON COLUMN "public"."booking_bookings"."assigned_room_number" IS 'model field: assignedRoomNumber';
COMMENT ON COLUMN "public"."booking_bookings"."room_id" IS 'model field: roomId';
ALTER TABLE "public"."booking_bookings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_bookings_extra_63f46f46" ON "public"."booking_bookings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_bookings_uq_68b24c9f" ON "public"."booking_bookings" USING btree ("booking_id") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "booking_bookings_uq_27a9fe3c" ON "public"."booking_bookings" USING btree ("reservation_number") WHERE "reservation_number" IS NOT NULL;
CREATE UNIQUE INDEX "booking_bookings_uq_b7f703b2" ON "public"."booking_bookings" USING btree ("identity_code") WHERE "identity_code" IS NOT NULL;
CREATE INDEX "booking_bookings_ix_f3b9348e" ON "public"."booking_bookings" USING btree ("booking_source");
CREATE INDEX "booking_bookings_ix_07f31204" ON "public"."booking_bookings" USING btree ("booking_type");
CREATE INDEX "booking_bookings_ix_a63abb3a" ON "public"."booking_bookings" USING btree (("day_stay_details" #> '{slotStartTime}'));
CREATE INDEX "booking_bookings_ix_bbb370c2" ON "public"."booking_bookings" USING btree (("day_stay_details" #> '{slotEndTime}'));
CREATE INDEX "booking_bookings_ix_70c88ba6" ON "public"."booking_bookings" USING btree ("channel");
CREATE INDEX "booking_bookings_ix_20b3ed65" ON "public"."booking_bookings" USING btree ("status");
CREATE INDEX "booking_bookings_ix_f9bfa183" ON "public"."booking_bookings" USING btree ("payment_status");
CREATE INDEX "booking_bookings_ix_0de1cd85" ON "public"."booking_bookings" USING btree ("deleted_at");
CREATE INDEX "booking_bookings_ix_e55dc705" ON "public"."booking_bookings" USING btree ("customer_id", "created_at" DESC NULLS LAST);
CREATE INDEX "booking_bookings_ix_1fc45c31" ON "public"."booking_bookings" USING btree ("whatsapp_customer_id", "created_at" DESC NULLS LAST) WHERE "whatsapp_customer_id" IS NOT NULL OR "created_at" IS NOT NULL;
CREATE INDEX "booking_bookings_ix_d69dc9c9" ON "public"."booking_bookings" USING btree ("ashram_id", "channel", "created_at" DESC NULLS LAST);
CREATE INDEX "booking_bookings_ix_b58203d9" ON "public"."booking_bookings" USING btree ("ashram_id", "status", "created_at" DESC NULLS LAST);
CREATE INDEX "booking_bookings_ix_65d4a40d" ON "public"."booking_bookings" USING btree ("ashram_id", "booking_source", "created_at" DESC NULLS LAST);
CREATE INDEX "booking_bookings_ix_d9ea7225" ON "public"."booking_bookings" USING btree ("ashram_id", "check_in_date");
CREATE INDEX "booking_bookings_ix_e553f74d" ON "public"."booking_bookings" USING btree ("status", "reservation_expires_at");
CREATE INDEX "booking_bookings_ix_7a170f51" ON "public"."booking_bookings" USING btree ("ashram_id", "booking_type", ("day_stay_details" #> '{slotStartTime}'));
CREATE INDEX "booking_bookings_ix_68f7372a" ON "public"."booking_bookings" USING btree (("rooms" #> '{roomId}'), "booking_type", "status", ("day_stay_details" #> '{slotStartTime}'), ("day_stay_details" #> '{slotEndTime}'));

REVOKE ALL ON "public"."booking_bookings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_bookings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_checkins" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "verified_by" text COLLATE "C",
  "check_in_code_hash" text COLLATE "C",
  "checked_in_at" timestamptz,
  "guest_count" double precision,
  "room_numbers" jsonb,
  "notes" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "room_number" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_checkins" IS 'Tirvona model collection booking_checkins. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_checkins"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_checkins"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_checkins"."verified_by" IS 'model field: verifiedBy';
COMMENT ON COLUMN "public"."booking_checkins"."check_in_code_hash" IS 'model field: checkInCodeHash';
COMMENT ON COLUMN "public"."booking_checkins"."checked_in_at" IS 'model field: checkedInAt';
COMMENT ON COLUMN "public"."booking_checkins"."guest_count" IS 'model field: guestCount';
COMMENT ON COLUMN "public"."booking_checkins"."room_numbers" IS 'model field: roomNumbers';
COMMENT ON COLUMN "public"."booking_checkins"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_checkins"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_checkins"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."booking_checkins"."room_number" IS 'model field: roomNumber';
ALTER TABLE "public"."booking_checkins" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_checkins_extra_ea9e9dda" ON "public"."booking_checkins" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_checkins_uq_68b24c9f" ON "public"."booking_checkins" USING btree ("booking_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."booking_checkins" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_checkins" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_checkouts" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "checked_out_by" text COLLATE "C",
  "checked_out_at" timestamptz,
  "damages" jsonb,
  "additional_charges" double precision,
  "notes" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_checkouts" IS 'Tirvona model collection booking_checkouts. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_checkouts"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_checkouts"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_checkouts"."checked_out_by" IS 'model field: checkedOutBy';
COMMENT ON COLUMN "public"."booking_checkouts"."checked_out_at" IS 'model field: checkedOutAt';
COMMENT ON COLUMN "public"."booking_checkouts"."additional_charges" IS 'model field: additionalCharges';
COMMENT ON COLUMN "public"."booking_checkouts"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_checkouts"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_checkouts"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_checkouts" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_checkouts_extra_bf6ff8cf" ON "public"."booking_checkouts" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_checkouts_uq_68b24c9f" ON "public"."booking_checkouts" USING btree ("booking_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."booking_checkouts" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_checkouts" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_commissions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "gross_amount" double precision,
  "commission_percent" double precision,
  "commission_amount" double precision,
  "owner_earning" double precision,
  "tax_withheld" double precision,
  "settlement_status" text COLLATE "C",
  "settlement_id" text COLLATE "C",
  "payout_id" text COLLATE "C",
  "reversed_at" timestamptz,
  "reversal_reason" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_commissions" IS 'Tirvona model collection booking_commissions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_commissions"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_commissions"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_commissions"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."booking_commissions"."gross_amount" IS 'model field: grossAmount';
COMMENT ON COLUMN "public"."booking_commissions"."commission_percent" IS 'model field: commissionPercent';
COMMENT ON COLUMN "public"."booking_commissions"."commission_amount" IS 'model field: commissionAmount';
COMMENT ON COLUMN "public"."booking_commissions"."owner_earning" IS 'model field: ownerEarning';
COMMENT ON COLUMN "public"."booking_commissions"."tax_withheld" IS 'model field: taxWithheld';
COMMENT ON COLUMN "public"."booking_commissions"."settlement_status" IS 'model field: settlementStatus';
COMMENT ON COLUMN "public"."booking_commissions"."settlement_id" IS 'model field: settlementId';
COMMENT ON COLUMN "public"."booking_commissions"."payout_id" IS 'model field: payoutId';
COMMENT ON COLUMN "public"."booking_commissions"."reversed_at" IS 'model field: reversedAt';
COMMENT ON COLUMN "public"."booking_commissions"."reversal_reason" IS 'model field: reversalReason';
COMMENT ON COLUMN "public"."booking_commissions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_commissions"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_commissions"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_commissions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_commissions_extra_18a51646" ON "public"."booking_commissions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_commissions_uq_68b24c9f" ON "public"."booking_commissions" USING btree ("booking_id") NULLS NOT DISTINCT;
CREATE INDEX "booking_commissions_ix_c8ba7e6a" ON "public"."booking_commissions" USING btree ("settlement_status");
CREATE INDEX "booking_commissions_ix_07c229f1" ON "public"."booking_commissions" USING btree ("owner_id", "settlement_status", "created_at");
CREATE INDEX "booking_commissions_ix_42320a19" ON "public"."booking_commissions" USING btree ("payout_id", "settlement_status");

REVOKE ALL ON "public"."booking_commissions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_commissions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_coupons" (
  "id" text COLLATE "C" PRIMARY KEY,
  "owner_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "room_id" text COLLATE "C",
  "is_last_minute_deal" boolean,
  "applicable_ashrams" jsonb,
  "applicable_cities" jsonb,
  "applicable_states" jsonb,
  "applicable_room_categories" jsonb,
  "offer_title" text COLLATE "C",
  "short_title" text COLLATE "C",
  "subtitle" text COLLATE "C",
  "offer_type" text COLLATE "C",
  "description" text COLLATE "C",
  "full_html_description" text COLLATE "C",
  "highlights" jsonb,
  "terms_and_conditions" jsonb,
  "banner_image" text COLLATE "C",
  "thumbnail_image" text COLLATE "C",
  "desktop_banner" text COLLATE "C",
  "mobile_banner" text COLLATE "C",
  "gallery_images" jsonb,
  "promo_code" text COLLATE "C",
  "discount_type" text COLLATE "C",
  "discount_value" double precision,
  "maximum_discount" double precision,
  "minimum_booking_amount" double precision,
  "valid_from" timestamptz,
  "valid_till" timestamptz,
  "maximum_redemptions" double precision,
  "remaining_redemptions" double precision,
  "per_user_limit" double precision,
  "priority" double precision,
  "featured" boolean,
  "status" text COLLATE "C",
  "views_count" double precision,
  "clicks_count" double precision,
  "redemptions_count" double precision,
  "revenue_generated" double precision,
  "deleted_at" timestamptz,
  "deleted_by" text COLLATE "C",
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_coupons" IS 'Tirvona model collection booking_coupons. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_coupons"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."booking_coupons"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_coupons"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."booking_coupons"."is_last_minute_deal" IS 'model field: isLastMinuteDeal';
COMMENT ON COLUMN "public"."booking_coupons"."applicable_ashrams" IS 'model field: applicableAshrams';
COMMENT ON COLUMN "public"."booking_coupons"."applicable_cities" IS 'model field: applicableCities';
COMMENT ON COLUMN "public"."booking_coupons"."applicable_states" IS 'model field: applicableStates';
COMMENT ON COLUMN "public"."booking_coupons"."applicable_room_categories" IS 'model field: applicableRoomCategories';
COMMENT ON COLUMN "public"."booking_coupons"."offer_title" IS 'model field: offerTitle';
COMMENT ON COLUMN "public"."booking_coupons"."short_title" IS 'model field: shortTitle';
COMMENT ON COLUMN "public"."booking_coupons"."offer_type" IS 'model field: offerType';
COMMENT ON COLUMN "public"."booking_coupons"."full_html_description" IS 'model field: fullHtmlDescription';
COMMENT ON COLUMN "public"."booking_coupons"."terms_and_conditions" IS 'model field: termsAndConditions';
COMMENT ON COLUMN "public"."booking_coupons"."banner_image" IS 'model field: bannerImage';
COMMENT ON COLUMN "public"."booking_coupons"."thumbnail_image" IS 'model field: thumbnailImage';
COMMENT ON COLUMN "public"."booking_coupons"."desktop_banner" IS 'model field: desktopBanner';
COMMENT ON COLUMN "public"."booking_coupons"."mobile_banner" IS 'model field: mobileBanner';
COMMENT ON COLUMN "public"."booking_coupons"."gallery_images" IS 'model field: galleryImages';
COMMENT ON COLUMN "public"."booking_coupons"."promo_code" IS 'model field: promoCode';
COMMENT ON COLUMN "public"."booking_coupons"."discount_type" IS 'model field: discountType';
COMMENT ON COLUMN "public"."booking_coupons"."discount_value" IS 'model field: discountValue';
COMMENT ON COLUMN "public"."booking_coupons"."maximum_discount" IS 'model field: maximumDiscount';
COMMENT ON COLUMN "public"."booking_coupons"."minimum_booking_amount" IS 'model field: minimumBookingAmount';
COMMENT ON COLUMN "public"."booking_coupons"."valid_from" IS 'model field: validFrom';
COMMENT ON COLUMN "public"."booking_coupons"."valid_till" IS 'model field: validTill';
COMMENT ON COLUMN "public"."booking_coupons"."maximum_redemptions" IS 'model field: maximumRedemptions';
COMMENT ON COLUMN "public"."booking_coupons"."remaining_redemptions" IS 'model field: remainingRedemptions';
COMMENT ON COLUMN "public"."booking_coupons"."per_user_limit" IS 'model field: perUserLimit';
COMMENT ON COLUMN "public"."booking_coupons"."views_count" IS 'model field: viewsCount';
COMMENT ON COLUMN "public"."booking_coupons"."clicks_count" IS 'model field: clicksCount';
COMMENT ON COLUMN "public"."booking_coupons"."redemptions_count" IS 'model field: redemptionsCount';
COMMENT ON COLUMN "public"."booking_coupons"."revenue_generated" IS 'model field: revenueGenerated';
COMMENT ON COLUMN "public"."booking_coupons"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."booking_coupons"."deleted_by" IS 'model field: deletedBy';
COMMENT ON COLUMN "public"."booking_coupons"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."booking_coupons"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."booking_coupons"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_coupons"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_coupons"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_coupons" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_coupons_extra_113c1b84" ON "public"."booking_coupons" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_coupons_ix_20b3ed65" ON "public"."booking_coupons" USING btree ("status");
CREATE INDEX "booking_coupons_ix_0de1cd85" ON "public"."booking_coupons" USING btree ("deleted_at");
CREATE UNIQUE INDEX "booking_coupons_uq_4019ad15" ON "public"."booking_coupons" USING btree ("promo_code") NULLS NOT DISTINCT;
CREATE INDEX "booking_coupons_ix_8a9919e3" ON "public"."booking_coupons" USING btree ("status", "valid_till");
CREATE INDEX "booking_coupons_ix_a1b792e0" ON "public"."booking_coupons" USING btree ("owner_id", "created_at" DESC NULLS LAST);
CREATE INDEX "booking_coupons_ix_20e39220" ON "public"."booking_coupons" USING btree ("ashram_id", "status");
CREATE INDEX "booking_coupons_ix_7b5e778d" ON "public"."booking_coupons" USING btree ("applicable_ashrams", "status");

REVOKE ALL ON "public"."booking_coupons" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_coupons" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_daily_availability" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "room_id" text COLLATE "C",
  "date" timestamptz,
  "total_inventory" double precision,
  "held_count" double precision,
  "booked_count" double precision,
  "online_booked_count" double precision,
  "offline_booked_count" double precision,
  "transferred_from_offline_count" double precision,
  "maintenance_count" double precision,
  "custom_price" double precision,
  "is_closed" boolean,
  "note" text COLLATE "C",
  "day_stay_touched_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_daily_availability" IS 'Tirvona model collection booking_daily_availability. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_daily_availability"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_daily_availability"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."booking_daily_availability"."total_inventory" IS 'model field: totalInventory';
COMMENT ON COLUMN "public"."booking_daily_availability"."held_count" IS 'model field: heldCount';
COMMENT ON COLUMN "public"."booking_daily_availability"."booked_count" IS 'model field: bookedCount';
COMMENT ON COLUMN "public"."booking_daily_availability"."online_booked_count" IS 'model field: onlineBookedCount';
COMMENT ON COLUMN "public"."booking_daily_availability"."offline_booked_count" IS 'model field: offlineBookedCount';
COMMENT ON COLUMN "public"."booking_daily_availability"."transferred_from_offline_count" IS 'model field: transferredFromOfflineCount';
COMMENT ON COLUMN "public"."booking_daily_availability"."maintenance_count" IS 'model field: maintenanceCount';
COMMENT ON COLUMN "public"."booking_daily_availability"."custom_price" IS 'model field: customPrice';
COMMENT ON COLUMN "public"."booking_daily_availability"."is_closed" IS 'model field: isClosed';
COMMENT ON COLUMN "public"."booking_daily_availability"."day_stay_touched_at" IS 'model field: dayStayTouchedAt';
COMMENT ON COLUMN "public"."booking_daily_availability"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_daily_availability"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_daily_availability"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_daily_availability" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_daily_availability_extra_3be599c7" ON "public"."booking_daily_availability" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_daily_availability_uq_af6b04d6" ON "public"."booking_daily_availability" USING btree ("room_id", "date") NULLS NOT DISTINCT;
CREATE INDEX "booking_daily_availability_ix_0a4f5e1b" ON "public"."booking_daily_availability" USING btree ("ashram_id", "date");

REVOKE ALL ON "public"."booking_daily_availability" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_daily_availability" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_guest_details" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "guests" jsonb,
  "special_needs" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_guest_details" IS 'Tirvona model collection booking_guest_details. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_guest_details"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_guest_details"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."booking_guest_details"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."booking_guest_details"."special_needs" IS 'model field: specialNeeds';
COMMENT ON COLUMN "public"."booking_guest_details"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_guest_details"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_guest_details"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_guest_details" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_guest_details_extra_4c3bc087" ON "public"."booking_guest_details" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_guest_details_uq_68b24c9f" ON "public"."booking_guest_details" USING btree ("booking_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."booking_guest_details" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_guest_details" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_holidays" (
  "id" text COLLATE "C" PRIMARY KEY,
  "name" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "start_date" timestamptz,
  "end_date" timestamptz,
  "multiplier" double precision,
  "is_closed" boolean,
  "type" text COLLATE "C",
  "is_active" boolean,
  "created_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_holidays" IS 'Tirvona model collection booking_holidays. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_holidays"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_holidays"."start_date" IS 'model field: startDate';
COMMENT ON COLUMN "public"."booking_holidays"."end_date" IS 'model field: endDate';
COMMENT ON COLUMN "public"."booking_holidays"."is_closed" IS 'model field: isClosed';
COMMENT ON COLUMN "public"."booking_holidays"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."booking_holidays"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."booking_holidays"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_holidays"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."booking_holidays" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_holidays_extra_0bbbfc66" ON "public"."booking_holidays" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_holidays_ix_599be040" ON "public"."booking_holidays" USING btree ("ashram_id", "start_date", "end_date", "is_active");

REVOKE ALL ON "public"."booking_holidays" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_holidays" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_housekeeping" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "room_id" text COLLATE "C",
  "unit_number" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "status" text COLLATE "C",
  "priority" text COLLATE "C",
  "assigned_to" text COLLATE "C",
  "notes" text COLLATE "C",
  "last_cleaned_at" timestamptz,
  "inspected_by" text COLLATE "C",
  "inspected_at" timestamptz,
  "version" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version_2" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_housekeeping" IS 'Tirvona model collection booking_housekeeping. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_housekeeping"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_housekeeping"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."booking_housekeeping"."unit_number" IS 'model field: unitNumber';
COMMENT ON COLUMN "public"."booking_housekeeping"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_housekeeping"."assigned_to" IS 'model field: assignedTo';
COMMENT ON COLUMN "public"."booking_housekeeping"."last_cleaned_at" IS 'model field: lastCleanedAt';
COMMENT ON COLUMN "public"."booking_housekeeping"."inspected_by" IS 'model field: inspectedBy';
COMMENT ON COLUMN "public"."booking_housekeeping"."inspected_at" IS 'model field: inspectedAt';
COMMENT ON COLUMN "public"."booking_housekeeping"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_housekeeping"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_housekeeping"."version_2" IS 'model field: __v';
ALTER TABLE "public"."booking_housekeeping" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_housekeeping_extra_f35ae1b7" ON "public"."booking_housekeeping" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_housekeeping_ix_20b3ed65" ON "public"."booking_housekeeping" USING btree ("status");
CREATE UNIQUE INDEX "booking_housekeeping_uq_f924d972" ON "public"."booking_housekeeping" USING btree ("ashram_id", "unit_number") NULLS NOT DISTINCT;
CREATE INDEX "booking_housekeeping_ix_20e39220" ON "public"."booking_housekeeping" USING btree ("ashram_id", "status");

REVOKE ALL ON "public"."booking_housekeeping" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_housekeeping" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_identity_counters" (
  "id" text COLLATE "C" PRIMARY KEY,
  "sequence" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_identity_counters" IS 'Tirvona model collection booking_identity_counters. Layout: src/database/pg/registry.generated.ts';
ALTER TABLE "public"."booking_identity_counters" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_identity_counters_extra_3b8e57e1" ON "public"."booking_identity_counters" USING gin ("_extra") WHERE "_extra" IS NOT NULL;

REVOKE ALL ON "public"."booking_identity_counters" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_identity_counters" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_identity_properties" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "cluster_code" text COLLATE "C",
  "property_type_code" text COLLATE "C",
  "property_sequence" double precision,
  "property_code" text COLLATE "C",
  "registered_city" text COLLATE "C",
  "registered_district" text COLLATE "C",
  "registered_property_type" text COLLATE "C",
  "issued_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_identity_properties" IS 'Tirvona model collection booking_identity_properties. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_identity_properties"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_identity_properties"."cluster_code" IS 'model field: clusterCode';
COMMENT ON COLUMN "public"."booking_identity_properties"."property_type_code" IS 'model field: propertyTypeCode';
COMMENT ON COLUMN "public"."booking_identity_properties"."property_sequence" IS 'model field: propertySequence';
COMMENT ON COLUMN "public"."booking_identity_properties"."property_code" IS 'model field: propertyCode';
COMMENT ON COLUMN "public"."booking_identity_properties"."registered_city" IS 'model field: registeredCity';
COMMENT ON COLUMN "public"."booking_identity_properties"."registered_district" IS 'model field: registeredDistrict';
COMMENT ON COLUMN "public"."booking_identity_properties"."registered_property_type" IS 'model field: registeredPropertyType';
COMMENT ON COLUMN "public"."booking_identity_properties"."issued_at" IS 'model field: issuedAt';
COMMENT ON COLUMN "public"."booking_identity_properties"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_identity_properties"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_identity_properties"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_identity_properties" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_identity_properties_extra_7f1a1b4a" ON "public"."booking_identity_properties" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_identity_properties_uq_7139f925" ON "public"."booking_identity_properties" USING btree ("ashram_id") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "booking_identity_properties_uq_89c41ce4" ON "public"."booking_identity_properties" USING btree ("property_code") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "booking_identity_properties_uq_2036d016" ON "public"."booking_identity_properties" USING btree ("cluster_code", "property_type_code", "property_sequence") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."booking_identity_properties" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_identity_properties" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_inventory" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "room_id" text COLLATE "C",
  "dates" jsonb,
  "units" double precision,
  "state" text COLLATE "C",
  "expires_at" timestamptz,
  "confirmed_at" timestamptz,
  "released_at" timestamptz,
  "release_reason" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_inventory" IS 'Tirvona model collection booking_inventory. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_inventory"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_inventory"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_inventory"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."booking_inventory"."expires_at" IS 'model field: expiresAt';
COMMENT ON COLUMN "public"."booking_inventory"."confirmed_at" IS 'model field: confirmedAt';
COMMENT ON COLUMN "public"."booking_inventory"."released_at" IS 'model field: releasedAt';
COMMENT ON COLUMN "public"."booking_inventory"."release_reason" IS 'model field: releaseReason';
COMMENT ON COLUMN "public"."booking_inventory"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_inventory"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_inventory"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_inventory" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_inventory_extra_b86ba8c9" ON "public"."booking_inventory" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_inventory_ix_c92df131" ON "public"."booking_inventory" USING btree ("state");
CREATE UNIQUE INDEX "booking_inventory_uq_af713080" ON "public"."booking_inventory" USING btree ("booking_id", "room_id") NULLS NOT DISTINCT;
CREATE INDEX "booking_inventory_ix_52329b87" ON "public"."booking_inventory" USING btree ("state", "expires_at");
CREATE INDEX "booking_inventory_ix_4849a5c0" ON "public"."booking_inventory" USING btree ("room_id", "dates", "state");

REVOKE ALL ON "public"."booking_inventory" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_inventory" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_invoices" (
  "id" text COLLATE "C" PRIMARY KEY,
  "invoice_number" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "line_items" jsonb,
  "subtotal" double precision,
  "tax_amount" double precision,
  "discount_amount" double precision,
  "donation_amount" double precision,
  "total_amount" double precision,
  "currency" text COLLATE "C",
  "billing_snapshot" jsonb,
  "issued_at" timestamptz,
  "document_url" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_invoices" IS 'Tirvona model collection booking_invoices. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_invoices"."invoice_number" IS 'model field: invoiceNumber';
COMMENT ON COLUMN "public"."booking_invoices"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_invoices"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."booking_invoices"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."booking_invoices"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_invoices"."line_items" IS 'model field: lineItems';
COMMENT ON COLUMN "public"."booking_invoices"."tax_amount" IS 'model field: taxAmount';
COMMENT ON COLUMN "public"."booking_invoices"."discount_amount" IS 'model field: discountAmount';
COMMENT ON COLUMN "public"."booking_invoices"."donation_amount" IS 'model field: donationAmount';
COMMENT ON COLUMN "public"."booking_invoices"."total_amount" IS 'model field: totalAmount';
COMMENT ON COLUMN "public"."booking_invoices"."billing_snapshot" IS 'model field: billingSnapshot';
COMMENT ON COLUMN "public"."booking_invoices"."issued_at" IS 'model field: issuedAt';
COMMENT ON COLUMN "public"."booking_invoices"."document_url" IS 'model field: documentUrl';
COMMENT ON COLUMN "public"."booking_invoices"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_invoices"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_invoices"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_invoices" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_invoices_extra_dc4321e0" ON "public"."booking_invoices" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_invoices_uq_fbd3d995" ON "public"."booking_invoices" USING btree ("invoice_number") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "booking_invoices_uq_68b24c9f" ON "public"."booking_invoices" USING btree ("booking_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."booking_invoices" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_invoices" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_ledger" (
  "id" text COLLATE "C" PRIMARY KEY,
  "account" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "transaction_id" text COLLATE "C",
  "debit" double precision,
  "credit" double precision,
  "balance_after" double precision,
  "currency" text COLLATE "C",
  "reference" text COLLATE "C",
  "occurred_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_ledger" IS 'Tirvona model collection booking_ledger. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_ledger"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_ledger"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_ledger"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."booking_ledger"."transaction_id" IS 'model field: transactionId';
COMMENT ON COLUMN "public"."booking_ledger"."balance_after" IS 'model field: balanceAfter';
COMMENT ON COLUMN "public"."booking_ledger"."occurred_at" IS 'model field: occurredAt';
COMMENT ON COLUMN "public"."booking_ledger"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_ledger"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_ledger"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_ledger" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_ledger_extra_cd8ac497" ON "public"."booking_ledger" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_ledger_ix_010df186" ON "public"."booking_ledger" USING btree ("account", "occurred_at");
CREATE INDEX "booking_ledger_ix_caf0121a" ON "public"."booking_ledger" USING btree ("booking_id");

REVOKE ALL ON "public"."booking_ledger" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_ledger" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_notifications" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "event" text COLLATE "C",
  "title" text COLLATE "C",
  "message" text COLLATE "C",
  "recipient_phone" text COLLATE "C",
  "channel" text COLLATE "C",
  "status" text COLLATE "C",
  "provider_message_id" text COLLATE "C",
  "delivery_error" text COLLATE "C",
  "sent_at" timestamptz,
  "read_at" timestamptz,
  "meta" jsonb,
  "push_enabled" boolean,
  "image_url" text COLLATE "C",
  "data" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_notifications" IS 'Tirvona model collection booking_notifications. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_notifications"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."booking_notifications"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."booking_notifications"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_notifications"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_notifications"."recipient_phone" IS 'model field: recipientPhone';
COMMENT ON COLUMN "public"."booking_notifications"."provider_message_id" IS 'model field: providerMessageId';
COMMENT ON COLUMN "public"."booking_notifications"."delivery_error" IS 'model field: deliveryError';
COMMENT ON COLUMN "public"."booking_notifications"."sent_at" IS 'model field: sentAt';
COMMENT ON COLUMN "public"."booking_notifications"."read_at" IS 'model field: readAt';
COMMENT ON COLUMN "public"."booking_notifications"."push_enabled" IS 'model field: pushEnabled';
COMMENT ON COLUMN "public"."booking_notifications"."image_url" IS 'model field: imageUrl';
COMMENT ON COLUMN "public"."booking_notifications"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_notifications"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_notifications"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_notifications" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_notifications_extra_b44ca68f" ON "public"."booking_notifications" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_notifications_ix_20b3ed65" ON "public"."booking_notifications" USING btree ("status");
CREATE INDEX "booking_notifications_ix_53637f3b" ON "public"."booking_notifications" USING btree ("user_id", "created_at" DESC NULLS LAST);
CREATE INDEX "booking_notifications_ix_1fc45c31" ON "public"."booking_notifications" USING btree ("whatsapp_customer_id", "created_at" DESC NULLS LAST) WHERE "whatsapp_customer_id" IS NOT NULL OR "created_at" IS NOT NULL;
CREATE INDEX "booking_notifications_ix_3b44e6e0" ON "public"."booking_notifications" USING btree ("booking_id", "event");

REVOKE ALL ON "public"."booking_notifications" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_notifications" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_offer_redemptions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "coupon_id" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "user_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "promo_code" text COLLATE "C",
  "booking_amount" double precision,
  "discount_amount" double precision,
  "status" text COLLATE "C",
  "reserved_at" timestamptz,
  "redeemed_at" timestamptz,
  "released_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_offer_redemptions" IS 'Tirvona model collection booking_offer_redemptions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."coupon_id" IS 'model field: couponId';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."promo_code" IS 'model field: promoCode';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."booking_amount" IS 'model field: bookingAmount';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."discount_amount" IS 'model field: discountAmount';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."reserved_at" IS 'model field: reservedAt';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."redeemed_at" IS 'model field: redeemedAt';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."released_at" IS 'model field: releasedAt';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_offer_redemptions"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_offer_redemptions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_offer_redemptions_extra_2b3d2e2c" ON "public"."booking_offer_redemptions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_offer_redemptions_uq_68b24c9f" ON "public"."booking_offer_redemptions" USING btree ("booking_id") NULLS NOT DISTINCT;
CREATE INDEX "booking_offer_redemptions_ix_fed7301b" ON "public"."booking_offer_redemptions" USING btree ("coupon_id", "user_id", "status");

REVOKE ALL ON "public"."booking_offer_redemptions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_offer_redemptions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_payment_events" (
  "id" text COLLATE "C" PRIMARY KEY,
  "provider" text COLLATE "C",
  "event_id" text COLLATE "C",
  "event_type" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "payment_id" text COLLATE "C",
  "signature_verified" boolean,
  "payload" jsonb,
  "status" text COLLATE "C",
  "processing_error" text COLLATE "C",
  "processed_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_payment_events" IS 'Tirvona model collection booking_payment_events. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_payment_events"."event_id" IS 'model field: eventId';
COMMENT ON COLUMN "public"."booking_payment_events"."event_type" IS 'model field: eventType';
COMMENT ON COLUMN "public"."booking_payment_events"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_payment_events"."payment_id" IS 'model field: paymentId';
COMMENT ON COLUMN "public"."booking_payment_events"."signature_verified" IS 'model field: signatureVerified';
COMMENT ON COLUMN "public"."booking_payment_events"."processing_error" IS 'model field: processingError';
COMMENT ON COLUMN "public"."booking_payment_events"."processed_at" IS 'model field: processedAt';
COMMENT ON COLUMN "public"."booking_payment_events"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_payment_events"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_payment_events"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_payment_events" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_payment_events_extra_78326277" ON "public"."booking_payment_events" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_payment_events_uq_a62d30a9" ON "public"."booking_payment_events" USING btree ("provider", "event_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."booking_payment_events" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_payment_events" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_payments" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "user_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "booking_source" text COLLATE "C",
  "collected_by" text COLLATE "C",
  "amount" double precision,
  "wallet_amount" double precision,
  "currency" text COLLATE "C",
  "purpose" text COLLATE "C",
  "method" text COLLATE "C",
  "status" text COLLATE "C",
  "transaction_id" text COLLATE "C",
  "gateway" jsonb,
  "paid_at" timestamptz,
  "failure_reason" text COLLATE "C",
  "idempotency_key" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_payments" IS 'Tirvona model collection booking_payments. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_payments"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_payments"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."booking_payments"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."booking_payments"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_payments"."booking_source" IS 'model field: bookingSource';
COMMENT ON COLUMN "public"."booking_payments"."collected_by" IS 'model field: collectedBy';
COMMENT ON COLUMN "public"."booking_payments"."wallet_amount" IS 'model field: walletAmount';
COMMENT ON COLUMN "public"."booking_payments"."transaction_id" IS 'model field: transactionId';
COMMENT ON COLUMN "public"."booking_payments"."paid_at" IS 'model field: paidAt';
COMMENT ON COLUMN "public"."booking_payments"."failure_reason" IS 'model field: failureReason';
COMMENT ON COLUMN "public"."booking_payments"."idempotency_key" IS 'model field: idempotencyKey';
COMMENT ON COLUMN "public"."booking_payments"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_payments"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_payments"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_payments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_payments_extra_62d1b2aa" ON "public"."booking_payments" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_payments_ix_f3b9348e" ON "public"."booking_payments" USING btree ("booking_source");
CREATE INDEX "booking_payments_ix_20b3ed65" ON "public"."booking_payments" USING btree ("status");
CREATE INDEX "booking_payments_ix_e842343b" ON "public"."booking_payments" USING btree ("transaction_id") WHERE "transaction_id" IS NOT NULL;
CREATE INDEX "booking_payments_ix_b79f1c74" ON "public"."booking_payments" USING btree (("gateway" #> '{orderId}'));
CREATE UNIQUE INDEX "booking_payments_uq_e4eb75de" ON "public"."booking_payments" USING btree (("gateway" #> '{paymentId}')) WHERE ("gateway" #> '{paymentId}') IS NOT NULL;
CREATE UNIQUE INDEX "booking_payments_uq_3f50083b" ON "public"."booking_payments" USING btree ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX "booking_payments_ix_360919b8" ON "public"."booking_payments" USING btree ("booking_id", "status");
CREATE INDEX "booking_payments_ix_b95dc735" ON "public"."booking_payments" USING btree ("ashram_id", "status", "paid_at" DESC NULLS LAST);

REVOKE ALL ON "public"."booking_payments" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_payments" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_policies" (
  "id" text COLLATE "C" PRIMARY KEY,
  "scope" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "hold_minutes" double precision,
  "cancellation_free_hours" double precision,
  "refund_before_window_percent" double precision,
  "refund_inside_window_percent" double precision,
  "tax_percent" double precision,
  "platform_commission_percent" double precision,
  "platform_fee_percent" double precision,
  "check_in_early_minutes" double precision,
  "no_show_after_minutes" double precision,
  "is_active" boolean,
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_policies" IS 'Tirvona model collection booking_policies. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_policies"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_policies"."hold_minutes" IS 'model field: holdMinutes';
COMMENT ON COLUMN "public"."booking_policies"."cancellation_free_hours" IS 'model field: cancellationFreeHours';
COMMENT ON COLUMN "public"."booking_policies"."refund_before_window_percent" IS 'model field: refundBeforeWindowPercent';
COMMENT ON COLUMN "public"."booking_policies"."refund_inside_window_percent" IS 'model field: refundInsideWindowPercent';
COMMENT ON COLUMN "public"."booking_policies"."tax_percent" IS 'model field: taxPercent';
COMMENT ON COLUMN "public"."booking_policies"."platform_commission_percent" IS 'model field: platformCommissionPercent';
COMMENT ON COLUMN "public"."booking_policies"."platform_fee_percent" IS 'model field: platformFeePercent';
COMMENT ON COLUMN "public"."booking_policies"."check_in_early_minutes" IS 'model field: checkInEarlyMinutes';
COMMENT ON COLUMN "public"."booking_policies"."no_show_after_minutes" IS 'model field: noShowAfterMinutes';
COMMENT ON COLUMN "public"."booking_policies"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."booking_policies"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."booking_policies"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_policies"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."booking_policies" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_policies_extra_f24cb51d" ON "public"."booking_policies" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_policies_uq_0a1e1a6c" ON "public"."booking_policies" USING btree ("scope", "ashram_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."booking_policies" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_policies" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_pricing" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "room_id" text COLLATE "C",
  "name" text COLLATE "C",
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "days_of_week" jsonb,
  "multiplier" double precision,
  "override_price" double precision,
  "min_stay" double precision,
  "tax_percent" double precision,
  "platform_fee_percent" double precision,
  "priority" double precision,
  "is_active" boolean,
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_pricing" IS 'Tirvona model collection booking_pricing. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_pricing"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_pricing"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."booking_pricing"."valid_from" IS 'model field: validFrom';
COMMENT ON COLUMN "public"."booking_pricing"."valid_until" IS 'model field: validUntil';
COMMENT ON COLUMN "public"."booking_pricing"."days_of_week" IS 'model field: daysOfWeek';
COMMENT ON COLUMN "public"."booking_pricing"."override_price" IS 'model field: overridePrice';
COMMENT ON COLUMN "public"."booking_pricing"."min_stay" IS 'model field: minStay';
COMMENT ON COLUMN "public"."booking_pricing"."tax_percent" IS 'model field: taxPercent';
COMMENT ON COLUMN "public"."booking_pricing"."platform_fee_percent" IS 'model field: platformFeePercent';
COMMENT ON COLUMN "public"."booking_pricing"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."booking_pricing"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."booking_pricing"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_pricing"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."booking_pricing" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_pricing_extra_b24e3ae2" ON "public"."booking_pricing" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_pricing_ix_a40c6f64" ON "public"."booking_pricing" USING btree ("ashram_id", "room_id", "is_active", "valid_from", "valid_until");

REVOKE ALL ON "public"."booking_pricing" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_pricing" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_receipts" (
  "id" text COLLATE "C" PRIMARY KEY,
  "receipt_number" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "payment_id" text COLLATE "C",
  "amount" double precision,
  "currency" text COLLATE "C",
  "method" text COLLATE "C",
  "issued_at" timestamptz,
  "document_url" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_receipts" IS 'Tirvona model collection booking_receipts. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_receipts"."receipt_number" IS 'model field: receiptNumber';
COMMENT ON COLUMN "public"."booking_receipts"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_receipts"."payment_id" IS 'model field: paymentId';
COMMENT ON COLUMN "public"."booking_receipts"."issued_at" IS 'model field: issuedAt';
COMMENT ON COLUMN "public"."booking_receipts"."document_url" IS 'model field: documentUrl';
COMMENT ON COLUMN "public"."booking_receipts"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_receipts"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_receipts"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_receipts" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_receipts_extra_c4fc285c" ON "public"."booking_receipts" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_receipts_uq_779c62e0" ON "public"."booking_receipts" USING btree ("receipt_number") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."booking_receipts" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_receipts" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_refunds" (
  "id" text COLLATE "C" PRIMARY KEY,
  "refund_reference" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "payment_id" text COLLATE "C",
  "requested_by" text COLLATE "C",
  "requested_by_whats_app_customer_id" text COLLATE "C",
  "amount" double precision,
  "percentage" double precision,
  "reason" text COLLATE "C",
  "policy_snapshot" jsonb,
  "status" text COLLATE "C",
  "method" text COLLATE "C",
  "gateway_refund_id" text COLLATE "C",
  "processed_at" timestamptz,
  "failure_reason" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_refunds" IS 'Tirvona model collection booking_refunds. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_refunds"."refund_reference" IS 'model field: refundReference';
COMMENT ON COLUMN "public"."booking_refunds"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_refunds"."payment_id" IS 'model field: paymentId';
COMMENT ON COLUMN "public"."booking_refunds"."requested_by" IS 'model field: requestedBy';
COMMENT ON COLUMN "public"."booking_refunds"."requested_by_whats_app_customer_id" IS 'model field: requestedByWhatsAppCustomerId';
COMMENT ON COLUMN "public"."booking_refunds"."policy_snapshot" IS 'model field: policySnapshot';
COMMENT ON COLUMN "public"."booking_refunds"."gateway_refund_id" IS 'model field: gatewayRefundId';
COMMENT ON COLUMN "public"."booking_refunds"."processed_at" IS 'model field: processedAt';
COMMENT ON COLUMN "public"."booking_refunds"."failure_reason" IS 'model field: failureReason';
COMMENT ON COLUMN "public"."booking_refunds"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_refunds"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_refunds"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_refunds" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_refunds_extra_7841d883" ON "public"."booking_refunds" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_refunds_uq_f1f38fc5" ON "public"."booking_refunds" USING btree ("refund_reference") NULLS NOT DISTINCT;
CREATE INDEX "booking_refunds_ix_f7eed362" ON "public"."booking_refunds" USING btree ("booking_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."booking_refunds" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_refunds" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_reports" (
  "id" text COLLATE "C" PRIMARY KEY,
  "report_type" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "range" jsonb,
  "parameters" jsonb,
  "status" text COLLATE "C",
  "result_url" text COLLATE "C",
  "generated_at" timestamptz,
  "expires_at" timestamptz,
  "requested_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_reports" IS 'Tirvona model collection booking_reports. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_reports"."report_type" IS 'model field: reportType';
COMMENT ON COLUMN "public"."booking_reports"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_reports"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."booking_reports"."result_url" IS 'model field: resultUrl';
COMMENT ON COLUMN "public"."booking_reports"."generated_at" IS 'model field: generatedAt';
COMMENT ON COLUMN "public"."booking_reports"."expires_at" IS 'model field: expiresAt';
COMMENT ON COLUMN "public"."booking_reports"."requested_by" IS 'model field: requestedBy';
COMMENT ON COLUMN "public"."booking_reports"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_reports"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."booking_reports" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_reports_extra_7361357c" ON "public"."booking_reports" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_reports_ix_fba7e62f" ON "public"."booking_reports" USING btree ("requested_by", "created_at" DESC NULLS LAST);
CREATE INDEX "booking_reports_ix_9c74f8a1" ON "public"."booking_reports" USING btree ("expires_at");

REVOKE ALL ON "public"."booking_reports" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_reports" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_reviews" (
  "id" text COLLATE "C" PRIMARY KEY,
  "customer_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "verified_stay" boolean,
  "rating" jsonb,
  "comment" text COLLATE "C",
  "display_name" text COLLATE "C",
  "reply" jsonb,
  "status" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_reviews" IS 'Tirvona model collection booking_reviews. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_reviews"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."booking_reviews"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_reviews"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_reviews"."verified_stay" IS 'model field: verifiedStay';
COMMENT ON COLUMN "public"."booking_reviews"."display_name" IS 'model field: displayName';
COMMENT ON COLUMN "public"."booking_reviews"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_reviews"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_reviews"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_reviews" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_reviews_extra_f3b96143" ON "public"."booking_reviews" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_reviews_ix_d07a910a" ON "public"."booking_reviews" USING btree ("verified_stay");
CREATE UNIQUE INDEX "booking_reviews_uq_22aeffc6" ON "public"."booking_reviews" USING btree ("booking_id") NULLS NOT DISTINCT WHERE "booking_id" IS NOT NULL;
CREATE UNIQUE INDEX "booking_reviews_uq_5c4f4054" ON "public"."booking_reviews" USING btree ("customer_id", "ashram_id") NULLS NOT DISTINCT;
CREATE INDEX "booking_reviews_ix_b58203d9" ON "public"."booking_reviews" USING btree ("ashram_id", "status", "created_at" DESC NULLS LAST);
CREATE INDEX "booking_reviews_ix_82abfc2f" ON "public"."booking_reviews" USING btree ("status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."booking_reviews" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_reviews" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_room_assignments" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "room_id" text COLLATE "C",
  "room_number" text COLLATE "C",
  "assigned_by" text COLLATE "C",
  "assigned_at" timestamptz,
  "released_at" timestamptz,
  "status" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_room_assignments" IS 'Tirvona model collection booking_room_assignments. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_room_assignments"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_room_assignments"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_room_assignments"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."booking_room_assignments"."room_number" IS 'model field: roomNumber';
COMMENT ON COLUMN "public"."booking_room_assignments"."assigned_by" IS 'model field: assignedBy';
COMMENT ON COLUMN "public"."booking_room_assignments"."assigned_at" IS 'model field: assignedAt';
COMMENT ON COLUMN "public"."booking_room_assignments"."released_at" IS 'model field: releasedAt';
COMMENT ON COLUMN "public"."booking_room_assignments"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_room_assignments"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_room_assignments"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_room_assignments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_room_assignments_extra_dc2e158b" ON "public"."booking_room_assignments" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_room_assignments_ix_360919b8" ON "public"."booking_room_assignments" USING btree ("booking_id", "status");
CREATE INDEX "booking_room_assignments_ix_a05c1419" ON "public"."booking_room_assignments" USING btree ("ashram_id", "room_number", "status");

REVOKE ALL ON "public"."booking_room_assignments" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_room_assignments" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_settlements" (
  "id" text COLLATE "C" PRIMARY KEY,
  "settlement_reference" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "ashram_ids" jsonb,
  "commission_ids" jsonb,
  "gross_amount" double precision,
  "commission_amount" double precision,
  "tax_amount" double precision,
  "payout_amount" double precision,
  "currency" text COLLATE "C",
  "status" text COLLATE "C",
  "payout_reference" text COLLATE "C",
  "initiated_by" text COLLATE "C",
  "paid_at" timestamptz,
  "failure_reason" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_settlements" IS 'Tirvona model collection booking_settlements. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_settlements"."settlement_reference" IS 'model field: settlementReference';
COMMENT ON COLUMN "public"."booking_settlements"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."booking_settlements"."ashram_ids" IS 'model field: ashramIds';
COMMENT ON COLUMN "public"."booking_settlements"."commission_ids" IS 'model field: commissionIds';
COMMENT ON COLUMN "public"."booking_settlements"."gross_amount" IS 'model field: grossAmount';
COMMENT ON COLUMN "public"."booking_settlements"."commission_amount" IS 'model field: commissionAmount';
COMMENT ON COLUMN "public"."booking_settlements"."tax_amount" IS 'model field: taxAmount';
COMMENT ON COLUMN "public"."booking_settlements"."payout_amount" IS 'model field: payoutAmount';
COMMENT ON COLUMN "public"."booking_settlements"."payout_reference" IS 'model field: payoutReference';
COMMENT ON COLUMN "public"."booking_settlements"."initiated_by" IS 'model field: initiatedBy';
COMMENT ON COLUMN "public"."booking_settlements"."paid_at" IS 'model field: paidAt';
COMMENT ON COLUMN "public"."booking_settlements"."failure_reason" IS 'model field: failureReason';
COMMENT ON COLUMN "public"."booking_settlements"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_settlements"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."booking_settlements" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_settlements_extra_6bbba1df" ON "public"."booking_settlements" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_settlements_uq_0a56c46a" ON "public"."booking_settlements" USING btree ("settlement_reference") NULLS NOT DISTINCT;
CREATE INDEX "booking_settlements_ix_f349009c" ON "public"."booking_settlements" USING btree ("owner_id", "status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."booking_settlements" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_settlements" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_status_history" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "from_status" text COLLATE "C",
  "to_status" text COLLATE "C",
  "note" text COLLATE "C",
  "actor_id" text COLLATE "C",
  "actor_role" text COLLATE "C",
  "metadata" jsonb,
  "occurred_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_status_history" IS 'Tirvona model collection booking_status_history. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_status_history"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_status_history"."from_status" IS 'model field: fromStatus';
COMMENT ON COLUMN "public"."booking_status_history"."to_status" IS 'model field: toStatus';
COMMENT ON COLUMN "public"."booking_status_history"."actor_id" IS 'model field: actorId';
COMMENT ON COLUMN "public"."booking_status_history"."actor_role" IS 'model field: actorRole';
COMMENT ON COLUMN "public"."booking_status_history"."occurred_at" IS 'model field: occurredAt';
COMMENT ON COLUMN "public"."booking_status_history"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_status_history"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_status_history"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_status_history" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_status_history_extra_6dcb8fca" ON "public"."booking_status_history" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_status_history_ix_2a6e2d15" ON "public"."booking_status_history" USING btree ("booking_id", "occurred_at");

REVOKE ALL ON "public"."booking_status_history" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_status_history" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_support_tickets" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ticket_number" text COLLATE "C",
  "user_id" text COLLATE "C",
  "created_by" text COLLATE "C",
  "source" text COLLATE "C",
  "subject" text COLLATE "C",
  "description" text COLLATE "C",
  "category" text COLLATE "C",
  "category_label" text COLLATE "C",
  "status" text COLLATE "C",
  "priority" text COLLATE "C",
  "priority_rank" double precision,
  "assigned_to" text COLLATE "C",
  "assigned_at" timestamptz,
  "is_escalated" boolean,
  "escalation" jsonb,
  "related_entity" jsonb,
  "attachments" jsonb,
  "message_count" double precision,
  "unread_for_user" double precision,
  "unread_for_staff" double precision,
  "last_message_at" timestamptz,
  "last_user_message_at" timestamptz,
  "last_staff_message_at" timestamptz,
  "last_activity_at" timestamptz,
  "first_response_due_at" timestamptz,
  "resolution_due_at" timestamptz,
  "first_response_at" timestamptz,
  "first_response_minutes" double precision,
  "resolved_at" timestamptz,
  "resolution_minutes" double precision,
  "closed_at" timestamptz,
  "reopened_count" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_support_tickets" IS 'Tirvona model collection booking_support_tickets. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_support_tickets"."ticket_number" IS 'model field: ticketNumber';
COMMENT ON COLUMN "public"."booking_support_tickets"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."booking_support_tickets"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."booking_support_tickets"."category_label" IS 'model field: categoryLabel';
COMMENT ON COLUMN "public"."booking_support_tickets"."priority_rank" IS 'model field: priorityRank';
COMMENT ON COLUMN "public"."booking_support_tickets"."assigned_to" IS 'model field: assignedTo';
COMMENT ON COLUMN "public"."booking_support_tickets"."assigned_at" IS 'model field: assignedAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."is_escalated" IS 'model field: isEscalated';
COMMENT ON COLUMN "public"."booking_support_tickets"."related_entity" IS 'model field: relatedEntity';
COMMENT ON COLUMN "public"."booking_support_tickets"."message_count" IS 'model field: messageCount';
COMMENT ON COLUMN "public"."booking_support_tickets"."unread_for_user" IS 'model field: unreadForUser';
COMMENT ON COLUMN "public"."booking_support_tickets"."unread_for_staff" IS 'model field: unreadForStaff';
COMMENT ON COLUMN "public"."booking_support_tickets"."last_message_at" IS 'model field: lastMessageAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."last_user_message_at" IS 'model field: lastUserMessageAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."last_staff_message_at" IS 'model field: lastStaffMessageAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."last_activity_at" IS 'model field: lastActivityAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."first_response_due_at" IS 'model field: firstResponseDueAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."resolution_due_at" IS 'model field: resolutionDueAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."first_response_at" IS 'model field: firstResponseAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."first_response_minutes" IS 'model field: firstResponseMinutes';
COMMENT ON COLUMN "public"."booking_support_tickets"."resolved_at" IS 'model field: resolvedAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."resolution_minutes" IS 'model field: resolutionMinutes';
COMMENT ON COLUMN "public"."booking_support_tickets"."closed_at" IS 'model field: closedAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."reopened_count" IS 'model field: reopenedCount';
COMMENT ON COLUMN "public"."booking_support_tickets"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_support_tickets"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_support_tickets" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_support_tickets_extra_c07bd97f" ON "public"."booking_support_tickets" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "booking_support_tickets_uq_f01991bb" ON "public"."booking_support_tickets" USING btree ("ticket_number") NULLS NOT DISTINCT;
CREATE INDEX "booking_support_tickets_ix_5cd28265" ON "public"."booking_support_tickets" USING btree ("category");
CREATE INDEX "booking_support_tickets_ix_20b3ed65" ON "public"."booking_support_tickets" USING btree ("status");
CREATE INDEX "booking_support_tickets_ix_fe708a88" ON "public"."booking_support_tickets" USING btree ("priority");
CREATE INDEX "booking_support_tickets_ix_996457cb" ON "public"."booking_support_tickets" USING btree ("is_escalated");
CREATE INDEX "booking_support_tickets_ix_f99d0516" ON "public"."booking_support_tickets" USING btree ("last_activity_at");
CREATE INDEX "booking_support_tickets_ix_53637f3b" ON "public"."booking_support_tickets" USING btree ("user_id", "created_at" DESC NULLS LAST);
CREATE INDEX "booking_support_tickets_ix_82abfc2f" ON "public"."booking_support_tickets" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "booking_support_tickets_ix_562422c9" ON "public"."booking_support_tickets" USING btree ("assigned_to", "status");
CREATE INDEX "booking_support_tickets_ix_fc000e94" ON "public"."booking_support_tickets" USING btree ("status", "priority_rank" DESC NULLS LAST, "last_activity_at" DESC NULLS LAST);
CREATE INDEX "booking_support_tickets_ix_4dc29aaf" ON "public"."booking_support_tickets" USING btree (("related_entity" #> '{type}'), ("related_entity" #> '{entityId}'));
CREATE INDEX "booking_support_tickets_ix_856b3b21" ON "public"."booking_support_tickets" USING btree ("resolved_at");

REVOKE ALL ON "public"."booking_support_tickets" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_support_tickets" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_tax_records" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "invoice_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "taxable_amount" double precision,
  "gst_percent" double precision,
  "cgst" double precision,
  "sgst" double precision,
  "igst" double precision,
  "total_tax" double precision,
  "place_of_supply" text COLLATE "C",
  "tax_period" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_tax_records" IS 'Tirvona model collection booking_tax_records. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_tax_records"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_tax_records"."invoice_id" IS 'model field: invoiceId';
COMMENT ON COLUMN "public"."booking_tax_records"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_tax_records"."taxable_amount" IS 'model field: taxableAmount';
COMMENT ON COLUMN "public"."booking_tax_records"."gst_percent" IS 'model field: gstPercent';
COMMENT ON COLUMN "public"."booking_tax_records"."total_tax" IS 'model field: totalTax';
COMMENT ON COLUMN "public"."booking_tax_records"."place_of_supply" IS 'model field: placeOfSupply';
COMMENT ON COLUMN "public"."booking_tax_records"."tax_period" IS 'model field: taxPeriod';
COMMENT ON COLUMN "public"."booking_tax_records"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_tax_records"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_tax_records"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_tax_records" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_tax_records_extra_61f472eb" ON "public"."booking_tax_records" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_tax_records_ix_cc63a61e" ON "public"."booking_tax_records" USING btree ("ashram_id", "tax_period");

REVOKE ALL ON "public"."booking_tax_records" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_tax_records" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."booking_transactions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "payment_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "booking_source" text COLLATE "C",
  "type" text COLLATE "C",
  "direction" text COLLATE "C",
  "amount" double precision,
  "currency" text COLLATE "C",
  "reference" text COLLATE "C",
  "description" text COLLATE "C",
  "meta" jsonb,
  "recorded_by" text COLLATE "C",
  "occurred_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."booking_transactions" IS 'Tirvona model collection booking_transactions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."booking_transactions"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."booking_transactions"."payment_id" IS 'model field: paymentId';
COMMENT ON COLUMN "public"."booking_transactions"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."booking_transactions"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."booking_transactions"."booking_source" IS 'model field: bookingSource';
COMMENT ON COLUMN "public"."booking_transactions"."recorded_by" IS 'model field: recordedBy';
COMMENT ON COLUMN "public"."booking_transactions"."occurred_at" IS 'model field: occurredAt';
COMMENT ON COLUMN "public"."booking_transactions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."booking_transactions"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."booking_transactions"."version" IS 'model field: __v';
ALTER TABLE "public"."booking_transactions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "booking_transactions_extra_27ce4020" ON "public"."booking_transactions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "booking_transactions_ix_f3b9348e" ON "public"."booking_transactions" USING btree ("booking_source");
CREATE UNIQUE INDEX "booking_transactions_uq_43515549" ON "public"."booking_transactions" USING btree ("reference") NULLS NOT DISTINCT;
CREATE INDEX "booking_transactions_ix_8e3be854" ON "public"."booking_transactions" USING btree ("occurred_at");
CREATE INDEX "booking_transactions_ix_c44cc40d" ON "public"."booking_transactions" USING btree ("ashram_id", "type", "occurred_at" DESC NULLS LAST);
CREATE INDEX "booking_transactions_ix_2a6e2d15" ON "public"."booking_transactions" USING btree ("booking_id", "occurred_at");

REVOKE ALL ON "public"."booking_transactions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."booking_transactions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."bookings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "customer_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "assigned_room_number" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "cancellation" jsonb,
  "check_in_code" text COLLATE "C",
  "check_in_date" timestamptz,
  "check_out_date" timestamptz,
  "discount_percentage" double precision,
  "gateway_status" text COLLATE "C",
  "guests_count" double precision,
  "history" jsonb,
  "payment_mode" text COLLATE "C",
  "payment_status" text COLLATE "C",
  "payment_summary" jsonb,
  "pricing" jsonb,
  "reservation_expires_at" timestamptz,
  "reservation_number" text COLLATE "C",
  "reward_points_earned" double precision,
  "reward_points_used" double precision,
  "room_id" text COLLATE "C",
  "rooms_booked_count" double precision,
  "services" jsonb,
  "special_requests" text COLLATE "C",
  "status" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."bookings" IS 'Tirvona model collection bookings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."bookings"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."bookings"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."bookings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."bookings"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."bookings"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."bookings"."assigned_room_number" IS 'model field: assignedRoomNumber';
COMMENT ON COLUMN "public"."bookings"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."bookings"."check_in_code" IS 'model field: checkInCode';
COMMENT ON COLUMN "public"."bookings"."check_in_date" IS 'model field: checkInDate';
COMMENT ON COLUMN "public"."bookings"."check_out_date" IS 'model field: checkOutDate';
COMMENT ON COLUMN "public"."bookings"."discount_percentage" IS 'model field: discountPercentage';
COMMENT ON COLUMN "public"."bookings"."gateway_status" IS 'model field: gatewayStatus';
COMMENT ON COLUMN "public"."bookings"."guests_count" IS 'model field: guestsCount';
COMMENT ON COLUMN "public"."bookings"."payment_mode" IS 'model field: paymentMode';
COMMENT ON COLUMN "public"."bookings"."payment_status" IS 'model field: paymentStatus';
COMMENT ON COLUMN "public"."bookings"."payment_summary" IS 'model field: paymentSummary';
COMMENT ON COLUMN "public"."bookings"."reservation_expires_at" IS 'model field: reservationExpiresAt';
COMMENT ON COLUMN "public"."bookings"."reservation_number" IS 'model field: reservationNumber';
COMMENT ON COLUMN "public"."bookings"."reward_points_earned" IS 'model field: rewardPointsEarned';
COMMENT ON COLUMN "public"."bookings"."reward_points_used" IS 'model field: rewardPointsUsed';
COMMENT ON COLUMN "public"."bookings"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."bookings"."rooms_booked_count" IS 'model field: roomsBookedCount';
COMMENT ON COLUMN "public"."bookings"."special_requests" IS 'model field: specialRequests';
ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "bookings_extra_9e79a890" ON "public"."bookings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "bookings_ix_435dc7a5" ON "public"."bookings" USING btree ("customer_id");
CREATE INDEX "bookings_ix_20b3ed65" ON "public"."bookings" USING btree ("status");
CREATE UNIQUE INDEX "bookings_uq_68b24c9f" ON "public"."bookings" USING btree ("booking_id") NULLS NOT DISTINCT;
CREATE INDEX "bookings_ix_e55dc705" ON "public"."bookings" USING btree ("customer_id", "created_at" DESC NULLS LAST);
CREATE INDEX "bookings_ix_69fb8f24" ON "public"."bookings" USING btree ("check_in_date", "check_out_date");
CREATE INDEX "bookings_ix_b58203d9" ON "public"."bookings" USING btree ("ashram_id", "status", "created_at" DESC NULLS LAST);
CREATE INDEX "bookings_ix_d9ea7225" ON "public"."bookings" USING btree ("ashram_id", "check_in_date");
CREATE INDEX "bookings_ix_20e39220" ON "public"."bookings" USING btree ("ashram_id", "status");

REVOKE ALL ON "public"."bookings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."bookings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."contentchangerequests" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "approved_by" text COLLATE "C",
  "rejected_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "new_value" jsonb,
  "page" text COLLATE "C",
  "role" text COLLATE "C",
  "section" text COLLATE "C",
  "status" text COLLATE "C",
  "title" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."contentchangerequests" IS 'Tirvona model collection contentchangerequests. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."contentchangerequests"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."contentchangerequests"."approved_by" IS 'model field: approvedBy';
COMMENT ON COLUMN "public"."contentchangerequests"."rejected_by" IS 'model field: rejectedBy';
COMMENT ON COLUMN "public"."contentchangerequests"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."contentchangerequests"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."contentchangerequests"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."contentchangerequests"."new_value" IS 'model field: newValue';
ALTER TABLE "public"."contentchangerequests" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "contentchangerequests_extra_a04abec2" ON "public"."contentchangerequests" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "contentchangerequests_ix_fd6afe8d" ON "public"."contentchangerequests" USING btree ("user_id");
CREATE INDEX "contentchangerequests_ix_2b762d48" ON "public"."contentchangerequests" USING btree ("status", "user_id", "created_at" DESC NULLS LAST);
CREATE INDEX "contentchangerequests_ix_20b3ed65" ON "public"."contentchangerequests" USING btree ("status");
CREATE INDEX "contentchangerequests_ix_67bad42f" ON "public"."contentchangerequests" USING btree ("created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."contentchangerequests" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."contentchangerequests" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."day_stay_products" (
  "id" text COLLATE "C" PRIMARY KEY,
  "product_code" text COLLATE "C",
  "product_type" text COLLATE "C",
  "display_name" text COLLATE "C",
  "duration_minutes" double precision,
  "active" boolean,
  "sort_order" double precision,
  "description" text COLLATE "C",
  "applicable_property_ids" jsonb,
  "metadata" jsonb,
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."day_stay_products" IS 'Tirvona model collection day_stay_products. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."day_stay_products"."product_code" IS 'model field: productCode';
COMMENT ON COLUMN "public"."day_stay_products"."product_type" IS 'model field: productType';
COMMENT ON COLUMN "public"."day_stay_products"."display_name" IS 'model field: displayName';
COMMENT ON COLUMN "public"."day_stay_products"."duration_minutes" IS 'model field: durationMinutes';
COMMENT ON COLUMN "public"."day_stay_products"."sort_order" IS 'model field: sortOrder';
COMMENT ON COLUMN "public"."day_stay_products"."applicable_property_ids" IS 'model field: applicablePropertyIds';
COMMENT ON COLUMN "public"."day_stay_products"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."day_stay_products"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."day_stay_products"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."day_stay_products"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."day_stay_products"."version" IS 'model field: __v';
ALTER TABLE "public"."day_stay_products" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "day_stay_products_extra_106a0301" ON "public"."day_stay_products" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "day_stay_products_uq_66fdd4da" ON "public"."day_stay_products" USING btree ("product_code") NULLS NOT DISTINCT;
CREATE INDEX "day_stay_products_ix_dafc8d8e" ON "public"."day_stay_products" USING btree ("product_type");
CREATE INDEX "day_stay_products_ix_4f928796" ON "public"."day_stay_products" USING btree ("active");
CREATE INDEX "day_stay_products_ix_41fa711a" ON "public"."day_stay_products" USING btree ("active", "sort_order");
CREATE INDEX "day_stay_products_ix_49f6a57e" ON "public"."day_stay_products" USING btree ("product_type", "active");

REVOKE ALL ON "public"."day_stay_products" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."day_stay_products" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."event_availability" (
  "id" text COLLATE "C" PRIMARY KEY,
  "event_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "date" timestamptz,
  "total_capacity" double precision,
  "booked_count" double precision,
  "blocked_count" double precision,
  "is_closed" boolean,
  "note" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."event_availability" IS 'Tirvona model collection event_availability. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."event_availability"."event_id" IS 'model field: eventId';
COMMENT ON COLUMN "public"."event_availability"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."event_availability"."total_capacity" IS 'model field: totalCapacity';
COMMENT ON COLUMN "public"."event_availability"."booked_count" IS 'model field: bookedCount';
COMMENT ON COLUMN "public"."event_availability"."blocked_count" IS 'model field: blockedCount';
COMMENT ON COLUMN "public"."event_availability"."is_closed" IS 'model field: isClosed';
COMMENT ON COLUMN "public"."event_availability"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."event_availability"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."event_availability" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "event_availability_extra_8080da0d" ON "public"."event_availability" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "event_availability_ix_a6706b81" ON "public"."event_availability" USING btree ("event_id");
CREATE UNIQUE INDEX "event_availability_uq_f4cccbc8" ON "public"."event_availability" USING btree ("event_id", "date") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."event_availability" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."event_availability" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."event_festivals" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "name" text COLLATE "C",
  "slug" text COLLATE "C",
  "event_type" text COLLATE "C",
  "deity" text COLLATE "C",
  "tagline" text COLLATE "C",
  "description" text COLLATE "C",
  "highlights" jsonb,
  "dress_code" text COLLATE "C",
  "instructions" text COLLATE "C",
  "terms_and_conditions" text COLLATE "C",
  "images" jsonb,
  "cover_image" text COLLATE "C",
  "venue" jsonb,
  "geo" jsonb,
  "latitude" double precision,
  "longitude" double precision,
  "google_maps_url" text COLLATE "C",
  "start_date" timestamptz,
  "end_date" timestamptz,
  "start_time" text COLLATE "C",
  "duration_minutes" double precision,
  "timezone" text COLLATE "C",
  "daily_schedule" jsonb,
  "facilities" jsonb,
  "contact_phone" text COLLATE "C",
  "contact_email" text COLLATE "C",
  "requires_registration" boolean,
  "daily_capacity" double precision,
  "max_seats_per_registration" double precision,
  "is_featured" boolean,
  "status" text COLLATE "C",
  "submitted_at" timestamptz,
  "approved_at" timestamptz,
  "approved_by" text COLLATE "C",
  "rejection_reason" text COLLATE "C",
  "view_count" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."event_festivals" IS 'Tirvona model collection event_festivals. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."event_festivals"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."event_festivals"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."event_festivals"."event_type" IS 'model field: eventType';
COMMENT ON COLUMN "public"."event_festivals"."dress_code" IS 'model field: dressCode';
COMMENT ON COLUMN "public"."event_festivals"."terms_and_conditions" IS 'model field: termsAndConditions';
COMMENT ON COLUMN "public"."event_festivals"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."event_festivals"."google_maps_url" IS 'model field: googleMapsUrl';
COMMENT ON COLUMN "public"."event_festivals"."start_date" IS 'model field: startDate';
COMMENT ON COLUMN "public"."event_festivals"."end_date" IS 'model field: endDate';
COMMENT ON COLUMN "public"."event_festivals"."start_time" IS 'model field: startTime';
COMMENT ON COLUMN "public"."event_festivals"."duration_minutes" IS 'model field: durationMinutes';
COMMENT ON COLUMN "public"."event_festivals"."daily_schedule" IS 'model field: dailySchedule';
COMMENT ON COLUMN "public"."event_festivals"."contact_phone" IS 'model field: contactPhone';
COMMENT ON COLUMN "public"."event_festivals"."contact_email" IS 'model field: contactEmail';
COMMENT ON COLUMN "public"."event_festivals"."requires_registration" IS 'model field: requiresRegistration';
COMMENT ON COLUMN "public"."event_festivals"."daily_capacity" IS 'model field: dailyCapacity';
COMMENT ON COLUMN "public"."event_festivals"."max_seats_per_registration" IS 'model field: maxSeatsPerRegistration';
COMMENT ON COLUMN "public"."event_festivals"."is_featured" IS 'model field: isFeatured';
COMMENT ON COLUMN "public"."event_festivals"."submitted_at" IS 'model field: submittedAt';
COMMENT ON COLUMN "public"."event_festivals"."approved_at" IS 'model field: approvedAt';
COMMENT ON COLUMN "public"."event_festivals"."approved_by" IS 'model field: approvedBy';
COMMENT ON COLUMN "public"."event_festivals"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."event_festivals"."view_count" IS 'model field: viewCount';
COMMENT ON COLUMN "public"."event_festivals"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."event_festivals"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."event_festivals" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "event_festivals_extra_3309005e" ON "public"."event_festivals" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "event_festivals_ix_4c90543b" ON "public"."event_festivals" USING btree ("ashram_id");
CREATE INDEX "event_festivals_ix_8f882ef5" ON "public"."event_festivals" USING btree ("owner_id");
CREATE UNIQUE INDEX "event_festivals_uq_7a0923dd" ON "public"."event_festivals" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "event_festivals_ix_cbe055ed" ON "public"."event_festivals" USING btree ("event_type");
CREATE INDEX "event_festivals_ix_dcf03ed6" ON "public"."event_festivals" USING btree (("venue" #> '{city}'));
CREATE INDEX "event_festivals_ix_90bc5a5a" ON "public"."event_festivals" USING btree (("venue" #> '{state}'));
CREATE INDEX "event_festivals_ix_1df469bc" ON "public"."event_festivals" USING btree ("start_date");
CREATE INDEX "event_festivals_ix_58c078f5" ON "public"."event_festivals" USING btree ("end_date");
CREATE INDEX "event_festivals_ix_d5e5ae6e" ON "public"."event_festivals" USING btree ("is_featured");
CREATE INDEX "event_festivals_ix_20b3ed65" ON "public"."event_festivals" USING btree ("status");
CREATE INDEX "event_festivals_ix_d3afecfb" ON "public"."event_festivals" USING btree ("status", "is_featured" DESC NULLS LAST, "start_date");
CREATE INDEX "event_festivals_ix_20e39220" ON "public"."event_festivals" USING btree ("ashram_id", "status");
CREATE INDEX "event_festivals_ix_066aeca0" ON "public"."event_festivals" USING btree (("venue" #> '{city}'), "status");
CREATE INDEX "event_festivals_ix_d67ac85e" ON "public"."event_festivals" USING btree ("status", "start_date", "end_date");
CREATE INDEX "event_festivals_ix_f349009c" ON "public"."event_festivals" USING btree ("owner_id", "status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."event_festivals" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."event_festivals" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."event_notifications" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "registration_id" text COLLATE "C",
  "event" text COLLATE "C",
  "title" text COLLATE "C",
  "message" text COLLATE "C",
  "channel" text COLLATE "C",
  "status" text COLLATE "C",
  "recipient_phone" text COLLATE "C",
  "delivery_error" text COLLATE "C",
  "provider_message_id" text COLLATE "C",
  "sent_at" timestamptz,
  "read_at" timestamptz,
  "meta" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."event_notifications" IS 'Tirvona model collection event_notifications. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."event_notifications"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."event_notifications"."registration_id" IS 'model field: registrationId';
COMMENT ON COLUMN "public"."event_notifications"."recipient_phone" IS 'model field: recipientPhone';
COMMENT ON COLUMN "public"."event_notifications"."delivery_error" IS 'model field: deliveryError';
COMMENT ON COLUMN "public"."event_notifications"."provider_message_id" IS 'model field: providerMessageId';
COMMENT ON COLUMN "public"."event_notifications"."sent_at" IS 'model field: sentAt';
COMMENT ON COLUMN "public"."event_notifications"."read_at" IS 'model field: readAt';
COMMENT ON COLUMN "public"."event_notifications"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."event_notifications"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."event_notifications" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "event_notifications_extra_11cd95e3" ON "public"."event_notifications" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "event_notifications_ix_2b29ad3b" ON "public"."event_notifications" USING btree ("event");
CREATE INDEX "event_notifications_ix_20b3ed65" ON "public"."event_notifications" USING btree ("status");
CREATE INDEX "event_notifications_ix_53637f3b" ON "public"."event_notifications" USING btree ("user_id", "created_at" DESC NULLS LAST);
CREATE INDEX "event_notifications_ix_38f5f0a0" ON "public"."event_notifications" USING btree ("user_id", "read_at");

REVOKE ALL ON "public"."event_notifications" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."event_notifications" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."event_qr_codes" (
  "id" text COLLATE "C" PRIMARY KEY,
  "registration_id" text COLLATE "C",
  "event_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "token_hash" text COLLATE "C",
  "token" text COLLATE "C",
  "display_code" text COLLATE "C",
  "version" double precision,
  "issued_at" timestamptz,
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "entry_scanned_at" timestamptz,
  "scan_count" double precision,
  "status" text COLLATE "C",
  "revoked_reason" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."event_qr_codes" IS 'Tirvona model collection event_qr_codes. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."event_qr_codes"."registration_id" IS 'model field: registrationId';
COMMENT ON COLUMN "public"."event_qr_codes"."event_id" IS 'model field: eventId';
COMMENT ON COLUMN "public"."event_qr_codes"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."event_qr_codes"."token_hash" IS 'model field: tokenHash';
COMMENT ON COLUMN "public"."event_qr_codes"."display_code" IS 'model field: displayCode';
COMMENT ON COLUMN "public"."event_qr_codes"."issued_at" IS 'model field: issuedAt';
COMMENT ON COLUMN "public"."event_qr_codes"."valid_from" IS 'model field: validFrom';
COMMENT ON COLUMN "public"."event_qr_codes"."valid_until" IS 'model field: validUntil';
COMMENT ON COLUMN "public"."event_qr_codes"."entry_scanned_at" IS 'model field: entryScannedAt';
COMMENT ON COLUMN "public"."event_qr_codes"."scan_count" IS 'model field: scanCount';
COMMENT ON COLUMN "public"."event_qr_codes"."revoked_reason" IS 'model field: revokedReason';
COMMENT ON COLUMN "public"."event_qr_codes"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."event_qr_codes"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."event_qr_codes" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "event_qr_codes_extra_41268a49" ON "public"."event_qr_codes" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "event_qr_codes_ix_a6706b81" ON "public"."event_qr_codes" USING btree ("event_id");
CREATE INDEX "event_qr_codes_ix_435dc7a5" ON "public"."event_qr_codes" USING btree ("customer_id");
CREATE INDEX "event_qr_codes_ix_d462fecd" ON "public"."event_qr_codes" USING btree ("valid_until");
CREATE INDEX "event_qr_codes_ix_20b3ed65" ON "public"."event_qr_codes" USING btree ("status");
CREATE INDEX "event_qr_codes_ix_f7fd7d94" ON "public"."event_qr_codes" USING btree ("token_hash", "status");
CREATE INDEX "event_qr_codes_ix_d3ee67d1" ON "public"."event_qr_codes" USING btree ("registration_id", "version" DESC NULLS LAST);
CREATE INDEX "event_qr_codes_ix_b8e2ab72" ON "public"."event_qr_codes" USING btree ("display_code");

REVOKE ALL ON "public"."event_qr_codes" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."event_qr_codes" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."event_registrations" (
  "id" text COLLATE "C" PRIMARY KEY,
  "registration_reference" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "event_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "attend_date" timestamptz,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "seats" double precision,
  "attendees" jsonb,
  "contact_name" text COLLATE "C",
  "contact_phone" text COLLATE "C",
  "contact_email" text COLLATE "C",
  "checked_in_at" timestamptz,
  "checked_in_count" double precision,
  "status" text COLLATE "C",
  "cancellation" jsonb,
  "history" jsonb,
  "notes" text COLLATE "C",
  "source" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."event_registrations" IS 'Tirvona model collection event_registrations. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."event_registrations"."registration_reference" IS 'model field: registrationReference';
COMMENT ON COLUMN "public"."event_registrations"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."event_registrations"."event_id" IS 'model field: eventId';
COMMENT ON COLUMN "public"."event_registrations"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."event_registrations"."attend_date" IS 'model field: attendDate';
COMMENT ON COLUMN "public"."event_registrations"."starts_at" IS 'model field: startsAt';
COMMENT ON COLUMN "public"."event_registrations"."ends_at" IS 'model field: endsAt';
COMMENT ON COLUMN "public"."event_registrations"."contact_name" IS 'model field: contactName';
COMMENT ON COLUMN "public"."event_registrations"."contact_phone" IS 'model field: contactPhone';
COMMENT ON COLUMN "public"."event_registrations"."contact_email" IS 'model field: contactEmail';
COMMENT ON COLUMN "public"."event_registrations"."checked_in_at" IS 'model field: checkedInAt';
COMMENT ON COLUMN "public"."event_registrations"."checked_in_count" IS 'model field: checkedInCount';
COMMENT ON COLUMN "public"."event_registrations"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."event_registrations"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."event_registrations" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "event_registrations_extra_929f3870" ON "public"."event_registrations" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "event_registrations_uq_bf4a121f" ON "public"."event_registrations" USING btree ("registration_reference") NULLS NOT DISTINCT;
CREATE INDEX "event_registrations_ix_d25da91e" ON "public"."event_registrations" USING btree ("attend_date");
CREATE INDEX "event_registrations_ix_1c5b4ce6" ON "public"."event_registrations" USING btree ("starts_at");
CREATE INDEX "event_registrations_ix_20b3ed65" ON "public"."event_registrations" USING btree ("status");
CREATE INDEX "event_registrations_ix_e55dc705" ON "public"."event_registrations" USING btree ("customer_id", "created_at" DESC NULLS LAST);
CREATE INDEX "event_registrations_ix_9afaba6e" ON "public"."event_registrations" USING btree ("event_id", "status", "attend_date");
CREATE INDEX "event_registrations_ix_b58203d9" ON "public"."event_registrations" USING btree ("ashram_id", "status", "created_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "event_registrations_uq_c1f4a034" ON "public"."event_registrations" USING btree ("event_id", "attend_date", "customer_id") NULLS NOT DISTINCT WHERE "status" IN ('confirmed', 'checked_in', 'attended');

REVOKE ALL ON "public"."event_registrations" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."event_registrations" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."event_scan_logs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "registration_id" text COLLATE "C",
  "qr_code_id" text COLLATE "C",
  "event_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "scanned_by_user_id" text COLLATE "C",
  "scanned_by_staff_id" text COLLATE "C",
  "action" text COLLATE "C",
  "result" text COLLATE "C",
  "token_fingerprint" text COLLATE "C",
  "registration_reference" text COLLATE "C",
  "seats" double precision,
  "message" text COLLATE "C",
  "device_info" text COLLATE "C",
  "ip_address" text COLLATE "C",
  "scanned_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."event_scan_logs" IS 'Tirvona model collection event_scan_logs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."event_scan_logs"."registration_id" IS 'model field: registrationId';
COMMENT ON COLUMN "public"."event_scan_logs"."qr_code_id" IS 'model field: qrCodeId';
COMMENT ON COLUMN "public"."event_scan_logs"."event_id" IS 'model field: eventId';
COMMENT ON COLUMN "public"."event_scan_logs"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."event_scan_logs"."scanned_by_user_id" IS 'model field: scannedByUserId';
COMMENT ON COLUMN "public"."event_scan_logs"."scanned_by_staff_id" IS 'model field: scannedByStaffId';
COMMENT ON COLUMN "public"."event_scan_logs"."token_fingerprint" IS 'model field: tokenFingerprint';
COMMENT ON COLUMN "public"."event_scan_logs"."registration_reference" IS 'model field: registrationReference';
COMMENT ON COLUMN "public"."event_scan_logs"."device_info" IS 'model field: deviceInfo';
COMMENT ON COLUMN "public"."event_scan_logs"."ip_address" IS 'model field: ipAddress';
COMMENT ON COLUMN "public"."event_scan_logs"."scanned_at" IS 'model field: scannedAt';
COMMENT ON COLUMN "public"."event_scan_logs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."event_scan_logs"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."event_scan_logs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "event_scan_logs_extra_6bd93157" ON "public"."event_scan_logs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "event_scan_logs_ix_c13d88d4" ON "public"."event_scan_logs" USING btree ("qr_code_id");
CREATE INDEX "event_scan_logs_ix_0752c4cb" ON "public"."event_scan_logs" USING btree ("scanned_by_user_id");
CREATE INDEX "event_scan_logs_ix_02cfbbe7" ON "public"."event_scan_logs" USING btree ("action");
CREATE INDEX "event_scan_logs_ix_e8872df6" ON "public"."event_scan_logs" USING btree ("scanned_at");
CREATE INDEX "event_scan_logs_ix_f157e986" ON "public"."event_scan_logs" USING btree ("event_id", "scanned_at" DESC NULLS LAST);
CREATE INDEX "event_scan_logs_ix_e6eba7ef" ON "public"."event_scan_logs" USING btree ("result", "scanned_at" DESC NULLS LAST);

REVOKE ALL ON "public"."event_scan_logs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."event_scan_logs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."event_settings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "scope" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "event_id" text COLLATE "C",
  "gate_opens_before_minutes" double precision,
  "no_show_after_minutes" double precision,
  "max_seats_per_registration" double precision,
  "registration_opens_days_ahead" double precision,
  "registration_closes_before_minutes" double precision,
  "qr_validity_buffer_minutes" double precision,
  "allow_registration" boolean,
  "allow_cancellation" boolean,
  "require_attendee_names" boolean,
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."event_settings" IS 'Tirvona model collection event_settings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."event_settings"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."event_settings"."event_id" IS 'model field: eventId';
COMMENT ON COLUMN "public"."event_settings"."gate_opens_before_minutes" IS 'model field: gateOpensBeforeMinutes';
COMMENT ON COLUMN "public"."event_settings"."no_show_after_minutes" IS 'model field: noShowAfterMinutes';
COMMENT ON COLUMN "public"."event_settings"."max_seats_per_registration" IS 'model field: maxSeatsPerRegistration';
COMMENT ON COLUMN "public"."event_settings"."registration_opens_days_ahead" IS 'model field: registrationOpensDaysAhead';
COMMENT ON COLUMN "public"."event_settings"."registration_closes_before_minutes" IS 'model field: registrationClosesBeforeMinutes';
COMMENT ON COLUMN "public"."event_settings"."qr_validity_buffer_minutes" IS 'model field: qrValidityBufferMinutes';
COMMENT ON COLUMN "public"."event_settings"."allow_registration" IS 'model field: allowRegistration';
COMMENT ON COLUMN "public"."event_settings"."allow_cancellation" IS 'model field: allowCancellation';
COMMENT ON COLUMN "public"."event_settings"."require_attendee_names" IS 'model field: requireAttendeeNames';
COMMENT ON COLUMN "public"."event_settings"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."event_settings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."event_settings"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."event_settings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "event_settings_extra_5e265654" ON "public"."event_settings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "event_settings_ix_5cee787c" ON "public"."event_settings" USING btree ("scope");
CREATE INDEX "event_settings_ix_9a43c22b" ON "public"."event_settings" USING btree ("scope", "ashram_id", "event_id");

REVOKE ALL ON "public"."event_settings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."event_settings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."event_staff" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "event_ids" jsonb,
  "event_role" text COLLATE "C",
  "capability_overrides" jsonb,
  "employee_code" text COLLATE "C",
  "phone" text COLLATE "C",
  "shift" text COLLATE "C",
  "status" text COLLATE "C",
  "last_active_at" timestamptz,
  "created_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."event_staff" IS 'Tirvona model collection event_staff. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."event_staff"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."event_staff"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."event_staff"."event_ids" IS 'model field: eventIds';
COMMENT ON COLUMN "public"."event_staff"."event_role" IS 'model field: eventRole';
COMMENT ON COLUMN "public"."event_staff"."capability_overrides" IS 'model field: capabilityOverrides';
COMMENT ON COLUMN "public"."event_staff"."employee_code" IS 'model field: employeeCode';
COMMENT ON COLUMN "public"."event_staff"."last_active_at" IS 'model field: lastActiveAt';
COMMENT ON COLUMN "public"."event_staff"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."event_staff"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."event_staff"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."event_staff" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "event_staff_extra_010b403d" ON "public"."event_staff" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "event_staff_ix_fd6afe8d" ON "public"."event_staff" USING btree ("user_id");
CREATE INDEX "event_staff_ix_4c90543b" ON "public"."event_staff" USING btree ("ashram_id");
CREATE INDEX "event_staff_ix_103e7143" ON "public"."event_staff" USING btree ("event_role");
CREATE INDEX "event_staff_ix_20b3ed65" ON "public"."event_staff" USING btree ("status");
CREATE INDEX "event_staff_ix_9b647de0" ON "public"."event_staff" USING btree ("user_id", "status");

REVOKE ALL ON "public"."event_staff" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."event_staff" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."eventfestivals" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "cover_image" text COLLATE "C",
  "description" text COLLATE "C",
  "end_date" timestamptz,
  "event_type" text COLLATE "C",
  "featured" boolean,
  "gallery" jsonb,
  "location" text COLLATE "C",
  "registration_link" text COLLATE "C",
  "slug" text COLLATE "C",
  "start_date" timestamptz,
  "status" text COLLATE "C",
  "temple_name" text COLLATE "C",
  "ticket_price" text COLLATE "C",
  "title" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."eventfestivals" IS 'Tirvona model collection eventfestivals. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."eventfestivals"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."eventfestivals"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."eventfestivals"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."eventfestivals"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."eventfestivals"."end_date" IS 'model field: endDate';
COMMENT ON COLUMN "public"."eventfestivals"."event_type" IS 'model field: eventType';
COMMENT ON COLUMN "public"."eventfestivals"."registration_link" IS 'model field: registrationLink';
COMMENT ON COLUMN "public"."eventfestivals"."start_date" IS 'model field: startDate';
COMMENT ON COLUMN "public"."eventfestivals"."temple_name" IS 'model field: templeName';
COMMENT ON COLUMN "public"."eventfestivals"."ticket_price" IS 'model field: ticketPrice';
ALTER TABLE "public"."eventfestivals" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "eventfestivals_extra_cbc52dde" ON "public"."eventfestivals" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "eventfestivals_uq_7a0923dd" ON "public"."eventfestivals" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "eventfestivals_ix_1df469bc" ON "public"."eventfestivals" USING btree ("start_date");
CREATE INDEX "eventfestivals_ix_2194f4ed" ON "public"."eventfestivals" USING btree ("event_type", "start_date");

REVOKE ALL ON "public"."eventfestivals" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."eventfestivals" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."featured_banners" (
  "id" text COLLATE "C" PRIMARY KEY,
  "slug" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "cover_image" text COLLATE "C",
  "cta_text" text COLLATE "C",
  "cta_url" text COLLATE "C",
  "description" text COLLATE "C",
  "end_date" text COLLATE "C",
  "event_details" text COLLATE "C",
  "event_name" text COLLATE "C",
  "gallery" text[] COLLATE "C",
  "image" text COLLATE "C",
  "images" text[] COLLATE "C",
  "image_url" text COLLATE "C",
  "is_verified" boolean,
  "linked_entity_id" text COLLATE "C",
  "linked_entity_name" text COLLATE "C",
  "linked_entity_slug" text COLLATE "C",
  "location" text COLLATE "C",
  "related_ashram_id" text COLLATE "C",
  "related_ashram_name" text COLLATE "C",
  "related_ashram_slug" text COLLATE "C",
  "related_content_type" text COLLATE "C",
  "related_district" text COLLATE "C",
  "related_state" text COLLATE "C",
  "start_date" text COLLATE "C",
  "status" text COLLATE "C",
  "subtitle" text COLLATE "C",
  "timing" text COLLATE "C",
  "title" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."featured_banners" IS 'Tirvona model collection featured_banners. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."featured_banners"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."featured_banners"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."featured_banners"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."featured_banners"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."featured_banners"."cta_text" IS 'model field: ctaText';
COMMENT ON COLUMN "public"."featured_banners"."cta_url" IS 'model field: ctaUrl';
COMMENT ON COLUMN "public"."featured_banners"."end_date" IS 'model field: endDate';
COMMENT ON COLUMN "public"."featured_banners"."event_details" IS 'model field: eventDetails';
COMMENT ON COLUMN "public"."featured_banners"."event_name" IS 'model field: eventName';
COMMENT ON COLUMN "public"."featured_banners"."image_url" IS 'model field: imageUrl';
COMMENT ON COLUMN "public"."featured_banners"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."featured_banners"."linked_entity_id" IS 'model field: linkedEntityId';
COMMENT ON COLUMN "public"."featured_banners"."linked_entity_name" IS 'model field: linkedEntityName';
COMMENT ON COLUMN "public"."featured_banners"."linked_entity_slug" IS 'model field: linkedEntitySlug';
COMMENT ON COLUMN "public"."featured_banners"."related_ashram_id" IS 'model field: relatedAshramId';
COMMENT ON COLUMN "public"."featured_banners"."related_ashram_name" IS 'model field: relatedAshramName';
COMMENT ON COLUMN "public"."featured_banners"."related_ashram_slug" IS 'model field: relatedAshramSlug';
COMMENT ON COLUMN "public"."featured_banners"."related_content_type" IS 'model field: relatedContentType';
COMMENT ON COLUMN "public"."featured_banners"."related_district" IS 'model field: relatedDistrict';
COMMENT ON COLUMN "public"."featured_banners"."related_state" IS 'model field: relatedState';
COMMENT ON COLUMN "public"."featured_banners"."start_date" IS 'model field: startDate';
ALTER TABLE "public"."featured_banners" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "featured_banners_extra_adce22fc" ON "public"."featured_banners" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "featured_banners_uq_16cc4602" ON "public"."featured_banners" USING btree ("slug") WHERE "slug" IS NOT NULL;

REVOKE ALL ON "public"."featured_banners" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."featured_banners" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."institutioncontacts" (
  "id" text COLLATE "C" PRIMARY KEY,
  "institution_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."institutioncontacts" IS 'Tirvona model collection institutioncontacts. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."institutioncontacts"."institution_id" IS 'model field: institutionId';
COMMENT ON COLUMN "public"."institutioncontacts"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."institutioncontacts"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."institutioncontacts" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "institutioncontacts_extra_cd4b9526" ON "public"."institutioncontacts" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "institutioncontacts_ix_cc786dd2" ON "public"."institutioncontacts" USING btree ("institution_id");

REVOKE ALL ON "public"."institutioncontacts" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."institutioncontacts" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."institutionlocations" (
  "id" text COLLATE "C" PRIMARY KEY,
  "institution_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."institutionlocations" IS 'Tirvona model collection institutionlocations. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."institutionlocations"."institution_id" IS 'model field: institutionId';
COMMENT ON COLUMN "public"."institutionlocations"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."institutionlocations"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."institutionlocations" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "institutionlocations_extra_5d87bc6b" ON "public"."institutionlocations" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "institutionlocations_ix_cc786dd2" ON "public"."institutionlocations" USING btree ("institution_id");

REVOKE ALL ON "public"."institutionlocations" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."institutionlocations" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."institutionmasters" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."institutionmasters" IS 'Tirvona model collection institutionmasters. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."institutionmasters"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."institutionmasters"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."institutionmasters" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "institutionmasters_extra_32cd3fc6" ON "public"."institutionmasters" USING gin ("_extra") WHERE "_extra" IS NOT NULL;

REVOKE ALL ON "public"."institutionmasters" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."institutionmasters" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."institutionqualityaudits" (
  "id" text COLLATE "C" PRIMARY KEY,
  "institution_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."institutionqualityaudits" IS 'Tirvona model collection institutionqualityaudits. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."institutionqualityaudits"."institution_id" IS 'model field: institutionId';
COMMENT ON COLUMN "public"."institutionqualityaudits"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."institutionqualityaudits"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."institutionqualityaudits" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "institutionqualityaudits_extra_f79c412a" ON "public"."institutionqualityaudits" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "institutionqualityaudits_ix_cc786dd2" ON "public"."institutionqualityaudits" USING btree ("institution_id");

REVOKE ALL ON "public"."institutionqualityaudits" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."institutionqualityaudits" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."inventory_return_requests" (
  "id" text COLLATE "C" PRIMARY KEY,
  "reference" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "offline_room_id" text COLLATE "C",
  "room_id" text COLLATE "C",
  "units" double precision,
  "from_date" timestamptz,
  "to_date" timestamptz,
  "dates_covered" double precision,
  "reason" text COLLATE "C",
  "status" text COLLATE "C",
  "requested_by" text COLLATE "C",
  "requested_by_role" text COLLATE "C",
  "decided_by" text COLLATE "C",
  "decided_by_role" text COLLATE "C",
  "decided_at" timestamptz,
  "rejection_reason" text COLLATE "C",
  "online_inventory_before" double precision,
  "offline_available_before" double precision,
  "online_inventory_after" double precision,
  "offline_available_after" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."inventory_return_requests" IS 'Tirvona model collection inventory_return_requests. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."inventory_return_requests"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."inventory_return_requests"."offline_room_id" IS 'model field: offlineRoomId';
COMMENT ON COLUMN "public"."inventory_return_requests"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."inventory_return_requests"."from_date" IS 'model field: fromDate';
COMMENT ON COLUMN "public"."inventory_return_requests"."to_date" IS 'model field: toDate';
COMMENT ON COLUMN "public"."inventory_return_requests"."dates_covered" IS 'model field: datesCovered';
COMMENT ON COLUMN "public"."inventory_return_requests"."requested_by" IS 'model field: requestedBy';
COMMENT ON COLUMN "public"."inventory_return_requests"."requested_by_role" IS 'model field: requestedByRole';
COMMENT ON COLUMN "public"."inventory_return_requests"."decided_by" IS 'model field: decidedBy';
COMMENT ON COLUMN "public"."inventory_return_requests"."decided_by_role" IS 'model field: decidedByRole';
COMMENT ON COLUMN "public"."inventory_return_requests"."decided_at" IS 'model field: decidedAt';
COMMENT ON COLUMN "public"."inventory_return_requests"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."inventory_return_requests"."online_inventory_before" IS 'model field: onlineInventoryBefore';
COMMENT ON COLUMN "public"."inventory_return_requests"."offline_available_before" IS 'model field: offlineAvailableBefore';
COMMENT ON COLUMN "public"."inventory_return_requests"."online_inventory_after" IS 'model field: onlineInventoryAfter';
COMMENT ON COLUMN "public"."inventory_return_requests"."offline_available_after" IS 'model field: offlineAvailableAfter';
COMMENT ON COLUMN "public"."inventory_return_requests"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."inventory_return_requests"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."inventory_return_requests"."version" IS 'model field: __v';
ALTER TABLE "public"."inventory_return_requests" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "inventory_return_requests_extra_8d6f0125" ON "public"."inventory_return_requests" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "inventory_return_requests_uq_43515549" ON "public"."inventory_return_requests" USING btree ("reference") NULLS NOT DISTINCT;
CREATE INDEX "inventory_return_requests_ix_20b3ed65" ON "public"."inventory_return_requests" USING btree ("status");
CREATE INDEX "inventory_return_requests_ix_b58203d9" ON "public"."inventory_return_requests" USING btree ("ashram_id", "status", "created_at" DESC NULLS LAST);
CREATE INDEX "inventory_return_requests_ix_91173cb8" ON "public"."inventory_return_requests" USING btree ("offline_room_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."inventory_return_requests" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."inventory_return_requests" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."localserviceitems" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "address" text COLLATE "C",
  "badge" text COLLATE "C",
  "category" text COLLATE "C",
  "city" text COLLATE "C",
  "closing_hours" text COLLATE "C",
  "description" text COLLATE "C",
  "discount" double precision,
  "email" text COLLATE "C",
  "gallery" text[] COLLATE "C",
  "gst" double precision,
  "image" text COLLATE "C",
  "is_featured" boolean,
  "is_verified" boolean,
  "latitude" double precision,
  "location" text COLLATE "C",
  "longitude" double precision,
  "meta_description" text COLLATE "C",
  "meta_title" text COLLATE "C",
  "opening_hours" text COLLATE "C",
  "phone" text COLLATE "C",
  "price" text COLLATE "C",
  "rating" double precision,
  "reviews_count" double precision,
  "slug" text COLLATE "C",
  "status" text COLLATE "C",
  "title" text COLLATE "C",
  "website" text COLLATE "C",
  "weekly_off" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."localserviceitems" IS 'Tirvona model collection localserviceitems. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."localserviceitems"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."localserviceitems"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."localserviceitems"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."localserviceitems"."closing_hours" IS 'model field: closingHours';
COMMENT ON COLUMN "public"."localserviceitems"."is_featured" IS 'model field: isFeatured';
COMMENT ON COLUMN "public"."localserviceitems"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."localserviceitems"."meta_description" IS 'model field: metaDescription';
COMMENT ON COLUMN "public"."localserviceitems"."meta_title" IS 'model field: metaTitle';
COMMENT ON COLUMN "public"."localserviceitems"."opening_hours" IS 'model field: openingHours';
COMMENT ON COLUMN "public"."localserviceitems"."reviews_count" IS 'model field: reviewsCount';
COMMENT ON COLUMN "public"."localserviceitems"."weekly_off" IS 'model field: weeklyOff';
ALTER TABLE "public"."localserviceitems" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "localserviceitems_extra_f756f192" ON "public"."localserviceitems" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "localserviceitems_ix_148ad5bd" ON "public"."localserviceitems" USING btree ("status", "city", "category");
CREATE INDEX "localserviceitems_ix_d3e04b28" ON "public"."localserviceitems" USING btree ("status", "category", "rating" DESC NULLS LAST);

REVOKE ALL ON "public"."localserviceitems" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."localserviceitems" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_addresses" (
  "id" text COLLATE "C" PRIMARY KEY,
  "customer_id" text COLLATE "C",
  "label" text COLLATE "C",
  "full_name" text COLLATE "C",
  "phone" text COLLATE "C",
  "line1" text COLLATE "C",
  "line2" text COLLATE "C",
  "landmark" text COLLATE "C",
  "city" text COLLATE "C",
  "state" text COLLATE "C",
  "pincode" text COLLATE "C",
  "country" text COLLATE "C",
  "is_default" boolean,
  "is_deleted" boolean,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_addresses" IS 'Tirvona model collection marketplace_addresses. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_addresses"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."marketplace_addresses"."full_name" IS 'model field: fullName';
COMMENT ON COLUMN "public"."marketplace_addresses"."is_default" IS 'model field: isDefault';
COMMENT ON COLUMN "public"."marketplace_addresses"."is_deleted" IS 'model field: isDeleted';
COMMENT ON COLUMN "public"."marketplace_addresses"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_addresses"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."marketplace_addresses"."version" IS 'model field: __v';
ALTER TABLE "public"."marketplace_addresses" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_addresses_extra_c54e836b" ON "public"."marketplace_addresses" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "marketplace_addresses_ix_54066c43" ON "public"."marketplace_addresses" USING btree ("is_deleted");
CREATE INDEX "marketplace_addresses_ix_7979f6ab" ON "public"."marketplace_addresses" USING btree ("customer_id", "is_deleted", "is_default" DESC NULLS LAST);

REVOKE ALL ON "public"."marketplace_addresses" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_addresses" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_categories" (
  "id" text COLLATE "C" PRIMARY KEY,
  "version" double precision,
  "banner_image" text COLLATE "C",
  "cover_image" text COLLATE "C",
  "created_at" timestamptz,
  "delivery_days" double precision,
  "description" text COLLATE "C",
  "devotee_usage" text COLLATE "C",
  "display_order" double precision,
  "featured" boolean,
  "festival_info" text COLLATE "C",
  "gallery" jsonb,
  "history" text COLLATE "C",
  "icon" text COLLATE "C",
  "importance" text COLLATE "C",
  "item_count" double precision,
  "name" text COLLATE "C",
  "origin_city" text COLLATE "C",
  "origin_state" text COLLATE "C",
  "rating" double precision,
  "seller_count" double precision,
  "seo_description" text COLLATE "C",
  "seo_title" text COLLATE "C",
  "slug" text COLLATE "C",
  "status" text COLLATE "C",
  "temple_name" text COLLATE "C",
  "thumbnail" text COLLATE "C",
  "total_orders" double precision,
  "trending_badge" text COLLATE "C",
  "updated_at" timestamptz,
  "why_famous" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_categories" IS 'Tirvona model collection marketplace_categories. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_categories"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."marketplace_categories"."banner_image" IS 'model field: bannerImage';
COMMENT ON COLUMN "public"."marketplace_categories"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."marketplace_categories"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_categories"."delivery_days" IS 'model field: deliveryDays';
COMMENT ON COLUMN "public"."marketplace_categories"."devotee_usage" IS 'model field: devoteeUsage';
COMMENT ON COLUMN "public"."marketplace_categories"."display_order" IS 'model field: displayOrder';
COMMENT ON COLUMN "public"."marketplace_categories"."festival_info" IS 'model field: festivalInfo';
COMMENT ON COLUMN "public"."marketplace_categories"."item_count" IS 'model field: itemCount';
COMMENT ON COLUMN "public"."marketplace_categories"."origin_city" IS 'model field: originCity';
COMMENT ON COLUMN "public"."marketplace_categories"."origin_state" IS 'model field: originState';
COMMENT ON COLUMN "public"."marketplace_categories"."seller_count" IS 'model field: sellerCount';
COMMENT ON COLUMN "public"."marketplace_categories"."seo_description" IS 'model field: seoDescription';
COMMENT ON COLUMN "public"."marketplace_categories"."seo_title" IS 'model field: seoTitle';
COMMENT ON COLUMN "public"."marketplace_categories"."temple_name" IS 'model field: templeName';
COMMENT ON COLUMN "public"."marketplace_categories"."total_orders" IS 'model field: totalOrders';
COMMENT ON COLUMN "public"."marketplace_categories"."trending_badge" IS 'model field: trendingBadge';
COMMENT ON COLUMN "public"."marketplace_categories"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."marketplace_categories"."why_famous" IS 'model field: whyFamous';
ALTER TABLE "public"."marketplace_categories" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_categories_extra_60ce8b3d" ON "public"."marketplace_categories" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "marketplace_categories_uq_e1689ce2" ON "public"."marketplace_categories" USING btree ("name") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "marketplace_categories_uq_7a0923dd" ON "public"."marketplace_categories" USING btree ("slug") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."marketplace_categories" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_categories" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_ledger_entries" (
  "id" text COLLATE "C" PRIMARY KEY,
  "vendor_id" text COLLATE "C",
  "type" text COLLATE "C",
  "amount" double precision,
  "available_at" timestamptz,
  "vendor_order_id" text COLLATE "C",
  "master_order_id" text COLLATE "C",
  "payout_id" text COLLATE "C",
  "idempotency_key" text COLLATE "C",
  "description" text COLLATE "C",
  "actor_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_ledger_entries" IS 'Tirvona model collection marketplace_ledger_entries. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_ledger_entries"."vendor_id" IS 'model field: vendorId';
COMMENT ON COLUMN "public"."marketplace_ledger_entries"."available_at" IS 'model field: availableAt';
COMMENT ON COLUMN "public"."marketplace_ledger_entries"."vendor_order_id" IS 'model field: vendorOrderId';
COMMENT ON COLUMN "public"."marketplace_ledger_entries"."master_order_id" IS 'model field: masterOrderId';
COMMENT ON COLUMN "public"."marketplace_ledger_entries"."payout_id" IS 'model field: payoutId';
COMMENT ON COLUMN "public"."marketplace_ledger_entries"."idempotency_key" IS 'model field: idempotencyKey';
COMMENT ON COLUMN "public"."marketplace_ledger_entries"."actor_id" IS 'model field: actorId';
COMMENT ON COLUMN "public"."marketplace_ledger_entries"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_ledger_entries"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."marketplace_ledger_entries" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_ledger_entries_extra_e240b2c7" ON "public"."marketplace_ledger_entries" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "marketplace_ledger_entries_ix_4e4c1dd7" ON "public"."marketplace_ledger_entries" USING btree ("vendor_id");
CREATE UNIQUE INDEX "marketplace_ledger_entries_uq_543acea5" ON "public"."marketplace_ledger_entries" USING btree ("idempotency_key") NULLS NOT DISTINCT;
CREATE INDEX "marketplace_ledger_entries_ix_331052d1" ON "public"."marketplace_ledger_entries" USING btree ("vendor_id", "created_at" DESC NULLS LAST);
CREATE INDEX "marketplace_ledger_entries_ix_19156ff1" ON "public"."marketplace_ledger_entries" USING btree ("vendor_order_id");

REVOKE ALL ON "public"."marketplace_ledger_entries" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_ledger_entries" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_master_orders" (
  "id" text COLLATE "C" PRIMARY KEY,
  "order_number" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "vendor_order_ids" jsonb,
  "shipping_address" jsonb,
  "pricing" jsonb,
  "status" text COLLATE "C",
  "payment_status" text COLLATE "C",
  "gateway" jsonb,
  "reservation_expires_at" timestamptz,
  "idempotency_key" text COLLATE "C",
  "notes" text COLLATE "C",
  "cancelled_at" timestamptz,
  "cancel_reason" text COLLATE "C",
  "reconciliation_note" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_master_orders" IS 'Tirvona model collection marketplace_master_orders. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_master_orders"."order_number" IS 'model field: orderNumber';
COMMENT ON COLUMN "public"."marketplace_master_orders"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."marketplace_master_orders"."vendor_order_ids" IS 'model field: vendorOrderIds';
COMMENT ON COLUMN "public"."marketplace_master_orders"."shipping_address" IS 'model field: shippingAddress';
COMMENT ON COLUMN "public"."marketplace_master_orders"."payment_status" IS 'model field: paymentStatus';
COMMENT ON COLUMN "public"."marketplace_master_orders"."reservation_expires_at" IS 'model field: reservationExpiresAt';
COMMENT ON COLUMN "public"."marketplace_master_orders"."idempotency_key" IS 'model field: idempotencyKey';
COMMENT ON COLUMN "public"."marketplace_master_orders"."cancelled_at" IS 'model field: cancelledAt';
COMMENT ON COLUMN "public"."marketplace_master_orders"."cancel_reason" IS 'model field: cancelReason';
COMMENT ON COLUMN "public"."marketplace_master_orders"."reconciliation_note" IS 'model field: reconciliationNote';
COMMENT ON COLUMN "public"."marketplace_master_orders"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_master_orders"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."marketplace_master_orders" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_master_orders_extra_56112c07" ON "public"."marketplace_master_orders" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "marketplace_master_orders_uq_8e019a1e" ON "public"."marketplace_master_orders" USING btree ("order_number") NULLS NOT DISTINCT;
CREATE INDEX "marketplace_master_orders_ix_435dc7a5" ON "public"."marketplace_master_orders" USING btree ("customer_id");
CREATE INDEX "marketplace_master_orders_ix_20b3ed65" ON "public"."marketplace_master_orders" USING btree ("status");
CREATE INDEX "marketplace_master_orders_ix_f9bfa183" ON "public"."marketplace_master_orders" USING btree ("payment_status");
CREATE INDEX "marketplace_master_orders_ix_b79f1c74" ON "public"."marketplace_master_orders" USING btree (("gateway" #> '{orderId}'));
CREATE UNIQUE INDEX "marketplace_master_orders_uq_02f3261f" ON "public"."marketplace_master_orders" USING btree ("customer_id", "idempotency_key") NULLS NOT DISTINCT WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX "marketplace_master_orders_ix_e553f74d" ON "public"."marketplace_master_orders" USING btree ("status", "reservation_expires_at");

REVOKE ALL ON "public"."marketplace_master_orders" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_master_orders" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_orders" (
  "id" text COLLATE "C" PRIMARY KEY,
  "order_number" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "items" jsonb,
  "shipping_address" jsonb,
  "address_id" text COLLATE "C",
  "pricing" jsonb,
  "order_status" text COLLATE "C",
  "payment_status" text COLLATE "C",
  "payment_mode" text COLLATE "C",
  "gateway" jsonb,
  "notes" text COLLATE "C",
  "cancelled_at" timestamptz,
  "cancel_reason" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_orders" IS 'Tirvona model collection marketplace_orders. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_orders"."order_number" IS 'model field: orderNumber';
COMMENT ON COLUMN "public"."marketplace_orders"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."marketplace_orders"."shipping_address" IS 'model field: shippingAddress';
COMMENT ON COLUMN "public"."marketplace_orders"."address_id" IS 'model field: addressId';
COMMENT ON COLUMN "public"."marketplace_orders"."order_status" IS 'model field: orderStatus';
COMMENT ON COLUMN "public"."marketplace_orders"."payment_status" IS 'model field: paymentStatus';
COMMENT ON COLUMN "public"."marketplace_orders"."payment_mode" IS 'model field: paymentMode';
COMMENT ON COLUMN "public"."marketplace_orders"."cancelled_at" IS 'model field: cancelledAt';
COMMENT ON COLUMN "public"."marketplace_orders"."cancel_reason" IS 'model field: cancelReason';
COMMENT ON COLUMN "public"."marketplace_orders"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_orders"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."marketplace_orders"."version" IS 'model field: __v';
ALTER TABLE "public"."marketplace_orders" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_orders_extra_a7ef538e" ON "public"."marketplace_orders" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "marketplace_orders_uq_8e019a1e" ON "public"."marketplace_orders" USING btree ("order_number") NULLS NOT DISTINCT;
CREATE INDEX "marketplace_orders_ix_5a78f135" ON "public"."marketplace_orders" USING btree ("order_status");
CREATE INDEX "marketplace_orders_ix_f9bfa183" ON "public"."marketplace_orders" USING btree ("payment_status");
CREATE INDEX "marketplace_orders_ix_bcfdf29f" ON "public"."marketplace_orders" USING btree (("gateway" #> '{orderId}')) WHERE ("gateway" #> '{orderId}') IS NOT NULL;
CREATE INDEX "marketplace_orders_ix_e55dc705" ON "public"."marketplace_orders" USING btree ("customer_id", "created_at" DESC NULLS LAST);
CREATE INDEX "marketplace_orders_ix_105b673a" ON "public"."marketplace_orders" USING btree ("order_status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."marketplace_orders" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_orders" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_payments" (
  "id" text COLLATE "C" PRIMARY KEY,
  "order_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "event_id" text COLLATE "C",
  "provider" text COLLATE "C",
  "gateway_order_id" text COLLATE "C",
  "gateway_payment_id" text COLLATE "C",
  "amount" double precision,
  "currency" text COLLATE "C",
  "status" text COLLATE "C",
  "raw_status" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_payments" IS 'Tirvona model collection marketplace_payments. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_payments"."order_id" IS 'model field: orderId';
COMMENT ON COLUMN "public"."marketplace_payments"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."marketplace_payments"."event_id" IS 'model field: eventId';
COMMENT ON COLUMN "public"."marketplace_payments"."gateway_order_id" IS 'model field: gatewayOrderId';
COMMENT ON COLUMN "public"."marketplace_payments"."gateway_payment_id" IS 'model field: gatewayPaymentId';
COMMENT ON COLUMN "public"."marketplace_payments"."raw_status" IS 'model field: rawStatus';
COMMENT ON COLUMN "public"."marketplace_payments"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_payments"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."marketplace_payments"."version" IS 'model field: __v';
ALTER TABLE "public"."marketplace_payments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_payments_extra_526e1c27" ON "public"."marketplace_payments" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "marketplace_payments_uq_2f02e708" ON "public"."marketplace_payments" USING btree ("event_id") NULLS NOT DISTINCT;
CREATE INDEX "marketplace_payments_ix_20b3ed65" ON "public"."marketplace_payments" USING btree ("status");
CREATE INDEX "marketplace_payments_ix_2a65d957" ON "public"."marketplace_payments" USING btree ("order_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."marketplace_payments" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_payments" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_payouts" (
  "id" text COLLATE "C" PRIMARY KEY,
  "vendor_id" text COLLATE "C",
  "payout_number" text COLLATE "C",
  "amount" double precision,
  "status" text COLLATE "C",
  "bank_account_id" text COLLATE "C",
  "bank_snapshot" jsonb,
  "mode" text COLLATE "C",
  "provider" text COLLATE "C",
  "provider_payout_id" text COLLATE "C",
  "utr" text COLLATE "C",
  "failure_reason" text COLLATE "C",
  "reviewed_by" text COLLATE "C",
  "reviewed_at" timestamptz,
  "paid_at" timestamptz,
  "status_history" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_payouts" IS 'Tirvona model collection marketplace_payouts. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_payouts"."vendor_id" IS 'model field: vendorId';
COMMENT ON COLUMN "public"."marketplace_payouts"."payout_number" IS 'model field: payoutNumber';
COMMENT ON COLUMN "public"."marketplace_payouts"."bank_account_id" IS 'model field: bankAccountId';
COMMENT ON COLUMN "public"."marketplace_payouts"."bank_snapshot" IS 'model field: bankSnapshot';
COMMENT ON COLUMN "public"."marketplace_payouts"."provider_payout_id" IS 'model field: providerPayoutId';
COMMENT ON COLUMN "public"."marketplace_payouts"."failure_reason" IS 'model field: failureReason';
COMMENT ON COLUMN "public"."marketplace_payouts"."reviewed_by" IS 'model field: reviewedBy';
COMMENT ON COLUMN "public"."marketplace_payouts"."reviewed_at" IS 'model field: reviewedAt';
COMMENT ON COLUMN "public"."marketplace_payouts"."paid_at" IS 'model field: paidAt';
COMMENT ON COLUMN "public"."marketplace_payouts"."status_history" IS 'model field: statusHistory';
COMMENT ON COLUMN "public"."marketplace_payouts"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_payouts"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."marketplace_payouts" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_payouts_extra_2317c56b" ON "public"."marketplace_payouts" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "marketplace_payouts_ix_4e4c1dd7" ON "public"."marketplace_payouts" USING btree ("vendor_id");
CREATE UNIQUE INDEX "marketplace_payouts_uq_79748f70" ON "public"."marketplace_payouts" USING btree ("payout_number") NULLS NOT DISTINCT;
CREATE INDEX "marketplace_payouts_ix_20b3ed65" ON "public"."marketplace_payouts" USING btree ("status");

REVOKE ALL ON "public"."marketplace_payouts" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_payouts" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_products" (
  "id" text COLLATE "C" PRIMARY KEY,
  "version" double precision,
  "category_id" text COLLATE "C",
  "created_at" timestamptz,
  "delivery_days" double precision,
  "description" text COLLATE "C",
  "discount_price" double precision,
  "featured" boolean,
  "festival_special" boolean,
  "images" text[] COLLATE "C",
  "organic" boolean,
  "price" double precision,
  "product_name" text COLLATE "C",
  "rating" double precision,
  "reviews_count" double precision,
  "slug" text COLLATE "C",
  "status" text COLLATE "C",
  "stock" double precision,
  "store_name" text COLLATE "C",
  "temple_name" text COLLATE "C",
  "updated_at" timestamptz,
  "vegetarian" boolean,
  "weight" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_products" IS 'Tirvona model collection marketplace_products. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_products"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."marketplace_products"."category_id" IS 'model field: categoryId';
COMMENT ON COLUMN "public"."marketplace_products"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_products"."delivery_days" IS 'model field: deliveryDays';
COMMENT ON COLUMN "public"."marketplace_products"."discount_price" IS 'model field: discountPrice';
COMMENT ON COLUMN "public"."marketplace_products"."festival_special" IS 'model field: festivalSpecial';
COMMENT ON COLUMN "public"."marketplace_products"."product_name" IS 'model field: productName';
COMMENT ON COLUMN "public"."marketplace_products"."reviews_count" IS 'model field: reviewsCount';
COMMENT ON COLUMN "public"."marketplace_products"."store_name" IS 'model field: storeName';
COMMENT ON COLUMN "public"."marketplace_products"."temple_name" IS 'model field: templeName';
COMMENT ON COLUMN "public"."marketplace_products"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."marketplace_products" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_products_extra_0aca9f1c" ON "public"."marketplace_products" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "marketplace_products_uq_7a0923dd" ON "public"."marketplace_products" USING btree ("slug") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."marketplace_products" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_products" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_reviews" (
  "id" text COLLATE "C" PRIMARY KEY,
  "product_id" text COLLATE "C",
  "vendor_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "vendor_order_id" text COLLATE "C",
  "rating" double precision,
  "title" text COLLATE "C",
  "comment" text COLLATE "C",
  "is_verified_purchase" boolean,
  "status" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_reviews" IS 'Tirvona model collection marketplace_reviews. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_reviews"."product_id" IS 'model field: productId';
COMMENT ON COLUMN "public"."marketplace_reviews"."vendor_id" IS 'model field: vendorId';
COMMENT ON COLUMN "public"."marketplace_reviews"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."marketplace_reviews"."vendor_order_id" IS 'model field: vendorOrderId';
COMMENT ON COLUMN "public"."marketplace_reviews"."is_verified_purchase" IS 'model field: isVerifiedPurchase';
COMMENT ON COLUMN "public"."marketplace_reviews"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_reviews"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."marketplace_reviews" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_reviews_extra_ccf9de7e" ON "public"."marketplace_reviews" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "marketplace_reviews_ix_e92eefce" ON "public"."marketplace_reviews" USING btree ("product_id");
CREATE INDEX "marketplace_reviews_ix_4e4c1dd7" ON "public"."marketplace_reviews" USING btree ("vendor_id");
CREATE INDEX "marketplace_reviews_ix_20b3ed65" ON "public"."marketplace_reviews" USING btree ("status");
CREATE UNIQUE INDEX "marketplace_reviews_uq_ce607d75" ON "public"."marketplace_reviews" USING btree ("customer_id", "product_id", "vendor_order_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."marketplace_reviews" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_reviews" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_settings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "key" text COLLATE "C",
  "default_commission_percent" double precision,
  "settlement_hold_days" double precision,
  "return_window_days" double precision,
  "default_gst_percent" double precision,
  "shipping_fee" double precision,
  "free_shipping_above" double precision,
  "reservation_minutes" double precision,
  "minimum_payout_amount" double precision,
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_settings" IS 'Tirvona model collection marketplace_settings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_settings"."default_commission_percent" IS 'model field: defaultCommissionPercent';
COMMENT ON COLUMN "public"."marketplace_settings"."settlement_hold_days" IS 'model field: settlementHoldDays';
COMMENT ON COLUMN "public"."marketplace_settings"."return_window_days" IS 'model field: returnWindowDays';
COMMENT ON COLUMN "public"."marketplace_settings"."default_gst_percent" IS 'model field: defaultGstPercent';
COMMENT ON COLUMN "public"."marketplace_settings"."shipping_fee" IS 'model field: shippingFee';
COMMENT ON COLUMN "public"."marketplace_settings"."free_shipping_above" IS 'model field: freeShippingAbove';
COMMENT ON COLUMN "public"."marketplace_settings"."reservation_minutes" IS 'model field: reservationMinutes';
COMMENT ON COLUMN "public"."marketplace_settings"."minimum_payout_amount" IS 'model field: minimumPayoutAmount';
COMMENT ON COLUMN "public"."marketplace_settings"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."marketplace_settings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_settings"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."marketplace_settings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_settings_extra_86b9618e" ON "public"."marketplace_settings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "marketplace_settings_uq_d562d510" ON "public"."marketplace_settings" USING btree ("key") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."marketplace_settings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_settings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_vendor_bank_accounts" (
  "id" text COLLATE "C" PRIMARY KEY,
  "vendor_id" text COLLATE "C",
  "account_holder_name" text COLLATE "C",
  "bank_name" text COLLATE "C",
  "ifsc" text COLLATE "C",
  "account_number_encrypted" jsonb,
  "account_number_last4" text COLLATE "C",
  "fingerprint" text COLLATE "C",
  "verification_status" text COLLATE "C",
  "is_default" boolean,
  "provider_contact_id" text COLLATE "C",
  "provider_fund_account_id" text COLLATE "C",
  "deleted_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_vendor_bank_accounts" IS 'Tirvona model collection marketplace_vendor_bank_accounts. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."vendor_id" IS 'model field: vendorId';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."account_holder_name" IS 'model field: accountHolderName';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."bank_name" IS 'model field: bankName';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."account_number_encrypted" IS 'model field: accountNumberEncrypted';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."account_number_last4" IS 'model field: accountNumberLast4';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."verification_status" IS 'model field: verificationStatus';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."is_default" IS 'model field: isDefault';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."provider_contact_id" IS 'model field: providerContactId';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."provider_fund_account_id" IS 'model field: providerFundAccountId';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_vendor_bank_accounts"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."marketplace_vendor_bank_accounts" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_vendor_bank_accounts_extra_b01942ca" ON "public"."marketplace_vendor_bank_accounts" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "marketplace_vendor_bank_accounts_ix_4e4c1dd7" ON "public"."marketplace_vendor_bank_accounts" USING btree ("vendor_id");
CREATE UNIQUE INDEX "marketplace_vendor_bank_accounts_uq_707db0fd" ON "public"."marketplace_vendor_bank_accounts" USING btree ("vendor_id", "fingerprint") NULLS NOT DISTINCT WHERE "deleted_at" IS NULL;

REVOKE ALL ON "public"."marketplace_vendor_bank_accounts" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_vendor_bank_accounts" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_vendor_documents" (
  "id" text COLLATE "C" PRIMARY KEY,
  "vendor_id" text COLLATE "C",
  "type" text COLLATE "C",
  "file_url" text COLLATE "C",
  "file_name" text COLLATE "C",
  "document_number_masked" text COLLATE "C",
  "status" text COLLATE "C",
  "review_note" text COLLATE "C",
  "reviewed_by" text COLLATE "C",
  "reviewed_at" timestamptz,
  "deleted_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_vendor_documents" IS 'Tirvona model collection marketplace_vendor_documents. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."vendor_id" IS 'model field: vendorId';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."file_url" IS 'model field: fileUrl';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."file_name" IS 'model field: fileName';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."document_number_masked" IS 'model field: documentNumberMasked';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."review_note" IS 'model field: reviewNote';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."reviewed_by" IS 'model field: reviewedBy';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."reviewed_at" IS 'model field: reviewedAt';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."marketplace_vendor_documents"."version" IS 'model field: __v';
ALTER TABLE "public"."marketplace_vendor_documents" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_vendor_documents_extra_98349a8d" ON "public"."marketplace_vendor_documents" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "marketplace_vendor_documents_ix_4e4c1dd7" ON "public"."marketplace_vendor_documents" USING btree ("vendor_id");
CREATE INDEX "marketplace_vendor_documents_ix_20b3ed65" ON "public"."marketplace_vendor_documents" USING btree ("status");

REVOKE ALL ON "public"."marketplace_vendor_documents" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_vendor_documents" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_vendor_orders" (
  "id" text COLLATE "C" PRIMARY KEY,
  "master_order_id" text COLLATE "C",
  "vendor_order_number" text COLLATE "C",
  "vendor_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "vendor_snapshot" jsonb,
  "items" jsonb,
  "subtotal" double precision,
  "gst_amount" double precision,
  "shipping_fee" double precision,
  "total" double precision,
  "commission_amount" double precision,
  "vendor_earning" double precision,
  "fulfillment_status" text COLLATE "C",
  "settlement_status" text COLLATE "C",
  "tracking" jsonb,
  "status_history" jsonb,
  "confirmed_at" timestamptz,
  "shipped_at" timestamptz,
  "delivered_at" timestamptz,
  "settlement_eligible_at" timestamptz,
  "cancelled_at" timestamptz,
  "cancel_reason" text COLLATE "C",
  "return_reason" text COLLATE "C",
  "refund_amount" double precision,
  "refund_id" text COLLATE "C",
  "refund_error" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_vendor_orders" IS 'Tirvona model collection marketplace_vendor_orders. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."master_order_id" IS 'model field: masterOrderId';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."vendor_order_number" IS 'model field: vendorOrderNumber';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."vendor_id" IS 'model field: vendorId';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."vendor_snapshot" IS 'model field: vendorSnapshot';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."gst_amount" IS 'model field: gstAmount';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."shipping_fee" IS 'model field: shippingFee';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."commission_amount" IS 'model field: commissionAmount';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."vendor_earning" IS 'model field: vendorEarning';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."fulfillment_status" IS 'model field: fulfillmentStatus';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."settlement_status" IS 'model field: settlementStatus';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."status_history" IS 'model field: statusHistory';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."confirmed_at" IS 'model field: confirmedAt';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."shipped_at" IS 'model field: shippedAt';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."delivered_at" IS 'model field: deliveredAt';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."settlement_eligible_at" IS 'model field: settlementEligibleAt';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."cancelled_at" IS 'model field: cancelledAt';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."cancel_reason" IS 'model field: cancelReason';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."return_reason" IS 'model field: returnReason';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."refund_amount" IS 'model field: refundAmount';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."refund_id" IS 'model field: refundId';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."refund_error" IS 'model field: refundError';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_vendor_orders"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."marketplace_vendor_orders" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_vendor_orders_extra_bcffe199" ON "public"."marketplace_vendor_orders" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "marketplace_vendor_orders_ix_3bc5f1c1" ON "public"."marketplace_vendor_orders" USING btree ("master_order_id");
CREATE UNIQUE INDEX "marketplace_vendor_orders_uq_3cf505c0" ON "public"."marketplace_vendor_orders" USING btree ("vendor_order_number") NULLS NOT DISTINCT;
CREATE INDEX "marketplace_vendor_orders_ix_4e4c1dd7" ON "public"."marketplace_vendor_orders" USING btree ("vendor_id");
CREATE INDEX "marketplace_vendor_orders_ix_626c8717" ON "public"."marketplace_vendor_orders" USING btree ("fulfillment_status");
CREATE INDEX "marketplace_vendor_orders_ix_c8ba7e6a" ON "public"."marketplace_vendor_orders" USING btree ("settlement_status");
CREATE INDEX "marketplace_vendor_orders_ix_b4830cec" ON "public"."marketplace_vendor_orders" USING btree ("vendor_id", "fulfillment_status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."marketplace_vendor_orders" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_vendor_orders" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplace_vendors" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "store_name" text COLLATE "C",
  "slug" text COLLATE "C",
  "legal_business_name" text COLLATE "C",
  "business_type" text COLLATE "C",
  "description" text COLLATE "C",
  "contact_email" text COLLATE "C",
  "contact_phone" text COLLATE "C",
  "address" jsonb,
  "logo_url" text COLLATE "C",
  "gstin" text COLLATE "C",
  "status" text COLLATE "C",
  "verification_status" text COLLATE "C",
  "submitted_at" timestamptz,
  "rejection_reason" text COLLATE "C",
  "approved_at" timestamptz,
  "approved_by" text COLLATE "C",
  "suspended_at" timestamptz,
  "suspended_by" text COLLATE "C",
  "suspension_reason" text COLLATE "C",
  "deactivated_at" timestamptz,
  "commission_percent" double precision,
  "is_platform_vendor" boolean,
  "payout_lock_token" text COLLATE "C",
  "payout_lock_expires_at" timestamptz,
  "deleted_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplace_vendors" IS 'Tirvona model collection marketplace_vendors. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplace_vendors"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."marketplace_vendors"."store_name" IS 'model field: storeName';
COMMENT ON COLUMN "public"."marketplace_vendors"."legal_business_name" IS 'model field: legalBusinessName';
COMMENT ON COLUMN "public"."marketplace_vendors"."business_type" IS 'model field: businessType';
COMMENT ON COLUMN "public"."marketplace_vendors"."contact_email" IS 'model field: contactEmail';
COMMENT ON COLUMN "public"."marketplace_vendors"."contact_phone" IS 'model field: contactPhone';
COMMENT ON COLUMN "public"."marketplace_vendors"."logo_url" IS 'model field: logoUrl';
COMMENT ON COLUMN "public"."marketplace_vendors"."verification_status" IS 'model field: verificationStatus';
COMMENT ON COLUMN "public"."marketplace_vendors"."submitted_at" IS 'model field: submittedAt';
COMMENT ON COLUMN "public"."marketplace_vendors"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."marketplace_vendors"."approved_at" IS 'model field: approvedAt';
COMMENT ON COLUMN "public"."marketplace_vendors"."approved_by" IS 'model field: approvedBy';
COMMENT ON COLUMN "public"."marketplace_vendors"."suspended_at" IS 'model field: suspendedAt';
COMMENT ON COLUMN "public"."marketplace_vendors"."suspended_by" IS 'model field: suspendedBy';
COMMENT ON COLUMN "public"."marketplace_vendors"."suspension_reason" IS 'model field: suspensionReason';
COMMENT ON COLUMN "public"."marketplace_vendors"."deactivated_at" IS 'model field: deactivatedAt';
COMMENT ON COLUMN "public"."marketplace_vendors"."commission_percent" IS 'model field: commissionPercent';
COMMENT ON COLUMN "public"."marketplace_vendors"."is_platform_vendor" IS 'model field: isPlatformVendor';
COMMENT ON COLUMN "public"."marketplace_vendors"."payout_lock_token" IS 'model field: payoutLockToken';
COMMENT ON COLUMN "public"."marketplace_vendors"."payout_lock_expires_at" IS 'model field: payoutLockExpiresAt';
COMMENT ON COLUMN "public"."marketplace_vendors"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."marketplace_vendors"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplace_vendors"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."marketplace_vendors"."version" IS 'model field: __v';
ALTER TABLE "public"."marketplace_vendors" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplace_vendors_extra_3c760bcd" ON "public"."marketplace_vendors" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "marketplace_vendors_uq_164fe85a" ON "public"."marketplace_vendors" USING btree ("user_id") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "marketplace_vendors_uq_7a0923dd" ON "public"."marketplace_vendors" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "marketplace_vendors_ix_20b3ed65" ON "public"."marketplace_vendors" USING btree ("status");
CREATE INDEX "marketplace_vendors_ix_82abfc2f" ON "public"."marketplace_vendors" USING btree ("status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."marketplace_vendors" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplace_vendors" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplacecategories" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "name" text COLLATE "C",
  "slug" text COLLATE "C",
  "description" text COLLATE "C",
  "parent_id" text COLLATE "C",
  "image" text COLLATE "C",
  "status" text COLLATE "C",
  "sort_order" double precision,
  "display_order" double precision,
  "commission_percent" double precision,
  "scope" text COLLATE "C",
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplacecategories" IS 'Tirvona model collection marketplacecategories. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplacecategories"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplacecategories"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."marketplacecategories"."parent_id" IS 'model field: parentId';
COMMENT ON COLUMN "public"."marketplacecategories"."sort_order" IS 'model field: sortOrder';
COMMENT ON COLUMN "public"."marketplacecategories"."display_order" IS 'model field: displayOrder';
COMMENT ON COLUMN "public"."marketplacecategories"."commission_percent" IS 'model field: commissionPercent';
COMMENT ON COLUMN "public"."marketplacecategories"."version" IS 'model field: __v';
ALTER TABLE "public"."marketplacecategories" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplacecategories_extra_ec56779b" ON "public"."marketplacecategories" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "marketplacecategories_ix_18429c97" ON "public"."marketplacecategories" USING btree ("parent_id");
CREATE INDEX "marketplacecategories_ix_20b3ed65" ON "public"."marketplacecategories" USING btree ("status");
CREATE INDEX "marketplacecategories_ix_5cee787c" ON "public"."marketplacecategories" USING btree ("scope");

REVOKE ALL ON "public"."marketplacecategories" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplacecategories" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplaceorders" (
  "id" text COLLATE "C" PRIMARY KEY,
  "customer_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "customer_name" text COLLATE "C",
  "customer_phone" text COLLATE "C",
  "items" jsonb,
  "order_number" text COLLATE "C",
  "order_status" text COLLATE "C",
  "payment_method" text COLLATE "C",
  "payment_status" text COLLATE "C",
  "shipping_address" jsonb,
  "total_amount" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplaceorders" IS 'Tirvona model collection marketplaceorders. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplaceorders"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."marketplaceorders"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplaceorders"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."marketplaceorders"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."marketplaceorders"."customer_name" IS 'model field: customerName';
COMMENT ON COLUMN "public"."marketplaceorders"."customer_phone" IS 'model field: customerPhone';
COMMENT ON COLUMN "public"."marketplaceorders"."order_number" IS 'model field: orderNumber';
COMMENT ON COLUMN "public"."marketplaceorders"."order_status" IS 'model field: orderStatus';
COMMENT ON COLUMN "public"."marketplaceorders"."payment_method" IS 'model field: paymentMethod';
COMMENT ON COLUMN "public"."marketplaceorders"."payment_status" IS 'model field: paymentStatus';
COMMENT ON COLUMN "public"."marketplaceorders"."shipping_address" IS 'model field: shippingAddress';
COMMENT ON COLUMN "public"."marketplaceorders"."total_amount" IS 'model field: totalAmount';
ALTER TABLE "public"."marketplaceorders" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplaceorders_extra_542128c9" ON "public"."marketplaceorders" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "marketplaceorders_ix_435dc7a5" ON "public"."marketplaceorders" USING btree ("customer_id");
CREATE UNIQUE INDEX "marketplaceorders_uq_8e019a1e" ON "public"."marketplaceorders" USING btree ("order_number") NULLS NOT DISTINCT;
CREATE INDEX "marketplaceorders_ix_e55dc705" ON "public"."marketplaceorders" USING btree ("customer_id", "created_at" DESC NULLS LAST);
CREATE INDEX "marketplaceorders_ix_105b673a" ON "public"."marketplaceorders" USING btree ("order_status", "created_at" DESC NULLS LAST);
CREATE INDEX "marketplaceorders_ix_99eb2c14" ON "public"."marketplaceorders" USING btree ("payment_status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."marketplaceorders" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplaceorders" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplaceproducts" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "vendor_id" text COLLATE "C",
  "category_id" text COLLATE "C",
  "category" text COLLATE "C",
  "name" text COLLATE "C",
  "slug" text COLLATE "C",
  "description" text COLLATE "C",
  "short_description" text COLLATE "C",
  "sku" text COLLATE "C",
  "price" double precision,
  "sale_price" double precision,
  "gst_percent" double precision,
  "images" jsonb,
  "specifications" jsonb,
  "weight" text COLLATE "C",
  "dimensions" jsonb,
  "metadata" jsonb,
  "listing_status" text COLLATE "C",
  "approval_status" text COLLATE "C",
  "rejection_reason" text COLLATE "C",
  "submitted_at" timestamptz,
  "approved_at" timestamptz,
  "approved_by" text COLLATE "C",
  "admin_disabled" boolean,
  "admin_disabled_reason" text COLLATE "C",
  "stock" double precision,
  "inventory" jsonb,
  "status" text COLLATE "C",
  "rating" double precision,
  "review_count" double precision,
  "is_featured" boolean,
  "deleted_at" timestamptz,
  "version" double precision,
  "authenticity_certificate" text COLLATE "C",
  "is_verified" boolean,
  "temple_source" text COLLATE "C",
  "vendor" jsonb,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplaceproducts" IS 'Tirvona model collection marketplaceproducts. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplaceproducts"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplaceproducts"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."marketplaceproducts"."vendor_id" IS 'model field: vendorId';
COMMENT ON COLUMN "public"."marketplaceproducts"."category_id" IS 'model field: categoryId';
COMMENT ON COLUMN "public"."marketplaceproducts"."short_description" IS 'model field: shortDescription';
COMMENT ON COLUMN "public"."marketplaceproducts"."sale_price" IS 'model field: salePrice';
COMMENT ON COLUMN "public"."marketplaceproducts"."gst_percent" IS 'model field: gstPercent';
COMMENT ON COLUMN "public"."marketplaceproducts"."listing_status" IS 'model field: listingStatus';
COMMENT ON COLUMN "public"."marketplaceproducts"."approval_status" IS 'model field: approvalStatus';
COMMENT ON COLUMN "public"."marketplaceproducts"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."marketplaceproducts"."submitted_at" IS 'model field: submittedAt';
COMMENT ON COLUMN "public"."marketplaceproducts"."approved_at" IS 'model field: approvedAt';
COMMENT ON COLUMN "public"."marketplaceproducts"."approved_by" IS 'model field: approvedBy';
COMMENT ON COLUMN "public"."marketplaceproducts"."admin_disabled" IS 'model field: adminDisabled';
COMMENT ON COLUMN "public"."marketplaceproducts"."admin_disabled_reason" IS 'model field: adminDisabledReason';
COMMENT ON COLUMN "public"."marketplaceproducts"."review_count" IS 'model field: reviewCount';
COMMENT ON COLUMN "public"."marketplaceproducts"."is_featured" IS 'model field: isFeatured';
COMMENT ON COLUMN "public"."marketplaceproducts"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."marketplaceproducts"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."marketplaceproducts"."authenticity_certificate" IS 'model field: authenticityCertificate';
COMMENT ON COLUMN "public"."marketplaceproducts"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."marketplaceproducts"."temple_source" IS 'model field: templeSource';
ALTER TABLE "public"."marketplaceproducts" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplaceproducts_extra_b39317b4" ON "public"."marketplaceproducts" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "marketplaceproducts_ix_2670e9f6" ON "public"."marketplaceproducts" USING btree ("status", "category", "created_at" DESC NULLS LAST);
CREATE INDEX "marketplaceproducts_ix_4e4c1dd7" ON "public"."marketplaceproducts" USING btree ("vendor_id");
CREATE INDEX "marketplaceproducts_ix_24ffa730" ON "public"."marketplaceproducts" USING btree ("category_id");
CREATE INDEX "marketplaceproducts_ix_5983e9be" ON "public"."marketplaceproducts" USING btree ("listing_status");
CREATE INDEX "marketplaceproducts_ix_2daf6acb" ON "public"."marketplaceproducts" USING btree ("approval_status");
CREATE INDEX "marketplaceproducts_ix_20b3ed65" ON "public"."marketplaceproducts" USING btree ("status");
CREATE UNIQUE INDEX "marketplaceproducts_uq_2558c5ca" ON "public"."marketplaceproducts" USING btree ("vendor_id", "sku") NULLS NOT DISTINCT WHERE "sku" IS NOT NULL AND "vendor_id" IS NOT NULL;
CREATE INDEX "marketplaceproducts_ix_4edb08de" ON "public"."marketplaceproducts" USING btree ("approval_status", "listing_status", "category_id");
CREATE UNIQUE INDEX "marketplaceproducts_uq_7a0923dd" ON "public"."marketplaceproducts" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "marketplaceproducts_ix_5cd28265" ON "public"."marketplaceproducts" USING btree ("category");
CREATE INDEX "marketplaceproducts_ix_002f8430" ON "public"."marketplaceproducts" USING btree ("category", "status");

REVOKE ALL ON "public"."marketplaceproducts" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplaceproducts" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."marketplacewaitlists" (
  "id" text COLLATE "C" PRIMARY KEY,
  "email" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."marketplacewaitlists" IS 'Tirvona model collection marketplacewaitlists. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."marketplacewaitlists"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."marketplacewaitlists"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."marketplacewaitlists" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "marketplacewaitlists_extra_56c7ffb5" ON "public"."marketplacewaitlists" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "marketplacewaitlists_uq_dc50223a" ON "public"."marketplacewaitlists" USING btree ("email") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."marketplacewaitlists" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."marketplacewaitlists" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."notification_campaigns" (
  "id" text COLLATE "C" PRIMARY KEY,
  "version" double precision,
  "audience_type" text COLLATE "C",
  "body" text COLLATE "C",
  "created_at" timestamptz,
  "deep_link" text COLLATE "C",
  "failure_count" double precision,
  "failure_reason" text COLLATE "C",
  "image_url" text COLLATE "C",
  "recipient_count" double precision,
  "sent_at" timestamptz,
  "sent_by" text COLLATE "C",
  "status" text COLLATE "C",
  "success_count" double precision,
  "target_roles" jsonb,
  "target_user_ids" jsonb,
  "title" text COLLATE "C",
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."notification_campaigns" IS 'Tirvona model collection notification_campaigns. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."notification_campaigns"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."notification_campaigns"."audience_type" IS 'model field: audienceType';
COMMENT ON COLUMN "public"."notification_campaigns"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."notification_campaigns"."deep_link" IS 'model field: deepLink';
COMMENT ON COLUMN "public"."notification_campaigns"."failure_count" IS 'model field: failureCount';
COMMENT ON COLUMN "public"."notification_campaigns"."failure_reason" IS 'model field: failureReason';
COMMENT ON COLUMN "public"."notification_campaigns"."image_url" IS 'model field: imageUrl';
COMMENT ON COLUMN "public"."notification_campaigns"."recipient_count" IS 'model field: recipientCount';
COMMENT ON COLUMN "public"."notification_campaigns"."sent_at" IS 'model field: sentAt';
COMMENT ON COLUMN "public"."notification_campaigns"."sent_by" IS 'model field: sentBy';
COMMENT ON COLUMN "public"."notification_campaigns"."success_count" IS 'model field: successCount';
COMMENT ON COLUMN "public"."notification_campaigns"."target_roles" IS 'model field: targetRoles';
COMMENT ON COLUMN "public"."notification_campaigns"."target_user_ids" IS 'model field: targetUserIds';
COMMENT ON COLUMN "public"."notification_campaigns"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."notification_campaigns" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "notification_campaigns_extra_de42d1d4" ON "public"."notification_campaigns" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "notification_campaigns_ix_ef760609" ON "public"."notification_campaigns" USING btree ("audience_type");
CREATE INDEX "notification_campaigns_ix_20b3ed65" ON "public"."notification_campaigns" USING btree ("status");
CREATE INDEX "notification_campaigns_ix_67bad42f" ON "public"."notification_campaigns" USING btree ("created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."notification_campaigns" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."notification_campaigns" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."notificationpreferences" (
  "id" text COLLATE "C" PRIMARY KEY,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."notificationpreferences" IS 'Tirvona model collection notificationpreferences. Layout: src/database/pg/registry.generated.ts';
ALTER TABLE "public"."notificationpreferences" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "notificationpreferences_extra_1900e555" ON "public"."notificationpreferences" USING gin ("_extra") WHERE "_extra" IS NOT NULL;

REVOKE ALL ON "public"."notificationpreferences" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."notificationpreferences" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."notifications" (
  "id" text COLLATE "C" PRIMARY KEY,
  "recipient_id" text COLLATE "C",
  "user_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "action" text COLLATE "C",
  "ashram_id" jsonb,
  "booking_id" text COLLATE "C",
  "channel" text COLLATE "C",
  "data" jsonb,
  "event" text COLLATE "C",
  "is_archived" boolean,
  "is_read" boolean,
  "message" text COLLATE "C",
  "meta" jsonb,
  "metadata" jsonb,
  "module" text COLLATE "C",
  "provider_message_id" text COLLATE "C",
  "read_at" timestamptz,
  "recipient_role" text COLLATE "C",
  "sent_at" timestamptz,
  "severity" text COLLATE "C",
  "status" text COLLATE "C",
  "title" text COLLATE "C",
  "type" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."notifications" IS 'Tirvona model collection notifications. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."notifications"."recipient_id" IS 'model field: recipientId';
COMMENT ON COLUMN "public"."notifications"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."notifications"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."notifications"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."notifications"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."notifications"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."notifications"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."notifications"."is_archived" IS 'model field: isArchived';
COMMENT ON COLUMN "public"."notifications"."is_read" IS 'model field: isRead';
COMMENT ON COLUMN "public"."notifications"."provider_message_id" IS 'model field: providerMessageId';
COMMENT ON COLUMN "public"."notifications"."read_at" IS 'model field: readAt';
COMMENT ON COLUMN "public"."notifications"."recipient_role" IS 'model field: recipientRole';
COMMENT ON COLUMN "public"."notifications"."sent_at" IS 'model field: sentAt';
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "notifications_extra_a47312c6" ON "public"."notifications" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "notifications_ix_190a1084" ON "public"."notifications" USING btree ("recipient_id");
CREATE INDEX "notifications_ix_fd6afe8d" ON "public"."notifications" USING btree ("user_id");
CREATE INDEX "notifications_ix_db4718db" ON "public"."notifications" USING btree ("is_read", "created_at" DESC NULLS LAST);
CREATE INDEX "notifications_ix_67bad42f" ON "public"."notifications" USING btree ("created_at" DESC NULLS LAST);
CREATE INDEX "notifications_ix_84c035ed" ON "public"."notifications" USING btree ("severity", "created_at" DESC NULLS LAST);
CREATE INDEX "notifications_ix_eaad200a" ON "public"."notifications" USING btree ("type", "created_at" DESC NULLS LAST);
CREATE INDEX "notifications_ix_298e1a52" ON "public"."notifications" USING btree ("recipient_id", "is_read", "created_at" DESC NULLS LAST);
CREATE INDEX "notifications_ix_5e2190d2" ON "public"."notifications" USING btree ("recipient_role", "created_at" DESC NULLS LAST);
CREATE INDEX "notifications_ix_fcc8f42a" ON "public"."notifications" USING btree ("recipient_role");
CREATE INDEX "notifications_ix_dd782fda" ON "public"."notifications" USING btree ("is_read");
CREATE INDEX "notifications_ix_b69d296c" ON "public"."notifications" USING btree ("severity");

REVOKE ALL ON "public"."notifications" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."notifications" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."notificationtemplates" (
  "id" text COLLATE "C" PRIMARY KEY,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."notificationtemplates" IS 'Tirvona model collection notificationtemplates. Layout: src/database/pg/registry.generated.ts';
ALTER TABLE "public"."notificationtemplates" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "notificationtemplates_extra_150f358d" ON "public"."notificationtemplates" USING gin ("_extra") WHERE "_extra" IS NOT NULL;

REVOKE ALL ON "public"."notificationtemplates" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."notificationtemplates" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."offers" (
  "id" text COLLATE "C" PRIMARY KEY,
  "version" double precision,
  "applicable_ashrams" text[] COLLATE "C",
  "applicable_cities" text[] COLLATE "C",
  "applicable_room_categories" jsonb,
  "applicable_states" jsonb,
  "ashram_id" text COLLATE "C",
  "banner_image" text COLLATE "C",
  "clicks_count" double precision,
  "created_at" timestamptz,
  "description" text COLLATE "C",
  "discount_type" text COLLATE "C",
  "discount_value" double precision,
  "featured" boolean,
  "gallery_images" jsonb,
  "highlights" text[] COLLATE "C",
  "maximum_discount" double precision,
  "maximum_redemptions" double precision,
  "minimum_booking_amount" double precision,
  "offer_title" text COLLATE "C",
  "offer_type" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "per_user_limit" double precision,
  "priority" double precision,
  "promo_code" text COLLATE "C",
  "redemptions_count" double precision,
  "remaining_redemptions" double precision,
  "revenue_generated" double precision,
  "short_title" text COLLATE "C",
  "status" text COLLATE "C",
  "subtitle" text COLLATE "C",
  "terms_and_conditions" text[] COLLATE "C",
  "thumbnail_image" text COLLATE "C",
  "updated_at" timestamptz,
  "updated_by" text COLLATE "C",
  "valid_from" timestamptz,
  "valid_till" timestamptz,
  "views_count" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."offers" IS 'Tirvona model collection offers. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."offers"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."offers"."applicable_ashrams" IS 'model field: applicableAshrams';
COMMENT ON COLUMN "public"."offers"."applicable_cities" IS 'model field: applicableCities';
COMMENT ON COLUMN "public"."offers"."applicable_room_categories" IS 'model field: applicableRoomCategories';
COMMENT ON COLUMN "public"."offers"."applicable_states" IS 'model field: applicableStates';
COMMENT ON COLUMN "public"."offers"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."offers"."banner_image" IS 'model field: bannerImage';
COMMENT ON COLUMN "public"."offers"."clicks_count" IS 'model field: clicksCount';
COMMENT ON COLUMN "public"."offers"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."offers"."discount_type" IS 'model field: discountType';
COMMENT ON COLUMN "public"."offers"."discount_value" IS 'model field: discountValue';
COMMENT ON COLUMN "public"."offers"."gallery_images" IS 'model field: galleryImages';
COMMENT ON COLUMN "public"."offers"."maximum_discount" IS 'model field: maximumDiscount';
COMMENT ON COLUMN "public"."offers"."maximum_redemptions" IS 'model field: maximumRedemptions';
COMMENT ON COLUMN "public"."offers"."minimum_booking_amount" IS 'model field: minimumBookingAmount';
COMMENT ON COLUMN "public"."offers"."offer_title" IS 'model field: offerTitle';
COMMENT ON COLUMN "public"."offers"."offer_type" IS 'model field: offerType';
COMMENT ON COLUMN "public"."offers"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."offers"."per_user_limit" IS 'model field: perUserLimit';
COMMENT ON COLUMN "public"."offers"."promo_code" IS 'model field: promoCode';
COMMENT ON COLUMN "public"."offers"."redemptions_count" IS 'model field: redemptionsCount';
COMMENT ON COLUMN "public"."offers"."remaining_redemptions" IS 'model field: remainingRedemptions';
COMMENT ON COLUMN "public"."offers"."revenue_generated" IS 'model field: revenueGenerated';
COMMENT ON COLUMN "public"."offers"."short_title" IS 'model field: shortTitle';
COMMENT ON COLUMN "public"."offers"."terms_and_conditions" IS 'model field: termsAndConditions';
COMMENT ON COLUMN "public"."offers"."thumbnail_image" IS 'model field: thumbnailImage';
COMMENT ON COLUMN "public"."offers"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."offers"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."offers"."valid_from" IS 'model field: validFrom';
COMMENT ON COLUMN "public"."offers"."valid_till" IS 'model field: validTill';
COMMENT ON COLUMN "public"."offers"."views_count" IS 'model field: viewsCount';
ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "offers_extra_f45c2e11" ON "public"."offers" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "offers_ix_4bb2c93f" ON "public"."offers" USING btree ("promo_code") WHERE "promo_code" IS NOT NULL;
CREATE INDEX "offers_ix_8a9919e3" ON "public"."offers" USING btree ("status", "valid_till");
CREATE INDEX "offers_ix_a1b792e0" ON "public"."offers" USING btree ("owner_id", "created_at" DESC NULLS LAST);
CREATE INDEX "offers_ix_20e39220" ON "public"."offers" USING btree ("ashram_id", "status");
CREATE INDEX "offers_ix_7b5e778d" ON "public"."offers" USING btree ("applicable_ashrams", "status");

REVOKE ALL ON "public"."offers" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."offers" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."offline_inventory_transfers" (
  "id" text COLLATE "C" PRIMARY KEY,
  "reference" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "offline_room_id" text COLLATE "C",
  "room_id" text COLLATE "C",
  "units" double precision,
  "from_date" timestamptz,
  "to_date" timestamptz,
  "dates_covered" double precision,
  "reason" text COLLATE "C",
  "performed_by" text COLLATE "C",
  "performed_by_role" text COLLATE "C",
  "offline_available_before" double precision,
  "offline_available_after" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."offline_inventory_transfers" IS 'Tirvona model collection offline_inventory_transfers. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."offline_room_id" IS 'model field: offlineRoomId';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."from_date" IS 'model field: fromDate';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."to_date" IS 'model field: toDate';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."dates_covered" IS 'model field: datesCovered';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."performed_by" IS 'model field: performedBy';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."performed_by_role" IS 'model field: performedByRole';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."offline_available_before" IS 'model field: offlineAvailableBefore';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."offline_available_after" IS 'model field: offlineAvailableAfter';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."offline_inventory_transfers"."version" IS 'model field: __v';
ALTER TABLE "public"."offline_inventory_transfers" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "offline_inventory_transfers_extra_afccbf1a" ON "public"."offline_inventory_transfers" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "offline_inventory_transfers_uq_43515549" ON "public"."offline_inventory_transfers" USING btree ("reference") NULLS NOT DISTINCT;
CREATE INDEX "offline_inventory_transfers_ix_8beb5a47" ON "public"."offline_inventory_transfers" USING btree ("ashram_id", "created_at" DESC NULLS LAST);
CREATE INDEX "offline_inventory_transfers_ix_91173cb8" ON "public"."offline_inventory_transfers" USING btree ("offline_room_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."offline_inventory_transfers" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."offline_inventory_transfers" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."offline_rooms" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "room_id" text COLLATE "C",
  "label" text COLLATE "C",
  "total_units" double precision,
  "transferred_units" double precision,
  "blocked_units" double precision,
  "status" text COLLATE "C",
  "notes" text COLLATE "C",
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "deleted_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."offline_rooms" IS 'Tirvona model collection offline_rooms. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."offline_rooms"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."offline_rooms"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."offline_rooms"."total_units" IS 'model field: totalUnits';
COMMENT ON COLUMN "public"."offline_rooms"."transferred_units" IS 'model field: transferredUnits';
COMMENT ON COLUMN "public"."offline_rooms"."blocked_units" IS 'model field: blockedUnits';
COMMENT ON COLUMN "public"."offline_rooms"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."offline_rooms"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."offline_rooms"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."offline_rooms"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."offline_rooms"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."offline_rooms"."version" IS 'model field: __v';
ALTER TABLE "public"."offline_rooms" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "offline_rooms_extra_3eb91b79" ON "public"."offline_rooms" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "offline_rooms_ix_20b3ed65" ON "public"."offline_rooms" USING btree ("status");
CREATE INDEX "offline_rooms_ix_0de1cd85" ON "public"."offline_rooms" USING btree ("deleted_at");
CREATE INDEX "offline_rooms_ix_0798bcbf" ON "public"."offline_rooms" USING btree ("ashram_id", "status", "deleted_at");
CREATE INDEX "offline_rooms_ix_18ba4d6d" ON "public"."offline_rooms" USING btree ("ashram_id", "room_id");

REVOKE ALL ON "public"."offline_rooms" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."offline_rooms" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."otps" (
  "id" text COLLATE "C" PRIMARY KEY,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."otps" IS 'Tirvona model collection otps. Layout: src/database/pg/registry.generated.ts';
ALTER TABLE "public"."otps" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "otps_extra_147f2306" ON "public"."otps" USING gin ("_extra") WHERE "_extra" IS NOT NULL;

REVOKE ALL ON "public"."otps" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."otps" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_availability" (
  "id" text COLLATE "C" PRIMARY KEY,
  "location_id" text COLLATE "C",
  "slot_type_id" text COLLATE "C",
  "date" timestamptz,
  "total_capacity" double precision,
  "booked_count" double precision,
  "blocked_count" double precision,
  "custom_price" double precision,
  "is_closed" boolean,
  "note" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_availability" IS 'Tirvona model collection parking_availability. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_availability"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_availability"."slot_type_id" IS 'model field: slotTypeId';
COMMENT ON COLUMN "public"."parking_availability"."total_capacity" IS 'model field: totalCapacity';
COMMENT ON COLUMN "public"."parking_availability"."booked_count" IS 'model field: bookedCount';
COMMENT ON COLUMN "public"."parking_availability"."blocked_count" IS 'model field: blockedCount';
COMMENT ON COLUMN "public"."parking_availability"."custom_price" IS 'model field: customPrice';
COMMENT ON COLUMN "public"."parking_availability"."is_closed" IS 'model field: isClosed';
COMMENT ON COLUMN "public"."parking_availability"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_availability"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_availability"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_availability" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_availability_extra_d7973e85" ON "public"."parking_availability" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_availability_ix_d0644476" ON "public"."parking_availability" USING btree ("date");
CREATE UNIQUE INDEX "parking_availability_uq_524c232a" ON "public"."parking_availability" USING btree ("slot_type_id", "date") NULLS NOT DISTINCT;
CREATE INDEX "parking_availability_ix_feff893a" ON "public"."parking_availability" USING btree ("location_id", "date");
CREATE INDEX "parking_availability_ix_cc082e22" ON "public"."parking_availability" USING btree ("location_id");
CREATE INDEX "parking_availability_ix_995e0229" ON "public"."parking_availability" USING btree ("slot_type_id");

REVOKE ALL ON "public"."parking_availability" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_availability" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_bookings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_reference" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "location_id" text COLLATE "C",
  "partner_id" text COLLATE "C",
  "slot_type_id" text COLLATE "C",
  "assigned_slot_id" text COLLATE "C",
  "assigned_slot_number" text COLLATE "C",
  "vehicle_type" text COLLATE "C",
  "vehicle_number" text COLLATE "C",
  "vehicle_model" text COLLATE "C",
  "driver_name" text COLLATE "C",
  "driver_phone" text COLLATE "C",
  "entry_at" timestamptz,
  "exit_at" timestamptz,
  "duration_hours" double precision,
  "occupied_dates" jsonb,
  "checked_in_at" timestamptz,
  "checked_out_at" timestamptz,
  "actual_duration_minutes" double precision,
  "overstay_minutes" double precision,
  "pricing" jsonb,
  "commission" jsonb,
  "status" text COLLATE "C",
  "payment_status" text COLLATE "C",
  "reservation_expires_at" timestamptz,
  "cancellation" jsonb,
  "history" jsonb,
  "notes" text COLLATE "C",
  "source" text COLLATE "C",
  "expiry_alert_sent_at" timestamptz,
  "payment_link" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "amount_paid" double precision,
  "booking_id" text COLLATE "C",
  "reference" text COLLATE "C",
  "total_amount" double precision,
  "user_id" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_bookings" IS 'Tirvona model collection parking_bookings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_bookings"."booking_reference" IS 'model field: bookingReference';
COMMENT ON COLUMN "public"."parking_bookings"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."parking_bookings"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."parking_bookings"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_bookings"."partner_id" IS 'model field: partnerId';
COMMENT ON COLUMN "public"."parking_bookings"."slot_type_id" IS 'model field: slotTypeId';
COMMENT ON COLUMN "public"."parking_bookings"."assigned_slot_id" IS 'model field: assignedSlotId';
COMMENT ON COLUMN "public"."parking_bookings"."assigned_slot_number" IS 'model field: assignedSlotNumber';
COMMENT ON COLUMN "public"."parking_bookings"."vehicle_type" IS 'model field: vehicleType';
COMMENT ON COLUMN "public"."parking_bookings"."vehicle_number" IS 'model field: vehicleNumber';
COMMENT ON COLUMN "public"."parking_bookings"."vehicle_model" IS 'model field: vehicleModel';
COMMENT ON COLUMN "public"."parking_bookings"."driver_name" IS 'model field: driverName';
COMMENT ON COLUMN "public"."parking_bookings"."driver_phone" IS 'model field: driverPhone';
COMMENT ON COLUMN "public"."parking_bookings"."entry_at" IS 'model field: entryAt';
COMMENT ON COLUMN "public"."parking_bookings"."exit_at" IS 'model field: exitAt';
COMMENT ON COLUMN "public"."parking_bookings"."duration_hours" IS 'model field: durationHours';
COMMENT ON COLUMN "public"."parking_bookings"."occupied_dates" IS 'model field: occupiedDates';
COMMENT ON COLUMN "public"."parking_bookings"."checked_in_at" IS 'model field: checkedInAt';
COMMENT ON COLUMN "public"."parking_bookings"."checked_out_at" IS 'model field: checkedOutAt';
COMMENT ON COLUMN "public"."parking_bookings"."actual_duration_minutes" IS 'model field: actualDurationMinutes';
COMMENT ON COLUMN "public"."parking_bookings"."overstay_minutes" IS 'model field: overstayMinutes';
COMMENT ON COLUMN "public"."parking_bookings"."payment_status" IS 'model field: paymentStatus';
COMMENT ON COLUMN "public"."parking_bookings"."reservation_expires_at" IS 'model field: reservationExpiresAt';
COMMENT ON COLUMN "public"."parking_bookings"."expiry_alert_sent_at" IS 'model field: expiryAlertSentAt';
COMMENT ON COLUMN "public"."parking_bookings"."payment_link" IS 'model field: paymentLink';
COMMENT ON COLUMN "public"."parking_bookings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_bookings"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_bookings"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."parking_bookings"."amount_paid" IS 'model field: amountPaid';
COMMENT ON COLUMN "public"."parking_bookings"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."parking_bookings"."total_amount" IS 'model field: totalAmount';
COMMENT ON COLUMN "public"."parking_bookings"."user_id" IS 'model field: userId';
ALTER TABLE "public"."parking_bookings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_bookings_extra_71b557ce" ON "public"."parking_bookings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "parking_bookings_uq_de4e2fdb" ON "public"."parking_bookings" USING btree ("booking_reference") NULLS NOT DISTINCT;
CREATE INDEX "parking_bookings_ix_995e0229" ON "public"."parking_bookings" USING btree ("slot_type_id");
CREATE INDEX "parking_bookings_ix_1925e8f1" ON "public"."parking_bookings" USING btree ("vehicle_type");
CREATE INDEX "parking_bookings_ix_3d1845eb" ON "public"."parking_bookings" USING btree ("vehicle_number");
CREATE INDEX "parking_bookings_ix_535c29d3" ON "public"."parking_bookings" USING btree ("entry_at");
CREATE INDEX "parking_bookings_ix_20b3ed65" ON "public"."parking_bookings" USING btree ("status");
CREATE INDEX "parking_bookings_ix_f9bfa183" ON "public"."parking_bookings" USING btree ("payment_status");
CREATE INDEX "parking_bookings_ix_e55dc705" ON "public"."parking_bookings" USING btree ("customer_id", "created_at" DESC NULLS LAST);
CREATE INDEX "parking_bookings_ix_2a14f5c0" ON "public"."parking_bookings" USING btree ("whatsapp_customer_id", "created_at" DESC NULLS LAST) WHERE "whatsapp_customer_id" IS NOT NULL;
CREATE INDEX "parking_bookings_ix_ad30a336" ON "public"."parking_bookings" USING btree ("location_id", "status", "entry_at");
CREATE INDEX "parking_bookings_ix_25adffaf" ON "public"."parking_bookings" USING btree ("partner_id", "status", "created_at" DESC NULLS LAST);
CREATE INDEX "parking_bookings_ix_aec51939" ON "public"."parking_bookings" USING btree ("location_id", "vehicle_number", "status");
CREATE INDEX "parking_bookings_ix_e553f74d" ON "public"."parking_bookings" USING btree ("status", "reservation_expires_at");
CREATE INDEX "parking_bookings_ix_435dc7a5" ON "public"."parking_bookings" USING btree ("customer_id");
CREATE INDEX "parking_bookings_ix_cc082e22" ON "public"."parking_bookings" USING btree ("location_id");
CREATE INDEX "parking_bookings_ix_aee8ca04" ON "public"."parking_bookings" USING btree ("partner_id");

REVOKE ALL ON "public"."parking_bookings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_bookings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_commissions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "partner_id" text COLLATE "C",
  "location_id" text COLLATE "C",
  "gross_amount" double precision,
  "commission_percent" double precision,
  "commission_amount" double precision,
  "partner_earning" double precision,
  "currency" text COLLATE "C",
  "settlement_status" text COLLATE "C",
  "settled_at" timestamptz,
  "settlement_reference" text COLLATE "C",
  "payout_batch_id" text COLLATE "C",
  "reversed_at" timestamptz,
  "reversal_reason" text COLLATE "C",
  "notes" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_commissions" IS 'Tirvona model collection parking_commissions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_commissions"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."parking_commissions"."partner_id" IS 'model field: partnerId';
COMMENT ON COLUMN "public"."parking_commissions"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_commissions"."gross_amount" IS 'model field: grossAmount';
COMMENT ON COLUMN "public"."parking_commissions"."commission_percent" IS 'model field: commissionPercent';
COMMENT ON COLUMN "public"."parking_commissions"."commission_amount" IS 'model field: commissionAmount';
COMMENT ON COLUMN "public"."parking_commissions"."partner_earning" IS 'model field: partnerEarning';
COMMENT ON COLUMN "public"."parking_commissions"."settlement_status" IS 'model field: settlementStatus';
COMMENT ON COLUMN "public"."parking_commissions"."settled_at" IS 'model field: settledAt';
COMMENT ON COLUMN "public"."parking_commissions"."settlement_reference" IS 'model field: settlementReference';
COMMENT ON COLUMN "public"."parking_commissions"."payout_batch_id" IS 'model field: payoutBatchId';
COMMENT ON COLUMN "public"."parking_commissions"."reversed_at" IS 'model field: reversedAt';
COMMENT ON COLUMN "public"."parking_commissions"."reversal_reason" IS 'model field: reversalReason';
COMMENT ON COLUMN "public"."parking_commissions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_commissions"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_commissions"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_commissions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_commissions_extra_71fe6258" ON "public"."parking_commissions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "parking_commissions_uq_68b24c9f" ON "public"."parking_commissions" USING btree ("booking_id") NULLS NOT DISTINCT;
CREATE INDEX "parking_commissions_ix_cc082e22" ON "public"."parking_commissions" USING btree ("location_id");
CREATE INDEX "parking_commissions_ix_c8ba7e6a" ON "public"."parking_commissions" USING btree ("settlement_status");
CREATE INDEX "parking_commissions_ix_ef517e8d" ON "public"."parking_commissions" USING btree ("payout_batch_id");
CREATE INDEX "parking_commissions_ix_58170efc" ON "public"."parking_commissions" USING btree ("partner_id", "settlement_status", "created_at");
CREATE INDEX "parking_commissions_ix_284b9e36" ON "public"."parking_commissions" USING btree ("settlement_status", "created_at" DESC NULLS LAST);
CREATE INDEX "parking_commissions_ix_aee8ca04" ON "public"."parking_commissions" USING btree ("partner_id");

REVOKE ALL ON "public"."parking_commissions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_commissions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_holidays" (
  "id" text COLLATE "C" PRIMARY KEY,
  "name" text COLLATE "C",
  "description" text COLLATE "C",
  "partner_id" text COLLATE "C",
  "location_id" text COLLATE "C",
  "start_date" timestamptz,
  "end_date" timestamptz,
  "peak_multiplier" double precision,
  "is_closed" boolean,
  "type" text COLLATE "C",
  "is_active" boolean,
  "created_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_holidays" IS 'Tirvona model collection parking_holidays. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_holidays"."partner_id" IS 'model field: partnerId';
COMMENT ON COLUMN "public"."parking_holidays"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_holidays"."start_date" IS 'model field: startDate';
COMMENT ON COLUMN "public"."parking_holidays"."end_date" IS 'model field: endDate';
COMMENT ON COLUMN "public"."parking_holidays"."peak_multiplier" IS 'model field: peakMultiplier';
COMMENT ON COLUMN "public"."parking_holidays"."is_closed" IS 'model field: isClosed';
COMMENT ON COLUMN "public"."parking_holidays"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."parking_holidays"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."parking_holidays"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_holidays"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_holidays"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_holidays" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_holidays_extra_7475ebb5" ON "public"."parking_holidays" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_holidays_ix_aee8ca04" ON "public"."parking_holidays" USING btree ("partner_id");
CREATE INDEX "parking_holidays_ix_1df469bc" ON "public"."parking_holidays" USING btree ("start_date");
CREATE INDEX "parking_holidays_ix_58c078f5" ON "public"."parking_holidays" USING btree ("end_date");
CREATE INDEX "parking_holidays_ix_3c51413c" ON "public"."parking_holidays" USING btree ("is_active", "start_date", "end_date");
CREATE INDEX "parking_holidays_ix_a1e9da64" ON "public"."parking_holidays" USING btree ("location_id", "is_active", "start_date");
CREATE INDEX "parking_holidays_ix_cc082e22" ON "public"."parking_holidays" USING btree ("location_id");
CREATE INDEX "parking_holidays_ix_91dbee2e" ON "public"."parking_holidays" USING btree ("is_active");

REVOKE ALL ON "public"."parking_holidays" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_holidays" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_locations" (
  "id" text COLLATE "C" PRIMARY KEY,
  "partner_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "name" text COLLATE "C",
  "slug" text COLLATE "C",
  "description" text COLLATE "C",
  "images" jsonb,
  "cover_image" text COLLATE "C",
  "address" jsonb,
  "geo" jsonb,
  "latitude" double precision,
  "longitude" double precision,
  "google_maps_url" text COLLATE "C",
  "nearby_destinations" jsonb,
  "supported_vehicle_types" jsonb,
  "amenities" jsonb,
  "is_covered" boolean,
  "has_cctv" boolean,
  "has_security" boolean,
  "has_washroom" boolean,
  "has_ev_charging" boolean,
  "has_wheelchair_access" boolean,
  "opening_hours" jsonb,
  "total_capacity" double precision,
  "contact_phone" text COLLATE "C",
  "terms_and_conditions" text COLLATE "C",
  "instructions" text COLLATE "C",
  "rating" jsonb,
  "status" text COLLATE "C",
  "is_featured" boolean,
  "is_verified" boolean,
  "created_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_locations" IS 'Tirvona model collection parking_locations. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_locations"."partner_id" IS 'model field: partnerId';
COMMENT ON COLUMN "public"."parking_locations"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."parking_locations"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."parking_locations"."google_maps_url" IS 'model field: googleMapsUrl';
COMMENT ON COLUMN "public"."parking_locations"."nearby_destinations" IS 'model field: nearbyDestinations';
COMMENT ON COLUMN "public"."parking_locations"."supported_vehicle_types" IS 'model field: supportedVehicleTypes';
COMMENT ON COLUMN "public"."parking_locations"."is_covered" IS 'model field: isCovered';
COMMENT ON COLUMN "public"."parking_locations"."has_cctv" IS 'model field: hasCctv';
COMMENT ON COLUMN "public"."parking_locations"."has_security" IS 'model field: hasSecurity';
COMMENT ON COLUMN "public"."parking_locations"."has_washroom" IS 'model field: hasWashroom';
COMMENT ON COLUMN "public"."parking_locations"."has_ev_charging" IS 'model field: hasEvCharging';
COMMENT ON COLUMN "public"."parking_locations"."has_wheelchair_access" IS 'model field: hasWheelchairAccess';
COMMENT ON COLUMN "public"."parking_locations"."opening_hours" IS 'model field: openingHours';
COMMENT ON COLUMN "public"."parking_locations"."total_capacity" IS 'model field: totalCapacity';
COMMENT ON COLUMN "public"."parking_locations"."contact_phone" IS 'model field: contactPhone';
COMMENT ON COLUMN "public"."parking_locations"."terms_and_conditions" IS 'model field: termsAndConditions';
COMMENT ON COLUMN "public"."parking_locations"."is_featured" IS 'model field: isFeatured';
COMMENT ON COLUMN "public"."parking_locations"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."parking_locations"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."parking_locations"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_locations"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_locations"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_locations" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_locations_extra_ade4dcf6" ON "public"."parking_locations" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_locations_ix_4c90543b" ON "public"."parking_locations" USING btree ("ashram_id");
CREATE UNIQUE INDEX "parking_locations_uq_7a0923dd" ON "public"."parking_locations" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "parking_locations_ix_a9876116" ON "public"."parking_locations" USING btree (("address" #> '{city}'));
CREATE INDEX "parking_locations_ix_aaaea1cb" ON "public"."parking_locations" USING btree (("address" #> '{state}'));
CREATE INDEX "parking_locations_ix_20b3ed65" ON "public"."parking_locations" USING btree ("status");
CREATE INDEX "parking_locations_ix_a715e4d7" ON "public"."parking_locations" USING btree ("status", ("address" #> '{city}'), ("rating" #> '{average}') DESC NULLS LAST);
CREATE INDEX "parking_locations_ix_8564b661" ON "public"."parking_locations" USING btree ("status", "supported_vehicle_types");
CREATE INDEX "parking_locations_ix_1e5d8344" ON "public"."parking_locations" USING btree ("partner_id", "status");
CREATE INDEX "parking_locations_ix_20e39220" ON "public"."parking_locations" USING btree ("ashram_id", "status");
CREATE INDEX "parking_locations_ix_4353dc37" ON "public"."parking_locations" USING btree (("nearby_destinations" #> '{templeSlug}'), "status");
CREATE INDEX "parking_locations_ix_aee8ca04" ON "public"."parking_locations" USING btree ("partner_id");

REVOKE ALL ON "public"."parking_locations" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_locations" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_notifications" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "event" text COLLATE "C",
  "title" text COLLATE "C",
  "message" text COLLATE "C",
  "channel" text COLLATE "C",
  "status" text COLLATE "C",
  "recipient_phone" text COLLATE "C",
  "delivery_error" text COLLATE "C",
  "provider_message_id" text COLLATE "C",
  "sent_at" timestamptz,
  "read_at" timestamptz,
  "meta" jsonb,
  "push_enabled" boolean,
  "image_url" text COLLATE "C",
  "data" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_notifications" IS 'Tirvona model collection parking_notifications. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_notifications"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."parking_notifications"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."parking_notifications"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."parking_notifications"."recipient_phone" IS 'model field: recipientPhone';
COMMENT ON COLUMN "public"."parking_notifications"."delivery_error" IS 'model field: deliveryError';
COMMENT ON COLUMN "public"."parking_notifications"."provider_message_id" IS 'model field: providerMessageId';
COMMENT ON COLUMN "public"."parking_notifications"."sent_at" IS 'model field: sentAt';
COMMENT ON COLUMN "public"."parking_notifications"."read_at" IS 'model field: readAt';
COMMENT ON COLUMN "public"."parking_notifications"."push_enabled" IS 'model field: pushEnabled';
COMMENT ON COLUMN "public"."parking_notifications"."image_url" IS 'model field: imageUrl';
COMMENT ON COLUMN "public"."parking_notifications"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_notifications"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_notifications"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_notifications" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_notifications_extra_75254c24" ON "public"."parking_notifications" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_notifications_ix_2b29ad3b" ON "public"."parking_notifications" USING btree ("event");
CREATE INDEX "parking_notifications_ix_20b3ed65" ON "public"."parking_notifications" USING btree ("status");
CREATE INDEX "parking_notifications_ix_53637f3b" ON "public"."parking_notifications" USING btree ("user_id", "created_at" DESC NULLS LAST);
CREATE INDEX "parking_notifications_ix_38f5f0a0" ON "public"."parking_notifications" USING btree ("user_id", "read_at");
CREATE INDEX "parking_notifications_ix_3b44e6e0" ON "public"."parking_notifications" USING btree ("booking_id", "event");
CREATE INDEX "parking_notifications_ix_fd6afe8d" ON "public"."parking_notifications" USING btree ("user_id");
CREATE INDEX "parking_notifications_ix_caf0121a" ON "public"."parking_notifications" USING btree ("booking_id");

REVOKE ALL ON "public"."parking_notifications" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_notifications" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_partners" (
  "id" text COLLATE "C" PRIMARY KEY,
  "partner_code" text COLLATE "C",
  "user_id" text COLLATE "C",
  "business_name" text COLLATE "C",
  "contact_person" text COLLATE "C",
  "contact_email" text COLLATE "C",
  "contact_phone" text COLLATE "C",
  "gst_number" text COLLATE "C",
  "pan_number" text COLLATE "C",
  "address" jsonb,
  "bank_account" jsonb,
  "documents" jsonb,
  "commission_percent" double precision,
  "status" text COLLATE "C",
  "is_verified" boolean,
  "verified_at" timestamptz,
  "verified_by" text COLLATE "C",
  "rejection_reason" text COLLATE "C",
  "notes" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "city" text COLLATE "C",
  "images" jsonb,
  "state" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_partners" IS 'Tirvona model collection parking_partners. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_partners"."partner_code" IS 'model field: partnerCode';
COMMENT ON COLUMN "public"."parking_partners"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."parking_partners"."business_name" IS 'model field: businessName';
COMMENT ON COLUMN "public"."parking_partners"."contact_person" IS 'model field: contactPerson';
COMMENT ON COLUMN "public"."parking_partners"."contact_email" IS 'model field: contactEmail';
COMMENT ON COLUMN "public"."parking_partners"."contact_phone" IS 'model field: contactPhone';
COMMENT ON COLUMN "public"."parking_partners"."gst_number" IS 'model field: gstNumber';
COMMENT ON COLUMN "public"."parking_partners"."pan_number" IS 'model field: panNumber';
COMMENT ON COLUMN "public"."parking_partners"."bank_account" IS 'model field: bankAccount';
COMMENT ON COLUMN "public"."parking_partners"."commission_percent" IS 'model field: commissionPercent';
COMMENT ON COLUMN "public"."parking_partners"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."parking_partners"."verified_at" IS 'model field: verifiedAt';
COMMENT ON COLUMN "public"."parking_partners"."verified_by" IS 'model field: verifiedBy';
COMMENT ON COLUMN "public"."parking_partners"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."parking_partners"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_partners"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_partners"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_partners" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_partners_extra_b74e5b60" ON "public"."parking_partners" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "parking_partners_uq_64831cbf" ON "public"."parking_partners" USING btree ("partner_code") NULLS NOT DISTINCT;
CREATE INDEX "parking_partners_ix_fd6afe8d" ON "public"."parking_partners" USING btree ("user_id");
CREATE INDEX "parking_partners_ix_20b3ed65" ON "public"."parking_partners" USING btree ("status");
CREATE INDEX "parking_partners_ix_82abfc2f" ON "public"."parking_partners" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "parking_partners_ix_2dded0ae" ON "public"."parking_partners" USING btree (("address" #> '{city}'), "status");
CREATE INDEX "parking_partners_ix_a9876116" ON "public"."parking_partners" USING btree (("address" #> '{city}'));
CREATE INDEX "parking_partners_ix_aaaea1cb" ON "public"."parking_partners" USING btree (("address" #> '{state}'));

REVOKE ALL ON "public"."parking_partners" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_partners" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_payments" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "user_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "partner_id" text COLLATE "C",
  "amount" double precision,
  "wallet_amount" double precision,
  "currency" text COLLATE "C",
  "purpose" text COLLATE "C",
  "method" text COLLATE "C",
  "status" text COLLATE "C",
  "transaction_id" text COLLATE "C",
  "gateway" jsonb,
  "failure_reason" text COLLATE "C",
  "paid_at" timestamptz,
  "refund" jsonb,
  "ip_address" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_payments" IS 'Tirvona model collection parking_payments. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_payments"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."parking_payments"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."parking_payments"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."parking_payments"."partner_id" IS 'model field: partnerId';
COMMENT ON COLUMN "public"."parking_payments"."wallet_amount" IS 'model field: walletAmount';
COMMENT ON COLUMN "public"."parking_payments"."transaction_id" IS 'model field: transactionId';
COMMENT ON COLUMN "public"."parking_payments"."failure_reason" IS 'model field: failureReason';
COMMENT ON COLUMN "public"."parking_payments"."paid_at" IS 'model field: paidAt';
COMMENT ON COLUMN "public"."parking_payments"."ip_address" IS 'model field: ipAddress';
COMMENT ON COLUMN "public"."parking_payments"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_payments"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_payments"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_payments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_payments_extra_b086a1c7" ON "public"."parking_payments" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_payments_ix_fd6afe8d" ON "public"."parking_payments" USING btree ("user_id");
CREATE INDEX "parking_payments_ix_20b3ed65" ON "public"."parking_payments" USING btree ("status");
CREATE INDEX "parking_payments_ix_cbab8764" ON "public"."parking_payments" USING btree ("transaction_id");
CREATE INDEX "parking_payments_ix_360919b8" ON "public"."parking_payments" USING btree ("booking_id", "status");
CREATE INDEX "parking_payments_ix_6ebebfc8" ON "public"."parking_payments" USING btree ("partner_id", "status", "paid_at" DESC NULLS LAST);
CREATE INDEX "parking_payments_ix_b79f1c74" ON "public"."parking_payments" USING btree (("gateway" #> '{orderId}'));
CREATE INDEX "parking_payments_ix_c894a283" ON "public"."parking_payments" USING btree (("gateway" #> '{paymentId}')) WHERE ("gateway" #> '{paymentId}') IS NOT NULL;
CREATE INDEX "parking_payments_ix_caf0121a" ON "public"."parking_payments" USING btree ("booking_id");
CREATE INDEX "parking_payments_ix_aee8ca04" ON "public"."parking_payments" USING btree ("partner_id");

REVOKE ALL ON "public"."parking_payments" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_payments" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_pricing" (
  "id" text COLLATE "C" PRIMARY KEY,
  "location_id" text COLLATE "C",
  "slot_type_id" text COLLATE "C",
  "vehicle_type" text COLLATE "C",
  "mode" text COLLATE "C",
  "base_fee" double precision,
  "hourly_rate" double precision,
  "daily_rate" double precision,
  "slabs" jsonb,
  "peak_multiplier" double precision,
  "overstay_multiplier" double precision,
  "tax_percent" double precision,
  "minimum_billable_hours" double precision,
  "free_minutes" double precision,
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "is_active" boolean,
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "images" jsonb,
  "is_verified" boolean,
  "status" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_pricing" IS 'Tirvona model collection parking_pricing. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_pricing"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_pricing"."slot_type_id" IS 'model field: slotTypeId';
COMMENT ON COLUMN "public"."parking_pricing"."vehicle_type" IS 'model field: vehicleType';
COMMENT ON COLUMN "public"."parking_pricing"."base_fee" IS 'model field: baseFee';
COMMENT ON COLUMN "public"."parking_pricing"."hourly_rate" IS 'model field: hourlyRate';
COMMENT ON COLUMN "public"."parking_pricing"."daily_rate" IS 'model field: dailyRate';
COMMENT ON COLUMN "public"."parking_pricing"."peak_multiplier" IS 'model field: peakMultiplier';
COMMENT ON COLUMN "public"."parking_pricing"."overstay_multiplier" IS 'model field: overstayMultiplier';
COMMENT ON COLUMN "public"."parking_pricing"."tax_percent" IS 'model field: taxPercent';
COMMENT ON COLUMN "public"."parking_pricing"."minimum_billable_hours" IS 'model field: minimumBillableHours';
COMMENT ON COLUMN "public"."parking_pricing"."free_minutes" IS 'model field: freeMinutes';
COMMENT ON COLUMN "public"."parking_pricing"."valid_from" IS 'model field: validFrom';
COMMENT ON COLUMN "public"."parking_pricing"."valid_until" IS 'model field: validUntil';
COMMENT ON COLUMN "public"."parking_pricing"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."parking_pricing"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."parking_pricing"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_pricing"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_pricing"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."parking_pricing"."is_verified" IS 'model field: isVerified';
ALTER TABLE "public"."parking_pricing" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_pricing_extra_e4f9b9b0" ON "public"."parking_pricing" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_pricing_ix_995e0229" ON "public"."parking_pricing" USING btree ("slot_type_id");
CREATE INDEX "parking_pricing_ix_1925e8f1" ON "public"."parking_pricing" USING btree ("vehicle_type");
CREATE INDEX "parking_pricing_ix_91dbee2e" ON "public"."parking_pricing" USING btree ("is_active");
CREATE INDEX "parking_pricing_ix_73a9fa60" ON "public"."parking_pricing" USING btree ("location_id", "vehicle_type", "is_active", "slot_type_id");
CREATE INDEX "parking_pricing_ix_04785fbe" ON "public"."parking_pricing" USING btree ("location_id", "valid_from", "valid_until");
CREATE INDEX "parking_pricing_ix_cc082e22" ON "public"."parking_pricing" USING btree ("location_id");

REVOKE ALL ON "public"."parking_pricing" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_pricing" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_qr_codes" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "location_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "token_hash" text COLLATE "C",
  "token" text COLLATE "C",
  "display_code" text COLLATE "C",
  "version" double precision,
  "issued_at" timestamptz,
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "entry_scanned_at" timestamptz,
  "exit_scanned_at" timestamptz,
  "scan_count" double precision,
  "status" text COLLATE "C",
  "revoked_reason" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version_2" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_qr_codes" IS 'Tirvona model collection parking_qr_codes. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_qr_codes"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."parking_qr_codes"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_qr_codes"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."parking_qr_codes"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."parking_qr_codes"."token_hash" IS 'model field: tokenHash';
COMMENT ON COLUMN "public"."parking_qr_codes"."display_code" IS 'model field: displayCode';
COMMENT ON COLUMN "public"."parking_qr_codes"."issued_at" IS 'model field: issuedAt';
COMMENT ON COLUMN "public"."parking_qr_codes"."valid_from" IS 'model field: validFrom';
COMMENT ON COLUMN "public"."parking_qr_codes"."valid_until" IS 'model field: validUntil';
COMMENT ON COLUMN "public"."parking_qr_codes"."entry_scanned_at" IS 'model field: entryScannedAt';
COMMENT ON COLUMN "public"."parking_qr_codes"."exit_scanned_at" IS 'model field: exitScannedAt';
COMMENT ON COLUMN "public"."parking_qr_codes"."scan_count" IS 'model field: scanCount';
COMMENT ON COLUMN "public"."parking_qr_codes"."revoked_reason" IS 'model field: revokedReason';
COMMENT ON COLUMN "public"."parking_qr_codes"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_qr_codes"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_qr_codes"."version_2" IS 'model field: __v';
ALTER TABLE "public"."parking_qr_codes" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_qr_codes_extra_f7ab297d" ON "public"."parking_qr_codes" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_qr_codes_ix_cc082e22" ON "public"."parking_qr_codes" USING btree ("location_id");
CREATE INDEX "parking_qr_codes_ix_435dc7a5" ON "public"."parking_qr_codes" USING btree ("customer_id");
CREATE INDEX "parking_qr_codes_ix_d462fecd" ON "public"."parking_qr_codes" USING btree ("valid_until");
CREATE INDEX "parking_qr_codes_ix_20b3ed65" ON "public"."parking_qr_codes" USING btree ("status");
CREATE INDEX "parking_qr_codes_ix_f7fd7d94" ON "public"."parking_qr_codes" USING btree ("token_hash", "status");
CREATE INDEX "parking_qr_codes_ix_736bc9b6" ON "public"."parking_qr_codes" USING btree ("booking_id", "version" DESC NULLS LAST);
CREATE INDEX "parking_qr_codes_ix_b8e2ab72" ON "public"."parking_qr_codes" USING btree ("display_code");
CREATE INDEX "parking_qr_codes_ix_caf0121a" ON "public"."parking_qr_codes" USING btree ("booking_id");
CREATE INDEX "parking_qr_codes_ix_323ed203" ON "public"."parking_qr_codes" USING btree ("token_hash");

REVOKE ALL ON "public"."parking_qr_codes" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_qr_codes" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_reviews" (
  "id" text COLLATE "C" PRIMARY KEY,
  "location_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "rating" jsonb,
  "comment" text COLLATE "C",
  "images" jsonb,
  "status" text COLLATE "C",
  "moderation_note" text COLLATE "C",
  "moderated_by" text COLLATE "C",
  "partner_response" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_reviews" IS 'Tirvona model collection parking_reviews. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_reviews"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_reviews"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."parking_reviews"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."parking_reviews"."moderation_note" IS 'model field: moderationNote';
COMMENT ON COLUMN "public"."parking_reviews"."moderated_by" IS 'model field: moderatedBy';
COMMENT ON COLUMN "public"."parking_reviews"."partner_response" IS 'model field: partnerResponse';
COMMENT ON COLUMN "public"."parking_reviews"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_reviews"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_reviews"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_reviews" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_reviews_extra_83959be2" ON "public"."parking_reviews" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_reviews_ix_435dc7a5" ON "public"."parking_reviews" USING btree ("customer_id");
CREATE INDEX "parking_reviews_ix_20b3ed65" ON "public"."parking_reviews" USING btree ("status");
CREATE UNIQUE INDEX "parking_reviews_uq_68b24c9f" ON "public"."parking_reviews" USING btree ("booking_id") NULLS NOT DISTINCT;
CREATE INDEX "parking_reviews_ix_5466c597" ON "public"."parking_reviews" USING btree ("location_id", "status", "created_at" DESC NULLS LAST);
CREATE INDEX "parking_reviews_ix_cc082e22" ON "public"."parking_reviews" USING btree ("location_id");

REVOKE ALL ON "public"."parking_reviews" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_reviews" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_scan_logs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "qr_code_id" text COLLATE "C",
  "location_id" text COLLATE "C",
  "scanned_by_user_id" text COLLATE "C",
  "scanned_by_staff_id" text COLLATE "C",
  "action" text COLLATE "C",
  "result" text COLLATE "C",
  "token_fingerprint" text COLLATE "C",
  "vehicle_number" text COLLATE "C",
  "assigned_slot_number" text COLLATE "C",
  "message" text COLLATE "C",
  "device_info" text COLLATE "C",
  "ip_address" text COLLATE "C",
  "scanned_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_scan_logs" IS 'Tirvona model collection parking_scan_logs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_scan_logs"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."parking_scan_logs"."qr_code_id" IS 'model field: qrCodeId';
COMMENT ON COLUMN "public"."parking_scan_logs"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_scan_logs"."scanned_by_user_id" IS 'model field: scannedByUserId';
COMMENT ON COLUMN "public"."parking_scan_logs"."scanned_by_staff_id" IS 'model field: scannedByStaffId';
COMMENT ON COLUMN "public"."parking_scan_logs"."token_fingerprint" IS 'model field: tokenFingerprint';
COMMENT ON COLUMN "public"."parking_scan_logs"."vehicle_number" IS 'model field: vehicleNumber';
COMMENT ON COLUMN "public"."parking_scan_logs"."assigned_slot_number" IS 'model field: assignedSlotNumber';
COMMENT ON COLUMN "public"."parking_scan_logs"."device_info" IS 'model field: deviceInfo';
COMMENT ON COLUMN "public"."parking_scan_logs"."ip_address" IS 'model field: ipAddress';
COMMENT ON COLUMN "public"."parking_scan_logs"."scanned_at" IS 'model field: scannedAt';
COMMENT ON COLUMN "public"."parking_scan_logs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_scan_logs"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_scan_logs"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_scan_logs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_scan_logs_extra_07db7f5e" ON "public"."parking_scan_logs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_scan_logs_ix_c13d88d4" ON "public"."parking_scan_logs" USING btree ("qr_code_id");
CREATE INDEX "parking_scan_logs_ix_0752c4cb" ON "public"."parking_scan_logs" USING btree ("scanned_by_user_id");
CREATE INDEX "parking_scan_logs_ix_02cfbbe7" ON "public"."parking_scan_logs" USING btree ("action");
CREATE INDEX "parking_scan_logs_ix_e8872df6" ON "public"."parking_scan_logs" USING btree ("scanned_at");
CREATE INDEX "parking_scan_logs_ix_ef634f94" ON "public"."parking_scan_logs" USING btree ("location_id", "scanned_at" DESC NULLS LAST);
CREATE INDEX "parking_scan_logs_ix_41534827" ON "public"."parking_scan_logs" USING btree ("booking_id", "scanned_at" DESC NULLS LAST);
CREATE INDEX "parking_scan_logs_ix_e6eba7ef" ON "public"."parking_scan_logs" USING btree ("result", "scanned_at" DESC NULLS LAST);
CREATE INDEX "parking_scan_logs_ix_caf0121a" ON "public"."parking_scan_logs" USING btree ("booking_id");
CREATE INDEX "parking_scan_logs_ix_cc082e22" ON "public"."parking_scan_logs" USING btree ("location_id");
CREATE INDEX "parking_scan_logs_ix_3d3f7086" ON "public"."parking_scan_logs" USING btree ("result");

REVOKE ALL ON "public"."parking_scan_logs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_scan_logs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_settings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "scope" text COLLATE "C",
  "partner_id" text COLLATE "C",
  "location_id" text COLLATE "C",
  "reservation_hold_minutes" double precision,
  "overstay_grace_minutes" double precision,
  "no_show_after_minutes" double precision,
  "overstay_multiplier" double precision,
  "commission_percent" double precision,
  "tax_percent" double precision,
  "minimum_billable_hours" double precision,
  "free_cancellation_hours" double precision,
  "refund_percent_inside_window" double precision,
  "refund_percent_outside_window" double precision,
  "qr_validity_buffer_minutes" double precision,
  "allow_online_booking" boolean,
  "allow_cancellation" boolean,
  "require_vehicle_number" boolean,
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_settings" IS 'Tirvona model collection parking_settings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_settings"."partner_id" IS 'model field: partnerId';
COMMENT ON COLUMN "public"."parking_settings"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_settings"."reservation_hold_minutes" IS 'model field: reservationHoldMinutes';
COMMENT ON COLUMN "public"."parking_settings"."overstay_grace_minutes" IS 'model field: overstayGraceMinutes';
COMMENT ON COLUMN "public"."parking_settings"."no_show_after_minutes" IS 'model field: noShowAfterMinutes';
COMMENT ON COLUMN "public"."parking_settings"."overstay_multiplier" IS 'model field: overstayMultiplier';
COMMENT ON COLUMN "public"."parking_settings"."commission_percent" IS 'model field: commissionPercent';
COMMENT ON COLUMN "public"."parking_settings"."tax_percent" IS 'model field: taxPercent';
COMMENT ON COLUMN "public"."parking_settings"."minimum_billable_hours" IS 'model field: minimumBillableHours';
COMMENT ON COLUMN "public"."parking_settings"."free_cancellation_hours" IS 'model field: freeCancellationHours';
COMMENT ON COLUMN "public"."parking_settings"."refund_percent_inside_window" IS 'model field: refundPercentInsideWindow';
COMMENT ON COLUMN "public"."parking_settings"."refund_percent_outside_window" IS 'model field: refundPercentOutsideWindow';
COMMENT ON COLUMN "public"."parking_settings"."qr_validity_buffer_minutes" IS 'model field: qrValidityBufferMinutes';
COMMENT ON COLUMN "public"."parking_settings"."allow_online_booking" IS 'model field: allowOnlineBooking';
COMMENT ON COLUMN "public"."parking_settings"."allow_cancellation" IS 'model field: allowCancellation';
COMMENT ON COLUMN "public"."parking_settings"."require_vehicle_number" IS 'model field: requireVehicleNumber';
COMMENT ON COLUMN "public"."parking_settings"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."parking_settings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_settings"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_settings"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_settings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_settings_extra_3c3add44" ON "public"."parking_settings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_settings_ix_aee8ca04" ON "public"."parking_settings" USING btree ("partner_id");
CREATE INDEX "parking_settings_ix_cc082e22" ON "public"."parking_settings" USING btree ("location_id");
CREATE UNIQUE INDEX "parking_settings_uq_39e68c29" ON "public"."parking_settings" USING btree ("scope", "partner_id", "location_id") NULLS NOT DISTINCT;
CREATE INDEX "parking_settings_ix_5cee787c" ON "public"."parking_settings" USING btree ("scope");

REVOKE ALL ON "public"."parking_settings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_settings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_slot_types" (
  "id" text COLLATE "C" PRIMARY KEY,
  "location_id" text COLLATE "C",
  "name" text COLLATE "C",
  "code" text COLLATE "C",
  "description" text COLLATE "C",
  "vehicle_types" jsonb,
  "total_capacity" double precision,
  "is_covered" boolean,
  "has_ev_charging" boolean,
  "floor_label" text COLLATE "C",
  "is_active" boolean,
  "display_order" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_slot_types" IS 'Tirvona model collection parking_slot_types. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_slot_types"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_slot_types"."vehicle_types" IS 'model field: vehicleTypes';
COMMENT ON COLUMN "public"."parking_slot_types"."total_capacity" IS 'model field: totalCapacity';
COMMENT ON COLUMN "public"."parking_slot_types"."is_covered" IS 'model field: isCovered';
COMMENT ON COLUMN "public"."parking_slot_types"."has_ev_charging" IS 'model field: hasEvCharging';
COMMENT ON COLUMN "public"."parking_slot_types"."floor_label" IS 'model field: floorLabel';
COMMENT ON COLUMN "public"."parking_slot_types"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."parking_slot_types"."display_order" IS 'model field: displayOrder';
COMMENT ON COLUMN "public"."parking_slot_types"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_slot_types"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_slot_types"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_slot_types" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_slot_types_extra_26b02553" ON "public"."parking_slot_types" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_slot_types_ix_b958e0df" ON "public"."parking_slot_types" USING btree ("location_id", "is_active", "display_order");
CREATE INDEX "parking_slot_types_ix_6c43d159" ON "public"."parking_slot_types" USING btree ("location_id", "vehicle_types");
CREATE INDEX "parking_slot_types_ix_cc082e22" ON "public"."parking_slot_types" USING btree ("location_id");

REVOKE ALL ON "public"."parking_slot_types" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_slot_types" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_slots" (
  "id" text COLLATE "C" PRIMARY KEY,
  "location_id" text COLLATE "C",
  "slot_type_id" text COLLATE "C",
  "slot_number" text COLLATE "C",
  "floor_label" text COLLATE "C",
  "zone" text COLLATE "C",
  "status" text COLLATE "C",
  "current_booking_id" text COLLATE "C",
  "occupied_at" timestamptz,
  "maintenance_note" text COLLATE "C",
  "is_active" boolean,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_slots" IS 'Tirvona model collection parking_slots. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_slots"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_slots"."slot_type_id" IS 'model field: slotTypeId';
COMMENT ON COLUMN "public"."parking_slots"."slot_number" IS 'model field: slotNumber';
COMMENT ON COLUMN "public"."parking_slots"."floor_label" IS 'model field: floorLabel';
COMMENT ON COLUMN "public"."parking_slots"."current_booking_id" IS 'model field: currentBookingId';
COMMENT ON COLUMN "public"."parking_slots"."occupied_at" IS 'model field: occupiedAt';
COMMENT ON COLUMN "public"."parking_slots"."maintenance_note" IS 'model field: maintenanceNote';
COMMENT ON COLUMN "public"."parking_slots"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."parking_slots"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_slots"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_slots"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_slots" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_slots_extra_7e2818c2" ON "public"."parking_slots" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_slots_ix_995e0229" ON "public"."parking_slots" USING btree ("slot_type_id");
CREATE INDEX "parking_slots_ix_20b3ed65" ON "public"."parking_slots" USING btree ("status");
CREATE UNIQUE INDEX "parking_slots_uq_0d9aa4c3" ON "public"."parking_slots" USING btree ("location_id", "slot_number") NULLS NOT DISTINCT;
CREATE INDEX "parking_slots_ix_ae9904db" ON "public"."parking_slots" USING btree ("location_id", "slot_type_id", "status", "is_active");
CREATE INDEX "parking_slots_ix_cc082e22" ON "public"."parking_slots" USING btree ("location_id");

REVOKE ALL ON "public"."parking_slots" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_slots" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_staff" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "partner_id" text COLLATE "C",
  "location_ids" jsonb,
  "parking_role" text COLLATE "C",
  "capability_overrides" jsonb,
  "employee_code" text COLLATE "C",
  "shift" text COLLATE "C",
  "phone" text COLLATE "C",
  "status" text COLLATE "C",
  "assigned_by" text COLLATE "C",
  "last_active_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_staff" IS 'Tirvona model collection parking_staff. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_staff"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."parking_staff"."partner_id" IS 'model field: partnerId';
COMMENT ON COLUMN "public"."parking_staff"."location_ids" IS 'model field: locationIds';
COMMENT ON COLUMN "public"."parking_staff"."parking_role" IS 'model field: parkingRole';
COMMENT ON COLUMN "public"."parking_staff"."capability_overrides" IS 'model field: capabilityOverrides';
COMMENT ON COLUMN "public"."parking_staff"."employee_code" IS 'model field: employeeCode';
COMMENT ON COLUMN "public"."parking_staff"."assigned_by" IS 'model field: assignedBy';
COMMENT ON COLUMN "public"."parking_staff"."last_active_at" IS 'model field: lastActiveAt';
COMMENT ON COLUMN "public"."parking_staff"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_staff"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_staff"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_staff" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_staff_extra_d7ec1714" ON "public"."parking_staff" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_staff_ix_0c298572" ON "public"."parking_staff" USING btree ("parking_role");
CREATE INDEX "parking_staff_ix_20b3ed65" ON "public"."parking_staff" USING btree ("status");
CREATE UNIQUE INDEX "parking_staff_uq_5a9f0c50" ON "public"."parking_staff" USING btree ("user_id", "partner_id", "parking_role") NULLS NOT DISTINCT;
CREATE INDEX "parking_staff_ix_9b647de0" ON "public"."parking_staff" USING btree ("user_id", "status");
CREATE INDEX "parking_staff_ix_1e5d8344" ON "public"."parking_staff" USING btree ("partner_id", "status");
CREATE INDEX "parking_staff_ix_8c899ffe" ON "public"."parking_staff" USING btree ("location_ids", "status");
CREATE INDEX "parking_staff_ix_fd6afe8d" ON "public"."parking_staff" USING btree ("user_id");
CREATE INDEX "parking_staff_ix_aee8ca04" ON "public"."parking_staff" USING btree ("partner_id");

REVOKE ALL ON "public"."parking_staff" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_staff" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_transactions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "booking_id" text COLLATE "C",
  "payment_id" text COLLATE "C",
  "partner_id" text COLLATE "C",
  "location_id" text COLLATE "C",
  "type" text COLLATE "C",
  "amount" double precision,
  "currency" text COLLATE "C",
  "direction" text COLLATE "C",
  "description" text COLLATE "C",
  "reference" text COLLATE "C",
  "meta" jsonb,
  "recorded_by" text COLLATE "C",
  "occurred_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_transactions" IS 'Tirvona model collection parking_transactions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_transactions"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."parking_transactions"."payment_id" IS 'model field: paymentId';
COMMENT ON COLUMN "public"."parking_transactions"."partner_id" IS 'model field: partnerId';
COMMENT ON COLUMN "public"."parking_transactions"."location_id" IS 'model field: locationId';
COMMENT ON COLUMN "public"."parking_transactions"."recorded_by" IS 'model field: recordedBy';
COMMENT ON COLUMN "public"."parking_transactions"."occurred_at" IS 'model field: occurredAt';
COMMENT ON COLUMN "public"."parking_transactions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_transactions"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_transactions"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_transactions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_transactions_extra_55191c3f" ON "public"."parking_transactions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "parking_transactions_ix_caf0121a" ON "public"."parking_transactions" USING btree ("booking_id");
CREATE INDEX "parking_transactions_ix_80649481" ON "public"."parking_transactions" USING btree ("payment_id");
CREATE INDEX "parking_transactions_ix_85731020" ON "public"."parking_transactions" USING btree ("reference");
CREATE INDEX "parking_transactions_ix_8e3be854" ON "public"."parking_transactions" USING btree ("occurred_at");
CREATE INDEX "parking_transactions_ix_9a629d6e" ON "public"."parking_transactions" USING btree ("partner_id", "type", "occurred_at" DESC NULLS LAST);
CREATE INDEX "parking_transactions_ix_b958743a" ON "public"."parking_transactions" USING btree ("location_id", "occurred_at" DESC NULLS LAST);
CREATE INDEX "parking_transactions_ix_88e4b838" ON "public"."parking_transactions" USING btree ("type", "occurred_at" DESC NULLS LAST);
CREATE INDEX "parking_transactions_ix_aee8ca04" ON "public"."parking_transactions" USING btree ("partner_id");
CREATE INDEX "parking_transactions_ix_cc082e22" ON "public"."parking_transactions" USING btree ("location_id");
CREATE INDEX "parking_transactions_ix_a4fad3d0" ON "public"."parking_transactions" USING btree ("type");

REVOKE ALL ON "public"."parking_transactions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_transactions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."parking_vehicle_types" (
  "id" text COLLATE "C" PRIMARY KEY,
  "code" text COLLATE "C",
  "label" text COLLATE "C",
  "icon" text COLLATE "C",
  "footprint" double precision,
  "display_order" double precision,
  "is_active" boolean,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."parking_vehicle_types" IS 'Tirvona model collection parking_vehicle_types. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."parking_vehicle_types"."display_order" IS 'model field: displayOrder';
COMMENT ON COLUMN "public"."parking_vehicle_types"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."parking_vehicle_types"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."parking_vehicle_types"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."parking_vehicle_types"."version" IS 'model field: __v';
ALTER TABLE "public"."parking_vehicle_types" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "parking_vehicle_types_extra_82540ca5" ON "public"."parking_vehicle_types" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "parking_vehicle_types_uq_4b314428" ON "public"."parking_vehicle_types" USING btree ("code") NULLS NOT DISTINCT;
CREATE INDEX "parking_vehicle_types_ix_5ebae7db" ON "public"."parking_vehicle_types" USING btree ("is_active", "display_order");
CREATE INDEX "parking_vehicle_types_ix_91dbee2e" ON "public"."parking_vehicle_types" USING btree ("is_active");

REVOKE ALL ON "public"."parking_vehicle_types" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."parking_vehicle_types" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."payment_webhook_events" (
  "id" text COLLATE "C" PRIMARY KEY,
  "provider" text COLLATE "C",
  "event_id" text COLLATE "C",
  "event_type" text COLLATE "C",
  "order_id" text COLLATE "C",
  "payment_id" text COLLATE "C",
  "matched_module" text COLLATE "C",
  "status" text COLLATE "C",
  "processing_error" text COLLATE "C",
  "processed_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."payment_webhook_events" IS 'Tirvona model collection payment_webhook_events. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."payment_webhook_events"."event_id" IS 'model field: eventId';
COMMENT ON COLUMN "public"."payment_webhook_events"."event_type" IS 'model field: eventType';
COMMENT ON COLUMN "public"."payment_webhook_events"."order_id" IS 'model field: orderId';
COMMENT ON COLUMN "public"."payment_webhook_events"."payment_id" IS 'model field: paymentId';
COMMENT ON COLUMN "public"."payment_webhook_events"."matched_module" IS 'model field: matchedModule';
COMMENT ON COLUMN "public"."payment_webhook_events"."processing_error" IS 'model field: processingError';
COMMENT ON COLUMN "public"."payment_webhook_events"."processed_at" IS 'model field: processedAt';
COMMENT ON COLUMN "public"."payment_webhook_events"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."payment_webhook_events"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."payment_webhook_events"."version" IS 'model field: __v';
ALTER TABLE "public"."payment_webhook_events" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "payment_webhook_events_extra_5ffb0a43" ON "public"."payment_webhook_events" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "payment_webhook_events_uq_a62d30a9" ON "public"."payment_webhook_events" USING btree ("provider", "event_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."payment_webhook_events" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."payment_webhook_events" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."payments" (
  "id" text COLLATE "C" PRIMARY KEY,
  "version" double precision,
  "amount" double precision,
  "booking_id" text COLLATE "C",
  "created_at" timestamptz,
  "method" text COLLATE "C",
  "status" text COLLATE "C",
  "transaction_id" text COLLATE "C",
  "updated_at" timestamptz,
  "user_id" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."payments" IS 'Tirvona model collection payments. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."payments"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."payments"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."payments"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."payments"."transaction_id" IS 'model field: transactionId';
COMMENT ON COLUMN "public"."payments"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."payments"."user_id" IS 'model field: userId';
ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "payments_extra_aae213e8" ON "public"."payments" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "payments_uq_e6a70e8a" ON "public"."payments" USING btree ("transaction_id") NULLS NOT DISTINCT;
CREATE INDEX "payments_ix_caf0121a" ON "public"."payments" USING btree ("booking_id");

REVOKE ALL ON "public"."payments" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."payments" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."payout_audit_logs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "payout_id" text COLLATE "C",
  "bank_account_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "actor_id" text COLLATE "C",
  "action" text COLLATE "C",
  "before" jsonb,
  "after" jsonb,
  "request_id" text COLLATE "C",
  "occurred_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."payout_audit_logs" IS 'Tirvona model collection payout_audit_logs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."payout_audit_logs"."payout_id" IS 'model field: payoutId';
COMMENT ON COLUMN "public"."payout_audit_logs"."bank_account_id" IS 'model field: bankAccountId';
COMMENT ON COLUMN "public"."payout_audit_logs"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."payout_audit_logs"."actor_id" IS 'model field: actorId';
COMMENT ON COLUMN "public"."payout_audit_logs"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."payout_audit_logs"."occurred_at" IS 'model field: occurredAt';
COMMENT ON COLUMN "public"."payout_audit_logs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."payout_audit_logs"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."payout_audit_logs"."version" IS 'model field: __v';
ALTER TABLE "public"."payout_audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "payout_audit_logs_extra_406db037" ON "public"."payout_audit_logs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "payout_audit_logs_ix_c929bf0c" ON "public"."payout_audit_logs" USING btree ("ashram_id", "occurred_at" DESC NULLS LAST);
CREATE INDEX "payout_audit_logs_ix_aeb5fa6f" ON "public"."payout_audit_logs" USING btree ("payout_id", "occurred_at" DESC NULLS LAST);

REVOKE ALL ON "public"."payout_audit_logs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."payout_audit_logs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."payout_bank_accounts" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "account_holder_name" text COLLATE "C",
  "account_number_ciphertext" text COLLATE "C",
  "account_number_iv" text COLLATE "C",
  "account_number_tag" text COLLATE "C",
  "account_number_last4" text COLLATE "C",
  "account_fingerprint" text COLLATE "C",
  "ifsc" text COLLATE "C",
  "ifsc_prefix" text COLLATE "C",
  "beneficiary_email" text COLLATE "C",
  "beneficiary_phone" text COLLATE "C",
  "provider_contact_id" text COLLATE "C",
  "provider_fund_account_id" text COLLATE "C",
  "active" boolean,
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."payout_bank_accounts" IS 'Tirvona model collection payout_bank_accounts. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."payout_bank_accounts"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."payout_bank_accounts"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."payout_bank_accounts"."account_holder_name" IS 'model field: accountHolderName';
COMMENT ON COLUMN "public"."payout_bank_accounts"."account_number_ciphertext" IS 'model field: accountNumberCiphertext';
COMMENT ON COLUMN "public"."payout_bank_accounts"."account_number_iv" IS 'model field: accountNumberIv';
COMMENT ON COLUMN "public"."payout_bank_accounts"."account_number_tag" IS 'model field: accountNumberTag';
COMMENT ON COLUMN "public"."payout_bank_accounts"."account_number_last4" IS 'model field: accountNumberLast4';
COMMENT ON COLUMN "public"."payout_bank_accounts"."account_fingerprint" IS 'model field: accountFingerprint';
COMMENT ON COLUMN "public"."payout_bank_accounts"."ifsc_prefix" IS 'model field: ifscPrefix';
COMMENT ON COLUMN "public"."payout_bank_accounts"."beneficiary_email" IS 'model field: beneficiaryEmail';
COMMENT ON COLUMN "public"."payout_bank_accounts"."beneficiary_phone" IS 'model field: beneficiaryPhone';
COMMENT ON COLUMN "public"."payout_bank_accounts"."provider_contact_id" IS 'model field: providerContactId';
COMMENT ON COLUMN "public"."payout_bank_accounts"."provider_fund_account_id" IS 'model field: providerFundAccountId';
COMMENT ON COLUMN "public"."payout_bank_accounts"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."payout_bank_accounts"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."payout_bank_accounts"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."payout_bank_accounts"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."payout_bank_accounts"."version" IS 'model field: __v';
ALTER TABLE "public"."payout_bank_accounts" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "payout_bank_accounts_extra_9eb8e8c5" ON "public"."payout_bank_accounts" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "payout_bank_accounts_uq_db165a25" ON "public"."payout_bank_accounts" USING btree ("owner_id") NULLS NOT DISTINCT WHERE "active" = true;
CREATE INDEX "payout_bank_accounts_ix_fd2d3dbe" ON "public"."payout_bank_accounts" USING btree ("ashram_id", "active");
CREATE UNIQUE INDEX "payout_bank_accounts_uq_67e75346" ON "public"."payout_bank_accounts" USING btree ("ashram_id") NULLS NOT DISTINCT WHERE "active" = true;
CREATE INDEX "payout_bank_accounts_ix_504dfb39" ON "public"."payout_bank_accounts" USING btree ("owner_id", "active");

REVOKE ALL ON "public"."payout_bank_accounts" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."payout_bank_accounts" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."payout_requests" (
  "id" text COLLATE "C" PRIMARY KEY,
  "payout_reference" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "bank_account_id" text COLLATE "C",
  "commission_ids" jsonb,
  "amount" double precision,
  "currency" text COLLATE "C",
  "mode" text COLLATE "C",
  "status" text COLLATE "C",
  "client_request_id" text COLLATE "C",
  "provider_idempotency_key" text COLLATE "C",
  "provider" text COLLATE "C",
  "provider_payout_id" text COLLATE "C",
  "provider_status" text COLLATE "C",
  "provider_utr" text COLLATE "C",
  "settlement_method" text COLLATE "C",
  "manual_payment_reference" text COLLATE "C",
  "manual_payment_idempotency_key_hash" text COLLATE "C",
  "manual_payment_note" text COLLATE "C",
  "failure_reason" text COLLATE "C",
  "requested_by" text COLLATE "C",
  "processed_by" text COLLATE "C",
  "requested_at" timestamptz,
  "processing_at" timestamptz,
  "paid_at" timestamptz,
  "failed_at" timestamptz,
  "last_reconciled_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."payout_requests" IS 'Tirvona model collection payout_requests. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."payout_requests"."payout_reference" IS 'model field: payoutReference';
COMMENT ON COLUMN "public"."payout_requests"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."payout_requests"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."payout_requests"."bank_account_id" IS 'model field: bankAccountId';
COMMENT ON COLUMN "public"."payout_requests"."commission_ids" IS 'model field: commissionIds';
COMMENT ON COLUMN "public"."payout_requests"."client_request_id" IS 'model field: clientRequestId';
COMMENT ON COLUMN "public"."payout_requests"."provider_idempotency_key" IS 'model field: providerIdempotencyKey';
COMMENT ON COLUMN "public"."payout_requests"."provider_payout_id" IS 'model field: providerPayoutId';
COMMENT ON COLUMN "public"."payout_requests"."provider_status" IS 'model field: providerStatus';
COMMENT ON COLUMN "public"."payout_requests"."provider_utr" IS 'model field: providerUtr';
COMMENT ON COLUMN "public"."payout_requests"."settlement_method" IS 'model field: settlementMethod';
COMMENT ON COLUMN "public"."payout_requests"."manual_payment_reference" IS 'model field: manualPaymentReference';
COMMENT ON COLUMN "public"."payout_requests"."manual_payment_idempotency_key_hash" IS 'model field: manualPaymentIdempotencyKeyHash';
COMMENT ON COLUMN "public"."payout_requests"."manual_payment_note" IS 'model field: manualPaymentNote';
COMMENT ON COLUMN "public"."payout_requests"."failure_reason" IS 'model field: failureReason';
COMMENT ON COLUMN "public"."payout_requests"."requested_by" IS 'model field: requestedBy';
COMMENT ON COLUMN "public"."payout_requests"."processed_by" IS 'model field: processedBy';
COMMENT ON COLUMN "public"."payout_requests"."requested_at" IS 'model field: requestedAt';
COMMENT ON COLUMN "public"."payout_requests"."processing_at" IS 'model field: processingAt';
COMMENT ON COLUMN "public"."payout_requests"."paid_at" IS 'model field: paidAt';
COMMENT ON COLUMN "public"."payout_requests"."failed_at" IS 'model field: failedAt';
COMMENT ON COLUMN "public"."payout_requests"."last_reconciled_at" IS 'model field: lastReconciledAt';
COMMENT ON COLUMN "public"."payout_requests"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."payout_requests"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."payout_requests" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "payout_requests_extra_e5063786" ON "public"."payout_requests" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "payout_requests_uq_b0d0f06a" ON "public"."payout_requests" USING btree ("payout_reference") NULLS NOT DISTINCT;
CREATE INDEX "payout_requests_ix_20b3ed65" ON "public"."payout_requests" USING btree ("status");
CREATE UNIQUE INDEX "payout_requests_uq_f4bcf2d4" ON "public"."payout_requests" USING btree ("provider_idempotency_key") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "payout_requests_uq_fe229e8c" ON "public"."payout_requests" USING btree ("provider_payout_id") WHERE "provider_payout_id" IS NOT NULL;
CREATE UNIQUE INDEX "payout_requests_uq_15ce01fe" ON "public"."payout_requests" USING btree ("manual_payment_reference") WHERE "manual_payment_reference" IS NOT NULL;
CREATE UNIQUE INDEX "payout_requests_uq_f984b2bc" ON "public"."payout_requests" USING btree ("manual_payment_idempotency_key_hash") WHERE "manual_payment_idempotency_key_hash" IS NOT NULL;
CREATE UNIQUE INDEX "payout_requests_uq_81bf6567" ON "public"."payout_requests" USING btree ("requested_by", "client_request_id") NULLS NOT DISTINCT;
CREATE INDEX "payout_requests_ix_b58203d9" ON "public"."payout_requests" USING btree ("ashram_id", "status", "created_at" DESC NULLS LAST);
CREATE INDEX "payout_requests_ix_a1b792e0" ON "public"."payout_requests" USING btree ("owner_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."payout_requests" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."payout_requests" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."payout_transactions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "payout_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "type" text COLLATE "C",
  "amount" double precision,
  "status" text COLLATE "C",
  "provider_payout_id" text COLLATE "C",
  "idempotency_key_hash" text COLLATE "C",
  "details" jsonb,
  "occurred_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."payout_transactions" IS 'Tirvona model collection payout_transactions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."payout_transactions"."payout_id" IS 'model field: payoutId';
COMMENT ON COLUMN "public"."payout_transactions"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."payout_transactions"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."payout_transactions"."provider_payout_id" IS 'model field: providerPayoutId';
COMMENT ON COLUMN "public"."payout_transactions"."idempotency_key_hash" IS 'model field: idempotencyKeyHash';
COMMENT ON COLUMN "public"."payout_transactions"."occurred_at" IS 'model field: occurredAt';
COMMENT ON COLUMN "public"."payout_transactions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."payout_transactions"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."payout_transactions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "payout_transactions_extra_71a79efd" ON "public"."payout_transactions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "payout_transactions_ix_aeb5fa6f" ON "public"."payout_transactions" USING btree ("payout_id", "occurred_at" DESC NULLS LAST);

REVOKE ALL ON "public"."payout_transactions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."payout_transactions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."payout_webhooks" (
  "id" text COLLATE "C" PRIMARY KEY,
  "provider" text COLLATE "C",
  "event_id" text COLLATE "C",
  "event_type" text COLLATE "C",
  "provider_payout_id" text COLLATE "C",
  "status" text COLLATE "C",
  "error" text COLLATE "C",
  "processed_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."payout_webhooks" IS 'Tirvona model collection payout_webhooks. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."payout_webhooks"."event_id" IS 'model field: eventId';
COMMENT ON COLUMN "public"."payout_webhooks"."event_type" IS 'model field: eventType';
COMMENT ON COLUMN "public"."payout_webhooks"."provider_payout_id" IS 'model field: providerPayoutId';
COMMENT ON COLUMN "public"."payout_webhooks"."processed_at" IS 'model field: processedAt';
COMMENT ON COLUMN "public"."payout_webhooks"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."payout_webhooks"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."payout_webhooks" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "payout_webhooks_extra_35c33593" ON "public"."payout_webhooks" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "payout_webhooks_uq_a62d30a9" ON "public"."payout_webhooks" USING btree ("provider", "event_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."payout_webhooks" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."payout_webhooks" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."pilgrim_wallet_holds" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "module" text COLLATE "C",
  "source_id" text COLLATE "C",
  "amount" double precision,
  "reference" text COLLATE "C",
  "status" text COLLATE "C",
  "expires_at" timestamptz,
  "captured_at" timestamptz,
  "released_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."pilgrim_wallet_holds" IS 'Tirvona model collection pilgrim_wallet_holds. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."pilgrim_wallet_holds"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."pilgrim_wallet_holds"."source_id" IS 'model field: sourceId';
COMMENT ON COLUMN "public"."pilgrim_wallet_holds"."expires_at" IS 'model field: expiresAt';
COMMENT ON COLUMN "public"."pilgrim_wallet_holds"."captured_at" IS 'model field: capturedAt';
COMMENT ON COLUMN "public"."pilgrim_wallet_holds"."released_at" IS 'model field: releasedAt';
COMMENT ON COLUMN "public"."pilgrim_wallet_holds"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."pilgrim_wallet_holds"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."pilgrim_wallet_holds" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "pilgrim_wallet_holds_extra_9579a209" ON "public"."pilgrim_wallet_holds" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "pilgrim_wallet_holds_ix_20b3ed65" ON "public"."pilgrim_wallet_holds" USING btree ("status");
CREATE UNIQUE INDEX "pilgrim_wallet_holds_uq_8d82aed8" ON "public"."pilgrim_wallet_holds" USING btree ("module", "source_id") NULLS NOT DISTINCT WHERE "status" = 'held';
CREATE INDEX "pilgrim_wallet_holds_ix_adc8130b" ON "public"."pilgrim_wallet_holds" USING btree ("status", "expires_at");

REVOKE ALL ON "public"."pilgrim_wallet_holds" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."pilgrim_wallet_holds" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."pilgrim_wallet_transactions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "wallet_id" text COLLATE "C",
  "user_id" text COLLATE "C",
  "type" text COLLATE "C",
  "category" text COLLATE "C",
  "amount" double precision,
  "balance_after" double precision,
  "module" text COLLATE "C",
  "source_id" text COLLATE "C",
  "reference" text COLLATE "C",
  "description" text COLLATE "C",
  "idempotency_key" text COLLATE "C",
  "actor_id" text COLLATE "C",
  "actor_role" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."pilgrim_wallet_transactions" IS 'Tirvona model collection pilgrim_wallet_transactions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."pilgrim_wallet_transactions"."wallet_id" IS 'model field: walletId';
COMMENT ON COLUMN "public"."pilgrim_wallet_transactions"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."pilgrim_wallet_transactions"."balance_after" IS 'model field: balanceAfter';
COMMENT ON COLUMN "public"."pilgrim_wallet_transactions"."source_id" IS 'model field: sourceId';
COMMENT ON COLUMN "public"."pilgrim_wallet_transactions"."idempotency_key" IS 'model field: idempotencyKey';
COMMENT ON COLUMN "public"."pilgrim_wallet_transactions"."actor_id" IS 'model field: actorId';
COMMENT ON COLUMN "public"."pilgrim_wallet_transactions"."actor_role" IS 'model field: actorRole';
COMMENT ON COLUMN "public"."pilgrim_wallet_transactions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."pilgrim_wallet_transactions"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."pilgrim_wallet_transactions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "pilgrim_wallet_transactions_extra_522e4ce1" ON "public"."pilgrim_wallet_transactions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "pilgrim_wallet_transactions_ix_fd6afe8d" ON "public"."pilgrim_wallet_transactions" USING btree ("user_id");
CREATE UNIQUE INDEX "pilgrim_wallet_transactions_uq_543acea5" ON "public"."pilgrim_wallet_transactions" USING btree ("idempotency_key") NULLS NOT DISTINCT;
CREATE INDEX "pilgrim_wallet_transactions_ix_53637f3b" ON "public"."pilgrim_wallet_transactions" USING btree ("user_id", "created_at" DESC NULLS LAST);
CREATE INDEX "pilgrim_wallet_transactions_ix_add8943a" ON "public"."pilgrim_wallet_transactions" USING btree ("category", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."pilgrim_wallet_transactions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."pilgrim_wallet_transactions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."pilgrim_wallet_withdrawals" (
  "id" text COLLATE "C" PRIMARY KEY,
  "request_number" text COLLATE "C",
  "user_id" text COLLATE "C",
  "amount" double precision,
  "method" text COLLATE "C",
  "account_holder_name" text COLLATE "C",
  "account_number" text COLLATE "C",
  "ifsc" text COLLATE "C",
  "bank_name" text COLLATE "C",
  "upi_id" text COLLATE "C",
  "customer_note" text COLLATE "C",
  "status" text COLLATE "C",
  "admin_note" text COLLATE "C",
  "rejection_reason" text COLLATE "C",
  "payout_reference" text COLLATE "C",
  "reviewed_by" text COLLATE "C",
  "reviewed_at" timestamptz,
  "paid_by" text COLLATE "C",
  "paid_at" timestamptz,
  "cancelled_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."pilgrim_wallet_withdrawals" IS 'Tirvona model collection pilgrim_wallet_withdrawals. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."request_number" IS 'model field: requestNumber';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."account_holder_name" IS 'model field: accountHolderName';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."account_number" IS 'model field: accountNumber';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."bank_name" IS 'model field: bankName';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."upi_id" IS 'model field: upiId';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."customer_note" IS 'model field: customerNote';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."admin_note" IS 'model field: adminNote';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."payout_reference" IS 'model field: payoutReference';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."reviewed_by" IS 'model field: reviewedBy';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."reviewed_at" IS 'model field: reviewedAt';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."paid_by" IS 'model field: paidBy';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."paid_at" IS 'model field: paidAt';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."cancelled_at" IS 'model field: cancelledAt';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."pilgrim_wallet_withdrawals"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."pilgrim_wallet_withdrawals" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "pilgrim_wallet_withdrawals_extra_c4f4d725" ON "public"."pilgrim_wallet_withdrawals" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "pilgrim_wallet_withdrawals_uq_a4471348" ON "public"."pilgrim_wallet_withdrawals" USING btree ("request_number") NULLS NOT DISTINCT;
CREATE INDEX "pilgrim_wallet_withdrawals_ix_fd6afe8d" ON "public"."pilgrim_wallet_withdrawals" USING btree ("user_id");
CREATE INDEX "pilgrim_wallet_withdrawals_ix_20b3ed65" ON "public"."pilgrim_wallet_withdrawals" USING btree ("status");
CREATE INDEX "pilgrim_wallet_withdrawals_ix_82abfc2f" ON "public"."pilgrim_wallet_withdrawals" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "pilgrim_wallet_withdrawals_ix_53637f3b" ON "public"."pilgrim_wallet_withdrawals" USING btree ("user_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."pilgrim_wallet_withdrawals" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."pilgrim_wallet_withdrawals" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."pilgrim_wallets" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "balance" double precision,
  "held_amount" double precision,
  "pending_withdrawal" double precision,
  "total_credited" double precision,
  "total_spent" double precision,
  "total_withdrawn" double precision,
  "currency" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."pilgrim_wallets" IS 'Tirvona model collection pilgrim_wallets. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."pilgrim_wallets"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."pilgrim_wallets"."held_amount" IS 'model field: heldAmount';
COMMENT ON COLUMN "public"."pilgrim_wallets"."pending_withdrawal" IS 'model field: pendingWithdrawal';
COMMENT ON COLUMN "public"."pilgrim_wallets"."total_credited" IS 'model field: totalCredited';
COMMENT ON COLUMN "public"."pilgrim_wallets"."total_spent" IS 'model field: totalSpent';
COMMENT ON COLUMN "public"."pilgrim_wallets"."total_withdrawn" IS 'model field: totalWithdrawn';
COMMENT ON COLUMN "public"."pilgrim_wallets"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."pilgrim_wallets"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."pilgrim_wallets" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "pilgrim_wallets_extra_aa085f91" ON "public"."pilgrim_wallets" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "pilgrim_wallets_uq_164fe85a" ON "public"."pilgrim_wallets" USING btree ("user_id") NULLS NOT DISTINCT;
CREATE INDEX "pilgrim_wallets_ix_7ee899e7" ON "public"."pilgrim_wallets" USING btree ("balance" DESC NULLS LAST);

REVOKE ALL ON "public"."pilgrim_wallets" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."pilgrim_wallets" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."pilgrimage_circuits" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "name" text COLLATE "C",
  "slug" text COLLATE "C",
  "circuit_type" text COLLATE "C",
  "summary" text COLLATE "C",
  "description" text COLLATE "C",
  "highlights" jsonb,
  "images" jsonb,
  "cover_image" text COLLATE "C",
  "start_city" text COLLATE "C",
  "end_city" text COLLATE "C",
  "state" text COLLATE "C",
  "region" text COLLATE "C",
  "duration_days" double precision,
  "total_distance_km" double precision,
  "difficulty" text COLLATE "C",
  "best_seasons" jsonb,
  "ideal_for" jsonb,
  "travel_tips" text COLLATE "C",
  "usable_as_planner_template" boolean,
  "is_featured" boolean,
  "status" text COLLATE "C",
  "submitted_at" timestamptz,
  "approved_at" timestamptz,
  "approved_by" text COLLATE "C",
  "rejection_reason" text COLLATE "C",
  "stop_count" double precision,
  "view_count" double precision,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."pilgrimage_circuits" IS 'Tirvona model collection pilgrimage_circuits. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."circuit_type" IS 'model field: circuitType';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."start_city" IS 'model field: startCity';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."end_city" IS 'model field: endCity';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."duration_days" IS 'model field: durationDays';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."total_distance_km" IS 'model field: totalDistanceKm';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."best_seasons" IS 'model field: bestSeasons';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."ideal_for" IS 'model field: idealFor';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."travel_tips" IS 'model field: travelTips';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."usable_as_planner_template" IS 'model field: usableAsPlannerTemplate';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."is_featured" IS 'model field: isFeatured';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."submitted_at" IS 'model field: submittedAt';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."approved_at" IS 'model field: approvedAt';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."approved_by" IS 'model field: approvedBy';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."stop_count" IS 'model field: stopCount';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."view_count" IS 'model field: viewCount';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."pilgrimage_circuits"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."pilgrimage_circuits" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "pilgrimage_circuits_extra_d1759694" ON "public"."pilgrimage_circuits" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "pilgrimage_circuits_ix_4c90543b" ON "public"."pilgrimage_circuits" USING btree ("ashram_id");
CREATE INDEX "pilgrimage_circuits_ix_8f882ef5" ON "public"."pilgrimage_circuits" USING btree ("owner_id");
CREATE UNIQUE INDEX "pilgrimage_circuits_uq_7a0923dd" ON "public"."pilgrimage_circuits" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "pilgrimage_circuits_ix_308cb9d5" ON "public"."pilgrimage_circuits" USING btree ("circuit_type");
CREATE INDEX "pilgrimage_circuits_ix_7df70195" ON "public"."pilgrimage_circuits" USING btree ("start_city");
CREATE INDEX "pilgrimage_circuits_ix_c92df131" ON "public"."pilgrimage_circuits" USING btree ("state");
CREATE INDEX "pilgrimage_circuits_ix_9db002d8" ON "public"."pilgrimage_circuits" USING btree ("difficulty");
CREATE INDEX "pilgrimage_circuits_ix_eb6045d6" ON "public"."pilgrimage_circuits" USING btree ("usable_as_planner_template");
CREATE INDEX "pilgrimage_circuits_ix_d5e5ae6e" ON "public"."pilgrimage_circuits" USING btree ("is_featured");
CREATE INDEX "pilgrimage_circuits_ix_20b3ed65" ON "public"."pilgrimage_circuits" USING btree ("status");
CREATE INDEX "pilgrimage_circuits_ix_defbfda4" ON "public"."pilgrimage_circuits" USING btree ("status", "is_featured" DESC NULLS LAST, "created_at" DESC NULLS LAST);
CREATE INDEX "pilgrimage_circuits_ix_20e39220" ON "public"."pilgrimage_circuits" USING btree ("ashram_id", "status");
CREATE INDEX "pilgrimage_circuits_ix_6456a058" ON "public"."pilgrimage_circuits" USING btree ("status", "duration_days");
CREATE INDEX "pilgrimage_circuits_ix_f349009c" ON "public"."pilgrimage_circuits" USING btree ("owner_id", "status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."pilgrimage_circuits" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."pilgrimage_circuits" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."pilgrimage_itineraries" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "circuit_id" text COLLATE "C",
  "title" text COLLATE "C",
  "start_date" timestamptz,
  "travellers" double precision,
  "pace" text COLLATE "C",
  "days" jsonb,
  "notes" text COLLATE "C",
  "status" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."pilgrimage_itineraries" IS 'Tirvona model collection pilgrimage_itineraries. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."pilgrimage_itineraries"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."pilgrimage_itineraries"."circuit_id" IS 'model field: circuitId';
COMMENT ON COLUMN "public"."pilgrimage_itineraries"."start_date" IS 'model field: startDate';
COMMENT ON COLUMN "public"."pilgrimage_itineraries"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."pilgrimage_itineraries"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."pilgrimage_itineraries" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "pilgrimage_itineraries_extra_023325d2" ON "public"."pilgrimage_itineraries" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "pilgrimage_itineraries_ix_fd6afe8d" ON "public"."pilgrimage_itineraries" USING btree ("user_id");
CREATE INDEX "pilgrimage_itineraries_ix_20b3ed65" ON "public"."pilgrimage_itineraries" USING btree ("status");
CREATE INDEX "pilgrimage_itineraries_ix_53637f3b" ON "public"."pilgrimage_itineraries" USING btree ("user_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."pilgrimage_itineraries" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."pilgrimage_itineraries" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."pilgrimage_settings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "scope" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "circuit_id" text COLLATE "C",
  "max_duration_days" double precision,
  "max_stops_per_circuit" double precision,
  "default_pace_stops_per_day" double precision,
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."pilgrimage_settings" IS 'Tirvona model collection pilgrimage_settings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."pilgrimage_settings"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."pilgrimage_settings"."circuit_id" IS 'model field: circuitId';
COMMENT ON COLUMN "public"."pilgrimage_settings"."max_duration_days" IS 'model field: maxDurationDays';
COMMENT ON COLUMN "public"."pilgrimage_settings"."max_stops_per_circuit" IS 'model field: maxStopsPerCircuit';
COMMENT ON COLUMN "public"."pilgrimage_settings"."default_pace_stops_per_day" IS 'model field: defaultPaceStopsPerDay';
COMMENT ON COLUMN "public"."pilgrimage_settings"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."pilgrimage_settings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."pilgrimage_settings"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."pilgrimage_settings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "pilgrimage_settings_extra_5d03944f" ON "public"."pilgrimage_settings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "pilgrimage_settings_ix_5cee787c" ON "public"."pilgrimage_settings" USING btree ("scope");
CREATE INDEX "pilgrimage_settings_ix_5c20efae" ON "public"."pilgrimage_settings" USING btree ("scope", "ashram_id", "circuit_id");

REVOKE ALL ON "public"."pilgrimage_settings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."pilgrimage_settings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."pilgrimage_stops" (
  "id" text COLLATE "C" PRIMARY KEY,
  "circuit_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "day_number" double precision,
  "order" double precision,
  "name" text COLLATE "C",
  "stop_type" text COLLATE "C",
  "temple_slug" text COLLATE "C",
  "linked_ashram_id" text COLLATE "C",
  "city" text COLLATE "C",
  "state" text COLLATE "C",
  "latitude" double precision,
  "longitude" double precision,
  "google_maps_url" text COLLATE "C",
  "distance_from_previous_km" double precision,
  "travel_minutes" double precision,
  "suggested_duration_minutes" double precision,
  "arrival_time" text COLLATE "C",
  "notes" text COLLATE "C",
  "images" jsonb,
  "is_overnight_stop" boolean,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."pilgrimage_stops" IS 'Tirvona model collection pilgrimage_stops. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."pilgrimage_stops"."circuit_id" IS 'model field: circuitId';
COMMENT ON COLUMN "public"."pilgrimage_stops"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."pilgrimage_stops"."day_number" IS 'model field: dayNumber';
COMMENT ON COLUMN "public"."pilgrimage_stops"."stop_type" IS 'model field: stopType';
COMMENT ON COLUMN "public"."pilgrimage_stops"."temple_slug" IS 'model field: templeSlug';
COMMENT ON COLUMN "public"."pilgrimage_stops"."linked_ashram_id" IS 'model field: linkedAshramId';
COMMENT ON COLUMN "public"."pilgrimage_stops"."google_maps_url" IS 'model field: googleMapsUrl';
COMMENT ON COLUMN "public"."pilgrimage_stops"."distance_from_previous_km" IS 'model field: distanceFromPreviousKm';
COMMENT ON COLUMN "public"."pilgrimage_stops"."travel_minutes" IS 'model field: travelMinutes';
COMMENT ON COLUMN "public"."pilgrimage_stops"."suggested_duration_minutes" IS 'model field: suggestedDurationMinutes';
COMMENT ON COLUMN "public"."pilgrimage_stops"."arrival_time" IS 'model field: arrivalTime';
COMMENT ON COLUMN "public"."pilgrimage_stops"."is_overnight_stop" IS 'model field: isOvernightStop';
COMMENT ON COLUMN "public"."pilgrimage_stops"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."pilgrimage_stops"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."pilgrimage_stops" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "pilgrimage_stops_extra_c85f6818" ON "public"."pilgrimage_stops" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "pilgrimage_stops_ix_65860fbd" ON "public"."pilgrimage_stops" USING btree ("circuit_id");
CREATE INDEX "pilgrimage_stops_ix_2f54a3b7" ON "public"."pilgrimage_stops" USING btree ("day_number");
CREATE INDEX "pilgrimage_stops_ix_b84d14cf" ON "public"."pilgrimage_stops" USING btree ("circuit_id", "day_number", "order");

REVOKE ALL ON "public"."pilgrimage_stops" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."pilgrimage_stops" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."pilgrimagecircuits" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "budget_range" text COLLATE "C",
  "circuit_type" text COLLATE "C",
  "cover_image" text COLLATE "C",
  "description" text COLLATE "C",
  "distance" text COLLATE "C",
  "duration" text COLLATE "C",
  "featured" boolean,
  "gallery" text[] COLLATE "C",
  "nearby_stay_count" double precision,
  "rating" double precision,
  "recommended_season" text COLLATE "C",
  "reviews_count" double precision,
  "slug" text COLLATE "C",
  "status" text COLLATE "C",
  "stops" jsonb,
  "title" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."pilgrimagecircuits" IS 'Tirvona model collection pilgrimagecircuits. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."pilgrimagecircuits"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."pilgrimagecircuits"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."pilgrimagecircuits"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."pilgrimagecircuits"."budget_range" IS 'model field: budgetRange';
COMMENT ON COLUMN "public"."pilgrimagecircuits"."circuit_type" IS 'model field: circuitType';
COMMENT ON COLUMN "public"."pilgrimagecircuits"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."pilgrimagecircuits"."nearby_stay_count" IS 'model field: nearbyStayCount';
COMMENT ON COLUMN "public"."pilgrimagecircuits"."recommended_season" IS 'model field: recommendedSeason';
COMMENT ON COLUMN "public"."pilgrimagecircuits"."reviews_count" IS 'model field: reviewsCount';
ALTER TABLE "public"."pilgrimagecircuits" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "pilgrimagecircuits_extra_1e5fd1ac" ON "public"."pilgrimagecircuits" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "pilgrimagecircuits_ix_596e96bd" ON "public"."pilgrimagecircuits" USING btree ("status", "circuit_type");
CREATE UNIQUE INDEX "pilgrimagecircuits_uq_7a0923dd" ON "public"."pilgrimagecircuits" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "pilgrimagecircuits_ix_82abfc2f" ON "public"."pilgrimagecircuits" USING btree ("status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."pilgrimagecircuits" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."pilgrimagecircuits" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."plannertemplates" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "best_season" text COLLATE "C",
  "crowd_level" text COLLATE "C",
  "day_plans" jsonb,
  "destination" text COLLATE "C",
  "duration_days" double precision,
  "estimated_cost_per_person" double precision,
  "packing_list" text[] COLLATE "C",
  "purpose" text COLLATE "C",
  "slug" text COLLATE "C",
  "status" text COLLATE "C",
  "total_distance" text COLLATE "C",
  "weather" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."plannertemplates" IS 'Tirvona model collection plannertemplates. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."plannertemplates"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."plannertemplates"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."plannertemplates"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."plannertemplates"."best_season" IS 'model field: bestSeason';
COMMENT ON COLUMN "public"."plannertemplates"."crowd_level" IS 'model field: crowdLevel';
COMMENT ON COLUMN "public"."plannertemplates"."day_plans" IS 'model field: dayPlans';
COMMENT ON COLUMN "public"."plannertemplates"."duration_days" IS 'model field: durationDays';
COMMENT ON COLUMN "public"."plannertemplates"."estimated_cost_per_person" IS 'model field: estimatedCostPerPerson';
COMMENT ON COLUMN "public"."plannertemplates"."packing_list" IS 'model field: packingList';
COMMENT ON COLUMN "public"."plannertemplates"."total_distance" IS 'model field: totalDistance';
ALTER TABLE "public"."plannertemplates" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "plannertemplates_extra_86fc1930" ON "public"."plannertemplates" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "plannertemplates_uq_7a0923dd" ON "public"."plannertemplates" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "plannertemplates_ix_82abfc2f" ON "public"."plannertemplates" USING btree ("status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."plannertemplates" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."plannertemplates" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."platform_settings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "key" text COLLATE "C",
  "platform_fee" jsonb,
  "gst_rate" double precision,
  "platform_fee_gst_rate" double precision,
  "booking_commission_percent" double precision,
  "notification_sound" jsonb,
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."platform_settings" IS 'Tirvona model collection platform_settings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."platform_settings"."platform_fee" IS 'model field: platformFee';
COMMENT ON COLUMN "public"."platform_settings"."gst_rate" IS 'model field: gstRate';
COMMENT ON COLUMN "public"."platform_settings"."platform_fee_gst_rate" IS 'model field: platformFeeGstRate';
COMMENT ON COLUMN "public"."platform_settings"."booking_commission_percent" IS 'model field: bookingCommissionPercent';
COMMENT ON COLUMN "public"."platform_settings"."notification_sound" IS 'model field: notificationSound';
COMMENT ON COLUMN "public"."platform_settings"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."platform_settings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."platform_settings"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."platform_settings"."version" IS 'model field: __v';
ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "platform_settings_extra_6b56780c" ON "public"."platform_settings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "platform_settings_uq_d562d510" ON "public"."platform_settings" USING btree ("key") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."platform_settings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."platform_settings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."platformsettings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "version" double precision,
  "created_at" timestamptz,
  "gst_rate" double precision,
  "key" text COLLATE "C",
  "platform_fee" jsonb,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."platformsettings" IS 'Tirvona model collection platformsettings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."platformsettings"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."platformsettings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."platformsettings"."gst_rate" IS 'model field: gstRate';
COMMENT ON COLUMN "public"."platformsettings"."platform_fee" IS 'model field: platformFee';
COMMENT ON COLUMN "public"."platformsettings"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."platformsettings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "platformsettings_extra_61e4618f" ON "public"."platformsettings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "platformsettings_uq_d562d510" ON "public"."platformsettings" USING btree ("key") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."platformsettings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."platformsettings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."push_campaigns" (
  "id" text COLLATE "C" PRIMARY KEY,
  "sender_id" text COLLATE "C",
  "title" text COLLATE "C",
  "body" text COLLATE "C",
  "image_url" text COLLATE "C",
  "deep_link" text COLLATE "C",
  "audience_type" text COLLATE "C",
  "target_roles" jsonb,
  "target_user_ids" jsonb,
  "target_ashram_ids" jsonb,
  "recipient_count" double precision,
  "sent_count" double precision,
  "failed_count" double precision,
  "status" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."push_campaigns" IS 'Tirvona model collection push_campaigns. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."push_campaigns"."sender_id" IS 'model field: senderId';
COMMENT ON COLUMN "public"."push_campaigns"."image_url" IS 'model field: imageUrl';
COMMENT ON COLUMN "public"."push_campaigns"."deep_link" IS 'model field: deepLink';
COMMENT ON COLUMN "public"."push_campaigns"."audience_type" IS 'model field: audienceType';
COMMENT ON COLUMN "public"."push_campaigns"."target_roles" IS 'model field: targetRoles';
COMMENT ON COLUMN "public"."push_campaigns"."target_user_ids" IS 'model field: targetUserIds';
COMMENT ON COLUMN "public"."push_campaigns"."target_ashram_ids" IS 'model field: targetAshramIds';
COMMENT ON COLUMN "public"."push_campaigns"."recipient_count" IS 'model field: recipientCount';
COMMENT ON COLUMN "public"."push_campaigns"."sent_count" IS 'model field: sentCount';
COMMENT ON COLUMN "public"."push_campaigns"."failed_count" IS 'model field: failedCount';
COMMENT ON COLUMN "public"."push_campaigns"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."push_campaigns"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."push_campaigns"."version" IS 'model field: __v';
ALTER TABLE "public"."push_campaigns" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "push_campaigns_extra_e444fe19" ON "public"."push_campaigns" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "push_campaigns_ix_88e89a54" ON "public"."push_campaigns" USING btree ("sender_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."push_campaigns" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."push_campaigns" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."refund_audit_logs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "request_id" text COLLATE "C",
  "policy_id" text COLLATE "C",
  "action" text COLLATE "C",
  "actor_id" text COLLATE "C",
  "actor_whats_app_customer_id" text COLLATE "C",
  "actor_role" text COLLATE "C",
  "before" jsonb,
  "after" jsonb,
  "ip_address" text COLLATE "C",
  "user_agent" text COLLATE "C",
  "request_id_header" text COLLATE "C",
  "occurred_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."refund_audit_logs" IS 'Tirvona model collection refund_audit_logs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."refund_audit_logs"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."refund_audit_logs"."policy_id" IS 'model field: policyId';
COMMENT ON COLUMN "public"."refund_audit_logs"."actor_id" IS 'model field: actorId';
COMMENT ON COLUMN "public"."refund_audit_logs"."actor_whats_app_customer_id" IS 'model field: actorWhatsAppCustomerId';
COMMENT ON COLUMN "public"."refund_audit_logs"."actor_role" IS 'model field: actorRole';
COMMENT ON COLUMN "public"."refund_audit_logs"."ip_address" IS 'model field: ipAddress';
COMMENT ON COLUMN "public"."refund_audit_logs"."user_agent" IS 'model field: userAgent';
COMMENT ON COLUMN "public"."refund_audit_logs"."request_id_header" IS 'model field: requestIdHeader';
COMMENT ON COLUMN "public"."refund_audit_logs"."occurred_at" IS 'model field: occurredAt';
COMMENT ON COLUMN "public"."refund_audit_logs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."refund_audit_logs"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."refund_audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "refund_audit_logs_extra_36660de2" ON "public"."refund_audit_logs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "refund_audit_logs_ix_02cfbbe7" ON "public"."refund_audit_logs" USING btree ("action");
CREATE INDEX "refund_audit_logs_ix_8e3be854" ON "public"."refund_audit_logs" USING btree ("occurred_at");
CREATE INDEX "refund_audit_logs_ix_9ec79cdb" ON "public"."refund_audit_logs" USING btree ("request_id", "occurred_at" DESC NULLS LAST);
CREATE INDEX "refund_audit_logs_ix_916bf20b" ON "public"."refund_audit_logs" USING btree ("action", "occurred_at" DESC NULLS LAST);

REVOKE ALL ON "public"."refund_audit_logs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."refund_audit_logs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."refund_calculations" (
  "id" text COLLATE "C" PRIMARY KEY,
  "request_id" text COLLATE "C",
  "policy_id" text COLLATE "C",
  "policy_snapshot" jsonb,
  "original_amount" double precision,
  "amount_paid" double precision,
  "breakdown" jsonb,
  "refundable_components" jsonb,
  "applied_window" jsonb,
  "hours_before_service" double precision,
  "refund_percent" double precision,
  "gross_refundable" double precision,
  "processing_fee" double precision,
  "net_refundable" double precision,
  "non_refundable_amount" double precision,
  "currency" text COLLATE "C",
  "notes" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."refund_calculations" IS 'Tirvona model collection refund_calculations. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."refund_calculations"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."refund_calculations"."policy_id" IS 'model field: policyId';
COMMENT ON COLUMN "public"."refund_calculations"."policy_snapshot" IS 'model field: policySnapshot';
COMMENT ON COLUMN "public"."refund_calculations"."original_amount" IS 'model field: originalAmount';
COMMENT ON COLUMN "public"."refund_calculations"."amount_paid" IS 'model field: amountPaid';
COMMENT ON COLUMN "public"."refund_calculations"."refundable_components" IS 'model field: refundableComponents';
COMMENT ON COLUMN "public"."refund_calculations"."applied_window" IS 'model field: appliedWindow';
COMMENT ON COLUMN "public"."refund_calculations"."hours_before_service" IS 'model field: hoursBeforeService';
COMMENT ON COLUMN "public"."refund_calculations"."refund_percent" IS 'model field: refundPercent';
COMMENT ON COLUMN "public"."refund_calculations"."gross_refundable" IS 'model field: grossRefundable';
COMMENT ON COLUMN "public"."refund_calculations"."processing_fee" IS 'model field: processingFee';
COMMENT ON COLUMN "public"."refund_calculations"."net_refundable" IS 'model field: netRefundable';
COMMENT ON COLUMN "public"."refund_calculations"."non_refundable_amount" IS 'model field: nonRefundableAmount';
COMMENT ON COLUMN "public"."refund_calculations"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."refund_calculations"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."refund_calculations" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "refund_calculations_extra_3393803e" ON "public"."refund_calculations" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "refund_calculations_uq_36e5cac1" ON "public"."refund_calculations" USING btree ("request_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."refund_calculations" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."refund_calculations" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."refund_documents" (
  "id" text COLLATE "C" PRIMARY KEY,
  "request_id" text COLLATE "C",
  "label" text COLLATE "C",
  "url" text COLLATE "C",
  "mime_type" text COLLATE "C",
  "size_bytes" double precision,
  "uploaded_by" text COLLATE "C",
  "is_deleted" boolean,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."refund_documents" IS 'Tirvona model collection refund_documents. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."refund_documents"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."refund_documents"."mime_type" IS 'model field: mimeType';
COMMENT ON COLUMN "public"."refund_documents"."size_bytes" IS 'model field: sizeBytes';
COMMENT ON COLUMN "public"."refund_documents"."uploaded_by" IS 'model field: uploadedBy';
COMMENT ON COLUMN "public"."refund_documents"."is_deleted" IS 'model field: isDeleted';
COMMENT ON COLUMN "public"."refund_documents"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."refund_documents"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."refund_documents" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "refund_documents_extra_601defa3" ON "public"."refund_documents" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "refund_documents_ix_64ce922b" ON "public"."refund_documents" USING btree ("request_id", "is_deleted");

REVOKE ALL ON "public"."refund_documents" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."refund_documents" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."refund_policies" (
  "id" text COLLATE "C" PRIMARY KEY,
  "name" text COLLATE "C",
  "description" text COLLATE "C",
  "module" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "is_active" boolean,
  "priority" double precision,
  "cancellation_windows" jsonb,
  "default_refund_percent" double precision,
  "processing_fee" jsonb,
  "refund_platform_fee" boolean,
  "refund_gst" boolean,
  "refund_add_ons" boolean,
  "refund_donation" boolean,
  "auto_approve_below" double precision,
  "requires_second_approval_above" double precision,
  "claim_window_hours" double precision,
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "is_deleted" boolean,
  "deleted_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."refund_policies" IS 'Tirvona model collection refund_policies. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."refund_policies"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."refund_policies"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."refund_policies"."cancellation_windows" IS 'model field: cancellationWindows';
COMMENT ON COLUMN "public"."refund_policies"."default_refund_percent" IS 'model field: defaultRefundPercent';
COMMENT ON COLUMN "public"."refund_policies"."processing_fee" IS 'model field: processingFee';
COMMENT ON COLUMN "public"."refund_policies"."refund_platform_fee" IS 'model field: refundPlatformFee';
COMMENT ON COLUMN "public"."refund_policies"."refund_gst" IS 'model field: refundGst';
COMMENT ON COLUMN "public"."refund_policies"."refund_add_ons" IS 'model field: refundAddOns';
COMMENT ON COLUMN "public"."refund_policies"."refund_donation" IS 'model field: refundDonation';
COMMENT ON COLUMN "public"."refund_policies"."auto_approve_below" IS 'model field: autoApproveBelow';
COMMENT ON COLUMN "public"."refund_policies"."requires_second_approval_above" IS 'model field: requiresSecondApprovalAbove';
COMMENT ON COLUMN "public"."refund_policies"."claim_window_hours" IS 'model field: claimWindowHours';
COMMENT ON COLUMN "public"."refund_policies"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."refund_policies"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."refund_policies"."is_deleted" IS 'model field: isDeleted';
COMMENT ON COLUMN "public"."refund_policies"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."refund_policies"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."refund_policies"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."refund_policies" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "refund_policies_extra_5db84ac6" ON "public"."refund_policies" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "refund_policies_ix_0fd3975b" ON "public"."refund_policies" USING btree ("module");
CREATE INDEX "refund_policies_ix_91dbee2e" ON "public"."refund_policies" USING btree ("is_active");
CREATE INDEX "refund_policies_ix_54066c43" ON "public"."refund_policies" USING btree ("is_deleted");
CREATE INDEX "refund_policies_ix_a0a926b7" ON "public"."refund_policies" USING btree ("module", "ashram_id", "is_active", "is_deleted");
CREATE INDEX "refund_policies_ix_50d9655c" ON "public"."refund_policies" USING btree ("module", "priority" DESC NULLS LAST);

REVOKE ALL ON "public"."refund_policies" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."refund_policies" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."refund_requests" (
  "id" text COLLATE "C" PRIMARY KEY,
  "refund_number" text COLLATE "C",
  "module" text COLLATE "C",
  "source_id" text COLLATE "C",
  "source_reference" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "reason" text COLLATE "C",
  "customer_note" text COLLATE "C",
  "requested_amount" double precision,
  "status" text COLLATE "C",
  "calculation_id" text COLLATE "C",
  "policy_id" text COLLATE "C",
  "requested_by" text COLLATE "C",
  "requested_by_whats_app_customer_id" text COLLATE "C",
  "reviewed_by" text COLLATE "C",
  "reviewed_at" timestamptz,
  "approved_by" text COLLATE "C",
  "approved_at" timestamptz,
  "second_approved_by" text COLLATE "C",
  "rejected_by" text COLLATE "C",
  "rejected_at" timestamptz,
  "rejection_reason" text COLLATE "C",
  "auto_approved" boolean,
  "settled_at" timestamptz,
  "is_deleted" boolean,
  "deleted_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."refund_requests" IS 'Tirvona model collection refund_requests. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."refund_requests"."refund_number" IS 'model field: refundNumber';
COMMENT ON COLUMN "public"."refund_requests"."source_id" IS 'model field: sourceId';
COMMENT ON COLUMN "public"."refund_requests"."source_reference" IS 'model field: sourceReference';
COMMENT ON COLUMN "public"."refund_requests"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."refund_requests"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."refund_requests"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."refund_requests"."customer_note" IS 'model field: customerNote';
COMMENT ON COLUMN "public"."refund_requests"."requested_amount" IS 'model field: requestedAmount';
COMMENT ON COLUMN "public"."refund_requests"."calculation_id" IS 'model field: calculationId';
COMMENT ON COLUMN "public"."refund_requests"."policy_id" IS 'model field: policyId';
COMMENT ON COLUMN "public"."refund_requests"."requested_by" IS 'model field: requestedBy';
COMMENT ON COLUMN "public"."refund_requests"."requested_by_whats_app_customer_id" IS 'model field: requestedByWhatsAppCustomerId';
COMMENT ON COLUMN "public"."refund_requests"."reviewed_by" IS 'model field: reviewedBy';
COMMENT ON COLUMN "public"."refund_requests"."reviewed_at" IS 'model field: reviewedAt';
COMMENT ON COLUMN "public"."refund_requests"."approved_by" IS 'model field: approvedBy';
COMMENT ON COLUMN "public"."refund_requests"."approved_at" IS 'model field: approvedAt';
COMMENT ON COLUMN "public"."refund_requests"."second_approved_by" IS 'model field: secondApprovedBy';
COMMENT ON COLUMN "public"."refund_requests"."rejected_by" IS 'model field: rejectedBy';
COMMENT ON COLUMN "public"."refund_requests"."rejected_at" IS 'model field: rejectedAt';
COMMENT ON COLUMN "public"."refund_requests"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."refund_requests"."auto_approved" IS 'model field: autoApproved';
COMMENT ON COLUMN "public"."refund_requests"."settled_at" IS 'model field: settledAt';
COMMENT ON COLUMN "public"."refund_requests"."is_deleted" IS 'model field: isDeleted';
COMMENT ON COLUMN "public"."refund_requests"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."refund_requests"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."refund_requests"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."refund_requests" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "refund_requests_extra_8efcfe64" ON "public"."refund_requests" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "refund_requests_uq_4db36c3b" ON "public"."refund_requests" USING btree ("refund_number") NULLS NOT DISTINCT;
CREATE INDEX "refund_requests_ix_0fd3975b" ON "public"."refund_requests" USING btree ("module");
CREATE INDEX "refund_requests_ix_d20785da" ON "public"."refund_requests" USING btree ("source_id");
CREATE INDEX "refund_requests_ix_20b3ed65" ON "public"."refund_requests" USING btree ("status");
CREATE INDEX "refund_requests_ix_54066c43" ON "public"."refund_requests" USING btree ("is_deleted");
CREATE INDEX "refund_requests_ix_82abfc2f" ON "public"."refund_requests" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "refund_requests_ix_e55dc705" ON "public"."refund_requests" USING btree ("customer_id", "created_at" DESC NULLS LAST);
CREATE INDEX "refund_requests_ix_1fc45c31" ON "public"."refund_requests" USING btree ("whatsapp_customer_id", "created_at" DESC NULLS LAST) WHERE "whatsapp_customer_id" IS NOT NULL OR "created_at" IS NOT NULL;
CREATE INDEX "refund_requests_ix_b58203d9" ON "public"."refund_requests" USING btree ("ashram_id", "status", "created_at" DESC NULLS LAST);
CREATE INDEX "refund_requests_ix_d531b5a3" ON "public"."refund_requests" USING btree ("module", "status", "created_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "refund_requests_uq_1f70c5ae" ON "public"."refund_requests" USING btree ("module", "source_id") NULLS NOT DISTINCT WHERE "status" IN ('pending', 'under_review', 'approved', 'processing');

REVOKE ALL ON "public"."refund_requests" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."refund_requests" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."refund_status_history" (
  "id" text COLLATE "C" PRIMARY KEY,
  "request_id" text COLLATE "C",
  "from_status" text COLLATE "C",
  "to_status" text COLLATE "C",
  "note" text COLLATE "C",
  "actor_id" text COLLATE "C",
  "actor_whats_app_customer_id" text COLLATE "C",
  "actor_role" text COLLATE "C",
  "occurred_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."refund_status_history" IS 'Tirvona model collection refund_status_history. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."refund_status_history"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."refund_status_history"."from_status" IS 'model field: fromStatus';
COMMENT ON COLUMN "public"."refund_status_history"."to_status" IS 'model field: toStatus';
COMMENT ON COLUMN "public"."refund_status_history"."actor_id" IS 'model field: actorId';
COMMENT ON COLUMN "public"."refund_status_history"."actor_whats_app_customer_id" IS 'model field: actorWhatsAppCustomerId';
COMMENT ON COLUMN "public"."refund_status_history"."actor_role" IS 'model field: actorRole';
COMMENT ON COLUMN "public"."refund_status_history"."occurred_at" IS 'model field: occurredAt';
COMMENT ON COLUMN "public"."refund_status_history"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."refund_status_history"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."refund_status_history" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "refund_status_history_extra_0b0e26d8" ON "public"."refund_status_history" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "refund_status_history_ix_3676e923" ON "public"."refund_status_history" USING btree ("request_id", "occurred_at");

REVOKE ALL ON "public"."refund_status_history" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."refund_status_history" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."refund_transactions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "request_id" text COLLATE "C",
  "idempotency_key" text COLLATE "C",
  "provider" text COLLATE "C",
  "method" text COLLATE "C",
  "gateway_payment_id" text COLLATE "C",
  "gateway_refund_id" text COLLATE "C",
  "amount" double precision,
  "currency" text COLLATE "C",
  "status" text COLLATE "C",
  "attempt" double precision,
  "failure_reason" text COLLATE "C",
  "gateway_response" jsonb,
  "initiated_by" text COLLATE "C",
  "settled_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."refund_transactions" IS 'Tirvona model collection refund_transactions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."refund_transactions"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."refund_transactions"."idempotency_key" IS 'model field: idempotencyKey';
COMMENT ON COLUMN "public"."refund_transactions"."gateway_payment_id" IS 'model field: gatewayPaymentId';
COMMENT ON COLUMN "public"."refund_transactions"."gateway_refund_id" IS 'model field: gatewayRefundId';
COMMENT ON COLUMN "public"."refund_transactions"."failure_reason" IS 'model field: failureReason';
COMMENT ON COLUMN "public"."refund_transactions"."gateway_response" IS 'model field: gatewayResponse';
COMMENT ON COLUMN "public"."refund_transactions"."initiated_by" IS 'model field: initiatedBy';
COMMENT ON COLUMN "public"."refund_transactions"."settled_at" IS 'model field: settledAt';
COMMENT ON COLUMN "public"."refund_transactions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."refund_transactions"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."refund_transactions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "refund_transactions_extra_b1cc63bf" ON "public"."refund_transactions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "refund_transactions_uq_543acea5" ON "public"."refund_transactions" USING btree ("idempotency_key") NULLS NOT DISTINCT;
CREATE INDEX "refund_transactions_ix_46a7df91" ON "public"."refund_transactions" USING btree ("gateway_refund_id") WHERE "gateway_refund_id" IS NOT NULL;
CREATE INDEX "refund_transactions_ix_20b3ed65" ON "public"."refund_transactions" USING btree ("status");
CREATE INDEX "refund_transactions_ix_fce7b988" ON "public"."refund_transactions" USING btree ("request_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."refund_transactions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."refund_transactions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."refund_webhooks" (
  "id" text COLLATE "C" PRIMARY KEY,
  "provider" text COLLATE "C",
  "event_id" text COLLATE "C",
  "event_type" text COLLATE "C",
  "gateway_refund_id" text COLLATE "C",
  "request_id" text COLLATE "C",
  "payload" jsonb,
  "signature_valid" boolean,
  "processed_at" timestamptz,
  "processing_error" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."refund_webhooks" IS 'Tirvona model collection refund_webhooks. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."refund_webhooks"."event_id" IS 'model field: eventId';
COMMENT ON COLUMN "public"."refund_webhooks"."event_type" IS 'model field: eventType';
COMMENT ON COLUMN "public"."refund_webhooks"."gateway_refund_id" IS 'model field: gatewayRefundId';
COMMENT ON COLUMN "public"."refund_webhooks"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."refund_webhooks"."signature_valid" IS 'model field: signatureValid';
COMMENT ON COLUMN "public"."refund_webhooks"."processed_at" IS 'model field: processedAt';
COMMENT ON COLUMN "public"."refund_webhooks"."processing_error" IS 'model field: processingError';
COMMENT ON COLUMN "public"."refund_webhooks"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."refund_webhooks"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."refund_webhooks" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "refund_webhooks_extra_894f9676" ON "public"."refund_webhooks" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "refund_webhooks_uq_2f02e708" ON "public"."refund_webhooks" USING btree ("event_id") NULLS NOT DISTINCT;
CREATE INDEX "refund_webhooks_ix_cbe055ed" ON "public"."refund_webhooks" USING btree ("event_type");
CREATE INDEX "refund_webhooks_ix_46a7df91" ON "public"."refund_webhooks" USING btree ("gateway_refund_id") WHERE "gateway_refund_id" IS NOT NULL;
CREATE INDEX "refund_webhooks_ix_df4a020b" ON "public"."refund_webhooks" USING btree ("processed_at", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."refund_webhooks" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."refund_webhooks" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."reviews" (
  "id" text COLLATE "C" PRIMARY KEY,
  "version" double precision,
  "ashram_id" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "comment" text COLLATE "C",
  "created_at" timestamptz,
  "customer_id" text COLLATE "C",
  "rating" jsonb,
  "status" text COLLATE "C",
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."reviews" IS 'Tirvona model collection reviews. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."reviews"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."reviews"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."reviews"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."reviews"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."reviews"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."reviews"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "reviews_extra_60ad34ef" ON "public"."reviews" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "reviews_uq_68b24c9f" ON "public"."reviews" USING btree ("booking_id") NULLS NOT DISTINCT;
CREATE INDEX "reviews_ix_b58203d9" ON "public"."reviews" USING btree ("ashram_id", "status", "created_at" DESC NULLS LAST);
CREATE INDEX "reviews_ix_82abfc2f" ON "public"."reviews" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "reviews_ix_e55dc705" ON "public"."reviews" USING btree ("customer_id", "created_at" DESC NULLS LAST);
CREATE INDEX "reviews_ix_20e39220" ON "public"."reviews" USING btree ("ashram_id", "status");

REVOKE ALL ON "public"."reviews" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."reviews" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."room_category_requests" (
  "id" text COLLATE "C" PRIMARY KEY,
  "request_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "stay_admin_id" text COLLATE "C",
  "reviewed_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."room_category_requests" IS 'Tirvona model collection room_category_requests. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."room_category_requests"."request_id" IS 'model field: requestId';
COMMENT ON COLUMN "public"."room_category_requests"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."room_category_requests"."stay_admin_id" IS 'model field: stayAdminId';
COMMENT ON COLUMN "public"."room_category_requests"."reviewed_by" IS 'model field: reviewedBy';
COMMENT ON COLUMN "public"."room_category_requests"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."room_category_requests"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."room_category_requests" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "room_category_requests_extra_dd4ff615" ON "public"."room_category_requests" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "room_category_requests_uq_36e5cac1" ON "public"."room_category_requests" USING btree ("request_id") NULLS NOT DISTINCT;
CREATE INDEX "room_category_requests_ix_a1cd3c17" ON "public"."room_category_requests" USING btree ("stay_admin_id");

REVOKE ALL ON "public"."room_category_requests" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."room_category_requests" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."room_rates" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "room_id" text COLLATE "C",
  "mrp" double precision,
  "discount_percent" double precision,
  "discount_amount" double precision,
  "selling_price" double precision,
  "is_discount_active" boolean,
  "is_active" boolean,
  "pricing_type" text COLLATE "C",
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "days_of_week" jsonb,
  "notes" text COLLATE "C",
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."room_rates" IS 'Tirvona model collection room_rates. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."room_rates"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."room_rates"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."room_rates"."discount_percent" IS 'model field: discountPercent';
COMMENT ON COLUMN "public"."room_rates"."discount_amount" IS 'model field: discountAmount';
COMMENT ON COLUMN "public"."room_rates"."selling_price" IS 'model field: sellingPrice';
COMMENT ON COLUMN "public"."room_rates"."is_discount_active" IS 'model field: isDiscountActive';
COMMENT ON COLUMN "public"."room_rates"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."room_rates"."pricing_type" IS 'model field: pricingType';
COMMENT ON COLUMN "public"."room_rates"."valid_from" IS 'model field: validFrom';
COMMENT ON COLUMN "public"."room_rates"."valid_until" IS 'model field: validUntil';
COMMENT ON COLUMN "public"."room_rates"."days_of_week" IS 'model field: daysOfWeek';
COMMENT ON COLUMN "public"."room_rates"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."room_rates"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."room_rates"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."room_rates"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."room_rates"."version" IS 'model field: __v';
ALTER TABLE "public"."room_rates" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "room_rates_extra_51aad6b1" ON "public"."room_rates" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "room_rates_uq_b67885c3" ON "public"."room_rates" USING btree ("room_id") NULLS NOT DISTINCT;
CREATE INDEX "room_rates_ix_b49ea0de" ON "public"."room_rates" USING btree ("ashram_id", "is_discount_active");

REVOKE ALL ON "public"."room_rates" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."room_rates" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."roomavailabilities" (
  "id" text COLLATE "C" PRIMARY KEY,
  "version" double precision,
  "booked_count" double precision,
  "created_at" timestamptz,
  "date" timestamptz,
  "maintenance_count" double precision,
  "room_id" text COLLATE "C",
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."roomavailabilities" IS 'Tirvona model collection roomavailabilities. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."roomavailabilities"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."roomavailabilities"."booked_count" IS 'model field: bookedCount';
COMMENT ON COLUMN "public"."roomavailabilities"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."roomavailabilities"."maintenance_count" IS 'model field: maintenanceCount';
COMMENT ON COLUMN "public"."roomavailabilities"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."roomavailabilities"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."roomavailabilities" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "roomavailabilities_extra_5001380b" ON "public"."roomavailabilities" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "roomavailabilities_uq_af6b04d6" ON "public"."roomavailabilities" USING btree ("room_id", "date") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."roomavailabilities" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."roomavailabilities" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."rooms" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ashram_id" text COLLATE "C",
  "name" text COLLATE "C",
  "type" text COLLATE "C",
  "ac_type" text COLLATE "C",
  "capacity" double precision,
  "total_inventory" double precision,
  "base_price" double precision,
  "discount_percent" double precision,
  "discount_amount" double precision,
  "selling_price" double precision,
  "is_discount_active" boolean,
  "description" text COLLATE "C",
  "amenities" jsonb,
  "images" jsonb,
  "pricing_rules" jsonb,
  "day_stay_config" jsonb,
  "day_stay_lock_token" text COLLATE "C",
  "day_stay_lock_expires_at" timestamptz,
  "status" text COLLATE "C",
  "deleted_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "address" jsonb,
  "city" text COLLATE "C",
  "count" double precision,
  "is_deleted" boolean,
  "is_verified" boolean,
  "max_guests" double precision,
  "price_per_night" double precision,
  "rating" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."rooms" IS 'Tirvona model collection rooms. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."rooms"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."rooms"."ac_type" IS 'model field: acType';
COMMENT ON COLUMN "public"."rooms"."total_inventory" IS 'model field: totalInventory';
COMMENT ON COLUMN "public"."rooms"."base_price" IS 'model field: basePrice';
COMMENT ON COLUMN "public"."rooms"."discount_percent" IS 'model field: discountPercent';
COMMENT ON COLUMN "public"."rooms"."discount_amount" IS 'model field: discountAmount';
COMMENT ON COLUMN "public"."rooms"."selling_price" IS 'model field: sellingPrice';
COMMENT ON COLUMN "public"."rooms"."is_discount_active" IS 'model field: isDiscountActive';
COMMENT ON COLUMN "public"."rooms"."pricing_rules" IS 'model field: pricingRules';
COMMENT ON COLUMN "public"."rooms"."day_stay_config" IS 'model field: dayStayConfig';
COMMENT ON COLUMN "public"."rooms"."day_stay_lock_token" IS 'model field: dayStayLockToken';
COMMENT ON COLUMN "public"."rooms"."day_stay_lock_expires_at" IS 'model field: dayStayLockExpiresAt';
COMMENT ON COLUMN "public"."rooms"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."rooms"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."rooms"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."rooms"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."rooms"."is_deleted" IS 'model field: isDeleted';
COMMENT ON COLUMN "public"."rooms"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."rooms"."max_guests" IS 'model field: maxGuests';
COMMENT ON COLUMN "public"."rooms"."price_per_night" IS 'model field: pricePerNight';
ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "rooms_extra_53126826" ON "public"."rooms" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "rooms_ix_20e39220" ON "public"."rooms" USING btree ("ashram_id", "status");
CREATE INDEX "rooms_ix_a4fad3d0" ON "public"."rooms" USING btree ("type");
CREATE INDEX "rooms_ix_9298f002" ON "public"."rooms" USING btree ("ashram_id", ("day_stay_config" #> '{enabled}'));
CREATE INDEX "rooms_ix_4c90543b" ON "public"."rooms" USING btree ("ashram_id");

REVOKE ALL ON "public"."rooms" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."rooms" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."roomunits" (
  "id" text COLLATE "C" PRIMARY KEY,
  "version" double precision,
  "ashram_id" text COLLATE "C",
  "created_at" timestamptz,
  "notes" text COLLATE "C",
  "room_id" text COLLATE "C",
  "status" text COLLATE "C",
  "unit_number" text COLLATE "C",
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."roomunits" IS 'Tirvona model collection roomunits. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."roomunits"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."roomunits"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."roomunits"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."roomunits"."room_id" IS 'model field: roomId';
COMMENT ON COLUMN "public"."roomunits"."unit_number" IS 'model field: unitNumber';
COMMENT ON COLUMN "public"."roomunits"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."roomunits" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "roomunits_extra_cf3b42bc" ON "public"."roomunits" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "roomunits_uq_d6a14759" ON "public"."roomunits" USING btree ("room_id", "unit_number") NULLS NOT DISTINCT;
CREATE INDEX "roomunits_ix_20e39220" ON "public"."roomunits" USING btree ("ashram_id", "status");

REVOKE ALL ON "public"."roomunits" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."roomunits" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."sacreddirectoryitems" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "badge" text COLLATE "C",
  "category" text COLLATE "C",
  "city" text COLLATE "C",
  "contact_phone" text COLLATE "C",
  "cover_image" text COLLATE "C",
  "description" text COLLATE "C",
  "featured" boolean,
  "gallery" jsonb,
  "module_type" text COLLATE "C",
  "price" double precision,
  "rating" double precision,
  "reviews_count" double precision,
  "slug" text COLLATE "C",
  "specifications" jsonb,
  "state" text COLLATE "C",
  "status" text COLLATE "C",
  "title" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."sacreddirectoryitems" IS 'Tirvona model collection sacreddirectoryitems. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."sacreddirectoryitems"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."sacreddirectoryitems"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."sacreddirectoryitems"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."sacreddirectoryitems"."contact_phone" IS 'model field: contactPhone';
COMMENT ON COLUMN "public"."sacreddirectoryitems"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."sacreddirectoryitems"."module_type" IS 'model field: moduleType';
COMMENT ON COLUMN "public"."sacreddirectoryitems"."reviews_count" IS 'model field: reviewsCount';
ALTER TABLE "public"."sacreddirectoryitems" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "sacreddirectoryitems_extra_eb1321e3" ON "public"."sacreddirectoryitems" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "sacreddirectoryitems_uq_7a0923dd" ON "public"."sacreddirectoryitems" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "sacreddirectoryitems_ix_61b2bc49" ON "public"."sacreddirectoryitems" USING btree ("status", "module_type", "rating" DESC NULLS LAST);
CREATE INDEX "sacreddirectoryitems_ix_428403b5" ON "public"."sacreddirectoryitems" USING btree ("status", "module_type", "category");

REVOKE ALL ON "public"."sacreddirectoryitems" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."sacreddirectoryitems" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."servicebookings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "service_id" text COLLATE "C",
  "customer_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."servicebookings" IS 'Tirvona model collection servicebookings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."servicebookings"."service_id" IS 'model field: serviceId';
COMMENT ON COLUMN "public"."servicebookings"."customer_id" IS 'model field: customerId';
COMMENT ON COLUMN "public"."servicebookings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."servicebookings"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."servicebookings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "servicebookings_extra_bd2445e0" ON "public"."servicebookings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "servicebookings_ix_f11664d9" ON "public"."servicebookings" USING btree ("service_id");
CREATE INDEX "servicebookings_ix_435dc7a5" ON "public"."servicebookings" USING btree ("customer_id");
CREATE INDEX "servicebookings_ix_e55dc705" ON "public"."servicebookings" USING btree ("customer_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."servicebookings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."servicebookings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."serviceproviders" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "address" text COLLATE "C",
  "category" text COLLATE "C",
  "city" text COLLATE "C",
  "contact_phone" text COLLATE "C",
  "coordinates" jsonb,
  "description" text COLLATE "C",
  "images" text[] COLLATE "C",
  "is_verified" boolean,
  "name" text COLLATE "C",
  "pricing" jsonb,
  "rating" double precision,
  "review_count" double precision,
  "specifications" jsonb,
  "state" text COLLATE "C",
  "status" text COLLATE "C",
  "subcategory" text COLLATE "C",
  "tagline" text COLLATE "C",
  "whatsapp_number" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."serviceproviders" IS 'Tirvona model collection serviceproviders. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."serviceproviders"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."serviceproviders"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."serviceproviders"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."serviceproviders"."contact_phone" IS 'model field: contactPhone';
COMMENT ON COLUMN "public"."serviceproviders"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."serviceproviders"."review_count" IS 'model field: reviewCount';
COMMENT ON COLUMN "public"."serviceproviders"."whatsapp_number" IS 'model field: whatsappNumber';
ALTER TABLE "public"."serviceproviders" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "serviceproviders_extra_42a91745" ON "public"."serviceproviders" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "serviceproviders_ix_602d01e2" ON "public"."serviceproviders" USING btree ("status", "category", "city", "rating" DESC NULLS LAST);
CREATE INDEX "serviceproviders_ix_5cd28265" ON "public"."serviceproviders" USING btree ("category");
CREATE INDEX "serviceproviders_ix_9e1bd0bf" ON "public"."serviceproviders" USING btree ("city");
CREATE INDEX "serviceproviders_ix_20b3ed65" ON "public"."serviceproviders" USING btree ("status");
CREATE INDEX "serviceproviders_ix_ad6466c9" ON "public"."serviceproviders" USING btree ("city", "category", "status");

REVOKE ALL ON "public"."serviceproviders" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."serviceproviders" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."support_attachments" (
  "id" text COLLATE "C" PRIMARY KEY,
  "uploader_id" text COLLATE "C",
  "url" text COLLATE "C",
  "public_id" text COLLATE "C",
  "file_name" text COLLATE "C",
  "mime_type" text COLLATE "C",
  "bytes" double precision,
  "ticket_id" text COLLATE "C",
  "message_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."support_attachments" IS 'Tirvona model collection support_attachments. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."support_attachments"."uploader_id" IS 'model field: uploaderId';
COMMENT ON COLUMN "public"."support_attachments"."public_id" IS 'model field: publicId';
COMMENT ON COLUMN "public"."support_attachments"."file_name" IS 'model field: fileName';
COMMENT ON COLUMN "public"."support_attachments"."mime_type" IS 'model field: mimeType';
COMMENT ON COLUMN "public"."support_attachments"."ticket_id" IS 'model field: ticketId';
COMMENT ON COLUMN "public"."support_attachments"."message_id" IS 'model field: messageId';
COMMENT ON COLUMN "public"."support_attachments"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."support_attachments"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "public"."support_attachments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "support_attachments_extra_4452d358" ON "public"."support_attachments" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "support_attachments_ix_46ba54ce" ON "public"."support_attachments" USING btree ("uploader_id", "ticket_id");

REVOKE ALL ON "public"."support_attachments" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."support_attachments" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."support_categories" (
  "id" text COLLATE "C" PRIMARY KEY,
  "key" text COLLATE "C",
  "label" text COLLATE "C",
  "description" text COLLATE "C",
  "is_active" boolean,
  "sort_order" double precision,
  "default_priority" text COLLATE "C",
  "entity_types" jsonb,
  "handler_roles" jsonb,
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."support_categories" IS 'Tirvona model collection support_categories. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."support_categories"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."support_categories"."sort_order" IS 'model field: sortOrder';
COMMENT ON COLUMN "public"."support_categories"."default_priority" IS 'model field: defaultPriority';
COMMENT ON COLUMN "public"."support_categories"."entity_types" IS 'model field: entityTypes';
COMMENT ON COLUMN "public"."support_categories"."handler_roles" IS 'model field: handlerRoles';
COMMENT ON COLUMN "public"."support_categories"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."support_categories"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."support_categories"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."support_categories"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."support_categories"."version" IS 'model field: __v';
ALTER TABLE "public"."support_categories" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "support_categories_extra_2e601655" ON "public"."support_categories" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "support_categories_uq_d562d510" ON "public"."support_categories" USING btree ("key") NULLS NOT DISTINCT;
CREATE INDEX "support_categories_ix_91dbee2e" ON "public"."support_categories" USING btree ("is_active");

REVOKE ALL ON "public"."support_categories" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."support_categories" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."support_counters" (
  "id" text COLLATE "C" PRIMARY KEY,
  "key" text COLLATE "C",
  "seq" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."support_counters" IS 'Tirvona model collection support_counters. Layout: src/database/pg/registry.generated.ts';
ALTER TABLE "public"."support_counters" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "support_counters_extra_0f947649" ON "public"."support_counters" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "support_counters_uq_d562d510" ON "public"."support_counters" USING btree ("key") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."support_counters" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."support_counters" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."support_ticket_activities" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ticket_id" text COLLATE "C",
  "actor_id" text COLLATE "C",
  "actor_role" text COLLATE "C",
  "actor_name" text COLLATE "C",
  "action" text COLLATE "C",
  "from" text COLLATE "C",
  "to" text COLLATE "C",
  "note" text COLLATE "C",
  "visible_to_user" boolean,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."support_ticket_activities" IS 'Tirvona model collection support_ticket_activities. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."support_ticket_activities"."ticket_id" IS 'model field: ticketId';
COMMENT ON COLUMN "public"."support_ticket_activities"."actor_id" IS 'model field: actorId';
COMMENT ON COLUMN "public"."support_ticket_activities"."actor_role" IS 'model field: actorRole';
COMMENT ON COLUMN "public"."support_ticket_activities"."actor_name" IS 'model field: actorName';
COMMENT ON COLUMN "public"."support_ticket_activities"."visible_to_user" IS 'model field: visibleToUser';
COMMENT ON COLUMN "public"."support_ticket_activities"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."support_ticket_activities"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."support_ticket_activities"."version" IS 'model field: __v';
ALTER TABLE "public"."support_ticket_activities" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "support_ticket_activities_extra_8a7178dd" ON "public"."support_ticket_activities" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "support_ticket_activities_ix_0fb558cc" ON "public"."support_ticket_activities" USING btree ("ticket_id", "created_at");

REVOKE ALL ON "public"."support_ticket_activities" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."support_ticket_activities" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."support_ticket_messages" (
  "id" text COLLATE "C" PRIMARY KEY,
  "ticket_id" text COLLATE "C",
  "sender_id" text COLLATE "C",
  "sender_role" text COLLATE "C",
  "sender_name" text COLLATE "C",
  "sender_type" text COLLATE "C",
  "internal" boolean,
  "body" text COLLATE "C",
  "attachments" jsonb,
  "read_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."support_ticket_messages" IS 'Tirvona model collection support_ticket_messages. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."support_ticket_messages"."ticket_id" IS 'model field: ticketId';
COMMENT ON COLUMN "public"."support_ticket_messages"."sender_id" IS 'model field: senderId';
COMMENT ON COLUMN "public"."support_ticket_messages"."sender_role" IS 'model field: senderRole';
COMMENT ON COLUMN "public"."support_ticket_messages"."sender_name" IS 'model field: senderName';
COMMENT ON COLUMN "public"."support_ticket_messages"."sender_type" IS 'model field: senderType';
COMMENT ON COLUMN "public"."support_ticket_messages"."read_at" IS 'model field: readAt';
COMMENT ON COLUMN "public"."support_ticket_messages"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."support_ticket_messages"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."support_ticket_messages"."version" IS 'model field: __v';
ALTER TABLE "public"."support_ticket_messages" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "support_ticket_messages_extra_201426e3" ON "public"."support_ticket_messages" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "support_ticket_messages_ix_0fb558cc" ON "public"."support_ticket_messages" USING btree ("ticket_id", "created_at");
CREATE INDEX "support_ticket_messages_ix_133bf102" ON "public"."support_ticket_messages" USING btree ("ticket_id", "internal", "created_at");

REVOKE ALL ON "public"."support_ticket_messages" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."support_ticket_messages" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."supporttickets" (
  "id" text COLLATE "C" PRIMARY KEY,
  "version" double precision,
  "assigned_to" text COLLATE "C",
  "category" text COLLATE "C",
  "created_at" timestamptz,
  "description" text COLLATE "C",
  "messages" jsonb,
  "priority" text COLLATE "C",
  "status" text COLLATE "C",
  "title" text COLLATE "C",
  "updated_at" timestamptz,
  "user_id" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."supporttickets" IS 'Tirvona model collection supporttickets. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."supporttickets"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."supporttickets"."assigned_to" IS 'model field: assignedTo';
COMMENT ON COLUMN "public"."supporttickets"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."supporttickets"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."supporttickets"."user_id" IS 'model field: userId';
ALTER TABLE "public"."supporttickets" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "supporttickets_extra_62a96284" ON "public"."supporttickets" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "supporttickets_ix_53637f3b" ON "public"."supporttickets" USING btree ("user_id", "created_at" DESC NULLS LAST);
CREATE INDEX "supporttickets_ix_82abfc2f" ON "public"."supporttickets" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "supporttickets_ix_fd6afe8d" ON "public"."supporttickets" USING btree ("user_id");
CREATE INDEX "supporttickets_ix_20b3ed65" ON "public"."supporttickets" USING btree ("status");

REVOKE ALL ON "public"."supporttickets" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."supporttickets" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."temple_aartis" (
  "id" text COLLATE "C" PRIMARY KEY,
  "temple_id" text COLLATE "C",
  "name" text COLLATE "C",
  "start_time" text COLLATE "C",
  "end_time" text COLLATE "C",
  "days" jsonb,
  "description" text COLLATE "C",
  "special_notes" text COLLATE "C",
  "live_stream_url" text COLLATE "C",
  "is_active" boolean,
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."temple_aartis" IS 'Tirvona model collection temple_aartis. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."temple_aartis"."temple_id" IS 'model field: templeId';
COMMENT ON COLUMN "public"."temple_aartis"."start_time" IS 'model field: startTime';
COMMENT ON COLUMN "public"."temple_aartis"."end_time" IS 'model field: endTime';
COMMENT ON COLUMN "public"."temple_aartis"."special_notes" IS 'model field: specialNotes';
COMMENT ON COLUMN "public"."temple_aartis"."live_stream_url" IS 'model field: liveStreamUrl';
COMMENT ON COLUMN "public"."temple_aartis"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."temple_aartis"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."temple_aartis"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."temple_aartis"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."temple_aartis"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."temple_aartis"."version" IS 'model field: __v';
ALTER TABLE "public"."temple_aartis" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "temple_aartis_extra_7e1ac01e" ON "public"."temple_aartis" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "temple_aartis_ix_afbb0fd0" ON "public"."temple_aartis" USING btree ("temple_id", "is_active");

REVOKE ALL ON "public"."temple_aartis" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."temple_aartis" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."temple_festivals" (
  "id" text COLLATE "C" PRIMARY KEY,
  "temple_id" text COLLATE "C",
  "name" text COLLATE "C",
  "start_date" timestamptz,
  "end_date" timestamptz,
  "description" text COLLATE "C",
  "special_timing" text COLLATE "C",
  "special_aarti" text COLLATE "C",
  "important_information" text COLLATE "C",
  "expected_crowd_level" text COLLATE "C",
  "is_active" boolean,
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."temple_festivals" IS 'Tirvona model collection temple_festivals. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."temple_festivals"."temple_id" IS 'model field: templeId';
COMMENT ON COLUMN "public"."temple_festivals"."start_date" IS 'model field: startDate';
COMMENT ON COLUMN "public"."temple_festivals"."end_date" IS 'model field: endDate';
COMMENT ON COLUMN "public"."temple_festivals"."special_timing" IS 'model field: specialTiming';
COMMENT ON COLUMN "public"."temple_festivals"."special_aarti" IS 'model field: specialAarti';
COMMENT ON COLUMN "public"."temple_festivals"."important_information" IS 'model field: importantInformation';
COMMENT ON COLUMN "public"."temple_festivals"."expected_crowd_level" IS 'model field: expectedCrowdLevel';
COMMENT ON COLUMN "public"."temple_festivals"."is_active" IS 'model field: isActive';
COMMENT ON COLUMN "public"."temple_festivals"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."temple_festivals"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."temple_festivals"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."temple_festivals"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."temple_festivals"."version" IS 'model field: __v';
ALTER TABLE "public"."temple_festivals" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "temple_festivals_extra_d4421763" ON "public"."temple_festivals" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "temple_festivals_ix_0e8f96f1" ON "public"."temple_festivals" USING btree ("temple_id", "start_date");

REVOKE ALL ON "public"."temple_festivals" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."temple_festivals" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."temples" (
  "id" text COLLATE "C" PRIMARY KEY,
  "name" text COLLATE "C",
  "temple_short_name" text COLLATE "C",
  "slug" text COLLATE "C",
  "short_description" text COLLATE "C",
  "description" text COLLATE "C",
  "deity" text COLLATE "C",
  "temple_type" text COLLATE "C",
  "religious_tradition" text COLLATE "C",
  "temple_tags" jsonb,
  "established_year" text COLLATE "C",
  "historical_period" text COLLATE "C",
  "founder" text COLLATE "C",
  "dynasty" text COLLATE "C",
  "historical_significance" text COLLATE "C",
  "religious_significance" text COLLATE "C",
  "spiritual_significance" text COLLATE "C",
  "temple_story" text COLLATE "C",
  "important_beliefs" text COLLATE "C",
  "important_traditions" text COLLATE "C",
  "important_rituals" text COLLATE "C",
  "architectural_style" text COLLATE "C",
  "address" jsonb,
  "media" jsonb,
  "timings" jsonb,
  "visitor_info" jsonb,
  "darshan_info" jsonb,
  "how_to_reach" jsonb,
  "seo" jsonb,
  "status" text COLLATE "C",
  "is_verified" boolean,
  "is_featured" boolean,
  "is_popular" boolean,
  "owner_id" text COLLATE "C",
  "created_by" text COLLATE "C",
  "updated_by" text COLLATE "C",
  "deleted_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "aarti_timings" text COLLATE "C",
  "architecture_style" text COLLATE "C",
  "city" text COLLATE "C",
  "cover_image" text COLLATE "C",
  "darshan_timings" text COLLATE "C",
  "dress_code" text COLLATE "C",
  "faqs" jsonb,
  "featured" boolean,
  "gallery" jsonb,
  "history" text COLLATE "C",
  "official_website" text COLLATE "C",
  "phone" text COLLATE "C",
  "rating" double precision,
  "reviews_count" double precision,
  "rules" text[] COLLATE "C",
  "state" text COLLATE "C",
  "trust_name" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."temples" IS 'Tirvona model collection temples. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."temples"."temple_short_name" IS 'model field: templeShortName';
COMMENT ON COLUMN "public"."temples"."short_description" IS 'model field: shortDescription';
COMMENT ON COLUMN "public"."temples"."temple_type" IS 'model field: templeType';
COMMENT ON COLUMN "public"."temples"."religious_tradition" IS 'model field: religiousTradition';
COMMENT ON COLUMN "public"."temples"."temple_tags" IS 'model field: templeTags';
COMMENT ON COLUMN "public"."temples"."established_year" IS 'model field: establishedYear';
COMMENT ON COLUMN "public"."temples"."historical_period" IS 'model field: historicalPeriod';
COMMENT ON COLUMN "public"."temples"."historical_significance" IS 'model field: historicalSignificance';
COMMENT ON COLUMN "public"."temples"."religious_significance" IS 'model field: religiousSignificance';
COMMENT ON COLUMN "public"."temples"."spiritual_significance" IS 'model field: spiritualSignificance';
COMMENT ON COLUMN "public"."temples"."temple_story" IS 'model field: templeStory';
COMMENT ON COLUMN "public"."temples"."important_beliefs" IS 'model field: importantBeliefs';
COMMENT ON COLUMN "public"."temples"."important_traditions" IS 'model field: importantTraditions';
COMMENT ON COLUMN "public"."temples"."important_rituals" IS 'model field: importantRituals';
COMMENT ON COLUMN "public"."temples"."architectural_style" IS 'model field: architecturalStyle';
COMMENT ON COLUMN "public"."temples"."visitor_info" IS 'model field: visitorInfo';
COMMENT ON COLUMN "public"."temples"."darshan_info" IS 'model field: darshanInfo';
COMMENT ON COLUMN "public"."temples"."how_to_reach" IS 'model field: howToReach';
COMMENT ON COLUMN "public"."temples"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."temples"."is_featured" IS 'model field: isFeatured';
COMMENT ON COLUMN "public"."temples"."is_popular" IS 'model field: isPopular';
COMMENT ON COLUMN "public"."temples"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."temples"."created_by" IS 'model field: createdBy';
COMMENT ON COLUMN "public"."temples"."updated_by" IS 'model field: updatedBy';
COMMENT ON COLUMN "public"."temples"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."temples"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."temples"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."temples"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."temples"."aarti_timings" IS 'model field: aartiTimings';
COMMENT ON COLUMN "public"."temples"."architecture_style" IS 'model field: architectureStyle';
COMMENT ON COLUMN "public"."temples"."cover_image" IS 'model field: coverImage';
COMMENT ON COLUMN "public"."temples"."darshan_timings" IS 'model field: darshanTimings';
COMMENT ON COLUMN "public"."temples"."dress_code" IS 'model field: dressCode';
COMMENT ON COLUMN "public"."temples"."official_website" IS 'model field: officialWebsite';
COMMENT ON COLUMN "public"."temples"."reviews_count" IS 'model field: reviewsCount';
COMMENT ON COLUMN "public"."temples"."trust_name" IS 'model field: trustName';
ALTER TABLE "public"."temples" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "temples_extra_3d0b75ab" ON "public"."temples" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "temples_uq_7a0923dd" ON "public"."temples" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "temples_ix_a9876116" ON "public"."temples" USING btree (("address" #> '{city}'));
CREATE INDEX "temples_ix_20b3ed65" ON "public"."temples" USING btree ("status");
CREATE INDEX "temples_ix_2dded0ae" ON "public"."temples" USING btree (("address" #> '{city}'), "status");
CREATE INDEX "temples_ix_7c428cde" ON "public"."temples" USING btree ("is_featured", "status");
CREATE INDEX "temples_ix_8f882ef5" ON "public"."temples" USING btree ("owner_id");
CREATE INDEX "temples_ix_eb6a2f3b" ON "public"."temples" USING btree ("status", "city", "rating" DESC NULLS LAST);
CREATE INDEX "temples_ix_3fedcedd" ON "public"."temples" USING btree ("status", "rating" DESC NULLS LAST, "created_at" DESC NULLS LAST);
CREATE INDEX "temples_ix_e510b7b9" ON "public"."temples" USING btree ("status", "city");
CREATE INDEX "temples_ix_393fba1e" ON "public"."temples" USING btree ("status", "state");

REVOKE ALL ON "public"."temples" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."temples" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."tripitineraries" (
  "id" text COLLATE "C" PRIMARY KEY,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "adults" double precision,
  "budget_type" text COLLATE "C",
  "children" double precision,
  "destination" text COLLATE "C",
  "duration_days" double precision,
  "preferences" jsonb,
  "purpose" text COLLATE "C",
  "senior_citizens" double precision,
  "start_city" text COLLATE "C",
  "status" text COLLATE "C",
  "total_estimated_cost" double precision,
  "travel_date" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."tripitineraries" IS 'Tirvona model collection tripitineraries. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."tripitineraries"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."tripitineraries"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."tripitineraries"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."tripitineraries"."budget_type" IS 'model field: budgetType';
COMMENT ON COLUMN "public"."tripitineraries"."duration_days" IS 'model field: durationDays';
COMMENT ON COLUMN "public"."tripitineraries"."senior_citizens" IS 'model field: seniorCitizens';
COMMENT ON COLUMN "public"."tripitineraries"."start_city" IS 'model field: startCity';
COMMENT ON COLUMN "public"."tripitineraries"."total_estimated_cost" IS 'model field: totalEstimatedCost';
COMMENT ON COLUMN "public"."tripitineraries"."travel_date" IS 'model field: travelDate';
ALTER TABLE "public"."tripitineraries" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "tripitineraries_extra_e27ac863" ON "public"."tripitineraries" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "tripitineraries_ix_82abfc2f" ON "public"."tripitineraries" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "tripitineraries_ix_9620162c" ON "public"."tripitineraries" USING btree ("destination", "status");

REVOKE ALL ON "public"."tripitineraries" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."tripitineraries" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."url_redirects" (
  "id" text COLLATE "C" PRIMARY KEY,
  "from_path" text COLLATE "C",
  "to_path" text COLLATE "C",
  "entity_type" text COLLATE "C",
  "entity_id" text COLLATE "C",
  "reason" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."url_redirects" IS 'Tirvona model collection url_redirects. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."url_redirects"."from_path" IS 'model field: fromPath';
COMMENT ON COLUMN "public"."url_redirects"."to_path" IS 'model field: toPath';
COMMENT ON COLUMN "public"."url_redirects"."entity_type" IS 'model field: entityType';
COMMENT ON COLUMN "public"."url_redirects"."entity_id" IS 'model field: entityId';
COMMENT ON COLUMN "public"."url_redirects"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."url_redirects"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."url_redirects"."version" IS 'model field: __v';
ALTER TABLE "public"."url_redirects" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "url_redirects_extra_00c466b5" ON "public"."url_redirects" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "url_redirects_uq_d04bbb3a" ON "public"."url_redirects" USING btree ("from_path") NULLS NOT DISTINCT;
CREATE INDEX "url_redirects_ix_cad61351" ON "public"."url_redirects" USING btree ("entity_type");
CREATE INDEX "url_redirects_ix_4e3dc069" ON "public"."url_redirects" USING btree ("entity_id");
CREATE INDEX "url_redirects_ix_44690f77" ON "public"."url_redirects" USING btree ("entity_type", "entity_id");

REVOKE ALL ON "public"."url_redirects" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."url_redirects" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."user_notifications" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "campaign_id" text COLLATE "C",
  "title" text COLLATE "C",
  "body" text COLLATE "C",
  "image_url" text COLLATE "C",
  "deep_link" text COLLATE "C",
  "kind" text COLLATE "C",
  "read" boolean,
  "read_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "source" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."user_notifications" IS 'Tirvona model collection user_notifications. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."user_notifications"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."user_notifications"."campaign_id" IS 'model field: campaignId';
COMMENT ON COLUMN "public"."user_notifications"."image_url" IS 'model field: imageUrl';
COMMENT ON COLUMN "public"."user_notifications"."deep_link" IS 'model field: deepLink';
COMMENT ON COLUMN "public"."user_notifications"."read_at" IS 'model field: readAt';
COMMENT ON COLUMN "public"."user_notifications"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."user_notifications"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."user_notifications"."version" IS 'model field: __v';
ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "user_notifications_extra_70dab2c3" ON "public"."user_notifications" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "user_notifications_ix_c7f7e115" ON "public"."user_notifications" USING btree ("read");
CREATE INDEX "user_notifications_ix_53637f3b" ON "public"."user_notifications" USING btree ("user_id", "created_at" DESC NULLS LAST);
CREATE INDEX "user_notifications_ix_21101d2f" ON "public"."user_notifications" USING btree ("user_id", "read");
CREATE INDEX "user_notifications_ix_fd6afe8d" ON "public"."user_notifications" USING btree ("user_id");
CREATE INDEX "user_notifications_ix_38f5f0a0" ON "public"."user_notifications" USING btree ("user_id", "read_at");

REVOKE ALL ON "public"."user_notifications" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."user_notifications" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."usermemories" (
  "id" text COLLATE "C" PRIMARY KEY,
  "user_id" text COLLATE "C",
  "session_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "booking_draft" jsonb,
  "dashboard_state" jsonb,
  "filters" jsonb,
  "last_visited_page" jsonb,
  "marketplace_cart" jsonb,
  "offer_draft" jsonb,
  "planner_draft" jsonb,
  "preferences" jsonb,
  "profile_progress" jsonb,
  "recent_cities" jsonb,
  "recently_viewed" jsonb,
  "recent_searches" jsonb,
  "wishlist" text[] COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."usermemories" IS 'Tirvona model collection usermemories. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."usermemories"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."usermemories"."session_id" IS 'model field: sessionId';
COMMENT ON COLUMN "public"."usermemories"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."usermemories"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."usermemories"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."usermemories"."booking_draft" IS 'model field: bookingDraft';
COMMENT ON COLUMN "public"."usermemories"."dashboard_state" IS 'model field: dashboardState';
COMMENT ON COLUMN "public"."usermemories"."last_visited_page" IS 'model field: lastVisitedPage';
COMMENT ON COLUMN "public"."usermemories"."marketplace_cart" IS 'model field: marketplaceCart';
COMMENT ON COLUMN "public"."usermemories"."offer_draft" IS 'model field: offerDraft';
COMMENT ON COLUMN "public"."usermemories"."planner_draft" IS 'model field: plannerDraft';
COMMENT ON COLUMN "public"."usermemories"."profile_progress" IS 'model field: profileProgress';
COMMENT ON COLUMN "public"."usermemories"."recent_cities" IS 'model field: recentCities';
COMMENT ON COLUMN "public"."usermemories"."recently_viewed" IS 'model field: recentlyViewed';
COMMENT ON COLUMN "public"."usermemories"."recent_searches" IS 'model field: recentSearches';
ALTER TABLE "public"."usermemories" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "usermemories_extra_1780014c" ON "public"."usermemories" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "usermemories_ix_d3999b2a" ON "public"."usermemories" USING btree ("user_id") WHERE "user_id" IS NOT NULL;
CREATE INDEX "usermemories_ix_593e9495" ON "public"."usermemories" USING btree ("session_id") WHERE "session_id" IS NOT NULL;
CREATE INDEX "usermemories_ix_fd6afe8d" ON "public"."usermemories" USING btree ("user_id");
CREATE INDEX "usermemories_ix_bdd27666" ON "public"."usermemories" USING btree ("session_id");

REVOKE ALL ON "public"."usermemories" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."usermemories" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."users" (
  "id" text COLLATE "C" PRIMARY KEY,
  "name" text COLLATE "C",
  "email" text COLLATE "C",
  "phone" text COLLATE "C",
  "password_hash" text COLLATE "C",
  "role" text COLLATE "C",
  "status" text COLLATE "C",
  "is_suspended" boolean,
  "suspension_reason" text COLLATE "C",
  "permissions" jsonb,
  "fcm_tokens" jsonb,
  "employer_ashram_id" text COLLATE "C",
  "scoped_ashram_ids" jsonb,
  "employer_temple_id" text COLLATE "C",
  "scoped_temple_ids" jsonb,
  "is_deleted" boolean,
  "is_verified" boolean,
  "token_version" double precision,
  "auth_provider" text COLLATE "C",
  "google_id" text COLLATE "C",
  "avatar_url" text COLLATE "C",
  "aadhaar_card_url" text COLLATE "C",
  "pan_card_url" text COLLATE "C",
  "district" text COLLATE "C",
  "state" text COLLATE "C",
  "city" text COLLATE "C",
  "designation" text COLLATE "C",
  "department" text COLLATE "C",
  "employee_id" text COLLATE "C",
  "username" text COLLATE "C",
  "govt_id_type" text COLLATE "C",
  "govt_id_number" text COLLATE "C",
  "govt_id_url" text COLLATE "C",
  "gender" text COLLATE "C",
  "dob" timestamptz,
  "joining_date" timestamptz,
  "remarks" text COLLATE "C",
  "suspension_type" text COLLATE "C",
  "suspended_at" timestamptz,
  "suspension_end_date" timestamptz,
  "suspended_by" text COLLATE "C",
  "internal_notes" text COLLATE "C",
  "visible_message" text COLLATE "C",
  "deleted_at" timestamptz,
  "deleted_by" text COLLATE "C",
  "last_login_at" timestamptz,
  "reset_token_hash" text COLLATE "C",
  "reset_token_expires_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "aadhaar_id" text COLLATE "C",
  "device_sessions" jsonb,
  "email_verified_at" timestamptz,
  "govt_id" jsonb,
  "phone_verified_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."users" IS 'Tirvona model collection users. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."users"."password_hash" IS 'model field: passwordHash';
COMMENT ON COLUMN "public"."users"."is_suspended" IS 'model field: isSuspended';
COMMENT ON COLUMN "public"."users"."suspension_reason" IS 'model field: suspensionReason';
COMMENT ON COLUMN "public"."users"."fcm_tokens" IS 'model field: fcmTokens';
COMMENT ON COLUMN "public"."users"."employer_ashram_id" IS 'model field: employerAshramId';
COMMENT ON COLUMN "public"."users"."scoped_ashram_ids" IS 'model field: scopedAshramIds';
COMMENT ON COLUMN "public"."users"."employer_temple_id" IS 'model field: employerTempleId';
COMMENT ON COLUMN "public"."users"."scoped_temple_ids" IS 'model field: scopedTempleIds';
COMMENT ON COLUMN "public"."users"."is_deleted" IS 'model field: isDeleted';
COMMENT ON COLUMN "public"."users"."is_verified" IS 'model field: isVerified';
COMMENT ON COLUMN "public"."users"."token_version" IS 'model field: tokenVersion';
COMMENT ON COLUMN "public"."users"."auth_provider" IS 'model field: authProvider';
COMMENT ON COLUMN "public"."users"."google_id" IS 'model field: googleId';
COMMENT ON COLUMN "public"."users"."avatar_url" IS 'model field: avatarUrl';
COMMENT ON COLUMN "public"."users"."aadhaar_card_url" IS 'model field: aadhaarCardUrl';
COMMENT ON COLUMN "public"."users"."pan_card_url" IS 'model field: panCardUrl';
COMMENT ON COLUMN "public"."users"."employee_id" IS 'model field: employeeId';
COMMENT ON COLUMN "public"."users"."govt_id_type" IS 'model field: govtIdType';
COMMENT ON COLUMN "public"."users"."govt_id_number" IS 'model field: govtIdNumber';
COMMENT ON COLUMN "public"."users"."govt_id_url" IS 'model field: govtIdUrl';
COMMENT ON COLUMN "public"."users"."joining_date" IS 'model field: joiningDate';
COMMENT ON COLUMN "public"."users"."suspension_type" IS 'model field: suspensionType';
COMMENT ON COLUMN "public"."users"."suspended_at" IS 'model field: suspendedAt';
COMMENT ON COLUMN "public"."users"."suspension_end_date" IS 'model field: suspensionEndDate';
COMMENT ON COLUMN "public"."users"."suspended_by" IS 'model field: suspendedBy';
COMMENT ON COLUMN "public"."users"."internal_notes" IS 'model field: internalNotes';
COMMENT ON COLUMN "public"."users"."visible_message" IS 'model field: visibleMessage';
COMMENT ON COLUMN "public"."users"."deleted_at" IS 'model field: deletedAt';
COMMENT ON COLUMN "public"."users"."deleted_by" IS 'model field: deletedBy';
COMMENT ON COLUMN "public"."users"."last_login_at" IS 'model field: lastLoginAt';
COMMENT ON COLUMN "public"."users"."reset_token_hash" IS 'model field: resetTokenHash';
COMMENT ON COLUMN "public"."users"."reset_token_expires_at" IS 'model field: resetTokenExpiresAt';
COMMENT ON COLUMN "public"."users"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."users"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."users"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."users"."aadhaar_id" IS 'model field: aadhaarId';
COMMENT ON COLUMN "public"."users"."device_sessions" IS 'model field: deviceSessions';
COMMENT ON COLUMN "public"."users"."email_verified_at" IS 'model field: emailVerifiedAt';
COMMENT ON COLUMN "public"."users"."govt_id" IS 'model field: govtId';
COMMENT ON COLUMN "public"."users"."phone_verified_at" IS 'model field: phoneVerifiedAt';
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "users_extra_8afe2654" ON "public"."users" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "users_uq_dc50223a" ON "public"."users" USING btree ("email") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "users_uq_d4eaaa3f" ON "public"."users" USING btree ("phone") NULLS NOT DISTINCT;
CREATE INDEX "users_ix_5cbb81b9" ON "public"."users" USING btree ("role");
CREATE INDEX "users_ix_20b3ed65" ON "public"."users" USING btree ("status");
CREATE INDEX "users_ix_54066c43" ON "public"."users" USING btree ("is_deleted");
CREATE INDEX "users_ix_5a67718e" ON "public"."users" USING btree ("is_verified");
CREATE INDEX "users_ix_24a6f791" ON "public"."users" USING btree ("google_id") WHERE "google_id" IS NOT NULL;
CREATE INDEX "users_ix_64f22cc4" ON "public"."users" USING btree ("employee_id") WHERE "employee_id" IS NOT NULL;
CREATE INDEX "users_ix_83fe390c" ON "public"."users" USING btree ("username") WHERE "username" IS NOT NULL;
CREATE INDEX "users_ix_94aabbfb" ON "public"."users" USING btree ("role", "status", "is_deleted");
CREATE INDEX "users_ix_b2d34fc3" ON "public"."users" USING btree ("employer_ashram_id", "role", "status");
CREATE INDEX "users_ix_3b2ba6b3" ON "public"."users" USING btree ("scoped_ashram_ids", "role");
CREATE INDEX "users_ix_494c0518" ON "public"."users" USING btree ("employer_temple_id", "role", "status");
CREATE INDEX "users_ix_72a8e901" ON "public"."users" USING btree ("scoped_temple_ids", "role");

REVOKE ALL ON "public"."users" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."users" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."visitorarticlecomments" (
  "id" text COLLATE "C" PRIMARY KEY,
  "article_id" text COLLATE "C",
  "user_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "comment" text COLLATE "C",
  "is_approved" boolean,
  "user_name" text COLLATE "C",
  "user_role" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."visitorarticlecomments" IS 'Tirvona model collection visitorarticlecomments. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."visitorarticlecomments"."article_id" IS 'model field: articleId';
COMMENT ON COLUMN "public"."visitorarticlecomments"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."visitorarticlecomments"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."visitorarticlecomments"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."visitorarticlecomments"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."visitorarticlecomments"."is_approved" IS 'model field: isApproved';
COMMENT ON COLUMN "public"."visitorarticlecomments"."user_name" IS 'model field: userName';
COMMENT ON COLUMN "public"."visitorarticlecomments"."user_role" IS 'model field: userRole';
ALTER TABLE "public"."visitorarticlecomments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "visitorarticlecomments_extra_1d8deaf0" ON "public"."visitorarticlecomments" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "visitorarticlecomments_ix_d79161e8" ON "public"."visitorarticlecomments" USING btree ("article_id");

REVOKE ALL ON "public"."visitorarticlecomments" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."visitorarticlecomments" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."visitorarticlelikes" (
  "id" text COLLATE "C" PRIMARY KEY,
  "article_id" text COLLATE "C",
  "user_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."visitorarticlelikes" IS 'Tirvona model collection visitorarticlelikes. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."visitorarticlelikes"."article_id" IS 'model field: articleId';
COMMENT ON COLUMN "public"."visitorarticlelikes"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."visitorarticlelikes"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."visitorarticlelikes"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."visitorarticlelikes"."version" IS 'model field: __v';
ALTER TABLE "public"."visitorarticlelikes" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "visitorarticlelikes_extra_1afd5d16" ON "public"."visitorarticlelikes" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "visitorarticlelikes_ix_d79161e8" ON "public"."visitorarticlelikes" USING btree ("article_id");
CREATE INDEX "visitorarticlelikes_ix_fd6afe8d" ON "public"."visitorarticlelikes" USING btree ("user_id");
CREATE UNIQUE INDEX "visitorarticlelikes_uq_de8061df" ON "public"."visitorarticlelikes" USING btree ("article_id", "user_id") NULLS NOT DISTINCT;

REVOKE ALL ON "public"."visitorarticlelikes" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."visitorarticlelikes" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."visitorarticles" (
  "id" text COLLATE "C" PRIMARY KEY,
  "visitor_id" text COLLATE "C",
  "booking_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "owner_id" text COLLATE "C",
  "slug" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "category" text COLLATE "C",
  "content" text COLLATE "C",
  "featured_image" text COLLATE "C",
  "gallery_images" text[] COLLATE "C",
  "is_verified_stay" boolean,
  "language" text COLLATE "C",
  "likes_count" double precision,
  "published_at" timestamptz,
  "rejection_reason" text COLLATE "C",
  "short_description" text COLLATE "C",
  "status" text COLLATE "C",
  "tags" text[] COLLATE "C",
  "title" text COLLATE "C",
  "uuid" text COLLATE "C",
  "video_url" text COLLATE "C",
  "views_count" double precision,
  "visit_date" timestamptz,
  "visit_month" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."visitorarticles" IS 'Tirvona model collection visitorarticles. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."visitorarticles"."visitor_id" IS 'model field: visitorId';
COMMENT ON COLUMN "public"."visitorarticles"."booking_id" IS 'model field: bookingId';
COMMENT ON COLUMN "public"."visitorarticles"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."visitorarticles"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."visitorarticles"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."visitorarticles"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."visitorarticles"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."visitorarticles"."featured_image" IS 'model field: featuredImage';
COMMENT ON COLUMN "public"."visitorarticles"."gallery_images" IS 'model field: galleryImages';
COMMENT ON COLUMN "public"."visitorarticles"."is_verified_stay" IS 'model field: isVerifiedStay';
COMMENT ON COLUMN "public"."visitorarticles"."likes_count" IS 'model field: likesCount';
COMMENT ON COLUMN "public"."visitorarticles"."published_at" IS 'model field: publishedAt';
COMMENT ON COLUMN "public"."visitorarticles"."rejection_reason" IS 'model field: rejectionReason';
COMMENT ON COLUMN "public"."visitorarticles"."short_description" IS 'model field: shortDescription';
COMMENT ON COLUMN "public"."visitorarticles"."video_url" IS 'model field: videoUrl';
COMMENT ON COLUMN "public"."visitorarticles"."views_count" IS 'model field: viewsCount';
COMMENT ON COLUMN "public"."visitorarticles"."visit_date" IS 'model field: visitDate';
COMMENT ON COLUMN "public"."visitorarticles"."visit_month" IS 'model field: visitMonth';
ALTER TABLE "public"."visitorarticles" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "visitorarticles_extra_d5d5be5d" ON "public"."visitorarticles" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "visitorarticles_ix_9ca4f90e" ON "public"."visitorarticles" USING btree ("visitor_id");
CREATE INDEX "visitorarticles_ix_caf0121a" ON "public"."visitorarticles" USING btree ("booking_id");
CREATE INDEX "visitorarticles_ix_4c90543b" ON "public"."visitorarticles" USING btree ("ashram_id");
CREATE INDEX "visitorarticles_ix_8f882ef5" ON "public"."visitorarticles" USING btree ("owner_id");
CREATE UNIQUE INDEX "visitorarticles_uq_7a0923dd" ON "public"."visitorarticles" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "visitorarticles_ix_82abfc2f" ON "public"."visitorarticles" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "visitorarticles_uq_f2c66d23" ON "public"."visitorarticles" USING btree ("uuid") NULLS NOT DISTINCT;
CREATE INDEX "visitorarticles_ix_5cd28265" ON "public"."visitorarticles" USING btree ("category");
CREATE INDEX "visitorarticles_ix_20b3ed65" ON "public"."visitorarticles" USING btree ("status");
CREATE INDEX "visitorarticles_ix_20e39220" ON "public"."visitorarticles" USING btree ("ashram_id", "status");
CREATE INDEX "visitorarticles_ix_351a4e93" ON "public"."visitorarticles" USING btree ("visitor_id", "status");

REVOKE ALL ON "public"."visitorarticles" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."visitorarticles" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."visitorarticlestatushistories" (
  "id" text COLLATE "C" PRIMARY KEY,
  "article_id" text COLLATE "C",
  "action_by" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "new_status" text COLLATE "C",
  "previous_status" text COLLATE "C",
  "reason" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."visitorarticlestatushistories" IS 'Tirvona model collection visitorarticlestatushistories. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."visitorarticlestatushistories"."article_id" IS 'model field: articleId';
COMMENT ON COLUMN "public"."visitorarticlestatushistories"."action_by" IS 'model field: actionBy';
COMMENT ON COLUMN "public"."visitorarticlestatushistories"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."visitorarticlestatushistories"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."visitorarticlestatushistories"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."visitorarticlestatushistories"."new_status" IS 'model field: newStatus';
COMMENT ON COLUMN "public"."visitorarticlestatushistories"."previous_status" IS 'model field: previousStatus';
ALTER TABLE "public"."visitorarticlestatushistories" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "visitorarticlestatushistories_extra_645b4892" ON "public"."visitorarticlestatushistories" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "visitorarticlestatushistories_ix_d79161e8" ON "public"."visitorarticlestatushistories" USING btree ("article_id");

REVOKE ALL ON "public"."visitorarticlestatushistories" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."visitorarticlestatushistories" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."volunteerapplications" (
  "id" text COLLATE "C" PRIMARY KEY,
  "job_id" text COLLATE "C",
  "user_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "applicant_name" text COLLATE "C",
  "availability" text COLLATE "C",
  "city" text COLLATE "C",
  "education" text COLLATE "C",
  "email" text COLLATE "C",
  "languages" text COLLATE "C",
  "motivation" text COLLATE "C",
  "phone" text COLLATE "C",
  "skills" text COLLATE "C",
  "status" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."volunteerapplications" IS 'Tirvona model collection volunteerapplications. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."volunteerapplications"."job_id" IS 'model field: jobId';
COMMENT ON COLUMN "public"."volunteerapplications"."user_id" IS 'model field: userId';
COMMENT ON COLUMN "public"."volunteerapplications"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."volunteerapplications"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."volunteerapplications"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."volunteerapplications"."applicant_name" IS 'model field: applicantName';
ALTER TABLE "public"."volunteerapplications" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "volunteerapplications_extra_a6d51c13" ON "public"."volunteerapplications" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "volunteerapplications_ix_b845d8ce" ON "public"."volunteerapplications" USING btree ("job_id");
CREATE INDEX "volunteerapplications_ix_fd6afe8d" ON "public"."volunteerapplications" USING btree ("user_id");
CREATE INDEX "volunteerapplications_ix_20b3ed65" ON "public"."volunteerapplications" USING btree ("status");

REVOKE ALL ON "public"."volunteerapplications" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."volunteerapplications" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."volunteerjobs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "owner_id" text COLLATE "C",
  "ashram_id" text COLLATE "C",
  "slug" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "accommodation" text COLLATE "C",
  "ashram_name" text COLLATE "C",
  "benefits" text[] COLLATE "C",
  "certificate_provided" boolean,
  "city" text COLLATE "C",
  "contact_person" jsonb,
  "deadline" timestamptz,
  "department" text COLLATE "C",
  "duration" text COLLATE "C",
  "food" text COLLATE "C",
  "is_govt_verified" boolean,
  "openings_count" double precision,
  "requirements" text[] COLLATE "C",
  "responsibilities" text[] COLLATE "C",
  "state" text COLLATE "C",
  "status" text COLLATE "C",
  "stipend" text COLLATE "C",
  "title" text COLLATE "C",
  "type" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."volunteerjobs" IS 'Tirvona model collection volunteerjobs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."volunteerjobs"."owner_id" IS 'model field: ownerId';
COMMENT ON COLUMN "public"."volunteerjobs"."ashram_id" IS 'model field: ashramId';
COMMENT ON COLUMN "public"."volunteerjobs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."volunteerjobs"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."volunteerjobs"."version" IS 'model field: __v';
COMMENT ON COLUMN "public"."volunteerjobs"."ashram_name" IS 'model field: ashramName';
COMMENT ON COLUMN "public"."volunteerjobs"."certificate_provided" IS 'model field: certificateProvided';
COMMENT ON COLUMN "public"."volunteerjobs"."contact_person" IS 'model field: contactPerson';
COMMENT ON COLUMN "public"."volunteerjobs"."is_govt_verified" IS 'model field: isGovtVerified';
COMMENT ON COLUMN "public"."volunteerjobs"."openings_count" IS 'model field: openingsCount';
ALTER TABLE "public"."volunteerjobs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "volunteerjobs_extra_bc20e658" ON "public"."volunteerjobs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "volunteerjobs_ix_8f882ef5" ON "public"."volunteerjobs" USING btree ("owner_id");
CREATE INDEX "volunteerjobs_ix_4c90543b" ON "public"."volunteerjobs" USING btree ("ashram_id");
CREATE UNIQUE INDEX "volunteerjobs_uq_16cc4602" ON "public"."volunteerjobs" USING btree ("slug") WHERE "slug" IS NOT NULL;
CREATE INDEX "volunteerjobs_ix_9e1bd0bf" ON "public"."volunteerjobs" USING btree ("city");
CREATE INDEX "volunteerjobs_ix_a4fad3d0" ON "public"."volunteerjobs" USING btree ("type");
CREATE INDEX "volunteerjobs_ix_20b3ed65" ON "public"."volunteerjobs" USING btree ("status");

REVOKE ALL ON "public"."volunteerjobs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."volunteerjobs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."whatsapp_customers" (
  "id" text COLLATE "C" PRIMARY KEY,
  "wapp_id" text COLLATE "C",
  "phone" text COLLATE "C",
  "name" text COLLATE "C",
  "whatsapp_verified" boolean,
  "language" text COLLATE "C",
  "status" text COLLATE "C",
  "linked_user_id" text COLLATE "C",
  "linked_at" timestamptz,
  "last_seen_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."whatsapp_customers" IS 'Tirvona model collection whatsapp_customers. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."whatsapp_customers"."wapp_id" IS 'model field: wappId';
COMMENT ON COLUMN "public"."whatsapp_customers"."whatsapp_verified" IS 'model field: whatsappVerified';
COMMENT ON COLUMN "public"."whatsapp_customers"."linked_user_id" IS 'model field: linkedUserId';
COMMENT ON COLUMN "public"."whatsapp_customers"."linked_at" IS 'model field: linkedAt';
COMMENT ON COLUMN "public"."whatsapp_customers"."last_seen_at" IS 'model field: lastSeenAt';
COMMENT ON COLUMN "public"."whatsapp_customers"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."whatsapp_customers"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."whatsapp_customers"."version" IS 'model field: __v';
ALTER TABLE "public"."whatsapp_customers" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "whatsapp_customers_extra_aeaa0ba1" ON "public"."whatsapp_customers" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "whatsapp_customers_uq_96a490ab" ON "public"."whatsapp_customers" USING btree ("wapp_id") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "whatsapp_customers_uq_d4eaaa3f" ON "public"."whatsapp_customers" USING btree ("phone") NULLS NOT DISTINCT;
CREATE INDEX "whatsapp_customers_ix_20b3ed65" ON "public"."whatsapp_customers" USING btree ("status");
CREATE INDEX "whatsapp_customers_ix_20cd19c6" ON "public"."whatsapp_customers" USING btree ("linked_user_id");
CREATE INDEX "whatsapp_customers_ix_67bad42f" ON "public"."whatsapp_customers" USING btree ("created_at" DESC NULLS LAST);

REVOKE ALL ON "public"."whatsapp_customers" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."whatsapp_customers" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "public"."whatsapp_inbound_events" (
  "id" text COLLATE "C" PRIMARY KEY,
  "message_id" text COLLATE "C",
  "phone" text COLLATE "C",
  "whatsapp_customer_id" text COLLATE "C",
  "message_type" text COLLATE "C",
  "text" text COLLATE "C",
  "reply_id" text COLLATE "C",
  "sent_at" timestamptz,
  "status" text COLLATE "C",
  "processed_at" timestamptz,
  "processing_error" text COLLATE "C",
  "queue_job_id" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "public"."whatsapp_inbound_events" IS 'Tirvona model collection whatsapp_inbound_events. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."message_id" IS 'model field: messageId';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."whatsapp_customer_id" IS 'model field: whatsappCustomerId';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."message_type" IS 'model field: messageType';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."reply_id" IS 'model field: replyId';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."sent_at" IS 'model field: sentAt';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."processed_at" IS 'model field: processedAt';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."processing_error" IS 'model field: processingError';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."queue_job_id" IS 'model field: queueJobId';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "public"."whatsapp_inbound_events"."version" IS 'model field: __v';
ALTER TABLE "public"."whatsapp_inbound_events" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "whatsapp_inbound_events_extra_3b5cf496" ON "public"."whatsapp_inbound_events" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "whatsapp_inbound_events_uq_36282e18" ON "public"."whatsapp_inbound_events" USING btree ("message_id") NULLS NOT DISTINCT;
CREATE INDEX "whatsapp_inbound_events_ix_38117e7e" ON "public"."whatsapp_inbound_events" USING btree ("phone");
CREATE INDEX "whatsapp_inbound_events_ix_7838f8d9" ON "public"."whatsapp_inbound_events" USING btree ("whatsapp_customer_id");
CREATE INDEX "whatsapp_inbound_events_ix_20b3ed65" ON "public"."whatsapp_inbound_events" USING btree ("status");
CREATE INDEX "whatsapp_inbound_events_ix_820793a2" ON "public"."whatsapp_inbound_events" USING btree ("phone", "created_at" DESC NULLS LAST);
CREATE INDEX "whatsapp_inbound_events_ix_82abfc2f" ON "public"."whatsapp_inbound_events" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "whatsapp_inbound_events_ix_4e283daf" ON "public"."whatsapp_inbound_events" USING btree ("created_at");

REVOKE ALL ON "public"."whatsapp_inbound_events" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "public"."whatsapp_inbound_events" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "leads"."lead_attendance" (
  "id" text COLLATE "C" PRIMARY KEY,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "leads"."lead_attendance" IS 'Tirvona model collection lead_attendance. Layout: src/database/pg/registry.generated.ts';
ALTER TABLE "leads"."lead_attendance" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "lead_attendance_extra_37f2b589" ON "leads"."lead_attendance" USING gin ("_extra") WHERE "_extra" IS NOT NULL;

REVOKE ALL ON "leads"."lead_attendance" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "leads"."lead_attendance" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "leads"."lead_attendances" (
  "id" text COLLATE "C" PRIMARY KEY,
  "agent_id" text COLLATE "C",
  "agent_name" text COLLATE "C",
  "agent_phone" text COLLATE "C",
  "role" text COLLATE "C",
  "state" text COLLATE "C",
  "district" text COLLATE "C",
  "date" text COLLATE "C",
  "checked_in" boolean,
  "check_in_time" timestamptz,
  "check_in_formatted_time" text COLLATE "C",
  "check_in_coords" jsonb,
  "check_in_address" text COLLATE "C",
  "check_in_maps_url" text COLLATE "C",
  "checked_out" boolean,
  "check_out_time" timestamptz,
  "check_out_formatted_time" text COLLATE "C",
  "check_out_coords" jsonb,
  "check_out_address" text COLLATE "C",
  "check_out_maps_url" text COLLATE "C",
  "total_working_minutes" double precision,
  "formatted_working_hours" text COLLATE "C",
  "status" text COLLATE "C",
  "notes" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "user_id" text COLLATE "C",
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "leads"."lead_attendances" IS 'Tirvona model collection lead_attendances. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "leads"."lead_attendances"."agent_id" IS 'model field: agentId';
COMMENT ON COLUMN "leads"."lead_attendances"."agent_name" IS 'model field: agentName';
COMMENT ON COLUMN "leads"."lead_attendances"."agent_phone" IS 'model field: agentPhone';
COMMENT ON COLUMN "leads"."lead_attendances"."checked_in" IS 'model field: checkedIn';
COMMENT ON COLUMN "leads"."lead_attendances"."check_in_time" IS 'model field: checkInTime';
COMMENT ON COLUMN "leads"."lead_attendances"."check_in_formatted_time" IS 'model field: checkInFormattedTime';
COMMENT ON COLUMN "leads"."lead_attendances"."check_in_coords" IS 'model field: checkInCoords';
COMMENT ON COLUMN "leads"."lead_attendances"."check_in_address" IS 'model field: checkInAddress';
COMMENT ON COLUMN "leads"."lead_attendances"."check_in_maps_url" IS 'model field: checkInMapsUrl';
COMMENT ON COLUMN "leads"."lead_attendances"."checked_out" IS 'model field: checkedOut';
COMMENT ON COLUMN "leads"."lead_attendances"."check_out_time" IS 'model field: checkOutTime';
COMMENT ON COLUMN "leads"."lead_attendances"."check_out_formatted_time" IS 'model field: checkOutFormattedTime';
COMMENT ON COLUMN "leads"."lead_attendances"."check_out_coords" IS 'model field: checkOutCoords';
COMMENT ON COLUMN "leads"."lead_attendances"."check_out_address" IS 'model field: checkOutAddress';
COMMENT ON COLUMN "leads"."lead_attendances"."check_out_maps_url" IS 'model field: checkOutMapsUrl';
COMMENT ON COLUMN "leads"."lead_attendances"."total_working_minutes" IS 'model field: totalWorkingMinutes';
COMMENT ON COLUMN "leads"."lead_attendances"."formatted_working_hours" IS 'model field: formattedWorkingHours';
COMMENT ON COLUMN "leads"."lead_attendances"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "leads"."lead_attendances"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "leads"."lead_attendances"."version" IS 'model field: __v';
COMMENT ON COLUMN "leads"."lead_attendances"."user_id" IS 'model field: userId';
ALTER TABLE "leads"."lead_attendances" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "lead_attendances_extra_80d8ff9c" ON "leads"."lead_attendances" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "lead_attendances_ix_09369b3a" ON "leads"."lead_attendances" USING btree ("agent_id");
CREATE INDEX "lead_attendances_ix_c92df131" ON "leads"."lead_attendances" USING btree ("state");
CREATE INDEX "lead_attendances_ix_b4d65e09" ON "leads"."lead_attendances" USING btree ("district");
CREATE INDEX "lead_attendances_ix_d0644476" ON "leads"."lead_attendances" USING btree ("date");
CREATE INDEX "lead_attendances_ix_20b3ed65" ON "leads"."lead_attendances" USING btree ("status");
CREATE UNIQUE INDEX "lead_attendances_uq_6f03647f" ON "leads"."lead_attendances" USING btree ("agent_id", "date") NULLS NOT DISTINCT;
CREATE INDEX "lead_attendances_ix_02782f2e" ON "leads"."lead_attendances" USING btree ("date", "district");
CREATE INDEX "lead_attendances_ix_67bad42f" ON "leads"."lead_attendances" USING btree ("created_at" DESC NULLS LAST);
CREATE INDEX "lead_attendances_ix_a956d22b" ON "leads"."lead_attendances" USING btree ("date" DESC NULLS LAST, "state", "district");

REVOKE ALL ON "leads"."lead_attendances" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "leads"."lead_attendances" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "leads"."lead_location_pings" (
  "id" text COLLATE "C" PRIMARY KEY,
  "agent_id" text COLLATE "C",
  "agent_name" text COLLATE "C",
  "state" text COLLATE "C",
  "district" text COLLATE "C",
  "date" text COLLATE "C",
  "lat" double precision,
  "lng" double precision,
  "accuracy" double precision,
  "speed" double precision,
  "heading" double precision,
  "altitude" double precision,
  "recorded_at" timestamptz,
  "metres_from_previous" double precision,
  "source" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "leads"."lead_location_pings" IS 'Tirvona model collection lead_location_pings. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "leads"."lead_location_pings"."agent_id" IS 'model field: agentId';
COMMENT ON COLUMN "leads"."lead_location_pings"."agent_name" IS 'model field: agentName';
COMMENT ON COLUMN "leads"."lead_location_pings"."recorded_at" IS 'model field: recordedAt';
COMMENT ON COLUMN "leads"."lead_location_pings"."metres_from_previous" IS 'model field: metresFromPrevious';
COMMENT ON COLUMN "leads"."lead_location_pings"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "leads"."lead_location_pings"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "leads"."lead_location_pings"."version" IS 'model field: __v';
ALTER TABLE "leads"."lead_location_pings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "lead_location_pings_extra_ac26da40" ON "leads"."lead_location_pings" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "lead_location_pings_ix_09369b3a" ON "leads"."lead_location_pings" USING btree ("agent_id");
CREATE INDEX "lead_location_pings_ix_c92df131" ON "leads"."lead_location_pings" USING btree ("state");
CREATE INDEX "lead_location_pings_ix_b4d65e09" ON "leads"."lead_location_pings" USING btree ("district");
CREATE INDEX "lead_location_pings_ix_d0644476" ON "leads"."lead_location_pings" USING btree ("date");
CREATE INDEX "lead_location_pings_ix_9356a362" ON "leads"."lead_location_pings" USING btree ("agent_id", "date", "recorded_at");
CREATE INDEX "lead_location_pings_ix_40cf2a19" ON "leads"."lead_location_pings" USING btree ("district", "recorded_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "lead_location_pings_uq_82d0d968" ON "leads"."lead_location_pings" USING btree ("agent_id", "recorded_at") NULLS NOT DISTINCT;
CREATE INDEX "lead_location_pings_ix_3ee1b8eb" ON "leads"."lead_location_pings" USING btree ("recorded_at");

REVOKE ALL ON "leads"."lead_location_pings" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "leads"."lead_location_pings" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "leads"."lead_regions" (
  "id" text COLLATE "C" PRIMARY KEY,
  "state" text COLLATE "C",
  "district" text COLLATE "C",
  "created_by_admin_id" text COLLATE "C",
  "created_by_admin_name" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "leads"."lead_regions" IS 'Tirvona model collection lead_regions. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "leads"."lead_regions"."created_by_admin_id" IS 'model field: createdByAdminId';
COMMENT ON COLUMN "leads"."lead_regions"."created_by_admin_name" IS 'model field: createdByAdminName';
COMMENT ON COLUMN "leads"."lead_regions"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "leads"."lead_regions"."updated_at" IS 'model field: updatedAt';
ALTER TABLE "leads"."lead_regions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "lead_regions_extra_83502c51" ON "leads"."lead_regions" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "lead_regions_uq_dd49a283" ON "leads"."lead_regions" USING btree ("state", "district") NULLS NOT DISTINCT;

REVOKE ALL ON "leads"."lead_regions" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "leads"."lead_regions" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "leads"."lead_users" (
  "id" text COLLATE "C" PRIMARY KEY,
  "name" text COLLATE "C",
  "phone" text COLLATE "C",
  "email" text COLLATE "C",
  "password_hash" text COLLATE "C",
  "role" text COLLATE "C",
  "status" text COLLATE "C",
  "region" text COLLATE "C",
  "state" text COLLATE "C",
  "district" text COLLATE "C",
  "employee_code" text COLLATE "C",
  "notes" text COLLATE "C",
  "last_login_at" timestamptz,
  "token_version" double precision,
  "created_by_admin_id" text COLLATE "C",
  "created_by_admin_name" text COLLATE "C",
  "tracking_consent" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "leads"."lead_users" IS 'Tirvona model collection lead_users. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "leads"."lead_users"."password_hash" IS 'model field: passwordHash';
COMMENT ON COLUMN "leads"."lead_users"."employee_code" IS 'model field: employeeCode';
COMMENT ON COLUMN "leads"."lead_users"."last_login_at" IS 'model field: lastLoginAt';
COMMENT ON COLUMN "leads"."lead_users"."token_version" IS 'model field: tokenVersion';
COMMENT ON COLUMN "leads"."lead_users"."created_by_admin_id" IS 'model field: createdByAdminId';
COMMENT ON COLUMN "leads"."lead_users"."created_by_admin_name" IS 'model field: createdByAdminName';
COMMENT ON COLUMN "leads"."lead_users"."tracking_consent" IS 'model field: trackingConsent';
COMMENT ON COLUMN "leads"."lead_users"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "leads"."lead_users"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "leads"."lead_users"."version" IS 'model field: __v';
ALTER TABLE "leads"."lead_users" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "lead_users_extra_69856cb2" ON "leads"."lead_users" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "lead_users_uq_d4eaaa3f" ON "leads"."lead_users" USING btree ("phone") NULLS NOT DISTINCT;
CREATE INDEX "lead_users_ix_20b3ed65" ON "leads"."lead_users" USING btree ("status");
CREATE INDEX "lead_users_ix_c92df131" ON "leads"."lead_users" USING btree ("state");
CREATE INDEX "lead_users_ix_b4d65e09" ON "leads"."lead_users" USING btree ("district");
CREATE INDEX "lead_users_ix_82abfc2f" ON "leads"."lead_users" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "lead_users_ix_e5b8dfb3" ON "leads"."lead_users" USING btree ("name");

REVOKE ALL ON "leads"."lead_users" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "leads"."lead_users" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "leads"."leads" (
  "id" text COLLATE "C" PRIMARY KEY,
  "name" text COLLATE "C",
  "location" jsonb,
  "geo" jsonb,
  "room_inventory" jsonb,
  "contact" jsonb,
  "notes" text COLLATE "C",
  "agent_notes" text COLLATE "C",
  "interest" text COLLATE "C",
  "meeting" jsonb,
  "images" jsonb,
  "status" text COLLATE "C",
  "captured_by" text COLLATE "C",
  "captured_by_name" text COLLATE "C",
  "captured_at" timestamptz,
  "assigned_agent_id" text COLLATE "C",
  "assigned_agent_name" text COLLATE "C",
  "assigned_agent_code" text COLLATE "C",
  "field_verified" boolean,
  "field_verified_at" timestamptz,
  "field_verified_by_name" text COLLATE "C",
  "field_verified_by_id" text COLLATE "C",
  "last_updated_by_name" text COLLATE "C",
  "last_updated_by_role" text COLLATE "C",
  "document_checklist" jsonb,
  "document_category" text COLLATE "C",
  "doc_verification_status" text COLLATE "C",
  "document_verified" boolean,
  "doc_verified_at" timestamptz,
  "doc_verified_by_name" text COLLATE "C",
  "doc_verified_by_id" text COLLATE "C",
  "doc_verification_notes" text COLLATE "C",
  "reviewed_by_admin_id" text COLLATE "C",
  "reviewed_by_admin_name" text COLLATE "C",
  "reviewed_at" timestamptz,
  "review_note" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "leads"."leads" IS 'Tirvona model collection leads. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "leads"."leads"."room_inventory" IS 'model field: roomInventory';
COMMENT ON COLUMN "leads"."leads"."agent_notes" IS 'model field: agentNotes';
COMMENT ON COLUMN "leads"."leads"."captured_by" IS 'model field: capturedBy';
COMMENT ON COLUMN "leads"."leads"."captured_by_name" IS 'model field: capturedByName';
COMMENT ON COLUMN "leads"."leads"."captured_at" IS 'model field: capturedAt';
COMMENT ON COLUMN "leads"."leads"."assigned_agent_id" IS 'model field: assignedAgentId';
COMMENT ON COLUMN "leads"."leads"."assigned_agent_name" IS 'model field: assignedAgentName';
COMMENT ON COLUMN "leads"."leads"."assigned_agent_code" IS 'model field: assignedAgentCode';
COMMENT ON COLUMN "leads"."leads"."field_verified" IS 'model field: fieldVerified';
COMMENT ON COLUMN "leads"."leads"."field_verified_at" IS 'model field: fieldVerifiedAt';
COMMENT ON COLUMN "leads"."leads"."field_verified_by_name" IS 'model field: fieldVerifiedByName';
COMMENT ON COLUMN "leads"."leads"."field_verified_by_id" IS 'model field: fieldVerifiedById';
COMMENT ON COLUMN "leads"."leads"."last_updated_by_name" IS 'model field: lastUpdatedByName';
COMMENT ON COLUMN "leads"."leads"."last_updated_by_role" IS 'model field: lastUpdatedByRole';
COMMENT ON COLUMN "leads"."leads"."document_checklist" IS 'model field: documentChecklist';
COMMENT ON COLUMN "leads"."leads"."document_category" IS 'model field: documentCategory';
COMMENT ON COLUMN "leads"."leads"."doc_verification_status" IS 'model field: docVerificationStatus';
COMMENT ON COLUMN "leads"."leads"."document_verified" IS 'model field: documentVerified';
COMMENT ON COLUMN "leads"."leads"."doc_verified_at" IS 'model field: docVerifiedAt';
COMMENT ON COLUMN "leads"."leads"."doc_verified_by_name" IS 'model field: docVerifiedByName';
COMMENT ON COLUMN "leads"."leads"."doc_verified_by_id" IS 'model field: docVerifiedById';
COMMENT ON COLUMN "leads"."leads"."doc_verification_notes" IS 'model field: docVerificationNotes';
COMMENT ON COLUMN "leads"."leads"."reviewed_by_admin_id" IS 'model field: reviewedByAdminId';
COMMENT ON COLUMN "leads"."leads"."reviewed_by_admin_name" IS 'model field: reviewedByAdminName';
COMMENT ON COLUMN "leads"."leads"."reviewed_at" IS 'model field: reviewedAt';
COMMENT ON COLUMN "leads"."leads"."review_note" IS 'model field: reviewNote';
COMMENT ON COLUMN "leads"."leads"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "leads"."leads"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "leads"."leads"."version" IS 'model field: __v';
ALTER TABLE "leads"."leads" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "leads_extra_e02141ac" ON "leads"."leads" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "leads_ix_e5b8dfb3" ON "leads"."leads" USING btree ("name");
CREATE INDEX "leads_ix_82110f0b" ON "leads"."leads" USING btree (("location" #> '{city}'));
CREATE INDEX "leads_ix_37302073" ON "leads"."leads" USING btree (("location" #> '{district}'));
CREATE INDEX "leads_ix_949d701f" ON "leads"."leads" USING btree ("interest");
CREATE INDEX "leads_ix_20b3ed65" ON "leads"."leads" USING btree ("status");
CREATE INDEX "leads_ix_def3150b" ON "leads"."leads" USING btree ("captured_by");
CREATE INDEX "leads_ix_2a65dd95" ON "leads"."leads" USING btree ("assigned_agent_id");
CREATE INDEX "leads_ix_8ec219c0" ON "leads"."leads" USING btree ("field_verified");
CREATE INDEX "leads_ix_82abfc2f" ON "leads"."leads" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "leads_ix_b70f11ff" ON "leads"."leads" USING btree ("captured_by", "created_at" DESC NULLS LAST);
CREATE INDEX "leads_ix_5096687e" ON "leads"."leads" USING btree (("meeting" #> '{requested}'), "created_at" DESC NULLS LAST);
CREATE INDEX "leads_ix_761dcb68" ON "leads"."leads" USING btree (("location" #> '{city}'), "status");
CREATE INDEX "leads_ix_18c912c0" ON "leads"."leads" USING btree (("location" #> '{district}'), "status");

REVOKE ALL ON "leads"."leads" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "leads"."leads" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "smart_contact"."smart_contact_audit_logs" (
  "id" text COLLATE "C" PRIMARY KEY,
  "profile_id" text COLLATE "C",
  "action" text COLLATE "C",
  "field" text COLLATE "C",
  "old_value" text COLLATE "C",
  "new_value" text COLLATE "C",
  "actor_id" text COLLATE "C",
  "actor_name" text COLLATE "C",
  "ip" text COLLATE "C",
  "created_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "smart_contact"."smart_contact_audit_logs" IS 'Tirvona model collection smart_contact_audit_logs. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "smart_contact"."smart_contact_audit_logs"."profile_id" IS 'model field: profileId';
COMMENT ON COLUMN "smart_contact"."smart_contact_audit_logs"."old_value" IS 'model field: oldValue';
COMMENT ON COLUMN "smart_contact"."smart_contact_audit_logs"."new_value" IS 'model field: newValue';
COMMENT ON COLUMN "smart_contact"."smart_contact_audit_logs"."actor_id" IS 'model field: actorId';
COMMENT ON COLUMN "smart_contact"."smart_contact_audit_logs"."actor_name" IS 'model field: actorName';
COMMENT ON COLUMN "smart_contact"."smart_contact_audit_logs"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "smart_contact"."smart_contact_audit_logs"."version" IS 'model field: __v';
ALTER TABLE "smart_contact"."smart_contact_audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "smart_contact_audit_logs_extra_eb848be5" ON "smart_contact"."smart_contact_audit_logs" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "smart_contact_audit_logs_ix_a7bd156a" ON "smart_contact"."smart_contact_audit_logs" USING btree ("profile_id");
CREATE INDEX "smart_contact_audit_logs_ix_02cfbbe7" ON "smart_contact"."smart_contact_audit_logs" USING btree ("action");
CREATE INDEX "smart_contact_audit_logs_ix_f92ca63c" ON "smart_contact"."smart_contact_audit_logs" USING btree ("profile_id", "created_at" DESC NULLS LAST);

REVOKE ALL ON "smart_contact"."smart_contact_audit_logs" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "smart_contact"."smart_contact_audit_logs" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "smart_contact"."smart_contact_events" (
  "id" text COLLATE "C" PRIMARY KEY,
  "profile_id" text COLLATE "C",
  "qr_id" text COLLATE "C",
  "event_type" text COLLATE "C",
  "session_hash" text COLLATE "C",
  "device_type" text COLLATE "C",
  "browser" text COLLATE "C",
  "os" text COLLATE "C",
  "country" text COLLATE "C",
  "state" text COLLATE "C",
  "city" text COLLATE "C",
  "referrer" text COLLATE "C",
  "source" text COLLATE "C",
  "created_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "smart_contact"."smart_contact_events" IS 'Tirvona model collection smart_contact_events. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "smart_contact"."smart_contact_events"."profile_id" IS 'model field: profileId';
COMMENT ON COLUMN "smart_contact"."smart_contact_events"."qr_id" IS 'model field: qrId';
COMMENT ON COLUMN "smart_contact"."smart_contact_events"."event_type" IS 'model field: eventType';
COMMENT ON COLUMN "smart_contact"."smart_contact_events"."session_hash" IS 'model field: sessionHash';
COMMENT ON COLUMN "smart_contact"."smart_contact_events"."device_type" IS 'model field: deviceType';
COMMENT ON COLUMN "smart_contact"."smart_contact_events"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "smart_contact"."smart_contact_events"."version" IS 'model field: __v';
ALTER TABLE "smart_contact"."smart_contact_events" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "smart_contact_events_extra_ab27e2ba" ON "smart_contact"."smart_contact_events" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "smart_contact_events_ix_a7bd156a" ON "smart_contact"."smart_contact_events" USING btree ("profile_id");
CREATE INDEX "smart_contact_events_ix_a8f13c5e" ON "smart_contact"."smart_contact_events" USING btree ("qr_id");
CREATE INDEX "smart_contact_events_ix_cbe055ed" ON "smart_contact"."smart_contact_events" USING btree ("event_type");
CREATE INDEX "smart_contact_events_ix_73c7a106" ON "smart_contact"."smart_contact_events" USING btree ("session_hash");
CREATE INDEX "smart_contact_events_ix_f92ca63c" ON "smart_contact"."smart_contact_events" USING btree ("profile_id", "created_at" DESC NULLS LAST);
CREATE INDEX "smart_contact_events_ix_d8e9c91e" ON "smart_contact"."smart_contact_events" USING btree ("profile_id", "event_type", "created_at" DESC NULLS LAST);
CREATE INDEX "smart_contact_events_ix_b56d3cf6" ON "smart_contact"."smart_contact_events" USING btree ("profile_id", "session_hash");
CREATE INDEX "smart_contact_events_ix_4e283daf" ON "smart_contact"."smart_contact_events" USING btree ("created_at");

REVOKE ALL ON "smart_contact"."smart_contact_events" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "smart_contact"."smart_contact_events" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "smart_contact"."smart_contact_profiles" (
  "id" text COLLATE "C" PRIMARY KEY,
  "uuid" text COLLATE "C",
  "employee_id" text COLLATE "C",
  "slug" text COLLATE "C",
  "first_name" text COLLATE "C",
  "last_name" text COLLATE "C",
  "display_name" text COLLATE "C",
  "organization" text COLLATE "C",
  "designation" text COLLATE "C",
  "department" text COLLATE "C",
  "role_line" text COLLATE "C",
  "primary_phone" text COLLATE "C",
  "secondary_phone" text COLLATE "C",
  "whatsapp_phone" text COLLATE "C",
  "email" text COLLATE "C",
  "website" text COLLATE "C",
  "address_line1" text COLLATE "C",
  "address_line2" text COLLATE "C",
  "city" text COLLATE "C",
  "district" text COLLATE "C",
  "state" text COLLATE "C",
  "postal_code" text COLLATE "C",
  "country" text COLLATE "C",
  "photo_url" text COLLATE "C",
  "photo_asset_id" text COLLATE "C",
  "brand_id" text COLLATE "C",
  "category" text COLLATE "C",
  "status" text COLLATE "C",
  "created_by_id" text COLLATE "C",
  "created_by_name" text COLLATE "C",
  "updated_by_id" text COLLATE "C",
  "updated_by_name" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "smart_contact"."smart_contact_profiles" IS 'Tirvona model collection smart_contact_profiles. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."employee_id" IS 'model field: employeeId';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."first_name" IS 'model field: firstName';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."last_name" IS 'model field: lastName';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."display_name" IS 'model field: displayName';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."role_line" IS 'model field: roleLine';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."primary_phone" IS 'model field: primaryPhone';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."secondary_phone" IS 'model field: secondaryPhone';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."whatsapp_phone" IS 'model field: whatsappPhone';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."address_line1" IS 'model field: addressLine1';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."address_line2" IS 'model field: addressLine2';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."postal_code" IS 'model field: postalCode';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."photo_url" IS 'model field: photoUrl';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."photo_asset_id" IS 'model field: photoAssetId';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."brand_id" IS 'model field: brandId';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."created_by_id" IS 'model field: createdById';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."created_by_name" IS 'model field: createdByName';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."updated_by_id" IS 'model field: updatedById';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."updated_by_name" IS 'model field: updatedByName';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "smart_contact"."smart_contact_profiles"."version" IS 'model field: __v';
ALTER TABLE "smart_contact"."smart_contact_profiles" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "smart_contact_profiles_extra_8f976fda" ON "smart_contact"."smart_contact_profiles" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE UNIQUE INDEX "smart_contact_profiles_uq_f2c66d23" ON "smart_contact"."smart_contact_profiles" USING btree ("uuid") NULLS NOT DISTINCT;
CREATE INDEX "smart_contact_profiles_ix_cb5d6c95" ON "smart_contact"."smart_contact_profiles" USING btree ("employee_id");
CREATE UNIQUE INDEX "smart_contact_profiles_uq_7a0923dd" ON "smart_contact"."smart_contact_profiles" USING btree ("slug") NULLS NOT DISTINCT;
CREATE INDEX "smart_contact_profiles_ix_19000cb1" ON "smart_contact"."smart_contact_profiles" USING btree ("brand_id");
CREATE INDEX "smart_contact_profiles_ix_5cd28265" ON "smart_contact"."smart_contact_profiles" USING btree ("category");
CREATE INDEX "smart_contact_profiles_ix_20b3ed65" ON "smart_contact"."smart_contact_profiles" USING btree ("status");
CREATE INDEX "smart_contact_profiles_ix_4852025e" ON "smart_contact"."smart_contact_profiles" USING btree ("slug", "status");
CREATE INDEX "smart_contact_profiles_ix_82abfc2f" ON "smart_contact"."smart_contact_profiles" USING btree ("status", "created_at" DESC NULLS LAST);
CREATE INDEX "smart_contact_profiles_ix_002f8430" ON "smart_contact"."smart_contact_profiles" USING btree ("category", "status");
CREATE INDEX "smart_contact_profiles_ix_1adffcbc" ON "smart_contact"."smart_contact_profiles" USING btree ("display_name", "email", "employee_id");

REVOKE ALL ON "smart_contact"."smart_contact_profiles" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "smart_contact"."smart_contact_profiles" FROM %s', r); END IF; END LOOP; END $$;

CREATE TABLE "smart_contact"."smart_contact_qr_codes" (
  "id" text COLLATE "C" PRIMARY KEY,
  "profile_id" text COLLATE "C",
  "qr_identifier" text COLLATE "C",
  "destination_url" text COLLATE "C",
  "source" text COLLATE "C",
  "formats" jsonb,
  "status" text COLLATE "C",
  "label" text COLLATE "C",
  "created_by_id" text COLLATE "C",
  "created_by_name" text COLLATE "C",
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "version" double precision,
  "_nulls" text[],
  "_extra" jsonb
);
COMMENT ON TABLE "smart_contact"."smart_contact_qr_codes" IS 'Tirvona model collection smart_contact_qr_codes. Layout: src/database/pg/registry.generated.ts';
COMMENT ON COLUMN "smart_contact"."smart_contact_qr_codes"."profile_id" IS 'model field: profileId';
COMMENT ON COLUMN "smart_contact"."smart_contact_qr_codes"."qr_identifier" IS 'model field: qrIdentifier';
COMMENT ON COLUMN "smart_contact"."smart_contact_qr_codes"."destination_url" IS 'model field: destinationUrl';
COMMENT ON COLUMN "smart_contact"."smart_contact_qr_codes"."created_by_id" IS 'model field: createdById';
COMMENT ON COLUMN "smart_contact"."smart_contact_qr_codes"."created_by_name" IS 'model field: createdByName';
COMMENT ON COLUMN "smart_contact"."smart_contact_qr_codes"."created_at" IS 'model field: createdAt';
COMMENT ON COLUMN "smart_contact"."smart_contact_qr_codes"."updated_at" IS 'model field: updatedAt';
COMMENT ON COLUMN "smart_contact"."smart_contact_qr_codes"."version" IS 'model field: __v';
ALTER TABLE "smart_contact"."smart_contact_qr_codes" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "smart_contact_qr_codes_extra_3863102d" ON "smart_contact"."smart_contact_qr_codes" USING gin ("_extra") WHERE "_extra" IS NOT NULL;
CREATE INDEX "smart_contact_qr_codes_ix_a7bd156a" ON "smart_contact"."smart_contact_qr_codes" USING btree ("profile_id");
CREATE UNIQUE INDEX "smart_contact_qr_codes_uq_fadfcd3d" ON "smart_contact"."smart_contact_qr_codes" USING btree ("qr_identifier") NULLS NOT DISTINCT;
CREATE INDEX "smart_contact_qr_codes_ix_536ef19e" ON "smart_contact"."smart_contact_qr_codes" USING btree ("source");
CREATE INDEX "smart_contact_qr_codes_ix_20b3ed65" ON "smart_contact"."smart_contact_qr_codes" USING btree ("status");
CREATE INDEX "smart_contact_qr_codes_ix_7e35767b" ON "smart_contact"."smart_contact_qr_codes" USING btree ("profile_id", "status", "created_at" DESC NULLS LAST);

REVOKE ALL ON "smart_contact"."smart_contact_qr_codes" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON "smart_contact"."smart_contact_qr_codes" FROM %s', r); END IF; END LOOP; END $$;

COMMIT;

