import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { UpdatePlatformSettingsDto } from "../presentation/platform-settings.dto";
import {
  DEFAULT_PLATFORM_FEE_SCOPES,
  PLATFORM_FEE_SCOPE_VALUES,
  type PlatformFeeScope,
} from "../domain/platform-fee";
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
            appliesTo: [...DEFAULT_PLATFORM_FEE_SCOPES],
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

    /**
     * Written as an explicit dotted `$set` rather than by mutating the loaded
     * document and calling `save()`.
     *
     * `platformFee` is a nested path, not a subdocument, and assigning into it
     * did not reliably mark the path dirty — so `platformFee.enabled = false`
     * was dropped from the update and the toggle sprang back to Enabled on the
     * next refresh. A dotted `$set` states the write outright, and it sidesteps
     * the schema's `optimisticConcurrency` version check at the same time.
     */
    const update: Record<string, unknown> = { updatedBy: user.id };

    if (dto.platformFee) {
      const fee = dto.platformFee;
      if (fee.enabled !== undefined)
        update["platformFee.enabled"] = fee.enabled;
      if (fee.type) update["platformFee.type"] = fee.type;
      if (fee.value !== undefined)
        update["platformFee.value"] = Math.max(0, fee.value);
      if (fee.label !== undefined)
        update["platformFee.label"] =
          fee.label.trim() || "Tirvona Platform Fee";
      if (fee.appliesTo !== undefined)
        // Deduplicated and filtered to known systems, so an unrecognised value
        // can never park itself in the scope list and be silently ignored at
        // pricing time. An empty result is kept as-is: it means "levy nowhere".
        update["platformFee.appliesTo"] = [...new Set(fee.appliesTo)].filter(
          (scope): scope is PlatformFeeScope =>
            PLATFORM_FEE_SCOPE_VALUES.includes(scope),
        );
    }

    if (dto.gstRate !== undefined) update.gstRate = dto.gstRate;
    if (dto.platformFeeGstRate !== undefined)
      update.platformFeeGstRate = dto.platformFeeGstRate;
    if (dto.bookingCommissionPercent !== undefined)
      update.bookingCommissionPercent = dto.bookingCommissionPercent;

    if (dto.notificationSound) {
      const sound = dto.notificationSound;
      const currentUrl = String(row.notificationSound?.url ?? "");
      const nextUrl = sound.url !== undefined ? sound.url.trim() : currentUrl;
      if (sound.url !== undefined) update["notificationSound.url"] = nextUrl;
      if (sound.fileName !== undefined)
        update["notificationSound.fileName"] = sound.fileName.trim();
      if (sound.volume !== undefined)
        update["notificationSound.volume"] = Math.min(
          1,
          Math.max(0, sound.volume),
        );
      // Enabling with no file would leave every dashboard trying to play "".
      update["notificationSound.enabled"] =
        (sound.enabled !== undefined
          ? sound.enabled
          : Boolean(row.notificationSound?.enabled)) && Boolean(nextUrl);
    }

    return this.settings.findOneAndUpdate(
      { key: "main" },
      { $set: update },
      { new: true },
    );
  }
}
