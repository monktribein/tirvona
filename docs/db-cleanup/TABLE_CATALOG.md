# Tirvona production table catalog

Generated from the backend registry (172 tables = what the API requires). Decision for every table: **KEEP** (active) or **KEEP-EMPTY** (required by a live module, no rows yet). Counts are production rows on 2026-10-08.

Canonical answers: users `public.users` · stays `booking_bookings` · payments `booking_payments` · rooms `rooms` · properties `ashrams` · products `marketplaceproducts` · vendor products/orders `marketplace_master_orders` + `marketplace_vendor_orders` · coupons `booking_coupons` · reviews `booking_reviews` · support `booking_support_tickets` · notifications `notifications` / `user_notifications` / `push_campaigns` · events `event_festivals` (ashram-owned) · pilgrimage `pilgrimage_circuits` (ashram-owned).

## Aarti & temples

| Table | Rows | Decision |
|---|---|---|
| public.aarti_availability | 2 | KEEP |
| public.aarti_bookings | 3 | KEEP |
| public.aarti_commissions | 1 | KEEP |
| public.aarti_holidays | 0 | KEEP-EMPTY |
| public.aarti_notifications | 1 | KEEP |
| public.aarti_pass_types | 1 | KEEP |
| public.aarti_payments | 3 | KEEP |
| public.aarti_pricing | 0 | KEEP-EMPTY |
| public.aarti_qr_codes | 1 | KEEP |
| public.aarti_reviews | 0 | KEEP-EMPTY |
| public.aarti_scan_logs | 2 | KEEP |
| public.aarti_sessions | 3 | KEEP |
| public.aarti_settings | 0 | KEEP-EMPTY |
| public.aarti_staff | 0 | KEEP-EMPTY |
| public.aarti_streams | 12 | KEEP |
| public.aarti_transactions | 1 | KEEP |
| public.temple_aartis | 6 | KEEP |
| public.temple_festivals | 1 | KEEP |
| public.temples | 13 | KEEP |

## Content & community

| Table | Rows | Decision |
|---|---|---|
| public.banners | 23 | KEEP |
| public.blogauthors | 0 | KEEP-EMPTY |
| public.blogcomments | 3 | KEEP |
| public.blogposts | 12 | KEEP |
| public.featured_banners | 1 | KEEP |
| public.localserviceitems | 4 | KEEP |
| public.sacreddirectoryitems | 9 | KEEP |
| public.visitorarticlecomments | 1 | KEEP |
| public.visitorarticlelikes | 1 | KEEP |
| public.visitorarticles | 2 | KEEP |
| public.visitorarticlestatushistories | 6 | KEEP |
| public.volunteerapplications | 4 | KEEP |
| public.volunteerjobs | 8 | KEEP |

## Coupons & offers

| Table | Rows | Decision |
|---|---|---|
| public.booking_coupons | 5 | KEEP |

## Events

| Table | Rows | Decision |
|---|---|---|
| public.event_availability | 0 | KEEP-EMPTY |
| public.event_festivals | 0 | KEEP-EMPTY |
| public.event_notifications | 0 | KEEP-EMPTY |
| public.event_qr_codes | 0 | KEEP-EMPTY |
| public.event_registrations | 0 | KEEP-EMPTY |
| public.event_scan_logs | 0 | KEEP-EMPTY |
| public.event_settings | 0 | KEEP-EMPTY |
| public.event_staff | 0 | KEEP-EMPTY |
| public.eventfestivals | 2 | KEEP |

## Lead collection (field agents)

| Table | Rows | Decision |
|---|---|---|
| leads.lead_attendances | 31 | KEEP |
| leads.lead_location_pings | 48 | KEEP |
| leads.lead_regions | 0 | KEEP-EMPTY |
| leads.lead_users | 9 | KEEP |
| leads.leads | 118 | KEEP |

## Marketplace

