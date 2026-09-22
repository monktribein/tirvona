# WhatsApp ↔ Frontend Parity Audit

Status: **AUDIT ONLY. No code has been changed, committed or deployed.**
Date: 2026-09-21. Branch: `restore/refunds-and-platform-fixes`.

Principle: the frontend is the source of truth for the customer experience; the backend domain
services are the source of truth for business rules. WhatsApp is a second frontend over the same
services. It must not duplicate pricing, inventory, coupon, payment or refund logic.

Evidence levels used below:
- **[V]** verified by reading the source directly in this session.
- **[A]** reported by an audit sub-agent from source reads, not independently re-checked.

Paths are relative to `Newbackend/src/modules/` (BE) and `frontend/src/` (FE) unless stated.

---

## 1. Frontend Route Map (customer-facing)

Source: `frontend/src/App.tsx` [V for the table, lines ~408-660].

| Route | Page | Auth | Purpose |
|---|---|---|---|
| `/`, `/public` | RoleAwareHome / HomePage | public | Home |
| `/search`, `/stays`, `/ashrams`, `/ashrams/:city` | SearchPage | public | Stay search (query params: destination, city, checkIn, checkOut, guests, promoCode, …) |
| `/ashrams/:city/:ashramSlug`, `/ashram/:id`, `/stay/:id` | AshramDetailPage | public | Property, rooms, offers, price breakdown **and the entire checkout + payment (embedded, no separate route)** |
| `/ashrams/:city/:ashramSlug/book` | AshramDetailPage | public | Same page |
| `/offers`, `/offers/:promoCode`, `/offers/category/:c`, `/offers/city/:c` | OffersPage / OfferDetailPage | public | Offer discovery |
| `/booking/:bookingReference`, `/profile/bookings/:bookingReference` | BookingDetailPage | **login** | Booking detail, cancel. No Pay button |
| `/profile`, `/profile/bookings`, `/profile/orders`, `/profile/coupons`, `/profile/payments`, `/profile/settings`, … | ProfileMainPage | login | My Bookings and profile tabs |
| `/parking`, `/parking/:city/:ashramSlug`, `/parking/:slug` | ParkingHub / ParkingDetail | public | Parking discovery |
| `/parking/checkout`, `/parking/booking/:ref`, `/parking/my-bookings` | Checkout / BookingDetail / MyBookings | login | Parking booking |
| `/aarti`, `/live-pooja`, `/aarti/:city/:slug`, `/pooja/:city/:slug`, `/aarti/:id` | AartiHub / AartiDetail / LivePooja | public | Aarti discovery |
| `/aarti/checkout`, `/aarti/booking/:ref`, `/profile/aarti` | Checkout / BookingDetail / MyBookings | login | Aarti booking |
| `/events`, `/events/:idOrSlug` | EventsHub / EventDetail | public | Event discovery and registration |
| `/events/pass/:id`, `/profile/events` | EventPass / MyPasses | login | Registration pass |
| `/marketplace`, `/marketplace/categories`, `/marketplace/category/:slug`, `/marketplace/products/:slug`, `/marketplace/product/:idOrSlug` | Marketplace pages | public | Products (Prashad = category `prasad`) |
| `/marketplace/checkout` | MarketplaceCheckoutPage | login | Order + payment |
| `/help`, `/contact`, `/faq`, `/cancellation-policy`, `/refund-policy`, `/stay-policies`, `/govt-guidelines`, `/terms`, `/privacy` | static pages | public | Help and policy text (static) |
| `/support`, `/profile/notifications` | SupportTickets / ProfileNotifications | login | Support tickets; notifications page is mock data |
| `*` | NotFoundPage | – | 404 (App.tsx:1203) |

Not audited (out of customer booking scope): admin and owner dashboards, temples, circuits, blog, volunteer, careers, local services, gate and staff pages.

---

## 2. Frontend Feature Map

Format: Frontend → API → BE controller/service → DTO → validation/pricing → WhatsApp equivalent.

