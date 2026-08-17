import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  buildProfileUrl,
  buildVcardUrl,
  smartContactConfig,
  type SmartContactConfig,
} from "../config/smart-contact.config";
import {
  AUDITED_FIELD_ACTIONS,
  PUBLICLY_RESOLVABLE_STATUSES,
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
  SMART_CONTACT_CONNECTION,
  SMART_CONTACT_EVENT_MODEL,
  SMART_CONTACT_PROFILE_MODEL,
  SMART_CONTACT_QR_MODEL,
  type SmartContactStatus,
} from "../domain/smart-contact.constants";
import type {
  ActorRef,
  SmartContactProfileView,
  SmartContactPublicView,
} from "../domain/smart-contact.types";
import { SmartContactAuditService } from "./smart-contact-audit.service";

export interface ProfileListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: SmartContactStatus;
  category?: string;
  brandId?: string;
}

/**
 * Profile lifecycle for Smart Contact QR (spec §19–§22, §29).
 *
 * The service exists to protect one guarantee: the URL behind a printed QR
 * keeps resolving, and keeps resolving to the right person. Everything below
 * — the slug rules, the archive-instead-of-delete policy, the audit lines on
 * contact fields — follows from that rather than from CRUD convention.
 */
@Injectable()
export class SmartContactProfilesService {
  private readonly config: SmartContactConfig = smartContactConfig();

  constructor(
    @InjectModel(SMART_CONTACT_PROFILE_MODEL, SMART_CONTACT_CONNECTION)
    private readonly profiles: Model<Record<string, any>>,
    // Injected for permanent deletion only. A profile's QR assets and
    // analytics events are keyed to its id, so removing the profile without
    // them would leave rows pointing at nothing.
    @InjectModel(SMART_CONTACT_QR_MODEL, SMART_CONTACT_CONNECTION)
    private readonly qrCodes: Model<Record<string, any>>,
    @InjectModel(SMART_CONTACT_EVENT_MODEL, SMART_CONTACT_CONNECTION)
    private readonly events: Model<Record<string, any>>,
    private readonly audit: SmartContactAuditService,
  ) {}

  // ── Normalisation ────────────────────────────────────────────────────────

  /**
   * Derives a URL-safe slug from a name.
   *
   * Diacritics are folded rather than stripped so "Ravīndr" and "Ravindr"
   * produce the same slug; anything still non-alphanumeric after that becomes
   * a separator. A name written entirely in Devanagari reduces to nothing
   * here, which is why the caller falls back to an explicit slug rather than
   * letting an empty string through.
   */
  slugify(input: string): string {
    return String(input ?? "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, SLUG_MAX_LENGTH)
      .replace(/-+$/g, "");
  }

  private assertSlugShape(slug: string): void {
    if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
      throw new BadRequestException(
        `Profile slug must be between ${SLUG_MIN_LENGTH} and ${SLUG_MAX_LENGTH} characters.`,
      );
    }
    if (!SLUG_PATTERN.test(slug)) {
      throw new BadRequestException(
        "Profile slug may contain only lowercase letters, numbers and single hyphens.",
      );
    }
    if (RESERVED_SLUGS.includes(slug)) {
      throw new BadRequestException(`"${slug}" is a reserved profile slug.`);
    }
  }

