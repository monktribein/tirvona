import React, { useState } from "react";
import { Search, Sparkles } from "lucide-react";

export const PilgrimageCircuitsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Clean Text Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#E58C28]">
            Sacred Pilgrimage itineraries
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
            Explore sacred itineraries.
          </p>
          {/* Centered Search Bar */}
          <form
            onSubmit={handleSearch}
            className="w-full max-w-xl mx-auto pt-3 relative z-10"
          >
            <div className="bg-white dark:bg-[#0B192C] rounded-full p-2 shadow-lg border border-gray-200 dark:border-slate-800 flex items-center">
              <Search size={18} className="text-gray-400 ml-4 shrink-0" />
              <input
                type="text"
                placeholder="Search circuit name (e.g. Char Dham, Jyotirlinga)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent px-3 text-sm font-semibold text-[#0B192C] dark:text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs transition-colors shrink-0 shadow-sm cursor-pointer"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Coming Soon Temple Banner Artwork Illustration */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 my-8 sm:my-12 flex flex-col items-center justify-center">
        <img
          src="/banner/coming%20soon/marketplace.png"
          alt="Coming Soon"
          className="w-full max-w-2xl sm:max-w-3xl h-auto object-contain max-h-[550px] mx-auto drop-shadow-md"
        />
      </div>
    </div>
  );
};

