import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { validateAssistantEntries, type AssistantEntry } from "../domain/assistant-config";
import type { SaveAssistantConfigDto } from "../presentation/assistant-config.dto";

const KEY = "assistant";

/**
 * Stores the Tirvona Assistant menu configuration in the platform settings table under its own
 * row (key "assistant"), so the public /platform-settings row is untouched. The configuration is
 * held in the row's overflow column; no schema change is needed.
 */
@Injectable()
export class AssistantConfigService {
  constructor(@InjectModel("PlatformSettings") private readonly settings: Model<any>) {}

  private async row(): Promise<any | null> {
    return this.settings.findOne({ key: KEY }).lean();
  }

  private shape(row: any, includeAdmin: boolean) {
    const config = row?.assistantConfig;
    const entries: AssistantEntry[] = Array.isArray(config?.entries) ? config.entries : [];
    const base = {
      revision: Number(config?.revision ?? 0),
      entries,
      updatedAt: config?.updatedAt ?? null,
    };
    return includeAdmin
      ? { ...base, updatedBy: config?.updatedBy ?? null, updatedByName: config?.updatedByName ?? null }
      : base;
  }

  /** What every visitor's assistant loads: visibility, enabled flags, order and module names only. */
  async getPublic() {
    return this.shape(await this.row(), false);
  }

  async getAdmin() {
    return this.shape(await this.row(), true);
  }

  async save(user: AuthenticatedUser, dto: SaveAssistantConfigDto) {
    const entries: AssistantEntry[] = dto.entries.map((e) => ({
      id: e.id,
      visible: e.visible,
      enabled: e.enabled,
      order: e.order,
      ...(e.label !== undefined ? { label: e.label.trim() } : {}),
    }));
    const problems = validateAssistantEntries(entries);
    if (problems.length) throw new BadRequestException(problems);
    return this.write(user, entries, dto.expectedRevision);
  }

  /** Restores the built-in menu: no overrides at all. */
  async reset(user: AuthenticatedUser) {
    return this.write(user, [], undefined);
  }

  private async write(user: AuthenticatedUser, entries: AssistantEntry[], expectedRevision: number | undefined) {
    const current = this.shape(await this.row(), true);
    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
      throw new ConflictException("The assistant configuration was changed by someone else. Reload and try again.");
    }
    const assistantConfig = {
      revision: current.revision + 1,
      entries,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
      updatedByName: user.name,
    };
    const row = await this.settings.findOneAndUpdate(
      { key: KEY },
      { $set: { assistantConfig, updatedBy: user.id } },
      { upsert: true, returnDocument: "after" },
    );
    return this.shape(row, true);
  }
}
