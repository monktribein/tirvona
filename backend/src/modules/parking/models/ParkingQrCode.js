import mongoose from 'mongoose';

// parking_qr_codes — the issued pass for a confirmed booking.
//
// The scannable payload is an AES-256-GCM sealed token (see utils/parkingCrypto)
// carrying booking id, location id, visitor id, vehicle number and validity.
// Only the token's SHA-256 digest is persisted here, so a database dump does not
// hand out working passes — the same discipline the OTP model uses.
const parkingQrCodeSchema = new mongoose.Schema(
  {
    // FK → parking_bookings._id. One live pass per booking.
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingBooking',
      required: true,
      index: true,
    },
    // FK → parking_locations._id — checked on scan so a pass issued for one
    // facility cannot open the gate at another.
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
      index: true,
    },
    // FK → users._id
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // SHA-256 of the sealed token. The token itself is never stored.
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    // Short public handle printed under the QR, for a human read-out over the
    // phone. Not a credential on its own — scanning still requires the token.
    displayCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    // Bumped whenever a pass is reissued; an older token fails the check.
    version: { type: Number, default: 1 },

    issuedAt: { type: Date, default: Date.now },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true, index: true },

    // Entry is single-use; exit closes the pass out.
    entryScannedAt: { type: Date, default: null },
    exitScannedAt: { type: Date, default: null },
    scanCount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['active', 'used', 'expired', 'revoked'],
      default: 'active',
      index: true,
    },
    revokedReason: { type: String, default: '' },
  },
  { timestamps: true, collection: 'parking_qr_codes' }
);

// The scan lookup: hash the presented token, find the live pass.
parkingQrCodeSchema.index({ tokenHash: 1, status: 1 });
parkingQrCodeSchema.index({ bookingId: 1, version: -1 });
parkingQrCodeSchema.index({ displayCode: 1 });

const ParkingQrCode = mongoose.model('ParkingQrCode', parkingQrCodeSchema);
export default ParkingQrCode;
