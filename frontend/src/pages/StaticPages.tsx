import React from "react";
import { formatCurrency } from "../utils/format";

const StaticSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="space-y-3 pb-8 border-b border-gray-100 dark:border-slate-800 last:border-0 last:pb-0">
    <h2 className="font-extrabold text-[#0B192C] dark:text-white text-base">
      {title}
    </h2>
    <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
      {children}
    </div>
  </div>
);

export const CancellationPolicyPage: React.FC = () => (
  <div className="pb-20">
    <section className="bg-[#0B192C] text-white py-14 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="inline-block text-[10px] font-extrabold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
          Policies
        </span>
        <h1
          className="font-extrabold text-white"
          style={{ fontSize: "clamp(1.8rem, 6vw, 2.8rem)" }}
        >
          Cancellation Policy
        </h1>
        <p className="text-sm text-gray-400">
          Effective Date: 1st January 2025
        </p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-gray-50 dark:bg-slate-900 px-5 py-3 border-b border-gray-100 dark:border-slate-800">
          <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
            Refund Summary
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {[
            {
              when: "More than 7 days before check-in",
              refund: "100% Full Refund",
              color: "text-[#0E7B6C]",
            },
            {
              when: "3–7 days before check-in",
              refund: "75% Refund",
              color: "text-[#F28C28]",
            },
            {
              when: "1–2 days before check-in",
              refund: "50% Refund",
              color: "text-[#D4AF37]",
            },
            {
              when: "Less than 24 hours / No Show",
              refund: "No Refund",
              color: "text-red-500",
            },
          ].map((row, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-5 py-4 text-sm"
            >
              <span className="text-gray-600 dark:text-gray-300 font-medium">
                {row.when}
              </span>
              <span className={`font-extrabold ${row.color}`}>
                {row.refund}
              </span>
            </div>
          ))}
        </div>
      </div>

      <StaticSection title="Standard Cancellation Policy">
        <p>
          Tirvona offers a flexible cancellation framework designed to be fair
          to both pilgrims and stay owners. The refund amount depends on how
          far in advance you cancel relative to your check-in date.
        </p>
        <p>
          All cancellations must be initiated through your Tirvona dashboard
          under "My Bookings". Cancellations requested via phone or email will
          not be processed.
        </p>
      </StaticSection>

      <StaticSection title="Special Circumstances">
        <p>
          <strong className="text-[#0B192C] dark:text-white">
            Natural Disasters & Pilgrim Routes Closed:
          </strong>{" "}
          If a government body officially closes a pilgrimage route (e.g., Char
          Dham yatra suspension), affected bookings will receive a full refund
          regardless of timing.
        </p>
        <p>
          <strong className="text-[#0B192C] dark:text-white">
            Medical Emergencies:
          </strong>{" "}
          Cancellations due to documented medical emergencies (with valid
          certificate) may be eligible for 100% refund at ashram's discretion.
        </p>
        <p>
          <strong className="text-[#0B192C] dark:text-white">
            Festival & Peak Season Bookings:
          </strong>{" "}
          Some stays apply stricter non-refundable policies during peak
          pilgrim seasons (Navratri, Kumbh, Char Dham season). This is clearly
          marked on the stay listing.
        </p>
      </StaticSection>

      <StaticSection title="How to Cancel">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Login to your Tirvona account</li>
          <li>Go to Dashboard → My Bookings</li>
          <li>Select the booking you wish to cancel</li>
          <li>Click "Cancel Booking" and confirm</li>
          <li>
            You'll receive a cancellation confirmation and refund timeline via
            email
          </li>
        </ol>
      </StaticSection>

      <StaticSection title="Refund Processing Time">
        <p>
          Refunds are credited to your original payment method within 5–7
          business days. For UPI payments, refunds typically arrive within 1–2
          business days. Processing times may vary by bank.
        </p>
      </StaticSection>

      <StaticSection title="Ashram-Initiated Cancellations">
        <p>
          If a stay cancels your confirmed booking for any reason, you are
          entitled to a full 100% refund regardless of when the cancellation
          occurs. We will also help you find alternative accommodation at no
          extra charge.
        </p>
      </StaticSection>

      <div className="bg-[#F28C28]/5 border border-[#F28C28]/10 rounded-2xl p-5 text-sm text-gray-600 dark:text-gray-300">
        For disputes or questions about a refund, contact{" "}
        <a
          href="mailto:support@tirvona.in"
          className="text-[#F28C28] font-bold"
        >
          support@tirvona.in
        </a>{" "}
        or call{" "}
        <strong className="text-[#0B192C] dark:text-white">
          +91 78360 55511
        </strong>
        .
      </div>
    </div>
  </div>
);

