# TIRVONA DAY STAY ENGINE™ — FINAL PAYMENT & RECONCILIATION FLOW

## 1. Overview & Architecture

The Tirvona Day Stay payment engine is built directly on Tirvona's existing Razorpay infrastructure. To support real-world pilgrimage conditions (high network congestion, patchy 4G/5G mobile data, and sudden device disconnections in temple areas), the architecture implements a **Dual-Path Idempotent Settlement Pipeline**:

1. **Client-Side Fast Path**: Browser receives payment success from Razorpay SDK and immediately calls `POST /api/day-stay/confirm` for real-time UI redirection.
2. **Server-Side Webhook Path**: Razorpay sends `payment.captured` / `order.paid` to `POST /api/payments/webhook` directly server-to-server.

Both paths converge on a single idempotent state machine inside `DayStayBookingService`.

```
               [Customer Completes Payment via UPI / Card]
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        [Fast Client-Side Flow]             [Async Webhook Flow]
                  │                                   │
      POST /api/day-stay/confirm          POST /api/payments/webhook
                  │                                   │
      HMAC-SHA256 Signature Verify        HMAC-SHA256 Webhook Verify
                  │                                   │
                  │                        Deduplicate Event ID
                  │                        in PaymentWebhookEvent
                  │                                   │
                  └─────────────────┬─────────────────┘
                                    ▼
                +---------------------------------------+
                |  DayStayBookingService.confirmPayment |
                |  1. Find Booking by OrderId           |
                |  2. If already 'confirmed' -> Return  |
                |  3. If 'held' / 'pending':            |
                |     - Check slot availability         |
                |     - Status = 'confirmed'            |
                |     - PaymentStatus = 'paid'          |
                |     - Emit 1x Confirmation Notif      |
                +---------------------------------------+
```

---

## 2. Fast-Path Client Confirmation

1. Guest clicks "Pay & Confirm" on `DayStayBookingCard`.
2. Frontend creates hold via `POST /api/day-stay/hold`, receiving Razorpay `orderId` and hold `bookingId`.
3. Razorpay Checkout modal opens. Guest completes payment via UPI, NetBanking, or Card.
4. Razorpay SDK `handler(response)` receives `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature`.
5. Frontend sends payload to `POST /api/day-stay/confirm`.
6. Server computes expected HMAC:
   $$\text{Expected Signature} = \text{HMAC-SHA256}(\text{order\_id} + "|" + \text{payment\_id}, \text{RAZORPAY\_KEY\_SECRET})$$
7. Upon validation, booking is marked `confirmed` and UI transitions to Booking Confirmation voucher.

---

## 3. Server-Side Webhook Reconciliation

1. If the guest's mobile connection drops, phone battery dies, or browser tab is closed immediately after Razorpay payment authorization, Razorpay triggers a webhook event (`payment.captured` or `order.paid`).
2. Webhook arrives at `POST /api/payments/webhook`.
3. `PaymentsWebhookService` verifies signature using `RAZORPAY_WEBHOOK_SECRET`.
4. Idempotency Check: Inserts record into `PaymentWebhookEvent` collection with unique index on `{ provider: "razorpay", eventId: 1 }`. If duplicate, drops immediately with `200 OK`.
5. `PaymentsWebhookService` inspects the order and routes to `DayStayBookingService.confirmPaymentFromWebhook(orderId, paymentId)`.
6. Booking is transitioned to `confirmed` and guest receives WhatsApp / SMS confirmation voucher asynchronously.

---

## 4. Idempotency & Concurrency Guarantees

| Race Scenario | System Behavior & Guarantee |
|---|---|
| **Client confirm + Webhook arrive simultaneously** | Atomic Mongoose update transitions state once; the second runner observes `status === 'confirmed'` and returns success without double-processing. |
| **Duplicate Webhooks from Razorpay retries** | MongoDB unique compound index `{ provider: "razorpay", eventId: 1 }` prevents duplicate execution. |
| **Duplicate Browser Confirmations** | Idempotency guard checks `booking.paymentStatus === 'paid'` and returns existing confirmed booking without emitting duplicate notifications. |
| **Tampered / Invalid Signature** | Throws `400 Bad Request` (`INVALID_PAYMENT_SIGNATURE`), booking remains in `held` status until hold expires. |

---

## 5. Edge Case: Payment Received After Hold Expiry

If a guest takes > 10 minutes to complete UPI pin entry, the original hold expires before payment completes.
When the webhook or confirm arrives:
1. `DayStayBookingService` checks whether the room slot has been taken by a competing customer.
2. **Case A (Slot is still free)**: System automatically re-acquires the slot and confirms the booking. Guest receives voucher with zero friction.
3. **Case B (Slot was booked by another customer)**:
   - System marks booking `status: "cancelled"`, `paymentStatus: "refunded"`.
   - Records audit entry: `HOLD_EXPIRED_SLOT_COLLISION`.
   - Queues automated gateway refund via Razorpay Refund API (`POST /v1/payments/{id}/refund`).
   - Emits instant SMS/WhatsApp alert explaining the room was booked and refund is processed.
   - Zero double-booking occurs; zero orphan payments lost.
