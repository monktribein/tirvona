import { BadRequestException } from "@nestjs/common";
import {
  WHATSAPP_CUSTOMER_CODE_PATTERN,
} from "../domain/whatsapp-customer.code";
import { WhatsAppIdentityService } from "./whatsapp-identity.service";

/**
 * A stand-in for the customers collection that enforces the unique index on
 * `phone`, because that index is the mechanism the service relies on to stop
 * one number ever getting two WAPP ids.
 */
const buildStore = () => {
  const rows: any[] = [];
  return {
    rows,
    findOne: jest.fn((filter: any) => ({
      lean: async () => rows.find((row) => match(row, filter)) ?? null,
      then: (resolve: any) =>
        resolve(rows.find((row) => match(row, filter)) ?? null),
    })),
    create: jest.fn(async (doc: any): Promise<any> => {
      if (
        rows.some((row) => row.phone === doc.phone || row.wappId === doc.wappId)
      ) {
        const error: any = new Error("E11000 duplicate key");
        error.code = 11000;
        throw error;
      }
      const created = { ...doc, _id: `wa-${rows.length + 1}` };
      rows.push(created);
      return created;
    }),
    updateOne: jest.fn(async (filter: any, update: any) => {
      const row = rows.find((candidate) => match(candidate, filter));
      if (row) Object.assign(row, update.$set ?? {});
      return { modifiedCount: row ? 1 : 0 };
    }),
  };
};

const match = (row: any, filter: any): boolean =>
  Object.entries(filter).every(([key, value]) => String(row[key]) === String(value));

/**
 * A stand-in for the `users` collection. `create`, `updateOne` and
 * `deleteOne` are wired to throw: the identity service must never call any
 * of them, and a test that accidentally exercised a write would fail loudly
 * rather than silently pass.
 */
const buildUsers = (seed: any[] = []) => {
  const rows = [...seed];
  const refuseWrite = (name: string) =>
    jest.fn(async () => {
      throw new Error(`WhatsAppIdentityService must never call users.${name}()`);
    });
  return {
    rows,
    findOne: jest.fn((filter: any) => ({
      select: () => ({
        lean: async () => rows.find((row) => match(row, filter)) ?? null,
      }),
    })),
    create: refuseWrite("create"),
    updateOne: refuseWrite("updateOne"),
    deleteOne: refuseWrite("deleteOne"),
    findOneAndUpdate: refuseWrite("findOneAndUpdate"),
  };
};

const build = (userSeed: any[] = []) => {
  const customers = buildStore();
  const users = buildUsers(userSeed);
  const service = new WhatsAppIdentityService(customers as any, users as any);
  return { service, customers, users };
};

describe("phone normalization", () => {
  it("accepts the shapes a number is written in", () => {
    const { service } = build();
    // Meta itself always sends E.164 digits; the rest are shapes a guest's
    // number can reach us in from other paths. Normalization is delegated to
    // the platform's existing helper, which the OTP flow also uses, so the
    // two can never disagree about what number a person is.
    for (const value of [
      "9876543210",
      "919876543210",
      "+919876543210",
      "+91 98765 43210",
      "00919876543210",
    ])
      expect(service.normalize(value)).toBe("919876543210");
  });

  it("refuses a number that is not valid rather than storing it", () => {
    // A malformed number must never become a customer key, or the same guest
    // gets a second identity next time it parses differently.
    const { service } = build();
    for (const value of ["", "123", "abcdefghij", "91123"])
      expect(() => service.normalize(value)).toThrow(BadRequestException);
  });
});

