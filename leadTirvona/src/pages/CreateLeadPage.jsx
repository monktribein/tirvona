/**
 * CreateLeadPage.jsx — Clean Clean Design without Decorative Icons on Section Headers & Labels
 */
import React, { useState, useEffect, useRef } from 'react';
import { Send, Calendar, Camera, CheckCircle2, Upload, X, Mic, MicOff, Loader2, FileText } from 'lucide-react';
import { leadApi } from '../services/leadApi';

const DRAFT_STORAGE_KEY = 'tirvona_create_lead_draft';

const INITIAL_FORM = {
  name: '', address: '', googleMapsUrl: '', city: '', state: '', district: '',
  assignedAgentId: '', assignedAgentName: '', assignedAgentCode: '',
  totalRooms: '', roomPrice: '', onlineRooms: '', offlineRooms: '',
  ownerName: '', phone: '', notes: '', agentNotes: '',
  interest: 'Interested',
  meetingRequested: true, meetingTime: '', meetingMode: 'Call',
  coordinates: { lat: '', lng: '' }, images: []
};

export default function CreateLeadPage({
  agentRole = null,
  onSubmitLead,
  onSuccessNavigate,
  attendanceCoordinates,
  assignedJurisdiction,
  editingLead = null,
  onBackToConsole = null
}) {
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isListeningAgentNotes, setIsListeningAgentNotes] = useState(false);
  const recognitionRef = useRef(null);
  const agentNotesRecognitionRef = useRef(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // Restore draft from localStorage if available (not for field agents — they
  // only ever edit an existing lead via the dashboard, never create from scratch).
  const [formData, setFormData] = useState(() => {
    if (editingLead) {
      return {
        name: editingLead.name || '',
        address: editingLead.location?.address || editingLead.address || '',
        googleMapsUrl: editingLead.location?.googleMapsUrl || editingLead.googleMapsUrl || '',
        city: editingLead.location?.city || editingLead.city || '',
        state: editingLead.location?.state || editingLead.state || assignedJurisdiction?.state || '',
        district: editingLead.location?.district || editingLead.district || assignedJurisdiction?.district || '',
        assignedAgentId: editingLead.assignedAgentId || '',
        assignedAgentName: editingLead.assignedAgentName || '',
        assignedAgentCode: editingLead.assignedAgentCode || '',
        totalRooms: editingLead.roomInventory?.totalRooms ?? editingLead.totalRooms ?? '',
        roomPrice: editingLead.roomInventory?.roomPrice ?? editingLead.roomPrice ?? '',
        onlineRooms: editingLead.roomInventory?.onlineRooms ?? editingLead.onlineRooms ?? '',
        offlineRooms: editingLead.roomInventory?.offlineRooms ?? editingLead.offlineRooms ?? '',
        ownerName: editingLead.contact?.ownerName || editingLead.ownerName || '',
        phone: editingLead.contact?.phone || editingLead.phone || '',
        notes: editingLead.notes || '',
        agentNotes: editingLead.agentNotes || '',
        interest: editingLead.interest || 'Interested',
        meetingRequested: editingLead.meeting?.requested ?? true,
        meetingTime: editingLead.meeting?.time || '',
        meetingMode: editingLead.meeting?.mode || 'Call',
        coordinates: editingLead.location?.coordinates || { lat: '', lng: '' },
        images: Array.isArray(editingLead.images) ? editingLead.images : []
      };
    }
    // Field agents should never see a stale draft — skip restoration.
    if (agentRole === 'field_agent') return INITIAL_FORM;
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        return {
          ...INITIAL_FORM,
          ...draft,
          // GPS never comes from a saved form draft; attendance owns it.
          coordinates: INITIAL_FORM.coordinates,
          images: Array.isArray(draft.images) ? draft.images.slice(0, 10) : []
        };
      }
    } catch (e) {
      console.warn('Failed to parse lead form draft:', e);
    }
    return INITIAL_FORM;
  });

  // If editingLead changes, update formData
  useEffect(() => {
    if (editingLead) {
      setFormData({
        name: editingLead.name || '',
        address: editingLead.location?.address || editingLead.address || '',
        googleMapsUrl: editingLead.location?.googleMapsUrl || editingLead.googleMapsUrl || '',
        city: editingLead.location?.city || editingLead.city || '',
        state: editingLead.location?.state || editingLead.state || assignedJurisdiction?.state || '',
        district: editingLead.location?.district || editingLead.district || assignedJurisdiction?.district || '',
        assignedAgentId: editingLead.assignedAgentId || '',
        assignedAgentName: editingLead.assignedAgentName || '',
        assignedAgentCode: editingLead.assignedAgentCode || '',
        totalRooms: editingLead.roomInventory?.totalRooms ?? editingLead.totalRooms ?? '',
        roomPrice: editingLead.roomInventory?.roomPrice ?? editingLead.roomPrice ?? '',
        onlineRooms: editingLead.roomInventory?.onlineRooms ?? editingLead.onlineRooms ?? '',
        offlineRooms: editingLead.roomInventory?.offlineRooms ?? editingLead.offlineRooms ?? '',
        ownerName: editingLead.contact?.ownerName || editingLead.ownerName || '',
        phone: editingLead.contact?.phone || editingLead.phone || '',
        notes: editingLead.notes || '',
        agentNotes: editingLead.agentNotes || '',
        interest: editingLead.interest || 'Interested',
        meetingRequested: editingLead.meeting?.requested ?? true,
        meetingTime: editingLead.meeting?.time || '',
        meetingMode: editingLead.meeting?.mode || 'Call',
        coordinates: editingLead.location?.coordinates || { lat: '', lng: '' },
        images: Array.isArray(editingLead.images) ? editingLead.images : []
      });
    }
  }, [editingLead, assignedJurisdiction?.state, assignedJurisdiction?.district]);

  const hasAttendanceCoordinates =
    attendanceCoordinates?.lat !== undefined &&
    attendanceCoordinates?.lat !== null &&
    attendanceCoordinates?.lng !== undefined &&
    attendanceCoordinates?.lng !== null;

  // Attendance already captured the agent's current geotag. Reuse it for the
  // lead silently. GPS is shown and captured only in the login attendance UI.
  useEffect(() => {
    if (!hasAttendanceCoordinates) return;
    setFormData(prev => ({
      ...prev,
      coordinates: {
        lat: attendanceCoordinates.lat,
        lng: attendanceCoordinates.lng
      }
    }));
  }, [hasAttendanceCoordinates, attendanceCoordinates?.lat, attendanceCoordinates?.lng]);

  useEffect(() => {
    if (!assignedJurisdiction?.state || !assignedJurisdiction?.district) return;
    setFormData(prev => ({
      ...prev,
      state: assignedJurisdiction.state,
      district: assignedJurisdiction.district
    }));
  }, [assignedJurisdiction?.state, assignedJurisdiction?.district]);

  // Load field agents in the assigned district for assignment dropdown
  const [fieldAgents, setFieldAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadAgents() {
      setLoadingAgents(true);
      try {
        const params = {};
        if (assignedJurisdiction?.district) params.district = assignedJurisdiction.district;
        if (assignedJurisdiction?.state) params.state = assignedJurisdiction.state;
        const res = await leadApi.listFieldAgents(params);
        const list = Array.isArray(res) ? res : (res?.data || res?.items || []);
        if (isMounted && Array.isArray(list)) {
          setFieldAgents(list);
        }
      } catch (err) {
        console.warn('Could not load district field agents:', err);
      } finally {
        if (isMounted) setLoadingAgents(false);
      }
    }
    loadAgents();
    return () => { isMounted = false; };
  }, [assignedJurisdiction?.state, assignedJurisdiction?.district]);

  // Auto-save form draft to localStorage whenever fields change
  // (skip for field agents — they only update existing leads, never create)
  useEffect(() => {
    if (agentRole === 'field_agent') return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
    } catch (e) {
      console.warn('Failed to save lead form draft:', e);
    }
  }, [formData, agentRole]);

  const clearFormDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
    setFormData(INITIAL_FORM);
  };

  useEffect(() => {
    const update = () => {
      setCurrentDateTime(new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (!cameraOpen || cameraStarting || !videoRef.current || !cameraStreamRef.current) return;
    videoRef.current.srcObject = cameraStreamRef.current;
    videoRef.current.play().catch(() => {
      setCameraError('The camera preview could not start. Check browser camera permission.');
    });
  }, [cameraOpen, cameraStarting]);

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

  const toggleAgentNotesVoiceDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition API is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListeningAgentNotes) {
      if (agentNotesRecognitionRef.current) {
        agentNotesRecognitionRef.current.stop();
      }
      setIsListeningAgentNotes(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListeningAgentNotes(true);
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
            agentNotes: (prev.agentNotes ? prev.agentNotes + ' ' : '') + finalTranscript
          }));
        }
      };

      recognition.onerror = (err) => {
        console.error('Speech recognition error:', err);
        setIsListeningAgentNotes(false);
      };

      recognition.onend = () => {
        setIsListeningAgentNotes(false);
      };

      agentNotesRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
      setIsListeningAgentNotes(false);
    }
  };

  const handleFileChange = async (e, source = 'picker') => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const remainingSlots = 10 - formData.images.length;
    if (remainingSlots <= 0) {
      e.target.value = '';
      return alert('A lead can contain a maximum of 10 attachments.');
    }

    const selectedFiles = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      alert(`Only ${remainingSlots} more attachment(s) can be added. The maximum is 10.`);
    }

    const supportedFiles = selectedFiles.filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const supportedExtension = [
        'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif', 'pdf'
      ].includes(extension);
      const supportedMimeType = file.type.startsWith('image/') || file.type === 'application/pdf';
      return (supportedExtension || supportedMimeType) && file.size <= 10 * 1024 * 1024;
    });

    if (supportedFiles.length !== selectedFiles.length) {
      alert('Some files were skipped. Use a supported image or PDF up to 10 MB.');
    }
    if (!supportedFiles.length) {
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadStatus(`Uploading file (1/${supportedFiles.length})...`);
    const uploadedUrls = [];

    try {
      for (let index = 0; index < supportedFiles.length; index += 1) {
        setUploadStatus(`Uploading file (${index + 1}/${supportedFiles.length})...`);
        const uploaded = await leadApi.uploadAttachment(supportedFiles[index], source);
        if (!uploaded?.url) throw new Error('Cloudinary did not return a file URL.');
        uploadedUrls.push(uploaded.url);
      }

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls].slice(0, 10)
      }));
      setUploadStatus('Files uploaded');
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (err) {
      console.error('Failed to upload attachments:', err);
      if (uploadedUrls.length) {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls].slice(0, 10)
        }));
      }
      alert(err?.message || 'Failed to upload the selected files. Please try again.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraStarting(false);
    setCameraReady(false);
    setCameraError('');
  };

  const openCamera = async () => {
    setCameraOpen(true);
    setCameraStarting(true);
    setCameraReady(false);
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStarting(false);
      setCameraError('Live camera access requires HTTPS or localhost in a supported browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      cameraStreamRef.current = stream;
      setCameraStarting(false);
    } catch (error) {
      console.error('Camera access failed:', error);
      setCameraStarting(false);
      const message = error?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access from the browser address bar and try again.'
        : error?.name === 'NotFoundError'
          ? 'No camera was found on this device.'
          : error?.name === 'NotReadableError'
            ? 'The camera is being used by another application. Close it there and try again.'
            : 'The camera could not be opened. Check your camera and browser permissions.';
      setCameraError(message);
    }
  };

  const captureCameraPhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('The camera is not ready yet. Wait a moment and try again.');
      return;
    }

    const maxDimension = 2560;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('This browser could not process the camera image.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('The photo could not be captured. Please try again.');
        return;
      }
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      closeCamera();
      void handleFileChange({ target: { files: [file], value: '' } }, 'camera');
    }, 'image/jpeg', 0.9);
  };

  const removeImage = (idx) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUploading) {
      return alert('Please wait until all attachments finish uploading.');
    }
    if (!formData.name.trim()) return alert('Please enter Stay Name');
    if (!formData.city.trim()) return alert('Please enter City');

    // Awaited: when the submit goes to the API it can fail, and clearing the
    // form before knowing that would lose everything the agent just captured
    // on site.
    const payload = {
      name: formData.name.trim(),
      location: {
        address: formData.address.trim(),
        googleMapsUrl: formData.googleMapsUrl?.trim() || '',
        city: formData.city.trim(),
        district: assignedJurisdiction?.district || formData.district,
        state: assignedJurisdiction?.state || formData.state,
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
      agentNotes: formData.agentNotes?.trim() || '',
      interest: formData.interest,
      meeting: {
        requested: formData.meetingRequested,
        time: formData.meetingRequested ? formData.meetingTime : '',
        mode: formData.meetingRequested ? formData.meetingMode : ''
      },
      images: formData.images,
      assignedAgentId: formData.assignedAgentId || null,
      assignedAgentName: formData.assignedAgentName || '',
      assignedAgentCode: formData.assignedAgentCode || '',
      status: editingLead?.status || 'pending'
    };

    const res = await onSubmitLead(payload, editingLead?._id || editingLead?.id);

    if (res === null) return;

    if (!editingLead) clearFormDraft();
    onSuccessNavigate();
  };

  const inputClass = "w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]";
  const labelClass = "text-xs font-bold text-[#64748B] tracking-wider block mb-1.5";

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 text-left space-y-4 sm:space-y-6">
      
      {/* Form Container */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xs">
        
        {/* Header Title */}
        <div className="flex flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 pb-4 sm:pb-6 border-b border-[#E2E8F0] mb-5 sm:mb-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
              {editingLead ? 'Edit Ashram Lead' : (agentRole === 'field_agent' ? 'Update Ashram Lead' : 'Ashram Onboarding Form')}
            </h1>
            <p className="text-[11px] sm:text-xs text-[#64748B] font-medium mt-0.5">
              {editingLead ? 'Update Field Verification & Contact Registration' : (agentRole === 'field_agent' ? 'Field Lead Verification & Details Update' : 'Field Verification & Contact Registration')}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 bg-white border border-[#E2E8F0] rounded-xl px-2 py-1.5 sm:px-3.5 sm:py-2 shrink-0 shadow-2xs">
            <Calendar size={12} className="text-[#0A4DA6] shrink-0 sm:w-[13px] sm:h-[13px]" />
            <div>
              <span className="text-[9px] min-[390px]:text-[10px] sm:text-xs font-bold text-[#0F172A] whitespace-nowrap">{currentDateTime}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          
          {/* GPS is captured only by the attendance modal after login. */}
          {/* SECTION 1: Ashram Details */}
          <div className="space-y-3.5 pb-5 border-b border-[#E2E8F0]">
            <span className="text-xs sm:text-sm font-extrabold text-[#0F172A] block">
              1. Ashram Details &amp; Room Inventory
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
                <label className={labelClass}>Google Map Profile / URL</label>
                <input type="url" placeholder="e.g. https://maps.app.goo.gl/... or Google Maps link"
                  className={inputClass} value={formData.googleMapsUrl || ''}
                  onChange={(e) => handleChange('googleMapsUrl', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>City <span className="text-[#EF4444]">*</span></label>
                <input type="text" required placeholder="e.g. Rishikesh"
                  className={inputClass} value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <input type="text" readOnly
                  className={`${inputClass} cursor-not-allowed opacity-80`}
                  value={assignedJurisdiction?.state || ''} />
              </div>
              <div>
                <label className={labelClass}>Assigned District</label>
                <input type="text" readOnly
                  className={`${inputClass} cursor-not-allowed opacity-80`}
                  value={assignedJurisdiction?.district || ''} />
              </div>
              <div>
                <label className={labelClass}>
                  Field Agent {loadingAgents && <span className="text-[10px] text-[#0A4DA6] font-normal">(Loading...)</span>}
                </label>
                <select
                  className={inputClass}
                  value={formData.assignedAgentId || ''}
                  onChange={(e) => {
                    const agentId = e.target.value;
                    const selected = fieldAgents.find(a => (a._id || a.id) === agentId);
                    handleChange('assignedAgentId', agentId);
                    handleChange('assignedAgentName', selected ? selected.name : '');
                    handleChange('assignedAgentCode', selected ? (selected.employeeCode || selected.phone || '') : '');
                  }}
                >
                  <option value="">Select Field Agent (Optional)</option>
                  {fieldAgents.map((agent) => (
                    <option key={agent._id || agent.id} value={agent._id || agent.id}>
                      {agent.name} {agent.employeeCode ? `(ID: ${agent.employeeCode})` : (agent.phone ? `(${agent.phone})` : '')}
                    </option>
                  ))}
                </select>
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
              2. Contact Person
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
                3. Discussion Notes
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
              4. Owner Interest Level
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

          {/* SECTION 5: Discussion Notes (For Field Agent) */}
          <div className="space-y-2 pb-5 border-b border-[#E2E8F0]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-[#0F172A] block">
                5. Discussion Notes (For Field Agent)
              </span>

              {/* Speech-to-Text Voice Dictation Mic Button */}
              <button
                type="button"
                onClick={toggleAgentNotesVoiceDictation}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer border ${
                  isListeningAgentNotes
                    ? 'bg-red-500 text-white border-red-500 animate-pulse'
                    : 'bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/30 hover:bg-[#0A4DA6]/20'
                }`}
                title={isListeningAgentNotes ? 'Click to stop voice recording' : 'Click to speak and dictate notes'}
              >
                {isListeningAgentNotes ? (
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
              placeholder={isListeningAgentNotes ? "Listening to your voice... Speak now!" : "Type discussion notes for field agent or click Speech to Text to dictate..."}
              className={`w-full px-3.5 py-2.5 bg-[#F8FAFC] border rounded-xl text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8] min-h-[80px] ${
                isListeningAgentNotes ? 'border-red-400 bg-red-50/20' : 'border-[#E2E8F0]'
              }`}
              value={formData.agentNotes || ''}
              onChange={(e) => handleChange('agentNotes', e.target.value)}
            />
          </div>

          {/* SECTION 6: Image Upload (Icon Removed) */}
          <div className="space-y-3 pb-2">
            <span className="text-xs sm:text-sm font-extrabold text-[#0F172A] flex items-center justify-between gap-1.5">
              <span>6. Ashram Attachments</span>
              <div className="flex items-center gap-2">
                {isUploading && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#0A4DA6] bg-[#0A4DA6]/10 px-2.5 py-0.5 rounded-full border border-[#0A4DA6]/20">
                    <Loader2 size={11} className="animate-spin text-[#0A4DA6]" />
                    {uploadStatus}
                  </span>
                )}
                {!isUploading && uploadStatus === 'Files uploaded' && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 size={11} className="text-emerald-600" />
                    Files uploaded
                  </span>
                )}
                <span className="text-xs font-bold text-[#64748B]">{formData.images.length}/10 file(s)</span>
              </div>
            </span>

            <div
              className={`flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#E2E8F0] rounded-xl cursor-pointer hover:border-[#0A4DA6] hover:bg-[#0A4DA6]/5 transition-all text-center ${
                isUploading || formData.images.length >= 10 ? 'opacity-60 pointer-events-none bg-[#F8FAFC]' : ''
              }`}
              onClick={() => document.getElementById('mobile-file-input')?.click()}
            >
              {isUploading ? (
                <Loader2 size={20} className="text-[#0A4DA6] mb-1 animate-spin" />
              ) : (
                <Upload size={20} className="text-[#0A4DA6] mb-1" />
              )}
              <p className="text-xs font-extrabold text-[#0F172A]">
                {isUploading ? 'Uploading to Cloudinary...' : 'Click to upload photos or PDFs'}
              </p>
              <p className="text-[10px] text-[#64748B]">
                {isUploading ? 'Please wait a moment' : 'Images or PDF, maximum 10 files, 10 MB each'}
              </p>
              <input
                id="mobile-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,.heic,.heif,application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(event) => void handleFileChange(event, 'picker')}
                disabled={isUploading || formData.images.length >= 10}
              />
            </div>

            <button
              type="button"
              disabled={isUploading || formData.images.length >= 10}
              onClick={() => void openCamera()}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-[#0A4DA6] bg-white text-[#0A4DA6] text-xs sm:text-sm font-extrabold hover:bg-[#0A4DA6]/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera size={17} />
              <span>Take Photo with Camera</span>
            </button>

            {formData.images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                {formData.images.map((src, idx) => {
                  const isPdf = /\.pdf(?:$|[?#])/i.test(src) || src.includes('/raw/upload/');
                  return (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-[#E2E8F0] aspect-square bg-[#F8FAFC]">
                    {isPdf ? (
                      <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-full flex flex-col items-center justify-center gap-1 text-[#0A4DA6] bg-slate-50"
                      >
                        <FileText size={28} />
                        <span className="text-[10px] font-extrabold">View PDF</span>
                      </a>
                    ) : (
                      <img src={src} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      disabled={isUploading}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button type="submit" disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 px-8 min-h-[46px] bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold rounded-full text-xs sm:text-sm shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Uploading Attachments...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>{editingLead ? 'Update Lead Verification' : (agentRole === 'field_agent' ? 'Submit Updated Lead' : 'Submit Lead Entry')}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>

      {cameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black/75 p-3 sm:p-6 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Take a photo">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A]">Take Ashram Photo</h2>
                <p className="text-[10px] sm:text-xs text-[#64748B]">Position the ashram clearly inside the camera frame.</p>
              </div>
              <button type="button" onClick={closeCamera} className="w-9 h-9 rounded-full flex items-center justify-center text-[#64748B] hover:bg-slate-100 cursor-pointer" aria-label="Close camera">
                <X size={19} />
              </button>
            </div>

            <div className="relative bg-black aspect-[4/3] sm:aspect-video flex items-center justify-center">
              {cameraStarting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-white bg-black">
                  <Loader2 size={28} className="animate-spin" />
                  <span className="text-xs font-bold">Starting camera...</span>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black text-center">
                  <div className="max-w-sm">
                    <Camera size={32} className="mx-auto mb-3 text-white/70" />
                    <p className="text-sm font-bold text-white">{cameraError}</p>
                  </div>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                onCanPlay={() => setCameraReady(true)}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-end gap-2 p-3 sm:p-4">
              <button type="button" onClick={closeCamera} className="min-h-[42px] px-5 rounded-full border border-[#E2E8F0] text-xs font-extrabold text-[#475569] hover:bg-slate-50 cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={captureCameraPhoto} disabled={!cameraReady || cameraStarting || Boolean(cameraError)} className="min-h-[42px] px-5 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold flex items-center gap-2 hover:bg-[#083D85] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <Camera size={16} />
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
