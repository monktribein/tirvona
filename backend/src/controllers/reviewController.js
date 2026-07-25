import Review from '../models/Review.js';
import Ashram from '../models/Ashram.js';
import Booking from '../models/Booking.js';

// @desc    Create a new review
// @route   POST /api/reviews
// @access  Private (Customer)
export const createReview = async (req, res) => {
  try {
    const { ashramId, bookingId, rating, comment } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Verify booking belongs to customer
    if (booking.customerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to review this stay' });
    }

    // Only completed stays can be reviewed.
    if (!['checked_out', 'completed'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'You can only review a stay after checkout' });
    }

    // A review must be for the ashram that was actually booked.
    if (booking.ashramId.toString() !== ashramId) {
      return res.status(400).json({ success: false, message: 'Review does not match the booked ashram' });
    }

    // Check if review already exists for booking
    const reviewExists = await Review.findOne({ bookingId });
    if (reviewExists) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this stay' });
    }

    const review = await Review.create({
      customerId: req.user.id,
      ashramId,
      bookingId,
      rating,
      comment,
      status: 'approved',
    });

    // Recalculate Ashram average rating
    const reviews = await Review.find({ ashramId, status: 'approved' });
    const count = reviews.length;
    const sum = reviews.reduce((acc, curr) => acc + curr.rating.overall, 0);
    const average = count > 0 ? parseFloat((sum / count).toFixed(1)) : 0;

    await Ashram.findByIdAndUpdate(ashramId, {
      'rating.average': average,
      'rating.count': count,
    });

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ success: false, message: 'Server error saving review' });
  }
};

// @desc    Get all approved reviews for an ashram
// @route   GET /api/reviews/ashram/:ashramId
// @access  Public
export const getAshramReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ ashramId: req.params.ashramId, status: 'approved' })
      .populate('customerId', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error('Fetch reviews error:', error);
    res.status(500).json({ success: false, message: 'Error loading reviews feed' });
  }
};
