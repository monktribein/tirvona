import React from 'react';
import { HelpCircle, ShieldCheck, CreditCard, UserCheck, Calendar } from 'lucide-react';

export const FaqPage: React.FC = () => {
  const faqs = [
    {
      category: 'General',
      icon: <HelpCircle className="text-primary" size={20} />,
      q: 'What is the Tirthiva Portal?',
      a: 'Tirthiva is an official, centralized digital platform initiated by the Government of India. It aims to register, inspect, verify, and digitize all approved Ashrams, Dharamshalas, spiritual retreats, and religious accommodations across the country, making booking safe, accessible, and transparent for pilgrims.',
    },
    {
      category: 'For Pilgrims',
      icon: <Calendar className="text-primary" size={20} />,
      q: 'How do I check into an Ashram after booking online?',
      a: 'Once your payment is successful, you will receive a Booking Confirmation SMS and Email containing a unique 6-digit Check-in Code. Simply present this code at the Ashram reception counter upon arrival along with a government-approved Photo ID (Aadhaar/Voter ID) to complete your check-in.',
    },
    {
      category: 'For Owners',
      icon: <UserCheck className="text-primary" size={20} />,
      q: 'How long does the Ashram registration and approval process take?',
      a: 'After an Ashram owner uploads their Trust Deeds, Land Ownership papers, and Fire Safety Certificates, the system triggers a task in the District Officer queue. Physical/video inspections are scheduled within 5-7 working days. Once verified, the listing is instantly activated.',
    },
    {
      category: 'Payments & Refunds',
      icon: <CreditCard className="text-primary" size={20} />,
      q: 'What is the cancellation and refund policy?',
      a: 'Cancellations made more than 48 hours prior to check-in are eligible for a 100% refund. Refunds are credited back to the original payment source (UPI/Card) within 3-5 working days. Cancellations within 48 hours are subject to a 1-night base charge fee.',
    },
    {
      category: 'Security & Quality',
      icon: <ShieldCheck className="text-primary" size={20} />,
      q: 'What makes an Ashram "Government Verified"?',
      a: 'Ashrams showing the "Government Verified" badge have undergone manual document screening (Trust deeds, legal title search) and physical site inspections by District Officers to ensure cleanliness, basic amenities (potable water, safe bedding, separate washrooms), and proper safety protocols.',
    },
  ];

  return (
    <div className="py-12 px-6 max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/25">
          Support Desk
        </span>
        <h2 className="text-3xl font-extrabold tracking-tight text-secondary dark:text-white">
          Frequently Asked Questions
        </h2>
        <p className="text-sm text-gray-500 max-w-xl mx-auto">
          Need clarification on bookings, registrations, or inspection guidelines? Browse answers to common questions below.
        </p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i} className="p-6 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 space-y-3">
            <div className="flex items-center gap-2">
              {faq.icon}
              <span className="text-[10px] uppercase font-bold text-accent tracking-wider">{faq.category}</span>
            </div>
            <h3 className="text-base font-bold text-secondary dark:text-white">{faq.q}</h3>
            <p className="text-xs text-gray-500 leading-relaxed pl-1 border-l-2 border-primary/40">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default FaqPage;
