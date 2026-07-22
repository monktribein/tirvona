import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  ShieldCheck, 
  Upload, 
  Plus, 
  Clock 
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

export const ManageAshramsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload Docs State
  const [uploadDeedId, setUploadDeedId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyAshrams();
  }, []);

  const fetchMyAshrams = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams/my-listings/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (res.data.success) {
        setAshrams(res.data.data);
      }
    } catch (err) {
      console.error('Fetch my listings error:', err);
      // Fallback mock
      setAshrams([
        {
          _id: 'ashram-1',
          name: 'Parmarth Niketan Ashram',
          address: { street: 'Main Ghat Rd', city: 'Rishikesh', district: 'Pauri', state: 'Uttarakhand', pincode: '249304' },
          status: 'pending_docs',
          amenities: ['Meditation Hall', 'River View', 'Cow Shelter'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocs = async () => {
    if (!uploadDeedId) return;
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams/${uploadDeedId}/documents`,
        {
          trustDeedUrl: 'https://res.cloudinary.com/deeds/deed_doc.pdf',
          fireSafetyCertificateUrl: 'https://res.cloudinary.com/certificates/fire_cert.pdf',
          landOwnershipUrl: 'https://res.cloudinary.com/deeds/land_ownership.pdf',
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      if (res.data.success) {
        setUploadDeedId(null);
        addNotification('KYC Documents Submitted', 'Your Ashram documents are queued for physical inspection.', 'success');
        fetchMyAshrams();
      }
    } catch (err) {
      console.error('Docs upload error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">Registered Ashram Accommodations</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Manage listings, check approval status, and configure KYC certificates.</p>
        </div>
        <button
          onClick={() => navigate('/owner/ashrams/add')}
          className="px-5 py-2.5 bg-[#0A4DA6] text-white text-xs font-bold rounded-full hover:bg-opacity-95 shadow flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={14} /> List Ashram
        </button>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ashrams.map((a) => (
            <div key={a._id} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm space-y-4 flex flex-col justify-between">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b border-gray-50 dark:border-slate-850 pb-3">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-[#0B192C] dark:text-white">{a.name}</h3>
                  <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-0.5"><MapPin size={10} className="text-[#0A4DA6]" /> {a.address?.city}, {a.address?.state}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 ${
                  a.status === 'approved' ? 'bg-success/15 text-success border border-success/30' :
                  a.status === 'pending_inspection' ? 'bg-yellow-50 text-yellow-750 border border-yellow-200' :
                  'bg-gray-100 text-gray-550'
                }`}>
                  {a.status === 'approved' ? <ShieldCheck size={10} /> : <Clock size={10} />}
                  {a.status?.replace('_', ' ')}
                </span>
              </div>

              {/* Details & Action */}
              <div className="flex justify-between items-center pt-2">
                <div className="flex flex-wrap gap-1">
                  {a.amenities?.slice(0, 3).map((am: string, i: number) => (
                    <span key={i} className="text-[9px] font-bold bg-gray-50 dark:bg-slate-900 text-gray-500 px-2 py-0.5 rounded-md">
                      {am}
                    </span>
                  ))}
                </div>

                {a.status === 'pending_docs' && (
                  <button
                    onClick={() => setUploadDeedId(a._id)}
                    className="px-4 py-2 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 text-[10px] font-bold rounded-full shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <Upload size={12} /> Upload KYC
                  </button>
                )}
                {a.status === 'approved' && (
                  <button
                    onClick={() => navigate(`/owner/ashrams/add?edit=${a._id}`)}
                    className="px-4 py-2 bg-success/15 text-success border border-success/30 text-[10px] font-bold rounded-full shadow-sm flex items-center gap-1 cursor-pointer hover:bg-success/20"
                  >
                    Configure Details
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KYC Upload Modal */}
      {uploadDeedId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left">
            <h3 className="font-bold text-sm text-[#0B192C] dark:text-white">Upload Ashram Deeds & Certificates</h3>
            <p className="text-[10px] text-gray-400">Please upload PDF copies of: Trust Deed papers, Fire Safety Audit, Land Registry Certificate.</p>
            
            <div className="p-6 bg-gray-50 dark:bg-slate-900 rounded-[20px] border border-dashed border-gray-250 text-center space-y-2 cursor-pointer">
              <Upload className="mx-auto text-[#0A4DA6]" size={24} />
              <span className="text-xs font-bold block text-[#0B192C] dark:text-white">Select PDF Document Archives</span>
              <span className="text-[9px] text-gray-400">Drag files here or browse directory</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setUploadDeedId(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold cursor-pointer">
                Cancel
              </button>
              <button onClick={handleUploadDocs} className="flex-1 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold cursor-pointer shadow">
                Submit Documents
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ManageAshramsPage;