export const GovtGuidelinesPage: React.FC = () => (
  <div className="pb-20">
    <section className="bg-[#0B192C] text-white py-14 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="inline-block text-[10px] font-extrabold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
          Information
        </span>
        <h1
          className="font-extrabold text-white"
          style={{ fontSize: "clamp(1.8rem, 6vw, 2.8rem)" }}
        >
          Government Guidelines
        </h1>
        <p className="text-sm text-gray-400">
          Ministry of Tourism & IT Division, Government of India
        </p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-2xl p-5 text-sm text-gray-700 dark:text-gray-200 font-medium">
        🏛️ Tirvona operates in compliance with the Digital India initiative,
        Ministry of Tourism directives, and all applicable regulations under the
        IT Act 2000, as amended.
      </div>

      <StaticSection title="1. Digital India Compliance">
        <p>
          Tirvona is an approved platform under the Digital India programme. All
          data is stored on servers located within India in accordance with data
          localisation requirements.
        </p>
        <p>
          Our platform integrates with the government's e-KYC system for ashram
          owner verification, ensuring authenticity and accountability.
        </p>
      </StaticSection>

      <StaticSection title="2. Pilgrim Safety Standards">
        <p>All registered stays must comply with:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            Fire safety standards as per NBC 2016 (National Building Code)
          </li>
          <li>Food safety standards under FSSAI regulations</li>
          <li>Basic medical facilities or tie-up with nearby hospitals</li>
          <li>
            Display of emergency contact numbers (police, ambulance, fire)
          </li>
          <li>Visitor register maintenance as per local police requirements</li>
        </ul>
      </StaticSection>

      <StaticSection title="3. Guest Registration (Form C)">
        <p>
          As per the Foreigners Act 1946 and Hotel and Lodge Registration Rules,
          all stays are required to maintain a record of guests. Foreign
          nationals must submit Form C within 24 hours of check-in.
        </p>
        <p>
          Tirvona's digital check-in system is designed to facilitate this
          requirement seamlessly.
        </p>
      </StaticSection>

      <StaticSection title="4. Pricing Regulation">
        <p>
          Tirvona complies with state government guidelines on price caps during
          peak pilgrimage seasons. Stays are notified of applicable caps and
          are contractually obligated to honour them.
        </p>
        <p>
          Price gouging during religious festivals is strictly prohibited and
          can result in immediate delisting.
        </p>
      </StaticSection>

      <StaticSection title="5. Accessibility (Divyang-Friendly)">
        <p>
          Under the RPwD Act 2016, stays with more than 20 rooms are
          encouraged to provide at least one accessible room. Tirvona maintains
          a dedicated filter for accessibility-compliant stays.
        </p>
      </StaticSection>

      <StaticSection title="6. Grievance Redressal">
        <p>
          As required by IT (Intermediary Guidelines) Rules 2021, Tirvona
          maintains a dedicated Grievance Officer:
        </p>
        <p className="font-semibold text-[#0B192C] dark:text-white">
          Grievance Officer: Mr. Nakul Jain
          <br />
          Email: grievance@tirvona.in
          <br />
          Response Time: Within 48 hours
        </p>
      </StaticSection>
    </div>
  </div>
);

export const OwnerGuidePage: React.FC = () => (
  <div className="pb-20">
    <section className="bg-[#0B192C] text-white py-14 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="inline-block text-[10px] font-extrabold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
          For Owners
        </span>
        <h1
          className="font-extrabold text-white"
          style={{ fontSize: "clamp(1.8rem, 6vw, 2.8rem)" }}
        >
          Owner Registration Guide
        </h1>
        <p className="text-sm text-gray-400">
          Step-by-step guide to listing your stay on Tirvona
        </p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
      {[
        {
          step: "01",
          title: "Create an Owner Account",
          desc: 'Register at tirvona.in/register. Select "I\'m a Stay Owner" during sign-up. Verify your mobile number and email address.',
        },
        {
          step: "02",
          title: "Submit KYC Documents",
          desc: "Upload: Trust Registration Certificate, PAN Card of Trust/Individual, Land Ownership Document or Lease Deed, Recent utility bill (proof of address), Aadhaar of authorised representative.",
        },
        {
          step: "03",
          title: "Complete the 20-Step Wizard",
          desc: "Our field executive will visit your stay and use the Tirvona Owner Wizard to fill in all details — basic info, address, GPS, photos, room types, pricing, facilities, food services, nearby attractions, and more.",
        },
        {
          step: "04",
          title: "Field Verification Visit",
          desc: "A Tirvona-trained field executive will physically visit your stay within 5–7 business days of KYC submission. They will verify facilities, photograph the premises, and conduct a safety audit.",
        },
        {
          step: "05",
          title: "Government Review",
          desc: "For stays near major pilgrimage circuits (Char Dham, Kashi, Tirupati), the district tourism officer may co-verify the listing. This typically takes 3–5 additional days.",
        },
        {
          step: "06",
          title: "Go Live",
          desc: 'Once approved, your stay receives the blue "Tirvona Verified" badge and becomes discoverable by millions of pilgrims. You\'ll receive login credentials for the Owner Dashboard to manage bookings, calendar, and pricing.',
        },
      ].map((s, i) => (
        <div
          key={i}
          className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 flex gap-5 shadow-sm"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#F28C28] text-white font-black text-sm flex items-center justify-center flex-shrink-0">
            {s.step}
          </div>
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
              {s.title}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
          </div>
        </div>
      ))}

      <div className="bg-[#F28C28]/5 border border-[#F28C28]/10 rounded-2xl p-5 space-y-3">
        <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
          Required Documents Checklist
        </h3>
        {[
          "Trust/Society Registration Certificate",
          "PAN Card (Trust or Individual)",
          "Land Ownership Deed or Registered Lease",
          "Fire Safety Certificate (if applicable)",
          "Aadhaar of Authorised Signatory",
          "Last 3 months utility bill",
          "4–6 high quality photographs of facilities",
        ].map((d, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"
          >
            <div className="w-4 h-4 rounded border-2 border-[#F28C28] flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 rounded-sm bg-[#F28C28]" />
            </div>
            {d}
          </div>
        ))}
      </div>

      <div className="text-center">
        <a
          href="/partner"
          className="inline-flex items-center gap-2 min-h-[52px] px-8 py-3 bg-[#F28C28] text-white font-extrabold text-sm rounded-full shadow-lg"
        >
          Start Registration Now
        </a>
      </div>
    </div>
  </div>
);

