import { GoneException } from "@nestjs/common";
import { CommerceService } from "./commerce.service";

describe("CommerceService legacy order endpoint", () => {
  it("refuses a client-priced order and writes nothing", async () => {
    const repository: any = { create: jest.fn() };
    const service = new CommerceService(repository);

    await expect(
      service.order({ id: "u1" } as any, {
        items: [{ productId: "p1", quantity: 5 }],
        customerName: "A",
        customerPhone: "9999999999",
        shippingAddress: {},
        totalAmount: 1,
      }),
    ).rejects.toBeInstanceOf(GoneException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
