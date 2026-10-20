import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";
import { EnterpriseButton } from "../../admin/shared/components/EnterpriseButton";

const cameraError = (err: unknown): string => {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access is blocked. Allow the camera in your browser's address bar, or upload a photo instead.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No camera was found on this device. Upload a photo instead.";
  if (name === "NotReadableError")
    return "The camera is being used by another app. Close it and try again.";
  return "The camera could not be started. Upload a photo instead.";
};

/**
 * In-page camera for desktops: live preview, take, retake, use. Phones and tablets should
 * use `<input type="file" capture>` instead, which opens the native camera app.
 */
export const CameraCaptureModal: React.FC<{
  /** Receives the photo (a JPEG file) once the person taps "Use photo". */
  onCapture: (file: File) => void;
  onClose: () => void;
}> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const attempt = useRef(0); // only the latest start() may keep its stream
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    const mine = ++attempt.current;
    setError("");
    setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot open the camera on this page (it needs a secure https connection). Upload a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (!alive.current || mine !== attempt.current) {
        // Closed (or restarted) while the permission prompt was open: do not leave the camera on.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      if (alive.current && mine === attempt.current) setError(cameraError(err));
    }
  }, [stop]);

  useEffect(() => {
    alive.current = true;
    void start();
    return () => {
      alive.current = false;
      stop();
    };
  }, [start, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Free the captured frame's object URL once it is replaced or the dialog closes.
  useEffect(() => {
    const url = shot?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [shot]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("The photo could not be taken. Please try again.");
          return;
        }
        stop(); // turn the camera light off while the person checks the shot
        setShot({ file: new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }), url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.9,
    );
  };

  const retake = () => {
    setShot(null);
    void start();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Take a photo">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#0B192C]">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-800">
          <p className="flex items-center gap-2 text-sm font-black text-[#0B192C] dark:text-white">
            <Camera size={15} className="text-[#F28C28]" /> Take a photo
          </p>
          <button type="button" onClick={onClose} aria-label="Close camera" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        <div className="relative flex aspect-video w-full items-center justify-center bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
            className={`h-full w-full object-contain ${shot || error ? "hidden" : ""}`}
          />
          {shot && <img src={shot.url} alt="The photo you just took" className="h-full w-full object-contain" />}
          {error && <p className="px-8 text-center text-sm font-semibold text-white/90">{error}</p>}
          {!shot && !error && !ready && <Loader2 size={22} className="absolute animate-spin text-white/80" />}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          {shot ? (
            <>
              <EnterpriseButton type="button" variant="outline" size="sm" icon={<RefreshCw size={13} />} onClick={retake}>
                Retake
              </EnterpriseButton>
              <EnterpriseButton type="button" size="sm" onClick={() => onCapture(shot.file)}>
                Use photo
              </EnterpriseButton>
            </>
          ) : (
            <>
              <EnterpriseButton type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton type="button" size="sm" icon={<Camera size={13} />} onClick={capture} disabled={!ready || Boolean(error)}>
                Take photo
              </EnterpriseButton>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CameraCaptureModal;