export const StayPoliciesPage: React.FC = () => (
  <div className="pb-20">
    <section className="bg-[#0B192C] text-white py-14 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="inline-block text-[10px] font-extrabold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
          Information
        </span>
        <h1
          className="font-extrabold text-white"
          style={{ fontSize: "clamp(1.8rem, 6vw, 2.8rem)" }}
        >
          Terms of Stay & Policies
        </h1>
        <p className="text-sm text-gray-400">
          Standard guidelines applicable to all Tirvona stays
        </p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <StaticSection title="General Conduct">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Guests are expected to respect the spiritual environment and daily
            routines of the stay.
          </li>
          <li>
            Maintain silence in meditation halls, during prayer hours, and after
            10:00 PM.
          </li>
          <li>Dress modestly — traditional Indian attire is recommended.</li>
          <li>
            Non-vegetarian food, alcohol, and tobacco are strictly prohibited
            inside all Tirvona-listed stays.
          </li>
          <li>
            Photography of religious ceremonies requires express permission from
            ashram management.
          </li>
        </ul>
      </StaticSection>

      <StaticSection title="Check-In & Check-Out">
        <p>
          Standard check-in time is 12:00 PM (noon) and check-out is 10:00 AM.
          Early check-in or late check-out may be available on request subject
          to availability and may incur additional charges.
        </p>
        <p>
          A valid government-issued photo ID (Aadhaar, Passport, Voter ID,
          Driving Licence) is mandatory at check-in for all guests above 18
          years of age.
        </p>
      </StaticSection>

      <StaticSection title="Food & Prasad">
        <p>
          All Tirvona stays serve only satvik, pure vegetarian food. Meals are
          typically included in accommodation packages or available for a
          nominal charge. Timings for meals are fixed by each stay and are
          displayed on their listing page.
        </p>
        <p>
          Outside food is generally not permitted inside dining halls. Please
          check the specific ashram's policy.
        </p>
      </StaticSection>

      <StaticSection title="Security Deposit">
        <p>
          Some stays may collect a refundable security deposit at check-in
          (typically {formatCurrency(500)}–{formatCurrency(2000)} depending on
          room category). This is returned
          in full at check-out if no damage is found.
        </p>
      </StaticSection>

      <StaticSection title="Children & Families">
        <p>
          Children below 5 years of age are generally accommodated free of
          charge when sharing with parents. Children aged 5–12 may be charged at
          50% of the adult rate. Individual stay policies may vary.
        </p>
      </StaticSection>

      <StaticSection title="Pets">
        <p>
          Pets are not permitted in any Tirvona-listed accommodation in keeping
          with the sacred environment of stays and dharamshalas.
        </p>
      </StaticSection>

      <StaticSection title="Ashram-Initiated Room Cancellations">
        <p>
          In the rare event that a room reservation is cancelled by the ashram or stay management (due to emergency maintenance, unexpected events, or unforeseen circumstances), the guest is entitled to a <strong className="text-[#0E7B6C] font-extrabold">100% full refund</strong> of all payments made, processed promptly back to the original payment source.
        </p>
      </StaticSection>

      <StaticSection title="Damage & Liability">
        <p>
          Guests are responsible for any damage caused to stay property during
          their stay. Tirvona mediates disputes between guests and stays but
          cannot be held liable for damages, theft, or personal injury during an
          ashram stay.
        </p>
      </StaticSection>

      <div className="bg-[#F28C28]/5 border border-[#F28C28]/10 rounded-2xl p-5 text-sm text-gray-600 dark:text-gray-300">
        For questions or concerns about your stay, contact{" "}
        <a
          href="mailto:support@tirvona.in"
          className="text-[#F28C28] font-bold"
        >
          support@tirvona.in
        </a>{" "}
        or visit our{" "}
        <a href="/help" className="text-[#F28C28] font-bold">
          Help Center
        </a>
        .
      </div>
    </div>
  </div>
);

export const TermsPage: React.FC = () => (
  <div className="pb-20">
    <section className="bg-[#0B192C] text-white py-14 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="inline-block text-[10px] font-extrabold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
          Legal
        </span>
        <h1
          className="font-extrabold text-white"
          style={{ fontSize: "clamp(1.8rem, 6vw, 2.8rem)" }}
        >
          Terms of Use
        </h1>
        <p className="text-sm text-gray-400">Last updated: 1st January 2025</p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <StaticSection title="1. Acceptance of Terms">
        <p>
          By accessing or using the Tirvona platform (website, mobile app, or
          API), you agree to be bound by these Terms of Use. If you do not
          agree, please discontinue use immediately.
        </p>
        <p>
          These terms constitute a legally binding agreement between you and
          NKTech Technology Private Limited, the company operating Tirvona.
        </p>
      </StaticSection>
      <StaticSection title="2. Use of Platform">
        <p>
          You may use Tirvona solely for lawful purposes — searching,
          discovering, and booking spiritually verified accommodation across
          India. Any commercial use, scraping, or reselling of platform data is
          strictly prohibited.
        </p>
        <p>
          You agree not to: impersonate any person or entity, submit false or
          misleading information, engage in fraudulent bookings, or attempt to
          reverse-engineer the platform.
        </p>
      </StaticSection>
      <StaticSection title="3. User Accounts">
        <p>
          You are responsible for maintaining the confidentiality of your login
          credentials. Tirvona is not liable for any loss arising from
          unauthorised use of your account. Notify us immediately at
          security@tirvona.in if you suspect unauthorised access.
        </p>
      </StaticSection>
      <StaticSection title="4. Booking & Payments">
        <p>
          Bookings made on Tirvona are subject to the ashram's availability and
          confirmation. Payment processing is handled by third-party payment
          gateways (RazorPay). Tirvona does not store card details.
        </p>
        <p>
          Prices are inclusive of applicable taxes unless otherwise stated. GST
          is charged at the applicable slab based on per-night room tariff. If a booking is cancelled from the stay or host management side, a 100% full refund is guaranteed to the customer without any platform deductions.
        </p>
      </StaticSection>
      <StaticSection title="5. Limitation of Liability">
        <p>
          Tirvona acts as an intermediary platform connecting pilgrims with
          ashrams. We are not liable for: quality of services at ashrams,
          personal injury or loss of property during stays, force majeure events
          (natural disasters, road closures, government orders), or any
          consequential, indirect, or incidental damages.
        </p>
      </StaticSection>
      <StaticSection title="6. Intellectual Property">
        <p>
          All content on Tirvona — including logos, design, text, and code — is
          the property of NKTech Technology Pvt. Ltd. Reproduction without
          written permission is prohibited.
        </p>
      </StaticSection>
      <StaticSection title="7. Governing Law">
        <p>
          These terms are governed by the laws of India. Any disputes shall be
          subject to the exclusive jurisdiction of the courts of Gautam Buddha
          Nagar (Noida), Uttar Pradesh.
        </p>
      </StaticSection>
      <StaticSection title="8. Contact">
        <p>
          For legal notices or queries: legal@tirvona.in | NKTech Technology
          Pvt. Ltd., 3rd Floor, ITHUM TOWER, Sector 62, Noida, UP 201301
        </p>
      </StaticSection>
    </div>
  </div>
);

