import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Sparkles, Clock, ArrowLeft, Compass, Building, Bell } from 'lucide-react';

export const MarketplaceHubPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 text-center">
      <div className="max-w-xl w-full bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[36px] p-8 sm:p-12 shadow-2xl space-y-8 relative overflow-hidden">
        {/* Subtle Background Glow Accent */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-[#0A4DA6]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Icon & Badge */}
        <div className="space-y-4">
          <div className="inline-flex p-4 rounded-3xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 shadow-inner">
            <ShoppingBag size={48} className="animate-bounce" />
          </div>

          <div>
            <span className="px-4 py-1.5 bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
              <Clock size={14} /> Launching Soon
            </span>
          </div>
        </div>

        {/* Headline & Description */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-black text-[#0B192C] dark:text-white tracking-tight">
            Marketplace Coming Soon
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-md mx-auto">
            We are curating an authentic collection of consecrated Rudraksha, sacred Puja Samagri, authentic Temple Prasad, and handcrafted items directly from verified Ashrams across Bharat.
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
          <button
            onClick={() => navigate('/search')}
            className="w-full sm:w-auto px-6 py-3 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#0A4DA6]/25 transition-all cursor-pointer"
          >
            <Compass size={16} /> Explore Destinations
          </button>
          <button
            onClick={() => navigate('/services')}
            className="w-full sm:w-auto px-6 py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-full text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Building size={16} /> Explore Services
          </button>
        </div>

        {/* Back Link */}
        <div className="pt-2">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} /> Return to Homepage
          </button>
        </div>
      </div>
    </div>
  );
};
