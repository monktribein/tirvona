import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { CALENDAR_HOLDING_STATUSES } from "../domain/provider.constants";
import { toObjectId } from "./provider.helpers";

export interface IntegrityFinding {
  check: string;
  /** Distinct dangling ids found. */
  orphanIds: number;
  /** Rows pointing at them. */
  rows: number;
  sample: string[];
}

const CHUNK = 500;

/**
 * The platform database deliberately has no foreign keys, so references are
 * guaranteed by the services (and by transactions). This read-only check is
 * the safety net: it reports any reference that points at nothing, so drift is
 * found by an operator instead of by a customer.
 */
@Injectable()
export class ProviderIntegrityService {
  constructor(
    @InjectModel("ProviderProfile") private readonly profiles: Model<any>,
    @InjectModel("ProviderPrivateProfile") private readonly privates: Model<any>,
    @InjectModel("ProviderOffering") private readonly offerings: Model<any>,
    @InjectModel("ProviderRitual") private readonly rituals: Model<any>,
    @InjectModel("ProviderRitualVariant") private readonly variants: Model<any>,
    @InjectModel("ProviderVerificationCase") private readonly cases: Model<any>,
    @InjectModel("ProviderVerificationEvidence") private readonly evidence: Model<any>,
    @InjectModel("ProviderAvailabilityRule") private readonly rules: Model<any>,
    @InjectModel("ProviderCalendarBlock") private readonly blocks: Model<any>,
    @InjectModel("ProviderBooking") private readonly bookings: Model<any>,
    @InjectModel("ProviderBookingStateHistory") private readonly history: Model<any>,
    @InjectModel("ProviderConsultation") private readonly consultations: Model<any>,
  ) {}

  async check(): Promise<{ ok: boolean; findings: IntegrityFinding[] }> {
    const findings: IntegrityFinding[] = [];
    const run = async (
      check: string,
      source: Model<any>,
      field: string,
      target: Model<any>,
      filter: Record<string, unknown> = {},
    ) => {
      const finding = await this.orphans(check, source, field, target, filter);
      if (finding) findings.push(finding);
    };

    await run("private_profiles.providerId -> provider_profiles", this.privates, "providerId", this.profiles);
    await run("provider_offerings.providerId -> provider_profiles", this.offerings, "providerId", this.profiles);
    await run("provider_offerings.ritualVariantId -> ritual_variants", this.offerings, "ritualVariantId", this.variants);
    await run("provider_offerings.ritualId -> rituals", this.offerings, "ritualId", this.rituals);
    await run("ritual_variants.ritualId -> rituals", this.variants, "ritualId", this.rituals);
    await run("verification_cases.providerId -> provider_profiles", this.cases, "providerId", this.profiles);
    await run("verification_evidence.caseId -> verification_cases", this.evidence, "caseId", this.cases);
    await run("verification_evidence.providerId -> provider_profiles", this.evidence, "providerId", this.profiles);
    await run("availability_rules.resourceId -> provider_profiles", this.rules, "resourceId", this.profiles, {
      resourceType: "PROVIDER",
    });
    await run("calendar_blocks.resourceId -> provider_profiles", this.blocks, "resourceId", this.profiles, {
      resourceType: "PROVIDER",
    });
    await run("provider_bookings.providerId -> provider_profiles", this.bookings, "providerId", this.profiles);
    await run("provider_bookings.offeringId -> provider_offerings", this.bookings, "offeringId", this.offerings);
    await run("provider_booking_state_history.bookingId -> provider_bookings", this.history, "bookingId", this.bookings);
    await run("expert_consultations.expertProviderId -> provider_profiles", this.consultations, "expertProviderId", this.profiles);

    // A booking that holds the provider's time must have a live block for it.
    const holding: any[] = await this.bookings
      .find({ status: { $in: [...CALENDAR_HOLDING_STATUSES] } })
      .select("_id holdBlockId")
      .lean();
    const blockIds = holding.map((row) => row.holdBlockId).filter(Boolean);
    const live = new Set<string>();
    for (let i = 0; i < blockIds.length; i += CHUNK) {
      const rows: any[] = await this.blocks
        .find({ _id: { $in: blockIds.slice(i, i + CHUNK) }, status: "ACTIVE" })
        .select("_id")
        .lean();
      rows.forEach((row) => live.add(String(row._id)));
    }
    const unheld = holding.filter((row) => !row.holdBlockId || !live.has(String(row.holdBlockId)));
    if (unheld.length)
      findings.push({
        check: "bookings holding time -> active calendar block",
        orphanIds: unheld.length,
        rows: unheld.length,
        sample: unheld.slice(0, 5).map((row) => String(row._id)),
      });

    return { ok: findings.length === 0, findings };
  }

  private async orphans(
    check: string,
    source: Model<any>,
    field: string,
    target: Model<any>,
    filter: Record<string, unknown>,
  ): Promise<IntegrityFinding | null> {
    const referenced = (await source.distinct(field, filter)).filter(Boolean).map(String);
    const existing = new Set<string>();
    for (let i = 0; i < referenced.length; i += CHUNK) {
      const rows: any[] = await target
        .find({ _id: { $in: referenced.slice(i, i + CHUNK).map((id) => toObjectId(id)) } })
        .select("_id")
        .lean();
      rows.forEach((row) => existing.add(String(row._id)));
    }
    const missing = referenced.filter((id) => !existing.has(id));
    if (!missing.length) return null;
    const rows = await source.countDocuments({
      ...filter,
      [field]: { $in: missing.map((id) => toObjectId(id)) },
    });
    return { check, orphanIds: missing.length, rows, sample: missing.slice(0, 5) };
  }
}