### 2.1 Stays

| Feature | Frontend | API | BE service | Rules | WhatsApp equivalent |
|---|---|---|---|---|---|
| Search | SearchPage | `GET /ashrams` | `AshramsService.publicList` (ashrams.service.ts:354) [V] | Matches name, description, history, city, district, state, amenities (`$regex`, not text index). Filters city, state, type, guests (room `capacity ≥ guests`), dates via `discoveryDates`, price, rating | Already calls `publicList`. Needs: richer result cards, pagination, landmark expectations documented (see §6) |
| Property detail | AshramDetailPage | `GET /ashrams/:id`, `/by-slug/:city/:slug`, `/ashrams/:id/add-ons`, `/offers?ashramId=` | AshramsService | Ashram fields: `policies{checkInTime, checkOutTime, minStay, maxStay, cancellationPolicy}`, `address`, `amenities`, `nearbyAttractions`, `food` [V] | Progressive replies: summary → rooms → policies → offers |
| Room categories | AshramDetailPage room list | `GET /ashrams/:id` (rooms) | `Room` model | `type` ∈ dormitory/private_room/family_room/hall; `acType` AC/Non-AC; `capacity`; `totalInventory`; `basePrice`; `amenities[]`; `images[]`; embedded `pricingRules[]` [V] | List each category as a selectable row |
| Availability | room calendar | `GET` public calendar | `AshramsService.publicCalendar` | Per-date inventory | Already `availabilityForRoom` |
| Quote | AshramDetailPage (450ms debounce) | `POST /bookings/quote` (public, 60/min) | `BookingsService.quote` → `BookingPricingService.quote` [V] | See §3 | `quoteStay` must pass rooms[], services, promoCode |
| Create hold | Pay button | `POST /bookings/create` (`@Roles customer`) | `BookingsService.create` | Re-prices server-side; holds inventory 10 min; reserves coupon | `createStayBooking` (already actor-aware) |
| Payment | inline Razorpay modal | `POST :id/payment/order`, `POST :id/payment` | `paymentOrder`, `confirmPayment` | See §5 | Signed public pay page (§5) |
| My Bookings | ProfileMainPage / useMyBookings | `GET /bookings/history` | `historyFor` | Already supports `whatsappCustomerId` owners | `myStayBookings` exists |
| Booking detail | BookingDetailPage | `GET /bookings/:id` | `BookingsService.get` (id or `TRV-` ref) | Ownership via `bookingBelongsTo` | `getBooking` exists |
| Cancel | profile pages | `POST /bookings/:id/cancel` | `BookingsService.cancel` (line 1858) | See §3.6 | `cancelBooking` exists; preview is duplicated logic |

### 2.2 Offers and coupons [A unless marked]

| Feature | Frontend | API | Service | Rules |
|---|---|---|---|---|
| Offer list | OffersPage; AshramDetail available-offers | `GET /offers`, `GET /offers/public/all` | `OffersService.active` | Active, `validTill ≥ today`, `remainingRedemptions > 0`; filters category, city, ashramId |
| Validate code | AshramDetailPage `handleValidatePromo` | `POST /offers/validate-promo` | `OffersService` | Checks existence, status, dates, redemptions, ashram binding, applicableAshrams, minimum amount |
| Quote with code | quote call sends `promoCode` | `POST /bookings/quote` | `BookingPricingService` (lines 245-305) [V] | Adds room restriction (only when `rooms[]` sent). **Discount is computed on gross payable including platform fee and GST** |
| Apply at create | create payload `promoCode`, `appliedOfferId` | `POST /bookings/create` | `BookingsService.create` | Per-user limit check (409), atomic decrement of `remainingRedemptions`, redemption row `reserved` → `redeemed` on payment |

