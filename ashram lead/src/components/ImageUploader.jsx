/**
 * ImageUploader.jsx — Mobile & Tablet Responsive Photo Attachment Dropzone
 */
import React from 'react';
import { Upload, X } from 'lucide-react';

export default function ImageUploader({ images = [], onChange }) {
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newImages = [];
    let processed = 0;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newImages.push(event.target.result);
        processed++;
        if (processed === files.length) {
          onChange([...images, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 lg:p-7 shadow-xs">
      
      {/* Section Header (Blue Icon Container Removed) */}
      <div className="flex items-center justify-between pb-4 sm:pb-6 border-b border-[#E2E8F0] mb-4 sm:mb-6">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A]">Ashram Photos Attachment</h2>
          <p className="text-[11px] sm:text-xs text-[#64748B] font-medium mt-0.5">Upload property entrance, rooms, or trustee documents</p>
        </div>
        <span className="text-xs font-bold text-[#64748B] bg-[#F8FAFC] px-3 py-1 rounded-full border border-[#E2E8F0]">
          {images.length} file(s)
        </span>
      </div>

      {/* Upload Dropzone */}
      <div
        className="flex flex-col items-center justify-center p-6 sm:p-8 border-2 border-dashed border-[#E2E8F0] rounded-xl cursor-pointer hover:border-[#0A4DA6] hover:bg-[#0A4DA6]/5 transition-all text-center mb-4"
        onClick={() => document.getElementById('photo-file-input')?.click()}
      >
        <Upload size={24} className="text-[#0A4DA6] mb-2" />
        <p className="text-xs sm:text-sm font-extrabold text-[#0F172A]">Click or Tap to Upload Photos</p>
        <p className="text-[11px] text-[#64748B] font-medium mt-1">Supports JPG, PNG, WEBP files up to 10MB</p>
        <input
          id="photo-file-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Uploaded Images Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {images.map((src, idx) => (
            <div key={idx} className="relative group rounded-xl overflow-hidden border border-[#E2E8F0] aspect-square bg-[#F8FAFC]">
              <img src={src} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-transform shadow-sm cursor-pointer"
                title="Remove image"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
