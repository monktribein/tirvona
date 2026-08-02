import React, { useRef, useState } from "react";
import { UploadCloud, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { uploadService } from "../services";
import { getErrorMessage } from "../lib/api";

interface FileUploaderProps {
  folder: string;
  onUploaded: (url: string) => void;
  accept?: string;
  label?: string;
  currentUrl?: string;
}

// Reusable Cloudinary uploader: picks a file, uploads via the API, and reports
// the resulting secure URL to the parent. Falls back to a clear error message
// when uploads are not configured on the server (503).
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
        <p className="text-[10px] text-gray-400 truncate">{currentUrl}</p>
      )}
    </div>
  );
};

export default FileUploader;
