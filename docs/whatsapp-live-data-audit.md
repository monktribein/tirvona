# WhatsApp Live-Data Audit (Phase 1)

Date: 2026-09-22. Branch: `restore/refunds-and-platform-fixes`.
Builds on `docs/whatsapp-frontend-parity.md` (2026-09-21). Paths are relative to
`Newbackend/src/modules/`. Every claim below was read from source in this session.

## 1. Data-flow map per feature

### Stays (the only domain WhatsApp calls today)

| Step | Source of truth | WhatsApp call |
|---|---|---|
| Discovery | `ashrams` (`status:"approved"`, `deletedAt:null`) → `AshramsService.publicList` (`$regex` over name/description/history/city/district/state/amenities; `total`/`totalPages` returned) | `searchStays` → `publicList` **page 1, limit 8 only** |
| Destinations | `AshramsService.destinations()` aggregation | `topDestinations` (tap shortcut; typing any place still works) |
| Property detail | `AshramsService.detail` (approved only; enabled add-ons) | `propertyDetails` |
| Rooms | `rooms` (`status:"active"`, `deletedAt:null`) | `roomsFor` → **own `Room.find(...).limit(10)`**, shows raw `basePrice` |
| Availability | `room_inventories` via `AshramsService.publicCalendar` | `roomsFor` / `availabilityForRoom` |
| Quote | `BookingPricingService.quote` via `BookingsService.quote` (room rate snapshot incl. `discountPercent`, add-ons, flat services, extra guest, platform fee, GST, coupon) | `quoteStay`, `applyPromo` |
| Coupon | `booking_coupons` → `OffersService.validate` + pricing; per-user cap + atomic `remainingRedemptions` decrement in `create` | `applyPromo`, `listOffers` |
| Hold / create | `BookingsService.create` in a transaction: `holdInventory` conditional `$inc` per date, coupon reservation, identity code, `inventory_holds`, history, guests, outbox, audit | `createStayBooking` (`BookingActor`, `channel:"whatsapp"`) |
| Payment | `BookingPaymentLinkService` signed token → `public/pay/:token` → server-created Razorpay order → `confirmPayment` (order/amount bound) + webhook `confirmPaymentFromWebhook` | `createPaymentLink` |
| Confirmation | outbox → BullMQ worker → transactional WhatsApp templates | not sent from chat (by design) |
| My bookings | `BookingsService.historyFor` (owner filter: `customerId` or `whatsappCustomerId`) | `myStayBookings` — **first 10 only** |
| Detail / QR code | `BookingsService.get` (ownership via `bookingBelongsTo`) | `getBooking`; check-in code shown only when confirmed |
| Cancel / refund | `previewCancellation` + `cancel` (shared `computeCancellationRefund`, releases inventory, restores coupon, writes `BookingRefund`); `RefundsService.statusForBooking` | `previewCancellationRefund`, `cancelBooking`, `refundStatuses` |
| Hold expiry | `BookingMaintenanceService.expireHolds` (`@Interval 60s`) | — |
| Admin/owner visibility | same `bookings` collection; dashboard filters on `channel` without touching `bookingSource` | automatic |

### Parking, Aarti, Events, Marketplace (WhatsApp: "coming soon" + website link)

| Domain | Discovery | Create (atomic?) | Payment | Identity | Sweeper |
|---|---|---|---|---|---|
| Parking | `ParkingDiscoveryService.search/detail/availabilityFor` | `ParkingBookingService.create(user: AuthenticatedUser)`; `reserveInventory` in a transaction | own Razorpay order + confirm + webhook; **no login-free pay path** | `customerId: User` **required** | yes (`maintenanceSweep`) |
| Aarti | `AartiDiscoveryService.search/detail/passTypesFor` | `AartiBookingService.create(user)`; `reserveSeats` in a transaction | same as parking | `customerId: User` **required** | **none: expired holds never release seats** |
| Events | `EventDiscoveryService.search/detail/dayAvailability` | `EventRegistrationService.register(user)`; free | none (free) | `customerId: User` **required**; unique index `{eventId, attendDate, customerId}` | n/a |
| Marketplace | `CommerceService.products` | `MarketplaceOrderService.create(user)`; server-priced | same as parking | `customerId: User` **required** (orders, addresses, payments) | n/a |

