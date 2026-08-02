import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { CommunityRepository } from "../../domain/community.repository";
@Injectable()
export class MongooseCommunityRepository implements CommunityRepository {
  private readonly models: Record<string, Model<any>>;
  constructor(
    @InjectModel("UserMemory") memories: Model<any>,
    @InjectModel("VolunteerJob") jobs: Model<any>,
    @InjectModel("VolunteerApplication") applications: Model<any>,
    @InjectModel("VisitorArticle") articles: Model<any>,
    @InjectModel("VisitorArticleComment") comments: Model<any>,
    @InjectModel("VisitorArticleLike") likes: Model<any>,
    @InjectModel("VisitorArticleStatusHistory") histories: Model<any>,
    @InjectModel("CommunityNotification") notifications: Model<any>,
    @InjectModel("CommunityBooking") bookings: Model<any>,
    @InjectModel("CommunityAshram") ashrams: Model<any>,
  ) {
    this.models = {
      memories,
      jobs,
      applications,
      articles,
      comments,
      likes,
      histories,
      notifications,
      bookings,
      ashrams,
    };
  }
  private model(name: string): Model<any> {
    const value = this.models[name];
    if (!value) throw new Error(`Unknown community model: ${name}`);
    return value;
  }
  async list(
    name: string,
    filter: Record<string, unknown> = {},
    options: Record<string, any> = {},
  ): Promise<any[]> {
    let query = this.model(name).find(filter);
    for (const path of options.populate ?? []) query = query.populate(path);
    if (options.select) query = query.select(options.select);
    if (options.sort) query = query.sort(options.sort);
    if (options.skip) query = query.skip(options.skip);
    if (options.limit) query = query.limit(options.limit);
    return query.lean();
  }
  async one(
    name: string,
    filter: Record<string, unknown>,
    options: Record<string, any> = {},
  ): Promise<any | null> {
    let query = this.model(name).findOne(filter);
    for (const path of options.populate ?? []) query = query.populate(path);
    if (options.select) query = query.select(options.select);
    return query.lean();
  }
  count(name: string, filter: Record<string, unknown> = {}): Promise<number> {
    return this.model(name).countDocuments(filter);
  }
  create(name: string, payload: Record<string, unknown>): Promise<any> {
    return this.model(name).create(payload);
  }
  update(
    name: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    upsert = false,
  ): Promise<any | null> {
    return this.model(name)
      .findOneAndUpdate(filter, update, {
        new: true,
        upsert,
        runValidators: true,
      })
      .lean();
  }
  remove(name: string, filter: Record<string, unknown>): Promise<any | null> {
    return this.model(name).findOneAndDelete(filter).lean();
  }
}
