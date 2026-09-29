# Marketplace module (multi-vendor)

Backend only. Lives entirely in `src/modules/marketplace/`. All routes are under the global `/api` prefix and appear in Swagger under the **Marketplace …** tags.

## What it reuses (unchanged)

| Need | Reused from |
|---|---|
| Users, login, JWT, roles | `auth`, `users`, global `JwtAuthGuard` + `RolesGuard` (`super_admin` always passes) |
| Audit trail | `audit_logs` via `AuditModule` (`module: "marketplace"`, `action: "marketplace.*"`) |
| Customer addresses | `marketplace_addresses` (the existing `/api/marketplace/addresses` book), read-only |
| Payments | Tirvona Razorpay keys + the existing `/api/payments/webhook` dispatcher |
| Bank-account encryption | `payouts/infrastructure/bank-account.crypto` (AES-256-GCM) |
| Bank transfers | `payouts/providers/razorpayx-payout.provider` (RazorpayX; manual transfers when not configured) |
| File storage | Documents/images are URLs from the existing `POST /api/uploads` |
| Transactions | `TransactionService` |

Outside this folder there are only three wiring lines: `app.module.ts` (register `MarketplaceModule`), `payments.module.ts` (import it), and `payments-webhook.service.ts` (one dispatch line so verified Razorpay webhooks confirm marketplace orders).

## Collections

| Collection | Model | Notes |
|---|---|---|
| `marketplace_vendors` | `MpVendor` | 1 per user (`userId` unique), `slug` unique, status lifecycle, admin-only `commissionPercent` override |
| `marketplace_vendor_documents` | `MpVendorDocument` | KYC metadata + file URL, `pending/verified/rejected` |
| `marketplace_vendor_bank_accounts` | `MpVendorBankAccount` | encrypted account number, only last 4 ever returned |
| `marketplacecategories` | `MpCategory` | shared with the retired Prasad catalog; only documents with `scope: "vendor_marketplace"` belong to the marketplace; adds `parentId`, `sortOrder`, `commissionPercent` |
| `marketplaceproducts` | `MpProduct` | shared with the retired Prasad catalog; only vendor products (with `vendorId` + approval) are ever listed or sold; adds `vendorId`, `categoryId`, `approvalStatus`, `listingStatus`, `sku`, `inventory.{trackInventory,reserved,sold,lowStockThreshold}` |
| `marketplace_master_orders` | `MpMasterOrder` | one per checkout; payment state; shipping snapshot |
| `marketplace_vendor_orders` | `MpVendorOrder` | one per vendor per checkout; embedded item snapshots; fulfilment + settlement state |
| `marketplace_ledger_entries` | `MpLedgerEntry` | append-only; `idempotencyKey` unique |
| `marketplace_payouts` | `MpPayout` | payout requests and their status history |
| `marketplace_settings` | `MpSettings` | single `key: "default"` document |
| `marketplace_reviews` | `MpReview` | verified-purchase reviews, one per (customer, product, vendor order) |

### The retired Prasad catalog
The old Prasad catalog is **not part of the marketplace**. Its products and categories stay untouched in the shared collections, but the marketplace ignores them: products need a `vendorId` + approval to be listed or sold, and categories need `scope: "vendor_marketplace"` (set on every category created through the admin API). The old catalog/checkout endpoints were removed; only the customer address book (`/api/marketplace/addresses`) and the webhook confirmation of already-created old orders remain in `commerce`.
* `status` is the public visibility flag: `"active"` = listed, `"suspended"` = hidden.
* `stock` is the available-quantity counter; `inventory.reserved/sold` track holds and sales.
* Selling price = `salePrice ?? price`.

## Lifecycles

**Vendor:** `draft → pending_verification → (under_review) → approved → active`, and `active ⇄ suspended`, `rejected → pending_verification` (resubmit), `* → deactivated`.
Submitting needs `identity` + `address_proof` documents, an address and a phone. Going `active` needs a bank account. Only `active` stores can submit products, receive orders or request payouts. Suspending hides every product at once; reactivating re-lists only approved + active ones.

**Product:** approval `not_submitted → pending → approved | rejected`, listing `draft | active | inactive | archived`. Public = approved + listing active + not admin-disabled + vendor active. Editing name/description/images/category/specifications (and similar) sends an approved product back to `pending` (hidden). Price and stock edits don't. Admin-disabled products can't be re-enabled by the vendor.

