import React, { useState, useEffect, useRef, useMemo } from "react";

const ensureLoopItems = <T,>(arr: T[], minCount = 6): T[] => {
  if (!arr || arr.length === 0) return [];
  let base = [...arr];
  while (base.length < minCount) {
    base = [...base, ...arr];
  }
  return base;
};

export interface MarqueeSliderProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  speed?: number;
  className?: string;
  gapClass?: string;
  minItems?: number;
}

export function MarqueeSlider<T>({
  items,
  renderItem,
  speed = 30,
  className = "",
  gapClass = "gap-4 sm:gap-6",
  minItems = 6,
}: MarqueeSliderProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const halfWidthRef = useRef(0);
  const isPausedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, pos: 0, didDrag: false });
  const momentumVelRef = useRef(0);
  const lastPointerRef = useRef({ x: 0, time: 0 });
  const isVisibleRef = useRef(false);
  const [isGrabbing, setIsGrabbing] = useState(false);

  const baseList = useMemo(() => ensureLoopItems(items, minItems), [items, minItems]);
  const loopList = useMemo(() => {
    if (baseList.length === 0) return [];
    return [...baseList, ...baseList];
  }, [baseList]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (loopList.length === 0) return;
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const kids = track.children;
      const halfIdx = baseList.length;
      if (kids.length >= halfIdx * 2 && halfIdx > 0) {
        const firstChild = kids[0] as HTMLElement;
        const halfChild = kids[halfIdx] as HTMLElement;
        if (firstChild && halfChild) {
          halfWidthRef.current = halfChild.offsetLeft - firstChild.offsetLeft;
        }
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    for (const kid of Array.from(track.children)) {
      ro.observe(kid);
    }
    const mo = new MutationObserver(measure);
    mo.observe(track, { childList: true, subtree: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [baseList, loopList]);

  useEffect(() => {
    if (loopList.length === 0) return;
    const track = trackRef.current;
    if (!track) return;

    let animId: number;
    let lastTime = performance.now();

    const step = (now: number) => {
      animId = requestAnimationFrame(step);
      if (!isVisibleRef.current) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (halfWidthRef.current <= 0 || isDraggingRef.current) return;

      if (Math.abs(momentumVelRef.current) > 1) {
        posRef.current += momentumVelRef.current * dt;
        momentumVelRef.current *= Math.pow(0.92, dt * 60);
        if (Math.abs(momentumVelRef.current) < 2) {
          momentumVelRef.current = 0;
        }
      } else if (!isPausedRef.current) {
        posRef.current += speed * dt;
      }

      const W = halfWidthRef.current;
      if (W > 0) {
        while (posRef.current >= W) posRef.current -= W;
        while (posRef.current < 0) posRef.current += W;
      }

      track.style.transform = `translate3d(${-posRef.current}px, 0, 0)`;
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [loopList, speed]);

  const handleMouseEnter = () => {
    if (!isDraggingRef.current) isPausedRef.current = true;
  };
  const handleMouseLeave = () => {
    if (!isDraggingRef.current) isPausedRef.current = false;
  };

  const wheelTimerRef = useRef<any>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
      if (Math.abs(delta) > 1) {
        posRef.current += delta;
        const W = halfWidthRef.current;
        if (W > 0) {
          while (posRef.current >= W) posRef.current -= W;
          while (posRef.current < 0) posRef.current += W;
        }
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${-posRef.current}px, 0, 0)`;
        }

        isPausedRef.current = true;
        if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = setTimeout(() => {
          isPausedRef.current = false;
        }, 600);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    isDraggingRef.current = true;
    setIsGrabbing(true);
    momentumVelRef.current = 0;
    const now = performance.now();
    dragStartRef.current = { x: e.clientX, pos: posRef.current, didDrag: false };
    lastPointerRef.current = { x: e.clientX, time: now };

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.x;
      if (Math.abs(dx) > 3) {
        dragStartRef.current.didDrag = true;
      }

      const moveTime = performance.now();
      const deltaT = (moveTime - lastPointerRef.current.time) / 1000;
      if (deltaT > 0.005) {
        const moveDx = lastPointerRef.current.x - ev.clientX;
        momentumVelRef.current = moveDx / deltaT;
        lastPointerRef.current = { x: ev.clientX, time: moveTime };
      }

      let nextPos = dragStartRef.current.pos - dx;
      const W = halfWidthRef.current;
      if (W > 0) {
        while (nextPos >= W) nextPos -= W;
        while (nextPos < 0) nextPos += W;
      }
      posRef.current = nextPos;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-nextPos}px, 0, 0)`;
      }
    };

    const cleanupPointer = () => {
      isDraggingRef.current = false;
      setIsGrabbing(false);
      const elapsed = performance.now() - lastPointerRef.current.time;
      if (elapsed > 60) {
        momentumVelRef.current = 0;
      } else {
        momentumVelRef.current = Math.max(-1800, Math.min(1800, momentumVelRef.current));
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", cleanupPointer);
      window.removeEventListener("pointercancel", cleanupPointer);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", cleanupPointer);
    window.addEventListener("pointercancel", cleanupPointer);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (dragStartRef.current.didDrag) {
      e.preventDefault();
      e.stopPropagation();
      dragStartRef.current.didDrag = false;
    }
  };

  if (loopList.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden w-full relative select-none touch-pan-y py-4 -my-2 ${isGrabbing ? "cursor-grabbing" : "cursor-grab"} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onClickCapture={handleClickCapture}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        ref={trackRef}
        className={`flex ${gapClass} w-max will-change-transform select-none py-2 px-1`}
        style={{ transform: "translate3d(0, 0, 0)" }}
      >
        {loopList.map((item, idx) => (
          <React.Fragment key={idx}>
            {renderItem(item, idx)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
