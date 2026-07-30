import mongoose from 'mongoose';

const marketplaceOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceProduct' },
        productName: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, default: 1 },
        templeSource: { type: String },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'upi', 'card', 'netbanking'],
      default: 'upi',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'paid',
    },
    orderStatus: {
      type: String,
      enum: ['processing', 'shipped', 'delivered', 'cancelled'],
      default: 'processing',
    },
  },
  {
    timestamps: true,
  }
);

// Customer order history and the admin fulfilment queue. (`orderNumber` is
// already indexed by its unique: true.)
marketplaceOrderSchema.index({ customerId: 1, createdAt: -1 });
marketplaceOrderSchema.index({ orderStatus: 1, createdAt: -1 });
marketplaceOrderSchema.index({ paymentStatus: 1, createdAt: -1 });

const MarketplaceOrder = mongoose.models.MarketplaceOrder || mongoose.model('MarketplaceOrder', marketplaceOrderSchema);
export default MarketplaceOrder;
