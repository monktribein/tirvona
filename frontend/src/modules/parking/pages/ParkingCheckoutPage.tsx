import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Car,
  User,
  Phone,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Clock,
  CreditCard,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import { getErrorMessage } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { openRazorpayCheckout } from '../../../lib/razorpay';
import { parkingDiscoveryService, parkingBookingService } from '../services/parking.service';
import type { ParkingQuote, ParkingVehicleTypeCode } from '../types/parking.types';
import {
  formatCurrency,
  formatDateTime,
  vehicleLabel,
  normalizeVehicleNumber,
  isValidVehicleNumber,
} from '../utils/parkingFormat';

/**
 * Parking checkout.
 *
 * Vehicle details → hold the bay → pay → confirmed with a QR pass. The quote
 * shown here is the same server-computed figure that gets charged; nothing
 * about the amount is decided in the browser.
 */
export const ParkingCheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const params = useMemo(
    () => ({
      locationId: searchParams.get('locationId') || '',
      slotTypeId: searchParams.get('slotTypeId') || '',
      vehicleType: (searchParams.get('vehicleType') || 'car') as ParkingVehicleTypeCode,
      entryAt: searchParams.get('entryAt') || '',
      exitAt: searchParams.get('exitAt') || '',
    }),
    [searchParams],
  );

  const [quote, setQuote] = useState<ParkingQuote | null>(null);
  const [locationName, setLocationName] = useState('');

  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [driverName, setDriverName] = useState(user?.name || '');
  const [driverPhone, setDriverPhone] = useState(user?.phone || '');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  // Fetch the authoritative quote for this exact selection.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!params.locationId || !params.slotTypeId) {
        setError('This booking link is incomplete. Please choose your parking again.');
        setLoading(false);
        return;
      }
      try {
        const [quoteRes, detailRes] = await Promise.all([
          parkingDiscoveryService.getQuote({
            locationId: params.locationId,
            slotTypeId: params.slotTypeId,
            vehicleType: params.vehicleType,
            entryAt: params.entryAt,
            exitAt: params.exitAt,
          }),
          parkingDiscoveryService.getDetail(params.locationId),
        ]);
        if (cancelled) return;
        if (quoteRes.data?.success) setQuote(quoteRes.data.data);
        if (detailRes.data?.success) setLocationName(detailRes.data.data.name);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not price this booking.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const validate = () => {
    if (!isValidVehicleNumber(vehicleNumber)) {
      setFieldError('Enter a valid registration number, e.g. MH12AB1234');
      return false;
    }
    if (!driverName.trim()) {
      setFieldError('Driver name is required.');
      return false;
    }
    setFieldError('');
    return true;
  };

  /**
   * Create → pay → confirm.
   *
   * Creating the booking holds the bay for a short window; the payment step then
   * confirms it. If payment is abandoned the hold lapses server-side and the bay
   * returns to inventory, so nothing is stranded.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const createRes = await parkingBookingService.create({
        locationId: params.locationId,
        slotTypeId: params.slotTypeId,
        vehicleType: params.vehicleType,
        vehicleNumber: normalizeVehicleNumber(vehicleNumber),
        entryAt: params.entryAt,
        exitAt: params.exitAt,
        vehicleModel,
        driverName,
        driverPhone,
      });

      if (!createRes.data?.success) {
        setError(createRes.data?.message || 'Could not hold a bay.');
        setSubmitting(false);
        return;
      }

      const bookingId = createRes.data.data.booking._id;

      const orderRes = await parkingBookingService.createPaymentOrder(bookingId);
      if (!orderRes.data?.success) {
        setError(orderRes.data?.message || 'Could not start the payment.');
        setSubmitting(false);
        return;
      }

      let paymentPayload: Record<string, string> = { method: 'demo' };

      // Demo mode (no gateway keys configured) skips the checkout modal, exactly
      // as the stay booking flow does.
      if (!orderRes.data.demo) {
        const result = await openRazorpayCheckout(orderRes.data.data, {
          name: driverName || user?.name,
          email: user?.email,
          contact: driverPhone || user?.phone,
        });
        paymentPayload = {
          razorpay_order_id: result.razorpay_order_id,
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_signature: result.razorpay_signature,
        };
      }

      const confirmRes = await parkingBookingService.confirmPayment(bookingId, paymentPayload);
      if (!confirmRes.data?.success) {
        setError(confirmRes.data?.message || 'Payment could not be confirmed.');
        setSubmitting(false);
        return;
      }

      navigate(`/parking/booking/${bookingId}?justBooked=1`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong completing your booking.'));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-20 space-y-4">
        <div className="h-32 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
        <div className="h-72 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
      </div>
    );
  }

  return (
    <div className="pb-16 lg:pb-24 pt-8 sm:pt-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-[#0A4DA6] transition-colors cursor-pointer"
        >
          <ChevronLeft size={15} className="stroke-[2.5]" />
          Back
        </button>

        <header className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white">Confirm your parking</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {locationName && <span className="font-bold">{locationName} · </span>}
            {quote?.slotTypeName}
          </p>
        </header>

        {error && (
          <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5 stroke-[2.5]" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-5">
          {/* Vehicle form */}
          <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-4">
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-4 shadow-sm">
              <h2 className="inline-flex items-center gap-2 font-extrabold text-sm text-[#0B192C] dark:text-white">
                <Car size={15} className="text-[#0A4DA6] stroke-[2.5]" />
                Vehicle details
              </h2>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="vehicle-number"
                    className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5"
                  >
                    Registration Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="vehicle-number"
                    type="text"
                    required
                    value={vehicleNumber}
                    onChange={(e) => {
                      setVehicleNumber(e.target.value.toUpperCase());
                      setFieldError('');
                    }}
                    placeholder="MH12AB1234"
                    autoComplete="off"
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-black tracking-widest uppercase text-[#0B192C] dark:text-white placeholder:text-gray-300 placeholder:font-medium placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
                  />
                  {fieldError && (
                    <p className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1.5">
                      <AlertCircle size={11} className="stroke-[2.5]" />
                      {fieldError}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="vehicle-model"
                    className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5"
                  >
                    Make &amp; Model <span className="text-gray-300 normal-case tracking-normal">(optional)</span>
                  </label>
                  <input
                    id="vehicle-model"
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Maruti Swift, white"
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="driver-name"
                      className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5"
                    >
                      Driver Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 stroke-[2.5] pointer-events-none"
                      />
                      <input
                        id="driver-name"
                        type="text"
                        required
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="driver-phone"
                      className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5"
                    >
                      Contact Number
                    </label>
                    <div className="relative">
                      <Phone
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 stroke-[2.5] pointer-events-none"
                      />
                      <input
                        id="driver-phone"
                        type="tel"
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <button
              type="submit"
              disabled={submitting || !quote}
              className="w-full bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-extrabold px-6 py-3.5 rounded-full shadow-lg shadow-[#0A4DA6]/20 transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin stroke-[2.5]" />
                  Processing…
                </>
              ) : (
                <>
                  <CreditCard size={16} className="stroke-[2.5]" />
                  Pay {quote ? formatCurrency(quote.totalAmount) : ''} &amp; Confirm
                </>
              )}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400">
              <ShieldCheck size={12} className="stroke-[2.5]" />
              Secure payment · Your QR pass is issued instantly
            </p>
          </form>

          {/* Summary */}
          <aside className="lg:col-span-2">
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:sticky lg:top-24 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-4 shadow-lg"
            >
              <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">Booking summary</h2>

              <dl className="space-y-2.5">
                {[
                  ['Parking', locationName || '—'],
                  ['Area', quote?.slotTypeName || '—'],
                  ['Vehicle', vehicleLabel(params.vehicleType)],
                  ['Entry', formatDateTime(params.entryAt)],
                  ['Exit', formatDateTime(params.exitAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 text-[11px]">
                    <dt className="font-bold text-gray-400 shrink-0">{label}</dt>
                    <dd className="font-bold text-slate-700 dark:text-gray-200 text-right">{value}</dd>
                  </div>
                ))}
              </dl>

              {quote && (
                <div className="pt-3 space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-1">
                    <Clock size={11} className="stroke-[2.5]" />
                    {quote.durationHours} hour{quote.durationHours === 1 ? '' : 's'} billed
                  </div>

                  {quote.baseFee > 0 && (
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span className="text-gray-500 dark:text-gray-400">Base fee</span>
                      <span className="text-slate-700 dark:text-gray-200">{formatCurrency(quote.baseFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-gray-500 dark:text-gray-400">Parking charges</span>
                    <span className="text-slate-700 dark:text-gray-200">{formatCurrency(quote.durationAmount)}</span>
                  </div>
                  {quote.isPeak && (
                    <div className="flex justify-between text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      <span>Peak period</span>
                      <span>×{quote.peakMultiplier}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-gray-500 dark:text-gray-400">GST ({quote.taxPercent}%)</span>
                    <span className="text-slate-700 dark:text-gray-200">{formatCurrency(quote.taxAmount)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2.5 mt-1.5">
                    <span className="text-xs font-black text-[#0B192C] dark:text-white">Total payable</span>
                    <span className="text-lg font-black text-[#0A4DA6] dark:text-blue-300">
                      {formatCurrency(quote.totalAmount)}
                    </span>
                  </div>
                </div>
              )}

              <ul className="space-y-1.5 pt-1">
                {[
                  'QR pass issued the moment payment clears',
                  'Bay assigned automatically at the gate',
                  'Free cancellation within the policy window',
                ].map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400"
                  >
                    <CheckCircle2 size={11} className="text-emerald-500 shrink-0 mt-0.5 stroke-[2.5]" />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ParkingCheckoutPage;
