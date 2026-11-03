/// <reference types="jest" />
/**
 * `mustChangePassword` has no column of its own (it lives in the row's `_extra`, like
 * platform_settings.assistantConfig), so this checks on a real Postgres 17 that it is
 * stored, read back and cleared. Run with `npm run test:pg -- user-must-change-password`.
 */
import "reflect-metadata";
import { ConfigModule } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { getModelToken, OrmModule } from "../../../../database/orm-nest";
import type { Model } from "../../../../database/orm";
import { environment } from "../../../../config/environment";
import { DRIVER_URI } from "../../../../database/database";
import { enablePostgresDriver } from "../../../../database/pg/pg-driver";
import { REGISTRY } from "../../../../database/pg/registry.generated";
import { createTestDatabase, type TestDatabase } from "../../../../database/pg/test-database";
import { UserSchema } from "./user.schema";

describe("users.mustChangePassword on Postgres", () => {
  let db: TestDatabase;
  let moduleRef: TestingModule;
  let users: Model<any>;

  beforeAll(async () => {
    db = await createTestDatabase(REGISTRY.tables);
    enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false });
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [environment] }),
        OrmModule.forRoot(DRIVER_URI),
        OrmModule.forFeature([{ name: "User", schema: UserSchema }]),
      ],
    }).compile();
    await moduleRef.init();
    users = moduleRef.get(getModelToken("User"));
  });

  afterAll(async () => {
    await moduleRef?.close();
    await db?.drop();
  });

  it("is absent for a normal account, stored when set, and gone again when cleared", async () => {
    const created = await users.create({ name: "Radha", email: "radha@example.test", phone: "9876500001", role: "customer", passwordHash: "x" });
    expect((await users.findById(created._id).lean() as any).mustChangePassword).toBeUndefined();

    const row = await users.findById(created._id).select("+passwordHash");
    row.mustChangePassword = true;
    await row.save();
    expect((await users.findById(created._id).lean() as any).mustChangePassword).toBe(true);

    const again = await users.findById(created._id).select("+passwordHash");
    again.mustChangePassword = undefined;
    await again.save();
    expect((await users.findById(created._id).lean() as any).mustChangePassword).toBeUndefined();
  });
});