Coupon fields [A]: `promoCode`, `discountType` (`Percentage`, `Flat Amount`, plus four `Free …` types that compute ₹0), `discountValue`, `maximumDiscount`, `minimumBookingAmount`, `validFrom/Till`, `maximumRedemptions/remainingRedemptions`, `perUserLimit` (default 1), `ashramId`, `roomId`, `applicableAshrams`.
Not implemented anywhere: minimum nights, city/state/room-category enforcement, stay-date ranges, user restrictions, stacking. Only one code per booking.

### 2.3 Parking [A]
Discovery `GET /parking/locations` → `GET /parking/locations/:idOrSlug` → `GET /parking/locations/:id/availability` → `POST /parking/quote` → `POST /parking/bookings` → `POST …/payment/order` → `POST …/payment` → `GET …/qr`. Cancel `POST …/cancel` (preview `GET …/refund-preview`). Guests: none, `customerId` required.

### 2.4 Aarti [A]
`GET /aarti/sessions` → `GET /aarti/sessions/:id/passes?date=` → `POST /aarti/quote` → `POST /aarti/bookings` → payment order/confirm → `GET …/pass`. Cancel with `refund-preview`. Guests: none.

### 2.5 Events [A]
`GET /events` → `GET /events/:idOrSlug` (+`/days`) → `POST /events/registrations` → `GET …/pass`. **Free and unpaid; no payment or refund.** Guests: none.

### 2.6 Marketplace / Prashad [A]
`GET /marketplace/products` (Prashad = `category=prasad`) → `POST /marketplace/cart/quote` → `POST /marketplace/orders` → `POST …/payment/order` → `POST …/payment`. Cart is browser-only. Guests: none.

---

## 3. Stay Booking Architecture

### 3.1 Search → property → rooms
`publicList` matches `query|destination|category|search` against name/description/history/city/district/state/amenities [V]. Landmarks such as "Prem Mandir" match only if that text is in those fields. Owner-entered `nearbyAttractions[]` is **not** searched [V: not in the `$or` list].

### 3.2 Rooms and multiple rooms [V]
`CreateBookingDto` accepts `rooms: [{roomId, units 1-20}]`, or legacy `roomId + roomsBookedCount`. Multiple units of one category **and** multiple categories in one booking are both supported. The website sends `rooms` from `selectedRooms`.

### 3.3 Guests / occupancy [V]
- Backend takes only `guestsCount` (1-100). No adults/children split reaches the server; the FE sends `adults + children`.
- Server rule: `guestsCount ≤ Σ(room.capacity × units)`.
- Server extra-guest charge: `max(0, guestsCount − 2) × ₹200 × nights` (hard-coded).
- The FE local estimate uses `adults` only (`extraGuestCalc`), which differs; the FE displays the server quote when present.

### 3.4 Add-ons / services [V]
`services = { selectedAddOns: [{serviceId, quantity}], prasad:{ordered}, meals:{ordered}, parking:{ordered}, locker:{ordered} }`.
- `selectedAddOns` resolve against owner-defined add-on rows; quantity capped by `maxQuantity` (default 10); multiplier is nights for `per_day|per_bed|per_night`, `guestsCount` for `per_person`, 1 otherwise.
- The four flat services use **hard-coded defaults in `BookingPricingService`**: prasad ₹100×guests, meals ₹150×guests×nights, parking ₹100×nights, locker ₹50×nights.

### 3.5 Pricing (server-authoritative) [V, booking-pricing.service.ts:32-349]
```
basePrice        = Σ_nights Σ_rooms (customPrice ?? rule.overridePrice ?? embedded.overridePrice ?? room.basePrice × multiplier) × units
servicesPrice    = add-ons + flat services
originalAmount   = basePrice + servicesPrice
extraGuestAmount = max(0, guests − 2) × 200 × nights
platformFee/GST  = hotel ? 10% + 2% of originalAmount : resolvePlatformFee(settings, policy) + GST on the fee only
grossPayable     = originalAmount + extraGuestAmount + platformFee + gstAmount
discount         = coupon on grossPayable (capped by maximumDiscount and grossPayable)
totalAmount      = grossPayable − discount
```
Validation: ashram approved and not `bookingPaused`; 1-30 nights; rooms active and belonging to the ashram; guests ≤ capacity. **Quote does not check inventory availability**; the hold at create does.
Quote response exposes `pricing` (basePrice, servicesPrice, extraGuestAmount, mealAmount, discountAmount, gstAmount, gstPercent, platformFee, originalAmount, totalAmount, …), `nights`, `coupon`. `paymentSummary`, `services` and `policy` are computed but **not returned** by `BookingsService.quote`.

