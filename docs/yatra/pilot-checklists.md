# Tirvona Yatra: pilot checklists

For Tirvona's verification team and the pilot lead. Use them for the first organisers and ride
partners. Every step below is done in the Tirvona admin console. Nothing is approved by email or phone.

## 1. Pilot organiser onboarding

Before the organiser registers:

- [ ] The organiser has a Tirvona account (any normal sign-up works). They register at **/yatra-partner → Register as an organiser**.
- [ ] Explain the rules in writing:
  - every customer pays Tirvona online (no cash and no UPI to the organiser);
  - refunds go to the customer's Tirvona wallet;
  - payouts are manual, after the journey ends;
  - only Tirvona publishes tours.
- [ ] Agree the commission in writing. Finance enters it as a rule (Finance Center → Commission rules) **before the first booking**. A booking confirmed with no matching rule waits in "Bookings without a commission rule", and the organiser earns nothing until Finance applies a rule.
- [ ] Share the documents list: PAN card, GST certificate or business registration if any, and for each vehicle the RC, a valid permit and insurance.

The organiser does this in their console:

- [ ] Profile: organisation name and type, contact phone, city, PAN number.
- [ ] Payout details: bank account (stored encrypted, shown as the last 4 digits) or UPI ID.
- [ ] Documents: at least the PAN card. GST and registration if they have them.
- [ ] Team: staff added with the right organiser role (owner, manager, sales, or boarding staff).
- [ ] Vehicles, each with its RC, permit and insurance uploaded.
- [ ] Submit the organisation (accepts the terms).

## 2. Organiser verification (Super Admin)

Admin → Yatra → Organisers → the organiser:

- [ ] Open each document through **View**. The link is signed and lasts 5 minutes, and each view is audit-logged. Never download KYC files to personal devices or share links.
- [ ] Check the PAN number on the profile against the PAN card image, and the name against the organisation or proprietor.
- [ ] Check that the GST or registration certificate (if given) matches the organisation name.
- [ ] Approve or reject each document. A rejection needs a reason, and the organiser sees it.
- [ ] For each vehicle, check the registration number on the RC, the permit validity (tourist / contract carriage), the insurance validity, and that the seat count matches the RC. Approve the vehicle only when all three are valid.
- [ ] Approve the organisation, or reject it with a reason.
- [ ] Review each submitted tour (Admin → Tour Review & Publishing):
  - route and stops are realistic;
  - fare is inclusive and clear;
  - inclusions and exclusions are written down;
  - cancellation policy is set;
  - a verified vehicle is attached.
- [ ] Approve, then publish. Publishing makes the tour bookable once its departures are opened.
- [ ] Check the first departure's seat map (Admin → Departures) after the organiser opens it.

## 3. Ride partner verification (Super Admin)

The partner registers at **/ride-partner** (linked from /yatra-partner). Before they can submit, they
must add a phone, service cities, at least one vehicle, and upload a PAN card, driving licence, vehicle RC and insurance.

Admin → Yatra → Ride Partners → the partner:

- [ ] View each document (signed 5-minute link, audit-logged).
- [ ] Check that the driving licence is valid for the vehicle class, and the name matches the PAN.
- [ ] Check each vehicle's registration number against its RC and insurance, and that the seat count matches the RC.
- [ ] Check that the service cities are places the partner really serves.
- [ ] Approve, or reject with a reason. Only an **approved** partner can receive ride requests (enforced by the API).
- [ ] Ask Finance to confirm the ride commission rule exists (Commission rules → Local rides).

## 4. Pilot go-live checklist

- [ ] Migrations 0015 and 0016 applied with approval (see `launch-and-rollback.md`).
- [ ] At least one commission rule exists for **Tour bookings** (everyone), **Local rides** and **Meal & puja referrals**.
- [ ] Support phone set (Admin → Yatra Settings), plus the ride refund window, partner response time and reminder time.
- [ ] One test booking end to end in production with a small real payment:
  - book;
  - check the ticket and Journey Hub;
  - cancel;
  - confirm the wallet refund.
  Record the booking reference.
- [ ] Destination Ops staff (HR / Executive) for the pilot city have an HR office in that city and can open **/ops/yatra**.
- [ ] Finance has opened the Finance Center and knows the payout SOP (`operations-sops.md`).
- [ ] Incident contacts known: pilot lead, organiser owner phone, Tirvona support phone.