type PolicyBlock =
  | { p: string; strong?: boolean }
  | { ul: string[] }
  | { ol: string[] }
  | { h3: string };

const PRIVACY_SECTIONS: { title: string; blocks: PolicyBlock[] }[] = [
  {
    title: "1. Introduction",
    blocks: [
      { p: "Welcome to Tirvona." },
      {
        p: "Tirvona is a digital infrastructure platform designed to connect India's religious and spiritual destinations with pilgrims, religious institutions, accommodation providers, local service providers, and communities.",
      },
      {
        p: "We respect your privacy and are committed to handling your personal information responsibly, transparently, and securely.",
      },
      {
        p: "This Privacy Policy explains how we collect, use, store, share, protect, and manage personal information when you access or use Tirvona's website, mobile applications, dashboards, booking facilities, institutional management solutions, and associated digital services.",
      },
      {
        p: "By using our services, you acknowledge this Privacy Policy. Where consent is required under applicable law, we will seek it separately.",
      },
    ],
  },
  {
    title: "2. Scope of This Policy",
    blocks: [
      { p: "This Privacy Policy applies to individuals interacting with Tirvona through:" },
      {
        ul: [
          "Tirvona.com and related websites.",
          "Tirvona mobile applications.",
          "Pilgrim and guest accounts.",
          "Stay-owner and accommodation management dashboards.",
          "Ashram, temple, and institutional profiles.",
          "Accommodation discovery and booking services.",
          "Spiritual programs, experiences, and event registrations.",
          "Mobility, parking, transportation, and local services.",
          "Seva, workforce, and community participation services.",
          "Marketplace and institutional technology services.",
          "Customer support, WhatsApp communications, and promotional campaigns.",
        ],
      },
      { p: "Some services may be subject to additional privacy notices or terms." },
    ],
  },
  {
    title: "3. Information We Collect",
    blocks: [
      {
        p: "Depending on the services you use, Tirvona may collect the following categories of information.",
      },
      { h3: "3.1 Personal Identification Information" },
      {
        ul: [
          "Full name.",
          "Mobile number.",
          "Email address.",
          "Residential or correspondence address.",
          "Age or date of birth, where necessary.",
          "Account credentials and authentication information.",
          "Profile photographs, where voluntarily provided.",
          "Identity verification information, where legally or operationally necessary.",
        ],
      },
      { h3: "3.2 Booking and Travel Information" },
      {
        ul: [
          "Selected destination and accommodation.",
          "Arrival and departure dates.",
          "Number of guests and room preferences.",
          "Booking reference numbers and transaction history.",
          "Guest information required for accommodation registration.",
          "Special service requests voluntarily submitted by users.",
          "Cancellation, refund, and customer-support records.",
        ],
      },
      {
        p: "Government identification details may be collected where required by applicable law or accommodation verification procedures. We seek to limit such collection to what is necessary.",
      },
      { h3: "3.3 Stay Owners and Institutional Information" },
      {
        p: "For accommodation providers, ashrams, temples, and other institutional partners, we may collect:",
      },
      {
        ul: [
          "Owner, manager, trustee, or authorized representative details.",
          "Institution or business name and address.",
          "Contact information.",
          "Registration and verification documents.",
          "Property photographs and descriptions.",
          "Room inventory, pricing, and availability.",
          "Bank and settlement details, where applicable.",
          "Authorized staff and operational user information.",
        ],
      },
      { h3: "3.4 Payment and Transaction Information" },
      {
        p: "When users make payments through Tirvona, transaction-related information may be processed, including:",
      },
      {
        ul: [
          "Booking or service amount.",
          "Platform fees and applicable taxes.",
          "Payment status and transaction reference.",
          "Refund and settlement information.",
          "Payment method category.",
        ],
      },
      {
        p: "Payments may be processed through authorized third-party payment service providers.",
      },
      {
        p: "Tirvona does not need to store complete payment card numbers, CVV values, or UPI PINs to provide its booking services.",
      },
      { h3: "3.5 Device, Usage, and Technical Information" },
      { p: "We may collect technical information such as:" },
      {
        ul: [
          "IP address.",
          "Browser and device type.",
          "Operating system and application version.",
          "Device identifiers, where permitted.",
          "Pages viewed and features accessed.",
          "Login activity and session information.",
          "Error logs, diagnostic data, and performance information.",
          "Cookies and similar technologies.",
        ],
      },
      { h3: "3.6 Location Information" },
      {
        p: "With appropriate permissions, Tirvona may process location information to support:",
      },
      {
        ul: [
          "Nearby religious destinations and services.",
          "Accommodation and local-service discovery.",
          "Route and mobility assistance.",
          "Parking and transportation information.",
          "Location-based search results.",
        ],
      },
      {
        p: "Users may manage device-level location permissions through their device settings. Certain location-based features may not function fully when permissions are disabled.",
      },
      { h3: "3.7 Communication Information" },
      { p: "We may retain communications relating to:" },
      {
        ul: [
          "Booking enquiries.",
          "Customer support.",
          "WhatsApp conversations.",
          "Feedback and complaints.",
          "Institutional onboarding.",
          "Service notifications.",
          "Promotional communication preferences.",
        ],
      },
      { h3: "3.8 Spiritual and Religious Service Information" },
      {
        p: "Certain Tirvona services may involve voluntarily submitted information relating to religious programs, puja arrangements, spiritual experiences, or other personal preferences.",
      },
      {
        p: "Such information will be used for the relevant requested service and handled with appropriate confidentiality.",
      },
      {
        p: "We will not use information revealing religious beliefs for unrelated advertising or profiling without an appropriate lawful basis.",
      },
    ],
  },
  {
    title: "4. How We Use Personal Information",
    blocks: [
      { p: "Tirvona processes personal information for the following purposes:" },
      {
        ul: [
          "Account Management: To register users, authenticate accounts, manage profiles, and provide access to authorized services.",
          "Accommodation and Service Bookings: To facilitate reservations, communicate booking details, coordinate with service providers, and manage booking-related requests.",
          "Institutional Onboarding: To register, verify, and support accommodation providers, religious institutions, and local service partners.",
          "Payment Processing: To facilitate transactions, generate receipts, process eligible refunds, maintain financial records, and support settlements.",
          "Customer Support: To respond to enquiries, investigate complaints, resolve service issues, and provide assistance.",
          "Service Communication: To deliver booking confirmations, reminders, operational alerts, service updates, and other necessary notifications.",
          "Platform Improvement: To evaluate service performance, resolve technical issues, improve navigation, and enhance the user experience.",
          "Security and Fraud Prevention: To protect accounts, identify suspicious activity, prevent misuse, and maintain platform integrity.",
          "Marketing and Promotions: To send promotional information where permitted by law and applicable user preferences or consent.",
          "Legal Compliance: To comply with applicable statutory obligations, lawful requests, and regulatory requirements.",
        ],
      },
    ],
  },
  {
    title: "5. Consent and Lawful Processing",
    blocks: [
      {
        p: "Where required by applicable law, Tirvona will obtain clear and informed consent before processing personal data for specified purposes.",
      },
      { p: "We aim to explain what information is requested and why it is needed." },
      {
        p: "Users may withdraw consent through available account settings or by contacting Tirvona, subject to applicable legal requirements.",
      },
      {
        p: "Withdrawal of consent will not automatically invalidate processing lawfully completed before withdrawal.",
      },
      {
        p: "Certain services may become unavailable if the information necessary to provide them can no longer be processed.",
      },
    ],
  },
  {
    title: "6. Sharing of Information",
    blocks: [
      {
        p: "Tirvona may share relevant personal information with the following categories of recipients when necessary:",
      },
      { h3: "6.1 Accommodation and Institutional Partners" },
      {
        p: "Information required to manage reservations, guest arrivals, services, and operational requests may be shared with the selected accommodation provider or institution.",
      },
      { h3: "6.2 Local Service Providers" },
      {
        p: "Where a user requests transportation, mobility, experiences, or another local service, relevant information may be shared with the provider responsible for fulfilling that request.",
      },
      { h3: "6.3 Payment Service Providers" },
      {
        p: "Payment-related information may be processed by authorized payment gateways, banking partners, and financial service providers.",
      },
      { h3: "6.4 Technology and Communication Providers" },
      {
        p: "We may engage hosting providers, cloud infrastructure services, analytics providers, SMS gateways, email delivery providers, WhatsApp business communication services, and technical support vendors.",
      },
      { h3: "6.5 Legal and Regulatory Authorities" },
      {
        p: "We may disclose information when required under applicable law, valid legal process, or lawful governmental direction.",
      },
      { h3: "6.6 Corporate Transactions" },
      {
        p: "Where permitted by law, relevant information may be transferred as part of a merger, acquisition, restructuring, or transfer of business, subject to applicable safeguards.",
      },
      {
        p: "Tirvona does not sell users' personal information to third parties for independent commercial marketing.",
        strong: true,
      },
      {
        p: "Service partners receiving personal information are expected to use it only for legitimate, authorized purposes and to maintain appropriate safeguards.",
      },
    ],
  },
  {
    title: "7. Cookies and Analytics",
    blocks: [
      { p: "Tirvona may use cookies and similar technologies to:" },
      {
        ul: [
          "Maintain login sessions.",
          "Remember user preferences.",
          "Support website functionality.",
          "Understand platform usage.",
          "Measure performance and troubleshoot errors.",
          "Support marketing measurement where permitted.",
        ],
      },
      {
        p: "Users may manage cookies through browser settings and any consent controls made available by Tirvona.",
      },
      { p: "Disabling essential cookies may affect certain website functions." },
    ],
  },
  {
    title: "8. Data Security",
    blocks: [
      {
        p: "Tirvona is committed to implementing reasonable technical and organizational safeguards appropriate to the nature of the information processed.",
      },
      { p: "These may include:" },
      {
        ul: [
          "Secure communication protocols.",
          "Access controls and role-based permissions.",
          "Authentication and account security mechanisms.",
          "Encryption where appropriate.",
          "Monitoring and security logging.",
          "Restricted administrative access.",
          "Backup and recovery procedures.",
          "Security reviews and vulnerability remediation.",
        ],
      },
      {
        p: "Although we work to protect personal information, no internet-based system can guarantee absolute security.",
      },
      {
        p: "Users are responsible for keeping their account credentials confidential and reporting suspected unauthorized account activity.",
      },
    ],
  },
  {
    title: "9. Data Retention",
    blocks: [
      {
        p: "Tirvona retains personal information only for as long as reasonably necessary for the purposes for which it was collected, subject to applicable legal, accounting, security, and regulatory requirements.",
      },
      {
        p: "Retention periods may vary depending on the information category, including:",
      },
      {
        ul: [
          "Account and profile information.",
          "Booking and transaction records.",
          "Tax and financial documentation.",
          "Customer support records.",
          "Institutional verification records.",
          "Technical and security logs.",
        ],
      },
      {
        p: "When information is no longer required, Tirvona will delete, anonymize, or securely archive it as appropriate and legally permissible.",
      },
      {
        p: "Account deletion does not necessarily require immediate deletion of records that must be retained under applicable law.",
      },
    ],
  },
  {
    title: "10. User Rights and Choices",
    blocks: [
      { p: "Subject to applicable law, users may have rights to:" },
      {
        ol: [
          "Request information about the processing of their personal data.",
          "Request correction or updating of inaccurate or incomplete information.",
          "Request erasure of personal data where applicable.",
          "Withdraw consent for consent-based processing.",
          "Raise complaints or grievances regarding personal data.",
          "Nominate another individual to exercise applicable rights in circumstances recognized by law.",
        ],
      },
      {
        p: "Requests may be submitted through the privacy contact details published by Tirvona.",
      },
      {
        p: "We may require reasonable verification of identity before processing a request.",
      },
    ],
  },
  {
    title: "11. Account Deletion",
    blocks: [
      {
        p: "Users may request deletion of their Tirvona account through an available in-app account deletion function or through the designated support or privacy contact channel.",
      },
      {
        p: "Following a valid deletion request, Tirvona will process account deletion and associated personal information in accordance with applicable law and legitimate retention obligations.",
      },
      {
        p: "Certain booking, payment, compliance, or dispute-related records may need to be retained for legally required periods.",
      },
    ],
  },
  {
    title: "12. Children's Privacy",
    blocks: [
      {
        p: "Tirvona's general account services are intended for individuals legally capable of using the relevant services.",
      },
      {
        p: "Where children's personal information is necessary for a booking, family travel arrangement, or other permitted service, it should be provided by a parent or lawful guardian as appropriate.",
      },
      {
        p: "Where required by applicable law, Tirvona will obtain verifiable parental consent before processing a child's personal data.",
      },
      {
        p: "Tirvona does not intend to engage in targeted advertising directed at children or tracking or behavioural monitoring of children in violation of applicable law.",
      },
    ],
  },
  {
    title: "13. Third-Party Websites and Services",
    blocks: [
      {
        p: "Tirvona may contain links to external websites, payment gateways, maps, accommodation providers, and other third-party services.",
      },
      { p: "Such services may operate under their own privacy policies and terms." },
      {
        p: "Tirvona encourages users to review the relevant third-party policies before sharing personal information.",
      },
      {
        p: "This Privacy Policy does not govern independently operated third-party services.",
      },
    ],
  },
  {
    title: "14. WhatsApp, SMS, Email, and Notifications",
    blocks: [
      {
        p: "Tirvona may communicate with users through WhatsApp, SMS, email, telephone, and mobile application notifications for legitimate service purposes.",
      },
      { p: "Communications may include:" },
      {
        ul: [
          "Registration and verification messages.",
          "Booking confirmations.",
          "Payment and transaction updates.",
          "Arrival and departure reminders.",
          "Service-related support.",
          "Institutional onboarding information.",
          "Promotional offers where permitted.",
        ],
      },
      {
        p: "Users may opt out of non-essential promotional communications through available unsubscribe mechanisms or by contacting Tirvona.",
      },
      {
        p: "Operational communications necessary to complete an active booking or service may continue where legally permitted.",
      },
    ],
  },
  {
    title: "15. International Data Processing",
    blocks: [
      {
        p: "Some technology vendors and service providers may process information using infrastructure located outside India.",
      },
      {
        p: "Where cross-border processing or transfer occurs, Tirvona will seek to ensure that it is conducted in accordance with applicable Indian laws, restrictions, and appropriate contractual or technical safeguards.",
      },
    ],
  },
  {
    title: "16. Data Accuracy and User Responsibilities",
    blocks: [
      { p: "Users are requested to provide accurate and updated information." },
      {
        p: "Accommodation providers and institutional partners are responsible for ensuring that information submitted through their accounts is accurate and that they have appropriate authority to provide personal information relating to their staff, representatives, or guests.",
      },
      {
        p: "Users should not submit unnecessary sensitive documents or third-party personal information unless required for a legitimate service.",
      },
    ],
  },
  {
    title: "17. Privacy Incident Management",
    blocks: [
      {
        p: "If Tirvona becomes aware of a personal data breach, it will assess the incident, take appropriate containment and remediation measures, and provide notifications to affected individuals and relevant authorities where required by applicable law.",
      },
    ],
  },
  {
    title: "18. Changes to This Privacy Policy",
    blocks: [
      {
        p: "Tirvona may update this Privacy Policy to reflect changes in services, technology, business operations, or applicable legal requirements.",
      },
      {
        p: "The latest version will be published on the Tirvona website with an updated effective or revision date.",
      },
      {
        p: "Where required by law, material changes will be communicated through appropriate channels or accompanied by a request for fresh consent.",
      },
    ],
  },
  {
    title: "19. Governing Law",
    blocks: [
      {
        p: "This Privacy Policy is governed by the applicable laws of India, including relevant provisions of the Information Technology Act, 2000, the Digital Personal Data Protection Act, 2023, and associated rules, to the extent in force and applicable.",
      },
      {
        p: "Nothing in this Privacy Policy limits rights or remedies available to individuals under mandatory applicable law.",
      },
    ],
  },
];

