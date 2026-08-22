import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

@Injectable()
export class AshramRoleMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AshramRoleMigrationService.name);

  constructor(@InjectModel("User") private readonly users: Model<any>) {}

  async onApplicationBootstrap(): Promise<void> {
    const global = await this.users.updateMany(
      {
        $or: [
          { role: "stay_admin" },
          {
            role: "owner",
            $or: [
              { permissions: "ashrams.manage_all" },
              { name: /^ashram stay admin$/i },
            ],
          },
        ],
      },
      {
        $set: { role: "ashram_admin" },
        $addToSet: { permissions: "ashrams.manage_all" },
      },
    );
    const scoped = await this.users.updateMany(
      { role: "owner" },
      { $set: { role: "ashram_owner" } },
    );

    const changed = global.modifiedCount + scoped.modifiedCount;
    if (changed)
      this.logger.log(
        `Migrated ${global.modifiedCount} Ashram Admin and ${scoped.modifiedCount} Ashram Owner account(s).`,
      );
  }
}
