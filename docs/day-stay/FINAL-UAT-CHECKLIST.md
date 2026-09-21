# TIRVONA DAY STAY ENGINE™ — FINAL UAT CHECKLIST

## 1. Customer Discovery & Search Flow

| ID | Test Scenario | Steps | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **UAT-01** | Day Rest Tab on Homepage | 1. Navigate to `/`<br>2. Click `Day Rest (Freshen-Up)` search tab | Search tab activates with orange active indicator and shows Date, Arrival Time, and Duration selector. | PASS |
| **UAT-02** | Destination & Duration Search | 1. Select `Vrindavan`<br>2. Select `Freshen-Up (90 min)`<br>3. Click Search | Redirects to `/search?destination=Vrindavan&tab=day-stay` displaying eligible day stay properties. | PASS |
| **UAT-03** | Day Stay Property Card Badges | 1. Inspect search results | Property cards display `Day Rest Available` badge and starting price (e.g. `₹499 for 90m`). | PASS |
| **UAT-04** | Ashram Detail Page Card | 1. Open ashram detail page (`/ashrams/:id`) | Right sidebar displays `DayStayBookingCard` with duration pills (90m, 3h, 6h) and live slots. | PASS |

---

## 2. Booking & Payment Verification

| ID | Test Scenario | Steps | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **UAT-05** | Live Time-Slot Generation | 1. Select date & duration<br>2. Review slot grid | Slots render at 30-min intervals matching operating hours (06:00–20:00). Past slots are disabled. | PASS |
| **UAT-06** | 10-Minute Hold Creation | 1. Select slot<br>2. Enter guest details<br>3. Click "Pay & Confirm" | Hold record is created; 10-minute countdown timer starts; Razorpay checkout modal opens. | PASS |
| **UAT-07** | Successful Razorpay Payment | 1. Complete test UPI/Card payment on Razorpay modal | Modal closes, calls `POST /api/day-stay/confirm`, redirects to Booking Confirmation voucher. | PASS |
| **UAT-08** | Browser Drop Reconciliation | 1. Initiate payment<br>2. Simulate tab close right after payment<br>3. Deliver webhook payload | Booking is transitioned to `confirmed` server-side via webhook; SMS/WhatsApp confirmation emitted. | PASS |
| **UAT-09** | Expired Hold Race Handling | 1. Initiate hold<br>2. Wait 10m until hold expires<br>3. Complete payment after competing user booked slot | System detects collision, sets `cancelled` / `refunded`, triggers auto-refund, and alerts guest. | PASS |

---

## 3. Vendor Operations & Reception Radar

| ID | Test Scenario | Steps | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **UAT-10** | Reception Radar Display | 1. Log into Vendor portal<br>2. Open Reception Radar (`/vendor/day-stay/radar`) | Displays real-time breakdown: `Upcoming`, `Currently Resting`, `Grace Period`, `Turnaround Due`. | PASS |
| **UAT-11** | 1-Click "Block Today" | 1. On Vendor portal, click "Block Day Stay Today" | Day Stay bookings for today are disabled immediately; overnight bookings remain 100% unaffected. | PASS |
| **UAT-12** | Blackout Date Selection | 1. Select custom festival dates (e.g., Janmashtami) to block | Day Stay slot availability returns zero for selected dates; existing confirmed bookings remain intact. | PASS |
| **UAT-13** | Vendor Property Isolation | 1. Attempt to fetch radar for unowned `ashramId` | Returns `403 Forbidden` (`UNAUTHORIZED_PROPERTY_ACCESS`). | PASS |

---

## 4. Overnight Coexistence Invariants

| ID | Test Scenario | Steps | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **UAT-14** | Day Stay Before Overnight Check-In | 1. Book Day Stay 08:00–10:30 (effective end: 11:30)<br>2. Check overnight check-in (12:00) | Day stay completes with 30m buffer before overnight check-in; room is sanitized and ready. | PASS |
| **UAT-15** | Day Stay After Overnight Check-Out | 1. Overnight guest checks out at 10:00<br>2. Housekeeping buffer completes at 10:45 | Day stay slots become bookable starting at 11:00. | PASS |
| **UAT-16** | Zero Overnight Regression | 1. Create standard overnight booking from `/booking/checkout` | Standard overnight flow executes with legacy parameters without throwing or altering behavior. | PASS |
