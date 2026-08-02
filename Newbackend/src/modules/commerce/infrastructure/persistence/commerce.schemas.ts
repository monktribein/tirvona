import { Schema, SchemaTypes } from "mongoose";
const loose = (collection: string, fields: any = {}): Schema =>
  new Schema(fields, { strict: false, timestamps: true, collection });
export const COMMERCE_MODELS = [
  { name: "MarketplaceCategory", schema: loose("marketplacecategories") },
  { name: "MarketplaceProduct", schema: loose("marketplaceproducts") },
  {
    name: "MarketplaceOrder",
    schema: loose("marketplaceorders", {
      customerId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
    }),
  },
  {
    name: "MarketplaceWaitlist",
    schema: loose("marketplacewaitlists", {
      email: { type: String, lowercase: true, unique: true, index: true },
    }),
  },
  { name: "ServiceProvider", schema: loose("serviceproviders") },
  {
    name: "ServiceBooking",
    schema: loose("servicebookings", {
      serviceId: {
        type: SchemaTypes.ObjectId,
        ref: "ServiceProvider",
        index: true,
      },
      customerId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
    }),
  },
];
COMMERCE_MODELS[1].schema.index({ status: 1, category: 1, createdAt: -1 });
COMMERCE_MODELS[4].schema.index({
  status: 1,
  category: 1,
  city: 1,
  rating: -1,
});
