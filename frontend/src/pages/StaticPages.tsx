import React from "react";
import { formatCurrency } from "../utils/format";

// Shared component for static legal/info pages
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
      {/* Summary table */}
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
              color: "text-[#0A4DA6]",
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
          to both pilgrims and ashram owners. The refund amount depends on how
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
          Some ashrams apply stricter non-refundable policies during peak
          pilgrim seasons (Navratri, Kumbh, Char Dham season). This is clearly
          marked on the ashram listing.
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
          If an ashram cancels your confirmed booking for any reason, you are
          entitled to a full 100% refund regardless of when the cancellation
          occurs. We will also help you find alternative accommodation at no
          extra charge.
        </p>
      </StaticSection>

      <div className="bg-[#0A4DA6]/5 border border-[#0A4DA6]/10 rounded-2xl p-5 text-sm text-gray-600 dark:text-gray-300">
        For disputes or questions about a refund, contact{" "}
        <a
          href="mailto:support@tirvona.in"
          className="text-[#0A4DA6] font-bold"
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
        <p>All registered ashrams must comply with:</p>
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
          all ashrams are required to maintain a record of guests. Foreign
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
          peak pilgrimage seasons. Ashrams are notified of applicable caps and
          are contractually obligated to honour them.
        </p>
        <p>
          Price gouging during religious festivals is strictly prohibited and
          can result in immediate delisting.
        </p>
      </StaticSection>

      <StaticSection title="5. Accessibility (Divyang-Friendly)">
        <p>
          Under the RPwD Act 2016, ashrams with more than 20 rooms are
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
          Step-by-step guide to listing your ashram on Tirvona
        </p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
      {[
        {
          step: "01",
          title: "Create an Owner Account",
          desc: 'Register at tirvona.in/register. Select "I\'m an Ashram Owner" during sign-up. Verify your mobile number and email address.',
        },
        {
          step: "02",
          title: "Submit KYC Documents",
          desc: "Upload: Trust Registration Certificate, PAN Card of Trust/Individual, Land Ownership Document or Lease Deed, Recent utility bill (proof of address), Aadhaar of authorised representative.",
        },
        {
          step: "03",
          title: "Complete the 20-Step Wizard",
          desc: "Our field executive will visit your ashram and use the Tirvona Owner Wizard to fill in all details — basic info, address, GPS, photos, room types, pricing, facilities, food services, nearby attractions, and more.",
        },
        {
          step: "04",
          title: "Field Verification Visit",
          desc: "A Tirvona-trained field executive will physically visit your ashram within 5–7 business days of KYC submission. They will verify facilities, photograph the premises, and conduct a safety audit.",
        },
        {
          step: "05",
          title: "Government Review",
          desc: "For ashrams near major pilgrimage circuits (Char Dham, Kashi, Tirupati), the district tourism officer may co-verify the listing. This typically takes 3–5 additional days.",
        },
        {
          step: "06",
          title: "Go Live",
          desc: 'Once verified, your ashram receives the blue "Verified" badge and becomes discoverable by millions of pilgrims. You\'ll receive login credentials for the Owner Dashboard to manage bookings, calendar, and pricing.',
        },
      ].map((s, i) => (
        <div
          key={i}
          className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 flex gap-5 shadow-sm"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#0A4DA6] text-white font-black text-sm flex items-center justify-center flex-shrink-0">
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

      <div className="bg-[#0A4DA6]/5 border border-[#0A4DA6]/10 rounded-2xl p-5 space-y-3">
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
            <div className="w-4 h-4 rounded border-2 border-[#0A4DA6] flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 rounded-sm bg-[#0A4DA6]" />
            </div>
            {d}
          </div>
        ))}
      </div>

      <div className="text-center">
        <a
          href="/partner"
          className="inline-flex items-center gap-2 min-h-[52px] px-8 py-3 bg-[#0A4DA6] text-white font-extrabold text-sm rounded-full shadow-lg"
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
          Standard guidelines applicable to all Tirvona ashram stays
        </p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <StaticSection title="General Conduct">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Guests are expected to respect the spiritual environment and daily
            routines of the ashram.
          </li>
          <li>
            Maintain silence in meditation halls, during prayer hours, and after
            10:00 PM.
          </li>
          <li>Dress modestly — traditional Indian attire is recommended.</li>
          <li>
            Non-vegetarian food, alcohol, and tobacco are strictly prohibited
            inside all Tirvona-listed ashrams.
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
          All Tirvona ashrams serve only satvik, pure vegetarian food. Meals are
          typically included in accommodation packages or available for a
          nominal charge. Timings for meals are fixed by each ashram and are
          displayed on their listing page.
        </p>
        <p>
          Outside food is generally not permitted inside dining halls. Please
          check the specific ashram's policy.
        </p>
      </StaticSection>

      <StaticSection title="Security Deposit">
        <p>
          Some ashrams may collect a refundable security deposit at check-in
          (typically {formatCurrency(500)}–{formatCurrency(2000)} depending on
          room category). This is returned
          in full at check-out if no damage is found.
        </p>
      </StaticSection>

      <StaticSection title="Children & Families">
        <p>
          Children below 5 years of age are generally accommodated free of
          charge when sharing with parents. Children aged 5–12 may be charged at
          50% of the adult rate. Individual ashram policies may vary.
        </p>
      </StaticSection>

      <StaticSection title="Pets">
        <p>
          Pets are not permitted in any Tirvona-listed accommodation in keeping
          with the sacred environment of ashrams and dharamshalas.
        </p>
      </StaticSection>

      <StaticSection title="Damage & Liability">
        <p>
          Guests are responsible for any damage caused to ashram property during
          their stay. Tirvona mediates disputes between guests and ashrams but
          cannot be held liable for damages, theft, or personal injury during an
          ashram stay.
        </p>
      </StaticSection>

      <div className="bg-[#0A4DA6]/5 border border-[#0A4DA6]/10 rounded-2xl p-5 text-sm text-gray-600 dark:text-gray-300">
        For questions or concerns about your stay, contact{" "}
        <a
          href="mailto:support@tirvona.in"
          className="text-[#0A4DA6] font-bold"
        >
          support@tirvona.in
        </a>{" "}
        or visit our{" "}
        <a href="/help" className="text-[#0A4DA6] font-bold">
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
          is charged at the applicable slab based on per-night room tariff.
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
        <p className="text-sm text-gray-400">
          Last updated: 1st January 2025 · Compliant with DPDP Act 2023
        </p>
      </div>
    </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <StaticSection title="1. What Data We Collect">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Identity Data:
            </strong>{" "}
            Name, Aadhaar number (hashed), date of birth, gender
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Contact Data:
            </strong>{" "}
            Email address, phone number, postal address
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Booking Data:
            </strong>{" "}
            Dates, ashram selected, room type, payment amount
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Device Data:
            </strong>{" "}
            IP address, browser type, device model (for fraud prevention)
          </li>
          <li>
            <strong className="text-[#0B192C] dark:text-white">
              Location Data:
            </strong>{" "}
            Only when you explicitly use "Near Me" search feature
          </li>
        </ul>
      </StaticSection>
      <StaticSection title="2. How We Use Your Data">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>To process and confirm your bookings</li>
          <li>
            To send booking confirmations, check-in reminders, and receipts
          </li>
          <li>To improve our platform through anonymised analytics</li>
          <li>
            To comply with legal obligations (e.g., police guest register
            requirements)
          </li>
          <li>
            To send newsletters and offers — only with your explicit consent
          </li>
        </ul>
      </StaticSection>
      <StaticSection title="3. Data Sharing">
        <p>We never sell your personal data. We share data only with:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            The specific ashram for your confirmed booking (name, arrival date,
            guest count only)
          </li>
          <li>Payment processors (RazorPay) for transaction processing</li>
          <li>Government authorities when legally required</li>
          <li>
            Cloud service providers under strict data processing agreements
          </li>
        </ul>
      </StaticSection>
      <StaticSection title="4. Data Retention">
        <p>
          We retain personal data for 3 years from your last interaction with
          Tirvona, after which it is permanently deleted. Booking records are
          retained for 7 years for tax compliance purposes.
        </p>
      </StaticSection>
      <StaticSection title="5. Your Rights (DPDP Act 2023)">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Right to access your personal data</li>
          <li>Right to correct inaccurate data</li>
          <li>Right to erasure ("right to be forgotten")</li>
          <li>Right to withdraw consent at any time</li>
          <li>Right to nominate a representative for data access</li>
        </ul>
        <p>Exercise your rights at: privacy@tirvona.in</p>
      </StaticSection>
      <StaticSection title="6. Cookies">
        <p>
          We use essential cookies for session management and optional analytics
          cookies (Google Analytics). You can manage cookie preferences in your
          browser settings or our Cookie Policy page.
        </p>
      </StaticSection>
      <StaticSection title="7. Contact — Data Protection Officer">
        <p>
          DPO: Ms. Priya Nair | privacy@tirvona.in | NKTech Technology Pvt.
          Ltd., Sector 62, Noida, UP 201301
        </p>
      </StaticSection>
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
          <li>Ashram cancels your confirmed booking</li>
          <li>Ashram fails to provide booked accommodation upon arrival</li>
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
          <li>Violations of ashram conduct rules resulting in eviction</li>
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
              className="text-[#0A4DA6] font-bold"
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
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[#0A4DA6]">
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
                      className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${c.type === "Essential" ? "bg-[#0E7B6C]/10 text-[#0E7B6C]" : c.type === "Analytics" ? "bg-[#0A4DA6]/10 text-[#0A4DA6]" : "bg-[#D4AF37]/10 text-[#D4AF37]"}`}
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
            className="text-[#0A4DA6] font-bold"
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
