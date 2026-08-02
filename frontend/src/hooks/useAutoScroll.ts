import { useCallback, useEffect, useState } from "react";
import type { MutableRefObject } from "react";

export interface AutoScrollOptions<T extends HTMLElement = HTMLElement> {
  /** Pixels per second. Low values read as ambient drift rather than animation. */
  speed?: number;
  /** Milliseconds to dwell at each end before reversing. */
  edgeHold?: number;
  /** Milliseconds after the visitor stops interacting before drifting resumes. */
  resumeDelay?: number;
  /** Set false to disable entirely. */
  enabled?: boolean;
  /**
   * Optional existing ref to keep populated, for callers that also need the
   * node for something else (e.g. prev/next arrow buttons calling scrollBy).
   */
  forwardTo?: MutableRefObject<T | null>;
}

/**
 * Slowly drifts a horizontally-scrollable element back and forth, to advertise
 * that there is more content off the right edge.
 *
 * Returns a CALLBACK REF, not a RefObject, and that is load-bearing. These
 * strips are rendered as `{loading ? <Skeleton/> : <div ref={...}>}`, so the
 * element does not exist on first paint. With a RefObject, the effect runs once
 * with `.current === null`, bails, and never runs again — the carousel silently
 * never animates. A callback ref re-runs the effect the moment React attaches
 * (or detaches) the node.
 *
 * Usage:
 *   const setStrip = useAutoScroll<HTMLDivElement>({ speed: 30 });
 *   <div ref={setStrip} className="overflow-x-auto flex">…</div>
 *
 * The animation deliberately does NOT run when:
 *
 *   • the content already fits — `maxScroll` is 0, so nothing moves. This is
 *     what makes it a no-op on desktop without needing a media query.
 *   • the element is scrolled out of view — an off-screen carousel would burn
 *     battery, and would have drifted somewhere arbitrary by the time it is
 *     reached.
 *   • the visitor prefers reduced motion (WCAG 2.2.2 covers moving content).
 *   • a finger, cursor, or keyboard focus is inside it — never slide a tap
 *     target out from under someone mid-press.
 *   • something else scrolled it (a prev/next arrow, an anchor jump). Those
 *     controls usually sit OUTSIDE the container, so pointer listeners never
 *     fire; the scroll-position comparison below is what catches them.
 */
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

    // index.css applies `scroll-behavior: smooth` to `*`. Under that rule every
    // per-frame scrollLeft write starts its own animated scroll, and ~60 of them
    // a second fight each other into a visible stutter. Force instant scrolling
    // while drifting and restore whatever was set on cleanup. Explicit
    // scrollTo/scrollBy calls passing `behavior: 'smooth'` (the carousel arrows)
    // are unaffected — the argument wins over the property.
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

      // Track the offset as a float and only ever WRITE scrollLeft. Reading it
      // back every frame would force synchronous layout, and some engines round
      // the returned value — which at these speeds shows up as visible stutter.
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

    /** Resume from wherever the visitor left it, so it never jumps on restart. */
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

    /**
     * Our own writes fire scroll events too, but those land within a pixel of
     * `position`. A larger gap means something external moved it, so yield.
     */
    const onScroll = () => {
      if (Math.abs(el.scrollLeft - position) > 2) nudge();
    };

    // Measure only on resize / content change, never inside the frame loop.
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

    /**
     * Cards are fetched after mount, so the container is empty on first
     * measure. Adding children does not change the container's own border box,
     * so ResizeObserver alone never fires — this is what re-measures once the
     * real content lands, and re-observes the new children so late-loading
     * images are picked up too.
     */
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
