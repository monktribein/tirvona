
class SmoothScrollEngine {
  private isEnabled = false;
  private currentY = 0;
  private targetY = 0;
  private isRunning = false;
  private animId: number | null = null;
  private lastTime = 0;
  private isTouching = false;
  private ease = 0.085; // Luxurious damping factor

  public init() {
    if (typeof window === "undefined" || this.isEnabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    this.isEnabled = true;
    this.currentY =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      0;
    this.targetY = this.currentY;

    window.addEventListener("wheel", this.handleWheel, { passive: false });
    window.addEventListener("keydown", this.handleKeyDown, { passive: false });
    window.addEventListener("touchstart", this.handleTouchStart, {
      passive: true,
    });
    window.addEventListener("touchend", this.handleTouchEnd, {
      passive: true,
    });
    window.addEventListener("touchcancel", this.handleTouchEnd, {
      passive: true,
    });
    window.addEventListener("scroll", this.handleNativeScroll, {
      passive: true,
    });
    window.addEventListener("resize", this.handleResize, { passive: true });
  }

  private getMaxScroll = (): number => {
    return Math.max(
      0,
      (document.documentElement.scrollHeight || document.body.scrollHeight) -
        window.innerHeight,
    );
  };

  private isScrollableElement = (el: HTMLElement | null): boolean => {
    let current = el;
    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const isScrollableY =
        (overflowY === "auto" || overflowY === "scroll") &&
        current.scrollHeight > current.clientHeight;
      const isScrollableX =
        (overflowX === "auto" || overflowX === "scroll") &&
        current.scrollWidth > current.clientWidth;
      if (isScrollableY || isScrollableX) return true;
      current = current.parentElement;
    }
    return false;
  };

  private isInputFocused = (): boolean => {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      (active as HTMLElement).isContentEditable
    );
  };

  private handleWheel = (e: WheelEvent) => {
    if (!this.isEnabled || this.isTouching) return;

    if (this.isScrollableElement(e.target as HTMLElement)) {
      this.targetY = window.scrollY;
      this.currentY = window.scrollY;
      return;
    }

    if (e.ctrlKey) return;

    let deltaY = e.deltaY;
    if (e.deltaMode === 1) deltaY *= 38;
    else if (e.deltaMode === 2) deltaY *= window.innerHeight;

    e.preventDefault();

    const maxScroll = this.getMaxScroll();
    this.targetY = Math.max(0, Math.min(this.targetY + deltaY, maxScroll));

    if (!this.isRunning) {
      this.lastTime = performance.now();
      this.isRunning = true;
      this.animId = requestAnimationFrame(this.tick);
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isEnabled || this.isInputFocused()) return;

    let delta = 0;
    const step = 90;
    const pageStep = window.innerHeight * 0.85;

    switch (e.key) {
      case "ArrowDown":
        delta = step;
        break;
      case "ArrowUp":
        delta = -step;
        break;
      case "PageDown":
      case " ":
        if (e.shiftKey) delta = -pageStep;
        else delta = pageStep;
        break;
      case "PageUp":
        delta = -pageStep;
        break;
      case "Home":
        delta = -this.targetY;
        break;
      case "End":
        delta = this.getMaxScroll() - this.targetY;
        break;
      default:
        return;
    }

    e.preventDefault();
    const maxScroll = this.getMaxScroll();
    this.targetY = Math.max(0, Math.min(this.targetY + delta, maxScroll));

    if (!this.isRunning) {
      this.lastTime = performance.now();
      this.isRunning = true;
      this.animId = requestAnimationFrame(this.tick);
    }
  };

  private handleTouchStart = () => {
    this.isTouching = true;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.isRunning = false;
    this.currentY = window.scrollY;
    this.targetY = window.scrollY;
  };

  private handleTouchEnd = () => {
    this.isTouching = false;
    this.currentY = window.scrollY;
    this.targetY = window.scrollY;
  };

  private handleNativeScroll = () => {
    if (!this.isRunning) {
      this.currentY = window.scrollY;
      this.targetY = window.scrollY;
    }
  };

  private handleResize = () => {
    const maxScroll = this.getMaxScroll();
    this.targetY = Math.min(this.targetY, maxScroll);
    this.currentY = Math.min(this.currentY, maxScroll);
  };

  private tick = (now: number) => {
    if (!this.isEnabled || this.isTouching) {
      this.isRunning = false;
      return;
    }

    const maxScroll = this.getMaxScroll();
    this.targetY = Math.max(0, Math.min(this.targetY, maxScroll));

    const diff = this.targetY - this.currentY;
    const dt = Math.min((now - (this.lastTime || now)) / 1000, 0.05);
    this.lastTime = now;

    const factor = 1 - Math.pow(1 - this.ease, Math.max(1, dt * 60));
    this.currentY += diff * factor;

    if (Math.abs(diff) < 0.5) {
      this.currentY = this.targetY;
      window.scrollTo(0, this.currentY);
      this.isRunning = false;
      return;
    }

    window.scrollTo(0, this.currentY);
    this.animId = requestAnimationFrame(this.tick);
  };

  public scrollTo(targetY: number) {
    const maxScroll = this.getMaxScroll();
    this.targetY = Math.max(0, Math.min(targetY, maxScroll));
    if (!this.isRunning) {
      this.lastTime = performance.now();
      this.isRunning = true;
      this.animId = requestAnimationFrame(this.tick);
    }
  }

  public destroy() {
    this.isEnabled = false;
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    window.removeEventListener("wheel", this.handleWheel);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("touchstart", this.handleTouchStart);
    window.removeEventListener("touchend", this.handleTouchEnd);
    window.removeEventListener("touchcancel", this.handleTouchEnd);
    window.removeEventListener("scroll", this.handleNativeScroll);
    window.removeEventListener("resize", this.handleResize);
  }
}

export const smoothScrollEngine = new SmoothScrollEngine();
