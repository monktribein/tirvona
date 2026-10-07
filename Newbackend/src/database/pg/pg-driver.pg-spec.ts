import { Mongoose, Schema } from "mongoose";
import type { Model } from "mongoose";
import { enablePostgresDriver } from "./pg-driver";
import type { PgStore } from "./pg-store";
import type { Registry } from "./registry";
import type { TestDatabase } from "./test-database";
import { createTestDatabase } from "./test-database";

const REGISTRY: Registry = {
  version: 1,
  databases: { "": "public", tirvona_leads: "leads" },
  tables: [
    {
      database: "test",
      collection: "widgets",
      schema: "public",
      table: "widgets",
      idKind: "objectId",
      columns: [
        { field: "name", column: "name", kind: "string" },
        { field: "qty", column: "qty", kind: "number" },
        { field: "tags", column: "tags", kind: "string[]" },
        { field: "ownerId", column: "owner_id", kind: "objectId" },
        { field: "refs", column: "refs", kind: "objectId[]" },
        { field: "when", column: "when", kind: "date" },
        { field: "active", column: "active", kind: "boolean" },
        { field: "status", column: "status", kind: "string" },
        { field: "meta", column: "meta", kind: "json" },
        { field: "loc", column: "loc", kind: "json" },
        { field: "items", column: "items", kind: "json" },
        { field: "createdAt", column: "created_at", kind: "date" },
        { field: "updatedAt", column: "updated_at", kind: "date" },
        { field: "__v", column: "version", kind: "number" },
      ],
      indexes: [
        { name: "name_1", keys: { name: 1 }, unique: true, enforced: true },
        { name: "loc_2dsphere", keys: { loc: "2dsphere" }, enforced: true },
        { name: "createdAt_1", keys: { createdAt: 1 }, expireAfterSeconds: 3600, enforced: true },
      ],
    },
    {
      database: "test",
      collection: "owners",
      schema: "public",
      table: "owners",
      idKind: "objectId",
      columns: [
        { field: "name", column: "name", kind: "string" },
        { field: "__v", column: "version", kind: "number" },
      ],
      indexes: [],
    },
    {
      database: "test",
      collection: "inventory",
      schema: "public",
      table: "inventory",
      idKind: "objectId",
      columns: [
        { field: "roomId", column: "room_id", kind: "objectId" },
        { field: "date", column: "date", kind: "date" },
        { field: "heldCount", column: "held_count", kind: "number" },
        { field: "bookedCount", column: "booked_count", kind: "number" },
        { field: "totalInventory", column: "total_inventory", kind: "number" },
        { field: "isClosed", column: "is_closed", kind: "boolean" },
      ],
      indexes: [{ name: "roomId_1_date_1", keys: { roomId: 1, date: 1 }, unique: true, enforced: true }],
    },
    {
      database: "tirvona_leads",
      collection: "leads",
      schema: "leads",
      table: "leads",
      idKind: "objectId",
      columns: [{ field: "title", column: "title", kind: "string" }],
      indexes: [],
    },
  ],
};

