import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { UpdatePlatformSettingsDto } from "../presentation/platform-settings.dto";
@Injectable()
export class PlatformSettingsService {
  constructor(@InjectModel("PlatformSettings") readonly settings: Model<any>) {}
  async get(): Promise<any> {
    return this.settings.findOneAndUpdate(
      { key: "main" },
      {
        $setOnInsert: {
          platformFee: {
            enabled: true,
            type: "flat",
            value: 49,
            label: "Tirvona Platform Fee",
          },
          gstRate: 5,
          platformFeeGstRate: 18,
          bookingCommissionPercent: 10,
        },
      },
      { upsert: true, new: true },
    );
  }
  async update(
    user: AuthenticatedUser,
    dto: UpdatePlatformSettingsDto,
  ): Promise<any> {
    const row = await this.get();
    if (dto.platformFee) {
      if (dto.platformFee.enabled !== undefined)
        row.platformFee.enabled = dto.platformFee.enabled;
      if (dto.platformFee.type) row.platformFee.type = dto.platformFee.type;
      if (dto.platformFee.value !== undefined)
        row.platformFee.value = Math.max(0, dto.platformFee.value);
      if (dto.platformFee.label !== undefined)
        row.platformFee.label =
          dto.platformFee.label.trim() || "Tirvona Platform Fee";
    }
    if (dto.gstRate !== undefined) row.gstRate = dto.gstRate;
    if (dto.platformFeeGstRate !== undefined)
      row.platformFeeGstRate = dto.platformFeeGstRate;
    if (dto.bookingCommissionPercent !== undefined)
      row.bookingCommissionPercent = dto.bookingCommissionPercent;
    row.updatedBy = user.id;
    return row.save();
  }
}