| Table | Rows | Decision |
|---|---|---|
| public.marketplace_addresses | 3 | KEEP |
| public.marketplace_ledger_entries | 0 | KEEP-EMPTY |
| public.marketplace_master_orders | 0 | KEEP-EMPTY |
| public.marketplace_payouts | 0 | KEEP-EMPTY |
| public.marketplace_reviews | 0 | KEEP-EMPTY |
| public.marketplace_settings | 0 | KEEP-EMPTY |
| public.marketplace_vendor_bank_accounts | 0 | KEEP-EMPTY |
| public.marketplace_vendor_documents | 2 | KEEP |
| public.marketplace_vendor_orders | 0 | KEEP-EMPTY |
| public.marketplace_vendors | 3 | KEEP |
| public.marketplacecategories | 4 | KEEP |
| public.marketplaceorders | 3 | KEEP |
| public.marketplaceproducts | 7 | KEEP |
| public.marketplacewaitlists | 0 | KEEP-EMPTY |
| public.servicebookings | 0 | KEEP-EMPTY |
| public.serviceproviders | 7 | KEEP |

## Notifications

| Table | Rows | Decision |
|---|---|---|
| public.notifications | 26 | KEEP |
| public.push_campaigns | 10 | KEEP |
| public.user_notifications | 289 | KEEP |

## Parking

| Table | Rows | Decision |
|---|---|---|
| public.parking_availability | 40 | KEEP |
| public.parking_bookings | 40 | KEEP |
| public.parking_commissions | 21 | KEEP |
| public.parking_holidays | 3 | KEEP |
| public.parking_locations | 3 | KEEP |
| public.parking_notifications | 30 | KEEP |
| public.parking_partners | 3 | KEEP |
| public.parking_payments | 39 | KEEP |
| public.parking_pricing | 29 | KEEP |
| public.parking_qr_codes | 72 | KEEP |
| public.parking_reviews | 3 | KEEP |
| public.parking_scan_logs | 40 | KEEP |
| public.parking_settings | 1 | KEEP |
| public.parking_slot_types | 13 | KEEP |
| public.parking_slots | 142 | KEEP |
| public.parking_staff | 16 | KEEP |
| public.parking_transactions | 26 | KEEP |
| public.parking_vehicle_types | 9 | KEEP |

## Payments, refunds, payouts, wallet

| Table | Rows | Decision |
|---|---|---|
| public.payment_webhook_events | 106 | KEEP |
| public.payout_audit_logs | 1 | KEEP |
| public.payout_bank_accounts | 1 | KEEP |
| public.payout_requests | 0 | KEEP-EMPTY |
| public.payout_transactions | 0 | KEEP-EMPTY |
| public.payout_webhooks | 0 | KEEP-EMPTY |
| public.pilgrim_wallet_holds | 0 | KEEP-EMPTY |
| public.pilgrim_wallet_transactions | 0 | KEEP-EMPTY |
| public.pilgrim_wallet_withdrawals | 0 | KEEP-EMPTY |
| public.pilgrim_wallets | 0 | KEEP-EMPTY |
| public.refund_audit_logs | 0 | KEEP-EMPTY |
| public.refund_calculations | 0 | KEEP-EMPTY |
| public.refund_documents | 0 | KEEP-EMPTY |
| public.refund_policies | 0 | KEEP-EMPTY |
| public.refund_requests | 0 | KEEP-EMPTY |
| public.refund_status_history | 0 | KEEP-EMPTY |
| public.refund_transactions | 0 | KEEP-EMPTY |
| public.refund_webhooks | 0 | KEEP-EMPTY |

## Pilgrimage & planner

| Table | Rows | Decision |
|---|---|---|
| public.pilgrimage_circuits | 0 | KEEP-EMPTY |
| public.pilgrimage_itineraries | 0 | KEEP-EMPTY |
| public.pilgrimage_settings | 0 | KEEP-EMPTY |
| public.pilgrimage_stops | 0 | KEEP-EMPTY |
| public.pilgrimagecircuits | 3 | KEEP |
| public.plannertemplates | 1 | KEEP |
| public.tripitineraries | 22 | KEEP |

## Platform, audit & admin