**Order:** `checkout` reserves stock (atomic, all-or-nothing), then creates the master order + vendor orders in one transaction, then the Razorpay order. Unpaid holds expire after `reservationMinutes` (cron every 5 minutes) and release stock. Payment is confirmed only by a verified Razorpay signature for **this** order's gateway order id, or by the verified webhook with a matching captured amount. The `pending → paid` flip is a single conditional update, so a racing callback + webhook confirm once.
Vendor order: `confirmed → processing → shipped → delivered → return_requested → returned → refunded`, `confirmed/processing → cancelled → refunded`.

**Money:**
* Commission is resolved per product: vendor override → nearest category up the tree → global default, then frozen on the order.
* Vendor earning = subtotal + GST + shipping − commission.
* Ledger: on payment `sale_credit` + `commission_debit` (pending). On delivery they become available after `settlementHoldDays`. A refund writes `refund_debit` + `commission_reversal_credit`.
* Payout request = immediate `payout_debit` (so funds can't be requested twice; per-vendor lock). Failed/cancelled payouts write `payout_reversal_credit`.
* Balances are always derived from the ledger, never stored.

**Refunds** go through Razorpay. A vendor order is marked `refunded` only after the gateway accepts; otherwise `refundError` is set and an admin can retry.

## API

Vendor (`/api/marketplace/vendor`, any signed-in user; everything scoped to the caller's own store):
`POST|GET|PUT profile`, `POST profile/submit|activate|deactivate`, `POST documents`, `DELETE documents/:id`, `GET|POST bank-accounts`, `POST bank-accounts/:id/default`, `DELETE bank-accounts/:id`, `POST|GET products`, `GET products/low-stock`, `GET|PUT products/:id`, `POST products/:id/submit`, `PATCH products/:id/listing|stock`, `GET orders`, `GET orders/:id`, `PATCH orders/:id/fulfillment`, `GET wallet`, `GET ledger`, `GET|POST payouts`, `POST payouts/:id/cancel`.

Checkout (`/api/marketplace/checkout`, signed-in): `POST orders`, `POST orders/:id/payment`, `GET orders`, `GET orders/:id`, `POST orders/:id/cancel`, `POST vendor-orders/:id/return`, `POST reviews`.

Public (`/api/marketplace/store`): `GET categories`, `GET products` (search, categoryId incl. sub-categories, vendorSlug, min/maxPrice, inStock, sortBy, page, limit), `GET products/:idOrSlug`, `GET products/:id/reviews`, `GET vendors/:slug`, `POST cart/quote`.

Admin (`/api/marketplace/admin`; `super_admin` + `marketplace_manager`; money actions `super_admin` + `finance_manager`; settings and commission overrides `super_admin` only):
`GET vendors`, `GET vendors/:id`, `POST vendors/:id/status {action: start_review|approve|reject|suspend|reactivate}`, `PUT vendors/:id/commission`, `PATCH documents/:id`, `PATCH bank-accounts/:id`, `GET vendors/:id/wallet|ledger`, `POST vendors/:id/adjustments`, `GET products`, `GET products/:id`, `POST products/:id/review|disable`, `GET|POST categories`, `PUT categories/:id`, `POST categories/reorder`, `GET orders`, `GET orders/:id`, `GET vendor-orders`, `PATCH vendor-orders/:id/fulfillment`, `POST vendor-orders/:id/return|retry-refund`, `POST orders/expire-stale`, `GET finance/commission`, `GET payouts`, `POST payouts/:id/approve|sync|mark-paid|mark-failed`, `PATCH reviews/:id`, `GET reviews`, `GET|PUT settings`, `GET overview`.

## Settings (`PUT /api/marketplace/admin/settings`)

`defaultCommissionPercent` (default **0**, set it), `settlementHoldDays` (default **0**), `returnWindowDays` (default **0** = returns off), `defaultGstPercent` (5), `shippingFee` (60), `freeShippingAbove` (999), `reservationMinutes` (15), `minimumPayoutAmount` (100). Env vars `MARKETPLACE_DEFAULT_COMMISSION_PERCENT`, `MARKETPLACE_SETTLEMENT_HOLD_DAYS` and `MARKETPLACE_RETURN_WINDOW_DAYS` seed the first three until saved. Keep `settlementHoldDays ≥ returnWindowDays` so money isn't paid out before the return window closes.

## Indexes

Production runs with `autoIndex` off. After deploying, run once (safe to repeat):

```
npx ts-node src/modules/marketplace/scripts/create-marketplace-indexes.ts
```

## Tests

`npx jest src/modules/marketplace`: the specs run the real services against in-memory models (`testing/`) that use the real schemas, MongoDB query semantics (`sift`), atomic conditional updates and unique-key errors.
