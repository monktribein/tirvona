import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { MarketplaceAddressService } from "./marketplace-address.service";

const user = { id: "cust-1", role: "customer" } as AuthenticatedUser;
const ADDRESS = {
  fullName: "Asha Devi",
  phone: "9876543210",
  line1: "12 Ghat Road",
  city: "Vrindavan",
  state: "Uttar Pradesh",
  pincode: "281121",
} as never;

const model = (overrides: Record<string, unknown> = {}) => ({
  find: jest.fn(() => ({
    sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([{ _id: "a1" }]) })),
  })),
  countDocuments: jest.fn().mockResolvedValue(0),
  create: jest.fn(async (doc: unknown) => doc),
  updateMany: jest.fn().mockResolvedValue({}),
  updateOne: jest.fn().mockResolvedValue({}),
  findOneAndUpdate: jest.fn(),
  findOne: jest.fn().mockResolvedValue(null),
  exists: jest.fn().mockResolvedValue(null),
  ...overrides,
});

describe("MarketplaceAddressService", () => {
  it("lists only the caller's live addresses, default first", async () => {
    const addresses = model();
    const rows = await new MarketplaceAddressService(addresses as never).listAddresses(user);

    expect(rows).toEqual([{ _id: "a1" }]);
    expect(addresses.find).toHaveBeenCalledWith({ customerId: "cust-1", isDeleted: false });
  });

  it("makes the first address the default", async () => {
    const addresses = model();
    const created: any = await new MarketplaceAddressService(addresses as never).createAddress(user, ADDRESS);

    expect(created.isDefault).toBe(true);
    expect(created.customerId).toBe("cust-1");
    expect(addresses.updateMany).toHaveBeenCalledTimes(1);
  });

  it("refuses a 21st address", async () => {
    const addresses = model({ countDocuments: jest.fn().mockResolvedValue(20) });

    await expect(
      new MarketplaceAddressService(addresses as never).createAddress(user, ADDRESS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("will not touch another customer's address", async () => {
    const addresses = model({ findOneAndUpdate: jest.fn().mockResolvedValue(null) });
    const service = new MarketplaceAddressService(addresses as never);

    await expect(service.updateAddress(user, "x", ADDRESS)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteAddress(user, "x")).rejects.toBeInstanceOf(NotFoundException);
    expect(addresses.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cust-1", isDeleted: false }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("promotes a remaining address when the default is deleted", async () => {
    const addresses = model({
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: "gone" }),
      findOne: jest.fn().mockResolvedValue({ _id: "left" }),
    });

    await new MarketplaceAddressService(addresses as never).deleteAddress(user, "gone");

    expect(addresses.updateOne).toHaveBeenCalledWith({ _id: "left" }, { $set: { isDefault: true } });
  });
});
