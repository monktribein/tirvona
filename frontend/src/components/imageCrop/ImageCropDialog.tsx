import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Drag =
  | { kind: "move"; startX: number; startY: number; rect: Rect }
  | { kind: "resize"; handle: Handle; startX: number; startY: number; rect: Rect };

interface AspectOption {
  key: string;
  label: string;
  /** width / height; undefined = free selection */
  ratio?: number;
}

const MIN = 24;
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURSORS: Record<Handle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Largest `ratio` rectangle that fits inside `box`, centred on it. */
function fitRatio(box: Rect, ratio: number, bounds: { W: number; H: number }): Rect {
  let w = box.w;
  let h = w / ratio;
  if (h > box.h) {
    h = box.h;
    w = h * ratio;
  }
  w = Math.max(MIN, w);
  h = Math.max(MIN, h);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return {
    x: clamp(cx - w / 2, 0, bounds.W - w),
    y: clamp(cy - h / 2, 0, bounds.H - h),
    w,
    h,
  };
}

function resizeRect(
  start: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  W: number,
  H: number,
  ratio?: number,
): Rect {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;

  if (handle.includes("w")) left = clamp(left + dx, 0, right - MIN);
  if (handle.includes("e")) right = clamp(right + dx, left + MIN, W);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - MIN);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + MIN, H);

  if (!ratio) return { x: left, y: top, w: right - left, h: bottom - top };

  const horizontal = handle.includes("e") || handle.includes("w");
  const vertical = handle.includes("n") || handle.includes("s");
  const anchorX = handle.includes("w") ? right : handle.includes("e") ? left : (left + right) / 2;
  const anchorY = handle.includes("n") ? bottom : handle.includes("s") ? top : (top + bottom) / 2;

  let w: number;
  let h: number;
  if (horizontal) {
    w = right - left;
    h = w / ratio;
  } else {
    h = bottom - top;
    w = h * ratio;
  }

  const maxW = handle.includes("w")
    ? anchorX
    : handle.includes("e")
      ? W - anchorX
      : 2 * Math.min(anchorX, W - anchorX);
  const maxH = handle.includes("n")
    ? anchorY
    : handle.includes("s")
      ? H - anchorY
      : 2 * Math.min(anchorY, H - anchorY);
  const scale = Math.min(1, maxW / w, maxH / h);
  w = Math.max(MIN, w * scale);
  h = Math.max(MIN, h * scale);

  const x = handle.includes("w") ? anchorX - w : handle.includes("e") ? anchorX : anchorX - w / 2;
  const y = handle.includes("n") ? anchorY - h : handle.includes("s") ? anchorY : anchorY - h / 2;
  void vertical;
  return { x, y, w, h };
}

export function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

