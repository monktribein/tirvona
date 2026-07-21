import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

const categories = [
  {
    title: 'Bookings & Reservations',
    items: [
      { q: 'How do I book an ashram stay on Tirvona?', a: 'Browse destinations or use the search bar on the home page. Select your dates, number of guests, and preferred room type. Click "Book Stay" on the ashram page and complete payment. You\'ll receive a confirmed booking via email and SMS instantly.' },
      { q: 'Can I book for a group or family?', a: 'Yes. Select the number of guests during search. For groups larger than 10, contact the ashram directly via their listed number or use the "Contact Ashram" button on their page. Some ashrams offer group discounts for 5+ guests.' },
      { q: 'Is my booking confirmed immediately?', a: 'Most bookings are instant-confirmed. A few ashrams operate on a request-basis — in that case, you\'ll hear back within 24 hours. Your booking status is always visible in your dashboard.' },
      { q: 'Can I modify my booking dates?', a: 'Yes, from your dashboard go to "My Bookings" → select the booking → "Modify Dates". Date changes are subject to availability and the ashram\'s modification policy. Changes made more than 48 hours before check-in are usually free.' },
    ],
  },
  {
    title: 'Payments & Refunds',
    items: [
      { q: 'What payment methods are accepted?', a: 'We accept all major UPI apps (GPay, PhonePe, Paytm), credit/debit cards (Visa, Mastercard, RuPay), net banking, and EMI options for bookings above ₹5,000.' },
      { q: 'Is it safe to pay on Tirvona?', a: 'Absolutely. All transactions are processed via RazorPay with 256-bit SSL encryption. We are PCI-DSS compliant and your card details are never stored on our servers.' },
      { q: 'When will I get my refund?', a: 'Approved refunds are credited within 5–7 business days to your original payment method. For UPI payments, refunds typically arrive in 1–2 business days.' },
    ],
  },
  {
    title: 'Ashram & Stay',
    items: [
      { q: 'How does Tirvona verify ashrams?', a: 'Every ashram goes through a 5-step physical verification: document check, on-site visit by our field executive, facility audit, safety inspection, and community reference check. Only verified ashrams receive the blue "Verified" badge.' },
      { q: 'What facilities can I expect?', a: 'Each ashram listing clearly mentions available facilities. Most include pure vegetarian meals (satvik food), meditation hall, hot water, basic bedding, and daily prayer schedules. Luxury amenities vary by ashram.' },
      { q: 'Is vegetarian food mandatory at all ashrams?', a: 'Most ashrams on Tirvona serve only pure vegetarian and satvik food in keeping with spiritual tradition. Some allow outside food. This is clearly mentioned on each ashram\'s page.' },
      { q: 'What are the general check-in and check-out times?', a: 'Standard check-in is 12:00 PM and check-out is 10:00 AM, though this varies by ashram. You can request early/late check-in through the booking form — availability is subject to ashram capacity.' },
    ],
  },
  {
    title: 'Account & Safety',
    items: [
      { q: 'Is my personal data safe with Tirvona?', a: 'Yes. We are compliant with India\'s Digital Personal Data Protection Act 2023. We never sell your data to third parties. See our Privacy Policy for complete details.' },
      { q: 'How do I delete my account?', a: 'Go to Dashboard → Settings → Account → "Delete Account". All personal data will be permanently removed within 30 days as per our data retention policy.' },
      { q: 'I forgot my password. How do I reset it?', a: 'Click "Forgot Password" on the login page. Enter your registered email and you\'ll receive a reset link valid for 30 minutes. If you don\'t receive it, check your spam folder or contact support.' },
    ],
  },
];

const HelpCenterPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [openItem, setOpenItem] = useState<string | null>(null);

  const filtered = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(
      item => !search || item.q.toLowerCase().includes(search.toLowerCase()) || item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="bg-[#0B192C] text-white py-14 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#0A4DA6]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative z-10 space-y-5">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">Help Center</span>
          <h1 className="font-extrabold text-white" style={{ fontSize: 'clamp(1.8rem, 6vw, 3rem)' }}>
            How can we <span className="text-[#D4AF37]">help you?</span>
          </h1>
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search for answers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-full pl-11 pr-5 py-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 text-white placeholder:text-gray-400"
            />
          </div>
        </div>
      </section>

      {/* FAQ accordion */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        {filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-2xl">🔍</p>
            <p className="font-extrabold text-[#0B192C] dark:text-white">No results found</p>
            <p className="text-sm text-gray-500">Try different keywords or <a href="mailto:support@tirvona.in" className="text-[#0A4DA6] font-bold">contact our support team</a>.</p>
          </div>
        ) : (
          filtered.map((cat, ci) => (
            <div key={ci} className="space-y-3">
              <h2 className="font-extrabold text-[#0B192C] dark:text-white text-base">{cat.title}</h2>
              <div className="space-y-2">
                {cat.items.map((item, ii) => {
                  const key = `${ci}-${ii}`;
                  return (
                    <div key={ii} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                      <button
                        onClick={() => setOpenItem(openItem === key ? null : key)}
                        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 cursor-pointer"
                      >
                        <span className="font-semibold text-sm text-[#0B192C] dark:text-white">{item.q}</span>
                        {openItem === key ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />}
                      </button>
                      {openItem === key && (
                        <div className="px-5 pb-5 pt-0 border-t border-gray-50 dark:border-slate-800">
                          <p className="text-xs text-gray-500 leading-relaxed pt-3">{item.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Still need help */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-14">
        <div className="bg-[#0A4DA6] text-white rounded-3xl p-8 text-center space-y-4">
          <h2 className="font-extrabold" style={{ fontSize: 'clamp(1.1rem, 4vw, 1.4rem)' }}>Still need help?</h2>
          <p className="text-sm text-blue-100">Our support team is available 24/7. We typically respond within 2 hours.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="mailto:support@tirvona.in" className="min-h-[44px] px-6 py-2.5 bg-white text-[#0A4DA6] font-extrabold text-sm rounded-full flex items-center justify-center">Email Support</a>
            <a href="tel:+917836055511" className="min-h-[44px] px-6 py-2.5 bg-white/20 border border-white/30 text-white font-extrabold text-sm rounded-full flex items-center justify-center">Call +91 78360 55511</a>
          </div>
        </div>
      </section>
    </div>
  );
};
export default HelpCenterPage;