### 3.6 Cancellation and refund
- `BookingsService.cancel`: only `pending|confirmed`; owner cancel: `hoursBefore ≥ cancellationFreeHours(24)` → `refundBeforeWindowPercent(100)` else `refundInsideWindowPercent(0)`, applied to `amountPaid` when `fully_paid`; host/admin cancel: 100% [A, bookings.service.ts:1885-1918].
- It writes a `BookingRefund` row (dual-identity already), releases inventory, reverses commission and restores the coupon.
- **Two separate refund systems exist** [A]: cancel-time `BookingRefund` (manual finance processing) and the claim-based `refunds` module (`RefundRequest`, only place with a Razorpay refund call [V: single `payments.refund` call, refunds.service.ts:488]). They use different policy models and can give different amounts.
- WhatsApp's `previewCancellationRefund` **duplicates** the cancel formula [V] and reaches into `(this.pricing as any).policies`.

### 3.7 Identity model [V/A]
`Booking` has `customerId` (User) **or** `whatsappCustomerId` (exactly one, pre-validate hook). `BookingActor` + `actorFromResolvedIdentity` map a WhatsApp sender to either a phone-matched website account (`kind:"account"`, gets `userId`, no `principal`) or a WAPP guest. Bookings, payments, invoices, outbox notifications and cancellation already handle both.

---

## 4. Exact Data Models (summary)

| Model | Key fields | Source |
|---|---|---|
| Room | `ashramId, name, type(dormitory\|private_room\|family_room\|hall), acType, capacity, totalInventory, basePrice, description, amenities[], images[], pricingRules[], status` | ashram.schemas.ts:186 [V] |
| Ashram policies | `checkInTime, checkOutTime, minStay, maxStay, cancellationPolicy` | ashram.schemas.ts:51 [V] |
| CreateBookingDto | `ashramId, roomId?, rooms[{roomId,units}], checkInDate, checkOutDate, guestsCount, roomsBookedCount, services?, promoCode?, appliedOfferId?, specialRequests?, guests[]` | booking.dto.ts:28 [V] |
| ConfirmBookingPaymentDto | `razorpay_order_id/payment_id/signature, method, idempotencyKey?` | booking.dto.ts:47 [V] |
| Booking | `bookingId (TRV-…), customerId\|whatsappCustomerId, pricing{…}, status, paymentStatus, reservationExpiresAt, checkInCode (required, selectable), identityCode, offerId, promoCode, channel` | booking.schemas.ts [V/A] |
| Coupon (`booking_coupons`) / Redemption | See §2.2; redemption has `userId?`, `whatsappCustomerId?`, status `reserved\|redeemed\|released\|reversed` | booking-support.schemas.ts [A] |
| BookingRefund | `requestedBy`, `requestedByWhatsAppCustomerId`, status `pending…success` | booking-finance.schemas.ts [A] |
| RefundRequest | **`customerId` and `requestedBy` required User refs** | refund.schemas.ts:102,118 [V] |
| ParkingBooking | `customerId` required; vehicle number regex `^[A-Za-z]{2}[0-9]{1,2}[A-Za-z]{0,3}[0-9]{4}$`; footprint units per vehicle type | parking [A] |
| AartiBooking | `customerId` required; `passCount 1-50`, `devotees[]`, `sankalpName/Gotra`, `donationAmount` | aarti [A] |
| EventRegistration | `customerId` required; `seats 1-50`, `attendees[]`; ref `TVN-EVT-XXXXXXXX`; no price | events [A] |
| MarketplaceOrderRecord | `customerId` required; pricing = items + shipping (₹60, free ≥ ₹999) + 5% GST; status `pending_payment…refunded` | commerce [A] |

