# Payment Flow Audit — Tirvona Day Stay Engine™

**Feature:** Tirvona Day Stay Engine™  
**Payment Gateway:** Razorpay (Standard Checkout SDK + Server-Side Verification)  
**Audit Date:** 2026-09-21  
**Status:** ✅ CERTIFIED & COMPLIANT

---

## 1. End-to-End Payment Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Pilgrim (Browser)
    participant Engine as Day Stay Booking Service
    participant Gateway as Razorpay Gateway
    participant DB as MongoDB

    Customer->>Engine: POST /api/day-stay/hold {ashramId, roomId, productCode, slot}
    Engine->>DB: Check Availability & Create Pending Booking (10m Hold)
    Engine->>Gateway: Create Order (amount, currency: INR, receipt)
    Gateway-->>Engine: Return razorpayOrderId
    Engine-->>Customer: Return bookingId, razorpayOrderId, razorpayKeyId

    Customer->>Gateway: Open Razorpay Checkout Modal & Complete Payment
    Gateway-->>Customer: Returns razorpay_payment_id & razorpay_signature

    Customer->>Engine: POST /api/day-stay/confirm {bookingId, orderId, paymentId, signature}
    Engine->>Engine: Verify HMAC SHA-256 (orderId + "|" + paymentId, secret)
    alt Signature Valid
        Engine->>DB: Update Booking Status -> "CONFIRMED", Payment -> "PAID"
        Engine-->>Customer: Return 200 OK + Confirmation Details
    else Signature Invalid
        Engine-->>Customer: Return 400 Bad Request ("Signature verification failed")
    end
```

---

## 2. Cryptographic Security Checks

1. **HMAC SHA-256 Validation**:
   - Order ID and Payment ID concatenation strictly verified against `RAZORPAY_KEY_SECRET` using Node.js `crypto.createHmac`.
   - Client is never trusted for payment confirmation without cryptographic proof.

2. **Amount Tamper Protection**:
   - The Razorpay order amount is calculated entirely server-side from base room category rates, applicable GST (18%), and platform fee settings.
   - Client-side modification of total price is completely mitigated.

3. **Double Confirmation Prevention**:
   - Verification endpoint checks if booking status is already `CONFIRMED`. Replay attempts return the existing confirmed state idempotently without double-crediting.

---

## 3. Failure & Edge Case Handling

| Edge Case | Gateway / System State | Action Taken |
| :--- | :--- | :--- |
| **Customer Closes Modal** | Payment unattempted | Hold remains active until 10m expiry; auto-releases inventory. |
| **Payment Failed / Declined** | Razorpay emits `payment.failed` | Frontend displays clear error message; user can retry within remaining hold window. |
| **Network Drop After Payment** | Payment charged, confirmation dropped | Webhook fallback reconciles booking status automatically using Order ID. |
| **Signature Mismatch** | Tampered payload | Request rejected with `400 Bad Request`; security event logged. |