All four take a website `AuthenticatedUser`, and parking also writes `source: "web"` as a fixed value.
For a WhatsApp sender matched to a website account this is usable today. For a WhatsApp-only
guest (the WAPP identity) it is not: they would need the same dual-identity change `Booking`
already has (see §4).

## 2. Findings: security and production data

| # | Severity | Finding | Location | Action this phase |
|---|---|---|---|---|
| F1 | **Critical** | Day-stay payment bypass. `POST /day-stay/confirm` marks a booking `fully_paid`/`confirmed` when the signature is omitted, or the ids start with `mock_`/`pay_sim_`, or the signature equals `demo_simulated_sig`. No production gate. The lookup is also not scoped to the caller, so any logged-in user can confirm anyone's day-stay booking by `bookingId` | `day-stay/application/day-stay-booking.service.ts` `confirmPayment` | **Fix** |
| F2 | High | Legacy `POST /marketplace/order` stores the client's `totalAmount` and items as a `processing` order in `orders`. No frontend or sibling app calls it | `commerce/application/commerce.service.ts` `order` | **Retire (410)** |
| F3 | Medium | Hold capacity fallback treats `totalInventory: 0` as unknown. `create` falls back to the room's *guest* capacity, and `holdInventory` falls back to 10. The public calendar treats 0 as 0, so the two disagree | `bookings.service.ts` `create`; `mongoose-booking.repository.ts` `holdInventory` | **Fix** |
| F4 | Medium | WhatsApp room rows show the MRP `basePrice`; pricing charges the discounted `sellingPrice` | `whatsapp-actions.service.ts` `roomsFor` | **Fix** |
| F5 | Medium | No re-quote before "Confirm": a price or offer change between summary and "yes" is charged silently | `conversation.service.ts` `createBooking` | **Fix** |
| F6 | Medium | Tapping a different ashram keeps the previous ashram's rooms/add-ons in session | `routeReplyId` `stay:` | **Fix** |
| F7 | Medium | Lists silently truncated: discovery (8), rooms (10), my bookings (10), cancel list (10) | conversation/actions | **Paginate** |
| F8 | Low | Domain refusals (already paid, hold expired, already cancelled, sold out at create, coupon cap) all become the generic apology | conversation | **Specific replies** |
| F9 | Medium | Aarti expired holds never release seats (no sweeper) | aarti | Report (Phase 4) |
| F10 | Low (dev only) | Parking/aarti/marketplace accept an unsigned confirmation when **no** Razorpay secret is set **and** `nodeEnv !== "production"`; production with a missing secret refuses. The website refuses `demo` order responses | three services | Report (isolated) |
| F11 | Info | Day-stay also falls back to `mock_order_…` when order creation fails; with F1 fixed that booking can no longer be confirmed without a real payment | day-stay | Covered by F1 |

Not found anywhere in production pricing/payment: `TEST1` (removed in Phase A), hardcoded
ashram/room/product lists, or fabricated booking ids.

## 3. Hardcoded business values that remain (domain, not WhatsApp)

Documented for the owner to decide; WhatsApp only displays what pricing returns:
- Extra-guest charge `max(0, guests − 2) × ₹200 × nights` (`booking-pricing.service.ts`).
- Flat services prasad ₹100/guest, meals ₹150/guest/night, parking ₹100/night, locker ₹50/night.
- Marketplace shipping ₹60 (free ≥ ₹999) and 5% GST.

## 4. Decision needed before Phases 3–6

Making parking, aarti, events and marketplace bookable by a **WhatsApp-only guest** requires, per module:
1. Schema: `customerId` optional + `whatsappCustomerId`, exactly-one validator (as `Booking` has), and
   migrating any unique index that includes `customerId` (events).
2. Service: accept a `BookingActor` instead of `AuthenticatedUser`, with ownership via an owner filter.
3. Payment: a signed login-free pay link + public endpoints + frontend page per module (the current
   token is `purpose: "stay_pay"` only).
4. Webhook: rebuild the actor from the payment row.
5. Provenance: a channel field (parking currently fixes `source: "web"`).

This is a schema change to four live collections and is the "risky architectural change" to confirm first.
The lower-risk alternative is to serve these modules to **matched website accounts only** (their
existing `User` id), and give WhatsApp-only guests a clear "link your number to a Tirvona account" path.
