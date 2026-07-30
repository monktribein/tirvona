import React from 'react';
import { Sparkles, ShieldCheck, Clock } from 'lucide-react';

const AboutPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col justify-between pb-16 bg-slate-50 dark:bg-[#0B192C]/50 transition-colors duration-300">
      {/* Hero Section */}
      <section className="bg-[#0B192C] text-white py-16 sm:py-20 px-4 sm:px-6 relative overflow-hidden border-b border-slate-800">
        {/* Ambient Gradients */}
        <div className="absolute top-0 right-1/4 w-[350px] h-[350px] bg-[#0A4DA6]/15 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-[250px] h-[250px] bg-[#D4AF37]/10 rounded-full blur-[70px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
            <Sparkles size={12} className="text-[#D4AF37]" />
            Official Announcement
          </span>
          <h1 className="font-extrabold leading-tight text-white tracking-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)' }}>
            About <span className="text-[#D4AF37]">Tirvona</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl mx-auto font-medium">
            "We're preparing something meaningful. Our official company information will be available soon."
          </p>
        </div>
      </section>

      {/* Main Placeholder Section (Future Ready Container) */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">
        {/* Coming Soon Card */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-200/90 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden">
          {/* Subtle Top Decorative Gradient Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0A4DA6] via-[#D4AF37] to-[#E58C28]" />

          <div className="w-16 h-16 rounded-2xl bg-[#0A4DA6]/10 dark:bg-white/5 border border-[#0A4DA6]/20 dark:border-white/10 flex items-center justify-center text-[#0A4DA6] dark:text-[#D4AF37] mx-auto mb-6 shadow-xs">
            <Clock size={28} />
          </div>

          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#0A4DA6] dark:text-[#D4AF37] bg-[#0A4DA6]/5 dark:bg-[#D4AF37]/10 px-3 py-1 rounded-full mb-3">
            Company Profile In Progress
          </span>

          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0B192C] dark:text-white mb-3">
            Official Details Coming Soon
          </h2>

          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg mx-auto font-normal mb-8">
            We are curating our official background, mission statement, leadership team, and verified platform metrics. Check back soon for full details about Tirvona's sacred travel initiative.
          </p>

          <div className="pt-6 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <ShieldCheck size={16} className="text-[#0A4DA6] dark:text-[#D4AF37]" />
            <span>Tirvona Sacred Destinations &bull; Enterprise Platform</span>
          </div>
        </div>

        {/* Future Ready Slots for Company Story, Mission, Team, and Timeline */}
        {/*
          <div id="company-story-section" className="mt-12" />
          <div id="mission-vision-section" className="mt-12" />
          <div id="team-leadership-section" className="mt-12" />
          <div id="milestones-timeline-section" className="mt-12" />
        */}
      </section>
    </div>
  );
};

export default AboutPage;


