import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { FoodPartnerService } from "./application/food-partner.service";
import { FoodMenuItemDto, FoodMenuItemUpdateDto } from "./presentation/food-partner.dto";
import { fakeCrypto, fakeModel } from "./testing/fake-model";

const img = (n: number) => `https://tirvona.com/img/${n}.jpg`;

describe("Food product gallery (up to five images)", () => {
  let outlets: ReturnType<typeof fakeModel>;
  let products: ReturnType<typeof fakeModel>;
  let variants: ReturnType<typeof fakeModel>;
  let service: FoodPartnerService;
  let outletId: string;
  const owner = { id: "user_owner", isAdmin: false };
  const other = { id: "user_other", isAdmin: false };

  beforeEach(async () => {
    outlets = fakeModel();
    products = fakeModel();
    variants = fakeModel();
    service = new FoodPartnerService(
      fakeModel() as any, outlets as any, products as any, variants as any, fakeModel() as any,
      fakeModel([{ zoneCode: "VRINDAVAN_CORE" }]) as any, fakeModel() as any, fakeCrypto,
    );
    await service.register(owner, { businessName: "Radha Rasoi", outlet: { brandName: "Radha Rasoi", address: "Raman Reti", serviceZoneCodes: ["VRINDAVAN_CORE"] } } as any);
    outletId = String(outlets.rows[0]._id);
  });

  const create = (imageUrls?: string[], extra: object = {}) =>
    service.createMenuItem(owner, outletId, { label: "Thali", family: "THALI", pricePaise: 19900, imageUrls, ...extra } as any);

  it.each([1, 2, 3, 4, 5])("accepts %i image(s); the first is the cover", async (n) => {
    const urls = Array.from({ length: n }, (_, i) => img(i + 1));
    const dish = await create(urls);
    expect(dish.imageUrls).toEqual(urls);
    expect(dish.imageUrl).toBe(img(1));
    expect(products.rows.at(-1)!.imageUrls).toEqual(urls);
    expect(products.rows.at(-1)!.defaultImageUrl).toBe(img(1));
  });

  it("rejects a sixth image on create and on update, and stores nothing", async () => {
    const six = [1, 2, 3, 4, 5, 6].map(img);
    await expect(create(six)).rejects.toBeInstanceOf(BadRequestException);
    expect(variants.rows).toHaveLength(0);
    const dish = await create([img(1), img(2)]);
    await expect(service.updateMenuItem(owner, dish.id, { imageUrls: six })).rejects.toBeInstanceOf(BadRequestException);
    expect(variants.rows[0].imageUrls).toEqual([img(1), img(2)]);
  });

  it("ignores blank entries when counting and storing", async () => {
    const dish = await create([img(1), "", "   ", img(2), img(3), img(4), img(5)]);
    expect(dish.imageUrls).toEqual([img(1), img(2), img(3), img(4), img(5)]);
  });

  it("removing one image keeps the order, and removing a cover promotes the next", async () => {
    const dish = await create([1, 2, 3].map(img));
    const removedMiddle = await service.updateMenuItem(owner, dish.id, { imageUrls: [img(1), img(3)] });
    expect(removedMiddle.imageUrls).toEqual([img(1), img(3)]);
    const removedCover = await service.updateMenuItem(owner, dish.id, { imageUrls: [img(3)] });
    expect(removedCover.imageUrl).toBe(img(3));
    expect(products.rows[0].defaultImageUrl).toBe(img(3));
  });

  it("replacing the gallery swaps the cover on the dish and the product", async () => {
    const dish = await create([img(1), img(2)]);
    const replaced = await service.updateMenuItem(owner, dish.id, { imageUrls: [img(9), img(8)] });
    expect(replaced.imageUrls).toEqual([img(9), img(8)]);
    expect(replaced.imageUrl).toBe(img(9));
    expect(products.rows[0].defaultImageUrl).toBe(img(9));
  });

  it("removing every image clears the cover instead of leaving a stale one", async () => {
    const dish = await create([img(1), img(2)]);
    const cleared = await service.updateMenuItem(owner, dish.id, { imageUrls: [] });
    expect(cleared.imageUrls).toEqual([]);
    expect(cleared.imageUrl).toBe("");
    expect(products.rows[0].defaultImageUrl).toBe("");
  });

  it("an update without imageUrls leaves the gallery untouched", async () => {
    const dish = await create([img(1), img(2)]);
    const edited = await service.updateMenuItem(owner, dish.id, { pricePaise: 25000 });
    expect(edited.imageUrls).toEqual([img(1), img(2)]);
    expect(edited.imageUrl).toBe(img(1));
  });

  it("a legacy single-image payload and a legacy row without a gallery still work", async () => {
    const dish = await create(undefined, { imageUrl: img(7) });
    expect(dish.imageUrls).toEqual([img(7)]);
    expect(dish.imageUrl).toBe(img(7));
    variants.rows[0].imageUrls = undefined; // a row written before galleries existed
    products.rows[0].imageUrls = undefined;
    const [row] = await service.listMenu(owner, outletId);
    expect(row.imageUrl).toBe(img(7));
    expect(row.imageUrls).toEqual([img(7)]);
  });

  it("only the owning restaurant can change a gallery", async () => {
    const dish = await create([img(1)]);
    await service.register(other, { businessName: "Other", outlet: { brandName: "Other", address: "x", serviceZoneCodes: ["VRINDAVAN_CORE"] } } as any);
    await expect(service.updateMenuItem(other, dish.id, { imageUrls: [img(2)] })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createMenuItem(other, outletId, { label: "X", family: "THALI", pricePaise: 10000 } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(variants.rows[0].imageUrls).toEqual([img(1)]);
  });

  describe("request validation", () => {
    const errors = async (cls: any, body: object) => validate(plainToInstance(cls, body));
    const base = { label: "Thali", family: "THALI", pricePaise: 19900 };

    it.each([FoodMenuItemDto, FoodMenuItemUpdateDto])("%p refuses six images, non-strings and over-long values", async (cls) => {
      expect((await errors(cls, { ...base, imageUrls: [1, 2, 3, 4, 5, 6].map(img) })).some((e) => e.property === "imageUrls")).toBe(true);
      expect((await errors(cls, { ...base, imageUrls: [img(1), 42] })).some((e) => e.property === "imageUrls")).toBe(true);
      expect((await errors(cls, { ...base, imageUrls: ["https://x/" + "a".repeat(600)] })).some((e) => e.property === "imageUrls")).toBe(true);
      expect((await errors(cls, { ...base, imageUrls: "not-an-array" })).some((e) => e.property === "imageUrls")).toBe(true);
      expect((await errors(cls, { ...base, imageUrls: [1, 2, 3, 4, 5].map(img) })).some((e) => e.property === "imageUrls")).toBe(false);
    });
  });
});
