import React, { useEffect, useRef, useState } from "react";
import { Music, Play, Upload, Volume2, X } from "lucide-react";
import { platformSettingsService, uploadService } from "../../../services";
import { getErrorMessage } from "../../../lib/api";
import { useNotifications } from "../../../contexts/NotificationContext";
import {
  getNotificationSound,
  loadNotificationSound,
  previewNotificationSound,
  refreshNotificationSound,
  setNotificationSound,
  type NotificationSoundConfig,
} from "../../../lib/notificationSound";

/**
 * Super Admin control for the platform-wide notification tone.
 *
 * One sound, stored in platform settings, played by every dashboard for every
 * role — so this is a platform setting rather than a per-user preference. The
 * upload goes to the same `/uploads` endpoint as every other asset (Cloudinary
 * files audio under its "video" resource type) and only the resulting https
 * URL is persisted.
 */
export const NotificationSoundSettings: React.FC = () => {
  const { addNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<NotificationSoundConfig>(
    getNotificationSound(),
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) void loadNotificationSound().then(setConfig);
  }, [open]);

  const handleFile = async (file: File) => {
    // 5 MB is generous for an alert tone and keeps the dashboard from pulling
    // a multi-megabyte download on every page load.
    if (file.size > 5 * 1024 * 1024) {
      addNotification(
        "File Too Large",
        "Choose a notification sound under 5 MB.",
        "warning",
      );
      return;
    }
    setUploading(true);
    try {
      const url = await uploadService.file(file, "notification-sounds");
      setConfig((prev) => ({
        ...prev,
        url,
        fileName: file.name,
        enabled: true,
      }));
      addNotification(
        "Sound Uploaded",
        `${file.name} is ready. Save to apply it across every dashboard.`,
        "success",
      );
    } catch (err) {
      addNotification(
        "Upload Failed",
        getErrorMessage(err, "Could not upload that sound file."),
        "error",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePreview = async () => {
    if (!config.url) return;
    try {
      await previewNotificationSound(config.url, config.volume);
    } catch {
      addNotification(
        "Cannot Play",
        "Your browser blocked playback. Interact with the page and try again.",
        "warning",
      );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await platformSettingsService.updateSettings({
        notificationSound: {
          enabled: config.enabled,
          url: config.url,
          fileName: config.fileName,
          volume: config.volume,
        },
      });
      // Update this tab immediately, then re-read so what is shown is what the
      // server actually stored.
      setNotificationSound(config);
      await refreshNotificationSound();
      addNotification(
        "Notification Sound Saved",
        config.enabled
          ? "Every dashboard will now play this sound for new notifications."
          : "The notification sound is turned off for all dashboards.",
        "success",
      );
      setOpen(false);
    } catch (err) {
      addNotification(
        "Save Failed",
        getErrorMessage(err, "Could not save the notification sound."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3.5 py-2 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 text-xs font-bold flex items-center gap-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title="Notification sound"
      >
        <Music size={14} /> Notification Sound
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-5 text-left shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                  <Music size={18} className="text-[#0A4DA6]" /> Notification
                  Sound
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold mt-1">
                  Plays on every dashboard, for every role, whenever a
                  notification arrives.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Current file + upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Sound file
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">
                  {config.fileName || (config.url ? "Uploaded sound" : "No sound uploaded yet")}
                </div>
                {config.url && (
                  <button
                    onClick={handlePreview}
                    className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-[#0A4DA6] hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
                    title="Play a preview"
                  >
                    <Play size={14} />
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full py-2.5 rounded-xl border border-dashed border-[#0A4DA6]/40 text-[#0A4DA6] text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-[#EBF2FA] dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Upload size={14} />
                {uploading ? "Uploading…" : "Upload from your computer"}
              </button>
              <p className="text-[10px] text-gray-400 font-semibold">
                MP3, WAV, OGG, M4A, AAC or FLAC · up to 5 MB
              </p>
            </div>

            {/* Volume */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Volume2 size={14} /> Volume ·{" "}
                {Math.round(config.volume * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(config.volume * 100)}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    volume: Number(e.target.value) / 100,
                  }))
                }
                className="w-full accent-[#0A4DA6] cursor-pointer"
              />
            </div>

            {/* Enable toggle */}
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl cursor-pointer">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Play this sound for all notifications
              </span>
              <input
                type="checkbox"
                checked={config.enabled}
                disabled={!config.url}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="accent-[#0A4DA6] w-4 h-4 cursor-pointer"
              />
            </label>
            {!config.url && (
              <p className="text-[10px] text-amber-600 font-bold -mt-2">
                Upload a sound file before turning this on.
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex-1 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full font-extrabold text-xs shadow-md cursor-pointer disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save for all dashboards"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
