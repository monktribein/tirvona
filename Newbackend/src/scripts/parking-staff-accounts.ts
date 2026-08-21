import { NestFactory } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import bcrypt from "bcryptjs";
import type { Model } from "mongoose";
import { AppModule } from "../app.module";
import { applyDnsServersFromEnvironment } from "../config/environment";
import { PARKING_MODEL } from "../modules/parking/domain/parking.constants";

const readPassword = (): string | undefined => {
  const index = process.argv.indexOf("--password");
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error("--password needs a value, e.g. --password 'secret123'");
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
      const user = await users.findById(userId).select("+passwordHash");
      if (!user) {
        out(`  ! ${userId} — grant points at a user that no longer exists`);
        continue;
      }

      if (password) {
        user.passwordHash = await bcrypt.hash(password, 12);
        user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
        await user.save();
      }

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
