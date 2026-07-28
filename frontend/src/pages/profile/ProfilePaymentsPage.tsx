import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ArrowLeft, Download, FileText, CheckCircle2 } from 'lucide-react';
import { EnterpriseButton } from '../../admin/shared';

export const ProfilePaymentsPage: React.FC = () => {
  const transactions = [
    { id: 'TXN-902181', date: 'Jul 26, 2026', title: 'Swarg Ashram Booking', amount: 4800, method: 'UPI / GPay', status: 'Paid' },
    { id: 'TXN-718293', date: 'Jul 15, 2026', title: 'Parmarth Niketan Booking', amount: 2400, method: 'Credit Card', status: 'Paid' },
    { id: 'TXN-610294', date: 'Jun 05, 2026', title: 'Kashi Guest House Cancellation Refund', amount: 6200, method: 'UPI Refund', status: 'Refunded' },
  ];

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-24 text-left">
      <section className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-white/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-3 relative z-10">
          <Link to="/profile" className="inline-flex items-center gap-1.5 text-xs text-blue-200 hover:text-white font-bold mb-2">
            <ArrowLeft size={14} /> Back to Profile
          </Link>
          <h1 className="text-3xl font-black tracking-tight">
            Payments & <span className="text-[#E58C28]">GST Invoices</span>
          </h1>
          <p className="text-xs text-blue-100/80 font-medium">Download tax invoices and view payment transaction history.</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-lg space-y-4">
          <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white uppercase tracking-wider">Transaction History</h3>

          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {transactions.map((t) => (
              <div key={t.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[#0B192C] dark:text-white">{t.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${t.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-gray-400 font-medium">{t.id} • {t.date} via {t.method}</p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-base font-black text-[#0A4DA6] dark:text-white">₹{t.amount}</span>
                  <EnterpriseButton variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Download size={14} /> Receipt
                  </EnterpriseButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePaymentsPage;