---

## 5. Payment Architecture

### 5.1 Current website flow (stays) [V/A]
All in `AshramDetailPage` (~lines 1040-1130), no payment route:
1. `POST /bookings/create` → hold (10 min default).
2. `POST /bookings/:id/payment/order` → `{orderId, amount, currency, keyId}`; amount = `round(booking.pricing.totalAmount × 100)` read from the DB, never from the client.
3. `openRazorpayCheckout` (frontend/src/lib/razorpay.ts).
4. `POST /bookings/:id/payment` with the Razorpay triple → HMAC verify → `confirmPayment`.
5. Razorpay webhook `POST /payments/razorpay/webhook` (public, HMAC-verified) also calls `confirmPaymentFromWebhook`, which rebuilds the actor from the Payment row (handles `whatsappCustomerId`).

Auth: create and payment endpoints need a JWT with a role; `/booking/:ref` needs login and has no Pay button, so **even website users have no payment recovery path** [A].

### 5.2 Why the current WhatsApp link fails [V]
`createPaymentLink` builds `${frontendUrl}/bookings/${ref}/pay?order=…`. No such route exists → `*` NotFoundPage. The code comment claiming Tirvona has a payment page is false. Tests only reference a placeholder `https://tirvona.com/pay`.

### 5.3 Is a signed public payment page necessary? **Yes** [A, consistent with V]
Guests have no JWT, and all payment endpoints require one. The service layer already works for guests (`assertCanPayFor` via `bookingBelongsTo`; webhook confirms without a session), so **only the transport is missing**.

### 5.4 Recommended design (not implemented)
1. Link carries a short-lived signed token (HMAC/JWT, dedicated secret): `{bookingId, identity (userId|whatsappCustomerId), purpose:"stay_pay", exp ≤ reservationExpiresAt}`. Do **not** create the Razorpay order at link time (currently creates an orphan order per link).
2. New `@Public()`, strictly throttled controller: `GET /public/pay/:token` (masked summary + status), `POST /public/pay/:token/order` (calls `paymentOrder` with an actor rebuilt from the DB, not from the token claims alone). Verify endpoint optional; page polls status, the webhook is authoritative.
3. New public FE route (outside `ProtectedRoute`) reusing `openRazorpayCheckout` unchanged.
4. Do **not** add a JWT alias `/bookings/:id/pay` for guests.
5. Hardening of the shared logic (also benefits the website) [A, item (a) verified V]:
   a. `confirmPayment` picks the pending Payment by `{bookingId, status:"pending"}` newest-first and does **not** check that `razorpay_order_id` belongs to this booking [V, bookings.service.ts:668-676]. The signature only proves the order/payment pair is genuine for this merchant. Require order-id match, ideally fetch the payment and check amount/status.
   b. `paymentOrder` creates a new Razorpay order and Payment row on every call; reuse a pending order.
   c. FE never sends `idempotencyKey`; backend supports it.
   d. Hold-expiry notification addresses `userId` only, so guests get no expiry message.
   e. Add a Pay button to `BookingDetailPage` for pending unexpired bookings.

Other modules (parking, aarti, marketplace) have dedicated checkout routes, their own `confirmPaymentFromWebhook` handlers, and the same guest-blocking `customerId` coupling.

---

## 6. WhatsApp Gap Analysis

