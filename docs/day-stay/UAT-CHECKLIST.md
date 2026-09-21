# User Acceptance Testing (UAT) Checklist — Tirvona Day Stay Engine™

**Feature:** Tirvona Day Stay Engine™ (Short Stay + Freshen-Up)  
**Target Market:** Vrindavan / Braj Pilot Properties  
**Document Version:** 1.0.0  
**Test Environment:** Staging & Pre-Production

---

## 1. Pilgrim (Customer) Experience Checklist

- [ ] **Home Page Discovery**:
  - [ ] Search tab bar displays `Day Rest (Freshen-Up)` with spring pill indicator.
  - [ ] Quick service strip has interactive Day Stay shortcut linking to filtered listings.
- [ ] **Search Results**:
  - [ ] Day Rest filter checkbox correctly isolates ashrams with `dayStayConfig.enabled = true`.
  - [ ] Verified stay cards display `Day Rest Available` badge.
- [ ] **Stay Detail & Product Selection**:
  - [ ] Duration pills (`90 Mins`, `3 Hours`, `6 Hours`) update pricing dynamically.
  - [ ] Verified Amenity Guarantees (*Clean Bathroom, Hot Water Geyser, Family Safe*) render clearly.
  - [ ] Date picker restricts past dates and loads live availability.
  - [ ] Time slot grid displays operational slots (e.g., `06:00 - 07:30`, `08:00 - 09:30`).
  - [ ] Unavailable/booked slots are rendered disabled with clear strikethrough styling.
- [ ] **Checkout & Payment**:
  - [ ] 10-minute hold countdown is created on slot selection.
  - [ ] Transparent fee breakdown shows room rate + GST (18%).
  - [ ] Razorpay checkout modal opens with prefilled details and brand theme color `#0A4DA6`.
  - [ ] Successful payment updates booking status to `CONFIRMED` and renders confirmation card.

---

## 2. Vendor / Property Manager Checklist

- [ ] **1-Click Day Stay Blocking**:
  - [ ] Vendor can freeze property for `Today`, `Tomorrow`, or `Date Range`.
  - [ ] Blocked dates immediately remove Day Stay time slots from customer view while leaving overnight bookings operational.
- [ ] **Live Reception Radar**:
  - [ ] Reception desk displays upcoming day-stay arrivals for the current date.
  - [ ] Currently active resting pilgrims show scheduled check-out and grace period countdown.
  - [ ] Housekeeping status displays 45-minute turnaround alert upon pilgrim checkout.

---

## 3. Platform Admin & Safety Checklist

- [ ] **Operational Buffers**:
  - [ ] System automatically adds 15 minutes grace period after slot completion.
  - [ ] Housekeeping turnover buffer (default 45 minutes) prevents consecutive slot conflicts.
- [ ] **Security & Cryptography**:
  - [ ] HMAC SHA-256 signature verification rejects fake/forged Razorpay callbacks.
  - [ ] Expired holds (> 10 mins) auto-release room inventory back to the public pool.
- [ ] **Zero Overnight Disruption**:
  - [ ] Overnight booking calendar, prices, and bookings remain 100% unaffected.
