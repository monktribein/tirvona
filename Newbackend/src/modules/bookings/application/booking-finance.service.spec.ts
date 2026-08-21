import { ForbiddenException } from "@nestjs/common";
import { BookingFinanceService } from "./booking-finance.service";

describe("BookingFinanceService refund access", () => {
  const refunds = {
    find: jest.fn(),
  };
  const payments = {
    find: jest.fn(),
  };

  const service = new BookingFinanceService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    refunds as never,
    payments as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(["ashram_admin", "stay_admin"])(
    "allows %s to read the refund queue across managed ashrams",
    async (role) => {
      const rows = [{ refundReference: "REF-1" }];
      const lean = jest.fn().mockResolvedValue(rows);
      const sort = jest.fn().mockReturnValue({ lean });
      const populate = jest.fn().mockReturnValue({ sort });
      refunds.find.mockReturnValue({ populate });

      await expect(
        service.refundQueue({ id: "admin-1", role } as never),
      ).resolves.toEqual(rows);
      expect(refunds.find).toHaveBeenCalledWith({});
      expect(payments.find).not.toHaveBeenCalled();
    },
  );

  it("continues to reject roles without finance or ashram access", async () => {
    await expect(
      service.refundQueue({ id: "customer-1", role: "customer" } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(refunds.find).not.toHaveBeenCalled();
  });
});
