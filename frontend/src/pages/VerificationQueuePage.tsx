import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileCheck, ShieldAlert, FileText, Check, X, Calendar, MessageSquare } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <h2 className="text-lg font-bold text-secondary dark:text-white">Government Ashram Verification Queue</h2>
        <p className="text-xs text-gray-500">Screen trust deeds, review local fire certificates, and submit inspection results.</p>
      </div>

      {loading ? (
        <div className="h-40 bg-card border border-border rounded-2xl animate-pulse" />
      ) : pendingList.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl space-y-3">
          <FileCheck className="mx-auto text-gray-400" size={32} />
          <h4 className="font-bold text-sm">Verification Queue Clear</h4>
          <p className="text-xs text-gray-500">There are no pending Ashram registrations or audits in your district jurisdiction.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingList.map((a) => (
            <div key={a._id} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-5">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b border-border pb-3">
                <div>
                  <h3 className="font-bold text-sm text-secondary dark:text-white">{a.name}</h3>
                  <span className="text-[10px] text-gray-500">{a.address?.city}, {a.address?.state}</span>
                </div>
                <span className="text-[9px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded capitalize">
                  {a.status?.replace('_', ' ')}
                </span>
              </div>

              {/* Owner KYC contacts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-400 block uppercase font-bold">Applicant Owner</span>
                  <span className="font-semibold">{a.ownerId?.name} ({a.ownerId?.phone})</span>
                </div>
                
                {/* Documents uploaded */}
                <div className="space-y-1 md:col-span-2">
                  <span className="text-[9px] text-gray-400 block uppercase font-bold">KYC Attachments</span>
                  <div className="flex gap-2">
                    <a href={a.documents?.trustDeedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-250 rounded text-[10px] font-bold">
                      <FileText size={12} className="text-red-500" /> Trust Deed
                    </a>
                    <a href={a.documents?.fireSafetyCertificateUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-250 rounded text-[10px] font-bold">
                      <FileText size={12} className="text-orange-500" /> Fire safety Cert
                    </a>
                  </div>
                </div>
              </div>

              {/* Decisions Buttons */}
              <div className="pt-3 border-t border-border flex justify-end gap-3">
                <button
                  onClick={() => {
                    setActionAshramId(a._id);
                    setTargetStatus('rejected');
                    setComments('');
                  }}
                  className="px-3 py-1.5 bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  Reject & Suspend
                </button>
                <button
                  onClick={() => {
                    setActionAshramId(a._id);
                    setTargetStatus('approved');
                    setComments('');
                  }}
                  className="px-3 py-1.5 bg-success/10 text-success border border-success/20 hover:bg-success/15 rounded-lg text-[10px] font-bold cursor-pointer"
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
          <form onSubmit={handleDecision} className="bg-card border border-border max-w-md w-full rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-secondary dark:text-white flex items-center gap-1.5">
              <ShieldAlert size={16} className="text-accent" /> Log Verification Decision
            </h3>
            
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Inspector Comments / Audit findings</label>
              <textarea
                required
                rows={3}
                placeholder="Include safety check details, separate washing quarters findings, water safety checks..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full p-3 bg-background border border-border rounded-lg text-xs"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setActionAshramId(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 py-2 text-white rounded-lg text-xs font-bold ${
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
