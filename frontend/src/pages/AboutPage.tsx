import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Users, MapPin, Heart, Award, Sparkles, ArrowRight, CheckCircle } from 'lucide-react';

const AboutPage: React.FC = () => {
  const milestones = [
    { year: '2021', title: 'Idea Conceived', desc: 'Born out of frustration with unorganised, unsafe pilgrim accommodations across India.' },
    { year: '2022', title: 'Pilot Launch', desc: 'Launched in Rishikesh and Haridwar with 12 verified ashrams and 500 registered pilgrims.' },
    { year: '2023', title: 'Govt Partnership', desc: 'Partnered with Ministry of Tourism & IT Division, Government of India, for digital India initiative.' },
    { year: '2024', title: 'National Expansion', desc: 'Expanded to 18 states with 2,500+ sacred destinations and 10 million happy pilgrims.' },
    { year: '2025', title: 'AI Integration', desc: 'Launched AI Pilgrim Assistant and real-time community health & safety monitoring.' },
  ];

  const values = [
    { icon: <Shield className="w-6 h-6 text-[#0A4DA6]" />, title: 'Safety First', desc: 'Every ashram is physically verified by our trained field executives before going live.' },
    { icon: <Heart className="w-6 h-6 text-[#0A4DA6]" />, title: 'Community Driven', desc: 'A portion of every booking directly funds local temple restoration and community welfare.' },
    { icon: <Award className="w-6 h-6 text-[#0A4DA6]" />, title: 'Authenticity', desc: 'No fake listings. No paid promotions. Only genuine, spiritually verified accommodations.' },
    { icon: <Sparkles className="w-6 h-6 text-[#0A4DA6]" />, title: 'Innovation', desc: 'We bring modern technology to ancient traditions — from AI guidance to digital check-ins.' },
  ];

  const team = [
    { name: 'Arjun Sharma', role: 'Co-Founder & CEO', initials: 'AS', color: 'bg-[#0A4DA6]' },
    { name: 'Priya Nair', role: 'Co-Founder & CTO', initials: 'PN', color: 'bg-[#0E7B6C]' },
    { name: 'Rahul Gupta', role: 'Head of Operations', initials: 'RG', color: 'bg-[#6B21A8]' },
    { name: 'Meena Iyer', role: 'Head of Partnerships', initials: 'MI', color: 'bg-[#D4AF37]' },
  ];

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="bg-[#0B192C] text-white py-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#0A4DA6]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[200px] h-[200px] bg-[#D4AF37]/5 rounded-full blur-[60px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">Our Story</span>
          <h1 className="font-extrabold leading-tight text-white" style={{ fontSize: 'clamp(1.8rem, 6vw, 3rem)' }}>
            About <span className="text-[#D4AF37]">Tirvona</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl mx-auto">
            We are on a mission to digitise India's sacred travel ecosystem — making pilgrimages safer, more accessible, and deeply meaningful for every devotee.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <h2 className="font-extrabold text-[#0B192C] dark:text-white" style={{ fontSize: 'clamp(1.3rem, 4vw, 1.875rem)' }}>
              Our Mission
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              India has over 2 million pilgrims travelling every single day — yet most of them rely on unverified, word-of-mouth recommendations for accommodation. Tirvona was built to change that.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              We are India's first government-integrated spiritual travel platform, connecting verified ashrams, dharamshalas and retreat centres with pilgrims across the country. Our platform ensures every stay is safe, dignified, and spiritually enriching.
            </p>
            <div className="space-y-3 pt-2">
              {[
                'Physically verified accommodations by trained field executives',
                'Real-time booking with instant confirmation',
                'AI-powered pilgrim guidance in your language',
                'Transparent pricing with no hidden charges',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-200">
                  <CheckCircle size={16} className="text-[#0A4DA6] mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { val: '2,500+', label: 'Sacred Destinations' },
              { val: '10M+', label: 'Happy Pilgrims' },
              { val: '500+', label: 'Temple Partners' },
              { val: '₹50Cr+', label: 'Donations Facilitated' },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 text-center shadow-sm">
                <span className="block text-2xl sm:text-3xl font-black text-[#0A4DA6] leading-none mb-2">{stat.val}</span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 dark:bg-slate-900/50 py-14 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="font-extrabold text-[#0B192C] dark:text-white" style={{ fontSize: 'clamp(1.3rem, 4vw, 1.875rem)' }}>Our Values</h2>
            <p className="text-sm text-gray-500">The principles that guide everything we do.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {values.map((v, i) => (
              <div key={i} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 text-center space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-[#0A4DA6]/5 border border-[#0A4DA6]/10 flex items-center justify-center mx-auto">{v.icon}</div>
                <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">{v.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-8">
        <h2 className="font-extrabold text-[#0B192C] dark:text-white text-center" style={{ fontSize: 'clamp(1.3rem, 4vw, 1.875rem)' }}>Our Journey</h2>
        <div className="space-y-0">
          {milestones.map((m, i) => (
            <div key={i} className="flex gap-5 relative">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-[#0A4DA6] text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 z-10">{m.year.slice(2)}</div>
                {i < milestones.length - 1 && <div className="w-0.5 flex-grow bg-gray-100 dark:bg-slate-800 my-1" />}
              </div>
              <div className="pb-8 pt-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]">{m.year}</span>
                <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white mt-0.5">{m.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-1">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="bg-gray-50 dark:bg-slate-900/50 py-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-10">
          <h2 className="font-extrabold text-[#0B192C] dark:text-white text-center" style={{ fontSize: 'clamp(1.3rem, 4vw, 1.875rem)' }}>Leadership Team</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {team.map((t, i) => (
              <div key={i} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 text-center space-y-3 shadow-sm">
                <div className={`w-14 h-14 rounded-full ${t.color} text-white text-lg font-black flex items-center justify-center mx-auto`}>{t.initials}</div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">{t.name}</h3>
                  <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center space-y-5">
        <h2 className="font-extrabold text-[#0B192C] dark:text-white" style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>
          Ready to Begin Your Sacred Journey?
        </h2>
        <p className="text-sm text-gray-500">Join millions of pilgrims who trust Tirvona for safe, verified spiritual travel.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/search" className="min-h-[48px] px-8 py-3 bg-[#0A4DA6] text-white font-extrabold text-sm rounded-full flex items-center justify-center gap-2 shadow-lg">
            Explore Destinations <ArrowRight size={15} />
          </Link>
          <Link to="/partner" className="min-h-[48px] px-8 py-3 border border-gray-200 dark:border-slate-700 text-[#0B192C] dark:text-white font-extrabold text-sm rounded-full flex items-center justify-center">
            Partner With Us
          </Link>
        </div>
      </section>
    </div>
  );
};
export default AboutPage;
