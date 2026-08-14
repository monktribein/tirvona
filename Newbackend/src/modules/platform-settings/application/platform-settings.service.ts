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
          notificationSound: {
            enabled: false,
            url: "",
            fileName: "",
            volume: 0.7,
          },
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
    if (dto.notificationSound) {
      // A row created before this field existed has no subdocument at all,
      // so assigning into it would throw.
      row.notificationSound ??= {};
      const sound = dto.notificationSound;
      if (sound.url !== undefined) row.notificationSound.url = sound.url.trim();
      if (sound.fileName !== undefined)
        row.notificationSound.fileName = sound.fileName.trim();
      if (sound.volume !== undefined)
        row.notificationSound.volume = Math.min(1, Math.max(0, sound.volume));
      // Enabling with no file would leave every dashboard trying to play "".
      row.notificationSound.enabled =
        sound.enabled !== undefined
          ? sound.enabled && Boolean(row.notificationSound.url)
          : row.notificationSound.enabled && Boolean(row.notificationSound.url);
    }
    row.updatedBy = user.id;
    return row.save();
  }
}