const PolicyBlocks: React.FC<{ blocks: PolicyBlock[] }> = ({ blocks }) => (
  <>
    {blocks.map((b, i) => {
      if ("h3" in b)
        return (
          <h3
            key={i}
            className="font-extrabold text-[#0B192C] dark:text-white text-sm pt-2"
          >
            {b.h3}
          </h3>
        );
      if ("ul" in b)
        return (
          <ul key={i} className="list-disc pl-5 space-y-1.5">
            {b.ul.map((li, j) => (
              <li key={j}>{li}</li>
            ))}
          </ul>
        );
      if ("ol" in b)
        return (
          <ol key={i} className="list-decimal pl-5 space-y-1.5">
            {b.ol.map((li, j) => (
              <li key={j}>{li}</li>
            ))}
          </ol>
        );
      return b.strong ? (
        <p key={i} className="font-bold text-[#0B192C] dark:text-white">
          {b.p}
        </p>
      ) : (
        <p key={i}>{b.p}</p>
      );
    })}
  </>
);

export const PrivacyPage: React.FC = () => (
  <div className="pb-20">
    <section className="bg-[#0B192C] text-white py-14 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="inline-block text-[10px] font-extrabold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
          Legal
        </span>
        <h1
          className="font-extrabold text-white"
          style={{ fontSize: "clamp(1.8rem, 6vw, 2.8rem)" }}
        >
          Privacy Policy
        </h1>
        <p className="text-sm text-[#D4AF37] font-bold">
          Connecting Sacred Destinations. Empowering Communities.
        </p>
        <p className="text-sm text-gray-400">
          Effective Date: 08 October 2026 · Last Updated: 08 October 2026
        </p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        Website:{" "}
        <a
          href="https://www.tirvona.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#F28C28] font-bold"
        >
          https://www.tirvona.com
        </a>
        <br />
        Operated by: Tirvona Services Private Limited ("Tirvona", "we", "us", or
        "our")
      </p>
      {PRIVACY_SECTIONS.map((s) => (
        <StaticSection key={s.title} title={s.title}>
          <PolicyBlocks blocks={s.blocks} />
        </StaticSection>
      ))}
      <StaticSection title="20. Contact Information and Grievance Redressal">
        <p>
          For questions, privacy requests, data correction, account deletion, or
          grievances, please contact:
        </p>
        <p className="font-bold text-[#0B192C] dark:text-white">
          Tirvona Services Private Limited
        </p>
        <ul className="space-y-1.5">
          <li>
            <strong className="text-[#0B192C] dark:text-white">Website:</strong>{" "}
            <a
              href="https://www.tirvona.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#F28C28] font-bold"
            >
              https://www.tirvona.com
            </a>
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">Phone:</strong>{" "}
            <a href="tel:+917836055511" className="text-[#F28C28] font-bold">
              +91 7836055511
            </a>
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Privacy/Grievance Email:
            </strong>{" "}
            <a
              href="mailto:tirvonaofficial@gmail.com"
              className="text-[#F28C28] font-bold"
            >
              tirvonaofficial@gmail.com
            </a>
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Registered Office:
            </strong>{" "}
            307 B, 3rd Floor, iThum Tower-A, Sector 62, Noida, Uttar Pradesh,
            201301
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Grievance Officer/Contact Person:
            </strong>{" "}
            Khushi
          </li>
        </ul>
        <p>
          We will acknowledge and address privacy-related requests and
          grievances in accordance with applicable legal requirements.
        </p>
        <p>
          Where applicable, individuals may also exercise their statutory right
          to approach the competent data protection authority after following
          the required grievance process.
        </p>
      </StaticSection>
      <div className="text-center pt-4 space-y-1">
        <p className="font-extrabold text-[#0B192C] dark:text-white text-sm">
          TIRVONA™
        </p>
        <p className="text-xs text-gray-500 italic">
          Building trusted digital infrastructure for India's religious
          destinations, institutions, pilgrims, and communities.
        </p>
        <p className="text-xs text-gray-500">
          © 2026 Tirvona Services Private Limited. All rights reserved.
        </p>
      </div>
    </div>
  </div>
);

