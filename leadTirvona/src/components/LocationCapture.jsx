import React from 'react';
import { Navigation, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { buildGoogleMapsUrl } from '../utils/formatDate';

export default function LocationCapture({ coordinates, onChange }) {
  const { isCapturing, gpsError, captureCurrentLocation } = useGeolocation();
  const handleCapture = () => captureCurrentLocation((c) => onChange(c));
  const mapsUrl = buildGoogleMapsUrl(coordinates.lat, coordinates.lng);

  const inputClass = "w-full min-h-[44px] sm:min-h-[48px] px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]";

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 lg:p-7 shadow-xs">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 sm:pb-6 border-b border-[#E2E8F0] mb-4 sm:mb-6">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A]">GPS Coordinates Capture</h2>
          <p className="text-[11px] sm:text-xs text-[#64748B] font-medium mt-0.5">Auto-capture location or enter coordinates manually</p>
        </div>
        <button
          type="button"
          onClick={handleCapture}
          disabled={isCapturing}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold rounded-full text-xs shadow-sm transition-all disabled:opacity-60 cursor-pointer shrink-0"
        >
          <Navigation size={13} style={{ animation: isCapturing ? 'spin 1s linear infinite' : 'none' }} />
          {isCapturing ? 'Locating...' : 'Capture Location'}
        </button>
      </div>

      {gpsError && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700 mb-4">
          <AlertCircle size={14} className="shrink-0 text-red-500" />
          <span>{gpsError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#64748B] tracking-wider block">Latitude</label>
          <input type="number" step="any" placeholder="e.g. 30.1205"
            className={inputClass}
            value={coordinates.lat || ''}
            onChange={(e) => onChange({ ...coordinates, lat: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#64748B] tracking-wider block">Longitude</label>
          <input type="number" step="any" placeholder="e.g. 78.3135"
            className={inputClass}
            value={coordinates.lng || ''}
            onChange={(e) => onChange({ ...coordinates, lng: e.target.value })} />
        </div>
      </div>

      {coordinates.lat && coordinates.lng && (
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs">
          <span className="flex items-center gap-1.5 text-[#0A4DA6] font-bold">
            <CheckCircle2 size={14} />
            Lat: {coordinates.lat}, Lng: {coordinates.lng}
          </span>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="text-[#0A4DA6] font-extrabold flex items-center gap-1 hover:underline">
              View Map <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
