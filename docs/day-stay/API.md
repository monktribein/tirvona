# Tirvona Day Stay Engine™ — API Documentation

**Updated:** September 2026  
**Tasks Completed:** DAYSTAY-001 through DAYSTAY-006  

---

## 1. Product Catalog API

### `GET /api/day-stay/products`
Returns all active Day Stay / Freshen-Up product definitions.
- **Access**: Public
- **Response**:
```json
[
  {
    "productCode": "FRESHEN_UP",
    "productType": "freshen_up",
    "displayName": "Pilgrim Freshen-Up (90 Mins)",
    "durationMinutes": 90,
    "sortOrder": 1,
    "description": "Quick rest, refresh, private clean bathroom and hot water shower before darshan."
  },
  {
    "productCode": "DAY_REST_3H",
    "productType": "day_rest",
    "displayName": "Family Day Rest (3 Hours)",
    "durationMinutes": 180,
    "sortOrder": 2,
    "description": "Comfortable private AC room to relax, unpack, freshen up, and re-energize."
  },
  {
    "productCode": "DAY_REST_6H",
    "productType": "day_rest",
    "displayName": "Pilgrim Shanti Rest (6 Hours)",
    "durationMinutes": 360,
    "sortOrder": 3,
    "description": "Extended peace and comfort for elderly family members, yatris, and tired pilgrims."
  }
]
```

---

## 2. Time-Slot Availability API

### `GET /api/day-stay/availability`
Calculates available time slots for a property room on a given date, incorporating grace period (15m) and housekeeping buffer (45m) math.
- **Access**: Public
- **Query Params**:
  - `ashramId` (string, required)
  - `roomId` (string, required)
  - `date` (string `YYYY-MM-DD`, required)
  - `productCode` (string, optional)
- **Response**:
```json
{
  "slots": [
    {
      "startTime": "08:00",
      "endTime": "11:00",
      "startUtc": "2026-10-01T08:00:00.000Z",
      "endUtc": "2026-10-01T11:00:00.000Z",
      "availableUnits": 2,
      "isAvailable": true,
      "productCode": "DAY_REST_3H",
      "durationMinutes": 180,
      "price": 800,
      "discountPrice": 700
    }
  ]
}
```

---

## 3. Atomic Slot Hold API

### `POST /api/day-stay/hold`
Atomically holds a slot for 10 minutes and generates a Razorpay payment order.
- **Access**: Customer (Authenticated)
- **Body**:
```json
{
  "ashramId": "660000000000000000000001",
  "roomId": "660000000000000000000002",
  "productCode": "DAY_REST_3H",
  "date": "2026-10-01",
  "startTime": "09:00",
  "guestsCount": 2,
  "specialRequests": "Ground floor if available"
}
```
- **Response**:
```json
{
  "bookingId": "BK-261001-A1B2",
  "reservationNumber": "RES-261001-9876",
  "productName": "Family Day Rest (3 Hours)",
  "slotStartTime": "2026-10-01T09:00:00.000Z",
  "slotEndTime": "2026-10-01T12:00:00.000Z",
  "durationMinutes": 180,
  "pricing": {
    "basePrice": 700,
    "gstAmount": 126,
    "totalAmount": 826
  },
  "razorpayOrderId": "order_EKfLsu8Gfb4M",
  "reservationExpiresAt": "2026-10-01T08:45:00.000Z"
}
```

---

## 4. Payment Confirmation API

### `POST /api/day-stay/confirm`
Verifies payment signature and transitions booking from `pending` (held) to `confirmed`.
- **Access**: Customer (Authenticated)
- **Body**:
```json
{
  "bookingId": "BK-261001-A1B2",
  "razorpayOrderId": "order_EKfLsu8Gfb4M",
  "razorpayPaymentId": "pay_EKfNsu8Gfb4N",
  "razorpaySignature": "25f4e1..."
}
```

---

## 5. Vendor Radar & Block Controls API

### `POST /api/day-stay/vendor/block`
Allows property owner/staff to instantly block Day Stay for today, tomorrow, or custom dates.
- **Access**: `ashram_owner`, `ashram_staff`, `admin`
- **Body**:
```json
{
  "ashramId": "660000000000000000000001",
  "action": "today"
}
```

### `GET /api/day-stay/vendor/radar`
Real-time operational dashboard for reception desk:
- Upcoming arrivals
- Currently resting pilgrims
- Checkouts due (in grace window)
- Overstays
- **Access**: `ashram_owner`, `ashram_staff`, `admin`
