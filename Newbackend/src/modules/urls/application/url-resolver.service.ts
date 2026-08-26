import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

export interface LegacyResolver {
  /** Matches a legacy path and yields the identifier to look up. */
  pattern: RegExp;
  /** Returns the current canonical path, or null when the entity is gone. */
  resolve: (match: RegExpMatchArray) => Promise<string | null>;
}

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export const isObjectIdLike = (value: string): boolean =>
  OBJECT_ID.test(String(value ?? ""));

@Injectable()
export class UrlResolverService {
  private readonly logger = new Logger(UrlResolverService.name);
  private readonly legacy: LegacyResolver[] = [];

  constructor(
    @InjectModel("UrlRedirect") private readonly redirects: Model<any>,
  ) {}

  /**
   * Modules register how their own legacy URLs map forward, so this service
   * never needs to know about ashrams, bookings or parking directly.
   */
  register(resolver: LegacyResolver): void {
    this.legacy.push(resolver);
  }

  private normalise(path: string): string {
    const clean = String(path ?? "")
      .split("?")[0]
      .split("#")[0]
      .trim()
      .toLowerCase();
    const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
    return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
  }

  /** Records the path an entity used to live at so it keeps redirecting. */
  async remember(input: {
    fromPath: string;
    toPath: string;
    entityType: string;
    entityId?: unknown;
    reason?: string;
  }): Promise<void> {
    const fromPath = this.normalise(input.fromPath);
    const toPath = input.toPath;
    if (!fromPath || fromPath === this.normalise(toPath)) return;

    await this.redirects.updateOne(
      { fromPath },
      {
        $set: {
          toPath,
          entityType: input.entityType,
          entityId: input.entityId,
          reason: input.reason ?? "",
        },
      },
      { upsert: true },
    );

    // A path that now points elsewhere must not keep pointing at its old
    // target, or a renamed entity would send visitors round in a loop.
    await this.redirects.updateMany(
      { toPath: fromPath, entityType: input.entityType },
      { $set: { toPath } },
    );
  }

  /**
   * Resolves a legacy or superseded path to the current canonical one.
   * Returns null when nothing matches, so the caller can answer a real 404
   * instead of bouncing the visitor to the homepage.
   */
  async resolve(path: string): Promise<string | null> {
    const fromPath = this.normalise(path);
    if (!fromPath || fromPath === "/") return null;

    const stored = await this.redirects.findOne({ fromPath }).lean();
    if (stored?.toPath && this.normalise(stored.toPath) !== fromPath)
      return stored.toPath;

    for (const resolver of this.legacy) {
      const match = fromPath.match(resolver.pattern);
      if (!match) continue;
      try {
        const target = await resolver.resolve(match);
        if (target && this.normalise(target) !== fromPath) {
          await this.remember({
            fromPath,
            toPath: target,
            entityType: "legacy",
            reason: "resolved from legacy id url",
          });
          return target;
        }
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: "url.legacy_resolve_failed",
            fromPath,
            errorType: error instanceof Error ? error.name : "UnknownError",
          }),
        );
      }
    }

    return null;
  }
}
