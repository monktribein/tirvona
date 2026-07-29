import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CircleParking, Car, Clock, MapPin, ArrowRight, AlertCircle } from 'lucide-react';
import { getErrorMessage } from '../../../lib/api';
import { parkingBookingService } from '../services/parking.service';
import type { ParkingBooking, ParkingLocation } from '../types/parking.types';
import { formatCurrency, formatDateTime, vehicleLabel } from '../utils/parkingFormat';
import ParkingStatusBadge from '../components/ParkingStatusBadge';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'checked_in', label: 'Parked' },
  { value: 'checked_out', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** The visitor's parking booking history. */
export const ParkingMyBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<ParkingBooking[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await parkingBookingService.list({ status: status || undefined, limit: 50 });
      if (res.data?.success) setBookings(res.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your parking bookings.'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="pb-16 lg:pb-24 pt-8 sm:pt-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <header className="space-y-1">
          <h1 className="inline-flex items-center gap-2.5 text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white">
            <span className="w-9 h-9 rounded-2xl bg-[#0A4DA6] text-white flex items-center justify-center shadow-md">
              <CircleParking size={18} className="stroke-[2.5]" />
            </span>
            My Parking
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Your reservations, passes and parking history.
          </p>
        </header>

        {/* Status filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={`shrink-0 text-[11px] font-bold px-4 py-2 rounded-full border transition-all cursor-pointer ${
                status === f.value
                  ? 'bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-sm'
                  : 'bg-white dark:bg-[#0B192C] border-gray-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:border-[#0A4DA6]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5 stroke-[2.5]" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-3 shadow-sm">
            <CircleParking size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
            <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">No parking bookings yet</h4>
            <p className="text-xs text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
              Reserve a secure bay near your destination and get an instant QR pass.
            </p>
            <Link
              to="/parking"
              className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95"
            >
              Find parking
              <ArrowRight size={13} className="stroke-[2.5]" />
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {bookings.map((booking, index) => {
              const location = typeof booking.locationId === 'object' ? (booking.locationId as ParkingLocation) : null;

              return (
                <motion.li
                  key={booking._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.3) }}
                >
                  <Link
                    to={`/parking/booking/${booking._id}`}
                    className="group block bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-4 sm:p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white line-clamp-1">
                          {location?.name || 'Parking booking'}
                        </h3>
                        {location?.address && (
                          <p className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium line-clamp-1">
                            <MapPin size={11} className="shrink-0 stroke-[2.5]" />
                            {[location.address.landmark, location.address.city].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      <ParkingStatusBadge status={booking.status} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                      {[
                        {
                          icon: Car,
                          label: 'Vehicle',
                          value: `${booking.vehicleNumber}`,
                          sub: vehicleLabel(booking.vehicleType),
                        },
                        { icon: Clock, label: 'Entry', value: formatDateTime(booking.entryAt) },
                        { icon: Clock, label: 'Exit', value: formatDateTime(booking.exitAt) },
                        { icon: CircleParking, label: 'Paid', value: formatCurrency(booking.pricing.amountPaid) },
                      ].map(({ icon: Icon, label, value, sub }) => (
                        <div key={label} className="space-y-0.5 min-w-0">
                          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-gray-400">
                            <Icon size={10} className="stroke-[2.5]" /> {label}
                          </span>
                          <p className="text-[11px] font-bold text-slate-700 dark:text-gray-200 truncate">{value}</p>
                          {sub && <p className="text-[9px] font-semibold text-gray-400">{sub}</p>}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 mt-3">
                      <span className="text-[10px] font-bold text-gray-400">{booking.bookingReference}</span>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#0A4DA6] dark:text-blue-300">
                        View pass
                        <ArrowRight size={12} className="stroke-[3] transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ParkingMyBookingsPage;
