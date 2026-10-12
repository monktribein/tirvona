import type { ClientSession } from "../../../database/orm";
import type { UserDocument } from "../infrastructure/persistence/user.schema";

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface UserRepository {
  findById(id: string): Promise<UserDocument | null>;
  findByEmail(
    email: string,
    includePassword?: boolean,
  ): Promise<UserDocument | null>;
  findByPhone(phone: string): Promise<UserDocument | null>;
  create(
    input: Partial<UserDocument>,
    session?: ClientSession,
  ): Promise<UserDocument>;
}
