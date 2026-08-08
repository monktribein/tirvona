/**
 * CreateLeadPage.jsx — Clean Clean Design without Decorative Icons on Section Headers & Labels
 */
import React, { useState, useEffect, useRef } from 'react';
import { Send, Calendar, Navigation, ExternalLink, CheckCircle2, AlertCircle, Upload, X, Mic, MicOff } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { buildGoogleMapsUrl } from '../utils/formatDate';

export default function CreateLeadPage({ onSubmitLead, onSuccessNavigate }) {
  const [currentDateTime, setCurrentDateTime] = useState('');
  const { isCapturing, gpsError, captureCurrentLocation } = useGeolocation();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '', address: '', city: '', state: '',
    totalRooms: '', roomPrice: '', onlineRooms: '', offlineRooms: '',
    ownerName: '', phone: '', notes: '',
    interest: 'Interested',
    meetingRequested: true, meetingTime: '', meetingMode: 'Call',
    coordinates: { lat: '', lng: '' }, images: []
  });

  useEffect(() => {
    const update = () => {
      setCurrentDateTime(new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleInterestSelect = (interestVal) => {
    setFormData(prev => ({
      ...prev,
      interest: interestVal,
      meetingRequested: (interestVal === 'Interested' || interestVal === 'Follow-up Required') ? true : prev.meetingRequested
    }));
  };

  // Speech-to-Text Voice Dictation Handler using Web Speech API
  const toggleVoiceDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition API is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          }
        }
        if (finalTranscript) {
          setFormData(prev => ({
            ...prev,
            notes: (prev.notes ? prev.notes + ' ' : '') + finalTranscript
          }));
        }
      };

      recognition.onerror = (err) => {
        console.error('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
      setIsListening(false);
    }
  };

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
          handleChange('images', [...formData.images, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx) => {
    handleChange('images', formData.images.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Please enter Stay Name');
    if (!formData.city.trim()) return alert('Please enter City');

    onSubmitLead({
      name: formData.name.trim(),
      location: {
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim() || 'Uttarakhand',
        coordinates: {
          lat: formData.coordinates.lat ? parseFloat(formData.coordinates.lat) : null,
          lng: formData.coordinates.lng ? parseFloat(formData.coordinates.lng) : null
        }
      },
      roomInventory: {
        totalRooms: formData.totalRooms,
        roomPrice: formData.roomPrice,
        onlineRooms: formData.onlineRooms,
        offlineRooms: formData.offlineRooms
      },
      contact: { phone: formData.phone.trim(), ownerName: formData.ownerName.trim() },
      notes: formData.notes.trim(),
      interest: formData.interest,
      meeting: {
        requested: formData.meetingRequested,
        time: formData.meetingRequested ? formData.meetingTime : '',
        mode: formData.meetingRequested ? formData.meetingMode : ''
      },
      images: formData.images,
      status: 'pending'
    });

    setFormData({ name: '', address: '', city: '', state: '',
      totalRooms: '', roomPrice: '', onlineRooms: '', offlineRooms: '',
      ownerName: '', phone: '', notes: '',
      interest: 'Interested', meetingRequested: true, meetingTime: '', meetingMode: 'Call',
      coordinates: { lat: '', lng: '' }, images: [] });
    onSuccessNavigate();
  };

  const inputClass = "w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]";
  const labelClass = "text-xs font-bold text-[#64748B] tracking-wider block mb-1.5";
  const mapsUrl = buildGoogleMapsUrl(formData.coordinates.lat, formData.coordinates.lng);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 text-left space-y-4 sm:space-y-6">
      
      {/* Form Container */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xs">
        
        {/* Header Title (Icon Removed) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 sm:pb-6 border-b border-[#E2E8F0] mb-5 sm:mb-6">
          <div>
            <h1 className="text-base sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
              Ashram Onboarding Form
            </h1>
            <p className="text-[11px] sm:text-xs text-[#64748B] font-medium mt-0.5">
              Field Verification &amp; Contact Registration
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 shrink-0 self-start sm:self-auto shadow-2xs">
            <Calendar size={13} className="text-[#0A4DA6] shrink-0" />
            <div>
              <span className="text-[9px] font-bold tracking-wider text-[#64748B] uppercase block">Timestamp</span>
              <span className="text-[11px] sm:text-xs font-bold text-[#0F172A]">{currentDateTime}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          
          {/* SECTION 1: GPS Location Capture (Icon Removed) */}
          <div className="space-y-3 pb-5 border-b border-[#E2E8F0]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                1. GPS Location
              </span>
              <button
                type="button"
                onClick={() => captureCurrentLocation((c) => handleChange('coordinates', c))}
                disabled={isCapturing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold rounded-full text-[11px] sm:text-xs shadow-xs transition-all disabled:opacity-60 cursor-pointer"
              >
                <Navigation size={12} style={{ animation: isCapturing ? 'spin 1s linear infinite' : 'none' }} />
                {isCapturing ? 'Locating...' : 'Capture GPS'}
              </button>
            </div>

            {gpsError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-[11px] font-medium text-red-700">
                <AlertCircle size={13} className="shrink-0 text-red-500" />
                <span>{gpsError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] block mb-1">Latitude</label>
                <input type="number" step="any" placeholder="e.g. 30.1205" className={inputClass}
                  value={formData.coordinates.lat || ''}
                  onChange={(e) => handleChange('coordinates', { ...formData.coordinates, lat: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] block mb-1">Longitude</label>
                <input type="number" step="any" placeholder="e.g. 78.3135" className={inputClass}
                  value={formData.coordinates.lng || ''}
                  onChange={(e) => handleChange('coordinates', { ...formData.coordinates, lng: e.target.value })} />
              </div>
            </div>

            {formData.coordinates.lat && formData.coordinates.lng && (
              <div className="flex items-center justify-between px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[11px]">
                <span className="flex items-center gap-1.5 text-[#0A4DA6] font-bold">
                  <CheckCircle2 size={13} />
                  {formData.coordinates.lat}, {formData.coordinates.lng}
                </span>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[#0A4DA6] font-extrabold flex items-center gap-0.5 hover:underline">
                    View Map <ExternalLink size={10} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: Ashram Details (Icon Removed) */}
          <div className="space-y-3.5 pb-5 border-b border-[#E2E8F0]">
            <span className="text-xs sm:text-sm font-extrabold text-[#0F172A] block">
              2. Ashram Details &amp; Room Inventory
            </span>

            {/* Basic Property Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Stay Name <span className="text-[#EF4444]">*</span></label>
                <input type="text" required placeholder="e.g. Parmarth Niketan Ashram"
                  className={inputClass} value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Address</label>
                <input type="text" placeholder="e.g. Main Road, Swargashram"
                  className={inputClass} value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>City <span className="text-[#EF4444]">*</span></label>
                <input type="text" required placeholder="e.g. Rishikesh"
                  className={inputClass} value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <input type="text" placeholder="e.g. Uttarakhand"
                  className={inputClass} value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)} />
              </div>
            </div>

            {/* Room Capacity & Pricing Sub-Block (Icons Removed) */}
            <div className="pt-2">
              <span className="text-[11px] font-extrabold text-[#64748B] uppercase tracking-wider block mb-2.5">
                Room Capacity, Pricing &amp; Allotment
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">
                    Total Rooms
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    className={inputClass}
                    value={formData.totalRooms}
                    onChange={(e) => handleChange('totalRooms', e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">
                    Price / Night (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1200"
                    className={inputClass}
                    value={formData.roomPrice}
                    onChange={(e) => handleChange('roomPrice', e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">
                    Online Rooms
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 30"
                    className={inputClass}
                    value={formData.onlineRooms}
                    onChange={(e) => handleChange('onlineRooms', e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">
                    Offline Rooms
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 20"
                    className={inputClass}
                    value={formData.offlineRooms}
                    onChange={(e) => handleChange('offlineRooms', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Contact Person Details (Icon Removed) */}
          <div className="space-y-3 pb-5 border-b border-[#E2E8F0]">
            <span className="text-xs sm:text-sm font-extrabold text-[#0F172A] block">
              3. Contact Person
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Contact Person Name</label>
                <input type="text" placeholder="e.g. Swami Chidanand Saraswati"
                  className={inputClass} value={formData.ownerName}
                  onChange={(e) => handleChange('ownerName', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Contact Number</label>
                <input type="text" placeholder="e.g. +91 98765 43210"
                  className={inputClass} value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)} />
              </div>
            </div>
          </div>

          {/* SECTION 4: Discussion Notes (Icon Removed) */}
          <div className="space-y-2 pb-5 border-b border-[#E2E8F0]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-[#0F172A] block">
                4. Discussion Notes
              </span>

              {/* Speech-to-Text Voice Dictation Mic Button */}
              <button
                type="button"
                onClick={toggleVoiceDictation}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer border ${
                  isListening
                    ? 'bg-red-500 text-white border-red-500 animate-pulse'
                    : 'bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/30 hover:bg-[#0A4DA6]/20'
                }`}
                title={isListening ? 'Click to stop voice recording' : 'Click to speak and dictate notes'}
              >
                {isListening ? (
                  <>
                    <MicOff size={13} />
                    <span>Listening...</span>
                  </>
                ) : (
                  <>
                    <Mic size={13} />
                    <span>Speech to Text</span>
                  </>
                )}
              </button>
            </div>

            <textarea rows={3}
              placeholder={isListening ? "Listening to your voice... Speak now!" : "Type notes or click Speech to Text to dictate..."}
              className={`w-full px-3.5 py-2.5 bg-[#F8FAFC] border rounded-xl text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8] min-h-[80px] ${
                isListening ? 'border-red-400 bg-red-50/20' : 'border-[#E2E8F0]'
              }`}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>

          {/* SECTION 5: Interest Level (Icon Removed) */}
          <div className="space-y-3 pb-5 border-b border-[#E2E8F0]">
            <span className="text-xs sm:text-sm font-extrabold text-[#0F172A] block">
              5. Owner Interest Level
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'Interested', label: 'Interested', desc: 'Wants to join Tirvona' },
                { id: 'Not Interested', label: 'Not Interested', desc: 'Declined current onboarding' },
                { id: 'Follow-up Required', label: 'Follow-up Required', desc: 'Needs proposal discussion' },
              ].map((item) => (
                <label
                  key={item.id}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-0.5 ${
                    formData.interest === item.id
                      ? 'border-[#0A4DA6] bg-[#0A4DA6]/5 shadow-xs'
                      : 'border-[#E2E8F0] bg-[#F8FAFC]/50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-[#0F172A]">{item.label}</span>
                    <input type="radio" name="interest" value={item.id}
                      checked={formData.interest === item.id}
                      onChange={() => handleInterestSelect(item.id)}
                      className="accent-[#0A4DA6] w-4 h-4 cursor-pointer" />
                  </div>
                  <span className="text-[10px] text-[#64748B] font-medium">{item.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* SECTION 6: Meeting Request (Icon Removed) */}
          <div className="space-y-3 pb-5 border-b border-[#E2E8F0]">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => handleChange('meetingRequested', !formData.meetingRequested)}
                className={`w-10 h-5.5 rounded-full transition-all relative flex-shrink-0 ${
                  formData.meetingRequested ? 'bg-[#0A4DA6]' : 'bg-gray-200'
                }`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-1 transition-all ${
                  formData.meetingRequested ? 'left-5.5' : 'left-1'
                }`} />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                  Request Tirvona team meeting
                </span>
              </div>
            </label>

            {formData.meetingRequested && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className={labelClass}>Preferred Date &amp; Time</label>
                  <input type="datetime-local" className={inputClass}
                    value={formData.meetingTime}
                    onChange={(e) => handleChange('meetingTime', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Meeting Mode</label>
                  <select className={inputClass} value={formData.meetingMode}
                    onChange={(e) => handleChange('meetingMode', e.target.value)}>
                    <option value="Call">Phone / WhatsApp Call</option>
                    <option value="In-person">In-person Ashram Visit</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 7: Image Upload (Icon Removed) */}
          <div className="space-y-3 pb-2">
            <span className="text-xs sm:text-sm font-extrabold text-[#0F172A] flex items-center justify-between gap-1.5">
              <span>7. Ashram Photos</span>
              <span className="text-xs font-bold text-[#64748B]">{formData.images.length} photo(s)</span>
            </span>

            <div
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#E2E8F0] rounded-xl cursor-pointer hover:border-[#0A4DA6] hover:bg-[#0A4DA6]/5 transition-all text-center"
              onClick={() => document.getElementById('mobile-file-input')?.click()}
            >
              <Upload size={20} className="text-[#0A4DA6] mb-1" />
              <p className="text-xs font-extrabold text-[#0F172A]">Click to upload photos</p>
              <p className="text-[10px] text-[#64748B]">JPG, PNG, WEBP supported</p>
              <input id="mobile-file-input" type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
            </div>

            {formData.images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                {formData.images.map((src, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-[#E2E8F0] aspect-square bg-[#F8FAFC]">
                    <img src={src} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 px-8 min-h-[46px] bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold rounded-full text-xs sm:text-sm shadow-sm transition-all cursor-pointer">
              <Send size={16} />
              Submit Lead Entry
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
