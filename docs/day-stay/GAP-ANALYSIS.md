# Tirvona Day Stay Engine™ — Gap Analysis

**Date:** September 2026  
**Author:** Senior Full-Stack Engineer & Solution Architect  
**Platform:** Tirvona Accommodation Ecosystem  

---

## 1. Gap Analysis Matrix

| Requirement | Existing Capability | Gap | Proposed Change | Risk |
|---|---|---|---|---|
| **Property Master** | `AshramSchema` with location, trust info, policies, amenities, status, and verification. | Lacks Day Stay activation flags, Day Stay operating hours, Day Rest Verified criteria, and buffer configurations. | Add `dayStayConfig` subdocument to `AshramSchema` (`enabled`, `operatingHours`, `housekeepingBufferMinutes`, `gracePeriodMinutes`, `dayRestVerified`, `verifiedAmenities`). | Low |
| **Room Master** | `RoomSchema` with capacity, basePrice, acType, totalInventory. | Lacks Day Stay room allocation and product-specific pricing (Freshen-Up, Day Rest 3H, Day Rest 6H). | Add `dayStayConfig` to `RoomSchema` (`enabled`, `allocatedInventory`, `tierPricing` mapping duration to pricing/deposit). | Low |
| **Product Definitions** | Configured ad-hoc per overnight stay. | No dedicated configurable product catalog for time-based durations (90m, 180m, 360m). | Create `DayStayProduct` schema/catalog with dynamic durations, buffer rules, and display meta. | Low |
| **Time-Based Inventory** | `booking_daily_availability` tracks inventory per calendar date only. | Cannot manage intra-day time intervals, slots, grace windows, or turnaround buffers. | Create `DayStaySlotInventory` collection / time-range overlap query engine with atomic slot locks. | Medium (Concurrency) |
| **Booking Model** | `BookingSchema` tracks `checkInDate`, `checkOutDate`, `occupiedDates`. | No `bookingType`, `slotStartTime`, `slotEndTime`, `durationMinutes`, or extension status. | Add `bookingType` enum (`overnight`, `day_rest`, `freshen_up`), `dayStayDetails` (startTime, endTime, durationMinutes, graceExpiresAt, housekeepingEndsAt, extensionHistory). | Low (Backward compatible) |
| **Inventory Locking & Concurrency** | `BookingInventoryHoldSchema` holds whole-day units with TTL. | Holds only dates, not granular start/end time windows. | Extend hold schema or create `DayStayHoldSchema` with `[slotStartTime, slotEndTime]` and 10-minute hold TTL. | High (Race conditions during peak surges) |
| **Housekeeping Buffer** | `booking_housekeeping` manages room unit clean/dirty state. | No automatic dynamic block of 30/45/60 min between back-to-back day stays. | Integrate housekeeping buffer into availability math so next sellable slot begins after previous booking + grace + housekeeping buffer. | Medium |
| **Grace Period** | Manual reception check-in/out. | No automated grace period calculation (e.g. 15 mins) before flagging overstay. | Model configurable `gracePeriodMinutes` (default 15m) and `graceExpiresAt` timestamp on booking. | Low |
| **Extension Engine** | Not available (customers had to create new overnight booking). | Cannot dynamically check immediate forward availability, compute price differential, and extend active stay. | Implement `DayStayExtensionService` checking forward slot availability, creating extension payment hold, and updating booking on payment. | Medium |
| **Vendor / Owner Dashboard** | `OwnerDashboard.tsx`, `InventoryCalendarPage.tsx`, `ReceptionCheckinPage.tsx`. | No UI for Day Stay activation, time slot calendar, day stay check-in/out, overstay alerts, or prominent "BLOCK DAY STAY" control. | Add Day Stay management tab in Owner portal with quick block toggles (Today, Tomorrow, Date Range) and real-time Day Stay check-in radar. | Low |
| **Admin Verification & Governance** | `VerificationQueuePage.tsx`, `ManageAshramsPage.tsx`. | No dedicated "Tirvona Day Rest Verified™" audit checklist (bathrooms, linen, family suitability, hot water). | Add Day Rest Verification module to Admin portal with checklist, inspection photos, and badge issuance. | Low |
| **Customer Search & Discovery** | `SearchPage.tsx` search bar accepts Check-in & Check-out dates. | No Day Stay mode selector, arrival time picker, or duration tabs (90m Freshen-Up, 3h, 6h). | Extend Search bar with tabbed switch (`Overnight` / `Day Rest & Freshen-Up`), arrival time dropdown, and duration pills. | Low |
| **Property Page & Aesthetics** | `AshramDetailPage.tsx` displays overnight pricing and overnight amenities. | Lacks Day Stay room cards, bathroom photo prominence, verified pilgrim badges, and clear operational rule disclosure. | Add Day Stay duration selection pills, transparent breakdown of check-in/check-out/grace/towel policies, and bathroom photo gallery. | Low |
| **Payments & Refunds** | Razorpay payment order, verification, webhook, and refunds in place. | Extension payments and partial refunds for Day Stay cancellations not specifically orchestrated. | Reuse existing `payments` and `refunds` module with `DayStayBooking` transaction metadata. | Low |
| **Notifications** | BullMQ Outbox worker sends booking confirmations & check-in reminders. | Missing 30-min checkout reminders, extension prompts, overstay alerts to vendor, and pilgrim safety instructions. | Add Day Stay email/WhatsApp/Push notification templates in `notification.worker.ts`. | Low |
| **Reviews & Ratings** | `reviews.service.ts` calculates general property rating. | Does not isolate Day Stay cleanliness, bathroom hygiene, check-in speed, and family suitability ratings. | Add `bookingType` tag and specialized Day Stay review attributes (`bathroomCleanliness`, `familySuitability`, `checkInSpeed`). | Low |
| **Audit Logging & Analytics** | Audit logs and basic analytics exist. | Missing event instrumentation for day stay funnel (`day_rest_search`, `day_rest_extension_purchased`, etc.) and block audit logs. | Instrument Day Stay analytics events and write all vendor blocks/overrides to `audit` collection. | Low |

---

## 2. Summary of Key Architectural Findings

1. **Maximum Reuse**: The existing NestJS backend module structure (`application`, `domain`, `infrastructure`, `presentation`) and MongoDB Mongoose schemas can be cleanly extended with zero breaking changes to overnight stays.
2. **Backward Compatibility**: By making `bookingType` default to `'overnight'`, all existing queries and client code continue functioning without alteration.
3. **High Performance**: In-memory and index-backed time interval overlap queries (`{ $lt: requestedEnd, $gt: requestedStart }`) will provide sub-50ms availability lookups.
