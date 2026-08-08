import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import type { CommerceRepository } from "../../domain/commerce.repository";

@Injectable()
export class MongooseCommerceRepository implements CommerceRepository {
  private readonly models: Record<string, Model<any>>;
  constructor(
    @InjectModel("MarketplaceCategory") categories: Model<any>,
    @InjectModel("MarketplaceProduct") products: Model<any>,
    @InjectModel("MarketplaceOrder") orders: Model<any>,
    @InjectModel("MarketplaceWaitlist") waitlist: Model<any>,
    @InjectModel("ServiceProvider") providers: Model<any>,
    @InjectModel("ServiceBooking") serviceBookings: Model<any>,
  ) {
    this.models = {
      categories,
      products,
      orders,
      waitlist,
      providers,
      serviceBookings,
    };
  }
  private model(name: string): Model<any> {
    const value = this.models[name];
    if (!value) throw new Error(`Unknown commerce model: ${name}`);
    return value;
  }
  list(
    name: string,
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    skip: number,
    limit: number,
  ): Promise<any[]> {
    return this.model(name)
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }
  count(name: string, filter: Record<string, unknown>): Promise<number> {
    return this.model(name).countDocuments(filter);
  }
  one(name: string, filter: Record<string, unknown>): Promise<any | null> {
    return this.model(name).findOne(filter).lean();
  }
  create(name: string, payload: Record<string, unknown>): Promise<any> {
    return this.model(name).create(payload);
  }
  async update(
    name: string,
    id: string,
    payload: Record<string, unknown>,
  ): Promise<any | null> {
    const isObjectId = Types.ObjectId.isValid(id);
    const filter = isObjectId
      ? { _id: id }
      : { $or: [{ _id: id }, { slug: id }] };
    let doc = await this.model(name)
      .findOneAndUpdate(filter, payload, { new: true, runValidators: true })
      .lean();
    if (!doc && !isObjectId) {
      doc = await this.model(name)
        .findOneAndUpdate(
          { slug: id },
          { ...payload, slug: id },
          { new: true, upsert: true, runValidators: true },
        )
        .lean();
    }
    return doc;
  }
  remove(name: string, id: string): Promise<any | null> {
    const filter = Types.ObjectId.isValid(id)
      ? { _id: id }
      : { $or: [{ _id: id }, { slug: id }] };
    return this.model(name).findOneAndDelete(filter).lean();
  }
}
