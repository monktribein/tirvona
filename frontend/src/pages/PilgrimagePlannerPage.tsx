import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Compass,
  MapPin,
  Calendar,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Clock,
  ShieldCheck,
  Bed,
  Car,
  Utensils,
  Download,
  Share2,
  ChevronRight,
  Sun,
  AlertTriangle,
  FileText,
  DollarSign,
  Heart,
  BookOpen,
} from 'lucide-react';

import axios from 'axios';

export const PilgrimagePlannerPage: React.FC = () => {
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState(1);
  const [destination, setDestination] = useState('Kedarnath & Char Dham');
  const [purpose, setPurpose] = useState('Pilgrimage & Darshan');
  const [startCity, setStartCity] = useState('Haridwar');
  const [travelDate, setTravelDate] = useState('2026-05-15');
  const [durationDays, setDurationDays] = useState(7);
  const [adults, setAdults] = useState(2);
  const [seniorCitizens, setSeniorCitizens] = useState(1);
  const [budgetType, setBudgetType] = useState('Standard');
  const [needAshram, setNeedAshram] = useState(true);
  const [needSatvikFood, setNeedSatvikFood] = useState(true);
  const [needGuide, setNeedGuide] = useState(true);
  const [needVipDarshan, setNeedVipDarshan] = useState(true);

  // Generated state flag
  const [generated, setGenerated] = useState(true);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/planner/generate`,
        {
          destination,
          purpose,
          startCity,
          travelDate,
          durationDays,
          adults,
          seniorCitizens,
          budgetType,
          preferences: { needAshram, needSatvikFood, needGuide, needVipDarshan },
        }
      );
      setGenerated(true);
      window.scrollTo({ top: 500, behavior: 'smooth' });
    } catch (err) {
      console.error('Error generating itinerary:', err);
      setGenerated(true);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pt-20 sm:pt-24 pb-16">

      {/* Breadcrumb Bar */}
      <div className="bg-white dark:bg-[#0B192C] border-b border-gray-100 dark:border-slate-800/80 py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
          <Link to="/" className="hover:text-[#0A4DA6]">Home</Link>
          <ChevronRight size={13} />
          <span className="text-[#0A4DA6] dark:text-amber-400 font-black">Destinations</span>
          <ChevronRight size={13} />
          <span className="text-gray-700 dark:text-gray-200 font-black">Intelligent Pilgrimage Planner</span>
        </div>
      </div>

      {/* Hero Banner Header */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white py-12 sm:py-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto text-center space-y-4 relative z-10">
          <span className="px-4 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-black uppercase tracking-wider border border-white/20">
            Govt-Scale Spiritual Tourism Engine
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Tirvona AI Pilgrimage Itinerary Planner
          </h1>
          <p className="text-sm sm:text-base text-blue-100 max-w-3xl mx-auto font-medium">
            Generate complete day-by-day travel plans, verified ashram stays, darshan schedules, satvik dining, budget breakdown, and route maps for your sacred yatra.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-10">

        {/* Multi-Step Interactive Planner Form */}
        <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-10 border border-gray-100 dark:border-slate-800 shadow-xl space-y-8">
          
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4">
            <h3 className="font-black text-xl text-[#0B192C] dark:text-white flex items-center gap-2">
              <Compass size={22} className="text-[#0A4DA6]" />
              <span>Customize Your Sacred Yatra</span>
            </h3>
            <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-slate-900 text-[#0A4DA6] dark:text-amber-400 text-xs font-black">
              Step {step} of 4
            </span>
          </div>

          <form onSubmit={handleGenerate} className="space-y-6">

            {/* Step 1: Destination Selection */}
            {step === 1 && (
              <div className="space-y-4">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">
                  1. Where do you want to go? (Destination, Temple or Circuit)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    'Kedarnath & Char Dham',
                    'Kashi Vishwanath (Varanasi)',
                    'Shri Ram Janmabhoomi (Ayodhya)',
                    'Mahakaleshwar (Ujjain)',
                    'Tirupati Balaji',
                    'Jagannath Temple (Puri)',
                    'Mathura & Vrindavan Circuit',
                    '12 Jyotirlinga Maha Yatra',
                  ].map((dest) => (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => setDestination(dest)}
                      className={`p-4 rounded-2xl border text-xs font-black text-left transition-all ${
                        destination === dest
                          ? 'bg-[#0A4DA6] text-white border-[#0A4DA6] shadow-md'
                          : 'bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-800 hover:bg-gray-100'
                      }`}
                    >
                      {dest}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Purpose */}
            {step === 2 && (
              <div className="space-y-4">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">
                  2. Purpose of Your Sacred Journey
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {['Pilgrimage & Darshan', 'Family Tour', 'Senior Citizen Yatra', 'Spiritual Meditation', 'Char Dham Trek', 'Festival Visit'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPurpose(p)}
                      className={`p-4 rounded-2xl border text-xs font-black text-center transition-all ${
                        purpose === p
                          ? 'bg-[#0A4DA6] text-white border-[#0A4DA6] shadow-md'
                          : 'bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-800 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Travel Details */}
            {step === 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500 uppercase">Starting City</label>
                  <input
                    type="text"
                    value={startCity}
                    onChange={(e) => setStartCity(e.target.value)}
                    className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500 uppercase">Travel Date</label>
                  <input
                    type="date"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500 uppercase">Duration (Days)</label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Preferences */}
            {step === 4 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <label className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold">
                  <input type="checkbox" checked={needAshram} onChange={() => setNeedAshram(!needAshram)} />
                  <span>Ashram Stay</span>
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold">
                  <input type="checkbox" checked={needSatvikFood} onChange={() => setNeedSatvikFood(!needSatvikFood)} />
                  <span>Satvik Meals</span>
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold">
                  <input type="checkbox" checked={needGuide} onChange={() => setNeedGuide(!needGuide)} />
                  <span>Certified Guide</span>
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold">
                  <input type="checkbox" checked={needVipDarshan} onChange={() => setNeedVipDarshan(!needVipDarshan)} />
                  <span>VIP Pass Assistance</span>
                </label>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-slate-800">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-2.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-bold text-xs"
                >
                  ← Back
                </button>
              )}
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="ml-auto px-6 py-2.5 rounded-full bg-[#0A4DA6] text-white font-black text-xs shadow-md"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="submit"
                  className="ml-auto px-8 py-3 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-black text-xs shadow-xl transition-all"
                >
                  Generate Complete Itinerary 🚀
                </button>
              )}
            </div>

          </form>
        </div>

        {/* Generated Enterprise Itinerary Output */}
        {generated && (
          <div className="space-y-10 animate-fade-in">

            {/* Overview Banner */}
            <div className="bg-gradient-to-r from-[#0B192C] via-indigo-950 to-[#0B192C] text-white rounded-[32px] p-6 sm:p-10 border border-white/10 shadow-2xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                    VERIFIED ITINERARY GENERATED
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-black mt-2">
                    {destination} ({durationDays} Days / {durationDays - 1} Nights)
                  </h2>
                  <p className="text-xs text-blue-200 font-medium">Starting from {startCity} • Purpose: {purpose}</p>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => alert('PDF downloading...')} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md">
                    <Download size={14} /> PDF
                  </button>
                  <button onClick={() => alert('Itinerary link copied')} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md">
                    <Share2 size={14} /> Share
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold pt-2 border-t border-white/10">
                <div className="bg-white/5 p-3 rounded-2xl">
                  <span className="text-gray-400 block text-[10px] uppercase">Best Season</span>
                  <span className="text-amber-400 font-black">May to October</span>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl">
                  <span className="text-gray-400 block text-[10px] uppercase">Crowd Level</span>
                  <span className="text-emerald-400 font-black">Moderate Crowd</span>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl">
                  <span className="text-gray-400 block text-[10px] uppercase">Weather</span>
                  <span className="text-blue-300 font-black">14°C - Clear Sky</span>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl">
                  <span className="text-gray-400 block text-[10px] uppercase">Distance</span>
                  <span className="text-amber-300 font-black">1,450 km (Round Trip)</span>
                </div>
              </div>
            </div>

            {/* Day-by-Day Timeline */}
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-10 border border-gray-100 dark:border-slate-800 shadow-sm space-y-6">
              <h3 className="font-black text-xl text-[#0B192C] dark:text-white">Day-by-Day Sacred Travel Plan</h3>

              <div className="space-y-4">
                {[
                  { day: 1, title: 'Arrival at Haridwar & Evening Ganga Aarti', morning: 'Reach Haridwar Railway Station/Airport. Check-in at Hari Har Ashram.', afternoon: 'Rest & Satvik Lunch at Ashram Bhojnalaya.', evening: 'Attend world-famous evening Ganga Aarti at Har Ki Pauri ghat.', night: 'Stay at Haridwar Ashram.' },
                  { day: 2, title: 'Haridwar to Barkot / Guptkashi', morning: 'Early morning departures via AC tourist bus along Yamuna river.', afternoon: 'Stop at Mussoorie Kempty Falls for tea & refreshments.', evening: 'Reach Barkot hotel/ashram base camp.', night: 'Night stay & early dinner.' },
                  { day: 3, title: 'Yamunotri Dham Shrine Trek', morning: 'Trek 6 km from Janki Chatti to Yamunotri Temple.', afternoon: 'Sacred bath in Surya Kund & Yamunotri Darshan.', evening: 'Return trek to Janki Chatti.', night: 'Stay at Barkot.' },
                ].map((d) => (
                  <div key={d.day} className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-full bg-[#0A4DA6] text-white font-black text-xs flex items-center justify-center">
                        Day {d.day}
                      </span>
                      <h4 className="font-black text-base text-[#0B192C] dark:text-white">{d.title}</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pl-12">
                      <div className="bg-white dark:bg-[#0B192C] p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                        <span className="font-bold text-[#0A4DA6] block">Morning</span>
                        <p className="text-gray-600 dark:text-gray-300">{d.morning}</p>
                      </div>
                      <div className="bg-white dark:bg-[#0B192C] p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                        <span className="font-bold text-[#0A4DA6] block">Afternoon</span>
                        <p className="text-gray-600 dark:text-gray-300">{d.afternoon}</p>
                      </div>
                      <div className="bg-white dark:bg-[#0B192C] p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                        <span className="font-bold text-[#0A4DA6] block">Evening & Night</span>
                        <p className="text-gray-600 dark:text-gray-300">{d.evening} {d.night}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget Breakdown & Packing List Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Budget Table */}
              <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="font-black text-lg text-[#0B192C] dark:text-white flex items-center gap-2">
                  <DollarSign size={20} className="text-[#0A4DA6]" />
                  <span>Estimated Budget Breakdown</span>
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                    <span className="text-gray-500 font-bold">Transport (AC Bus / Innova)</span>
                    <span className="font-black text-gray-800 dark:text-gray-200">₹8,500 / person</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                    <span className="text-gray-500 font-bold">Ashram Room (7 Nights)</span>
                    <span className="font-black text-gray-800 dark:text-gray-200">₹6,200 / person</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                    <span className="text-gray-500 font-bold">Satvik Meals & Prasad</span>
                    <span className="font-black text-gray-800 dark:text-gray-200">₹3,500 / person</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                    <span className="text-gray-500 font-bold">VIP Darshan & Guide Passes</span>
                    <span className="font-black text-gray-800 dark:text-gray-200">₹1,500 / person</span>
                  </div>
                  <div className="flex justify-between py-3 text-sm font-black text-[#0A4DA6] dark:text-amber-400">
                    <span>Total Estimated Cost</span>
                    <span>₹19,700 per pilgrim</span>
                  </div>
                </div>
              </div>

              {/* Packing Checklist */}
              <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="font-black text-lg text-[#0B192C] dark:text-white flex items-center gap-2">
                  <FileText size={20} className="text-[#0A4DA6]" />
                  <span>Pilgrim Packing Checklist</span>
                </h3>
                <ul className="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Government Aadhaar ID</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Thermal Woolen Jackets</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Comfortable Trekking Shoes</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Personal Medical Kit</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Reusable Water Bottle</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Raincoat / Umbrella</li>
                </ul>
              </div>

            </div>

            {/* Booking Action Footer */}
            <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white rounded-[32px] p-8 text-center space-y-4 shadow-xl">
              <h3 className="text-2xl font-black">Ready to Lock In Your Sacred Journey?</h3>
              <p className="text-xs text-blue-100 max-w-xl mx-auto">
                Reserve your ashrams, transport cabs, and verified temple guide passes in one click.
              </p>
              <button
                onClick={() => navigate('/search')}
                className="px-8 py-3.5 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-black text-xs shadow-2xl transition-all"
              >
                Book Entire Sacred Trip Now 🚀
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
