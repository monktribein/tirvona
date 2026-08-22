import React, { useEffect, useRef, useState } from "react";
import { UploadCloud, Loader2, CheckCircle, AlertCircle, ExternalLink, FileText } from "lucide-react";
import { uploadService } from "../services";
import { getErrorMessage } from "../lib/api";

interface FileUploaderProps {
  folder: string;
  onUploaded: (url: string) => void;
  accept?: string;
  label?: string;
  currentUrl?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  folder,
  onUploaded,
  accept = "image/*",
  label = "Upload file",
  currentUrl,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    currentUrl ? "done" : "idle",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus((current) =>
      current === "uploading"
        ? current
        : currentUrl
          ? "done"
          : "idle",
    );
  }, [currentUrl]);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setError("");
    try {
      const url = await uploadService.file(file, folder);
      onUploaded(url);
      setStatus("done");
    } catch (err) {
      setError(getErrorMessage(err, "Upload failed"));
      setStatus("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-dashed border-[#0A4DA6]/40 bg-[#0A4DA6]/5 hover:bg-[#0A4DA6]/10 text-[#0A4DA6] rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "uploading" ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Uploading…
          </>
        ) : status === "done" ? (
          <>
            <CheckCircle size={14} className="text-success" /> Uploaded —
            replace
          </>
        ) : (
          <>
            <UploadCloud size={14} /> {label}
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleSelect}
        className="hidden"
      />
      {status === "error" && (
        <p className="text-[10px] text-danger font-semibold flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
      {currentUrl && status !== "uploading" && (
        /\.(jpe?g|png|webp|gif|svg|avif|heic)($|\?)/i.test(currentUrl) ? (
          <a href={currentUrl} target="_blank" rel="noreferrer" className="inline-flex flex-col gap-1 rounded-xl border border-gray-200 p-1.5">
            <img src={currentUrl} alt="Uploaded file" className="h-20 w-28 rounded-lg object-cover" />
            <span className="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-[#0A4DA6]"><ExternalLink size={10} /> Open image</span>
          </a>
        ) : (
          <a href={currentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-[#0A4DA6]">
            <FileText size={12} /> Open document <ExternalLink size={10} />
          </a>
        )
      )}
    </div>
  );
};

export default FileUploader;
