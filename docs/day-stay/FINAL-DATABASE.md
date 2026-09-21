# TIRVONA DAY STAY ENGINE™ — FINAL DATABASE & SCHEMA SPECIFICATION

## 1. Architectural Strategy & Non-Destructive Principles

The database schema extensions for Day Stay follow strict backward-compatibility guidelines:
- **Zero Destructive Migrations**: Existing collections (`ashrams`, `rooms`, `bookings`, `payment_webhook_events`) are augmented with optional subdocuments and default values.
- **Overnight Default**: The field `bookingType` defaults to `"overnight"`, guaranteeing all legacy booking queries, admin aggregations, and financial reports function with 100% fidelity without schema updates.
- **Optimistic Concurrency**: Mongoose `versionKey` (`__v`) and atomic operators (`$set`, `$setOnInsert`, `$inc`) guarantee thread-safe writes.

---

## 2. Collection Schemas & Fields

### A. `DayStayProduct` Collection (`day_stay_products`)
```typescript
@Schema({ timestamps: true, collection: 'day_stay_products' })
export class DayStayProduct {
  @Prop({ required: true, unique: true, index: true })
  code: string; // 'FRESHEN_UP' | 'DAY_REST_3H' | 'DAY_REST_6H'

  @Prop({ required: true })
  name: string; // e.g. 'Freshen-Up & Quick Bath'

  @Prop({ required: true, min: 15, max: 720 })
  durationMinutes: number; // 90, 180, 360

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  icon: string; // 'bath' | 'bed' | 'clock'

  @Prop({ type: [String], default: [] })
  includedAmenities: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}
```

---

### B. `Ashram` Extension (`ashrams.dayStayConfig`)
```typescript
export class AshramDayStayConfig {
  @Prop({ default: false, index: true })
  enabled: boolean;

  @Prop({
    type: Object,
    default: { open: '06:00', close: '20:00' }
  })
  operatingHours: {
    open: string;  // HH:mm (24h)
    close: string; // HH:mm (24h)
  };

  @Prop({ default: 15, min: 0, max: 60 })
  defaultGraceMinutes: number; // Default: 15 mins

  @Prop({ default: 45, min: 0, max: 120 })
  defaultHousekeepingBufferMinutes: number; // Default: 45 mins

  @Prop({ default: false })
  isBlockedToday: boolean;

  @Prop({ type: [String], default: [] })
  blackoutDates: string[]; // YYYY-MM-DD
}
```

---

### C. `Room` Extension (`rooms.dayStayConfig`)
```typescript
export class RoomDayStayConfig {
  @Prop({ default: true })
  enabled: boolean;

  @Prop({
    type: Map,
    of: Number,
    default: {
      FRESHEN_UP: 499,
      DAY_REST_3H: 899,
      DAY_REST_6H: 1499
    }
  })
  pricingByProduct: Map<string, number>;

  @Prop({ default: 1.0 })
  priceMultiplier: number;
}
```

---

### D. `Booking` Extension (`bookings`)
```typescript
// Field added at root of Booking schema
@Prop({
  type: String,
  enum: ['overnight', 'day_rest', 'freshen_up'],
  default: 'overnight',
  index: true
})
bookingType: string;

// Subdocument for day-stay snapshot data
export class DayStayBookingDetails {
  @Prop({ required: true })
  productCode: string; // 'FRESHEN_UP' | 'DAY_REST_3H' | 'DAY_REST_6H'

  @Prop({ required: true, index: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true })
  startTime: string; // HH:mm (e.g. '09:00')

  @Prop({ required: true })
  endTime: string; // HH:mm (e.g. '10:30')

  @Prop({ required: true })
  durationMinutes: number;

  @Prop({ default: 15 })
  gracePeriodMinutes: number;

  @Prop({ default: 45 })
  housekeepingBufferMinutes: number;

  @Prop({
    type: String,
    enum: ['upcoming', 'arriving', 'checked_in', 'grace_period', 'turnaround', 'completed', 'overstay'],
    default: 'upcoming'
  })
  radarStatus: string;

  @Prop({ type: Object, default: {} })
  pricingSnapshot: {
    basePrice: number;
    taxes: number;
    platformFee: number;
    totalAmount: number;
  };
}
```

---

### E. `PaymentWebhookEvent` Collection (`payment_webhook_events`)
```typescript
@Schema({ timestamps: true, collection: 'payment_webhook_events' })
export class PaymentWebhookEvent {
  @Prop({ required: true })
  provider: string; // 'razorpay'

  @Prop({ required: true })
  eventId: string; // Razorpay x-razorpay-event-id or payload.event_id

  @Prop({ required: true })
  eventType: string; // 'payment.captured' | 'order.paid'

  @Prop({ type: Object, required: true })
  payload: Record<string, any>;

  @Prop({ default: 'processed' })
  status: string;
}
// Unique compound index:
// { provider: 1, eventId: 1 } (Unique: true)
```

---

## 3. Indexing Strategy

| Collection | Fields Indexed | Type | Purpose |
|---|---|---|---|
| `bookings` | `{ ashramId: 1, "dayStayDetails.date": 1, status: 1 }` | Compound | Fast availability & slot calculation |
| `bookings` | `{ bookingType: 1, status: 1 }` | Compound | Filter legacy overnight vs day stay bookings |
| `bookings` | `{ "razorpay.orderId": 1 }` | Sparse Index | Fast Razorpay webhook payment lookup |
| `day_stay_products` | `{ code: 1 }` | Unique | Product catalog identity lookup |
| `payment_webhook_events`| `{ provider: 1, eventId: 1 }` | Unique | Deduplicate webhooks across retries |
| `ashrams` | `{ "dayStayConfig.enabled": 1 }` | Sparse Index | Fast search discovery for Day Rest properties |

---

## 4. Backward Compatibility Invariants
1. `bookingType` is always populated with `"overnight"` if not specified.
2. `dayStayDetails` is undefined on all legacy overnight bookings.
3. Legacy booking queries filtering by `checkIn` / `checkOut` date remain unaffected.
4. Total capacity check deducts both overnight occupied units and overlapping Day Stay effective units.