  /** Appends `-2`, `-3`… until the slug is free. */
  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    let candidate = base;
    let suffix = 1;
    for (;;) {
      const filter: Record<string, unknown> = { slug: candidate };
      if (excludeId) filter._id = { $ne: new Types.ObjectId(excludeId) };
      const clash = await this.profiles.exists(filter);
      if (!clash) return candidate;
      suffix += 1;
      const tail = `-${suffix}`;
      candidate = `${base.slice(0, SLUG_MAX_LENGTH - tail.length)}${tail}`;
    }
  }

  /**
   * Normalises a phone to E.164.
   *
   * Ten digits are assumed Indian and get a +91, which covers essentially
   * every number this module will hold; anything already carrying a country
   * code is preserved. Stored normalised so the vCard's TEL and the wa.me link
   * never have to re-derive it, and so two admins entering the same number
   * differently do not produce two different cards.
   */
  normalisePhone(raw: string | undefined): string {
    const value = String(raw ?? "").trim();
    if (!value) return "";
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return "";
    if (value.startsWith("+")) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    if (digits.length === 11 && digits.startsWith("0"))
      return `+91${digits.slice(1)}`;
    return `+${digits}`;
  }

  /** Adds a scheme so the anchor on the public page is not treated as relative. */
  private normaliseWebsite(raw: string | undefined): string {
    const value = String(raw ?? "").trim();
    if (!value) return "";
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  // ── Projection ───────────────────────────────────────────────────────────

  private toView(doc: Record<string, any>): SmartContactProfileView {
    return {
      id: String(doc._id),
      uuid: doc.uuid ?? "",
      employeeId: doc.employeeId ?? "",
      slug: doc.slug,
      firstName: doc.firstName ?? "",
      lastName: doc.lastName ?? "",
      displayName: doc.displayName ?? "",
      organization: doc.organization ?? "",
      designation: doc.designation ?? "",
      department: doc.department ?? "",
      roleLine: doc.roleLine ?? "",
      primaryPhone: doc.primaryPhone ?? "",
      secondaryPhone: doc.secondaryPhone ?? "",
      whatsappPhone: doc.whatsappPhone ?? "",
      email: doc.email ?? "",
      website: doc.website ?? "",
      addressLine1: doc.addressLine1 ?? "",
      addressLine2: doc.addressLine2 ?? "",
      city: doc.city ?? "",
      district: doc.district ?? "",
      state: doc.state ?? "",
      postalCode: doc.postalCode ?? "",
      country: doc.country ?? "India",
      photoUrl: doc.photoUrl ?? "",
      photoAssetId: doc.photoAssetId ?? "",
      brandId: doc.brandId ?? "tirvona",
      category: doc.category ?? "employee",
      status: doc.status,
      profileUrl: buildProfileUrl(this.config, doc.slug),
      createdBy: doc.createdById
        ? { id: doc.createdById, name: doc.createdByName ?? "" }
        : null,
      updatedBy: doc.updatedById
        ? { id: doc.updatedById, name: doc.updatedByName ?? "" }
        : null,
      createdAt: doc.createdAt?.toISOString?.() ?? "",
      updatedAt: doc.updatedAt?.toISOString?.() ?? "",
    };
  }

  /**
   * The public projection (spec §34).
   *
   * A non-ACTIVE profile returns identity but no contact details at all — spec
   * §22 wants the old card to stop being useful without becoming a dead link,
   * and leaving a stale phone number reachable would defeat that. The visitor
   * gets the name they scanned, a clear notice, and a way to reach Tirvona.
   */
  toPublicView(doc: Record<string, any>): SmartContactPublicView {
    const view = this.toView(doc);
    const isActive = view.status === "ACTIVE";
    const officeAddress = [
      view.addressLine1,
      view.addressLine2,
      view.city,
      view.state,
      view.postalCode,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      slug: view.slug,
      displayName: view.displayName,
      organization: view.organization,
      designation: isActive ? view.designation : "",
      department: isActive ? view.department : "",
      roleLine: isActive ? view.roleLine : "",
      primaryPhone: isActive ? view.primaryPhone : "",
      secondaryPhone: isActive ? view.secondaryPhone : "",
      whatsappPhone: isActive ? view.whatsappPhone : "",
      email: isActive ? view.email : "",
      website: isActive ? view.website : "",
      officeAddress: isActive ? officeAddress : "",
      city: isActive ? view.city : "",
      state: isActive ? view.state : "",
      country: isActive ? view.country : "",
      photoUrl: isActive ? view.photoUrl : "",
      brandId: view.brandId,
      status: view.status,
      isActive,
      profileUrl: view.profileUrl,
      vcardUrl: buildVcardUrl(this.config, view.slug),
      ...(isActive
        ? {}
        : {
            inactiveNotice: {
              message: "This Tirvona representative profile is no longer active.",
              contactEmail: this.config.inactiveContactEmail,
            },
          }),
    };
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /**
   * Resolves a slug for the public page.
   *
   * `DRAFT` is excluded rather than shown as inactive: a draft has never been
   * printed, so a request for one is a probe or a typo, and a 404 is the
   * honest answer. Everything that has ever been live resolves.
   */
  async findBySlug(slug: string): Promise<Record<string, any>> {
    const doc = await this.profiles
      .findOne({
        slug: String(slug ?? "").toLowerCase().trim(),
        status: { $in: PUBLICLY_RESOLVABLE_STATUSES },
      })
      .lean();
    if (!doc) throw new NotFoundException("Smart Contact profile not found.");
    return doc;
  }

  async findById(id: string): Promise<SmartContactProfileView> {
    return this.toView(await this.requireDoc(id));
  }

  private async requireDoc(id: string): Promise<Record<string, any>> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException("Smart Contact profile not found.");
    const doc = await this.profiles.findById(id).lean();
    if (!doc) throw new NotFoundException("Smart Contact profile not found.");
    return doc;
  }

  async list(query: ProfileListQuery): Promise<{
    items: SmartContactProfileView[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.brandId) filter.brandId = query.brandId;

    const search = query.search?.trim();
    if (search) {
      // Substring search, consistent with the rest of the platform's admin
      // consoles — an admin looks up "bhard" and expects a hit.
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { displayName: rx },
        { firstName: rx },
        { lastName: rx },
        { slug: rx },
        { email: rx },
        { employeeId: rx },
        { designation: rx },
        { primaryPhone: rx },
      ];
    }

    const [items, total] = await Promise.all([
      this.profiles
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.profiles.countDocuments(filter),
    ]);

    return { items: items.map((doc) => this.toView(doc)), total, page, limit };
  }

  /** Status counts for the console's filter chips (spec §18). */
  async stats(): Promise<Record<string, number>> {
    const rows = await this.profiles.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const categories = await this.profiles.aggregate<{
      _id: string;
      count: number;
    }>([{ $group: { _id: "$category", count: { $sum: 1 } } }]);

    return {
      total: rows.reduce((sum, row) => sum + row.count, 0),
      draft: byStatus.DRAFT ?? 0,
      active: byStatus.ACTIVE ?? 0,
      suspended: byStatus.SUSPENDED ?? 0,
      archived: byStatus.ARCHIVED ?? 0,
      ...Object.fromEntries(
        categories.map((row) => [`category_${row._id}`, row.count]),
      ),
    };
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  private applyDerivedFields(
    input: Record<string, any>,
  ): Record<string, any> {
    const payload = { ...input };
    if ("primaryPhone" in payload)
      payload.primaryPhone = this.normalisePhone(payload.primaryPhone);
    if ("secondaryPhone" in payload)
      payload.secondaryPhone = this.normalisePhone(payload.secondaryPhone);
    if ("whatsappPhone" in payload)
      payload.whatsappPhone = this.normalisePhone(payload.whatsappPhone);
    if ("website" in payload)
      payload.website = this.normaliseWebsite(payload.website);
    return payload;
  }

  async create(
    input: Record<string, any>,
    actor: ActorRef,
    ip?: string,
  ): Promise<SmartContactProfileView> {
    const payload = this.applyDerivedFields(input);

    const displayName =
      String(payload.displayName ?? "").trim() ||
      [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim();
    if (!displayName)
      throw new BadRequestException("A display name is required.");

    const requested = String(payload.slug ?? "").trim();
    const base = requested ? this.slugify(requested) : this.slugify(displayName);
    if (!base) {
      throw new BadRequestException(
        "Could not derive a profile slug from this name. Provide one explicitly.",
      );
    }
    this.assertSlugShape(base);
    // An explicitly requested slug that is taken is an error, not something to
    // silently rename — the admin may be about to print it.
    if (requested && (await this.profiles.exists({ slug: base }))) {
      throw new ConflictException(`The profile slug "${base}" is already in use.`);
    }
    const slug = requested ? base : await this.uniqueSlug(base);

    // WhatsApp defaults to the primary number; spec §42's button needs one and
    // the two are the same for almost every representative.
    const whatsapp = payload.whatsappPhone || payload.primaryPhone || "";

    const created = await this.profiles.create({
      ...payload,
      slug,
      displayName,
      whatsappPhone: whatsapp,
      createdById: actor.id,
      createdByName: actor.name,
      updatedById: actor.id,
      updatedByName: actor.name,
    });

    await this.audit.record({
      profileId: created._id as Types.ObjectId,
      action: "PROFILE_CREATED",
      newValue: { slug, displayName },
      actor,
      ip,
    });

    return this.toView(created.toObject());
  }

  /**
   * Updates a profile.
   *
   * The slug is stripped unless the caller sets `allowSlugChange`, because
   * changing it invalidates every printed card that encodes it (spec §21).
   * Contact-field changes each get their own audit line so "who changed the
   * number, and to what" is answerable without diffing snapshots.
   */
  async update(
    id: string,
    input: Record<string, any>,
    actor: ActorRef,
    options: { allowSlugChange?: boolean } = {},
    ip?: string,
  ): Promise<SmartContactProfileView> {
    const existing = await this.requireDoc(id);
    const payload = this.applyDerivedFields(input);

    if ("slug" in payload) {
      const next = this.slugify(String(payload.slug ?? ""));
      if (!next || next === existing.slug) {
        delete payload.slug;
      } else if (!options.allowSlugChange) {
        throw new BadRequestException(
          "Changing the profile slug breaks every QR code already printed. " +
            "Re-send the request with allowSlugChange=true to confirm.",
        );
      } else {
        this.assertSlugShape(next);
        if (await this.profiles.exists({ slug: next, _id: { $ne: existing._id } })) {
          throw new ConflictException(
            `The profile slug "${next}" is already in use.`,
          );
        }
        payload.slug = next;
      }
    }

    if ("displayName" in payload && !String(payload.displayName ?? "").trim()) {
      delete payload.displayName;
    }
    // Status moves belong to the explicit lifecycle methods, which write their
    // own audit lines; letting a generic update change it would bypass those.
    delete payload.status;

    const updated = await this.profiles
      .findByIdAndUpdate(
        id,
        {
          $set: {
            ...payload,
            updatedById: actor.id,
            updatedByName: actor.name,
          },
        },
        { new: true, runValidators: true },
      )
      .lean();
    if (!updated) throw new NotFoundException("Smart Contact profile not found.");

    const entries = Object.keys(payload)
      .filter((field) => String(existing[field] ?? "") !== String(payload[field] ?? ""))
      .map((field) => ({
        profileId: existing._id as Types.ObjectId,
        action: AUDITED_FIELD_ACTIONS[field] ?? ("PROFILE_UPDATED" as const),
        field,
        oldValue: existing[field],
        newValue: payload[field],
        actor,
        ip,
      }));
    await this.audit.recordMany(entries);

    return this.toView(updated);
  }

  /**
   * Moves a profile through its lifecycle (spec §19, §22).
   *
   * There is deliberately no delete. A profile whose cards are circulating can
   * only ever be archived, so the URL keeps resolving to the notice rather
   * than to a 404 that leaves the visitor with no idea what they scanned.
   */
  async setStatus(
    id: string,
    status: SmartContactStatus,
    actor: ActorRef,
    ip?: string,
  ): Promise<SmartContactProfileView> {
    const existing = await this.requireDoc(id);
    if (existing.status === status) return this.toView(existing);

    if (status === "ACTIVE") {
      // A card with no way to reach anyone is worse than no card.
      const doc = existing;
      if (!doc.primaryPhone && !doc.email) {
        throw new BadRequestException(
          "Add a primary phone or an email address before activating this profile.",
        );
      }
    }

    const updated = await this.profiles
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status,
            updatedById: actor.id,
            updatedByName: actor.name,
          },
        },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException("Smart Contact profile not found.");

    const action =
      status === "ACTIVE"
        ? existing.status === "DRAFT"
          ? "PROFILE_ACTIVATED"
          : "PROFILE_RESTORED"
        : status === "ARCHIVED"
          ? "PROFILE_ARCHIVED"
          : "PROFILE_DISABLED";

    await this.audit.record({
      profileId: existing._id as Types.ObjectId,
      action,
      field: "status",
      oldValue: existing.status,
      newValue: status,
      actor,
      ip,
    });

    return this.toView(updated);
  }

  /**
   * Permanently remove profiles, with everything keyed to them.
   *
   * Deliberately the one destructive operation in a module built around
   * archive-instead-of-delete (spec §22): a slug freed here stops resolving,
   * so any printed QR that carries it becomes a dead link. That trade is the
   * caller's to make — the console exists to clear out drafts and test rows,
   * which archiving only hides — so this reports how many of the selected
   * profiles have QR assets registered against them rather than refusing.
   *
   * Not a transaction: the module runs on its own connection and a standalone
   * MongoDB has no session support. Children are removed before the profile,
   * so a failure part-way leaves the profile still resolving rather than a
   * live slug pointing at nothing.
   */
  async deleteMany(
    ids: string[],
    actor: ActorRef,
  ): Promise<{
    deleted: number;
    requested: number;
    printedQrCodes: number;
    slugs: string[];
  }> {
    const valid = [...new Set(ids)].filter((id) => Types.ObjectId.isValid(id));
    if (valid.length === 0)
      throw new BadRequestException(
        "Select at least one valid profile to delete.",
      );

    const docs = await this.profiles
      .find({ _id: { $in: valid } })
      .select("_id slug displayName")
      .lean();
    if (docs.length === 0)
      throw new NotFoundException("No matching Smart Contact profiles found.");

    const objectIds = docs.map((doc) => doc._id as Types.ObjectId);
    const printedQrCodes = await this.qrCodes.countDocuments({
      profileId: { $in: objectIds },
    });

    // QR assets and analytics events are operational data for a live profile
    // and go with it. The audit trail does not: a log that the logged action
    // can erase is not an audit trail, so those lines are kept and a
    // PROFILE_DELETED entry is appended naming the slug that was freed.
    await this.qrCodes.deleteMany({ profileId: { $in: objectIds } });
    await this.events.deleteMany({ profileId: { $in: objectIds } });
    const removed = await this.profiles.deleteMany({ _id: { $in: objectIds } });

    await this.audit.recordMany(
      docs.map((doc) => ({
        profileId: doc._id as Types.ObjectId,
        action: "PROFILE_DELETED" as const,
        field: "profile",
        oldValue: String(doc.slug),
        newValue: "",
        actor,
      })),
    );

    return {
      deleted: removed.deletedCount ?? 0,
      requested: valid.length,
      printedQrCodes,
      slugs: docs.map((doc) => String(doc.slug)),
    };
  }

  /** Exposed so the QR controller can resolve a profile id without a re-read. */
  async exists(id: string): Promise<boolean> {
    return (
      Types.ObjectId.isValid(id) && Boolean(await this.profiles.exists({ _id: id }))
    );
  }
}
