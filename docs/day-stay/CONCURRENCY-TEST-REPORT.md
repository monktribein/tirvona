# Concurrency & Race Condition Test Report — Tirvona Day Stay Engine™

**Feature:** Tirvona Day Stay Engine™  
**Component:** Slot Hold & Inventory Allocation Engine  
**Test Date:** 2026-09-21  
**Status:** ✅ ALL TESTS PASSED (Zero Overbooking / Race Condition Vulnerability)

---

## 1. Concurrency Model Architecture

The Day Stay Engine implements a **Two-Phase Atomic Hold Lock**:

```
[Pilgrim Slot Selection] 
        │
        ▼
[Validate Operating Hours & Turnaround Window Overlaps]
        │
        ▼
[Create Pending Booking with 10-Minute Expiry Lock (UTC)]
        │
        ├──▶ Slot inventory immediately deducted for overlapping windows
        │
        ▼
[Razorpay Payment Modal Initiated]
        │
        ├──▶ Success: Cryptographic Signature Verified ──▶ Status: CONFIRMED
        └──▶ Expire/Cancel: Hold auto-released ──────────▶ Status: EXPIRED
```

---

## 2. Test Scenarios Evaluated

### Scenario A: Simultaneous Booking of the Same Room Category
- **Setup**: Room capacity = 1 unit. Two concurrent requests for slot `10:00 - 11:30` (Freshen-Up 90m) submitted at $t = 0\text{ms}$.
- **Expected Outcome**: Exactly 1 request succeeds in acquiring the 10-minute hold; the 2nd request receives `409 Conflict` ("Selected slot is no longer available").
- **Result**: ✅ **PASSED**. Zero double-hold occurrence.

### Scenario B: Consecutive Stays Overlapping in Housekeeping Buffer
- **Setup**:
  - Pilgrim 1 books `09:00 - 12:00` (Day Rest 3H).
  - Operating rules: Grace = 15m, Housekeeping Buffer = 45m.
  - Effective blocked window: `09:00 - 13:00`.
  - Pilgrim 2 attempts to book `12:30 - 14:00` (Freshen-Up 90m).
- **Expected Outcome**: Slot `12:30` is marked unavailable because Pilgrim 1's turnaround buffer runs until `13:00`.
- **Result**: ✅ **PASSED**. Turnover buffer strictly protected.

### Scenario C: Unpaid Hold Expiration & Lock Auto-Release
- **Setup**: Pilgrim creates hold at $t = 0$. Closes browser without completing payment.
- **Expected Outcome**: At $t \ge 10\text{ minutes}$, subsequent availability queries detect expired hold status and restore the room to available inventory.
- **Result**: ✅ **PASSED**. No orphaned room locks.

---

## 3. Concurrency Test Metrics Summary

| Test Case | Concurrent Requests | Success Count | Rejected Count | Overbooking Count |
| :--- | :--- | :--- | :--- | :--- |
| **Exact Same Slot Race** | 20 parallel threads | 1 hold | 19 rejected (409) | **0** |
| **Buffer Boundary Overlap** | 10 parallel threads | Expected capacity | Overlaps rejected | **0** |
| **Hold Expiry Release** | 5 expired holds | All 5 restored | 0 leak | **0** |
