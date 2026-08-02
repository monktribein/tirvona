import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection, Model } from "mongoose";
import type { GovernanceRepository } from "../../domain/governance.repository";
@Injectable()
export class MongooseGovernanceRepository implements GovernanceRepository {
  constructor(@InjectConnection() private readonly connection: Connection) {}
  private model(name: string): Model<any> {
    const model = this.connection.models[name];
    if (!model) throw new Error(`Unknown governance model: ${name}`);
    return model;
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
  async updateMany(
    name: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<number> {
    return (await this.model(name).updateMany(filter, update)).modifiedCount;
  }
  remove(name: string, filter: Record<string, unknown>): Promise<any | null> {
    return this.model(name).findOneAndDelete(filter).lean();
  }
  async removeMany(
    name: string,
    filter: Record<string, unknown>,
  ): Promise<number> {
    return (await this.model(name).deleteMany(filter)).deletedCount;
  }
}
