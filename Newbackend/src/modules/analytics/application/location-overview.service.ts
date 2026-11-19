import { Injectable, Logger } from "@nestjs/common";
import { InjectConnection, InjectModel } from "../../../database/orm-nest";
import type { Connection, Model } from "../../../database/orm";
import { LEAD_CONNECTION, LEAD_MODEL } from "../../lead-collection/domain/lead-collection.constants";

/** What the Super Admin dashboard shows for one district. */
export interface LocationRow {
  key: string;
  label: string;
  stays: number;
  temples: number;
  pandits: number;
  restaurants: number;
  leads: number;
  total: number;
}

export interface LocationOverview {
  locations: LocationRow[];
  /** Records that match none of the districts, so they cannot be placed in any row. */
  unplaced: Omit<LocationRow, "key" | "label" | "total">;
}

type Kind = "stays" | "temples" | "pandits" | "restaurants" | "leads";

/**
 * The districts Tirvona runs in. Addresses are free text ("Raman Reti,
 * Vrindavan", "Mathu", "Goverdhan"...), so each district lists the town names
 * and spellings that belong to it, lower case. Add a district here when
 * Tirvona starts running in one.
 */
const DISTRICTS: Array<{ label: string; names: string[] }> = [
  {
    label: "Mathura",
    names: [
      "mathura", "muttra", "matura", "mattura", "mathu",
      "vrindavan", "vrindaban", "brindavan", "brindaban",
      "govardhan", "goverdhan", "govardhana", "radhakund", "radha kund",
      "barsana", "gokul", "nandgaon",
    ],
  },
  { label: "Haridwar", names: ["haridwar", "hardwar", "haridvar"] },
];

const clean = (value: unknown): string => (typeof value === "string" ? value.trim().toLowerCase() : "");

const districtOf = (text: string) => DISTRICTS.find((d) => d.names.some((name) => text.includes(name)));

/**
 * How many stays, temples, pandits, restaurants and leads each district has.
 * A record is placed by its district field first, then by its city, so
 * "Vrindavan" and a misspelt "Matura" both count under Mathura.
 */
@Injectable()
export class LocationOverviewService {
  private readonly logger = new Logger(LocationOverviewService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(LEAD_MODEL, LEAD_CONNECTION) private readonly leads: Model<any>,
  ) {}

  async overview(): Promise<LocationOverview> {
    const [stays, temples, pandits, outlets, leads] = await Promise.all([
      this.read("stays", () =>
        this.connection.model("Ashram").find({ deletedAt: null }).select("address.city address.district").lean(),
      ),
      this.read("temples", () =>
        this.connection.model("Temple").find({ deletedAt: null }).select("address.city address.district").lean(),
      ),
      this.read("pandits", () =>
        this.connection.model("ProviderProfile").find({ deletedAt: null }).select("homeCity").lean(),
      ),
      this.read("restaurants", () =>
        this.connection.model("FoodOutlet").find({}).select("vendorId address").lean(),
      ),
      this.read("leads", () => this.leads.find({}).select("location.city location.district").lean()),
    ]);

    const rows = new Map<string, LocationRow>();
    const unplaced = { stays: 0, temples: 0, pandits: 0, restaurants: 0, leads: 0 };

    const rowFor = (label: string): LocationRow => {
      const key = label.toLowerCase();
      let row = rows.get(key);
      if (!row) {
        row = { key, label, stays: 0, temples: 0, pandits: 0, restaurants: 0, leads: 0, total: 0 };
        rows.set(key, row);
      }
      return row;
    };

    const place = (kind: Kind, ...texts: string[]) => {
      const district = texts.map(districtOf).find(Boolean);
      if (!district) {
        unplaced[kind] += 1;
        return;
      }
      const row = rowFor(district.label);
      row[kind] += 1;
      row.total += 1;
    };

    stays.forEach((r: any) => place("stays", clean(r?.address?.district), clean(r?.address?.city)));
    temples.forEach((r: any) => place("temples", clean(r?.address?.district), clean(r?.address?.city)));
    pandits.forEach((r: any) => place("pandits", clean(r?.homeCity)));
    leads.forEach((r: any) => place("leads", clean(r?.location?.district), clean(r?.location?.city)));

    // A restaurant's address is free text, so it is matched on the district's
    // place names. A restaurant is counted once per district it has an outlet
    // in, however many outlets it has.
    const seen = new Set<string>();
    for (const outlet of outlets as any[]) {
      const district = districtOf(clean(outlet?.address));
      const vendor = String(outlet?.vendorId ?? outlet?._id);
      if (!district) {
        if (!seen.has(`none:${vendor}`)) {
          seen.add(`none:${vendor}`);
          unplaced.restaurants += 1;
        }
        continue;
      }
      if (seen.has(`${district.label}:${vendor}`)) continue;
      seen.add(`${district.label}:${vendor}`);
      const row = rowFor(district.label);
      row.restaurants += 1;
      row.total += 1;
    }

    return {
      locations: [...rows.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
      unplaced,
    };
  }

  /** One unreadable collection must not hide the districts the others can still report. */
  private async read(kind: Kind, run: () => Promise<unknown>): Promise<any[]> {
    try {
      return ((await run()) as any[]) ?? [];
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "analytics.location_overview_failed",
          kind,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return [];
    }
  }
}
