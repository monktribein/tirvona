# Tirvona Day Stay Engine™ — Database & Schema Specifications

**Updated:** September 2026  
**Task:** DAYSTAY-001 Schema Extensions  

---

## 1. Overview of Collections & Changes

To support the time-based Day Stay Engine without duplicating the existing accommodation ecosystem, we extended existing schemas (`AshramSchema`, `RoomSchema`, `BookingSchema`) and introduced a single configurable catalog collection (`day_stay_products`).

---

## 2. Collections Detailed Specification

### A. `day_stay_products` (New Collection)
Defines catalog configurations for short stays and freshen-up products.

```typescript
{
  productCode: String,      // e.g., "FRESHEN_UP", "DAY_REST_3H", "DAY_REST_6H" [Unique, Uppercase, Required]
  productType: String,      // enum: ["freshen_up", "day_rest"] [Required]
  displayName: String,      // e.g., "Pilgrim Freshen-Up (90 Mins)" [Required]
  durationMinutes: Number,  // e.g., 90, 180, 360 [Required, Min: 1]
  active: Boolean,          // default: true
  sortOrder: Number,        // default: 0
  description: String,
  applicablePropertyIds: [ObjectId], // optional property scoping
  metadata: Object,
  createdBy: ObjectId,
  updatedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes**:
- `{ productCode: 1 }` (unique)
- `{ active: 1, sortOrder: 1 }`
- `{ productType: 1, active: 1 }`

---

### B. `ashrams` (`AshramSchema` Extension)
Extended with a non-breaking `dayStayConfig` subdocument:

```typescript
dayStayConfig: {
  enabled: Boolean,                         // default: false [Indexed]
  verificationStatus: String,               // enum: ["unverified", "pending", "verified", "rejected"] [default: "unverified"]
  verificationData: {
    verifiedAt: Date,
    verifiedBy: ObjectId,
    bathroomConditionScore: Number,
    roomConditionScore: Number,
    linenAndTowelsConfirmed: Boolean,
    hotWaterConfirmed: Boolean,
    familySuitabilityConfirmed: Boolean,
    kycProcessConfirmed: Boolean,
    bathroomPhotos: [String],
    roomPhotos: [String],
    notes: String
  },
  operatingHours: {
    start: String,                          // default: "06:00"
    end: String                             // default: "20:00"
  },
  defaultGraceMinutes: Number,              // default: 15 (min: 0, max: 120)
  defaultHousekeepingBufferMinutes: Number, // default: 45 (min: 0, max: 180)
  blackoutDates: [Date],
  highDemandDates: [Date],
  isBlockedToday: Boolean,                  // default: false
  isBlockedTomorrow: Boolean,               // default: false
  policy: {
    towelProvided: Boolean,                 // default: true
    hotWaterAvailable: Boolean,             // default: true
    attachedBathroom: Boolean,              // default: true
    parkingInfo: {
      type: String,                         // enum: ["on_site", "partner", "nearby_public", "none"]
      partnerId: String,
      distance: String,
      indicativePrice: Number
    },
    luggageInfo: {
      available: Boolean,                   // default: true
      included: Boolean,                    // default: true
      price: Number,                        // default: 0
      hours: String
    },
    houseRules: [String],
    cancellationPolicy: String
  }
}
```
**Indexes**:
- `{ "dayStayConfig.enabled": 1, "dayStayConfig.verificationStatus": 1 }`

---

### C. `rooms` (`RoomSchema` Extension)
Extended with `dayStayConfig` to allow per-room allocation and product pricing:

```typescript
dayStayConfig: {
  eligible: Boolean,             // default: false
  enabled: Boolean,              // default: false
  allocatedInventory: Number,    // default: 0, min: 0
  products: [
    {
      productCode: String,       // e.g. "FRESHEN_UP", "DAY_REST_3H", "DAY_REST_6H"
      productType: String,       // enum: ["freshen_up", "day_rest"]
      durationMinutes: Number,   // min: 1
      price: Number,             // min: 0
      discountPrice: Number,     // default: 0
      enabled: Boolean           // default: true
    }
  ],
  bathroomType: String,          // enum: ["attached_private", "dedicated_private", "shared"] [default: "attached_private"]
  hasHotWater: Boolean,          // default: true
  hasTowels: Boolean             // default: true
}
```
**Indexes**:
- `{ ashramId: 1, "dayStayConfig.enabled": 1 }`

---

### D. `booking_bookings` (`BookingSchema` Extension)
Extended with `bookingType` and `dayStayDetails`:

```typescript
bookingType: {
  type: String,
  enum: ["overnight", "day_rest", "freshen_up"],
  default: "overnight",
  index: true
},
dayStayDetails: {
  productCode: String,
  productType: String,
  slotStartTime: Date,
  slotEndTime: Date,
  durationMinutes: Number,
  graceMinutes: Number,                    // default: 15
  graceExpiresAt: Date,
  housekeepingBufferMinutes: Number,       // default: 45
  housekeepingEndsAt: Date,
  actualCheckInAt: Date,
  actualCheckOutAt: Date,
  isOverstay: Boolean,                     // default: false
  overstayMinutes: Number,                 // default: 0
  overstayCharges: Number,                 // default: 0
  extensionCount: Number,                  // default: 0
  extensions: [
    {
      extendedAt: Date,
      addedMinutes: Number,
      oldEndTime: Date,
      newEndTime: Date,
      amountCharged: Number,
      paymentId: String,
      status: String                       // enum: ["pending", "confirmed", "failed"]
    }
  ]
}
```
**Indexes**:
- `{ ashramId: 1, bookingType: 1, "dayStayDetails.slotStartTime": 1 }`
- `{ "rooms.roomId": 1, bookingType: 1, status: 1, "dayStayDetails.slotStartTime": 1, "dayStayDetails.slotEndTime": 1 }`

---

## 3. Backward Compatibility & Timezone Strategy

1. **Zero-Migration Backward Compatibility**:
   - `bookingType` has `default: "overnight"`.
   - Existing documents with omitted `bookingType` and `dayStayDetails` continue to validate and behave identically as overnight bookings.
2. **Timezone Representation**:
   - All time slots (`slotStartTime`, `slotEndTime`, `graceExpiresAt`, `housekeepingEndsAt`) are stored as absolute UTC `Date` timestamps in MongoDB, aligned with the platform's standard MongoDB date handling.
   - Local operational time (e.g. `operatingHours: { start: "06:00", end: "20:00" }`) is resolved in context of the property's operational zone (`Asia/Kolkata` default).
