import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { EVENT_DEFAULTS, EVENT_MODEL } from "../domain/event.constants";

@Injectable()
export class EventSettingsService {
  constructor(
    @InjectModel(EVENT_MODEL.Setting) private readonly settings: Model<any>,
  ) {}

  /**
   * Platform defaults, then the ashram's overrides, then the event's own —
   * later scopes win, and a null column means "not set", never "clear it".
   */
  async resolve(
    eventId?: string,
    ashramId?: string,
  ): Promise<Record<string, any>> {
    const or: Record<string, unknown>[] = [{ scope: "platform" }];
    if (ashramId) or.push({ scope: "ashram", ashramId });
    if (eventId) or.push({ scope: "event", eventId });
    const rows = await this.settings.find({ $or: or }).lean();
    const result: Record<string, any> = { ...EVENT_DEFAULTS };
    for (const scope of ["platform", "ashram", "event"]) {
      const row = rows.find((candidate) => candidate.scope === scope);
      if (!row) continue;
      for (const key of Object.keys(EVENT_DEFAULTS)) {
        if (row[key] !== null && row[key] !== undefined) result[key] = row[key];
      }
    }
    return result;
  }
}
