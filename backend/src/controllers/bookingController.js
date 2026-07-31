import Booking from '../models/Booking.js';
import RoomAvailability from '../models/RoomAvailability.js';
import Room from '../models/Room.js';
import Payment from '../models/Payment.js';
import AuditLog from '../models/AuditLog.js';
import Ashram from '../models/Ashram.js';
import Offer from '../models/Offer.js';
import PlatformSettings from '../models/PlatformSettings.js';
import { scopedAshramIds } from '../utils/ashramAccess.js';
import { isRazorpayConfigured, createRazorpayOrder, verifyRazorpaySignature } from '../utils/razorpay.js';
import {
  dispatchBookingNotifications,
  sendBookingConfirmationEmail,
  sendBookingConfirmationSMS,
} from '../utils/bookingNotification.js';
import config from '../config/env.js';

// Emit a real-time booking update to the customer and the ashram owner rooms.
// No-op when Socket.io isn't attached (e.g. serverless). Never throws.
const emitBookingUpdate = async (req, booking, event) => {
  if (!req.io) return;
  try {
    const ashram = await Ashram.findById(booking.ashramId).select('ownerId');
    const payload = {
      event,
      bookingId: booking.bookingId,
      status: booking.status,
      at: new Date().toISOString(),
    };
    req.io.to(booking.customerId.toString()).emit('booking_update', payload);
    if (ashram?.ownerId) req.io.to(ashram.ownerId.toString()).emit('booking_update', payload);
  } catch (err) {
    console.error('Socket emit error:', err.message);
  }
};

// ── Inventory helpers ────────────────────────────────────────────────────────
// Iterate the nights of a stay: [checkIn, checkOut).
const eachNight = function* (startDate, endDate) {
  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
    yield new Date(d.toISOString().split('T')[0]);
  }
};

// Release inventory for a date range, never letting bookedCount go negative.
const releaseInventory = async (roomId, startDate, endDate, count) => {
  for (const date of eachNight(startDate, endDate)) {
    await RoomAvailability.updateOne(
      { roomId, date, bookedCount: { $gte: count } },
      { $inc: { bookedCount: -count } }
    );
    // If bookedCount was below `count` (data drift), clamp to zero instead.
    await RoomAvailability.updateOne(
      { roomId, date, bookedCount: { $lt: count, $gt: 0 } },
      { $set: { bookedCount: 0 } }
    );
  }
};

// Atomically lock `count` rooms for every night.
const lockInventory = async (room, startDate, endDate, count) => {
  const locked = [];
  for (const date of eachNight(startDate, endDate)) {
    await RoomAvailability.updateOne(
      { roomId: room._id, date },
      { $setOnInsert: { bookedCount: 0, maintenanceCount: 0 } },
      { upsert: true }
    );

    const updated = await RoomAvailability.findOneAndUpdate(
      {
        roomId: room._id,
        date,
        $expr: {
          $lte: [
            { $add: ['$bookedCount', count] },
            { $subtract: [room.totalInventory, '$maintenanceCount'] },
          ],
        },
      },
      { $inc: { bookedCount: count } },
      { new: true }
    );

    if (!updated) {
      for (const d of locked) {
        await RoomAvailability.updateOne(
          { roomId: room._id, date: d, bookedCount: { $gte: count } },
          { $inc: { bookedCount: -count } }
        );
      }
      return { ok: false, failedDate: date.toISOString().split('T')[0] };
    }
    locked.push(date);
  }
  return { ok: true };
};

