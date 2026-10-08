import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { AddressDto } from "../presentation/dtos/marketplace-address.dto";

/** The customer address book (marketplace_addresses), shared with the vendor marketplace checkout. */
@Injectable()
export class MarketplaceAddressService {
  constructor(
    @InjectModel("MarketplaceAddress") private readonly addresses: Model<any>,
  ) {}

  async listAddresses(user: AuthenticatedUser): Promise<any[]> {
    return this.addresses
      .find({ customerId: user.id, isDeleted: false })
      .sort({ isDefault: -1, updatedAt: -1 })
      .lean();
  }

  async createAddress(
    user: AuthenticatedUser,
    dto: AddressDto,
  ): Promise<any> {
    const existing = await this.addresses.countDocuments({
      customerId: user.id,
      isDeleted: false,
    });
    if (existing >= 20)
      throw new BadRequestException("Address book is full (20 maximum)");
    const isDefault = dto.isDefault === true || existing === 0;
    if (isDefault) await this.clearDefault(user.id);
    return this.addresses.create({
      ...dto,
      customerId: user.id,
      isDefault,
      isDeleted: false,
    });
  }

  async updateAddress(
    user: AuthenticatedUser,
    id: string,
    dto: AddressDto,
  ): Promise<any> {
    if (dto.isDefault === true) await this.clearDefault(user.id);
    const address = await this.addresses.findOneAndUpdate(
      { _id: id, customerId: user.id, isDeleted: false },
      { $set: { ...dto } },
      { new: true },
    );
    if (!address) throw new NotFoundException("Address not found");
    return address;
  }

  async deleteAddress(user: AuthenticatedUser, id: string): Promise<any> {
    const address = await this.addresses.findOneAndUpdate(
      { _id: id, customerId: user.id, isDeleted: false },
      { $set: { isDeleted: true, isDefault: false } },
      { new: true },
    );
    if (!address) throw new NotFoundException("Address not found");
    const remaining = await this.addresses.findOne({
      customerId: user.id,
      isDeleted: false,
    });
    if (remaining && !(await this.addresses.exists({
      customerId: user.id,
      isDeleted: false,
      isDefault: true,
    })))
      await this.addresses.updateOne(
        { _id: remaining._id },
        { $set: { isDefault: true } },
      );
    return { success: true };
  }

  private clearDefault(customerId: string): Promise<any> {
    return this.addresses.updateMany(
      { customerId, isDefault: true },
      { $set: { isDefault: false } },
    );
  }
}
