import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import type { UserRepository } from "../../domain/user.repository";
import { User, UserDocument } from "./user.schema";

@Injectable()
export class MongooseUserRepository implements UserRepository {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  findById(id: string): Promise<UserDocument | null> {
    return this.users.findById(id).exec();
  }

  findByEmail(
    email: string,
    includePassword = false,
  ): Promise<UserDocument | null> {
    const query = this.users.findOne({
      email: email.trim().toLowerCase(),
      isDeleted: { $ne: true },
    });
    if (includePassword) query.select("+passwordHash");
    return query.exec();
  }

  findByPhone(phone: string): Promise<UserDocument | null> {
    return this.users.findOne({ phone, isDeleted: { $ne: true } }).exec();
  }

  async create(
    input: Partial<UserDocument>,
    session?: ClientSession,
  ): Promise<UserDocument> {
    const [created] = await this.users.create([input], { session });
    return created;
  }
}
