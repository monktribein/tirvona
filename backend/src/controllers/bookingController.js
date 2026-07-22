import Booking from '../models/Booking.js';
import RoomAvailability from '../models/RoomAvailability.js';
import Room from '../models/Room.js';
import Payment from '../models/Payment.js';
import AuditLog from '../models/AuditLog.js';
import Ashram from '../models/Ashram.js';

// @desc    Instantiate a new booking, lock availability, calculate billing
// @route   POST /api/bookings/create
// @access  Private (Customer)
export const createBooking = async (req, res) => {
  try {
    const { ashramId, roomId, checkInDate, checkOutDate, guestsCount, roomsBookedCount, services } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room category not found' });
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

      // Calculate price for this specific night
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
      if (services.prasad && services.prasad.ordered) {
        // Sacred Prasad priced at ₹100 per guest
        const price = 100 * guestsCount;
        bookingServices.prasad = { ordered: true, price };
        servicesPrice += price;
      }
      if (services.meals && services.meals.ordered) {
        // Meals priced at ₹150 per person per day
        const price = 150 * guestsCount * daysCount;
        bookingServices.meals = { ordered: true, price };
        servicesPrice += price;
      }
      if (services.parking && services.parking.ordered) {
        // Parking priced at ₹100 per day
        const price = 100 * daysCount;
        bookingServices.parking = { ordered: true, price };
        servicesPrice += price;
      }
      if (services.locker && services.locker.ordered) {
        // Locker priced at ₹50 per day
        const price = 50 * daysCount;
        bookingServices.locker = { ordered: true, price };
        servicesPrice += price;
      }
      if (services.donation && services.donation.amount) {
        bookingServices.donation.amount = parseFloat(services.donation.amount);
      }
    }

    const donationAmount = bookingServices.donation.amount;
    const totalAmount = calculatedBasePrice + servicesPrice + donationAmount;

    // Generate unique booking credentials
    const year = new Date().getFullYear();
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
    const bookingId = `AB-${year}-${randomHex}`;
    const checkInCode = Math.floor(100000 + Math.random() * 900000).toString();

    const booking = await Booking.create({
      bookingId,
      customerId: req.user.id,
      ashramId,
      roomId,
      checkInDate: startDate,
      checkOutDate: endDate,
      guestsCount,
      roomsBookedCount,
      services: bookingServices,
      pricing: {
        basePrice: calculatedBasePrice,
        servicesPrice,
        donationAmount,
        totalAmount,
        amountPaid: 0,
      },
      paymentStatus: 'pending',
      status: 'pending',
      checkInCode,
    });

    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ success: false, message: 'Server error instantiating booking' });
  }
};

// @desc    Mock Razorpay Payment Handshake
// @route   POST /api/bookings/:id/payment
// @access  Private (Customer)
export const processBookingPayment = async (req, res) => {
  try {
    const { method, transactionId } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.paymentStatus === 'fully_paid') {
      return res.status(400).json({ success: false, message: 'Booking is already paid' });
    }

    // 1. Create financial payment log
    const payment = await Payment.create({
      bookingId: booking._id,
      userId: req.user.id,
      amount: booking.pricing.totalAmount,
      method: method || 'upi',
      transactionId: transactionId || `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
      status: 'success',
    });

    // 2. Lock and increment dates in RoomAvailability
    const startDate = new Date(booking.checkInDate);
    const endDate = new Date(booking.checkOutDate);

    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      await RoomAvailability.findOneAndUpdate(
        { roomId: booking.roomId, date: new Date(dateStr) },
        { $inc: { bookedCount: booking.roomsBookedCount } },
        { upsert: true, new: true }
      );
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
      .populate('ashramId', 'name address rules')
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

// @desc    Get bookings for dashboard lists (Owner, Staff, Manager views)
// @route   GET /api/bookings/dashboard
// @access  Private (Owner, Manager, Reception, Housekeeping)
export const getDashboardBookings = async (req, res) => {
  try {
    const { ashramId, status, date } = req.query;

    const query = {};
    if (ashramId) {
      query.ashramId = ashramId;
    } else if (req.user.role !== 'super_admin') {
      const myAshrams = await Ashram.find({ ownerId: req.user.id });
      const ids = myAshrams.map((a) => a._id);
      query.ashramId = { $in: ids };
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
    const startDate = new Date(booking.checkInDate);
    const endDate = new Date(booking.checkOutDate);
    
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      await RoomAvailability.findOneAndUpdate(
        { roomId: booking.roomId, date: new Date(dateStr) },
        { $inc: { bookedCount: -booking.roomsBookedCount } }
      );
    }

    await AuditLog.create({
      userId: req.user.id,
      action: 'BOOKING_CHECK_OUT',
      module: 'BOOKING_ENGINE',
      details: { bookingId: booking.bookingId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

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
    if (!isCustomer && req.user.role !== 'owner' && req.user.role !== 'manager' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }
    
    if (booking.status === 'checked_in' || booking.status === 'checked_out' || booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel active or completed stays' });
    }

    booking.status = 'cancelled';
    booking.cancellation = {
      reason: req.body.reason || 'Cancelled by user',
      date: new Date(),
      refundAmount: booking.pricing.amountPaid,
      refundTransactionId: `REF-${Math.floor(10000000 + Math.random() * 90000000)}`,
    };
    booking.paymentStatus = 'refunded';
    booking.pricing.amountPaid = 0;
    
    booking.history.push({
      status: 'cancelled',
      updatedBy: req.user.id,
    });

    await booking.save();

    // Release RoomAvailability bookedCount
    const startDate = new Date(booking.checkInDate);
    const endDate = new Date(booking.checkOutDate);

    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      await RoomAvailability.findOneAndUpdate(
        { roomId: booking.roomId, date: new Date(dateStr) },
        { $inc: { bookedCount: -booking.roomsBookedCount } }
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

    res.json({
      success: true,
      message: 'Booking cancelled successfully and availability restored.',
      data: booking,
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, message: 'Error cancelling booking' });
  }
};

