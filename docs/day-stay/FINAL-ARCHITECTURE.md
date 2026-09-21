# TIRVONA DAY STAY ENGINE™ — FINAL ARCHITECTURE SPECIFICATION

## 1. Architectural Principles & Overview

The **Tirvona Day Stay Engine™** is designed as a native, non-destructive extension of Tirvona's existing modular monolith architecture (NestJS + MongoDB / Mongoose + React / Vite). It provides short-duration accommodation and freshen-up capabilities (`FRESHEN_UP` 90m, `DAY_REST_3H` 3h, `DAY_REST_6H` 6h) for religious pilgrimage markets (initial pilot: Vrindavan / Braj) without altering or degrading the core overnight accommodation system.

```
+-----------------------------------------------------------------------------------+
|                            Tirvona Platform Hierarchy                             |
|                                                                                   |
|  [Platform Defaults]                                                              |
|       │                                                                           |
|       ▼                                                                           |
|  [Property (Ashram) DayStayConfig] ────► Operating Hours, Grace, Buffer, Blocks   |
|       │                                                                           |
|       ▼                                                                           |
|  [Room DayStayConfig]              ────► Enabled, Custom Pricing, Multipliers     |
|       │                                                                           |
|       ▼                                                                           |
|  [Day Stay Product Catalog]        ────► FRESHEN_UP (90m), DAY_REST_3H/6H         |
|       │                                                                           |
|       ▼                                                                           |
|  [Booking Snapshot]                ────► Immutable snapshot at checkout time      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Configuration Inheritance Hierarchy

To ensure deterministic operations and historical integrity, business rules and pricing flow down through a strict hierarchy and are permanently snapshotted upon booking creation:

1. **Platform Default Level**:
   - Operating Hours: `06:00` – `20:00` IST
   - Slot Stepping: `30` minutes
   - Grace Period: `15` minutes
   - Housekeeping / Turnaround Buffer: `45` minutes
   - Hold Expiration Window: `10` minutes (`600` seconds)
2. **Property (Ashram) Level** (`ashram.dayStayConfig`):
   - Property-specific opening/closing hours
   - Property-level grace period & housekeeping buffer overrides
   - Master Day Stay toggle (`enabled: boolean`)
   - 1-Click Operational Blocks (`isBlockedToday`, `blackoutDates`)
3. **Room Level** (`room.dayStayConfig`):
   - Room-specific Day Stay eligibility (`enabled: boolean`)
   - Room-level custom duration pricing or multipliers
4. **Product Definition Level** (`DayStayProduct`):
   - Base duration minutes (`90`, `180`, `360`)
   - Product code (`FRESHEN_UP`, `DAY_REST_3H`, `DAY_REST_6H`)
   - Display labels, amenities included, and base price formulas
5. **Booking Snapshot Level** (`booking.dayStayDetails`):
   - Snapshots exact product code, start/end time, duration minutes, grace minutes, buffer minutes, rates, taxes, and cancellation policies at the instant of order creation.
   - Any future modifications to property or room pricing **never** mutate existing confirmed booking snapshots.

---

## 3. Inventory & Time-Slot Availability Engine

Availability operates on continuous time intervals rather than calendar-night buckets.

### Effective Occupation Window Formula
For any booking $B_i$:
$$\text{Window}(B_i) = \left[ T_{\text{start}}, \; T_{\text{start}} + D_{\text{duration}} + G_{\text{grace}} + H_{\text{housekeeping}} \right)$$

### Overlap Invariant
Two bookings $A$ and $B$ conflict if and only if:
$$\max(T_{\text{start}}^A, T_{\text{start}}^B) < \min(T_{\text{end\_effective}}^A, T_{\text{end\_effective}}^B)$$

### Overnight Coexistence Rule
1. **Day Stay vs Overnight Check-In**: A Day Stay effective window $\left[ T_{\text{start}}, T_{\text{end\_effective}} \right)$ must complete on or before the standard overnight check-in time (`12:00` IST on check-in day).
2. **Day Stay vs Overnight Check-Out**: A Day Stay cannot begin until after standard overnight check-out (`10:00` or `11:00` IST) plus the mandatory housekeeping turnaround buffer.
3. **Overnight Precedence**: Active overnight reservations deduct from the physical room inventory pool during overnight hours (`12:00` to next day `11:00`).

---

## 4. Concurrency & Hold Locking Architecture

```
[Customer Browser]               [DayStayService]               [MongoDB / Memory]
        │                               │                               │
        │── 1. Create Hold ────────────►│                               │
        │   (roomId, slot, product)     │── 2. Check Overlap Lock ─────►│
        │                               │   (Atomic Hold Registration)  │
        │                               │                               │
        │                               │◄─ 3. Hold Granted (10m TTL) ──│
        │◄─ 4. Hold & Razorpay Order ───│                               │
        │                               │                               │
