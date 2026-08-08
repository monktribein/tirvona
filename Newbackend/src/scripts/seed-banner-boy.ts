import { NestFactory } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import bcrypt from "bcryptjs";
import type { Model } from "mongoose";
import { AppModule } from "../app.module";
import { applyDnsServersFromEnvironment } from "../config/environment";

async function main() {
  applyDnsServersFromEnvironment();

  console.log("Initializing Nest application context...");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const userModel = app.get<Model<any>>(getModelToken("User"));

    const email = "bannerboy@tirvona.com";
    const rawPassword = "BannerBoy@123";
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    let user = await userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = new userModel({
        name: "BannerBoy CMS Manager",
        email: email.toLowerCase(),
        phone: "+91 9876543210",
        password: hashedPassword,
        role: "banner_manager",
        isEmailVerified: true,
        isActive: true,
      });
      await user.save();
      console.log("Successfully created BannerBoy account!");
    } else {
      user.role = "banner_manager";
      user.password = hashedPassword;
      user.isActive = true;
      user.isEmailVerified = true;
      await user.save();
      console.log("Successfully updated BannerBoy account password & role!");
    }

    console.log("-----------------------------------------");
    console.log("BANNERBOY LOGIN CREDENTIALS:");
    console.log(`Email:    ${email}`);
    console.log(`Password: ${rawPassword}`);
    console.log("Role:     banner_manager");
    console.log("Route:    /bannerboy/dashboard");
    console.log("-----------------------------------------");
  } catch (err) {
    console.error("Error seeding BannerBoy user:", err);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
