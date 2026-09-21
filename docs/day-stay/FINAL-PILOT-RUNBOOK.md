# TIRVONA DAY STAY ENGINE™ — FINAL PILOT RUNBOOK
**Pilot Market**: Vrindavan / Braj Dham  
**Primary Audience**: Operations Team, Property Onboarding Managers, Reception Staff, and Vendor Partners.

---

## 1. Pre-Launch Property Verification Checklist

Before enabling any property in Vrindavan for Day Stay / Freshen-Up bookings, the Onboarding Manager must complete and sign off on this verification:

| Category | Verification Item | Standard Required | Sign-Off |
|---|---|---|---|
| **Property Setup** | Master Day Stay Toggle | `ashram.dayStayConfig.enabled = true` set in Admin Portal. | [ ] |
| **Room Quality** | Dedicated Day Stay Rooms | Dedicated rooms designated with clean attached bathrooms and proper ventilation. | [ ] |
| **Bath & Hygiene** | Hot Water (Geyser) | Operational geysers in all day-stay rooms with < 5 min heating time. | [ ] |
| **Linens & Towels** | Fresh Towel Pack | 2 fresh sanitized towels + soap/shampoo kit per booked guest. | [ ] |
| **Photographs** | Verified Bathroom Photos | High-resolution, unedited photos of actual bathroom & shower uploaded. | [ ] |
| **Operating Hours** | Window Configured | Operating hours set (default: `06:00` – `20:00` IST) reflecting ashram gate times. | [ ] |
| **Staff Training** | Reception Staff Trained | Reception desk trained on Reception Radar, check-in QR scan, and turnaround timing. | [ ] |
| **Emergency Contacts** | On-Call Lead Registered | Ashram manager phone & Tirvona 24x7 local support number pinned at reception. | [ ] |

---

## 2. Daily Operational Routine for Reception Staff

```
[06:00 AM] ──► 1. Open Reception Radar (/vendor/day-stay/radar)
               2. Review total day-stay arrivals expected today.

[During Day] ─► 3. Greet arriving pilgrims -> Verify Booking Reference (TRV-DAY-XXXXX).
               4. Hand over room key + fresh towel kit.
               5. Mark "Checked-In" on Radar (status -> "Currently Resting").
               6. Monitor timer as duration approaches end.

[Checkout] ───► 7. Guest departs -> Mark "Check-Out" on Radar (status -> "Turnaround Due").
               8. Housekeeping cleans room, replaces linens, sanitizes bathroom (45 min buffer).
               9. Housekeeping lead marks "Turnaround Complete" -> Room returns to available pool.
```

---

## 3. Emergency & Exception Standard Operating Procedures (SOP)

### SOP-01: Guest Paid on Phone, but Booking Does Not Appear on Reception Radar
1. **Root Cause**: Mobile network disconnect caused client redirection failure; server webhook may take 15–30 seconds to arrive.
2. **Reception Action**:
   - Ask guest for Razorpay Payment ID (visible in their UPI app / SMS, starting with `pay_...`).
   - Click "Refresh Radar" or search by Payment ID / Guest Phone in the search box.
   - If webhook reconciled: The booking will display `PAID / CONFIRMED`.
   - If network delay persists > 2 minutes: Call Tirvona Emergency Operations Support (`+91-800-TIRVONA`). Support will manually verify Razorpay dashboard and confirm the room in 60 seconds.

### SOP-02: Guest Arrives Earlier Than Booked Start Time
1. **If Room is Clean & Available**: Reception may check the guest in immediately.
2. **If Room is Currently Occupied / Housekeeping Active**:
   - Welcome the pilgrim to the air-conditioned Reception / Ashram Lounge.
   - Provide cold drinking water and safe luggage holding area until the designated slot begins.

### SOP-03: Guest Overstays Beyond Booked Duration + 15m Grace Period
1. **At Duration End**: Radar shows `grace_period` (15 minutes remaining).
2. **At 15m Past Duration**: Radar displays `overstay` alert (Amber banner).
3. **Reception Action**:
   - Politely call room intercom or knock gently: *"Namasteji, your freshen-up booking window has concluded. Please prepare for checkout so our cleaning team can sanitize for the next arriving family."*
   - If guest requests extra time: Check if the room has a succeeding reservation. If open, guide guest to book an extension on their mobile phone.

### SOP-04: Sudden Emergency / Property Needs to Block Remaining Day Stay Slots
1. Open Vendor Dashboard (`/vendor/dashboard`).
2. Click **"1-Click Block Today"**.
3. **Result**: All remaining unbooked day-stay slots for today are immediately closed to the public. Existing confirmed bookings remain valid and safe. Overnight bookings remain 100% active.
