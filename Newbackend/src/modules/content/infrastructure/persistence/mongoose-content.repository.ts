import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { ContentRepository } from "../../domain/content.repository";

@Injectable()
export class MongooseContentRepository implements ContentRepository {
  private readonly models: Record<string, Model<any>>;

  constructor(
    @InjectModel("BlogPost") blogPosts: Model<any>,
    @InjectModel("BlogAuthor") blogAuthors: Model<any>,
    @InjectModel("BlogComment") blogComments: Model<any>,
    @InjectModel("ContentChangeRequest") requests: Model<any>,
    @InjectModel("Banner") banners: Model<any>,
    @InjectModel("ContentAuditLog") audits: Model<any>,
    @InjectModel("PilgrimageCircuit") circuits: Model<any>,
    @InjectModel("Temple") temples: Model<any>,
    @InjectModel("EventFestival") events: Model<any>,
    @InjectModel("SacredDirectoryItem") directory: Model<any>,
    @InjectModel("PlannerTemplate") plannerTemplates: Model<any>,
    @InjectModel("TripItinerary") itineraries: Model<any>,
    @InjectModel("LocalServiceItem") localServices: Model<any>,
  ) {
    this.models = {
      blogPosts,
      blogAuthors,
      blogComments,
      requests,
      banners,
      audits,
      circuits,
      temples,
      events,
      directory,
      plannerTemplates,
      itineraries,
      localServices,
    };
  }

  private model(name: string): Model<any> {
    const model = this.models[name];
    if (!model) throw new Error(`Unknown content model: ${name}`);
    return model;
  }

  async list(
    name: string,
    filter: Record<string, unknown> = {},
    options: Record<string, any> = {},
  ): Promise<any[]> {
    let query = this.model(name).find(filter);
    for (const populate of options.populate ?? [])
      query = query.populate(populate);
    if (options.sort) query = query.sort(options.sort);
    if (options.limit) query = query.limit(options.limit);
    return query.lean();
  }

  async one(
    name: string,
    filter: Record<string, unknown>,
    populate: string[] = [],
  ): Promise<any | null> {
    let query = this.model(name).findOne(filter);
    for (const path of populate) query = query.populate(path);
    return query.lean();
  }

  async create(name: string, payload: Record<string, unknown>): Promise<any> {
    return this.model(name).create(payload);
  }

  async update(
    name: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<any | null> {
    return this.model(name)
      .findOneAndUpdate(filter, update, { new: true, runValidators: true })
      .lean();
  }

  async remove(
    name: string,
    filter: Record<string, unknown>,
  ): Promise<any | null> {
    return this.model(name).findOneAndDelete(filter).lean();
  }

  async removeMany(
    name: string,
    filter: Record<string, unknown>,
  ): Promise<number> {
    return (await this.model(name).deleteMany(filter)).deletedCount;
  }

  async count(
    name: string,
    filter: Record<string, unknown> = {},
  ): Promise<number> {
    return this.model(name).countDocuments(filter);
  }
}
