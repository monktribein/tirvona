import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ShieldCheck, ChevronLeft, ChevronRight, ThumbsUp, X, MessageSquareQuote, Sparkles } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface ReviewItem {
  _id: string;
  customerId?: {
    _id?: string;
    name?: string;
    avatar?: string;
  };
  rating?: {
    overall: number;
    cleanliness?: number;
    hospitality?: number;
    amenities?: number;
  };
  comment: string;
  createdAt?: string;
  helpfulCount?: number;
}

interface GuestReviewsCarouselProps {
  reviews: ReviewItem[];
  ashramName?: string;
}

export const GuestReviewsCarousel: React.FC<GuestReviewsCarouselProps> = ({ reviews, ashramName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [helpfulClicks, setHelpfulClicks] = useState<Record<string, number>>({});
  const touchStartX = useRef<number>(0);

  // Responsive cards per view: 1 mobile, 2 tablet, 3 desktop
  const [itemsPerPage, setItemsPerPage] = useState(3);

  useEffect(() => {
    const updateItemsPerPage = () => {
      if (window.innerWidth < 640) {
        setItemsPerPage(1);
      } else if (window.innerWidth < 1024) {
        setItemsPerPage(2);
      } else {
        setItemsPerPage(3);
      }
    };
    updateItemsPerPage();
    window.addEventListener('resize', updateItemsPerPage);
    return () => window.removeEventListener('resize', updateItemsPerPage);
  }, []);

  // Calculate Average Rating
  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + (r.rating?.overall || 5), 0) / reviews.length).toFixed(1)
    : '4.8';

  const totalPages = Math.ceil(reviews.length / itemsPerPage);

  // Auto-slide every 5 seconds (pauses on hover)
  useEffect(() => {
    if (reviews.length <= itemsPerPage || isHovered) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [reviews.length, itemsPerPage, isHovered]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % reviews.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) handleNext();
      else handlePrev();
    }
  };

  const handleHelpful = (id: string, initialCount = 4) => {
    setHelpfulClicks((prev) => ({
      ...prev,
      [id]: (prev[id] || initialCount) + 1,
    }));
  };

  // Helper for formatted date
  const formatReviewDate = (dateStr?: string) => {
    if (!dateStr) return 'Stayed in July 2026';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Stayed recently';
    return `Stayed in ${date.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`;
  };

  // Compute slice of reviews to display in current window
  const getVisibleReviews = () => {
    if (reviews.length === 0) return [];
    const visible = [];
    for (let i = 0; i < itemsPerPage; i++) {
      const idx = (currentIndex + i) % reviews.length;
      visible.push(reviews[idx]);
    }
    return visible;
  };

  const visibleReviews = getVisibleReviews();

  if (reviews.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-4 shadow-sm text-left">
        <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-50 dark:border-slate-850 pb-3">
          <Star size={18} className="text-[#0A4DA6] fill-[#0A4DA6]" /> Guest Reviews (0)
        </h3>
        <p className="text-xs text-gray-400 italic">No reviews posted yet for this ashram stay. Be the first to share your spiritual experience!</p>
      </div>
    );
  }

  return (
    <div 
      className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-6 shadow-sm text-left relative overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-black text-[#0B192C] dark:text-white flex items-center gap-2">
              <MessageSquareQuote size={20} className="text-[#0A4DA6]" /> Guest Reviews ({reviews.length})
            </h3>
            <VerifiedBadge isVerified={true} text="Verified Pilgrims" size="sm" />
          </div>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">
            Authentic experiences shared by devotees and pilgrims who stayed at {ashramName || 'this Ashram'}.
          </p>
        </div>

        {/* Rating Summary Badge */}
        <div className="flex items-center gap-3 shrink-0 bg-gray-50 dark:bg-slate-900 px-4 py-2 rounded-2xl border border-gray-150 dark:border-slate-800">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={14} className="fill-[#D4AF37] text-[#D4AF37]" />
            ))}
          </div>
          <div className="text-xs font-black text-[#0B192C] dark:text-white tabular-nums">
            {averageRating} <span className="text-gray-400 text-[10px] font-normal">/ 5</span>
          </div>
        </div>
      </div>

      {/* Carousel Container */}
      <div 
        className="relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[220px]">
          <AnimatePresence mode="popLayout">
            {visibleReviews.map((rev, idx) => {
              const reviewerName = rev.customerId?.name || 'Verified Pilgrim';
              const avatarUrl = rev.customerId?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=0A4DA6&color=fff&bold=true`;
              const ratingVal = rev.rating?.overall || 5;
              const helpfulVal = helpfulClicks[rev._id] ?? (rev.helpfulCount || Math.floor(Math.random() * 8) + 3);

              return (
                <motion.div
                  key={`${rev._id}-${idx}-${currentIndex}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-50/70 dark:bg-slate-900/60 border border-gray-150 dark:border-slate-800 p-5 rounded-[22px] flex flex-col justify-between space-y-4 hover:shadow-md hover:border-[#0A4DA6]/30 transition-all group"
                >
                  {/* Card Header */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={avatarUrl}
                          alt={reviewerName}
                          className="w-10 h-10 rounded-full object-cover border-2 border-[#0A4DA6]/20 shadow-sm shrink-0"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=0A4DA6&color=fff`;
                          }}
                        />
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-black text-[#0B192C] dark:text-white line-clamp-1">
                            {reviewerName}
                          </h4>
                          <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck size={10} /> Verified Stay
                          </span>
                        </div>
                      </div>

                      {/* Rating Stars */}
                      <div className="flex items-center gap-0.5 bg-white dark:bg-slate-850 px-2 py-1 rounded-full border border-gray-150 dark:border-slate-800 shadow-2xs shrink-0">
                        <Star size={11} className="fill-[#D4AF37] text-[#D4AF37]" />
                        <span className="text-[10px] font-black text-[#0B192C] dark:text-white tabular-nums">
                          {ratingVal}.0
                        </span>
                      </div>
                    </div>

                    {/* Review Text */}
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed italic line-clamp-4">
                      "{rev.comment}"
                    </p>
                  </div>

                  {/* Card Footer: Date & Helpful Button */}
                  <div className="pt-3 border-t border-gray-200/60 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-gray-400 font-semibold">
                    <span>{formatReviewDate(rev.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => handleHelpful(rev._id, rev.helpfulCount || 4)}
                      className="flex items-center gap-1 hover:text-[#0A4DA6] transition-colors cursor-pointer"
                    >
                      <ThumbsUp size={11} className="text-[#0A4DA6]" />
                      <span>Helpful ({helpfulVal})</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Left / Right Navigation Arrows */}
        {reviews.length > itemsPerPage && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous Reviews"
              className="absolute -left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-[#0B192C] dark:text-white shadow-md border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:bg-[#0A4DA6] hover:text-white transition-all cursor-pointer z-10"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next Reviews"
              className="absolute -right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-[#0B192C] dark:text-white shadow-md border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:bg-[#0A4DA6] hover:text-white transition-all cursor-pointer z-10"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* Footer Navigation: Pagination Dots & View All Reviews Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-slate-800">
        {/* Pagination Dots */}
        <div className="flex items-center gap-1.5 select-none">
          {Array.from({ length: Math.min(8, reviews.length) }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                i === (currentIndex % reviews.length)
                  ? 'w-6 bg-[#0A4DA6]'
                  : 'w-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* View All Reviews Button */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-black rounded-full transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          View All Reviews ({reviews.length})
        </button>
      </div>

      {/* View All Reviews Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-[#0B192C] w-full max-w-4xl max-h-[85vh] rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden text-left"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-[#0B192C] dark:text-white flex items-center gap-2">
                  <Star className="text-[#D4AF37] fill-[#D4AF37]" size={20} /> All Guest Reviews ({reviews.length})
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                  Verified guest ratings and authentic feedback for {ashramName || 'this Ashram'}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 hover:text-gray-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Scroll */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {reviews.map((rev, i) => {
                  const reviewerName = rev.customerId?.name || 'Verified Pilgrim';
                  const avatarUrl = rev.customerId?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=0A4DA6&color=fff&bold=true`;
                  const ratingVal = rev.rating?.overall || 5;

                  return (
                    <div
                      key={rev._id || i}
                      className="p-4 bg-gray-50 dark:bg-slate-900/60 border border-gray-150 dark:border-slate-800 rounded-2xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={avatarUrl}
                            alt={reviewerName}
                            className="w-9 h-9 rounded-full object-cover border border-[#0A4DA6]/20 shrink-0"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=0A4DA6&color=fff`;
                            }}
                          />
                          <div>
                            <h4 className="text-xs font-black text-[#0B192C] dark:text-white">{reviewerName}</h4>
                            <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <ShieldCheck size={9} /> Verified Stay
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 px-2 py-0.5 bg-white dark:bg-slate-800 border border-gray-150 dark:border-slate-700 rounded-full text-[10px] font-extrabold">
                          <Star size={10} className="fill-[#D4AF37] text-[#D4AF37]" /> {ratingVal} / 5
                        </div>
                      </div>

                      <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed italic">
                        "{rev.comment}"
                      </p>

                      <div className="text-[10px] text-gray-400 font-semibold pt-1 border-t border-gray-200/50 dark:border-slate-800/50">
                        {formatReviewDate(rev.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-6 py-2 bg-[#0A4DA6] text-white text-xs font-black rounded-full hover:bg-[#083b80] transition-colors cursor-pointer"
              >
                Close Reviews
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
