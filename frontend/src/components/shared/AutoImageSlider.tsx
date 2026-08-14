import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Auto-advancing photo slider for an article's gallery.
 *
 * Slides are laid out in a flex track that is translated by whole percentages,
 * so the movement is one CSS transition rather than a per-frame animation —
 * smooth without holding the main thread. A single image renders as a plain
 * photo: no track, no controls, no timer.
 */
export const AutoImageSlider: React.FC<{
  images: string[];
  alt?: string;
  /** Milliseconds between slides. */
  interval?: number;
  className?: string;
}> = ({ images, alt = "", interval = 4000, className = "" }) => {
  const slides = images.filter(Boolean);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length),
    [slides.length],
  );

  // Auto-advance. Pauses on hover/focus and while the tab is hidden, so a
  // backgrounded article is not silently cycling.
  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % slides.length);
    }, interval);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, interval]);

  // A shrinking gallery (a photo removed while open) must not strand the index
  // past the end, which would show an empty frame.
  useEffect(() => {
    setIndex((i) => (i >= slides.length ? 0 : i));
  }, [slides.length]);

  if (slides.length === 0) return null;

  if (slides.length === 1)
    return (
      <div
        className={`relative rounded-[28px] overflow-hidden shadow-xl border border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 ${className}`}
      >
        <img src={slides[0]} alt={alt} className="w-full h-full object-cover" />
      </div>
    );

  return (
    <div
      className={`relative rounded-[28px] overflow-hidden shadow-xl border border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 group ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 40) go(index + (delta < 0 ? 1 : -1));
        touchStartX.current = null;
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label={alt || "Article photos"}
    >
      <div
        className="flex h-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={`${alt} ${i + 1}`}
            // shrink-0 + w-full makes each slide exactly one frame wide;
            // without it flex would compress them all into view at once.
            className="w-full h-full shrink-0 object-cover"
            loading={i === 0 ? "eager" : "lazy"}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous photo"
        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/45 hover:bg-black/65 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next photo"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/45 hover:bg-black/65 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
      >
        <ChevronRight size={18} />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Go to photo ${i + 1}`}
            aria-current={i === index}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              i === index ? "w-6 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default AutoImageSlider;
