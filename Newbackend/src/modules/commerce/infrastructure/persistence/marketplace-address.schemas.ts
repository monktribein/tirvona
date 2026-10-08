import { Schema, SchemaTypes } from "mongoose";

const id = (ref: string, required = false) => ({
  type: SchemaTypes.ObjectId,
  ref,
  required,
  default: required ? undefined : null,
});

const opts = (collection: string) => ({
  timestamps: true,
  collection,
  optimisticConcurrency: true,
});

export const MarketplaceAddressSchema = new Schema(
  {
    customerId: id("User", true),
    label: { type: String, default: "Home", trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, default: "", trim: true },
    landmark: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, default: "India", trim: true },
    isDefault: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  opts("marketplace_addresses"),
);
MarketplaceAddressSchema.index({ customerId: 1, isDeleted: 1, isDefault: -1 });

export const MARKETPLACE_ADDRESS_MODELS = [
  { name: "MarketplaceAddress", schema: MarketplaceAddressSchema },
];
