# Tirvona Yatra: notifications

For the owner and the team that manages Meta WhatsApp templates. Yatra reuses Tirvona's existing
channels. It adds no new provider.

## What is sent today

| Event | In-app (bell) | Email (`YATRA_EMAIL_ENABLED`) |
|---|---|---|
| Booking confirmed (paid) | Customer, organiser team | Customer: ticket code and Journey Hub link |
| Cancellation requested | Super Admin, organiser team | — |
| Cancellation approved (with refund) or rejected | Customer | Customer (approval only) |
| Departure cancelled by Tirvona | Every paid customer (as an approved cancellation), organiser team | Every paid customer |
| Journey reminder (*reminder hours* before departure, sweep on) | Customer | Customer |
| Organiser, staff invite, document, vehicle or tour review result | Organiser owner / team | — |
| Add-on (meal / puja) request and assignment | Supplier, Super Admin | — |
| Add-on cancelled | Customer | — |
| Ride request or assignment | Ride partner (or Super Admin when no partner was chosen) | — |
| Ride accepted, declined, confirmed, started, completed, cancelled | Customer | — |
| Ride cancelled by the customer or Tirvona | Ride partner | — |
| Ride declined or cancelled by the partner, unanswered requests returned, ride or journey issue reported | Super Admin | — |
| Payout reviewed, approved, rejected, transfer recorded | Organiser team / ride partner | — |
| Ride partner approved, rejected, suspended, reinstated | Ride partner | — |

Emails use the existing Resend account (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) and Tirvona's email
layout. A failed email never blocks a booking or refund.

## WhatsApp: NOT implemented, templates need Meta approval

Status: **pending, not operational.**

Tirvona does not send WhatsApp messages yet. The organiser console's "Share on WhatsApp" buttons (booking links and payment links) are only `wa.me` share links: they open the organiser's own WhatsApp with a pre-filled message, and the organiser sends it. They are not Tirvona notifications.

Business-initiated WhatsApp messages need templates
pre-approved by Meta. Submit these (category **Utility**, language English and Hindi) when WhatsApp
sending is planned. `{{n}}` are template variables.

| Template name | Text (English) |
|---|---|
| `yatra_booking_confirmed` | Your Tirvona Yatra booking {{1}} is confirmed. Tour: {{2}}, departs {{3}} from {{4}}. Ticket code: {{5}}. View your journey: {{6}} |
| `yatra_payment_link` | {{1}} has reserved {{2}} seat(s) for you on {{3}}. Pay securely to Tirvona within {{4}} minutes: {{5}} |
| `yatra_journey_reminder` | Reminder: your Yatra {{1}} departs {{2}} from {{3}}. Please reach 30 minutes early. Ticket code: {{4}}. Help: {{5}} |
| `yatra_cancellation_decided` | Your cancellation for booking {{1}} is {{2}}. Refund: ₹{{3}} to your Tirvona wallet. |
| `yatra_departure_cancelled` | We are sorry. Departure {{1}} on {{2}} is cancelled. ₹{{3}} has been refunded to your Tirvona wallet. |
| `yatra_ride_accepted` | Your ride {{1}} on {{2}} is accepted by {{3}}. Pay ₹{{4}} in your Journey Hub to confirm: {{5}} |
| `yatra_ride_confirmed` | Ride {{1}} confirmed. Pickup {{2}} at {{3}}. Vehicle {{4}}, driver {{5}} ({{6}}). |
| `yatra_ride_request_partner` | New Tirvona ride request {{1}}: {{2}} → {{3}} on {{4}}, {{5}} passenger(s). Respond within {{6}} hours: {{7}} |
| `yatra_payout_transferred` | Tirvona has sent ₹{{1}} for payout {{2}} by {{3}}, reference {{4}}. |
| `yatra_incident_update` | Update on your issue {{1}}: {{2}} |

Rules for when WhatsApp is built:

- send only to numbers that opted in;
- never send KYC documents or full bank numbers;
- gate sending behind its own flag.

SMS is not implemented either. If it is added, the same texts need DLT template registration in India.