// @desc    Instantiate a new booking, lock availability, calculate billing
// @route   POST /api/bookings/create
// @access  Private (Customer)
export const createBooking = async (req, res) => {
  try {
    const { ashramId, roomId, checkInDate, checkOutDate, guestsCount, roomsBookedCount, services, promoCode, appliedOfferId } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room category not found' });
    }

    // B1: reject non-positive quantities and mismatched room/ashram — prevents
    // negative-price bookings and bookings that reference the wrong ashram.
    const guests = parseInt(guestsCount, 10);
    const roomsWanted = parseInt(roomsBookedCount, 10);
    if (!Number.isInteger(guests) || guests < 1 || !Number.isInteger(roomsWanted) || roomsWanted < 1) {
      return res.status(400).json({ success: false, message: 'guestsCount and roomsBookedCount must be positive integers' });
    }
    if (!ashramId || room.ashramId.toString() !== ashramId.toString()) {
      return res.status(400).json({ success: false, message: 'Room does not belong to the specified ashram' });
    }

    const startDate = new Date(checkInDate);
    const endDate = new Date(checkOutDate);
    
    if (startDate >= endDate) {
      return res.status(400).json({ success: false, message: 'Check-out date must be after check-in date' });
    }

    const daysCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    // 1. Verify availability and calculate base price
    let calculatedBasePrice = 0;
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const availability = await RoomAvailability.findOne({
        roomId: room._id,
        date: new Date(dateStr),
      });

      const booked = availability ? availability.bookedCount : 0;
      const maintenance = availability ? availability.maintenanceCount : 0;
      const activeInventory = room.totalInventory - maintenance;

      if (activeInventory - booked - roomsBookedCount < 0) {
        return res.status(400).json({
          success: false,
          message: `Rooms are fully booked or under maintenance on date: ${dateStr}`,
        });
      }

      let dailyPrice = room.basePrice;
      if (availability && availability.customPrice) {
        dailyPrice = availability.customPrice;
      } else {
        const rule = room.pricingRules.find((r) => d >= r.startDate && d <= r.endDate);
        if (rule) {
          dailyPrice = rule.overridePrice || (room.basePrice * rule.multiplier);
        }
      }
      calculatedBasePrice += dailyPrice * roomsBookedCount;
    }

    // 2. Add optional services pricing
    let servicesPrice = 0;
    const bookingServices = {
      prasad: { ordered: false, price: 0 },
      meals: { ordered: false, price: 0 },
      parking: { ordered: false, price: 0 },
      locker: { ordered: false, price: 0 },
      donation: { amount: 0 },
    };

    if (services) {
      if (Array.isArray(services.selectedAddOns) && services.selectedAddOns.length > 0) {
        bookingServices.selectedAddOns = services.selectedAddOns.map((item) => {
          const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
          const price = Math.max(0, parseFloat(item.price) || 0);
          let itemTotal = price * qty;
          if (item.unit === 'per_day') {
            itemTotal = price * qty * daysCount;
          } else if (item.unit === 'per_person') {
            itemTotal = price * qty * guestsCount;
          }
          servicesPrice += itemTotal;
          return {
            serviceId: item.serviceId || item._id,
            name: item.name,
            price,
            unit: item.unit || 'per_day',
            unitLabel: item.unitLabel || 'Day',
            quantity: qty,
            totalPrice: itemTotal,
          };
        });
      }

      if (services.prasad && services.prasad.ordered) {
        const price = (services.prasad.price || 100) * guestsCount;
        bookingServices.prasad = { ordered: true, price };
        servicesPrice += price;
      }
      if (services.meals && services.meals.ordered) {
        const price = (services.meals.price || 150) * guestsCount * daysCount;
        bookingServices.meals = { ordered: true, price };
        servicesPrice += price;
      }
      if (services.parking && services.parking.ordered) {
        const price = (services.parking.price || 100) * daysCount;
        bookingServices.parking = { ordered: true, price };
        servicesPrice += price;
      }
      if (services.locker && services.locker.ordered) {
        const price = (services.locker.price || 50) * daysCount;
        bookingServices.locker = { ordered: true, price };
        servicesPrice += price;
      }
      if (services.donation && services.donation.amount) {
        // B1: never allow a negative donation (would reduce the total).
        bookingServices.donation.amount = Math.max(0, parseFloat(services.donation.amount) || 0);
      }
    }

    const donationAmount = bookingServices.donation.amount;
    const originalAmount = calculatedBasePrice + servicesPrice + donationAmount;
    let discountAmount = 0;
    let validOffer = null;

    // 3. Offer & Promo Code Validation & Discount Calculation
    if (promoCode || appliedOfferId) {
      const cleanCode = promoCode ? promoCode.toUpperCase().trim() : undefined;
      const query = appliedOfferId ? { _id: appliedOfferId } : { promoCode: cleanCode };
      validOffer = await Offer.findOne({ ...query, status: 'active' });

      if (validOffer && validOffer.remainingRedemptions > 0) {
        if (validOffer.discountType === 'Percentage') {
          discountAmount = (originalAmount * validOffer.discountValue) / 100;
          if (validOffer.maximumDiscount > 0 && discountAmount > validOffer.maximumDiscount) {
            discountAmount = validOffer.maximumDiscount;
          }
        } else if (validOffer.discountType === 'Flat Amount') {
          discountAmount = Math.min(validOffer.discountValue, originalAmount);
        }
        discountAmount = Math.round(discountAmount);
      }
    }

    const extraGuestAmount = guestsCount > 2 ? (guestsCount - 2) * 200 * daysCount : 0;
    const mealAmount = bookingServices.meals.price;
    const upgradeAmount = 0;
    const loyaltyDiscount = req.body.loyaltyDiscount ? Number(req.body.loyaltyDiscount) : 0;
    const gstAmount = Math.round(originalAmount * 0.05);

    // Fetch dynamic Platform Fee from PlatformSettings database
    let platformFee = 49;
    try {
      const settings = await PlatformSettings.findOne({ key: 'main' });
      if (settings && settings.platformFee && settings.platformFee.enabled) {
        const feeConfig = settings.platformFee;
        if (feeConfig.type === 'percentage') {
          platformFee = Math.round((originalAmount * feeConfig.value) / 100);
        } else {
          platformFee = Math.round(feeConfig.value);
        }
      } else if (settings && settings.platformFee && !settings.platformFee.enabled) {
        platformFee = 0;
      }
    } catch (e) {
      console.warn('Fallback to default platform fee calculation');
    }

    const totalSavings = discountAmount + loyaltyDiscount;
    const calculatedFinalAmount = Math.max(0, Math.round(originalAmount - discountAmount - loyaltyDiscount + gstAmount + platformFee));
    const rewardPointsEarned = Math.round(calculatedFinalAmount * 0.05);
    const reservationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const paymentSummary = {
      originalStayCost: calculatedBasePrice,
      extraGuestAmount,
      mealAmount,
      upgradeAmount,
      servicesPrice,
      donationAmount,
      couponDiscount: discountAmount,
      loyaltyDiscount,
      gstAmount,
      platformFee,
      totalSavings,
      finalPayableAmount: calculatedFinalAmount,
    };

    // 3. Atomically lock room inventory immediately for Reservation Mode
    const lock = await lockInventory(room, startDate, endDate, roomsWanted);
    if (!lock.ok) {
      return res.status(409).json({
        success: false,
        message: `Rooms are no longer available on ${lock.failedDate}. Please choose alternate dates.`,
      });
    }

    const generatedBookingId = `TBK-${Math.floor(100000 + Math.random() * 900000)}`;
    const reservationNumber = `RES-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const checkInCode = `CHK-${Math.floor(1000 + Math.random() * 9000)}`;

    const booking = await Booking.create({
      bookingId: generatedBookingId,
      reservationNumber,
      customerId: req.user.id,
      ashramId,
      roomId,
      checkInDate: startDate,
      checkOutDate: endDate,
      guestsCount,
      roomsBookedCount: roomsWanted,
      services: bookingServices,
      offerId: validOffer ? validOffer._id : undefined,
      appliedOfferId: validOffer ? validOffer._id : undefined,
      offerName: validOffer ? validOffer.offerTitle : undefined,
      promoCode: validOffer ? validOffer.promoCode : (promoCode || undefined),
      discountType: validOffer ? validOffer.discountType : undefined,
      discountPercentage: validOffer && validOffer.discountType === 'Percentage' ? validOffer.discountValue : 0,
      loyaltyDiscount,
      rewardPointsUsed: req.body.rewardPointsUsed ? Number(req.body.rewardPointsUsed) : 0,
      rewardPointsEarned,
      reservationExpiresAt,
      paymentSummary,
      specialRequests: req.body.specialRequests || '',
      pricing: {
        basePrice: calculatedBasePrice,
        servicesPrice,
        donationAmount,
        extraGuestAmount,
        mealAmount,
        upgradeAmount,
        discountAmount,
        loyaltyDiscount,
        gstAmount,
        platformFee,
        originalAmount,
        finalAmount: calculatedFinalAmount,
        totalSavings,
        totalAmount: calculatedFinalAmount,
        amountPaid: 0,
      },
      paymentStatus: 'pending',
      paymentMode: 'pay_at_ashram',
      gatewayStatus: 'not_initiated',
      status: 'confirmed', // Reservation Confirmed Mode!
      checkInCode,
    });

    // 4. Increment Offer Telemetry & Analytics
    if (validOffer) {
      validOffer.redemptionsCount = (validOffer.redemptionsCount || 0) + 1;
      validOffer.remainingRedemptions = Math.max(0, (validOffer.remainingRedemptions || 1) - 1);
      validOffer.revenueGenerated = (validOffer.revenueGenerated || 0) + calculatedFinalAmount;
      await validOffer.save();
    }

    // Fetch ashram info for notifications
    const ashramDoc = await Ashram.findById(ashramId).select('name ownerId contact');

    const notificationPayload = {
      bookingId: booking.bookingId,
      reservationNumber: booking.reservationNumber,
      ashramId,
      ashramName: ashramDoc?.name || 'Sacred Ashram',
      ownerId: ashramDoc?.ownerId,
      roomName: room.name,
      guestName: req.user?.name || 'Valued Guest',
      guestPhone: req.user?.phone || 'Not provided',
      guestEmail: req.user?.email || 'guest@tirvona.com',
      checkInDate: startDate,
      checkOutDate: endDate,
      guestsCount,
      totalAmount: calculatedFinalAmount,
      specialRequests: req.body.specialRequests || 'None',
      checkInCode: booking.checkInCode,
    };

    // Dispatch Enterprise Notifications, Confirmation Email, and SMS Placeholder
    await dispatchBookingNotifications(notificationPayload);
    await sendBookingConfirmationEmail(notificationPayload);
    await sendBookingConfirmationSMS(notificationPayload);

    await emitBookingUpdate(req, booking, 'booking_confirmed');

    await AuditLog.create({
      userId: req.user.id,
      action: 'RESERVATION_MODE_BOOKING_CREATE',
      module: 'BOOKING_ENGINE',
      details: { bookingId: booking.bookingId, reservationNumber: booking.reservationNumber },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Reservation confirmed successfully! Pay upon check-in at Ashram.',
      data: booking,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ success: false, message: 'Server error instantiating reservation booking' });
  }
};

// @desc    Create a Razorpay payment order for a booking
// @route   POST /api/bookings/:id/payment/order
// @access  Private (Customer)
export const createPaymentOrder = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.customerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }
    if (booking.paymentStatus === 'fully_paid') {
      return res.status(400).json({ success: false, message: 'Booking is already paid' });
    }

    // When Razorpay is not configured, fall back to demo mode so local dev works.
    if (!isRazorpayConfigured()) {
      return res.json({ success: true, demo: true, data: { amount: booking.pricing.totalAmount } });
    }

    const order = await createRazorpayOrder(booking.pricing.totalAmount, booking.bookingId);
    res.json({
      success: true,
      demo: false,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: config.razorpay.keyId,
      },
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({ success: false, message: error.message || 'Could not initiate payment' });
  }
};

// @desc    Verify payment (Razorpay signature, or demo) and confirm the booking
// @route   POST /api/bookings/:id/payment
// @access  Private (Customer)
export const processBookingPayment = async (req, res) => {
  try {
    const { method, transactionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Only the booking owner may pay for it.
    if (booking.customerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay for this booking' });
    }

    if (booking.paymentStatus === 'fully_paid') {
      return res.status(400).json({ success: false, message: 'Booking is already paid' });
    }

    if (['cancelled', 'refunded'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'This booking can no longer be paid' });
    }

    // When Razorpay is configured, the checkout signature MUST be valid.
    if (isRazorpayConfigured()) {
      const valid = verifyRazorpaySignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });
      if (!valid) {
        return res.status(400).json({ success: false, message: 'Payment signature verification failed' });
      }
    }

    const room = await Room.findById(booking.roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room category no longer exists' });
    }

    const startDate = new Date(booking.checkInDate);
    const endDate = new Date(booking.checkOutDate);

    // 1. Atomically lock inventory BEFORE recording payment, so we never take
    //    money for an oversold room. Fails cleanly if capacity ran out.
    const lock = await lockInventory(room, startDate, endDate, booking.roomsBookedCount);
    if (!lock.ok) {
      return res.status(409).json({
        success: false,
        message: `Rooms are no longer available on ${lock.failedDate}. No payment was taken.`,
      });
    }

    // 2. Record the payment. If this fails, release the lock we just took.
    let payment;
    try {
      const usingRazorpay = isRazorpayConfigured() && razorpay_payment_id;
      payment = await Payment.create({
        bookingId: booking._id,
        userId: req.user.id,
        amount: booking.pricing.totalAmount,
        method: usingRazorpay ? 'razorpay' : (method || 'upi'),
        transactionId: usingRazorpay
          ? razorpay_payment_id
          : (transactionId || `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`),
        gatewayResponse: usingRazorpay
          ? { razorpay_order_id, razorpay_payment_id, razorpay_signature }
          : undefined,
        status: 'success',
      });
    } catch (payErr) {
      await releaseInventory(booking.roomId, startDate, endDate, booking.roomsBookedCount);
      throw payErr;
    }

    // 3. Complete booking updates
    booking.paymentStatus = 'fully_paid';
    booking.status = 'confirmed';
    booking.pricing.amountPaid = booking.pricing.totalAmount;
    booking.history.push({
      status: 'confirmed',
      updatedBy: req.user.id,
    });

    await booking.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'BOOKING_PAYMENT_SUCCESS',
      module: 'BOOKING_ENGINE',
      details: { bookingId: booking.bookingId, paymentId: payment._id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await emitBookingUpdate(req, booking, 'booking_confirmed');

    res.json({
      success: true,
      message: 'Payment verified successfully and booking confirmed',
      data: booking,
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ success: false, message: 'Error processing booking payment' });
  }
};

// @desc    Get user's booking history feed
// @route   GET /api/bookings/history
// @access  Private (Customer)
export const getBookingHistory = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.user.id })
      // `images` is additive: the profile booking list renders a thumbnail.
      // Existing consumers of this endpoint are unaffected by the extra field.
      .populate('ashramId', 'name address rules images')
      .populate('roomId', 'name acType type')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching history feed' });
  }
};

// @desc    Get a single booking by id (owner customer, or scoped staff/admin)
// @route   GET /api/bookings/:id
// @access  Private
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('ashramId', 'name address rules')
      .populate('roomId', 'name acType type')
      .populate('customerId', 'name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const customerId = booking.customerId?._id?.toString() || booking.customerId?.toString();
    const isOwnerCustomer = customerId === req.user.id;

    let allowed = isOwnerCustomer;
    if (!allowed) {
      // Staff/admin may view bookings for ashrams they are scoped to.
      const ids = await scopedAshramIds(req.user, Ashram);
      const ashramId = booking.ashramId?._id?.toString() || booking.ashramId?.toString();
      allowed = ids === null || ids.some((id) => id.toString() === ashramId);
    }

    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Get booking by id error:', error);
    res.status(500).json({ success: false, message: 'Error fetching booking' });
  }
};

// @desc    Get bookings for dashboard lists (Owner, Staff, Manager views)
// @route   GET /api/bookings/dashboard
// @access  Private (Owner, Manager, Reception, Housekeeping)
export const getDashboardBookings = async (req, res) => {
  try {
    const { ashramId, status, date } = req.query;

    const query = {};
    // Determine which ashrams this user is allowed to see (null = all, for super_admin).
    const allowedIds = await scopedAshramIds(req.user, Ashram);
    if (allowedIds !== null) {
      const allowedStrs = allowedIds.map((id) => id.toString());
      if (ashramId) {
        if (!allowedStrs.includes(ashramId.toString())) {
          return res.status(403).json({ success: false, message: 'Not authorized for this ashram' });
        }
        query.ashramId = ashramId;
      } else {
        query.ashramId = { $in: allowedIds };
      }
    } else if (ashramId) {
      query.ashramId = ashramId;
    }
    if (status) query.status = status;
    
    if (date) {
      const searchDate = new Date(date);
      const nextDate = new Date(searchDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      query.checkInDate = { $gte: searchDate, $lt: nextDate };
    }

    const bookings = await Booking.find(query)
      .populate('customerId', 'name email phone')
      .populate('roomId', 'name type')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error('Dashboard bookings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching dashboard feed' });
  }
};

// @desc    Verify counter check-in code
// @route   POST /api/bookings/:id/checkin
// @access  Private (Reception, Manager, Owner)
export const verifyCheckin = async (req, res) => {
  try {
    const { checkInCode } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // C5: staff may only check in bookings for ashrams they are scoped to.
    const scopedIds = await scopedAshramIds(req.user, Ashram);
    if (scopedIds !== null && !scopedIds.some((id) => id.toString() === booking.ashramId.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized for this ashram' });
    }

    if (booking.checkInCode !== checkInCode) {
      return res.status(400).json({ success: false, message: 'Incorrect dynamic check-in code' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: `Booking status is currently: ${booking.status}` });
    }

    booking.status = 'checked_in';
    booking.history.push({
      status: 'checked_in',
      updatedBy: req.user.id,
    });

    await booking.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'BOOKING_CHECK_IN',
      module: 'BOOKING_ENGINE',
      details: { bookingId: booking.bookingId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await emitBookingUpdate(req, booking, 'checked_in');

    res.json({
      success: true,
      message: 'Check-in verified successfully. Room is officially occupied.',
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error verifying check-in' });
  }
};

// @desc    Perform check-out release
// @route   POST /api/bookings/:id/checkout
// @access  Private (Reception, Manager, Owner)
export const verifyCheckout = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // C5: staff may only check out bookings for ashrams they are scoped to.
    const scopedIds = await scopedAshramIds(req.user, Ashram);
    if (scopedIds !== null && !scopedIds.some((id) => id.toString() === booking.ashramId.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized for this ashram' });
    }

    if (booking.status !== 'checked_in') {
      return res.status(400).json({ success: false, message: 'Booking is not currently checked-in' });
    }

    booking.status = 'checked_out';
    booking.history.push({
      status: 'checked_out',
      updatedBy: req.user.id,
    });

    await booking.save();

    // Release booked RoomAvailability metrics so rooms can be cleaned and available for future booking
    await releaseInventory(
      booking.roomId,
      new Date(booking.checkInDate),
      new Date(booking.checkOutDate),
      booking.roomsBookedCount
    );

    await AuditLog.create({
      userId: req.user.id,
      action: 'BOOKING_CHECK_OUT',
      module: 'BOOKING_ENGINE',
      details: { bookingId: booking.bookingId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await emitBookingUpdate(req, booking, 'checked_out');

    res.json({
      success: true,
      message: 'Check-out completed and rooms scheduled for cleaning.',
      data: booking,
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ success: false, message: 'Error verifying check-out' });
  }
};

// @desc    Cancel a booking and release dates
// @route   POST /api/bookings/:id/cancel
// @access  Private (Customer / Owner / Manager / Super Admin)
export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isCustomer = booking.customerId.toString() === req.user.id;
    if (!isCustomer) {
      if (req.user.role !== 'owner' && req.user.role !== 'manager' && req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
      }
      // C5: owners/managers may only cancel bookings for ashrams they are scoped to.
      const scopedIds = await scopedAshramIds(req.user, Ashram);
      if (scopedIds !== null && !scopedIds.some((id) => id.toString() === booking.ashramId.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized for this ashram' });
      }
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }
    
    if (booking.status === 'checked_in' || booking.status === 'checked_out' || booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel active or completed stays' });
    }

    // Only paid bookings (confirmed) actually hold inventory that must be released.
    const heldInventory = booking.status === 'confirmed';
    const wasPaid = booking.pricing.amountPaid > 0;

    booking.status = 'cancelled';
    booking.cancellation = {
      reason: req.body.reason || 'Cancelled by user',
      date: new Date(),
      refundAmount: booking.pricing.amountPaid,
      refundTransactionId: wasPaid ? `REF-${Math.floor(10000000 + Math.random() * 90000000)}` : undefined,
    };
    booking.paymentStatus = wasPaid ? 'refunded' : 'pending';
    booking.pricing.amountPaid = 0;

    booking.history.push({
      status: 'cancelled',
      updatedBy: req.user.id,
    });

    await booking.save();

    // Release RoomAvailability only if this booking had locked inventory.
    if (heldInventory) {
      await releaseInventory(
        booking.roomId,
        new Date(booking.checkInDate),
        new Date(booking.checkOutDate),
        booking.roomsBookedCount
      );
    }

    await AuditLog.create({
      userId: req.user.id,
      action: 'BOOKING_CANCEL',
      module: 'BOOKING_ENGINE',
      details: { bookingId: booking.bookingId, refundAmount: booking.cancellation.refundAmount },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error('Dashboard bookings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching dashboard feed' });
  }
};

// @desc    Verify counter check-in code
// @route   POST /api/bookings/:id/checkin
// @access  Private (Reception, Manager, Owner)
export const verifyCheckin = async (req, res) => {
  try {
    const { checkInCode } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // C5: staff may only check in bookings for ashrams they are scoped to.
    const scopedIds = await scopedAshramIds(req.user, Ashram);
    if (scopedIds !== null && !scopedIds.some((id) => id.toString() === booking.ashramId.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized for this ashram' });
    }

    if (booking.checkInCode !== checkInCode) {
      return res.status(400).json({ success: false, message: 'Incorrect dynamic check-in code' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: `Booking status is currently: ${booking.status}` });
    }

    booking.status = 'checked_in';
    booking.history.push({
      status: 'checked_in',
      updatedBy: req.user.id,
    });

    await booking.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'BOOKING_CHECK_IN',
      module: 'BOOKING_ENGINE',
      details: { bookingId: booking.bookingId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await emitBookingUpdate(req, booking, 'checked_in');

    res.json({
      success: true,
      message: 'Check-in verified successfully. Room is officially occupied.',
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error verifying check-in' });
  }
};

// @desc    Perform check-out release
// @route   POST /api/bookings/:id/checkout
// @access  Private (Reception, Manager, Owner)
export const verifyCheckout = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // C5: staff may only check out bookings for ashrams they are scoped to.
    const scopedIds = await scopedAshramIds(req.user, Ashram);
    if (scopedIds !== null && !scopedIds.some((id) => id.toString() === booking.ashramId.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized for this ashram' });
    }

    if (booking.status !== 'checked_in') {
      return res.status(400).json({ success: false, message: 'Booking is not currently checked-in' });
    }

    booking.status = 'checked_out';
    booking.history.push({
      status: 'checked_out',
      updatedBy: req.user.id,
    });

    await booking.save();

    // Release booked RoomAvailability metrics so rooms can be cleaned and available for future booking
    await releaseInventory(
      booking.roomId,
      new Date(booking.checkInDate),
      new Date(booking.checkOutDate),
      booking.roomsBookedCount
    );

    await AuditLog.create({
      userId: req.user.id,
      action: 'BOOKING_CHECK_OUT',
      module: 'BOOKING_ENGINE',
      details: { bookingId: booking.bookingId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await emitBookingUpdate(req, booking, 'checked_out');

    res.json({
      success: true,
      message: 'Check-out completed and rooms scheduled for cleaning.',
      data: booking,
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ success: false, message: 'Error verifying check-out' });
  }
};

// @desc    Cancel a booking and release dates
// @route   POST /api/bookings/:id/cancel
// @access  Private (Customer / Owner / Manager / Super Admin)
export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isCustomer = booking.customerId.toString() === req.user.id;
    if (!isCustomer) {
      if (req.user.role !== 'owner' && req.user.role !== 'manager' && req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
      }
      // C5: owners/managers may only cancel bookings for ashrams they are scoped to.
      const scopedIds = await scopedAshramIds(req.user, Ashram);
      if (scopedIds !== null && !scopedIds.some((id) => id.toString() === booking.ashramId.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized for this ashram' });
      }
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }
    
    if (booking.status === 'checked_in' || booking.status === 'checked_out' || booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel active or completed stays' });
    }

    // Only paid bookings (confirmed) actually hold inventory that must be released.
    const heldInventory = booking.status === 'confirmed';
    const wasPaid = booking.pricing.amountPaid > 0;

    booking.status = 'cancelled';
    booking.cancellation = {
      reason: req.body.reason || 'Cancelled by user',
      date: new Date(),
      refundAmount: booking.pricing.amountPaid,
      refundTransactionId: wasPaid ? `REF-${Math.floor(10000000 + Math.random() * 90000000)}` : undefined,
    };
    booking.paymentStatus = wasPaid ? 'refunded' : 'pending';
    booking.pricing.amountPaid = 0;

    booking.history.push({
      status: 'cancelled',
      updatedBy: req.user.id,
    });

    await booking.save();

    // Release RoomAvailability only if this booking had locked inventory.
    if (heldInventory) {
      await releaseInventory(
        booking.roomId,
        new Date(booking.checkInDate),
        new Date(booking.checkOutDate),
        booking.roomsBookedCount
      );
    }

    await AuditLog.create({
      userId: req.user.id,
      action: 'BOOKING_CANCEL',
      module: 'BOOKING_ENGINE',
      details: { bookingId: booking.bookingId, refundAmount: booking.cancellation.refundAmount },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await emitBookingUpdate(req, booking, 'cancelled');

    res.json({
      success: true,
      message: 'Booking cancelled successfully and availability restored.',
      data: booking,
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, message: 'Server error cancelling booking' });
  }
};

// @desc    Assign room number to a booking (e.g. Room 102)
// @route   PUT /api/bookings/:id/room-number
// @access  Private (Owner / Manager / Reception / Super Admin)
export const assignRoomNumber = async (req, res) => {
  try {
    const { roomNumber } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const cleanRoomNo = roomNumber ? roomNumber.trim() : '';

    // If assigning a non-empty room number, verify no overlapping active booking has the same room assigned
    if (cleanRoomNo) {
      const conflict = await Booking.findOne({
        _id: { $ne: booking._id },
        ashramId: booking.ashramId,
        assignedRoomNumber: cleanRoomNo,
        status: { $in: ['confirmed', 'checked_in'] },
        checkInDate: { $lt: booking.checkOutDate },
        checkOutDate: { $gt: booking.checkInDate },
      });

      if (conflict) {
        return res.status(400).json({
          success: false,
          message: `"${cleanRoomNo}" is already assigned to Booking ${conflict.bookingId} for overlapping dates (${new Date(conflict.checkInDate).toLocaleDateString('en-IN')} to ${new Date(conflict.checkOutDate).toLocaleDateString('en-IN')}).`,
        });
      }
    }

    booking.assignedRoomNumber = cleanRoomNo;
    await booking.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'BOOKING_ASSIGN_ROOM_NUMBER',
      module: 'BOOKING_ENGINE',
      details: { bookingId: booking.bookingId, roomNumber: cleanRoomNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Room number "${cleanRoomNo}" assigned successfully.`,
      data: booking,
    });
  } catch (error) {
    console.error('Assign room number error:', error);
    res.status(500).json({ success: false, message: 'Error assigning room number' });
  }
};

// @desc    Update status of a booking (Stay Admin action)
// @route   PUT /api/bookings/:id/status
// @access  Private (Owner / Manager / Reception / Super Admin)
export const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid booking status value' });
    }

    booking.status = status;
    booking.history.push({
      status,
      updatedBy: req.user.id,
    });
    await booking.save();

    await emitBookingUpdate(req, booking, `status_${status}`);

    res.json({
      success: true,
      message: `Booking status updated to ${status}.`,
      data: booking,
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ success: false, message: 'Error updating booking status' });
  }
};