describe("Postgres storage driver for Mongoose", () => {
  let db: TestDatabase;
  let mongoose: Mongoose;
  let store: PgStore;
  let Widget: Model<any>;
  let Owner: Model<any>;
  let Inventory: Model<any>;

  beforeAll(async () => {
    db = await createTestDatabase(REGISTRY.tables);
    mongoose = new Mongoose();
    store = enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false }, mongoose);
    await mongoose.connect("postgres://ignored");
    Owner = mongoose.model("Owner", new Schema({ name: String }, { collection: "owners" }));
    Widget = mongoose.model(
      "Widget",
      new Schema(
        {
          name: { type: String, required: true, unique: true },
          qty: { type: Number, default: 0 },
          tags: [String],
          ownerId: { type: Schema.Types.ObjectId, ref: "Owner" },
          refs: [{ type: Schema.Types.ObjectId }],
          when: Date,
          active: Boolean,
          status: { type: String, enum: ["draft", "live"], default: "draft" },
          meta: Schema.Types.Mixed,
          loc: { type: { type: String }, coordinates: [Number] },
          items: [{ sku: String, n: Number }],
        },
        { collection: "widgets", timestamps: true, optimisticConcurrency: true },
      ),
    );
    Inventory = mongoose.model(
      "Inventory",
      new Schema(
        { roomId: Schema.Types.ObjectId, date: Date, heldCount: Number, bookedCount: Number, totalInventory: Number, isClosed: Boolean },
        { collection: "inventory", versionKey: false },
      ),
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await db.drop();
  });

  beforeEach(async () => {
    await db.pool.query("DELETE FROM public.widgets; DELETE FROM public.owners; DELETE FROM public.inventory;");
  });

  it("creates, reads and preserves BSON types on lean reads", async () => {
    const owner = await Owner.create({ name: "Trust" });
    const when = new Date("2026-03-04T05:06:07.089Z");
    const w = await Widget.create({ name: "a", qty: 0.1 + 0.2, tags: ["x", "y"], ownerId: owner._id, refs: [owner._id], when, active: true, meta: { nested: { id: owner._id, at: when } } });
    const lean: any = await Widget.findById(w._id).lean();
    expect(lean._id.equals(w._id)).toBe(true);
    expect(lean.ownerId.equals(owner._id)).toBe(true);
    expect(lean.refs[0].equals(owner._id)).toBe(true);
    expect(lean.when.getTime()).toBe(when.getTime());
    expect(lean.qty).toBe(0.1 + 0.2);
    expect(lean.meta.nested.id.equals(owner._id)).toBe(true);
    expect(lean.meta.nested.at.getTime()).toBe(when.getTime());
    expect(lean.createdAt).toBeInstanceOf(Date);
    expect(lean.__v).toBe(0);
  });

  it("round-trips values that do not fit their column, explicit nulls and unknown fields", async () => {
    const oid = new mongoose.Types.ObjectId();
    const raw = { _id: oid, name: "mixed", qty: "5", tags: ["a", 3], when: null, extraField: { ref: oid, n: 1.5 }, list: [1, "two"] };
    await Widget.collection.insertOne({ ...raw });
    const back: any = await Widget.collection.findOne({ _id: oid });
    const { EJSON } = mongoose.mongo.BSON;
    const norm = (d: any) => JSON.parse(EJSON.stringify(d, { relaxed: false }));
    const sortKeys = (o: any): any => (Array.isArray(o) ? o.map(sortKeys) : o && typeof o === "object" ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])])) : o);
    expect(sortKeys(norm(back))).toEqual(sortKeys(norm(raw)));
    expect(await Widget.collection.countDocuments({ qty: "5" })).toBe(1);
    expect(await Widget.collection.countDocuments({ when: { $exists: true } })).toBe(1);
    expect(await Widget.collection.countDocuments({ missing: { $exists: true } })).toBe(0);
  });

  it("matches MongoDB query semantics", async () => {
    const o1 = new mongoose.Types.ObjectId();
    await Widget.insertMany([
      { name: "alpha", qty: 1, tags: ["red", "big"], active: true, ownerId: o1, items: [{ sku: "s1", n: 2 }] },
      { name: "Beta", qty: 5, tags: ["blue"], active: false, items: [{ sku: "s2", n: 9 }] },
      { name: "gamma", qty: 10, tags: [], meta: { level: 3 } },
    ]);
    const names = async (filter: any, sort: any = { name: 1 }) => (await Widget.find(filter).sort(sort).lean()).map((d: any) => d.name);
    expect(await names({ qty: { $gte: 5 } })).toEqual(["Beta", "gamma"]);
    expect(await names({ tags: "red" })).toEqual(["alpha"]);
    expect(await names({ tags: { $in: ["blue", "red"] } })).toEqual(["Beta", "alpha"]);
    expect(await names({ tags: { $size: 0 } })).toEqual(["gamma"]);
    expect(await names({ tags: { $all: ["red", "big"] } })).toEqual(["alpha"]);
    expect(await names({ ownerId: null })).toEqual(["Beta", "gamma"]);
    expect(await names({ ownerId: { $ne: o1 } })).toEqual(["Beta", "gamma"]);
    expect(await names({ name: /^b/i })).toEqual(["Beta"]);
    expect(await names({ name: { $regex: "MM", $options: "i" } })).toEqual(["gamma"]);
    expect(await names({ "items.sku": "s2" })).toEqual(["Beta"]);
    expect(await names({ items: { $elemMatch: { n: { $gt: 5 } } } })).toEqual(["Beta"]);
    expect(await names({ "meta.level": { $gte: 3 } })).toEqual(["gamma"]);
    expect(await names({ $or: [{ qty: 1 }, { active: false }] })).toEqual(["Beta", "alpha"]);
    expect(await names({ $expr: { $gt: ["$qty", 4] } })).toEqual(["Beta", "gamma"]);
    // A branch SQL cannot express must not leave stray bind parameters behind.
    expect(await names({ $or: [{ qty: 1 }, { "meta.level": 3 }] })).toEqual(["alpha", "gamma"]);
    expect(await Widget.countDocuments({ $or: [{ qty: 1 }, { "meta.level": 3 }], name: { $ne: "x" } })).toBe(2);
    expect(await names({ status: { $nin: ["live"] } })).toEqual(["Beta", "alpha", "gamma"]);
    // MongoDB orders strings bytewise: uppercase before lowercase; missing/null first.
    expect(await names({}, { name: 1 })).toEqual(["Beta", "alpha", "gamma"]);
    expect(await names({}, { qty: -1 })).toEqual(["gamma", "Beta", "alpha"]);
    expect((await Widget.find().sort({ qty: 1 }).skip(1).limit(1).lean()).map((d: any) => d.name)).toEqual(["Beta"]);
    expect(await Widget.countDocuments({ active: { $exists: true } })).toBe(2);
    expect((await Widget.distinct("tags")).sort()).toEqual(["big", "blue", "red"]);
  });

  it("keeps sort/limit correct when a value lives in _extra", async () => {
    await Widget.insertMany([{ name: "n1", qty: 3 }, { name: "n2", qty: 1 }]);
    await Widget.collection.insertOne({ name: "n3", qty: "2" } as any);
    const sorted = (await Widget.collection.find({}, { sort: { qty: 1 }, limit: 3 }).toArray()).map((d: any) => d.name);
    // MongoDB: numbers sort before strings.
    expect(sorted).toEqual(["n2", "n1", "n3"]);
  });

  it("applies update operators like MongoDB", async () => {
    const w = await Widget.create({ name: "u", qty: 1, tags: ["a"], items: [{ sku: "k1", n: 1 }, { sku: "k2", n: 1 }] });
    const r = await Widget.updateOne({ _id: w._id }, { $inc: { qty: 2 }, $push: { tags: "b" }, $set: { "meta.flag": true } });
    expect(r.modifiedCount).toBe(1);
    // MongoDB rejects two operators on the same path in one update; so does the driver.
    await expect(Widget.updateOne({ _id: w._id }, { $addToSet: { tags: "a" }, $pull: { tags: "b" } })).rejects.toThrow(/conflict/);
    await Widget.updateOne({ _id: w._id }, { $addToSet: { tags: "a" } });
    await Widget.updateOne({ _id: w._id }, { $pull: { tags: "b" } });
    await Widget.updateOne({ _id: w._id }, { $set: { "items.$[e].n": 7 } }, { arrayFilters: [{ "e.sku": "k2" }] });
    await Widget.updateOne({ _id: w._id, "items.sku": "k1" }, { $set: { "items.$.n": 5 } });
    // Through Mongoose, timestamps add updatedAt, so use the raw collection for a true no-op.
    const noop = await Widget.collection.updateOne({ _id: w._id }, { $set: { qty: 3 } });
    expect(noop.modifiedCount).toBe(0);
    const d: any = await Widget.findById(w._id).lean();
    expect(d.qty).toBe(3);
    expect(d.tags).toEqual(["a"]);
    expect(d.meta).toEqual({ flag: true });
    expect(d.items.map((i: any) => i.n)).toEqual([5, 7]);
    await Widget.updateOne({ _id: w._id }, { $unset: { meta: 1 } });
    expect(((await Widget.findById(w._id).lean()) as any).meta).toBeUndefined();
  });

  it("supports upsert with $setOnInsert and findOneAndUpdate return modes", async () => {
    const before = await Widget.findOneAndUpdate({ name: "up" }, { $set: { qty: 1 }, $setOnInsert: { status: "live" } }, { upsert: true, new: false });
    expect(before).toBeNull();
    const created: any = await Widget.findOne({ name: "up" }).lean();
    expect(created.status).toBe("live");
    const after: any = await Widget.findOneAndUpdate({ name: "up" }, { $inc: { qty: 1 }, $setOnInsert: { status: "draft" } }, { upsert: true, new: true }).lean();
    expect(after.qty).toBe(2);
    expect(after.status).toBe("live");
    const raw: any = await Widget.findOneAndUpdate({ name: "up" }, { $inc: { qty: 1 } }, { new: true, includeResultMetadata: true });
    expect(raw.lastErrorObject.updatedExisting).toBe(true);
    expect(raw.value.qty).toBe(3);
  });

  it("raises E11000 on unique violations and keeps Mongoose validation", async () => {
    await Widget.create({ name: "dup" });
    await expect(Widget.create({ name: "dup" })).rejects.toMatchObject({ code: 11000 });
    await expect(Widget.create({ name: "bad", status: "nope" })).rejects.toThrow(/validation failed/);
  });

  it("enforces optimistic concurrency on save", async () => {
    const w = await Widget.create({ name: "occ", qty: 1 });
    const a = await Widget.findById(w._id);
    const b = await Widget.findById(w._id);
    a!.qty = 2;
    await a!.save();
    b!.qty = 3;
    await expect(b!.save()).rejects.toThrow(/No matching document found|version/i);
  });

  it("commits and rolls back transactions", async () => {
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await Widget.create([{ name: "tx1" }], { session });
      await Widget.updateOne({ name: "tx1" }, { $set: { qty: 9 } }, { session });
    });
    expect(((await Widget.findOne({ name: "tx1" }).lean()) as any).qty).toBe(9);
    await expect(
      session.withTransaction(async () => {
        await Widget.create([{ name: "tx2" }], { session });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await session.endSession();
    expect(await Widget.countDocuments({ name: "tx2" })).toBe(0);
  });

  it("performs the conditional inventory hold atomically", async () => {
    const roomId = new mongoose.Types.ObjectId();
    const date = new Date("2026-11-01T00:00:00.000Z");
    await Inventory.updateOne({ roomId, date }, { $setOnInsert: { heldCount: 0, bookedCount: 0, totalInventory: 0 } }, { upsert: true });
    await Inventory.updateOne({ roomId, date }, { $max: { totalInventory: 2 } });
    const hold = (count: number) =>
      Inventory.findOneAndUpdate(
        { roomId, date, isClosed: { $ne: true }, $expr: { $lte: [{ $add: ["$heldCount", "$bookedCount", count] }, "$totalInventory"] } },
        { $inc: { heldCount: count } },
        { new: true },
      );
    expect(((await hold(1)) as any).heldCount).toBe(1);
    expect(((await hold(1)) as any).heldCount).toBe(2);
    expect(await hold(1)).toBeNull();
    await expect(Inventory.create({ roomId, date })).rejects.toMatchObject({ code: 11000 });
  });

  it("populates references", async () => {
    const owner = await Owner.create({ name: "Owner A" });
    await Widget.create({ name: "p", ownerId: owner._id });
    const d: any = await Widget.findOne({ name: "p" }).populate("ownerId").lean();
    expect(d.ownerId.name).toBe("Owner A");
  });

  it("runs aggregation pipelines including $lookup and $group", async () => {
    const owner = await Owner.create({ name: "O" });
    await Widget.insertMany([{ name: "g1", qty: 2, ownerId: owner._id }, { name: "g2", qty: 3, ownerId: owner._id }, { name: "g3", qty: 4 }]);
    const out = await Widget.aggregate([
      { $match: { qty: { $gte: 2 } } },
      { $group: { _id: "$ownerId", total: { $sum: "$qty" }, n: { $sum: 1 } } },
      { $lookup: { from: "owners", localField: "_id", foreignField: "_id", as: "owner" } },
      { $sort: { total: -1 } },
    ]);
    expect(out.map((g: any) => [g.total, g.n, g.owner[0]?.name ?? null])).toEqual([[5, 2, "O"], [4, 1, null]]);
  });

  it("answers $geoNear and $nearSphere by distance", async () => {
    const point = (lng: number, lat: number) => ({ type: "Point" as const, coordinates: [lng, lat] as [number, number] });
    await Widget.insertMany([
      { name: "near", loc: point(78.0421, 27.1751) },
      { name: "mid", loc: point(78.0521, 27.1751) },
      { name: "far", loc: point(77.209, 28.6139) },
    ]);
    const geo = await Widget.aggregate([{ $geoNear: { near: point(78.0421, 27.1751), distanceField: "d", maxDistance: 5000, spherical: true } }]);
    expect(geo.map((g: any) => g.name)).toEqual(["near", "mid"]);
    expect(geo[1].d).toBeGreaterThan(900);
    expect(geo[1].d).toBeLessThan(1100);
    const found = await Widget.find({ loc: { $nearSphere: { $geometry: point(78.0421, 27.1751), $maxDistance: 300000 } } }).lean();
    expect(found.map((g: any) => g.name)).toEqual(["near", "mid", "far"]);
  });

  it("handles deleteMany, bulkWrite and estimatedDocumentCount", async () => {
    await Widget.insertMany([{ name: "d1" }, { name: "d2" }, { name: "d3" }]);
    const bw = await Widget.bulkWrite([
      { updateOne: { filter: { name: "d1" }, update: { $set: { qty: 1 } } } },
      { deleteOne: { filter: { name: "d2" } } },
      { insertOne: { document: { name: "d4" } } },
      { updateOne: { filter: { name: "d5" }, update: { $set: { qty: 5 } }, upsert: true } },
    ]);
    expect([bw.modifiedCount, bw.deletedCount, bw.insertedCount, bw.upsertedCount]).toEqual([1, 1, 1, 1]);
    expect(await Widget.estimatedDocumentCount()).toBe(4);
    expect((await Widget.deleteMany({ qty: { $gte: 1 } })).deletedCount).toBe(2);
  });

  it("routes other MongoDB databases to their Postgres schema", async () => {
    const conn = await mongoose.createConnection("postgres://ignored", { dbName: "tirvona_leads" }).asPromise();
    const Lead = conn.model("Lead", new Schema({ title: String }, { collection: "leads" }));
    await Lead.create({ title: "hello" });
    const r = await db.pool.query("SELECT title FROM leads.leads");
    expect(r.rows.map((x: any) => x.title)).toEqual(["hello"]);
    await conn.close();
  });

  it("applies inclusion projections like MongoDB (field order, empty parents, arrays)", async () => {
    await Widget.create({ name: "proj", qty: 3, meta: { other: 1 }, items: [{ sku: "a", n: 1 }, { n: 2 }], status: "live" });
    const coll = mongoose.connection.collection("widgets");
    const doc: any = await coll.findOne({ name: "proj" }, { projection: { status: 1, "meta.city": 1, "items.sku": 1, name: 1 } });
    expect(Object.keys(doc)).toEqual(["_id", "name", "status", "meta", "items"]);
    expect(doc.meta).toEqual({});
    expect(doc.items).toEqual([{ sku: "a" }, {}]);
    const noId: any = await coll.findOne({ name: "proj" }, { projection: { _id: 0, qty: 1 } });
    expect(noId).toEqual({ qty: 3 });
    const excl: any = await coll.findOne({ name: "proj" }, { projection: { meta: 0, items: 0 } });
    expect(excl.meta).toBeUndefined();
    expect(excl.name).toBe("proj");
  });

  it("reads a collection without a table as empty and refuses writes to it", async () => {
    const coll = mongoose.connection.collection("not_in_registry");
    expect(await coll.find({ a: 1 }).toArray()).toEqual([]);
    expect(await coll.findOne({})).toBeNull();
    expect(await coll.countDocuments({})).toBe(0);
    expect(await coll.estimatedDocumentCount()).toBe(0);
    const [facet] = await coll.aggregate([{ $match: {} }, { $facet: { t0: [{ $count: "total" }] } }]).toArray();
    expect(facet).toEqual({ t0: [] });
    await expect(coll.insertOne({ a: 1 })).rejects.toThrow(/has no table in the registry/);
    await Widget.create({ name: "joined" });
    const joined = await Widget.aggregate([{ $match: { name: "joined" } }, { $lookup: { from: "not_in_registry", localField: "_id", foreignField: "wid", as: "x" } }]);
    expect(joined[0].x).toEqual([]);
  });

  it("preserves the key order of nested objects like MongoDB does", async () => {
    const meta = { zeta: 1, status: "active", targetUserId: "u1", a: { yy: 1, b: 2 }, list: [{ long: 1, s: 2 }] };
    const w = await Widget.create({ name: "ordered", meta, items: [{ sku: "k", n: 1 }] });
    const lean: any = await Widget.findById(w._id).lean();
    expect(Object.keys(lean.meta)).toEqual(["zeta", "status", "targetUserId", "a", "list"]);
    expect(Object.keys(lean.meta.a)).toEqual(["yy", "b"]);
    expect(Object.keys(lean.meta.list[0])).toEqual(["long", "s"]);
    expect(Object.keys(lean.items[0])).toEqual(["sku", "n", "_id"]);
    await Widget.updateOne({ _id: w._id }, { $set: { "meta.b": 2 } });
    expect(Object.keys(((await Widget.findById(w._id).lean()) as any).meta)).toEqual(["zeta", "status", "targetUserId", "a", "list", "b"]);
    const raw = await db.pool.query(`SELECT meta FROM public.widgets WHERE id = $1`, [String(w._id)]);
    expect(raw.rows[0].meta.status).toBe("active");
  });

  it("returns unsorted results in insertion order, also after updates", async () => {
    const created = [];
    for (const name of ["first", "second", "third"]) created.push(await Owner.create({ name }));
    await Owner.updateOne({ _id: created[0]._id }, { $set: { name: "first-updated" } });
    await Owner.updateOne({ _id: created[1]._id }, { $set: { name: "second-updated" } });
    expect((await Owner.find().lean()).map((o: any) => String(o._id))).toEqual(created.map((o) => String(o._id)));
    expect(String((await Owner.findOne().lean() as any)._id)).toBe(String(created[0]._id));
    expect((await Owner.find().skip(1).limit(1).lean()).map((o: any) => o.name)).toEqual(["second-updated"]);
    await Owner.deleteMany({});
  });

  it("refuses to connect to a database whose schema does not match the registry", async () => {
    const owners = REGISTRY.tables.filter((t) => t.table === "owners");
    const other = await createTestDatabase(owners);
    const m = new Mongoose();
    try {
      enablePostgresDriver({ pool: other.pool, registry: { ...REGISTRY, tables: owners }, ttlSweep: false }, m);
      await other.pool.query(`ALTER TABLE public.owners ALTER COLUMN name TYPE text COLLATE "default"`);
      await expect(m.connect("postgres://ignored")).rejects.toThrow(/owners\.name must be COLLATE "C"/);
      await other.pool.query(`ALTER TABLE public.owners ALTER COLUMN name TYPE text COLLATE "C", DROP COLUMN version`);
      await expect(m.connect("postgres://ignored")).rejects.toThrow(/owners\.version missing/);
    } finally {
      await m.disconnect().catch(() => undefined);
      await other.drop();
    }
  });

  it("sweeps expired rows only for TTL indexes that exist in production", async () => {
    await Widget.collection.insertOne({ name: "old", createdAt: new Date(Date.now() - 2 * 3600_000) } as any);
    await Widget.collection.insertOne({ name: "new", createdAt: new Date() } as any);
    expect(await store.sweepExpired()).toBe(1);
    expect((await Widget.find().lean()).map((d: any) => d.name)).toEqual(["new"]);
  });
  describe("under concurrency (real Postgres connections)", () => {
    it("never oversells inventory when holds race", async () => {
      const roomId = new mongoose.Types.ObjectId();
      const date = new Date("2026-12-01T00:00:00.000Z");
      await Inventory.create({ roomId, date, heldCount: 0, bookedCount: 0, totalInventory: 3 });
      const attempt = async () => {
        const session = await mongoose.startSession();
        try {
          return await session.withTransaction(async () =>
            Inventory.findOneAndUpdate(
              { roomId, date, $expr: { $lte: [{ $add: ["$heldCount", "$bookedCount", 1] }, "$totalInventory"] } },
              { $inc: { heldCount: 1 } },
              { new: true, session },
            ),
          );
        } finally {
          await session.endSession();
        }
      };
      const results = await Promise.all(Array.from({ length: 12 }, attempt));
      expect(results.filter((r) => r !== null)).toHaveLength(3);
      expect(((await Inventory.findOne({ roomId, date }).lean()) as any).heldCount).toBe(3);
    });

    it("keeps every concurrent increment outside transactions", async () => {
      const w = await Widget.create({ name: "counter", qty: 0 });
      await Promise.all(Array.from({ length: 50 }, () => Widget.updateOne({ _id: w._id }, { $inc: { qty: 1 } })));
      expect(((await Widget.findById(w._id).lean()) as any).qty).toBe(50);
    });

    it("creates exactly one row when upserts race", async () => {
      const roomId = new mongoose.Types.ObjectId();
      const date = new Date("2026-12-02T00:00:00.000Z");
      await Promise.all(
        Array.from({ length: 10 }, () =>
          Inventory.updateOne({ roomId, date }, { $setOnInsert: { heldCount: 0, bookedCount: 0, totalInventory: 0 } }, { upsert: true }),
        ),
      );
      expect(await Inventory.countDocuments({ roomId, date })).toBe(1);
    });

    it("retries conflicting transactions like MongoDB withTransaction", async () => {
      const w = await Widget.create({ name: "tx-conflict", qty: 0 });
      const bump = async () => {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const doc: any = await Widget.findById(w._id).session(session).lean();
            await Widget.updateOne({ _id: w._id }, { $set: { qty: doc.qty + 1 } }, { session });
          });
        } finally {
          await session.endSession();
        }
      };
      await Promise.all(Array.from({ length: 8 }, bump));
      expect(((await Widget.findById(w._id).lean()) as any).qty).toBe(8);
    });
  });
});
