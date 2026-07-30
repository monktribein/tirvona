import mongoose from 'mongoose';

// parking_partners — the commercial entity that operates one or more parking
// locations. Linked to an existing User account (`userId`) rather than adding a
// role to the User model, so the core auth schema stays untouched.
const parkingPartnerSchema = new mongoose.Schema(
  {
    partnerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    // FK → users._id. The person who signs in to manage this partner account.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: { type: String, trim: true, default: '' },
    contactEmail: { type: String, trim: true, lowercase: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
    gstNumber: { type: String, trim: true, default: '' },
    panNumber: { type: String, trim: true, default: '' },
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      district: { type: String, default: '' },
      state: { type: String, default: '', index: true },
      pincode: { type: String, default: '' },
    },
    bankAccount: {
      accountHolder: { type: String, default: '' },
      // Last four digits only — full account numbers are never stored here.
      accountLast4: { type: String, default: '' },
      ifsc: { type: String, default: '' },
      bankName: { type: String, default: '' },
    },
    documents: [
      {
        docType: { type: String, trim: true },
        url: { type: String, trim: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    // Commission percentage negotiated with this partner. Falls back to the
    // platform default in parking_settings when null.
    commissionPercent: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'rejected'],
      default: 'pending',
    },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    // FK → users._id (the super admin who approved this partner).
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'parking_partners' }
);

parkingPartnerSchema.index({ status: 1, createdAt: -1 });
parkingPartnerSchema.index({ 'address.city': 1, status: 1 });

const ParkingPartner = mongoose.model('ParkingPartner', parkingPartnerSchema);
export default ParkingPartner;