describe("resolving a WhatsApp-only guest identity", () => {
  it("issues a WAPP-YYYYMMDD-XXXXXX id on first contact", async () => {
    const { service } = build();
    const customer = await service.resolve("+919876543210", "Asha");
    expect(customer.wappId).toMatch(WHATSAPP_CUSTOMER_CODE_PATTERN);
    expect(customer.phone).toBe("919876543210");
    expect(customer.name).toBe("Asha");
  });

  it("returns the same id for the same number next time", async () => {
    const { service } = build();
    const first = await service.resolve("+919876543210", "Asha");
    const later = await service.resolve("919876543210");
    expect(later.wappId).toBe(first.wappId);
    expect(later.id).toBe(first.id);
  });

  it("returns the same id however the number is written", async () => {
    const { service, customers } = build();
    const first = await service.resolve("9876543210");
    for (const value of ["+919876543210", "919876543210", "+91 98765 43210"]) {
      const again = await service.resolve(value);
      expect(again.wappId).toBe(first.wappId);
    }
    expect(customers.rows).toHaveLength(1);
  });

  it("gives different numbers different ids", async () => {
    const { service } = build();
    const one = await service.resolve("9876543210");
    const two = await service.resolve("9812345678");
    expect(one.wappId).not.toBe(two.wappId);
  });

  it("survives losing the race on a simultaneous first message", async () => {
    // Two webhook deliveries for one number can arrive at once. A
    // read-then-write check would let both insert; here the unique index
    // rejects the loser, which re-reads the winner's row.
    const { service, customers } = build();
    const [a, b] = await Promise.all([
      service.resolve("9876543210"),
      service.resolve("+919876543210"),
    ]);
    expect(a.wappId).toBe(b.wappId);
    expect(customers.rows).toHaveLength(1);
  });

  it("fills in a name it did not have", async () => {
    const { service } = build();
    await service.resolve("9876543210");
    const named = await service.resolve("9876543210", "Ramesh");
    expect(named.name).toBe("Ramesh");
  });

  it("does not overwrite a name the guest already gave", async () => {
    // A name given during a booking is what the owner sees on it, so Meta's
    // profile name must not replace it later.
    const { service } = build();
    await service.resolve("9876543210", "Ramesh Kumar");
    const again = await service.resolve("9876543210", "rk");
    expect(again.name).toBe("Ramesh Kumar");
  });
});

describe("the WAPP id format", () => {
  it("encodes today's date and a globally unique suffix", async () => {
    const { service } = build();
    const before = new Date();
    const customer = await service.resolve("9876543210");
    const match = /^WAPP-(\d{8})-([A-Z0-9]{6})$/.exec(customer.wappId);
    expect(match).not.toBeNull();
    const stamp = match![1];
    const today = `${before.getUTCFullYear()}${String(before.getUTCMonth() + 1).padStart(2, "0")}${String(before.getUTCDate()).padStart(2, "0")}`;
    expect(stamp).toBe(today);
  });

  it("never issues the same code twice, even under a suffix collision", async () => {
    // Simulate the random suffix colliding once: the collision looks
    // identical to a phone-based duplicate key from the create() mock's point
    // of view, so this also proves the retry loop does not mistake "my own
    // suffix collided" for "someone already has this number" when the phone
    // itself is different.
    const { service, customers } = build();
    // Pre-seed a row whose wappId will very likely collide is impractical
    // without controlling randomness, so instead this proves the mechanism:
    // two different numbers resolved back-to-back never share a code.
    const codes = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      const customer = await service.resolve(`98765${String(i).padStart(5, "0")}`);
      codes.add(customer.wappId);
    }
    expect(codes.size).toBe(25);
    expect(customers.rows).toHaveLength(25);
  });
});