export const RefundPolicyPage: React.FC = () => (
  <div className="pb-20">
    <section className="bg-[#0B192C] text-white py-14 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="inline-block text-[10px] font-extrabold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
          Legal
        </span>
        <h1
          className="font-extrabold text-white"
          style={{ fontSize: "clamp(1.8rem, 6vw, 2.8rem)" }}
        >
          Refund Policy
        </h1>
        <p className="text-sm text-gray-400">Last updated: 1st January 2025</p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <StaticSection title="1. Eligible Refunds">
        <p>You are eligible for a refund in the following situations:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            Cancellation within the cancellation policy window (see Cancellation
            Policy)
          </li>
          <li>Stay cancels your confirmed booking</li>
          <li>Stay fails to provide booked accommodation upon arrival</li>
          <li>Technical error resulting in double payment</li>
          <li>
            Force majeure (natural disaster, road closure, government-ordered
            shutdown)
          </li>
        </ul>
      </StaticSection>
      <StaticSection title="2. Refund Timeline">
        <p>Once your refund request is approved:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              UPI / Wallets:
            </strong>{" "}
            1–2 business days
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Credit / Debit Card:
            </strong>{" "}
            5–7 business days
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Net Banking:
            </strong>{" "}
            3–5 business days
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Tirvona Wallet Credit:
            </strong>{" "}
            Instant
          </li>
        </ul>
      </StaticSection>
      <StaticSection title="3. Non-Refundable Situations">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Cancellation within 24 hours of check-in</li>
          <li>No-show without prior notification</li>
          <li>Early check-out (partially used stay)</li>
          <li>Violations of stay conduct rules resulting in eviction</li>
          <li>
            Bookings explicitly marked "Non-Refundable" at time of purchase
          </li>
        </ul>
      </StaticSection>
      <StaticSection title="4. How to Request a Refund">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Login to your Tirvona account</li>
          <li>
            Go to Dashboard → My Bookings → Select booking → Cancel / Request
            Refund
          </li>
          <li>
            For disputes, email{" "}
            <a
              href="mailto:refunds@tirvona.in"
              className="text-[#F28C28] font-bold"
            >
              refunds@tirvona.in
            </a>{" "}
            with your booking ID
          </li>
        </ol>
      </StaticSection>
      <StaticSection title="5. Dispute Resolution">
        <p>
          If you are unsatisfied with our refund decision, you may escalate to
          our Grievance Officer at grievance@tirvona.in. Under the Consumer
          Protection Act 2019, you also have the right to approach Consumer
          Disputes Redressal Commissions.
        </p>
      </StaticSection>
    </div>
  </div>
);

