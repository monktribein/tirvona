import React, { useState } from 'react';
import { Upload, Star, Trash2, RefreshCw, Link as LinkIcon, Plus, Loader2, Image as ImageIcon } from 'lucide-react';
import api, { getErrorMessage } from '../../../lib/api';
import { useNotifications } from '../../../contexts/NotificationContext';

interface ImageGalleryManagerProps {
  coverImage?: string;
  onCoverImageChange?: (url: string) => void;
  gallery?: string[];
  onGalleryChange?: (urls: string[]) => void;
  label?: string;
}

export const ImageGalleryManager: React.FC<ImageGalleryManagerProps> = ({
  coverImage = '',
  onCoverImageChange,
  gallery = [],
  onGalleryChange,
  label = 'Entity Media & Photo Gallery',
}) => {
  const { addNotification } = useNotifications();
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Combine cover image and gallery images into a unique list for rendering
  const allImages = Array.from(new Set([coverImage, ...gallery].filter(Boolean)));

  const handleFileUpload = async (file: File, replaceIdx?: number) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'admin-gallery');

      const res = await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && res.data.data?.url) {
        const newUrl = res.data.data.url;
        if (replaceIdx !== undefined && replaceIdx >= 0) {
          handleReplace(replaceIdx, newUrl);
        } else {
          handleAddImage(newUrl);
        }
        addNotification('Image Uploaded', 'Photo uploaded and added to gallery.', 'success');
      }
    } catch (err) {
      addNotification('Upload Failed', getErrorMessage(err, 'Could not upload image file.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    handleAddImage(urlInput.trim());
    setUrlInput('');
  };

  const handleAddImage = (newUrl: string) => {
    if (!coverImage && onCoverImageChange) {
      onCoverImageChange(newUrl);
    }
    const updatedGallery = Array.from(new Set([...gallery, newUrl]));
    if (onGalleryChange) {
      onGalleryChange(updatedGallery);
    }
  };

  const handleSetCover = (url: string) => {
    if (onCoverImageChange) {
      onCoverImageChange(url);
    }
    addNotification('Cover Image Set', 'Selected photo set as primary cover image.', 'info');
  };

  const handleRemove = (url: string) => {
    const updatedGallery = gallery.filter((x) => x !== url);
    if (url === coverImage && onCoverImageChange) {
      onCoverImageChange(updatedGallery[0] || '');
    }
    if (onGalleryChange) {
      onGalleryChange(updatedGallery);
    }
    addNotification('Photo Removed', 'Image removed from gallery list.', 'info');
  };

  const handleReplace = (index: number, newUrl: string) => {
    const targetOldUrl = allImages[index];
    const updatedGallery = gallery.map((x) => (x === targetOldUrl ? newUrl : x));
    if (!updatedGallery.includes(newUrl) && targetOldUrl !== coverImage) {
      updatedGallery.push(newUrl);
    }

    if (targetOldUrl === coverImage && onCoverImageChange) {
      onCoverImageChange(newUrl);
    }
    if (onGalleryChange) {
      onGalleryChange(updatedGallery);
    }
    addNotification('Photo Replaced', 'Image successfully replaced.', 'success');
  };

  return (
    <div className="space-y-4 bg-gray-50/70 dark:bg-slate-900/60 p-4 rounded-2xl border border-gray-200/80 dark:border-slate-800 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <label className="font-extrabold text-xs text-[#0B192C] dark:text-white flex items-center gap-2">
          <ImageIcon size={15} className="text-[#0A4DA6]" /> {label}
        </label>

        {/* Upload File Input Button */}
        <label className="px-3.5 py-1.5 bg-[#0A4DA6] hover:bg-blue-900 text-white rounded-full text-[11px] font-black shadow transition-all cursor-pointer inline-flex items-center gap-1.5">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          <span>{uploading ? 'Uploading...' : 'Upload Image File'}</span>
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
      </div>

      {/* Direct Web URL Add Input Form */}
      <form onSubmit={handleAddUrl} className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon size={14} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="url"
            placeholder="Paste Web / Cloudinary Image URL (e.g. https://...)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0A4DA6]"
          />
        </div>
        <button
          type="submit"
          disabled={!urlInput.trim()}
          className="px-4 py-2 bg-gray-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
        >
          <Plus size={14} /> Add URL
        </button>
      </form>

      {/* Image Gallery Grid */}
      {allImages.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-[#0B192C]/50">
          <p className="text-xs font-bold text-gray-400">No media assets uploaded yet.</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Upload a photo file or paste an image link above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {allImages.map((imgUrl, idx) => {
            const isCover = imgUrl === coverImage;
            return (
              <div
                key={`${imgUrl}_${idx}`}
                className={`relative group h-28 rounded-xl overflow-hidden border ${
                  isCover
                    ? 'border-amber-400 ring-2 ring-amber-400/40'
                    : 'border-gray-200 dark:border-slate-800'
                } bg-slate-900 shadow-sm transition-all`}
              >
                <img src={imgUrl} alt={`Gallery Asset ${idx + 1}`} className="w-full h-full object-cover" />

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
