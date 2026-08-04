import { NestFactory } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import bcrypt from "bcryptjs";
import type { Model } from "mongoose";
import { AppModule } from "../app.module";
import { applyDnsServersFromEnvironment } from "../config/environment";
import {
  PARKING_MODEL,
  PARKING_ROLE_CAPABILITIES,
  PARKING_ROLES,
} from "../modules/parking/domain/parking.constants";
import {
  parkingLocationSlug,
  parkingPartnerCode,
} from "../modules/parking/domain/parking.utils";

/**
 * Seed one sign-in account per parking role, each with an ACTIVE grant.
 *
 *   npx ts-node src/scripts/seed-parking-roles.ts --password 'secret123'
 *
 * Idempotent: re-running updates the existing rows rather than duplicating
 * them, so it is safe to use to reset the password later.
 *
 * The accounts are created with `role: "customer"` on purpose — that is what a
 * real parking staff account looks like, because parking authorisation is a
 * grant in `parking_staff` and `USER_ROLES` has no parking entries. What makes
 * them staff is the grant, and `AuthService` reads it to skip the Guest Visitor
 * OTP and to route them to the parking dashboard.
 *
 * Grants are deliberately partner-wide (`locationIds: []`), which covers every
 * location the partner owns now or adds later.
 */

const SEED_ACCOUNTS = [
  {
    parkingRole: "parking_partner",
    name: "Parking Partner (Seed)",
    email: "partner@tirvona-parking.test",
    phone: "9000000101",
    shift: "general",
  },
  {
    parkingRole: "parking_manager",
    name: "Parking Manager (Seed)",
    email: "manager@tirvona-parking.test",
    phone: "9000000102",
    shift: "general",
  },
  {
    parkingRole: "security_guard",
    name: "Security Guard (Seed)",
    email: "guard@tirvona-parking.test",
    phone: "9000000103",
    shift: "morning",
  },
] as const;

const readPassword = (): string => {
  const index = process.argv.indexOf("--password");
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(
      "Pass the password explicitly: --password 'secret123' (min 6 characters)",
    );
  if (value.length < 6)
    throw new Error("Password must be at least 6 characters");
  return value;
};

async function main(): Promise<void> {
  const password = readPassword();
  applyDnsServersFromEnvironment();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const out = (line = ""): void => void process.stdout.write(`${line}\n`);

  try {
    const users = app.get<Model<any>>(getModelToken("User"));
    const partners = app.get<Model<any>>(getModelToken(PARKING_MODEL.Partner));
    const locations = app.get<Model<any>>(
      getModelToken(PARKING_MODEL.Location),
    );
    const staff = app.get<Model<any>>(getModelToken(PARKING_MODEL.Staff));

    // Prefer a partner that already owns locations — the dashboards are empty
    // without any, and reusing real data makes the seeded logins immediately
    // useful. Only fall back to creating one on an otherwise empty database.
    const withLocations = await locations.distinct("partnerId");
    let partner =
      (await partners.findOne({
        _id: { $in: withLocations.filter(Boolean) },
        status: { $ne: "rejected" },
      })) ?? (await partners.findOne({ status: "active" }));

    if (!partner) {
      const [owner] = await users.find({ role: "super_admin" }).limit(1);
      partner = await partners.create({
        partnerCode: parkingPartnerCode(),
        userId: owner?._id ?? null,
        businessName: "Tirvona Seed Parking Services",
        contactEmail: "seed@tirvona-parking.test",
        status: "active",
        isVerified: true,
      });
      const name = "Seed Yatri Parking";
      await locations.create({
        partnerId: partner._id,
        name,
        slug: parkingLocationSlug(name, "Haridwar"),
        address: { city: "Haridwar", state: "Uttarakhand" },
        totalCapacity: 50,
        status: "active",
        isVerified: true,
      });
      out(`Created partner "${partner.businessName}" with one location.`);
    }

    const locationCount = await locations.countDocuments({
      partnerId: partner._id,
    });
    out(
      `Partner: ${partner.businessName} (${partner.partnerCode}) — ${locationCount} location(s)`,
    );
    out();

    const passwordHash = await bcrypt.hash(password, 12);

    for (const account of SEED_ACCOUNTS) {
      // Phone is unique platform-wide; refuse rather than hijack someone else's.
      const phoneOwner = await users.findOne({ phone: account.phone });
      if (phoneOwner && phoneOwner.email !== account.email) {
        out(
          `  ! ${account.email} — skipped, phone ${account.phone} belongs to ${phoneOwner.email}`,
        );
        continue;
      }

      const user = await users.findOneAndUpdate(
        { email: account.email },
        {
          $set: {
            name: account.name,
            phone: account.phone,
            passwordHash,
            status: "active",
            isVerified: true,
          },
          $setOnInsert: { email: account.email, role: "customer" },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      const grant = await staff.findOneAndUpdate(
        {
          userId: user._id,
          partnerId: partner._id,
          parkingRole: account.parkingRole,
        },
        {
          $set: {
            locationIds: [],
            shift: account.shift,
            phone: account.phone,
            status: "active",
          },
          $setOnInsert: {
            userId: user._id,
            partnerId: partner._id,
            parkingRole: account.parkingRole,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      const capabilities =
        PARKING_ROLE_CAPABILITIES[account.parkingRole]?.length ?? 0;
      out(`  ${account.email}`);
      out(`      parking role : ${grant.parkingRole} [${grant.status}]`);
      out(`      capabilities : ${capabilities}`);
      out(`      scope        : all partner locations`);
      out(`      account role : ${user.role} (grant is what makes it staff)`);
      out();
    }

    out("─".repeat(64));
    out(`Password set on all seeded accounts. Roles: ${PARKING_ROLES.join(", ")}`);
    out("Each holds an ACTIVE grant, so login skips the OTP and lands on");
    out("/parking/dashboard. Restart the API if it is running older code.");
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`seed-parking-roles failed: ${message}\n`);
  process.exitCode = 1;
});
