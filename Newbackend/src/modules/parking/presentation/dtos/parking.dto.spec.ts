import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  OptionalParkingWindowDto,
  ParkingWindowDto,
} from "./parking.dto";

describe("parking window DTOs", () => {
  it("allows a location detail request without a pricing window", async () => {
    const dto = plainToInstance(OptionalParkingWindowDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("validates dates when an optional detail window is supplied", async () => {
    const dto = plainToInstance(OptionalParkingWindowDto, {
      entryAt: "not-a-date",
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain("entryAt");
  });

  it("still requires both dates for an availability request", async () => {
    const dto = plainToInstance(ParkingWindowDto, {});

    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual([
      "entryAt",
      "exitAt",
    ]);
  });

  it("accepts canonical ISO timestamps for availability", async () => {
    const dto = plainToInstance(ParkingWindowDto, {
      entryAt: "2026-08-02T10:30:00.000Z",
      exitAt: "2026-08-02T13:30:00.000Z",
      vehicleType: "car",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
