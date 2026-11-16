# Tirvona Yatra: operating procedures

For Tirvona support, finance and Destination Ops staff. Each procedure names the screen to use.
Nothing in Yatra moves money outside Tirvona automatically: Razorpay collects, the Tirvona wallet
refunds, and people make bank transfers by hand.

## 1. Support workflow

1. **Find the booking.**
   - Super Admin: Admin → All Yatra Bookings, searched by reference (`TVN-YTR-…`).
   - Destination Ops: /ops/yatra → Booking assistance. It only finds bookings in your own area.
2. **Identify the problem type.**

   | Customer says | Do this |
   |---|---|
   | "I paid but have no ticket" | Open the booking. If it is `confirmed`, the ticket is in their Journey Hub (/profile/journeys). If it is still `held` or `payment_pending`, open Collections & Ledger → Payment issues. A paid order that could not be used is refunded to the wallet automatically. |
   | "I want to cancel" | The customer requests it from the Journey Hub, or the organiser does from their console. Super Admin decides under Cancellation Requests (see refund workflow). |
   | "The bus / guide / meal was not as promised" | Create an incident (see incident SOP). For a refund, follow the refund workflow. |
   | "My ride did not come" | Admin → Local Rides, or the Ops rides list. Cancel the ride; a paid ride is refunded 100% to the wallet. Create an incident against the partner. |
   | "I cannot see my booking" | Check they are signed in with the email or phone used to book. Organiser-assisted bookings are linked to the account that paid through the payment link. |

3. Reply in writing and quote the booking reference.
4. Close any incident you opened with a resolution note.

## 2. Refund workflow

Refunds always go to the customer's **Tirvona wallet**, never to cash, UPI or the organiser.

**Tour booking cancellation**

1. The customer or organiser requests cancellation, and the booking becomes `cancellation_requested`.
2. Super Admin opens Admin → Cancellation Requests. The quote shows the refund the tour's policy allows today.
3. Approve, keeping the quote or entering another refund percentage with a note, or reject with a reason.
4. On approval, the wallet is credited exactly once (idempotency key `refund:yatra:<bookingId>`). The organiser's earning is reversed in proportion: gross, commission, GST and TDS.
5. If the organiser has already been paid for that booking, the reversal lowers their next payable balance. If that goes negative, Finance settles it with an adjustment.

**Departure cancelled by Tirvona** (Admin → Departures → Cancel): every confirmed traveller gets 100% back in their wallet.

**Local ride**

- Cancelled by the pilgrim at least *ride refund window* hours before pickup (Settings, default 2 h): 100% to the wallet. Later than that: no refund.
- Cancelled by the partner, or by Tirvona/Ops: 100% to the wallet. A partner cancellation also raises a high-severity incident.

**Paid but unusable payment** (late payment after the hold lapsed, a double payment, or a cancelled booking): refunded in full to the payer's wallet automatically. It appears under Collections & Ledger → Payment issues.

## 3. Manual payout SOP (Finance Manager or Super Admin)

Only Finance can record transfers. Tirvona never initiates or confirms a bank transfer automatically.

1. **Balance.** Finance Center → Payables lists each organiser and ride partner:
   - *Can be paid* is earnings from delivered journeys and completed rides, minus commission, GST, TDS, refunds and earlier transfers;
   - *Not yet delivered* becomes payable after the journey end date.
2. **Request.** The payee requests a payout from their console, or Finance uses **Create payout**. Only one payout per payee can be open at a time, and the amount cannot exceed what can be paid.
3. **Review.** Finance Center → Payouts → New → **Start review**.
   - Open the payee statement and check the bookings behind the amount.
   - Check the bank or UPI details shown on the payout. They are copied at request time; the account number is masked.
4. **Approve** (or Reject with a reason). Approval re-checks the balance. If a refund reduced it, approval is refused with "AMOUNT_ABOVE_PAYABLE".
5. **Transfer in the bank**, outside Tirvona: NEFT, RTGS, IMPS or UPI from Tirvona's current account, for exactly the approved amount.
6. **Record transfer** on the approved payout:
   - method;
   - date;
   - **UTR / bank reference**: unique across all payouts, so a repeat is refused as DUPLICATE_UTR;
   - amount, which must equal the approved amount;
   - proof (bank screenshot or PDF, stored privately).
   This posts a "transfer" row to the payee ledger and notifies the payee.
7. **Reconcile** when the bank statement is available: enter the amount the statement shows.
   - If it matches, the payout is `reconciled`.
   - If it differs, a note is required and the difference stays visible on the dashboard ("Bank differences").
8. **Mistakes.**
   - Wrong amount or payee before approval: reject the payout and create a new one.
   - After a transfer is recorded: the record cannot be edited. Post a correcting **Adjustment** in Payables with the reason and the UTR of the correction.

## 4. Booking and Razorpay reconciliation SOP

There are two separate reconciliations. Do not mix them.

**A. Razorpay settlement (customer money in)**: Finance Center → Razorpay reconciliation.

- With `YATRA_RECONCILIATION_ENABLED=true` and the sweep on, the check runs once a day for the day before yesterday (India time). Otherwise, run it by hand for any day.
- For every Yatra payment captured that day, the check confirms with Razorpay that it is captured with the same amount, and whether it has settled.
- **Mismatch.** Open the run and look up the payment in the Razorpay dashboard.
  - Captured in Razorpay but the booking is not confirmed: the payment is returned to the wallet if unusable. Check Collections & Ledger → Payment issues.
  - Amount differs: escalate to the owner. Do not refund by hand.
- *Skipped* means the Razorpay keys are not configured on that server. *Failed* shows the error. Re-run the day after fixing it; a re-run replaces that day's result.
- Razorpay settles a few days after capture, so unsettled payments for recent days are normal.

**B. Daily booking check (weekly during the pilot).** Finance Center → Reports for the range, then Download CSV. Compare:

- *Collected* against the Razorpay dashboard's captured total for the same days;
- *Refunds* against the wallet credits (Admin → Wallets, module "yatra");
- *Commission* against the expected rate on that week's confirmed bookings.

Fix "Bookings without a commission rule" before month end, so commission and payables are complete.

## 5. Incident handling SOP (Destination Ops)

1. **Log it immediately** at /ops/yatra → Report incident: city, what happened, category and severity, plus the booking reference if one is involved. HR and Executive logins can only log incidents for their office area.
2. **Severity guide.**

   | Severity | Examples | Response |
   |---|---|---|
   | critical | accident, medical emergency, missing traveller, a safety threat | Call emergency services first (112). Then call the organiser and the Tirvona pilot lead. Update every 30 min. |
   | high | bus breakdown, no-show vehicle, a ride partner cancelled at the last minute, the group stranded | Arrange an alternative with the organiser within 1 hour. Tell the travellers. |
   | medium | late departure, meal or puja not as booked | Resolve the same day. Consider a partial refund through the refund workflow. |
   | low | a complaint or suggestion | Resolve within 3 days. |

3. **Start handling** when someone owns it, and **Mark resolved** with what was done. The resolution is saved on the incident, but Yatra does **not** notify the reporter yet, so call or message the pilgrim or partner yourself. **Close** after any follow-up refund is decided.
4. Ride problems: cancel and reassign the ride from the Ops rides list or Admin → Local Rides. Repeated partner incidents mean Super Admin should suspend the partner.
5. Pilgrims' "Report a problem" and "Report issue" (Journey Hub) and partner issue reports appear in the same list.
