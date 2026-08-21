import React, { useState } from 'react';
import { Upload, X, Loader2, CheckCircle2 } from 'lucide-react';
import { compressMultipleImages } from '../utils/imageCompressor';

export default function ImageUploader({ images = [], onChange }) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState('');

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsOptimizing(true);
    setOptimizationStatus(`Optimizing image (1/${files.length})...`);

    try {
      const optimizedImages = await compressMultipleImages(
        files,
        60000,
        (current, total) => {
          setOptimizationStatus(`Optimizing image (${current}/${total})...`);
        }
      );

      onChange([...images, ...optimizedImages]);
      setOptimizationStatus('Image ready');
      setTimeout(() => setOptimizationStatus(''), 3000);
    } catch (err) {
      console.error('Failed to optimize images:', err);
      alert('Failed to process selected image(s). Please try another file.');
    } finally {
      setIsOptimizing(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeImage = (idx) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 lg:p-7 shadow-xs">
      
      <div className="flex items-center justify-between pb-4 sm:pb-6 border-b border-[#E2E8F0] mb-4 sm:mb-6">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A]">Ashram Photos Attachment</h2>
          <p className="text-[11px] sm:text-xs text-[#64748B] font-medium mt-0.5">Upload property entrance, rooms, or trustee documents</p>
        </div>
        <div className="flex items-center gap-2">
          {isOptimizing && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#0A4DA6] bg-[#0A4DA6]/10 px-3 py-1 rounded-full border border-[#0A4DA6]/20">
              <Loader2 size={12} className="animate-spin text-[#0A4DA6]" />
              {optimizationStatus}
            </span>
          )}
          {!isOptimizing && optimizationStatus === 'Image ready' && (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 size={12} className="text-emerald-600" />
              Image ready
            </span>
          )}
          <span className="text-xs font-bold text-[#64748B] bg-[#F8FAFC] px-3 py-1 rounded-full border border-[#E2E8F0]">
            {images.length} file(s)
          </span>
        </div>
      </div>

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