| Feature | Frontend | Current WhatsApp | Required work | Domain service |
|---|---|---|---|---|
| Stay search | Filters, cards | `searchStays` (place/dates/guests, limit 8) | Pagination; result detail; nearby-landmark search is not supported by the website either | `AshramsService.publicList` |
| Property detail | Full page | Partial | Progressive detail: amenities, policies, check-in/out, images | `AshramsService` |
| Room categories | Multi-category list | `roomsFor` (10 rooms, limited fields) | Show capacity, AC, amenities, price, availability per category | Room model / `publicCalendar` |
| Multi-room | `rooms[{roomId,units}]` | **Hard-coded `units:1`** | Room quantity and multi-category selection | `BookingsService.quote/create` |
| Guests | adults + children → `guestsCount` | Total guests only | Ask adults/children; send total; show server extra-guest charge | quote (authoritative) |
| Add-ons | `selectedAddOns` + 4 flat services | **Not passed** | Add-on selection; show servicesPrice | `GET /ashrams/:id/add-ons`, quote |
| Offers | Offer list, room deals | None | List active offers for the ashram; explain unimplemented eligibility honestly | `OffersService.active` |
| Coupon | Validate + apply | **Never passes `promoCode`** | Apply code to quote and create; surface exact rejection message; per-user limit only surfaces at create (409) | `BookingPricingService`, `create` |
| Price breakdown | Server quote lines | Total only | Show basePrice, services, extra guest, platform fee, GST, discount, total from `pricing` | quote |
| Booking summary | Checkout panel | Basic | Full summary with cancellation policy text | ashram `policies` |
| Hold + create | Yes | Yes (`createStayBooking`) | Multi-room/services/promo pass-through | `BookingsService.create` |
| Payment | Razorpay modal | **Broken link** (§5.2) | Signed public pay page + endpoints | `paymentOrder/confirmPayment` |
| Confirmation | Success state, check-in code | Outbox template exists | Add QR/access info, arrival reference | outbox factory |
| My Bookings | Profile tab | `myStayBookings` | Booking list/detail actions, pay-now for pending | `historyFor/get` |
| Cancel | Generic confirm, no amount | Confirm step + preview | Replace duplicate preview with shared domain preview | `BookingsService.cancel` |
| Refund | Admin only; customer sees "refunded" text | Cancel path works | RefundRequest identity fix; unify or reconcile the two refund systems | `refunds`, `booking-finance` |
| Parking | Full flow | "Coming soon" stub | Guest identity in parking module + payment link + QR delivery | `ParkingBookingService` |
| Aarti | Full flow | Stub | Same | `AartiBookingService` |
| Events | Free registration | Stub | Guest identity in events; QR pass | `EventRegistrationService` |
| Prashad/Marketplace | Full flow | Stub | Guest identity in commerce; session cart; address capture; payment link | `MarketplaceOrderService` |
| Help/support | Ticket system | None | Support requires `userId`; needs guest design | `support` |

---

## 7. Meta / WhatsApp Limitations vs Implementation Gaps

**Genuine Meta/platform limits (to be confirmed against current Meta docs before design):**
- Interactive list messages: limited rows/sections and short titles → paginate results.
- Reply buttons: at most 3 per message.
- No embedded payment collection in this codebase's flow; Razorpay checkout cannot run inside WhatsApp → hosted page or payment link required.
- Free-form messages only inside the 24-hour customer-service window; outside it, approved templates are required.
- Images/documents supported (QR, room photos) via media upload.

**Everything else in §6 is an implementation gap, not a Meta limitation.** In particular: coupons, multi-room, add-ons, adults/children, breakdown, parking, aarti, events, marketplace and the payment link are all implementable.

---

## 8. Findings To Decide On Before Implementation

Pre-existing defects found during the audit (none fixed):

