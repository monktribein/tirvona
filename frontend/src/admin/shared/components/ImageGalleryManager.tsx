import React, { useState } from "react";
import {
  Upload,
  Star,
  Trash2,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import api, { getErrorMessage } from "../../../lib/api";
import { useNotifications } from "../../../contexts/NotificationContext";

interface ImageGalleryManagerProps {
  coverImage?: string;
  onCoverImageChange?: (url: string) => void;
  gallery?: string[];
  onGalleryChange?: (urls: string[]) => void;
  label?: string;
}

export const ImageGalleryManager: React.FC<ImageGalleryManagerProps> = ({
  coverImage = "",
  onCoverImageChange,
  gallery = [],
  onGalleryChange,
  label = "Photo & Image Management",
}) => {
  const { addNotification } = useNotifications();
  const [uploading, setUploading] = useState(false);

  // Filter out any broken/non-string entries
  const validCover = typeof coverImage === "string" ? coverImage : "";
  const validGallery = Array.isArray(gallery)
    ? gallery.filter((x) => typeof x === "string" && x.trim().length > 0)
    : [];
  const allImages = Array.from(
    new Set([validCover, ...validGallery].filter(Boolean)),
  );

  const handleFileUpload = async (file: File, replaceIdx?: number) => {
    setUploading(true);
    try {
      // First try to upload via server endpoint POST /api/uploads
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "admin-gallery");

      let uploadedUrl = "";
      try {
        const res = await api.post("/uploads", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (res.data?.success && res.data.data?.url) {
          uploadedUrl = res.data.data.url;
        }
      } catch (apiErr) {
        console.warn("API upload fallback to local FileReader:", apiErr);
      }

      // If server returned data URI or URL, use it; otherwise read as base64 locally
      if (!uploadedUrl) {
        uploadedUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }

      if (uploadedUrl) {
        if (replaceIdx !== undefined && replaceIdx >= 0) {
          handleReplace(replaceIdx, uploadedUrl);
        } else {
          handleAddImage(uploadedUrl);
        }
        addNotification(
          "Photo Uploaded",
          "Selected image loaded from local device memory.",
          "success",
        );
      }
    } catch (err) {
      addNotification(
        "Upload Failed",
        getErrorMessage(err, "Could not load photo from device."),
        "error",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleAddImage = (newUrl: string) => {
    if (!validCover && onCoverImageChange) {
      onCoverImageChange(newUrl);
    }
    const updatedGallery = Array.from(new Set([...validGallery, newUrl]));
    if (onGalleryChange) {
      onGalleryChange(updatedGallery);
    }
  };

  const handleSetCover = (url: string) => {
    if (onCoverImageChange) {
      onCoverImageChange(url);
    }
    addNotification(
      "Cover Image Set",
      "Selected photo set as primary cover image.",
      "info",
    );
  };

  const handleRemove = (url: string) => {
    const updatedGallery = validGallery.filter((x) => x !== url);
    if (url === validCover && onCoverImageChange) {
      onCoverImageChange(updatedGallery[0] || "");
    }
    if (onGalleryChange) {
      onGalleryChange(updatedGallery);
    }
    addNotification("Photo Removed", "Image removed.", "info");
  };

  const handleReplace = (index: number, newUrl: string) => {
    const targetOldUrl = allImages[index];
    const updatedGallery = validGallery.map((x) =>
      x === targetOldUrl ? newUrl : x,
    );
    if (!updatedGallery.includes(newUrl) && targetOldUrl !== validCover) {
      updatedGallery.push(newUrl);
    }

    if (targetOldUrl === validCover && onCoverImageChange) {
      onCoverImageChange(newUrl);
    }
    if (onGalleryChange) {
      onGalleryChange(updatedGallery);
    }
    addNotification(
      "Photo Replaced",
      "Image replaced successfully.",
      "success",
    );
  };

  return (
    <div className="space-y-3 bg-gray-50/70 dark:bg-slate-900/60 p-4 rounded-2xl border border-gray-200/80 dark:border-slate-800 text-left">
      <div className="flex items-center justify-between">
        <label className="font-extrabold text-xs text-[#0B192C] dark:text-white flex items-center gap-2">
          <ImageIcon size={15} className="text-[#0A4DA6]" /> {label}
        </label>
        {allImages.length > 0 && (
          <span className="text-[10px] font-bold text-gray-400">
            {allImages.length} photo{allImages.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Prominent Direct File Upload Box (No URL text input needed) */}
      <label className="w-full py-4 px-6 border-2 border-dashed border-[#0A4DA6]/40 dark:border-blue-500/40 hover:border-[#0A4DA6] bg-blue-50/40 dark:bg-slate-800/40 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-md">
        {uploading ? (
          <div className="flex items-center gap-2 text-[#0A4DA6] font-bold text-xs">
            <Loader2 size={18} className="animate-spin" />
            <span>Reading image file from device memory...</span>
          </div>
        ) : (
          <>
            <div className="p-2.5 bg-[#0A4DA6] text-white rounded-full shadow-md">
              <Upload size={18} />
            </div>
            <div className="text-center space-y-0.5">
              <p className="text-xs font-black text-[#0B192C] dark:text-white">
                Click to Select Photo from Local Memory / Device
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
                Supports JPG, PNG, WEBP, GIF files from your computer or mobile
                phone
              </p>
            </div>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
          className="hidden"
        />
      </label>

      {/* Image Gallery Grid */}
      {allImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
          {allImages.map((imgUrl, idx) => {
            const isCover = imgUrl === validCover;
            return (
              <div
                key={`${imgUrl}_${idx}`}
                className={`relative group h-28 rounded-xl overflow-hidden border ${
                  isCover
                    ? "border-amber-400 ring-2 ring-amber-400/40"
                    : "border-gray-200 dark:border-slate-800"
                } bg-slate-900 shadow-sm transition-all`}
              >
                <img
                  src={imgUrl}
                  alt={`Photo Asset ${idx + 1}`}
                  onError={(e) => {
                    // Fallback to placeholder if image fails to render
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80";
                  }}
                  className="w-full h-full object-cover"
                />

                {/* Cover Badge */}
                {isCover && (
                  <span className="absolute top-1.5 left-1.5 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                    <Star size={10} className="fill-black" /> COVER
                  </span>
                )}

                {/* Action Overlay Controls */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-1.5 p-2">
                  {!isCover && (
                    <button
                      type="button"
                      onClick={() => handleSetCover(imgUrl)}
                      className="w-full py-1 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Star size={11} /> Set Cover
                    </button>
                  )}

                  <label className="w-full py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer">
                    <RefreshCw size={11} /> Replace
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, idx);
                      }}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => handleRemove(imgUrl)}
                    className="w-full py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImageGalleryManager;
