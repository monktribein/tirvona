# Tirvona Day Stay Engine™ — Codebase Audit

**Date:** September 2026  
**Author:** Senior Full-Stack Engineer & Solution Architect  
**Platform:** Tirvona Accommodation Ecosystem  

---

## 1. Executive Summary & Architecture Overview

The Tirvona repository is an established pilgrimage accommodation and spiritual travel platform powering ashram, stay, temple, parking, and seva bookings.

### Technology Stack Summary
- **Backend**: NestJS (v11), TypeScript (v5.9), Express, Socket.IO, BullMQ for async queues, Pino for HTTP logging.
- **Database**: MongoDB with Mongoose (v9.9), utilizing optimistic concurrency (`versionKey` / version numbers) and partial unique indexes.
- **Frontend**: React 19, TypeScript, Vite 6, TailwindCSS v3, Framer Motion, TanStack React Query v5, Lucide Icons, Axios, i18next.
- **Authentication & RBAC**: JWT Bearer Tokens, Passport JWT & Google OAuth 2.0 strategies, Role-based access control (`roles.guard.ts` supporting `customer`, `ashram_owner`, `ashram_staff`, `admin`, `super_admin`).
- **Payments**: Razorpay Node SDK, webhook validation, refund handling via Razorpay refunds API.
- **Notifications**: Redis BullMQ background worker queue, Resend (Email), Firebase Admin / FCM (Push), WhatsApp Business API / Webhooks.
- **Real-Time Communication**: Socket.io gateways for live check-in events and occupancy updates.

---

## 2. Existing Accommodation Modules & Architecture

### A. Ashram / Property Model (`AshramSchema` in `ashram.schemas.ts`)
- Represents accommodation properties / ashrams (`ashrams` collection).
- Fields include:
  - `ownerId`: Reference to User.
  - `name`, `slug`, `citySlug`, `address` (GeoJSON coordinates `2dsphere`, city, district, pincode).
  - `pricing` (lowestNightPrice, totalCapacity).
  - `policies` (checkInTime, checkOutTime, minStay, maxStay, cancellationPolicy).
  - `status` (`pending_docs`, `pending_inspection`, `approved`, `rejected`, `suspended`).
  - `isVerified`: Boolean flag.
  - `bookingPaused`: Boolean pause flag.
  - `addOnServices`: Custom addon definitions per property.
  - `amenities`, `images`, `virtualTour360`, `rules`.

### B. Room Category Model (`RoomSchema` in `ashram.schemas.ts`)
- Belongs to `ashramId` (`rooms` collection).
- Attributes: `name`, `type` (`dormitory`, `private_room`, `family_room`, `hall`), `acType` (`AC`, `Non-AC`), `capacity`, `totalInventory`, `basePrice`, `sellingPrice`, `pricingRules`, `status` (`active`, `under_maintenance`).

### C. Daily Overnight Availability (`BookingInventorySchema` in `ashram.schemas.ts`)
- Collection: `booking_daily_availability`.
- Keys: `{ roomId, date }` (unique compound index).
- Tracks counts per calendar day: `totalInventory`, `heldCount`, `bookedCount`, `onlineBookedCount`, `offlineBookedCount`, `maintenanceCount`, `isClosed`.

---

## 3. Existing Booking Lifecycle & Concurrency Engine

### A. Booking Schema (`BookingSchema` in `booking.schemas.ts`)
- Collection: `booking_bookings`.
- Identifiers: `bookingId`, `reservationNumber`, `identityCode` (deterministic booking alphanumeric ID), `checkInCode`.
- Current Status Flow:
  - `pending` -> `confirmed` -> `checked_in` -> `checked_out` / `completed`
  - Cancellation/exceptions: `cancelled`, `refunded`, `no_show`, `expired`.
- Inventory Reservation:
  - Uses `BookingInventoryHoldSchema` (`booking_inventory` collection) indexed by `{ bookingId, roomId }` with `state: "held" | "confirmed" | "released" | "expired"` and TTL index on `expiresAt`.
- Concurrency Control:
  - Optimistic locking via mongoose versioning + MongoDB atomic `$inc` updates with conditional filters (`totalInventory - (bookedCount + heldCount) >= requestedUnits`) to prevent overselling.

---

## 4. Existing Payment & Refund Flow

