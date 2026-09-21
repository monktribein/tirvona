# Tirvona Day Stay Engine™ — Technical Design

**Date:** September 2026  
**Author:** Senior Full-Stack Engineer & Solution Architect  
**Platform:** Tirvona Accommodation Ecosystem  

---

## 1. System Architecture & Component Interactions

```
+-------------------------------------------------------------------------------------------------+
|                                        Frontend (React 19 / Vite)                               |
|                                                                                                 |
|   +--------------------------+   +--------------------------+   +---------------------------+   |
|   | Pilgrim Search & Details |   |  Owner / Vendor Portal   |   |   Admin Verification Hub  |   |
|   |  - Day Stay Search Bar   |   |  - Block Day Stay Switch |   |   - Day Rest Inspection   |   |
|   |  - Freshen-Up / 3H / 6H  |   |  - Time Slot Radar       |   |   - Verified Badging      |   |
|   |  - Real Bathroom Photos  |   |  - Check-in / Extension  |   |   - Audit & Dispute Logs  |   |
|   +--------------------------+   +--------------------------+   +---------------------------+   |
+------------------------------------------------+------------------------------------------------+
                                                 | REST / WebSocket
+------------------------------------------------v------------------------------------------------+
|                                    NestJS Modular Backend                                       |
|                                                                                                 |
|  +-------------------------------------------------------------------------------------------+  |
|  | Day Stay Module (`src/modules/day-stay`)                                                   |  |
|  |   - `day-stay-products.service.ts`      (Configurable product catalog: 90m, 180m, 360m)    |  |
|  |   - `day-stay-inventory.service.ts`     (Time-window availability & interval math)        |  |
|  |   - `day-stay-booking.service.ts`       (Atomic hold, state machine & checkout)           |  |
|  |   - `day-stay-extension.service.ts`     (Forward slot lookup & price calculation)         |  |
|  |   - `day-stay-vendor.service.ts`        (Instant blocking & operational radar)            |  |
|  |   - `day-stay-verification.service.ts`  (Tirvona Day Rest Verified™ workflow)             |  |
|  +-------------------------------------------------------------------------------------------+  |
|                                                |                                                |
|  +---------------------------+                 |                 +---------------------------+  |
|  |  Existing Booking Service |<----------------+---------------->| Existing Payments Module  |  |
|  |  (`src/modules/bookings`) |                                   | (`src/modules/payments`)  |  |
|  +---------------------------+                                   +---------------------------+  |
|                                                |                                                |
|  +---------------------------+                 |                 +---------------------------+  |
|  | Notifications Outbox /    |<----------------+---------------->| Mongoose / MongoDB Engine |  |
|  | Redis BullMQ Worker       |                                   | (ACID Transactions & TTL) |  |
|  +---------------------------+                                   +---------------------------+  |
+-------------------------------------------------------------------------------------------------+
```

---

## 2. Database Schema Design (MongoDB / Mongoose)

### A. Extended `AshramSchema` (`ashram.schemas.ts`)
```typescript
dayStayConfig: {
  enabled: { type: Boolean, default: false, index: true },
  operatingHours: {
    start: { type: String, default: "06:00" }, // 24hr format HH:mm
    end: { type: String, default: "20:00" },
  },
  housekeepingBufferMinutes: { type: Number, default: 45, min: 15, max: 120 },
  gracePeriodMinutes: { type: Number, default: 15, min: 0, max: 60 },
  dayRestVerified: {
    isVerified: { type: Boolean, default: false, index: true },
    verifiedAt: Date,
    verifiedBy: { type: SchemaTypes.ObjectId, ref: 'User' },
    criteria: {
      bathroomCleanliness: Boolean,
      bathroomPhotosApproved: Boolean,
      freshLinenAndTowels: Boolean,
      hotWaterAvailable: Boolean,
      familySuitability: Boolean,
      kycCompliant: Boolean,
      emergencyContactProvided: Boolean,
    },
    bathroomPhotos: [String],
    inspectionNotes: String,
  },
  blackoutDates: [Date], // Property-level high-demand blackout dates
  isBlockedToday: { type: Boolean, default: false },
  isBlockedTomorrow: { type: Boolean, default: false },
}
```

### B. Extended `RoomSchema` (`ashram.schemas.ts`)
```typescript
dayStayConfig: {
  enabled: { type: Boolean, default: false },
  allocatedInventory: { type: Number, default: 0, min: 0 },
  pricingTiers: [
    {
      productId: { type: String, required: true }, // e.g. "FRESHEN_UP", "DAY_REST_3H", "DAY_REST_6H"
      durationMinutes: { type: Number, required: true },
      price: { type: Number, required: true, min: 0 },
      discountPrice: { type: Number, min: 0 },
      enabled: { type: Boolean, default: true },
    }
  ],
  bathroomType: { type: String, enum: ["attached_private", "dedicated_private", "shared"], default: "attached_private" },
  hasGeyser: { type: Boolean, default: true },
  hasTowels: { type: Boolean, default: true },
  hasToiletries: { type: Boolean, default: true },
}
```

