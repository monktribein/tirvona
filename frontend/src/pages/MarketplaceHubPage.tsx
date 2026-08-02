import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, Home } from "lucide-react";

export const MarketplaceHubPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pb-16">
      {/* Clean Text Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-3xl sm:text-5xl font-bold text-[#E58C28]">
            Shops &amp; Sacred Marketplace
          </p>
          {/* Decorative Saffron Underline Divider */}
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Order authentic Temple Prasad, Lab-Certified Rudraksha, Tulsi Mala,
            and Puja Samagri directly from sacred vendors soon!
          </p>
        </div>
      </div>

      {/* Feature Showcase Banner */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-4 space-y-8">
        <div className="flex justify-center">
          <img
            src="/banner/coming soon/marketplace.png"
            alt="Shops & Sacred Marketplace Coming Soon"
            className="w-full h-auto max-h-[500px] object-contain drop-shadow-md"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <Home size={16} />
            <span>Back to Home</span>
          </button>
          <button
            onClick={() => navigate("/search")}
            className="px-6 py-3 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <span>Explore Verified Ashrams</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
export default MarketplaceHubPage;
