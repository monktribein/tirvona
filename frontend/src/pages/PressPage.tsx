import React from 'react';
import { ArrowRight, Download, Mail } from 'lucide-react';

const pressReleases = [
  { date: 'July 2025', title: 'Tirvona Surpasses 10 Million Pilgrim Registrations Across India', tag: 'Milestone' },
  { date: 'June 2025', title: 'Ministry of Tourism Recognises Tirvona as Digital India Champion 2025', tag: 'Award' },
  { date: 'May 2025', title: 'Tirvona AI Pilgrim Assistant Now Available in 12 Indian Languages', tag: 'Product' },
  { date: 'March 2025', title: 'Tirvona Raises Series A Funding to Expand Across South India and Northeast', tag: 'Funding' },
  { date: 'Jan 2025', title: 'Tirvona Signs MoU with Uttarakhand Tourism Development Board', tag: 'Partnership' },
  { date: 'Nov 2024', title: 'Tirvona Launches Emergency Medical Desk Feature for Ashram Guests', tag: 'Product' },
];

const coverage = [
  { outlet: 'The Hindu', logo: '🗞️', quote: '"Tirvona is redefining how India\'s millions of pilgrims find safe and verified accommodation."' },
  { outlet: 'Economic Times', logo: '📰', quote: '"A tech-first approach to India\'s ancient tradition of sacred travel — and it\'s working."' },
  { outlet: 'NDTV', logo: '📺', quote: '"With government backing and AI-powered guidance, Tirvona is the future of spiritual tourism."' },
];

const tagColors: Record<string, string> = {
  Milestone: 'bg-[#0A4DA6]/10 text-[#0A4DA6]',
  Award: 'bg-[#D4AF37]/10 text-[#D4AF37]',
  Product: 'bg-[#0E7B6C]/10 text-[#0E7B6C]',
  Funding: 'bg-[#6B21A8]/10 text-[#6B21A8]',
  Partnership: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400',
};

const PressPage: React.FC = () => (
  <div className="pb-20">
    {/* Hero */}
    <section className="bg-[#0B192C] text-white py-16 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#0A4DA6]/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
        <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">Newsroom</span>
        <h1 className="font-extrabold leading-tight text-white" style={{ fontSize: 'clamp(1.8rem, 6vw, 3rem)' }}>
          Press & <span className="text-[#D4AF37]">Media</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl mx-auto">
          Latest news, press releases and media resources from Tirvona.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="mailto:press@tirvona.in" className="inline-flex items-center gap-2 min-h-[48px] px-6 py-2.5 bg-[#D4AF37] text-[#0B192C] font-extrabold text-sm rounded-full">
            <Mail size={14} /> Contact Press Team
          </a>
          <a href="#" className="inline-flex items-center gap-2 min-h-[48px] px-6 py-2.5 bg-white/10 border border-white/20 text-white font-extrabold text-sm rounded-full">
            <Download size={14} /> Download Brand Kit
          </a>
        </div>
      </div>
    </section>

    {/* Media Coverage */}
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 space-y-8">
      <h2 className="font-extrabold text-[#0B192C] dark:text-white" style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>As Seen In</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {coverage.map((c, i) => (
          <div key={i} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{c.logo}</span>
              <span className="font-extrabold text-sm text-[#0B192C] dark:text-white">{c.outlet}</span>
            </div>
            <p className="text-xs text-gray-500 italic leading-relaxed">{c.quote}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Press Releases */}
    <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-14 space-y-6">
      <h2 className="font-extrabold text-[#0B192C] dark:text-white" style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>Press Releases</h2>
      <div className="space-y-3">
        {pressReleases.map((pr, i) => (
          <div key={i} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 flex items-start justify-between gap-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full ${tagColors[pr.tag]}`}>{pr.tag}</span>
                <span className="text-[10px] text-gray-400 font-semibold">{pr.date}</span>
              </div>
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-snug group-hover:text-[#0A4DA6] transition-colors">{pr.title}</h3>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-[#0A4DA6] transition-colors flex-shrink-0 mt-1" />
          </div>
        ))}
      </div>
    </section>

    {/* Press Contact */}
    <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-14">
      <div className="bg-[#0B192C] text-white rounded-3xl p-8 text-center space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#0A4DA6]/15 rounded-full blur-[60px] pointer-events-none" />
        <h2 className="font-extrabold relative z-10" style={{ fontSize: 'clamp(1.1rem, 4vw, 1.4rem)' }}>Media Enquiries</h2>
        <p className="text-sm text-gray-300 relative z-10">For press interviews, fact-checking, or brand assets, reach out to our communications team.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center relative z-10">
          <a href="mailto:press@tirvona.in" className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2 bg-[#D4AF37] text-[#0B192C] font-extrabold text-sm rounded-full">
            press@tirvona.in
          </a>
        </div>
      </div>
    </section>
  </div>
);
export default PressPage;
