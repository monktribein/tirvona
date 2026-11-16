# Yatra ticket on WhatsApp

When a Yatra booking is paid and confirmed, the traveller gets their ticket on WhatsApp, the same way a stay
booking gets its confirmation. It is the same message whoever made the booking: the traveller on the website,
or a partner (organiser) on the traveller's behalf.

## What is sent, and to whom

- **When:** once, at the moment the booking becomes `confirmed` (payment verified). A held, unpaid or
  cancelled booking sends nothing. The idempotency key is `yatra:<bookingId>:confirmed:whatsapp`.
- **To:** the booking contact's phone; if there is none, the phone on the traveller's Tirvona account.
- **Never blocks the booking.** A WhatsApp failure is logged and ignored; the booking stays confirmed.
- **Test mode** (`WHATSAPP_TEST_MODE=true`) applies as everywhere else: only allow-listed numbers receive it.

The message carries: booking ID and ticket code, route, departure and return time, seat numbers, each
passenger with their seat, the bus number, the partner's name, boarding point (address and report-by time),
dropping point, amount paid (and the ₹15/seat cancellation protection, if taken), any stay / food / taxi added,
the bus rules (child, luggage, pets, alcohol, pick-up time), the cancellation and refund policy, a link to the
ticket and QR, and the Tirvona app link
`https://play.google.com/store/apps/details?id=com.tirvona.app`.

## Two delivery paths

1. **Meta Cloud template (preferred, once approved).** Meta only delivers a business-initiated message through an
   approved template, so the full text cannot be sent as it is. Until a template name is configured the router
   does not use Meta for this event.
2. **Text providers (MSG91 / AK NEXUS).** Used while no Meta template is configured, exactly as for any other
   event without one. They send the full message above.

## Creating the Meta template

In WhatsApp Manager create a **Utility** template, language `en`, with **positional** parameters and no buttons.
Suggested name: `tirvona_yatra_confirmed`.

```
Hello {{1}}, your Tirvona Yatra ticket is confirmed.

Tour: {{2}}
Booking ID: {{3}}
Departure: {{4}}
Seat no.: {{5}}
Boarding point: {{6}}
Amount paid: {{7}}
Ticket code: {{8}}

Bus rules: {{9}}

Cancellation and refund: {{10}}

Show the ticket code when boarding. For more details, download the Tirvona app: https://play.google.com/store/apps/details?id=com.tirvona.app
```

| Placeholder | Value |
| --- | --- |
| `{{1}}` | `customer_name` |
| `{{2}}` | `service_name` (tour title) |
| `{{3}}` | `reference` (booking ID) |
| `{{4}}` | `scheduled_at` (departure date and time, IST) |
| `{{5}}` | `seats` (for example `12, 13`) |
| `{{6}}` | `boarding_point` |
| `{{7}}` | `amount_paid` |
| `{{8}}` | `entry_code` (ticket code) |
| `{{9}}` | `rules_summary` (the rules as one line, at most 500 characters) |
| `{{10}}` | `refund_summary` (the refund policy as one line, at most 600 characters) |

Values never contain line breaks (Meta rejects them); several rules or refund lines are joined with ` • ` and
cut with `…` if they are too long. Per-seat names and the full text stay in the ticket in the app.

Once Meta approves it, set in the API's environment (names only here):

```
WHATSAPP_META_TEMPLATE_YATRA_CONFIRMED=tirvona_yatra_confirmed
# only if the approved wording orders the placeholders differently:
# WHATSAPP_META_TEMPLATE_YATRA_CONFIRMED_BODY_VARS=customer_name,service_name,reference,...
```

and restart the API. Until then the text providers carry the message.

**Category risk.** The "download the Tirvona app" line is an invitation, which Meta can treat as marketing. If
the template is re-categorised as Marketing (different price, needs opt-in), remove that sentence from the
template; the text-provider message keeps it.

## Where it lives

- Message text: `buildYatraMessage` in `Newbackend/src/integrations/whatsapp/utils/whatsapp-message.builder.ts`.
- Sending and template fields: `sendYatraTicket` in
  `Newbackend/src/integrations/whatsapp/services/whatsapp-transactional-notification.service.ts`.
- Template catalogue entry (`yatra_confirmed`): `whatsapp-meta-templates.constants.ts` in the same package.
- What goes in it for a booking: `whatsappContext` in
  `Newbackend/src/modules/yatra/application/yatra-booking.service.ts`; sent by `YatraNotifier.whatsappTicket`.
