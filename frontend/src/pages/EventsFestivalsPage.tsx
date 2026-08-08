import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, ArrowRight, Home } from "lucide-react";

export const EventsFestivalsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");

  const getCategoryHeader = (cat: string) => {
    const formattedName = cat
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    return {
      title: `${formattedName} Events & Festivals`,
      subtitle: `Explore upcoming ${formattedName.toLowerCase()} schedules, Snan passes, and cultural event registrations.`,
    };
  };

  const headerInfo = categoryParam
    ? getCategoryHeader(categoryParam)
    : {
        title: "Events & Sacred Festivals",
        subtitle:
          "Live festival schedules, Shahi Snan passes, and Mahotsav event registrations.",
      };

  return (
    <div className="min-h-screen pb-16">
      {/* Clean Text Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-3xl sm:text-5xl font-bold text-[#E58C28]">
            {headerInfo.title}
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
            {headerInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Feature Showcase Banner */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-4 flex flex-col items-center justify-center">
        <img
          src="/banner/coming%20soon/marketplace.png"
          alt="Coming Soon"
          className="w-full max-w-3xl h-auto object-contain max-h-[550px] mx-auto drop-shadow-md"
        />

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

export default EventsFestivalsPage;