```

- **Atomic Hold Allocation**: Creating a hold verifies real-time capacity and writes a hold record with a 10-minute expiration TTL.
- **Active Capacity Deduction**: Both active holds (`expiresAt > now`) and confirmed bookings (`status: "confirmed"`) count against physical capacity.
- **Hold Expiry & Release**: Expired holds (`expiresAt <= now`) are automatically ignored during availability checks, unlocking the slot immediately without requiring batch cleanup cron jobs.

---

## 5. Dual-Path Idempotent Payment Architecture

To eliminate dropped transactions across flaky mobile network environments in pilgrimage destinations:

```
                     +---------------------------------------+
                     |         Customer Completes            |
                     |         Razorpay Payment              |
                     +---------------------------------------+
                                    │         │
                   Fast Client Path │         │ Async Webhook Path
                                    ▼         ▼
          [Browser POST /confirm]           [Razorpay Webhook POST /api/payments/webhook]
                     │                                 │
                     │   HMAC Verification             │   HMAC Verification
                     │   Atomic DB State Machine       │   Idempotency Event Store
                     └───────────────┬─────────────────┘
                                     ▼
                      +-----------------------------+
                      |   Single Final Resolution   |
                      |   - Booking Confirmed       |
                      |   - Hold Converted          |
                      |   - 1x Notification Emitted |
                      +-----------------------------+
```

1. **Client Confirmation (`POST /api/day-stay/confirm`)**: Fast-path for interactive UI redirection.
2. **Server Webhook (`POST /api/payments/webhook`)**: Authoritative reconciliation if browser loses connectivity.
3. **Idempotency Guard**:
   - Webhook events are recorded with unique index `{ provider: "razorpay", eventId: 1 }`.
   - `DayStayBookingService.confirmPayment` atomically transitions booking state from `held` / `pending` to `confirmed`.
   - If booking is already `confirmed`, subsequent calls return the existing booking idempotently without duplicate side effects or notifications.
4. **Hold-Expiry Safety Policy**:
   - If payment is received after hold TTL has expired, the system checks if the room slot is still available.
   - If available: Confirms booking safely.
   - If occupied by a competing reservation: Automatically flags status as `cancelled`, records `paymentStatus: "refunded"`, queues automated gateway refund, and notifies support.

---

## 6. Reception Radar & Vendor Operations

- **Radar States**:
  - `upcoming`: Arriving in > 30 minutes
  - `arriving`: Expected within 30 minutes
  - `currently_resting`: Checked-in, active stay
  - `grace_period`: Duration ended, within 15-minute grace window
  - `turnaround_due`: Guest checked out, housekeeping cleaning underway
  - `completed`: Housekeeping complete, room released to inventory
  - `overstay`: Guest exceeded duration + grace without checkout
- **Vendor Controls**:
  - 1-Click "Block Today" / "Block Tomorrow" sets instant blackout without touching overnight bookings.
  - Multi-tenant data isolation enforces property ownership on all operations.