export const CookiePolicyPage: React.FC = () => (
  <div className="pb-20">
    <section className="bg-[#0B192C] text-white py-14 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="inline-block text-[10px] font-extrabold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
          Legal
        </span>
        <h1
          className="font-extrabold text-white"
          style={{ fontSize: "clamp(1.8rem, 6vw, 2.8rem)" }}
        >
          Cookie Policy
        </h1>
        <p className="text-sm text-gray-400">Last updated: 1st January 2025</p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <StaticSection title="What Are Cookies?">
        <p>
          Cookies are small text files stored in your browser when you visit a
          website. They help us remember your preferences, keep you logged in,
          and understand how you use our platform.
        </p>
      </StaticSection>
      <StaticSection title="Cookies We Use">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs border-collapse min-w-[400px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-900">
                <th className="text-left px-3 py-2.5 font-extrabold text-[#0B192C] dark:text-white border border-gray-100 dark:border-slate-700">
                  Cookie Name
                </th>
                <th className="text-left px-3 py-2.5 font-extrabold text-[#0B192C] dark:text-white border border-gray-100 dark:border-slate-700">
                  Purpose
                </th>
                <th className="text-left px-3 py-2.5 font-extrabold text-[#0B192C] dark:text-white border border-gray-100 dark:border-slate-700">
                  Duration
                </th>
                <th className="text-left px-3 py-2.5 font-extrabold text-[#0B192C] dark:text-white border border-gray-100 dark:border-slate-700">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  name: "ab_token",
                  purpose: "Authentication session token",
                  dur: "Session",
                  type: "Essential",
                },
                {
                  name: "_ga",
                  purpose: "Google Analytics visitor tracking",
                  dur: "2 years",
                  type: "Analytics",
                },
                {
                  name: "_gid",
                  purpose: "Google Analytics session data",
                  dur: "24 hours",
                  type: "Analytics",
                },
                {
                  name: "tirvona_prefs",
                  purpose: "Language & currency preferences",
                  dur: "1 year",
                  type: "Functional",
                },
                {
                  name: "dark_mode",
                  purpose: "Dark/light mode preference",
                  dur: "1 year",
                  type: "Functional",
                },
              ].map((c, i) => (
                <tr
                  key={i}
                  className="border border-gray-100 dark:border-slate-700"
                >
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[#F28C28]">
                    {c.name}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                    {c.purpose}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                    {c.dur}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${c.type === "Essential" ? "bg-[#0E7B6C]/10 text-[#0E7B6C]" : c.type === "Analytics" ? "bg-[#F28C28]/10 text-[#F28C28]" : "bg-[#D4AF37]/10 text-[#D4AF37]"}`}
                    >
                      {c.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StaticSection>
      <StaticSection title="Managing Cookies">
        <p>
          You can control cookies through your browser settings. Most browsers
          allow you to refuse cookies or delete existing ones. Note that
          disabling essential cookies will affect platform functionality.
        </p>
        <p>
          To opt out of Google Analytics specifically, use the{" "}
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F28C28] font-bold"
          >
            Google Analytics Opt-out Browser Add-on
          </a>
          .
        </p>
      </StaticSection>
      <StaticSection title="Changes to This Policy">
        <p>
          We may update this Cookie Policy periodically. Material changes will
          be communicated via email or an in-app notification. Continued use of
          the platform constitutes acceptance of the updated policy.
        </p>
      </StaticSection>
      <StaticSection title="Contact">
        <p>For cookie-related queries: privacy@tirvona.in</p>
      </StaticSection>
    </div>
  </div>
);
