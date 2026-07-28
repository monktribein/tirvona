import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Clock,
  Download,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  ArrowLeft,
  FileText,
  Star,
  Users,
} from 'lucide-react';
import { EnterpriseButton, EnterpriseStatusBadge } from '../../admin/shared';

export const ProfileBookingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');

  const sampleBookings = [
    {
      id: 'TVN-BK-88219',
      ashramName: 'Swarg Ashram Divine Residency',
      city: 'Rishikesh, Uttarakhand',
      image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80',
      checkIn: 'Aug 10, 2026',
      checkOut: 'Aug 14, 2026',
      roomType: 'Deluxe Ganga View Suite',
      guests: 2,
      amount: 4800,
      status: 'confirmed',
      category: 'upcoming',
    },
    {
      id: 'TVN-BK-74912',
      ashramName: 'Parmarth Niketan Spiritual Stay',
      city: 'Rishikesh, Uttarakhand',
      image: 'https://images.unsplash.com/photo-1566438480900-0609be27a4be?auto=format&fit=crop&w=600&q=80',
      checkIn: 'Jul 15, 2026',
      checkOut: 'Jul 18, 2026',
      roomType: 'Standard Satvik Room',
      guests: 1,
      amount: 2400,
      status: 'completed',
      category: 'completed',
    },
    {
      id: 'TVN-BK-63011',
      ashramName: 'Kashi Annapurna Heritage Guest House',
      city: 'Varanasi, Uttar Pradesh',
      image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80',
      checkIn: 'Jun 05, 2026',
      checkOut: 'Jun 08, 2026',
      roomType: 'Executive Family AC Room',
      guests: 4,
      amount: 6200,
      status: 'cancelled',
      category: 'cancelled',
    },
  ];

  const filteredBookings = sampleBookings.filter((b) => b.category === activeTab);

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-24 text-left">
      {/* Top Banner */}
      <section className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-white/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-3 relative z-10">
          <Link to="/profile" className="inline-flex items-center gap-1.5 text-xs text-blue-200 hover:text-white font-bold mb-2">
            <ArrowLeft size={14} /> Back to Profile
          </Link>
          <h1 className="text-3xl font-black tracking-tight">
            My <span className="text-[#E58C28]">Bookings & Stays</span>
          </h1>
          <p className="text-xs text-blue-100/80 font-medium">Manage upcoming spiritual stays, download PDF invoices, and rebook past trips.</p>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20 space-y-6">
        
        {/* Tabs Bar */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-full p-2 shadow-lg flex items-center justify-center gap-2 max-w-md mx-auto text-xs font-extrabold">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-5 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'upcoming' ? 'bg-[#0A4DA6] text-white shadow-md' : 'text-gray-500 hover:text-[#0B192C] dark:hover:text-white'
            }`}
          >
            Upcoming Stays (1)
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-5 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'completed' ? 'bg-[#0A4DA6] text-white shadow-md' : 'text-gray-500 hover:text-[#0B192C] dark:hover:text-white'
            }`}
          >
            Completed (1)
          </button>
          <button
            onClick={() => setActiveTab('cancelled')}
            className={`px-5 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'cancelled' ? 'bg-[#0A4DA6] text-white shadow-md' : 'text-gray-500 hover:text-[#0B192C] dark:hover:text-white'
            }`}
          >
            Cancelled (1)
          </button>
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-3">
            <Calendar className="mx-auto text-gray-300" size={40} />
            <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">No {activeTab} bookings found</h3>
            <Link to="/search" className="inline-block px-5 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold shadow-md">
              Explore Ashrams & Book Stay
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 sm:p-6 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                <div className="flex items-start gap-4">
                  <img
                    src={b.image}
                    alt={b.ashramName}
                    className="w-24 h-24 rounded-2xl object-cover shrink-0 border border-gray-100 dark:border-slate-800"
                  />

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{b.id}</span>
                      <EnterpriseStatusBadge status={b.status} />
                    </div>
                    <h3 className="font-black text-base text-[#0B192C] dark:text-white leading-tight">{b.ashramName}</h3>
                    <p className="text-gray-500 font-medium flex items-center gap-1">
                      <MapPin size={12} className="text-[#E58C28]" /> {b.city}
                    </p>
                    <p className="text-gray-400 font-bold pt-1">
                      🗓️ {b.checkIn} → {b.checkOut} • 👤 {b.guests} Guests ({b.roomType})
                    </p>
                  </div>
                </div>

                <div className="flex md:flex-col justify-between items-end gap-3 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-slate-800">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block font-bold uppercase">Total Amount</span>
                    <span className="text-lg font-black text-[#0A4DA6] dark:text-white">₹{b.amount}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <EnterpriseButton variant="outline" size="sm" className="gap-1.5 text-xs">
                      <FileText size={14} /> PDF Invoice
                    </EnterpriseButton>
                    <Link to="/search">
                      <EnterpriseButton variant="primary" size="sm" className="gap-1.5 text-xs">
                        Book Again
                      </EnterpriseButton>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileBookingsPage;