| Table | Rows | Decision |
|---|---|---|
| public.activitylogs | 1 | KEEP |
| public.approval_requests | 0 | KEEP-EMPTY |
| public.audit_logs | 136 | KEEP |
| public.contentchangerequests | 13 | KEEP |
| public.institutioncontacts | 0 | KEEP-EMPTY |
| public.institutionlocations | 0 | KEEP-EMPTY |
| public.institutionmasters | 0 | KEEP-EMPTY |
| public.institutionqualityaudits | 0 | KEEP-EMPTY |
| public.platform_settings | 1 | KEEP |
| public.room_category_requests | 0 | KEEP-EMPTY |
| public.url_redirects | 21 | KEEP |

## Properties, rooms & inventory

| Table | Rows | Decision |
|---|---|---|
| public.ashrams | 28 | KEEP |
| public.booking_identity_counters | 19 | KEEP |
| public.booking_identity_properties | 14 | KEEP |
| public.day_stay_products | 2 | KEEP |
| public.inventory_return_requests | 3 | KEEP |
| public.offline_inventory_transfers | 10 | KEEP |
| public.offline_rooms | 4 | KEEP |
| public.room_rates | 9 | KEEP |
| public.rooms | 125 | KEEP |

## Reviews & support

| Table | Rows | Decision |
|---|---|---|
| public.booking_reviews | 3 | KEEP |
| public.booking_support_tickets | 2 | KEEP |
| public.support_attachments | 0 | KEEP-EMPTY |
| public.support_categories | 14 | KEEP |
| public.support_counters | 1 | KEEP |
| public.support_ticket_activities | 5 | KEEP |
| public.support_ticket_messages | 3 | KEEP |

## Smart Contact QR cards

| Table | Rows | Decision |
|---|---|---|
| smart_contact.smart_contact_audit_logs | 36 | KEEP |
| smart_contact.smart_contact_events | 14 | KEEP |
| smart_contact.smart_contact_profiles | 1 | KEEP |
| smart_contact.smart_contact_qr_codes | 1 | KEEP |

## Stay bookings

| Table | Rows | Decision |
|---|---|---|
| public.booking_addons | 3 | KEEP |
| public.booking_audit_logs | 257 | KEEP |
| public.booking_bookings | 203 | KEEP |
| public.booking_checkins | 14 | KEEP |
| public.booking_checkouts | 10 | KEEP |
| public.booking_commissions | 49 | KEEP |
| public.booking_daily_availability | 246 | KEEP |
| public.booking_guest_details | 183 | KEEP |
| public.booking_holidays | 0 | KEEP-EMPTY |
| public.booking_housekeeping | 54 | KEEP |
| public.booking_inventory | 181 | KEEP |
| public.booking_invoices | 49 | KEEP |
| public.booking_ledger | 49 | KEEP |
| public.booking_notifications | 416 | KEEP |
| public.booking_offer_redemptions | 12 | KEEP |
| public.booking_payment_events | 49 | KEEP |
| public.booking_payments | 153 | KEEP |
| public.booking_policies | 0 | KEEP-EMPTY |
| public.booking_pricing | 0 | KEEP-EMPTY |
| public.booking_receipts | 63 | KEEP |
| public.booking_refunds | 3 | KEEP |
| public.booking_reports | 0 | KEEP-EMPTY |
| public.booking_room_assignments | 15 | KEEP |
| public.booking_settlements | 0 | KEEP-EMPTY |
| public.booking_status_history | 452 | KEEP |
| public.booking_tax_records | 49 | KEEP |
| public.booking_transactions | 63 | KEEP |

## Users, auth & sessions

| Table | Rows | Decision |
|---|---|---|
| public.auth_challenges | 227 | KEEP |
| public.usermemories | 1382 | KEEP |
| public.users | 153 | KEEP |
| public.whatsapp_customers | 2 | KEEP |
| public.whatsapp_inbound_events | 337 | KEEP |

## Retained exceptions (documented)

| Table | Rows | Why |
|---|---|---|
| eventfestivals / pilgrimagecircuits / tripitineraries / plannertemplates | 2/3/22/1 | Platform-wide content with no owning ashram; canonical for platform content (new modules are ashram-owned) |
| marketplaceorders | 3 | The only record of 3 paid pre-vendor orders; not migrated (needs vendor + would create settlements) |