1. **`TEST1` coupon backdoor** in production pricing: `booking-pricing.service.ts:249` and `offers.service.ts:380` [V]. No environment gate; makes any booking ₹1. [A: validate returns a shape the website rejects; a real create would fail on the fake ObjectId.]
2. **Legacy `POST /marketplace/order`** trusts a client-supplied `totalAmount` and writes to a second collection [A].
3. **Demo-mode payment confirmation** accepted outside production when no Razorpay secret is set (parking, aarti, marketplace) [A].
4. **`confirmPayment` order-id not bound to the booking** [V] (§5.4a).
5. **`RefundRequest` not guest-safe** [V]: `refunds.service.ts:122` writes `String(booking.customerId)`, which is `"undefined"` for a guest booking; schema requires a User ref.
6. **Website offer detail link** calls `/offers/<promoCode>` but the backend `:id` route requires an ObjectId (`OffersService.one` → `objectId()`) [V]; it also increments `viewsCount` on every public read.
7. **No sweeper releases expired unpaid aarti holds** [A; grep confirmed no aarti cron, V]. Seats may leak. Needs a targeted check before relying on it.
8. **Refunds outside the `refunds` module are ledger-only** (stay cancel, parking, aarti); marketplace cancel refunds nothing [A/V: only one `payments.refund` call exists].
9. **Placeholder data on website**, conflicts with the project's no-placeholder rule: `ProfileCouponsPage`, `ProfilePaymentsPage`, `ProfileNotificationsPage`, `ProfileWishlistPage`, and a hard-coded "Kashi Guest House refund" entry [A].
10. **Free-type coupons** validate as valid with ₹0 discount and consume a redemption [A].
11. **Notifications for guest bookings lack an addressee**: room-assigned, check-in/out, reminder, expiry [A]. (Confirmation and cancellation are already dual-identity.)
12. **Analytics** exclude WhatsApp guest bookings from distinct-customer counts and show "Deleted account" for them [A].
13. Agent claim **rejected**: `checkInCode` is *not* `select:false`; it is `required:true` [V], so history returns it.

---

## 9. Implementation Plan (proposed; requires your approval)

Guest-identity pattern for every module: nullable `whatsappCustomerId` + nullable `customerId`, exactly-one validator, `BookingActor`-based service methods, `bookingOwnerFilter` / `bookingBelongsTo`, webhook rebuilds the actor from the Payment row. This is the pattern `Booking` already uses. No fake User accounts.

**Phase A: stay parity, no schema change**
1. Shared `computeCancellationRefund` + `BookingsService.previewCancellation` (+ optional `GET /bookings/:id/cancellation-preview`); WhatsApp uses it.
2. `quoteStay/createStayBooking`: multi-room, add-ons, promo, adults/children.
3. Room categories, offers list, coupon apply, price-breakdown replies, progressive property detail.
4. Redis session fields for rooms, add-ons, coupon, adults/children (preserve context on edits).

**Phase B: payment**
5. Signed public pay page + token endpoints + FE route (§5.4). Harden `confirmPayment` (order match, idempotency, order reuse).
6. Guest-safe expiry/reminder/check-in notifications.

**Phase C: refunds identity**
7. `RefundRequest` dual identity; refund notification carries `whatsappCustomerId`; decide unification of the two refund systems.

**Phase D: other modules, one at a time** (each: schema + service actor refactor + webhook + WhatsApp flow + tests)
8. Parking → 9. Aarti (+ hold sweeper) → 10. Events → 11. Marketplace/Prashad (session cart, address capture).

**Phase E: live testing** with your Meta test number; flows marked live-tested only after you confirm.

### Tests required
Stay: search, property, rooms, multi-room, guests, dates/times, offer, coupon (valid/expired/limit/wrong ashram/wrong room), breakdown equals `BookingsService.quote`, summary, hold, payment token (expired/tampered/wrong booking/already paid), payment success/failure, webhook duplicate + idempotency, confirmation, my bookings, cancel (owner vs other user), refund, context preservation, correction, session expiry, Hinglish/Hindi/Devanagari, signature validation.
Other modules: identity either-or, ownership isolation, capacity races, hold expiry, webhook actor rebuild, QR delivery.

## 10. Open Decisions For You
1. Remove/gate the `TEST1` backdoor (security)?
2. Which refund model wins, or keep both and reconcile?
3. Confirm payment approach: signed public page (recommended) vs Razorpay Payment Links.
4. Include the website fixes (Pay button, offer link, placeholder pages) or WhatsApp only?
5. Marketplace: guest cart and address storage as new collections, acceptable?
6. Events are free: confirm the WhatsApp registration flow needs no payment.
