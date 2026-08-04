import { NestFactory } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import bcrypt from "bcryptjs";
import type { Model } from "mongoose";
import { AppModule } from "../app.module";
import { applyDnsServersFromEnvironment } from "../config/environment";
import { PARKING_MODEL } from "../modules/parking/domain/parking.constants";

/**
 * Inspect — and optionally reset the password of — the accounts behind parking
 * role grants.
 *
 * Parking roles live in `parking_staff`, not on `User.role`, so these accounts
 * are easy to lose track of: user management does not show their parking role,
 * and the parking console does not show whether they can even sign in.
 *
 *   npx ts-node src/scripts/parking-staff-accounts.ts
 *   npx ts-node src/scripts/parking-staff-accounts.ts --password 'yourpassword'
 *
 * Without --password nothing is written. The password is an argument on purpose
 * so no credential is committed to the repository.
 */

const readPassword = (): string | undefined => {
  const index = process.argv.indexOf("--password");
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error("--password needs a value, e.g. --password 'secret123'");
  // Matches AdminResetPasswordDto, so this script cannot set a password the
  // API itself would reject.
  if (value.length < 6)
    throw new Error("Password must be at least 6 characters");
  return value;
};

async function main(): Promise<void> {
  const password = readPassword();
  // Same DNS bootstrap main.ts performs. Without it an Atlas SRV lookup uses
  // the machine's resolver, which on a host that proxies DNS through localhost
  // answers ECONNREFUSED and the script never connects.
  applyDnsServersFromEnvironment();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const out = (line: string): void => void process.stdout.write(`${line}\n`);

  try {
    const staff = app.get<Model<any>>(getModelToken(PARKING_MODEL.Staff));
    const users = app.get<Model<any>>(getModelToken("User"));

    const grants = await staff
      .find({})
      .populate("partnerId", "businessName")
      .lean();
    if (!grants.length) {
      out("No parking role grants exist yet.");
      return;
    }

    // One account can hold several grants, so collapse to unique users.
    const byUser = new Map<string, any[]>();
    for (const grant of grants) {
      const id = String(grant.userId);
      byUser.set(id, [...(byUser.get(id) ?? []), grant]);
    }

    out(
      `${byUser.size} account(s) hold ${grants.length} parking grant(s).` +
        (password ? " Setting password on each." : " Read-only — pass --password to set one."),
    );
    out("");

    const blocked: string[] = [];
    for (const [userId, held] of byUser) {
      // passwordHash is `select: false`, so it has to be asked for explicitly.
      const user = await users.findById(userId).select("+passwordHash");
      if (!user) {
        out(`  ! ${userId} — grant points at a user that no longer exists`);
        continue;
      }

      if (password) {
        user.passwordHash = await bcrypt.hash(password, 12);
        // Same as UsersService.reset: invalidate any live session so the old
        // credential cannot keep a token alive.
        user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
        await user.save();
      }

      // Status per grant, not just the roles: a revoked grant still lists a
      // role, and it is the grant's status that decides whether login treats
      // the account as staff.
      const roles = held
        .map((g) => `${g.parkingRole} [${g.status ?? "no status field"}]`)
        .join(", ");
      out(`  ${user.email}`);
      out(`      account role : ${user.role}   status: ${user.status}`);
      out(`      parking role : ${roles}`);
      out(
        `      password     : ${
          password
            ? "set by this run"
            : user.passwordHash
              ? "set (bcrypt — cannot be read back)"
              : "NOT SET — password login is impossible"
        }`,
      );

      // Mirrors AuthService.isGuestVisitor(): a `customer` is challenged with
      // an emailed OTP, unless an ACTIVE parking grant marks them a role
      // holder. A revoked grant does not count, so an account whose only grant
      // is inactive falls back to the Visitor flow — and if its mailbox
      // receives no mail, the password alone will not get it in.
      const active = held.filter((grant) => grant.status === "active");
      out(
        `      sign-in      : ${
          user.role !== "customer"
            ? `password only (account role is ${user.role})`
            : active.length
              ? "password only (active parking grant — no OTP)"
              : "OTP REQUIRED — no active grant, emailed code"
        }`,
      );
      if (user.role === "customer" && !active.length) blocked.push(user.email);
      out("");
    }

    if (blocked.length) {
      out("─".repeat(64));
      out("These accounts still need an emailed OTP to sign in:");
      blocked.forEach((email) => out(`  · ${email}`));
      out("");
      out(
        "They read `role: customer` and hold no ACTIVE parking grant, so\n" +
          "AuthService.isGuestVisitor() treats them as Guest Visitors and mails a\n" +
          "code. Re-activate the grant, or give the account a non-customer role.",
      );
    } else {
      out("─".repeat(64));
      out("All listed accounts sign in with a password alone — no OTP step.");
    }
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`parking-staff-accounts failed: ${message}\n`);
  process.exitCode = 1;
});