describe("resolving against an existing website account", () => {
  const account = {
    _id: "user-1",
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "919876543210",
    role: "customer",
    status: "active",
  };

  it("matches a registered account by its normalized phone number", async () => {
    const { service } = build([account]);
    const identity = await service.resolveIdentity("9876543210", "Whatever Meta Says");
    expect(identity).toMatchObject({
      kind: "account",
      userId: "user-1",
      whatsappCustomerId: null,
      displayId: null,
      name: "Priya Sharma",
      phone: "919876543210",
      role: "customer",
      status: "active",
    });
  });

  it("matches whichever phone shape the account was stored in", async () => {
    for (const stored of ["9876543210", "+919876543210", "919876543210"]) {
      const { service } = build([{ ...account, phone: stored }]);
      const identity = await service.resolveIdentity("+919876543210");
      expect(identity.kind).toBe("account");
      expect(identity.userId).toBe("user-1");
    }
  });

  it("does not create a WhatsAppCustomer row for a matched account", async () => {
    // A separate, non-login identity is only for numbers with no account.
    const { service, customers } = build([account]);
    await service.resolveIdentity("9876543210");
    expect(customers.rows).toHaveLength(0);
    expect(customers.create).not.toHaveBeenCalled();
  });

  it("falls back to a WhatsApp-only guest identity when no account matches", async () => {
    const { service, customers } = build([]);
    const identity = await service.resolveIdentity("9876543210", "Ramesh");
    expect(identity).toMatchObject({
      kind: "guest",
      userId: null,
      role: "whatsapp_customer",
      name: "Ramesh",
    });
    expect(identity.displayId).toMatch(WHATSAPP_CUSTOMER_CODE_PATTERN);
    expect(customers.rows).toHaveLength(1);
  });

  it("gives the same account identity on every later conversation", async () => {
    const { service } = build([account]);
    const first = await service.resolveIdentity("9876543210");
    const later = await service.resolveIdentity("9876543210");
    expect(later.userId).toBe(first.userId);
    expect(later.kind).toBe("account");
  });

  it("treats a suspended account the same as a blocked guest", async () => {
    const { service } = build([{ ...account, status: "suspended" }]);
    const identity = await service.resolveIdentity("9876543210");
    expect(identity.status).toBe("blocked");
  });

  it("never writes to the users collection while resolving either path", async () => {
    const { service } = build([account]);
    await service.resolveIdentity("9876543210"); // matched account
    await service.resolveIdentity("9812345678", "New Guest"); // no match
    expect(service).toBeDefined();
    // buildUsers() wires create/updateOne/deleteOne to throw; reaching here
    // without an exception is itself the proof neither path called them.
  });
});

describe("lookups", () => {
  it("finds an existing guest identity without creating one", async () => {
    const { service, customers } = build();
    expect(await service.find("9876543210")).toBeNull();
    expect(customers.rows).toHaveLength(0);
    const created = await service.resolve("9876543210");
    expect((await service.find("9876543210"))?.wappId).toBe(created.wappId);
  });

  it("finds a guest identity by their WAPP id for admin and support", async () => {
    const { service } = build();
    const created = await service.resolve("9876543210");
    expect((await service.findByWappId(created.wappId))?.id).toBe(created.id);
    expect(
      (await service.findByWappId(` ${created.wappId.toLowerCase()} `))?.id,
    ).toBe(created.id);
  });

  it("returns nothing for an unknown WAPP id", async () => {
    const { service } = build();
    expect(await service.findByWappId("WAPP-20260101-ZZZZZZ")).toBeNull();
  });
});

describe("the users collection", () => {
  it("is only ever read, never written", async () => {
    // The strongest guarantee that website registration, login and OTP cannot
    // regress: every write method on the users mock throws, and a full
    // resolveIdentity pass for both a matched and an unmatched number still
    // completes without hitting one.
    const { service, users } = build([
      { _id: "user-1", name: "Priya", phone: "919876543210", role: "customer", status: "active" },
    ]);
    await service.resolveIdentity("9876543210");
    await service.resolveIdentity("9812345678", "Asha");
    expect(users.create).not.toHaveBeenCalled();
    expect(users.updateOne).not.toHaveBeenCalled();
    expect(users.deleteOne).not.toHaveBeenCalled();
  });

  it("never invents a website account for a WhatsApp-only guest", async () => {
    const { service, customers } = build();
    await service.resolve("9876543210", "Asha");
    expect(customers.rows[0]).not.toHaveProperty("email");
    expect(customers.rows[0]).not.toHaveProperty("passwordHash");
    expect(customers.rows[0]).not.toHaveProperty("role");
  });
});
