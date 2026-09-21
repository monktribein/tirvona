# TIRVONA DAY STAY ENGINE™ — FINAL BUSINESS RULES

## 1. Product Definitions & Pilot Objectives

The **Tirvona Day Stay Engine™** is engineered for religious pilgrimage destinations, beginning with **Vrindavan / Braj**. 
- **Customer Value Proposition**: "Arrive. Freshen up. Rest. Visit your temple / darshan. Return comfortably."
- **Pilgrim-Centric Framing**: Strictly positioned as holy pilgrimage rest, bathing, and freshen-up stations—not as an hourly hotel marketplace.

### Product Matrix
| Product Code | Product Name | Base Duration | Default Grace | Housekeeping Buffer | Target Pilgrimage Use Case |
|---|---|---|---|---|---|
| `FRESHEN_UP` | Freshen-Up & Quick Bath | 90 Minutes | 15 Minutes | 45 Minutes | Quick bath, change into traditional clothes, freshen up before Mangala / evening Aarti. |
| `DAY_REST_3H` | Day Rest (3 Hours) | 3 Hours (180m) | 15 Minutes | 45 Minutes | Afternoon rest between temple darshan slots (e.g. 12:00–16:00 temple closing break). |
| `DAY_REST_6H` | Day Rest (6 Hours) | 6 Hours (360m) | 15 Minutes | 45 Minutes | Extended pilgrimage recovery, elderly rest, or waiting for night train / bus departure. |

---

## 2. Operating Hours & Slot Calculation

1. **Default Pilot Operating Hours**: `06:00` to `20:00` IST.
2. **Configurability**: Property owners may configure earlier opening (e.g., `04:00` for early Yamuna snan) or later closing in `ashram.dayStayConfig.operatingHours`.
3. **Slot Stepping**: Slots are computed in **30-minute intervals** across the operating window.
4. **Boundary Condition**: A slot $\left[ T_{\text{start}}, T_{\text{end}} \right]$ is valid if and only if:
   $$T_{\text{start}} \ge T_{\text{open}} \quad \text{and} \quad T_{\text{start}} + D_{\text{duration}} \le T_{\text{close}}$$
   *(Note: Housekeeping buffer may extend past $T_{\text{close}}$ without invalidating the guest's booked stay window).*

---

## 3. Grace Period & Overstay Policy

1. **Grace Period (Default: 15 Minutes)**:
   - Provides compassionate checkout flexibility for pilgrims packing belongings and changing.
   - During $\left[ T_{\text{end}}, T_{\text{end}} + 15\text{m} \right]$, the room is in `grace_period` status on Reception Radar.
2. **Overstay Policy**:
   - If guest exceeds $T_{\text{end}} + G_{\text{grace}}$ without checking out, Reception Radar flags the room as `overstay` (amber alert).
   - Reception staff receives an automated prompt to contact guest politely.
   - For the initial pilot, overstay is handled operationally by reception without automated punitive fines.

---

## 4. Housekeeping & Turnaround Buffer

1. **Housekeeping Buffer (Default: 45 Minutes)**:
   - Mandatory sanitization window following checkout.
   - Tasks: Linen replacement, bathroom disinfection, floor mopping, towel restock, and drinking water replenishment.
2. **Total Effective Occupancy**:
   $$\text{Total Blocked Window} = D_{\text{duration}} + G_{\text{grace}} + H_{\text{housekeeping}}$$
   - For `FRESHEN_UP` (90m): $90 + 15 + 45 = 150\text{ minutes}$ (2.5 hours).
   - For `DAY_REST_3H` (180m): $180 + 15 + 45 = 240\text{ minutes}$ (4 hours).
   - For `DAY_REST_6H` (360m): $360 + 15 + 45 = 420\text{ minutes}$ (7 hours).

---

## 5. Temporary Hold & Expiry Policy

1. **Hold TTL**: Fixed at **10 minutes (600 seconds)** from creation.
2. **Exclusivity**: While a hold is active (`expiresAt > now`), its effective window blocks that physical room unit from all other customers.
3. **Automatic Release**: When `now > expiresAt`, the hold is deemed inactive during real-time availability evaluation. No background polling cron is required.

---

## 6. Vendor Control & Property Blackout Rules

1. **1-Click Day Stay Block**:
   - `blockToday`: Sets `isBlockedToday: true`, immediately disabling Day Stay search and slot booking for today.
   - `blockTomorrow`: Adds tomorrow's date to `blackoutDates`.
   - `customDates`: Adds specified date array to `blackoutDates`.
2. **Isolation from Overnight Stays**:
   - Blocking Day Stay **never** cancels, modifies, or blocks overnight bookings.
   - Blocking Day Stay leaves existing confirmed Day Stay reservations intact while preventing new holds.

---

## 7. Pricing & Snapshot Rule (Immutable Order Snapshot)

- When a booking is initiated, the system computes total charges from the property/room pricing snapshot.
- The snapshot (`basePrice`, `taxes`, `platformFee`, `graceMinutes`, `bufferMinutes`) is stored directly inside `booking.dayStayDetails`.
- **Invariant**: Any subsequent change by property vendor to room rates or platform defaults will **never** alter the price, duration, or terms of an already created or confirmed booking.
