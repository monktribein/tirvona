# TIRVONA DAY STAY ENGINE™ — FINAL API SPECIFICATION

## Base URL
`/api/day-stay`

---

## 1. Product Catalog Endpoints

### `GET /api/day-stay/products`
Retrieves active Day Stay product types and configurations.

**Authentication**: Public / None

**Response (200 OK)**:
```json
[
  {
    "code": "FRESHEN_UP",
    "name": "Freshen-Up & Quick Bath",
    "durationMinutes": 90,
    "description": "Bath, freshen up, change clothes & quick relaxation",
    "icon": "bath",
    "includedAmenities": ["Clean Attached Bathroom", "Fresh Towels", "Hot Water", "Drinking Water"]
  },
  {
    "code": "DAY_REST_3H",
    "name": "Day Rest (3 Hours)",
    "durationMinutes": 180,
    "description": "Comfortable family rest, AC room & darshan refreshment",
    "icon": "bed",
    "includedAmenities": ["Air Conditioning", "Clean Bedding", "Hot Water", "Wi-Fi"]
  },
  {
    "code": "DAY_REST_6H",
    "name": "Day Rest (6 Hours)",
    "durationMinutes": 360,
    "description": "Half-day rest for pilgrim families between travel and temple visits",
    "icon": "clock",
    "includedAmenities": ["Full Room Access", "Clean Bedding", "Hot Water", "Luggage Safety"]
  }
]
```

---

## 2. Inventory & Availability Endpoints

### `GET /api/day-stay/availability`
Calculates real-time slot availability for a room or ashram on a given date and product duration.

**Authentication**: Public / None

**Query Parameters**:
| Parameter | Type | Required | Description |
|---|---|---|---|
| `ashramId` | string | Yes | Target property ID |
| `roomId` | string | Optional | Specific room category ID |
| `date` | string (YYYY-MM-DD) | Yes | Target date |
| `productCode` | string | Yes | `FRESHEN_UP`, `DAY_REST_3H`, or `DAY_REST_6H` |

**Response (200 OK)**:
```json
{
  "ashramId": "651a2b3c4d5e6f7a8b9c0d1e",
  "roomId": "651a2b3c4d5e6f7a8b9c0d2f",
  "date": "2026-09-25",
  "productCode": "FRESHEN_UP",
  "durationMinutes": 90,
  "operatingHours": {
    "open": "06:00",
    "close": "20:00"
  },
  "slots": [
    {
      "startTime": "08:00",
      "endTime": "09:30",
      "availableUnits": 3,
      "price": 499,
      "tax": 0,
      "isAvailable": true
    },
    {
      "startTime": "08:30",
      "endTime": "10:00",
      "availableUnits": 3,
      "price": 499,
      "tax": 0,
      "isAvailable": true
    },
    {
      "startTime": "12:00",
      "endTime": "13:30",
      "availableUnits": 0,
      "price": 499,
      "tax": 0,
      "isAvailable": false,
      "reason": "SLOT_OCCUPIED"
    }
  ]
}
```

---

## 3. Hold & Booking Endpoints

### `POST /api/day-stay/hold`
Creates a temporary 10-minute inventory lock and generates a Razorpay Order.

**Authentication**: Public / Guest or Authenticated User

**Request Body**:
```json
{
  "ashramId": "651a2b3c4d5e6f7a8b9c0d1e",
  "roomId": "651a2b3c4d5e6f7a8b9c0d2f",
  "productCode": "FRESHEN_UP",
  "date": "2026-09-25",
  "startTime": "09:00",
  "guestName": "Aarav Sharma",
  "guestPhone": "+919876543210",
  "guestEmail": "aarav@example.com",
  "numberOfGuests": 2
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "holdId": "651a3c4d5e6f7a8b9c0d3a1b",
  "bookingId": "651a3c4d5e6f7a8b9c0d3a1c",
  "bookingReference": "TRV-DAY-8821A",
  "expiresAt": "2026-09-25T09:10:00.000Z",
  "durationSeconds": 600,
  "pricing": {
    "basePrice": 499,
    "taxes": 0,
    "platformFee": 0,
    "totalAmount": 499,
    "currency": "INR"
  },
  "razorpay": {
    "orderId": "order_NX7821Bskajw91",
    "keyId": "rzp_test_placeholder",
    "amount": 49900,
    "currency": "INR"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid date format, past timestamp, or operating hours violation.
- `409 Conflict`: Slot fully booked or held by concurrent user (`INVENTORY_UNAVAILABLE`).

---

### `POST /api/day-stay/confirm`
Verifies client-submitted Razorpay signature and finalizes booking state.

**Authentication**: Public / Guest or Authenticated User

**Request Body**:
```json
{
  "bookingId": "651a3c4d5e6f7a8b9c0d3a1c",
  "razorpayOrderId": "order_NX7821Bskajw91",
  "razorpayPaymentId": "pay_NX78391Haskla2",
  "razorpaySignature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "booking": {
    "id": "651a3c4d5e6f7a8b9c0d3a1c",
    "reference": "TRV-DAY-8821A",
    "status": "confirmed",
    "paymentStatus": "paid",
    "bookingType": "freshen_up",
    "dayStayDetails": {
      "productCode": "FRESHEN_UP",
      "date": "2026-09-25",
      "startTime": "09:00",
      "endTime": "10:30",
      "durationMinutes": 90,
      "gracePeriodMinutes": 15,
      "housekeepingBufferMinutes": 45
    },
    "guestName": "Aarav Sharma",
    "totalAmount": 499
  }
}
```

---

## 4. Vendor & Radar Endpoints

### `GET /api/day-stay/vendor/radar`
Retrieves live operational status of Day Stay rooms for reception staff.

**Authentication**: Bearer Token (Role: `vendor` or `admin`)

**Query Parameters**:
| Parameter | Type | Required | Description |
|---|---|---|---|
| `ashramId` | string | Yes | Target property ID (must match vendor authorization) |
| `date` | string (YYYY-MM-DD) | Optional | Default: today's date |

**Response (200 OK)**:
```json
{
  "ashramId": "651a2b3c4d5e6f7a8b9c0d1e",
  "date": "2026-09-25",
  "summary": {
    "totalToday": 14,
    "currentlyResting": 3,
    "turnaroundDue": 2,
    "upcoming": 8,
    "completed": 1,
    "overstay": 0
  },
  "radarItems": [
    {
      "bookingId": "651a3c4d5e6f7a8b9c0d3a1c",
      "bookingReference": "TRV-DAY-8821A",
      "roomName": "Deluxe AC Room 102",
      "guestName": "Aarav Sharma",
      "guestPhone": "+919876543210",
      "productCode": "FRESHEN_UP",
      "startTime": "09:00",
      "endTime": "10:30",
      "radarStatus": "currently_resting",
      "minutesRemaining": 42,
      "paymentStatus": "paid"
    }
  ]
}
```

---

### `POST /api/day-stay/vendor/block`
Sets immediate 1-click day stay blackout dates for a property or room.

**Authentication**: Bearer Token (Role: `vendor` or `admin`)

**Request Body**:
```json
{
  "ashramId": "651a2b3c4d5e6f7a8b9c0d1e",
  "roomId": "651a2b3c4d5e6f7a8b9c0d2f",
  "blockType": "today",
  "customDates": []
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Day Stay inventory successfully blocked for selected target.",
  "isBlockedToday": true
}
```