### C. Configurable Product Master (`day-stay-product.schemas.ts`)
```typescript
export const DayStayProductSchema = new Schema({
  code: { type: String, required: true, unique: true }, // "FRESHEN_UP", "DAY_REST_3H", "DAY_REST_6H"
  name: { type: String, required: true },               // "Freshen-Up (90 Mins)", "Day Rest (3 Hours)"
  tagline: { type: String, default: "Pilgrim Refresh & Rest" },
  defaultDurationMinutes: { type: Number, required: true },
  minDurationMinutes: { type: Number, required: true },
  maxDurationMinutes: { type: Number, required: true },
  recommendedHousekeepingMinutes: { type: Number, default: 30 },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  displayBadge: String,
  description: String,
}, opts("day_stay_products"));
```

### D. Time-Slot Inventory Hold & Booking (`booking.schemas.ts` extension)
```typescript
// Extended Booking Schema fields:
bookingType: {
  type: String,
  enum: ["overnight", "day_rest", "freshen_up"],
  default: "overnight",
  index: true,
},
dayStayDetails: {
  productCode: String,
  slotStartTime: { type: Date, index: true },
  slotEndTime: { type: Date, index: true },
  durationMinutes: Number,
  graceMinutes: { type: Number, default: 15 },
  graceExpiresAt: Date,
  housekeepingBufferMinutes: { type: Number, default: 45 },
  housekeepingEndsAt: Date,
  actualCheckInAt: Date,
  actualCheckOutAt: Date,
  isOverstay: { type: Boolean, default: false },
  overstayMinutes: { type: Number, default: 0 },
  overstayCharges: { type: Number, default: 0 },
  extensions: [
    {
      extendedAt: Date,
      addedMinutes: Number,
      oldEndTime: Date,
      newEndTime: Date,
      chargeAmount: Number,
      paymentId: String,
      status: { type: String, enum: ["pending", "confirmed", "failed"] }
    }
  ],
}
```

---

## 3. Concurrency, Locking & Double-Booking Protection

### The Time-Window Overlap Formula
For any requested room and interval $[T_{req\_start}, T_{req\_end}]$, the total occupied inventory at that window is the sum of:
1. **Confirmed Day Stays & Holds** overlapping $[T_{req\_start}, T_{req\_end} + T_{grace} + T_{housekeeping}]$.
   - Condition: `slotStartTime < (T_req_end + T_grace + T_housekeeping)` AND `(slotEndTime + graceMinutes + housekeepingBufferMinutes) > T_req_start`.
2. **Overnight Occupancy Protection**:
   - Day Stays cannot extend past property's Day Stay operating cutoff (e.g. 19:00 / 20:00) or interfere with standard overnight check-in (12:00 / 14:00) if rooms are shared between overnight and day rest.

### Atomic Inventory Hold with Mongo Transaction
```typescript
// 1. Check current unallocated units for the interval
// 2. Insert hold record in `booking_inventory` with `state: "held"`, `expiresAt: now + 10m`
// 3. If overlapping active holds + confirmed bookings >= room.allocatedDayStayInventory, abort transaction and reject with friendly error message: "Sorry, this time slot was just selected by another pilgrim. Please select another slot or room."
```

---

## 4. Operational Endpoints & API Blueprint

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/day-stay/products` | GET | Public | Returns active Day Stay products (90m, 3h, 6h). |
| `/api/day-stay/search` | POST | Public | Searches available rooms/ashrams given city, date, arrival time & duration. |
| `/api/day-stay/availability` | GET | Public | Gets real-time time slots for a specific property/room on a given date. |
| `/api/day-stay/hold` | POST | Customer | Atomically holds a time-slot for 10 minutes and generates Razorpay order. |
| `/api/day-stay/confirm` | POST | Customer | Verifies Razorpay signature and transitions hold to `confirmed`. |
| `/api/day-stay/extend/quote` | POST | Customer | Checks forward availability and quotes price for 1h/2h extension. |
| `/api/day-stay/extend/confirm` | POST | Customer | Initiates/confirms extension payment and updates booking end time. |
| `/api/day-stay/vendor/overview` | GET | Vendor | Live Day Stay radar (arrivals, current resters, checkout due, overstays). |
| `/api/day-stay/vendor/block` | POST | Vendor | Prominent toggle to block Day Stay for today, tomorrow, or date range. |
| `/api/day-stay/vendor/config` | PUT | Vendor | Updates operating hours, pricing tiers, and housekeeping buffer. |
| `/api/day-stay/admin/verify` | POST | Admin | Approves/rejects "Tirvona Day Rest Verified™" badge with photo evidence. |

---

## 5. Security, RBAC & Audit

1. **Authentication**: Uses existing JWT guards and role authorization (`roles.guard.ts`).
2. **Rate Limiting**: Integrated with `@nestjs/throttler` to prevent bot scraping on availability search.
3. **Audit Trail**: Every inventory block, manual override, extension, and verification decision is recorded in `audit` collection with `actorId`, `role`, `action`, `entity`, `oldValue`, and `newValue`.
