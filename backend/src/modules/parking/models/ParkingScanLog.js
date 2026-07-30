import mongoose from 'mongoose';
import {
  PARKING_SCAN_ACTIONS,
  PARKING_SCAN_RESULTS,
} from '../config/parkingConfig.js';

// parking_scan_logs — every gate scan, successful or not.
//
// Written on the failure paths too (bad token, wrong facility, expired pass), so
// a disputed entry or a probing attempt is answerable from the record rather
// than from guesswork. Super Admin reads these as "QR Logs".
const parkingScanLogSchema = new mongoose.Schema(
  {
    // FK → parking_bookings._id. Null when the token resolved to nothing.
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingBooking',
      default: null,
    },
    // FK → parking_qr_codes._id
    qrCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingQrCode',
      default: null,
      index: true,
    },
    // FK → parking_locations._id — the facility where the scan happened.
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
    },
    // FK → users._id — the guard/manager who scanned.
    scannedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // FK → parking_staff._id
    scannedByStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingStaff',
      default: null,
    },

    action: {
      type: String,
      enum: Object.values(PARKING_SCAN_ACTIONS),
      required: true,
      index: true,
    },
    result: {
      type: String,
      enum: Object.values(PARKING_SCAN_RESULTS),
      required: true,
    },

    // Recorded on failures for forensics. Truncated and never the full token, so
    // the log itself cannot be mined for a working pass.
    tokenFingerprint: { type: String, default: '' },

    vehicleNumber: { type: String, default: '', uppercase: true, trim: true },
    assignedSlotNumber: { type: String, default: '' },
    message: { type: String, default: '' },

    deviceInfo: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    scannedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'parking_scan_logs' }
);

// Audit views: per facility over time, and the full trail for one booking.
parkingScanLogSchema.index({ locationId: 1, scannedAt: -1 });
parkingScanLogSchema.index({ bookingId: 1, scannedAt: -1 });
parkingScanLogSchema.index({ result: 1, scannedAt: -1 });

const ParkingScanLog = mongoose.model('ParkingScanLog', parkingScanLogSchema);
export default ParkingScanLog;
