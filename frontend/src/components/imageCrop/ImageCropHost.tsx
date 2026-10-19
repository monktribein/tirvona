import React, { useEffect, useRef, useState } from "react";
import ImageCropDialog from "./ImageCropDialog";

/**
 * Lets people crop any picture before it is uploaded, everywhere in the app.
 *
 * Mounted once. It listens (capture phase) for `change` on every
 * `<input type="file">` that accepts images, holds the event back, opens the
 * crop dialog for each croppable image, then puts the cropped files back on
 * the input and re-dispatches `change`. The page's own handler therefore runs
 * exactly as before, just with the cropped file. Add `data-no-crop` to an
 * input to opt it out.
 */

const CROPPABLE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
const IMAGE_EXT = /\.(jpe?g|png|webp|bmp)$/i;

const acceptsImages = (accept: string) =>
  !!accept && /image\/|\.(jpe?g|png|webp|bmp|heic|heif|avif|gif)/i.test(accept);

const isCroppable = (file: File) =>
  CROPPABLE_TYPES.includes(file.type) || (!file.type && IMAGE_EXT.test(file.name));

interface Job {
  files: File[];
  resolve: (files: File[] | null) => void;
}

let enqueue: ((job: Job) => void) | null = null;
const redispatched = new WeakSet<Event>();

function onChange(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
  if (redispatched.has(event) || input.hasAttribute("data-no-crop")) return;
  if (!enqueue || !acceptsImages(input.accept)) return;

  const files = Array.from(input.files ?? []);
  if (!files.some(isCroppable)) return;

  event.stopImmediatePropagation();
  new Promise<File[] | null>((resolve) => enqueue?.({ files, resolve })).then((result) => {
    if (!result || !result.length) {
      input.value = "";
      return;
    }
    const transfer = new DataTransfer();
    result.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    const next = new Event("change", { bubbles: true });
    redispatched.add(next);
    input.dispatchEvent(next);
  });
}

export const ImageCropHost: React.FC = () => {
  const [job, setJob] = useState<Job | null>(null);
  const [cursor, setCursor] = useState(0);
  const queue = useRef<Job[]>([]);
  const results = useRef<File[]>([]);
  const active = useRef<Job | null>(null);

  const start = (incoming: Job | null) => {
    active.current = incoming;
    results.current = incoming ? [...incoming.files] : [];
    setCursor(0);
    setJob(incoming);
  };
  const next = () => start(queue.current.shift() ?? null);

  useEffect(() => {
    enqueue = (incoming) => {
      if (active.current) queue.current.push(incoming);
      else start(incoming);
    };
    document.addEventListener("change", onChange, true);
    return () => {
      enqueue = null;
      document.removeEventListener("change", onChange, true);
    };
  }, []);

  if (!job) return null;

  const croppable = job.files
    .map((file, position) => ({ file, position }))
    .filter(({ file }) => isCroppable(file));
  const current = croppable[cursor];

  const advance = () => {
    if (cursor + 1 < croppable.length) {
      setCursor(cursor + 1);
      return;
    }
    job.resolve(results.current);
    next();
  };

  if (!current) return null;

  return (
    <ImageCropDialog
      key={`${current.position}-${current.file.name}-${current.file.size}`}
      file={current.file}
      index={cursor}
      total={croppable.length}
      onApply={(file) => {
        results.current[current.position] = file;
        advance();
      }}
      onSkip={advance}
      onCancel={() => {
        job.resolve(null);
        next();
      }}
    />
  );
};

export default ImageCropHost;
