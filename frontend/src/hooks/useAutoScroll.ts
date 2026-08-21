import { useCallback, useEffect, useState } from "react";
import type { MutableRefObject } from "react";

export interface AutoScrollOptions<T extends HTMLElement = HTMLElement> {
  speed?: number;
  edgeHold?: number;
  resumeDelay?: number;
  enabled?: boolean;
  forwardTo?: MutableRefObject<T | null>;
}

export function useAutoScroll<T extends HTMLElement = HTMLElement>({
  speed = 22,
  edgeHold = 1200,
  resumeDelay = 2500,
  enabled = true,
  forwardTo,
}: AutoScrollOptions<T> = {}): (node: T | null) => void {
  const [node, setNode] = useState<T | null>(null);

  const setRef = useCallback(
    (el: T | null) => {
      setNode(el);
      if (forwardTo) forwardTo.current = el;
    },
    [forwardTo],
  );

  useEffect(() => {
    if (!node || !enabled) return;
    const el = node;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const previousScrollBehavior = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";

    let frame = 0;
    let maxScroll = 0;
    let position = 0;
    let direction = 1;
    let paused = false;
    let visible = true;
    let holdUntil = 0;
    let lastTime = 0;
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const delta = lastTime ? Math.min(now - lastTime, 50) : 0; // clamp tab-switch gaps
      lastTime = now;

      if (
        paused ||
        !visible ||
        maxScroll <= 1 ||
        reduceMotion.matches ||
        now < holdUntil
      )
        return;

      position += ((speed * delta) / 1000) * direction;

      if (position >= maxScroll) {
        position = maxScroll;
        direction = -1;
        holdUntil = now + edgeHold;
      } else if (position <= 0) {
        position = 0;
        direction = 1;
        holdUntil = now + edgeHold;
      }
      el.scrollLeft = position;
    };

    const pause = () => {
      paused = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    };

    const resumeSoon = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        position = el.scrollLeft;
        paused = false;
      }, resumeDelay);
    };

    const nudge = () => {
      pause();
      resumeSoon();
    };

    const onScroll = () => {
      if (Math.abs(el.scrollLeft - position) > 2) nudge();
    };

    const measure = () => {
      maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      position = Math.min(el.scrollLeft, maxScroll);
    };

    const resizeObserver = new ResizeObserver(measure);
    const observeChildren = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(el);
      for (const child of Array.from(el.children))
        resizeObserver.observe(child);
      measure();
    };
    observeChildren();

    const mutationObserver = new MutationObserver(observeChildren);
    mutationObserver.observe(el, { childList: true });

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    visibilityObserver.observe(el);

    const listeners: Array<[string, EventListener, AddEventListenerOptions?]> =
      [
        ["pointerdown", pause],
        ["pointerup", resumeSoon],
        ["pointercancel", resumeSoon],
        ["mouseenter", pause],
        ["mouseleave", resumeSoon],
        ["focusin", pause],
        ["focusout", resumeSoon],
        ["wheel", nudge, { passive: true }],
        ["touchmove", nudge, { passive: true }],
        ["scroll", onScroll, { passive: true }],
      ];
    for (const [type, handler, opts] of listeners)
      el.addEventListener(type, handler, opts);

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      if (resumeTimer) clearTimeout(resumeTimer);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      visibilityObserver.disconnect();
      for (const [type, handler] of listeners)
        el.removeEventListener(type, handler);
      el.style.scrollBehavior = previousScrollBehavior;
    };
  }, [node, speed, edgeHold, resumeDelay, enabled]);

  return setRef;
}

export default useAutoScroll;
