import mongoose from 'mongoose';

// parking_holidays — dates that carry peak pricing or a closure.
//
// Built for the events that actually move demand at these destinations: Kumbh,
// Kanwar Yatra, Shivratri, Janmashtami. A row applies platform-wide, to one
// partner, or to one facility.
const parkingHolidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    // Null on both = platform-wide.
    // FK → parking_partners._id
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingPartner',
      default: null,
      index: true,
    },
    // FK → parking_locations._id
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      default: null,
    },

    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },

    // Applied on top of the rate card for every date in the window.
    peakMultiplier: { type: Number, default: 1, min: 0 },
    // A closed window blocks new bookings outright.
    isClosed: { type: Boolean, default: false },

    type: {
      type: String,
      enum: ['festival', 'peak_season', 'maintenance', 'closure', 'public_holiday'],
      default: 'festival',
    },

    isActive: { type: Boolean, default: true },
    // FK → users._id
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'parking_holidays' }
);

// The date-window lookup run on every quote.
parkingHolidaySchema.index({ isActive: 1, startDate: 1, endDate: 1 });
parkingHolidaySchema.index({ locationId: 1, isActive: 1, startDate: 1 });

const ParkingHoliday = mongoose.model('ParkingHoliday', parkingHolidaySchema);
export default ParkingHoliday;