- **Module**: `Newbackend/src/modules/payments` & `Newbackend/src/modules/refunds`.
- Integrated with Razorpay standard checkout flow:
  1. Order creation (`POST /api/payments/create-order` or during booking initiation).
  2. Frontend collects signature from Razorpay popup.
  3. Signature verification (`POST /api/payments/verify`) triggers state transition `pending` -> `confirmed`.
  4. Webhook listener (`POST /api/payments/webhook`) handles asynchronous payment capture, idempotency, and fallback booking confirmation.
  5. Refunds processed via Razorpay API with status records stored in `booking_refunds`.

---

## 5. Existing Notification & Real-Time System

- **Outbox & BullMQ Queue**: `Newbackend/src/modules/notifications`.
  - Notifications pushed to Redis queue `notification-outbox` and processed by worker `notification.worker.ts`.
  - Supported channels: Email (`resend`), WhatsApp templates, Push (`firebase-admin`).
  - Event triggers: booking confirmation, check-in code generation, check-in reminder, cancellation/refund.

---

## 6. Frontend Application & Reusable Components

- **Routing**: `react-router-dom` v7 in `frontend/src/App.tsx`.
- **Search & Discovery**:
  - `SearchPage.tsx`, `DestinationOverviewPage.tsx`, `HomePage.tsx`.
  - Filter by city/slug, dates, guests, room type, AC/Non-AC, price ranges.
- **Property Details & Booking**:
  - `AshramDetailPage.tsx`: displays property details, gallery, amenities, room cards, reviews, booking modal/drawer.
- **Vendor / Ashram Owner Portal**:
  - `OwnerDashboard.tsx`, `ManageRoomsPage.tsx`, `InventoryCalendarPage.tsx`, `ReceptionCheckinPage.tsx`, `OwnerBookingCenterPage.tsx`.
- **Admin Portal**:
  - `VerificationQueuePage.tsx`, `ManageAshramsPage.tsx`, `AuditLogsPage.tsx`.
- **Design System & Aesthetics**:
  - Warm saffron/amber/gold/slate spiritual-luxury aesthetic, glassmorphic cards, Lucide icons, responsive bottom sheets for mobile.

---

## 7. Potential Integration Points & Conflicts for Day Stay

| Module | Integration Point | Potential Risk / Conflict | Resolution Strategy |
|---|---|---|---|
| **Inventory** | `booking_daily_availability` vs. time-slots | Daily counters cannot represent hourly occupancy blocks | Introduce dedicated slot/time inventory model while linking to room inventory |
| **Booking Model** | `BookingSchema` checkInDate/checkOutDate | Existing schema expects dates, lacks explicit `bookingType`, `slotStartTime`, `slotEndTime`, `durationMinutes` | Add backward-compatible fields: `bookingType: 'overnight' \| 'day_rest' \| 'freshen_up'`, `timeSlot` metadata |
| **Search Engine** | `SearchPage.tsx` date picker | Currently assumes overnight check-in & check-out dates | Add tab for "Overnight Stays" vs "Day Rest & Freshen-Up" with time-slot selector |
| **Housekeeping** | `booking_housekeeping` | Existing housekeeping is room unit-based | Add automated turnaround buffer management (30/45/60m) between day rest slots |
| **Overnight Protection** | Night check-in buffer | Day stay running too late could collide with overnight check-in | Enforce strict operating window (e.g. 06:00 to 19:00) and buffer before standard check-in time |

---

## 8. Technical Risks & Recommended Approach

1. **Double Booking / Race Conditions**: High concurrency during Vrindavan peak festival days (e.g., Janmashtami, Radhashtami).
   - *Mitigation*: Leverage MongoDB atomic `$expr` conditional operators and transactional slot reservation locks with 10-minute hold TTL.
2. **Backward Compatibility**: Existing overnight booking API & mobile/web consumers must not break.
   - *Mitigation*: Default `bookingType = 'overnight'` on all schemas and maintain identical responses for overnight queries.
3. **Family/Pilgrim Brand Safety**: Avoiding generic "hourly hotel" optics.
   - *Mitigation*: Strict UI terminology ("Day Rest", "Freshen-Up", "Pilgrim Rest", "Yatra Shanti") and dedicated "Tirvona Day Rest Verified™" badge with verified amenities (clean private bathroom, fresh towels, geyser/hot water).
