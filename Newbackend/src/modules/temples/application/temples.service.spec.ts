import { BadRequestException, ConflictException } from "@nestjs/common";
import { TemplesService } from "./temples.service";

/** A chainable query stub whose terminal `.lean()` resolves to `rows`. */
const chain = (rows: unknown) => {
  const c: any = {
    select: jest.fn(() => c),
    sort: jest.fn(() => c),
    skip: jest.fn(() => c),
    limit: jest.fn(() => c),
    lean: jest.fn().mockResolvedValue(rows),
    then: undefined,
  };
  return c;
};

type ModelStub = Record<string, jest.Mock>;

const makeModels = () => {
  const temples: ModelStub = {
    exists: jest.fn().mockResolvedValue(false),
    create: jest.fn(async (doc: any) => ({ _id: "t-new", ...doc })),
    findByIdAndUpdate: jest.fn(() => chain({ _id: "t1" })),
    find: jest.fn(() => chain([])),
    countDocuments: jest.fn().mockResolvedValue(0),
    findOne: jest.fn(() => chain(null)),
    findById: jest.fn(() => chain(null)),
  };
  const aartis: ModelStub = {
    find: jest.fn(() => chain([])),
    create: jest.fn(async (doc: any) => ({ _id: "a1", ...doc })),
    findOneAndUpdate: jest.fn(() => chain({ _id: "a1" })),
  };
  const festivals: ModelStub = {
    find: jest.fn(() => chain([])),
    create: jest.fn(async (doc: any) => ({ _id: "f1", ...doc })),
    findOne: jest.fn(() => chain(null)),
    findOneAndUpdate: jest.fn(() => chain({ _id: "f1" })),
  };
  const ashrams: ModelStub = { find: jest.fn(() => chain([])) };
  const parking: ModelStub = { find: jest.fn(() => chain([])) };
  const localServices: ModelStub = { find: jest.fn(() => chain([])) };
  return { temples, aartis, festivals, ashrams, parking, localServices };
};

const build = () => {
  const m = makeModels();
  const service = new TemplesService(
    m.temples as never,
    m.aartis as never,
    m.festivals as never,
    m.ashrams as never,
    m.parking as never,
    m.localServices as never,
  );
  return { service, ...m };
};

const user = { id: "admin-1" };
const baseDto = () => ({
  name: "Shri Test Temple",
  shortDescription: "short",
  description: "a full description",
  address: {
    street: "1 Main",
    city: "Mathura",
    district: "Mathura",
    state: "Uttar Pradesh",
    pincode: "281001",
    coordinates: [77.68, 27.49],
  },
});

describe("TemplesService.create — slug + coordinates", () => {
  it("generates a slug from name + city when none is supplied", async () => {
    const { service, temples } = build();
    await service.create(baseDto() as never, user);
    expect(temples.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "shri-test-temple-mathura" }),
    );
  });

  it("appends a counter when the generated slug already exists", async () => {
    const { service, temples } = build();
    temples.exists
      .mockResolvedValueOnce(true) // base taken
      .mockResolvedValueOnce(false); // -1 free
    await service.create(baseDto() as never, user);
    expect(temples.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "shri-test-temple-mathura-1" }),
    );
  });

  it("rejects a caller-supplied slug that is already in use", async () => {
    const { service, temples } = build();
    temples.exists.mockResolvedValue(true);
    await expect(
      service.create({ ...baseDto(), slug: "taken" } as never, user),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects [0, 0] placeholder coordinates", async () => {
    const { service } = build();
    const dto = baseDto();
    dto.address.coordinates = [0, 0];
    await expect(service.create(dto as never, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects coordinates outside geographic bounds", async () => {
    const { service } = build();
    const dto = baseDto();
    dto.address.coordinates = [200, 10];
    await expect(service.create(dto as never, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects a non-pair coordinate array", async () => {
    const { service } = build();
    const dto = baseDto();
    dto.address.coordinates = [77.68] as never;
    await expect(service.create(dto as never, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("TemplesService.findAll", () => {
  it("passes an explicit _id straight through to the filter", async () => {
    const { service, temples } = build();
    await service.findAll({ _id: "t-42" });
    expect(temples.find).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "t-42", deletedAt: null }),
    );
  });

  it("restricts public queries to published/active temples", async () => {
    const { service, temples } = build();
    await service.findAll({ public: true });
    expect(temples.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: ["published", "active"] } }),
    );
  });

  it("searches name, deity and city", async () => {
    const { service, temples } = build();
    await service.findAll({ search: "krishna" });
    const filter = temples.find.mock.calls[0][0];
    const fields = filter.$or.map((c: any) => Object.keys(c)[0]);
    expect(fields).toEqual(expect.arrayContaining(["name", "deity", "address.city"]));
  });
});

describe("TemplesService.getAartis", () => {
  it("hides inactive aartis from the public feed", async () => {
    const { service, aartis } = build();
    await service.getAartis("t1", true);
    expect(aartis.find).toHaveBeenCalledWith({
      templeId: "t1",
      isActive: { $ne: false },
    });
  });

  it("returns every aarti for the admin console", async () => {
    const { service, aartis } = build();
    await service.getAartis("t1", false);
    expect(aartis.find).toHaveBeenCalledWith({ templeId: "t1" });
  });
});

describe("TemplesService festival date validation", () => {
  it("rejects an end date before the start date", async () => {
    const { service, temples } = build();
    temples.findOne.mockReturnValue(chain({ _id: "t1" }));
    await expect(
      service.addFestival(
        "t1",
        { name: "X", startDate: "2026-03-10", endDate: "2026-03-01" } as never,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts a valid range", async () => {
    const { service, temples } = build();
    temples.findOne.mockReturnValue(chain({ _id: "t1" }));
    await expect(
      service.addFestival(
        "t1",
        { name: "X", startDate: "2026-03-01", endDate: "2026-03-10" } as never,
        user,
      ),
    ).resolves.toBeDefined();
  });
});

describe("TemplesService.findNearbyEntities", () => {
  it("returns empty buckets when the temple has no usable coordinates", async () => {
    const { service, temples } = build();
    temples.findById.mockReturnValue(
      chain({ _id: "t1", address: { coordinates: { coordinates: [0, 0] } } }),
    );
    const result = await service.findNearbyEntities("t1");
    expect(result).toEqual({
      temples: [],
      ashrams: [],
      homestays: [],
      parking: [],
      prasad: [],
    });
  });

  it("splits homestays out of the ashram bucket and survives a geo-index error", async () => {
    const { service, temples, ashrams, parking } = build();
    temples.findById.mockReturnValue(
      chain({
        _id: "t1",
        address: { city: "Mathura", coordinates: { coordinates: [77.68, 27.49] } },
      }),
    );
    ashrams.find.mockReturnValue(
      chain([
        { _id: "a1", name: "Peace Ashram", ashramType: "ashram", address: { coordinates: { coordinates: [77.7, 27.5] } } },
        { _id: "h1", name: "Yamuna Guest House", ashramType: "homestay", address: { coordinates: { coordinates: [77.69, 27.5] } } },
      ]),
    );
    parking.find.mockImplementation(() => {
      throw new Error("unable to find index for $geoNear");
    });
    const result = await service.findNearbyEntities("t1", 5);
    expect(result.ashrams.map((a: any) => a._id)).toEqual(["a1"]);
    expect(result.homestays.map((h: any) => h._id)).toEqual(["h1"]);
    expect(result.parking).toEqual([]);
  });
});
