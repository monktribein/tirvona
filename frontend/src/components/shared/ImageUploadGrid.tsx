import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadService } from "../../services";
import { getErrorMessage } from "../../lib/api";

/**
 * Multi-image picker used by both the visitor article form and the Super Admin
 * edit modal, so the two stay in step. Holds no state of its own beyond the
 * in-flight upload — the URL list belongs to the parent form.
 */
export const ImageUploadGrid: React.FC<{
  value: string[];
  onChange: (next: string[]) => void;
  folder?: string;
  max?: number;
  /** Bytes. Mirrors the server's per-type ceiling for images. */
  maxBytes?: number;
  onError?: (title: string, message: string) => void;
}> = ({
  value,
  onChange,
  folder = "uploads",
  max = 8,
  maxBytes = 10 * 1024 * 1024,
  onError,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const report = (title: string, message: string) =>
    onError ? onError(title, message) : console.warn(`${title}: ${message}`);

  const handleFiles = async (files: FileList) => {
    const room = max - value.length;
    if (room <= 0) {
      report("Gallery Full", `You can add up to ${max} photos.`);
      return;
    }
    // Anything past the limit is dropped rather than silently replacing an
    // earlier pick, and the user is told which files did not make it.
    const picked = Array.from(files).slice(0, room);
    if (files.length > room)
      report(
        "Some Photos Skipped",
        `Only ${room} more photo${room === 1 ? "" : "s"} could be added.`,
      );

    const tooBig = picked.filter((file) => file.size > maxBytes);
    const valid = picked.filter((file) => file.size <= maxBytes);
    if (tooBig.length)
      report(
        "Photo Too Large",
        `${tooBig.length} photo${tooBig.length === 1 ? "" : "s"} over ${maxBytes / 1024 / 1024} MB ${tooBig.length === 1 ? "was" : "were"} skipped.`,
      );
    if (!valid.length) return;

    setUploading(true);
    try {
      // Settled, not all: one bad file must not discard the ones that worked.
      const results = await Promise.allSettled(
        valid.map((file) => uploadService.file(file, folder)),
      );
      const uploaded = results
        .filter(
          (r): r is PromiseFulfilledResult<string> => r.status === "fulfilled",
        )
        .map((r) => r.value);
      const failed = results.length - uploaded.length;
      if (uploaded.length) onChange([...value, ...uploaded]);
      if (failed)
        report(
          "Some Uploads Failed",
          `${failed} photo${failed === 1 ? "" : "s"} could not be uploaded.`,
        );
    } catch (err) {
      report("Upload Failed", getErrorMessage(err, "Could not upload photos."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files);
        }}
      />

      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 group"
            >
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                aria-label={`Remove photo ${index + 1}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || value.length >= max}
        className="w-full py-4 rounded-2xl border-2 border-dashed border-[#0A4DA6]/35 bg-blue-50/40 dark:bg-slate-900 text-[#0A4DA6] flex flex-col items-center justify-center gap-1 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <ImagePlus size={18} />
        )}
        <span className="text-xs font-extrabold">
          {uploading
            ? "Uploading photos…"
            : value.length >= max
              ? `Gallery full (${max} photos)`
              : "Add photos from your device"}
        </span>
        <span className="text-[10px] text-gray-400 font-semibold">
          {value.length}/{max} added · select several at once
        </span>
      </button>
    </div>
  );
};

export default ImageUploadGrid;
