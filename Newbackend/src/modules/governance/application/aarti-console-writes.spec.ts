import { BadRequestException } from "@nestjs/common";
import { Types } from "mongoose";
import { GovernanceService } from "./governance.service";

describe("super admin Aarti console writes", () => {
  const ASHRAM_ID = new Types.ObjectId().toHexString();
  const OWNER_ID = new Types.ObjectId().toHexString();
  const superAdmin = { id: new Types.ObjectId().toHexString(), role: "super_admin" } as never;

  const buildService = () => {
    const repository = {
      one: jest.fn(async (model: string) =>
        model === "Admin_ashrams"
          ? {
              _id: ASHRAM_ID,
              ownerId: OWNER_ID,
              name: "Prem Mandir",
              address: { state: "Uttar Pradesh", city: "Vrindavan" },
            }
          : null,
      ),
      create: jest.fn(async (_model, payload) => ({ _id: "new", ...payload })),
      update: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      remove: jest.fn(),
      removeMany: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue(0),
    };
    return { service: new GovernanceService(repository as never), repository };
  };

  it("maps dropdown fields to the Aarti schema and generates a unique slug", async () => {
    const first = buildService();
    const second = buildService();
    const body = {
      ashramId: ASHRAM_ID,
      name: "Evening Aarti",
      kind: "sandhya_aarti",
      state: "Uttar Pradesh",
      city: "Mathura",
      startTime: "18:30",
      durationMinutes: 60,
      totalCapacity: 250,
      status: "approved",
    };

    await first.service.adminSave(superAdmin, "aarti_sessions", "all", body);
    await second.service.adminSave(superAdmin, "aarti_sessions", "all", body);

    const firstPayload = first.repository.create.mock.calls[0][1];
    const secondPayload = second.repository.create.mock.calls[0][1];
    expect(firstPayload).toMatchObject({
      ashramId: ASHRAM_ID,
      ownerId: OWNER_ID,
      name: "Evening Aarti",
      kind: "sandhya_aarti",
      startTime: "18:30",
      venue: { state: "Uttar Pradesh", city: "Mathura" },
    });
    expect(firstPayload).not.toHaveProperty("state");
    expect(firstPayload).not.toHaveProperty("city");
    expect(firstPayload.slug).toMatch(/^evening-aarti-mathura-[a-f0-9]{8}$/);
    expect(secondPayload.slug).not.toBe(firstPayload.slug);
  });

  it("rejects a category outside the supported dropdown values", async () => {
    const { service } = buildService();
    await expect(
      service.adminSave(superAdmin, "aarti_sessions", "all", {
        ashramId: ASHRAM_ID,
        name: "Evening Aarti",
        kind: "unsupported",
        state: "Uttar Pradesh",
        city: "Mathura",
        startTime: "18:30",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