interface Props {
  file: File;
  index: number;
  total: number;
  onApply: (file: File) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export const ImageCropDialog: React.FC<Props> = ({
  file,
  index,
  total,
  onApply,
  onSkip,
  onCancel,
}) => {
  // Created inside the effect so React StrictMode's mount/unmount/mount cycle
  // cannot revoke a URL the image is still using.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<{ W: number; H: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [aspectKey, setAspectKey] = useState("free");
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<Drag | null>(null);

  const aspects: AspectOption[] = useMemo(
    () => [
      { key: "free", label: "Free" },
      ...(natural
        ? [{ key: "original", label: "Original", ratio: natural.w / natural.h }]
        : []),
      { key: "1:1", label: "1:1", ratio: 1 },
      { key: "4:3", label: "4:3", ratio: 4 / 3 },
      { key: "3:2", label: "3:2", ratio: 3 / 2 },
      { key: "16:9", label: "16:9", ratio: 16 / 9 },
      { key: "3:4", label: "3:4", ratio: 3 / 4 },
    ],
    [natural],
  );
  const ratio = aspects.find((a) => a.key === aspectKey)?.ratio;

  const viewRef = useRef<{ W: number; H: number } | null>(null);
  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.clientWidth) return;
    const next = { W: img.clientWidth, H: img.clientHeight };
    const prev = viewRef.current;
    if (prev && prev.W === next.W && prev.H === next.H) return;
    viewRef.current = next;
    setView(next);
    // keep the selection proportional when the stage is resized
    if (prev) {
      setRect((r) =>
        r
          ? {
              x: (r.x / prev.W) * next.W,
              y: (r.y / prev.H) * next.H,
              w: (r.w / prev.W) * next.W,
              h: (r.h / prev.H) * next.H,
            }
          : r,
      );
    }
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // initial selection: the whole picture
  useEffect(() => {
    if (view && !rect) setRect({ x: 0, y: 0, w: view.W, h: view.H });
  }, [view, rect]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const chooseAspect = (option: AspectOption) => {
    setAspectKey(option.key);
    if (!option.ratio || !view || !rect) return;
    setRect(fitRatio(rect, option.ratio, view));
  };

  const startDrag = (event: React.PointerEvent, drag: { kind: "move" } | { kind: "resize"; handle: Handle }) => {
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragRef.current = { ...drag, startX: event.clientX, startY: event.clientY, rect } as Drag;
  };

  const onMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !view) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.kind === "move") {
      setRect({
        ...drag.rect,
        x: clamp(drag.rect.x + dx, 0, view.W - drag.rect.w),
        y: clamp(drag.rect.y + dy, 0, view.H - drag.rect.h),
      });
    } else {
      setRect(resizeRect(drag.rect, drag.handle, dx, dy, view.W, view.H, ratio));
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const outputSize = useMemo(() => {
    if (!rect || !view || !natural) return null;
    return {
      w: Math.round((rect.w / view.W) * natural.w),
      h: Math.round((rect.h / view.H) * natural.h),
    };
  }, [rect, view, natural]);

  const apply = async () => {
    const img = imgRef.current;
    if (!img || !rect || !view || !natural || !outputSize) return;
    const coversAll =
      rect.w >= view.W - 1 && rect.h >= view.H - 1 && rect.x <= 1 && rect.y <= 1;
    if (coversAll) {
      onApply(file);
      return;
    }
    setBusy(true);
    try {
      const sx = (rect.x / view.W) * natural.w;
      const sy = (rect.y / view.H) * natural.h;
      const sw = (rect.w / view.W) * natural.w;
      const sh = (rect.h / view.H) * natural.h;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const type = ["image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg";
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, 0.92),
      );
      if (!blob) throw new Error("Could not encode image");
      const base = file.name.replace(/\.[^.]+$/, "") || "image";
      onApply(new File([blob], `${base}.${extensionFor(type)}`, { type, lastModified: Date.now() }));
    } catch {
      onApply(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-[#0B192C]/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      data-tv-crop-dialog
    >
      <div className="flex max-h-full w-full max-w-4xl flex-col border border-gray-200 bg-white text-left text-[#0B192C] shadow-2xl dark:border-slate-700 dark:bg-[#0B192C] dark:text-white">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h3 className="text-base font-semibold">Crop image</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Drag the box to move it, pull the handles to resize. Only the selected part is uploaded.
              {total > 1 && ` · Image ${index + 1} of ${total}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="px-2 py-1 text-lg leading-none text-gray-500 hover:text-[#0B192C] dark:hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 px-5 py-3 dark:border-slate-700">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Shape
          </span>
          {aspects.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => chooseAspect(option)}
              className={`min-w-12 border px-3 py-1.5 text-xs font-semibold transition-colors ${
                aspectKey === option.key
                  ? "border-[#F28C28] bg-[#F28C28] text-white"
                  : "border-gray-300 text-[#0B192C] hover:border-[#F28C28] dark:border-slate-600 dark:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
          {outputSize && (
            <span className="ml-auto text-xs font-medium text-gray-500 dark:text-gray-400">
              {outputSize.w} × {outputSize.h} px
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#0B192C]/5 p-4 dark:bg-black/30">
          <div className="relative inline-block max-w-full select-none" style={{ touchAction: "none" }}>
            <img
              ref={imgRef}
              src={url ?? undefined}
              alt="Image to crop"
              draggable={false}
              onLoad={(event) => {
                const img = event.currentTarget;
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
                measure();
              }}
              onError={onSkip}
              className="block max-h-[56vh] max-w-full object-contain"
            />
            {rect && (
              <div
                className="absolute cursor-move border border-white"
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                  boxShadow: "0 0 0 9999px rgba(11,25,44,0.58)",
                  outline: "1px solid rgba(242,140,40,0.9)",
                }}
                onPointerDown={(event) => startDrag(event, { kind: "move" })}
                onPointerMove={onMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-white/25" />
                  ))}
                </div>
                {HANDLES.map((handle) => {
                  const vertical = handle.includes("n") ? "top" : handle.includes("s") ? "bottom" : "middle";
                  const horizontal = handle.includes("w") ? "left" : handle.includes("e") ? "right" : "center";
                  return (
                    <span
                      key={handle}
                      onPointerDown={(event) => startDrag(event, { kind: "resize", handle })}
                      onPointerMove={onMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      className="absolute z-10 h-3.5 w-3.5 border border-[#F28C28] bg-white"
                      style={{
                        cursor: CURSORS[handle],
                        left: horizontal === "left" ? -7 : horizontal === "right" ? undefined : "calc(50% - 7px)",
                        right: horizontal === "right" ? -7 : undefined,
                        top: vertical === "top" ? -7 : vertical === "bottom" ? undefined : "calc(50% - 7px)",
                        bottom: vertical === "bottom" ? -7 : undefined,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-3.5 dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            className="border border-gray-300 px-4 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="border border-gray-300 px-4 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Use full image
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy || !rect}
            className="bg-[#F28C28] px-5 py-2 text-xs font-semibold text-white hover:bg-[#B45309] disabled:opacity-50"
          >
            {busy ? "Cropping…" : total > 1 && index + 1 < total ? "Crop & next" : "Crop & upload"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropDialog;
