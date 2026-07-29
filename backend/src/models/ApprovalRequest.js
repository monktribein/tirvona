import mongoose from 'mongoose';

const approvalRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
    },
    module: {
      type: String,
      enum: [
        'ashram',
        'room_category',
        'room',
        'amenities',
        'pricing',
        'offer',
        'gallery',
        'volunteer',
        'marketplace',
        'service',
        'blog',
        'event',
        'temple',
        'banner',
        'other',
      ],
      required: true,
      default: 'other',
    },
    entityType: {
      type: String,
      default: 'GeneralEntity',
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    ashramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
    },
    stayAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    requestedData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    currentData: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'needs_changes', 'expired', 'cancelled'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    reviewComment: {
      type: String,
      default: '',
    },
    comments: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        text: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    history: [
      {
        status: String,
        comment: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

approvalRequestSchema.index({ module: 1, status: 1 });
approvalRequestSchema.index({ ashramId: 1, status: 1 });
approvalRequestSchema.index({ stayAdminId: 1 });
approvalRequestSchema.index({ priority: 1 });

const ApprovalRequest = mongoose.model('ApprovalRequest', approvalRequestSchema, 'approval_requests');
export default ApprovalRequest;
