/// <reference types="jest" />
/**
 * An HR / Executive login adding a stay: the real AshramsService and HrLocationService on
 * a real Postgres 17. The stay goes under the owner's own (signed-up) account, inside the
 * login's office area, and the login can never set a password or take over another
 * account. Run with `npm run test:pg -- ashram-area-create`. Run the whole file.
 */
import "reflect-metadata";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { getModelToken, OrmModule } from "../../../database/orm-nest";
import { Types, type Model } from "../../../database/orm";
import { environment } from "../../../config/environment";
import { DRIVER_URI } from "../../../database/database";
import { enablePostgresDriver } from "../../../database/pg/pg-driver";
import { REGISTRY } from "../../../database/pg/registry.generated";
import { createTestDatabase, type TestDatabase } from "../../../database/pg/test-database";
import { UserSchema } from "../../users/infrastructure/persistence/user.schema";
import { BookingSchema } from "../../bookings/infrastructure/persistence/booking.schemas";
import { HrEmployeeSchema, HrOfficeSchema } from "../../hr/infrastructure/persistence/hr.schemas";
import { HrLocationService } from "../../hr/application/hr-location.service";
import { ParkingPartnerSchema, ParkingStaffSchema } from "../../parking/infrastructure/persistence/parking-catalogue.schemas";
import { PARKING_MODEL } from "../../parking/domain/parking.constants";
import {
  AshramSchema,
  BookingAddonSchema,
  BookingInventorySchema,
  RoomRateSchema,
  RoomSchema,
} from "../infrastructure/persistence/ashram.schemas";
import { AshramSlugService } from "./ashram-slug.service";
import { AshramsService } from "./ashrams.service";

describe("an HR / Executive login adding a stay (real Postgres)", () => {
  let db: TestDatabase;
  let moduleRef: TestingModule;
  let service: AshramsService;
  let users: Model<any>;
  let ashrams: Model<any>;

  const executive = { id: new Types.ObjectId().toHexString(), role: "executive", name: "Shyam Executive", permissions: [] } as any;
  const noOffice = { id: new Types.ObjectId().toHexString(), role: "hr", name: "Unassigned HR", permissions: [] } as any;
  const ownerIds: Record<string, string> = {};

  const stay = (overrides: Record<string, unknown> = {}) =>
    ({
      name: `Radha Kunj ${Math.random().toString(36).slice(2, 7)}`,
      ashramType: "ashram",
      description: "A quiet stay",
      address: { street: "Raman Reti", city: "Vrindavan", district: "Mathura", state: "Uttar Pradesh", pincode: "281121" },
      ...overrides,
    }) as any;

  beforeAll(async () => {
    db = await createTestDatabase(REGISTRY.tables);
    enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false });
    let slugCount = 0;
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [environment] }),
        OrmModule.forRoot(DRIVER_URI),
        OrmModule.forFeature([
          { name: "Ashram", schema: AshramSchema },
          { name: "Room", schema: RoomSchema },
          { name: "RoomRate", schema: RoomRateSchema },
          { name: "Booking", schema: BookingSchema },
          { name: "BookingInventory", schema: BookingInventorySchema },
          { name: "BookingAddon", schema: BookingAddonSchema },
          { name: PARKING_MODEL.Partner, schema: ParkingPartnerSchema },
          { name: PARKING_MODEL.Staff, schema: ParkingStaffSchema },
          { name: "User", schema: UserSchema },
          { name: "HrEmployee", schema: HrEmployeeSchema },
          { name: "HrOffice", schema: HrOfficeSchema },
        ]),
      ],
      providers: [
        AshramsService,
        HrLocationService,
        { provide: AshramSlugService, useValue: { allocate: async () => `test-stay-${++slugCount}` } },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(AshramsService);
    users = moduleRef.get(getModelToken("User"));
    ashrams = moduleRef.get(getModelToken("Ashram"));

    const office = await moduleRef
      .get(getModelToken("HrOffice"))
      .create({ code: "BRJ", name: "Braj Office", nameKey: "braj office", city: "Mathura", active: true });
    await moduleRef.get(getModelToken("HrEmployee")).create({
      employeeCode: "EMP-0001",
      fullName: executive.name,
      userId: executive.id,
      primaryOfficeId: office._id,
      officeIds: [office._id],
      status: "active",
    });

    const account = async (key: string, role: string, status = "active") => {
      const row = await users.create({
        name: key,
        email: `${key}@example.test`,
        phone: `98${String(Math.floor(10000000 + Math.random() * 89999999))}`,
        role,
        status,
        passwordHash: `hash-of-${key}`,
      });
      ownerIds[key] = String(row._id);
    };
    await account("owner", "owner");
    await account("pilgrim", "customer");
    await account("finance", "finance_manager");
    await account("waiting", "owner", "pending_approval");
  });

  afterAll(async () => {
    await moduleRef?.close();
    await db?.drop();
  });

  it("adds the stay under the owner's own account, not the HR / Executive login", async () => {
    const { ashram } = await service.create(executive, stay({ ownerEmail: "Owner@Example.test" }));
    expect(String(ashram.ownerId)).toBe(ownerIds.owner);
    expect(String(ashram.createdBy)).toBe(executive.id);
    expect(ashram.status).toBe("pending_docs");
    // The owner's account now lists the stay; the executive's does not.
    const owner = await users.findById(ownerIds.owner).select("+passwordHash").lean();
    expect((owner as any).scopedAshramIds.map(String)).toContain(String(ashram._id));
    expect((owner as any).passwordHash).toBe("hash-of-owner");
  });

  it("lets the new stay be managed by the executive through its area", async () => {
    const ids = await moduleRef.get(HrLocationService).stayIdsInArea(executive);
    expect((await ashrams.countDocuments({ _id: { $in: ids } }))).toBeGreaterThan(0);
  });

  it("turns a customer account into a stay owner, without touching its password or status", async () => {
    await service.create(executive, stay({ ownerEmail: "pilgrim@example.test" }));
    const pilgrim = (await users.findById(ownerIds.pilgrim).select("+passwordHash").lean()) as any;
    expect(pilgrim.role).toBe("ashram_owner");
    expect(pilgrim.passwordHash).toBe("hash-of-pilgrim");
    expect(pilgrim.status).toBe("active");
  });

  it("never sets a password, creates an account, or uses a staff or inactive account", async () => {
    await expect(service.create(executive, stay({ ownerEmail: "owner@example.test", ownerPassword: "NewPass#123" }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(executive, stay({ ownerEmail: "nobody@example.test" }))).rejects.toThrow(/sign up first/);
    await expect(service.create(executive, stay({}))).rejects.toThrow(/email the stay owner signed up with/);
    await expect(service.create(executive, stay({ ownerEmail: "finance@example.test" }))).rejects.toBeInstanceOf(ConflictException);
    await expect(service.create(executive, stay({ ownerEmail: "waiting@example.test" }))).rejects.toBeInstanceOf(ConflictException);
    const finance = (await users.findById(ownerIds.finance).lean()) as any;
    expect(finance.role).toBe("finance_manager");
  });

  it("only adds stays inside the login's office area", async () => {
    await expect(
      service.create(
        executive,
        stay({
          ownerEmail: "owner@example.test",
          address: { street: "Har Ki Pauri", city: "Haridwar", district: "Haridwar", state: "Uttarakhand", pincode: "249401" },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create(noOffice, stay({ ownerEmail: "owner@example.test" }))).rejects.toThrow(/no office assigned/);
  });
});
