import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Key, RefreshCw, X } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

export const ReceptionCheckinPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Counter Check-in verification code
  const [checkInCode, setCheckInCode] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchActiveBookings();
  }, []);

  const fetchActiveBookings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings/dashboard`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (res.data.success) {
        setActiveBookings(res.data.data);
      }
    } catch (err) {
      console.error('Fetch active bookings error:', err);
      // Mocks fallback
      setActiveBookings([
        {
          _id: 'bk-1',
          bookingId: 'AB-2026-1920',
          customerId: { name: 'Rajesh Kumar', phone: '9876543210' },
          roomId: { name: 'Ganga View Deluxe AC Room' },
          checkInCode: '482012',
          status: 'confirmed',
          pricing: { totalAmount: 3600 },
        },
        {
          _id: 'bk-3',
          bookingId: 'AB-2026-4820',
          customerId: { name: 'Sunita Patel', phone: '9102938475' },
          roomId: { name: 'Vedic Shared Dormitory Bed' },
          status: 'checked_in',
          pricing: { totalAmount: 500 },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!verifyingId || !checkInCode) return;

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings/${verifyingId}/checkin`,
        { checkInCode },
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      if (res.data.success) {
        setVerifyingId(null);
        setCheckInCode('');
        addNotification('Check-In Successful', 'Guest check-in has been authorized and status updated.', 'success');
        fetchActiveBookings();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Incorrect verification code. Please check code.');
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings/${bookingId}/checkout`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      if (res.data.success) {
        addNotification('Check-Out Authorized', 'Rooms released and sent to cleaning status.', 'info');
        fetchActiveBookings();
      }
    } catch (err) {
      console.error('Checkout error:', err);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">Counter Check-In & Check-Out Desk</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Authorize active bookings via digital safety codes or perform check-outs.</p>
        </div>
        <button
          onClick={fetchActiveBookings}
          className="p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 border border-gray-100 dark:border-slate-800 rounded-xl text-gray-500 cursor-pointer transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-50 dark:border-slate-850 bg-gray-50 dark:bg-slate-900 text-gray-450 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-4 px-6">Booking Ref</th>
                  <th className="py-4 px-6">Guest Name</th>
                  <th className="py-4 px-6">Room Type</th>
                  <th className="py-4 px-6">Current Status</th>
                  <th className="py-4 px-6 text-right">Counter Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeBookings.map((bk) => (
                  <tr key={bk._id} className="border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/20">
                    <td className="py-4.5 px-6 font-bold text-[#0B192C] dark:text-white">{bk.bookingId}</td>
                    <td className="py-4.5 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-secondary dark:text-white">{bk.customerId?.name}</span>
                        <span className="text-[10px] text-gray-400">{bk.customerId?.phone}</span>
                      </div>
                    </td>
                    <td className="py-4.5 px-6 text-gray-500">{bk.roomId?.name}</td>
                    <td className="py-4.5 px-6">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold capitalize border ${
                        bk.status === 'confirmed' ? 'bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/20' :
                        bk.status === 'checked_in' ? 'bg-success/15 text-success border border-success/30' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {bk.status}
                      </span>
                    </td>
                    <td className="py-4.5 px-6 text-right space-x-2">
                      {bk.status === 'confirmed' && (
                        <button
                          onClick={() => {
                            setVerifyingId(bk._id);
                            setErrorMsg('');
                          }}
                          className="px-4 py-2 bg-[#0A4DA6] text-white rounded-full text-[10px] font-bold cursor-pointer"
                        >
                          Verify Check-In
                        </button>
                      )}
                      {bk.status === 'checked_in' && (
                        <button
                          onClick={() => handleCheckOut(bk._id)}
                          className="px-4 py-2 bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 rounded-full text-[10px] font-bold cursor-pointer"
                        >
                          Complete Check-Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Check-In Verification Code Modal */}
      {verifyingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCheckInSubmit} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <Key size={16} className="text-[#0A4DA6]" /> Authorize Stay Check-In
              </h3>
              <button type="button" onClick={() => setVerifyingId(null)} className="text-gray-400 hover:text-gray-655">
                <X size={18} />
              </button>
            </div>
            
            <p className="text-[10px] text-gray-400">Ask the guest customer to provide the 6-digit confirmation Check-in code sent to their registered phone number.</p>

            {errorMsg && (
              <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block text-center">Check-In Pass Code</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="482012"
                value={checkInCode}
                onChange={(e) => setCheckInCode(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm text-center tracking-widest font-extrabold focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVerifyingId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold cursor-pointer shadow"
              >
                Authorize Check-In
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default ReceptionCheckinPage;
