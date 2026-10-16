import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { FoodPartnerService } from "./application/food-partner.service";
import { FoodCatalogService } from "./application/food-catalog.service";
import { fakeCrypto, fakeModel, newId } from "./testing/fake-model";

describe("Food restaurant partners (owner signup, admin approval, menu)", () => {
  let vendors: ReturnType<typeof fakeModel>;
  let outlets: ReturnType<typeof fakeModel>;
  let products: ReturnType<typeof fakeModel>;
  let variants: ReturnType<typeof fakeModel>;
  let orderItems: ReturnType<typeof fakeModel>;
  let zones: ReturnType<typeof fakeModel>;
  let users: ReturnType<typeof fakeModel>;
  let service: FoodPartnerService;

  const owner = { id: "user_owner", isAdmin: false };
  const other = { id: "user_other", isAdmin: false };
  const admin = { id: "user_admin", isAdmin: true };
  const outletInput = {
    brandName: "Radha Rasoi",
    address: "Raman Reti, Vrindavan",
    serviceZoneCodes: ["VRINDAVAN_CORE"],
  };

  beforeEach(() => {
    vendors = fakeModel();
    outlets = fakeModel();
    products = fakeModel();
    variants = fakeModel();
    orderItems = fakeModel();
    zones = fakeModel([{ zoneCode: "VRINDAVAN_CORE" }, { zoneCode: "MATHURA_CITY" }]);
    users = fakeModel();
    service = new FoodPartnerService(
      vendors as any,
      outlets as any,
      products as any,
      variants as any,
      orderItems as any,
      zones as any,
      users as any,
      fakeCrypto,
    );
  });

  it("owner signs up: the restaurant starts pending and its kitchen starts closed", async () => {
    const res = await service.register(owner, {
      businessName: "Radha Rasoi",
      outlet: outletInput,
    } as any);
    expect(res.vendor.status).toBe("pending_verification");
    expect(res.outlets).toHaveLength(1);
    expect(res.outlets[0].isPaused).toBe(true);
    expect(res.outlets[0].rating).toBe(0); // no invented rating
    expect((await service.getMyProfile(owner.id))?.vendor.businessName).toBe("Radha Rasoi");
  });

  it("one restaurant per account, and nothing to show before signing up", async () => {
    expect(await service.getMyProfile(owner.id)).toBeNull();
    await service.register(owner, { businessName: "Radha Rasoi" } as any);
    await expect(service.register(owner, { businessName: "Again" } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects unknown or empty delivery zones and rolls the restaurant back", async () => {
    await expect(
      service.register(owner, { businessName: "X Rasoi", outlet: { ...outletInput, serviceZoneCodes: ["NOWHERE"] } } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.register(owner, { businessName: "X Rasoi", outlet: { ...outletInput, serviceZoneCodes: [] } } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(vendors.rows).toHaveLength(0);
  });

  it("an owner cannot touch another restaurant's outlet or menu", async () => {
    await service.register(owner, { businessName: "Radha Rasoi", outlet: outletInput } as any);
    await service.register(other, { businessName: "Other Rasoi", outlet: { ...outletInput, brandName: "Other" } } as any);
    const mine = outlets.rows[0];
    const theirs = outlets.rows[1];

    await expect(service.updateOutlet(owner, String(theirs._id), { brandName: "Hijack" } as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listMenu(owner, String(theirs._id))).rejects.toBeInstanceOf(ForbiddenException);

    const dish = await service.createMenuItem(other, String(theirs._id), { label: "Dal Bati", family: "COMBO", pricePaise: 15000 } as any);
    await expect(service.updateMenuItem(owner, dish.id, { pricePaise: 100 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteMenuItem(owner, dish.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(mine.brandName).toBe("Radha Rasoi");
  });

  it("owner builds a menu: add, edit price and stock, mark sold out, delete", async () => {
    await service.register(owner, { businessName: "Radha Rasoi", outlet: outletInput } as any);
    const outletId = String(outlets.rows[0]._id);

    const dish = await service.createMenuItem(owner, outletId, {
      label: "Satvik Thali",
      family: "THALI",
      pricePaise: 24900,
      dailyCapacity: 40,
    } as any);
    expect(dish.isAvailable).toBe(true);
    expect(dish.dietaryTags).toEqual(["vegetarian"]);
    expect(dish.family).toBe("THALI");

    const edited = await service.updateMenuItem(owner, dish.id, { pricePaise: 26900, dailyCapacity: 25, isAvailable: false, label: "Royal Satvik Thali" });
    expect(edited.pricePaise).toBe(26900);
    expect(edited.dailyCapacity).toBe(25);
    expect(edited.isAvailable).toBe(false);
    expect(products.rows[0].canonicalName).toBe("Royal Satvik Thali");

    expect(await service.listMenu(owner, outletId)).toHaveLength(1);
    expect(await service.deleteMenuItem(owner, dish.id)).toEqual({ deleted: true, hidden: false });
    expect(variants.rows).toHaveLength(0);
    expect(products.rows).toHaveLength(0);
  });

  it("a dish that already has orders is hidden, not deleted", async () => {
    await service.register(owner, { businessName: "Radha Rasoi", outlet: outletInput } as any);
    const outletId = String(outlets.rows[0]._id);
    const dish = await service.createMenuItem(owner, outletId, { label: "Kadhi Bowl", family: "BOWL", pricePaise: 12900 } as any);
    orderItems.rows.push({ _id: newId(), variantId: dish.id });

    expect(await service.deleteMenuItem(owner, dish.id)).toEqual({ deleted: false, hidden: true });
    expect(variants.rows[0].isAvailable).toBe(false);
  });

  it("Super Admin creates the owner login with ANY password, then approves", async () => {
    const created = await service.createVendorAccount(admin, {
      ownerName: "Gopal Das",
      email: "Gopal@Example.com",
      phone: "9876543210",
      password: "1", // no strength rules
      businessName: "Brij Foods",
      outlet: outletInput,
    } as any);

    expect(users.rows).toHaveLength(1);
    expect(users.rows[0].email).toBe("gopal@example.com");
    expect(users.rows[0].role).toBe("customer");
    expect(users.rows[0].isVerified).toBe(true);
    expect(await bcrypt.compare("1", users.rows[0].passwordHash)).toBe(true);
    expect(created.vendor.status).toBe("pending_verification");
    expect(String(created.vendor.ownerUserId)).toBe(String(users.rows[0]._id));

    const approved = await service.setVendorStatus(admin, String(created.vendor._id), { status: "active" });
    expect(approved.vendor.status).toBe("active");

    const detail = await service.getVendorForAdmin(String(created.vendor._id));
    expect(detail.owner?.email).toBe("gopal@example.com");
  });

  it("admin can create an already-approved restaurant, and duplicates are refused without leaving junk", async () => {
    const dto = {
      ownerName: "Gopal Das",
      email: "gopal@example.com",
      phone: "9876543210",
      password: "x",
      businessName: "Brij Foods",
      approve: true,
      outlet: outletInput,
    } as any;
    const created = await service.createVendorAccount(admin, dto);
    expect(created.vendor.status).toBe("active");

    await expect(service.createVendorAccount(admin, { ...dto, phone: "9123456780" })).rejects.toBeInstanceOf(ConflictException);
    expect(users.rows).toHaveLength(1);

    // A failing restaurant does not leave an orphan login behind.
    await expect(
      service.createVendorAccount(admin, {
        ...dto,
        email: "new@example.com",
        phone: "9000000001",
        outlet: { ...outletInput, serviceZoneCodes: ["NOWHERE"] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.rows).toHaveLength(1);
    expect(vendors.rows).toHaveLength(1);
  });

  it("reject and suspend need a reason; admin can edit any restaurant's menu", async () => {
    await service.register(owner, { businessName: "Radha Rasoi", outlet: outletInput } as any);
    const vendorId = String(vendors.rows[0]._id);
    const outletId = String(outlets.rows[0]._id);

    await expect(service.setVendorStatus(admin, vendorId, { status: "rejected" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setVendorStatus(admin, vendorId, { status: "suspended", reason: "  " })).rejects.toBeInstanceOf(BadRequestException);
    const rejected = await service.setVendorStatus(admin, vendorId, { status: "rejected", reason: "FSSAI missing" });
    expect(rejected.vendor.status).toBe("rejected");

    const dish = await service.createMenuItem(admin, outletId, { label: "Admin Thali", family: "THALI", pricePaise: 19900 } as any);
    expect((await service.listMenu(admin, outletId)).map((m) => m.label)).toEqual(["Admin Thali"]);
    await service.updateMenuItem(admin, dish.id, { isAvailable: false });
    expect(variants.rows[0].isAvailable).toBe(false);
  });

  it("bank account number is stored encrypted and only the last four digits come back", async () => {
    await service.register(owner, { businessName: "Radha Rasoi", outlet: outletInput } as any);
    expect((await service.getMyProfile(owner.id))?.vendor.hasBankDetails).toBe(false);

    const saved = await service.updateVendor(owner, {
      bankAccountHolderName: "Radha Rasoi",
      bankAccountNumber: "123456789012",
      bankIfscCode: "HDFC0001234",
    } as any);

    expect(String(vendors.rows[0].bankAccountNumber).startsWith("enc:")).toBe(true);
    expect(JSON.stringify(vendors.rows[0])).not.toContain("123456789012");
    expect((saved.vendor as any).bankAccountNumber).toBeUndefined();
    expect((saved.vendor as any).settlementProfileId).toBeUndefined();
    expect(saved.vendor.bankAccountLast4).toBe("9012");
    expect(saved.vendor.hasBankDetails).toBe(true);
    expect(JSON.stringify(await service.listVendors({}))).not.toContain("enc:");
  });

  it("admin attaches a login to a restaurant without one, then resets its password", async () => {
    vendors.rows.push({ _id: "v_seed", businessName: "Seeded Kitchen", status: "active", ownerUserId: null });

    await expect(service.setOwnerPassword(admin, "v_seed", "new")).rejects.toBeInstanceOf(BadRequestException);

    const withLogin = await service.createOwnerLogin(admin, "v_seed", {
      ownerName: "Gopal",
      email: "Seed@Example.com",
      phone: "9876500001",
      password: "a",
    } as any);
    expect(withLogin.owner?.email).toBe("seed@example.com");
    expect(await bcrypt.compare("a", users.rows[0].passwordHash)).toBe(true);
    expect(users.rows[0].role).toBe("customer");

    await expect(
      service.createOwnerLogin(admin, "v_seed", { ownerName: "X", email: "x@example.com", phone: "9876500002", password: "b" } as any),
    ).rejects.toBeInstanceOf(ConflictException);

    await service.setOwnerPassword(admin, "v_seed", "1234");
    expect(await bcrypt.compare("1234", users.rows[0].passwordHash)).toBe(true);
    expect(await bcrypt.compare("a", users.rows[0].passwordHash)).toBe(false);

    const listed = await service.listVendors({ search: "seeded" });
    expect(listed[0].owner?.phone).toBeTruthy();
    expect(JSON.stringify(listed)).not.toContain("passwordHash");
  });

  it("admin list filters by status and search and counts kitchens", async () => {
    await service.register(owner, { businessName: "Radha Rasoi", outlet: outletInput } as any);
    await service.createVendorAccount(admin, {
      ownerName: "G",
      email: "g@example.com",
      phone: "9876543210",
      password: "p",
      businessName: "Brij Foods",
      approve: true,
    } as any);

    expect(await service.listVendors({})).toHaveLength(2);
    const pending = await service.listVendors({ status: "pending_verification" });
    expect(pending.map((v: any) => v.businessName)).toEqual(["Radha Rasoi"]);
    expect(pending[0].outletCount).toBe(1);
    expect((await service.listVendors({ search: "brij" })).map((v: any) => v.businessName)).toEqual(["Brij Foods"]);
  });
});

describe("Food discovery only shows approved restaurants", () => {
  it("filters outlets by vendors whose status is active", async () => {
    const vendors = fakeModel([
      { _id: "v_live", businessName: "Live", status: "active" },
      { _id: "v_pending", businessName: "Pending", status: "pending_verification" },
      { _id: "v_susp", businessName: "Suspended", status: "suspended" },
    ]);
    const outlets = fakeModel([
      { _id: "o_live", vendorId: "v_live", status: "active", isPaused: false, serviceZoneCodes: ["Z"] },
      { _id: "o_pending", vendorId: "v_pending", status: "active", isPaused: false, serviceZoneCodes: ["Z"] },
      { _id: "o_susp", vendorId: "v_susp", status: "active", isPaused: false, serviceZoneCodes: ["Z"] },
    ]);
    const catalog = new FoodCatalogService(
      vendors as any,
      outlets as any,
      fakeModel() as any,
      fakeModel() as any,
      fakeModel() as any,
    );
    const res = await catalog.getDiscovery({ zoneCode: "Z" });
    expect(res.outlets.map((o: any) => String(o.id))).toEqual(["o_live"]);
  });
});
