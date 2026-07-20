import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileCheck, ShieldAlert, FileText, X } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

export const VerificationQueuePage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Inspector Action States
  const [actionAshramId, setActionAshramId] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [targetStatus, setTargetStatus] = useState<'approved' | 'rejected'>('approved');

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/verify/pending`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (res.data.success) {
        setPendingList(res.data.data);
      }
    } catch (err) {
      console.error('Fetch pending error:', err);
      // Fallback mocks
      setPendingList([
        {
          _id: 'ashram-1',
          name: 'Parmarth Niketan Ashram',
          address: { city: 'Rishikesh', district: 'Pauri', state: 'Uttarakhand' },
          status: 'pending_inspection',
          documents: {
            trustDeedUrl: '#',
            fireSafetyCertificateUrl: '#',
            landOwnershipUrl: '#',
          },
          ownerId: { name: 'Swami Chidanand', phone: '9000100020' },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionAshramId) return;

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/verify/${actionAshramId}/status`,
        { status: targetStatus, comments },
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      if (res.data.success) {
        setActionAshramId(null);
        setComments('');
        addNotification('Inspection Decided', `Ashram has been marked as ${targetStatus.toUpperCase()}`, 'success');
        fetchPending();
      }
    } catch (err) {
      console.error('Decision error:', err);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm">
        <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">Government Ashram Verification Queue</h2>
        <p className="text-xs text-gray-400 font-semibold mt-1">Screen trust deeds, review local fire certificates, and submit inspection results.</p>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : pendingList.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-4">
          <FileCheck className="mx-auto text-gray-300" size={32} />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">Verification Queue Clear</h4>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            There are no pending Ashram registrations or audits in your district jurisdiction.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingList.map((a) => (
            <div key={a._id} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm space-y-5">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b border-gray-50 dark:border-slate-850 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-[#0B192C] dark:text-white">{a.name}</h3>
                  <span className="text-[10px] text-gray-400 font-semibold">{a.address?.city}, {a.address?.state}</span>
                </div>
                <span className="text-[9px] font-bold bg-yellow-50 text-yellow-750 border border-yellow-200 px-2.5 py-0.5 rounded-full capitalize">
                  {a.status?.replace('_', ' ')}
                </span>
              </div>

              {/* Owner KYC contacts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-450 block uppercase font-bold">Applicant Owner</span>
                  <span className="font-semibold text-secondary dark:text-white">{a.ownerId?.name} ({a.ownerId?.phone})</span>
                </div>
                
                {/* Documents uploaded */}
                <div className="space-y-1 md:col-span-2">
                  <span className="text-[9px] text-gray-455 block uppercase font-bold">KYC Attachments</span>
                  <div className="flex gap-2">
                    <a href={a.documents?.trustDeedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-slate-900 border border-gray-150 rounded-full text-[10px] font-bold hover:bg-gray-100 transition-colors">
                      <FileText size={12} className="text-red-500" /> Trust Deed
                    </a>
                    <a href={a.documents?.fireSafetyCertificateUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-slate-900 border border-gray-150 rounded-full text-[10px] font-bold hover:bg-gray-100 transition-colors">
                      <FileText size={12} className="text-orange-500" /> Fire safety Cert
                    </a>
                  </div>
                </div>
              </div>

              {/* Decisions Buttons */}
              <div className="pt-3 border-t border-gray-50 dark:border-slate-850 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setActionAshramId(a._id);
                    setTargetStatus('rejected');
                    setComments('');
                  }}
                  className="px-4 py-2 bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 rounded-full text-[10px] font-bold cursor-pointer"
                >
                  Reject & Suspend
                </button>
                <button
                  onClick={() => {
                    setActionAshramId(a._id);
                    setTargetStatus('approved');
                    setComments('');
                  }}
                  className="px-4 py-2 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 hover:bg-[#0A4DA6]/15 rounded-full text-[10px] font-bold cursor-pointer"
                >
                  Verify Approve
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Decision Modal Dialog */}
      {actionAshramId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleDecision} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-xl">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-[#0A4DA6]" /> Log Verification Decision
              </h3>
              <button type="button" onClick={() => setActionAshramId(null)} className="text-gray-400 hover:text-gray-655">
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400">Inspector Comments / Audit findings</label>
              <textarea
                required
                rows={3}
                placeholder="Include safety check details, separate washing quarters findings, water safety checks..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setActionAshramId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 py-2.5 text-white rounded-full text-xs font-bold cursor-pointer shadow ${
                  targetStatus === 'approved' ? 'bg-success' : 'bg-danger'
                }`}
              >
                Confirm {targetStatus.toUpperCase()}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default VerificationQueuePage;
