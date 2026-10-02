/**
 * Sacred Destinations Configuration and Normalization Utilities
 *
 * Enforces strict whitelist of approved public destinations:
 * 1. Vrindavan (Primary)
 * 2. Mathura
 * 3. Govardhan
 * 4. Barsana
 *
 * Normalizes spelling variations, aliases, and addresses (e.g. Govardhan/Goverdhan,
 * Vrindavan/Vrindaban/Vrinadavn, Burja Road -> Vrindavan) to prevent arbitrary
 * database strings from creating public destination cards.
 */

export interface SacredDestinationConfig {
  id: "vrindavan" | "mathura" | "govardhan" | "barsana";
  slug: string;
  name: string;
  state: string;
  country: string;
  image: string;
  tagline: string;
  description: string;
  aliases: string[];
  defaultRating: string;
  fallbackStayCount?: number;
}

export const APPROVED_SACRED_DESTINATIONS: SacredDestinationConfig[] = [
  {
    id: "vrindavan",
    slug: "vrindavan",
    name: "Vrindavan",
    state: "Uttar Pradesh",
    country: "India",
    image: "/images/destinations/vrindavan-sacred-destination.jpg",
    tagline: "The Sacred Abode of Radha & Krishna",
    description:
      "The sacred land of Lord Krishna's childhood Leelas, dotted with ancient temples and divine stays.",
    aliases: [
      "vrindavan",
      "vrindaban",
      "vrinadavn",
      "brindavan",
      "brindaban",
      "burja road",
      "burjaroad",
      "burja-road",
      "raman reti",
      "chhatikara",
      "prem mandir",
      "banke bihari",
    ],
    defaultRating: "4.9",
  },
  {
    id: "mathura",
    slug: "mathura",
    name: "Mathura",
    state: "Uttar Pradesh",
    country: "India",
    image: "/images/destinations/mathura-sacred-destination.jpg",
    tagline: "Birthplace of Lord Krishna",
    description:
      "The sacred birthplace of Lord Krishna, one of the seven holy cities of Hinduism.",
    aliases: ["mathura", "muttra", "krishna janmabhoomi", "dwarkadhish"],
    defaultRating: "4.8",
  },
  {
    id: "govardhan",
    slug: "govardhan",
    name: "Govardhan",
    state: "Uttar Pradesh",
    country: "India",
    image: "/images/destinations/govardhan-sacred-destination.jpg",
    tagline: "Holy Hill of Braj & Sacred Parikrama",
    description:
      "Home of sacred Govardhan Hill and the divine 21-km parikrama pilgrimage.",
    aliases: [
      "govardhan",
      "goverdhan",
      "giri govardhan",
      "giriraj",
      "radha kund",
      "radhakund",
      "kusum sarovar",
      "daan ghati",
      "dan ghati",
    ],
    defaultRating: "4.8",
  },
  {
    id: "barsana",
    slug: "barsana",
    name: "Barsana",
    state: "Uttar Pradesh",
    country: "India",
    image: "/images/destinations/barsana-sacred-destination.jpg",
    tagline: "Eternal Abode of Shri Radha Rani",
    description:
      "The sacred village of Shri Radha Rani, famed for the historic hilltop temple and divine Braj devotion.",
    aliases: [
      "barsana",
      "varshana",
      "radha rani",
      "bhanugarh",
      "maan mandir",
      "rangeeli mahal",
    ],
    defaultRating: "4.8",
  },
];

/**
 * Normalizes an arbitrary text string for loose matching
 */
export function normalizeCityText(text?: string | null): string {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Maps a city or district name to an approved Sacred Destination
 */
export function resolveApprovedDestination(
  city?: string | null,
  district?: string | null,
): SacredDestinationConfig | null {
  const normCity = normalizeCityText(city);
  const normDistrict = normalizeCityText(district);

  if (!normCity && !normDistrict) return null;

  // 1. Direct match on City
  if (normCity) {
    for (const dest of APPROVED_SACRED_DESTINATIONS) {
      if (
        normCity === normalizeCityText(dest.slug) ||
        normCity === normalizeCityText(dest.name) ||
        normCity === dest.id
      ) {
        return dest;
      }
      for (const alias of dest.aliases) {
        const normAlias = normalizeCityText(alias);
        if (normCity === normAlias || normCity.includes(normAlias)) {
          return dest;
        }
      }
    }
  }

  // 2. District Match if city is an address / road or unspecified
  // Note: Mathura is the revenue district for Vrindavan, Govardhan, and Barsana.
  // We only match district Mathura if city is not one of the other sub-regions.
  if (normDistrict) {
    // If district is Mathura and city is explicitly empty or "mathura", it's Mathura
    if (normDistrict === "mathura" && (!normCity || normCity === "mathura")) {
      return (
        APPROVED_SACRED_DESTINATIONS.find((d) => d.id === "mathura") || null
      );
    }

    // For other districts or when district explicitly names Vrindavan / Govardhan / Barsana
    for (const dest of APPROVED_SACRED_DESTINATIONS) {
      if (
        normDistrict === normalizeCityText(dest.slug) ||
        normDistrict === normalizeCityText(dest.name)
      ) {
        return dest;
      }
      for (const alias of dest.aliases) {
        if (normDistrict === normalizeCityText(alias)) {
          return dest;
        }
      }
    }
  }

  return null;
}

/**
 * Checks whether an ashram belongs to a specific approved destination
 */
export function isAshramInDestination(
  ashram: any,
  destinationSlug: string,
): boolean {
  if (!ashram) return false;

  const targetNorm = normalizeCityText(destinationSlug);
  const targetConfig = APPROVED_SACRED_DESTINATIONS.find(
    (d) =>
      d.id === targetNorm ||
      d.slug === targetNorm ||
      normalizeCityText(d.name) === targetNorm,
  );

  const targetId = targetConfig?.id || targetNorm;
  const resolved = resolveApprovedDestination(
    ashram.address?.city,
    ashram.address?.district,
  );

  if (resolved && resolved.id === targetId) {
    return true;
  }

  // Explicit fallback checks
  const city = normalizeCityText(ashram.address?.city);
  const district = normalizeCityText(ashram.address?.district);
  const name = normalizeCityText(ashram.name);

  if (targetId === "vrindavan") {
    return (
      city.includes("vrind") ||
      city.includes("brind") ||
      district.includes("vrind") ||
      name.includes("vrind")
    );
  }

  if (targetId === "govardhan") {
    return (
      city.includes("goverdhan") ||
      city.includes("govardhan") ||
      district.includes("goverdhan") ||
      district.includes("govardhan") ||
      name.includes("govardhan") ||
      name.includes("goverdhan") ||
      name.includes("giriraj")
    );
  }

  if (targetId === "barsana") {
    return (
      city.includes("barsana") ||
      district.includes("barsana") ||
      name.includes("barsana")
    );
  }

  if (targetId === "mathura") {
    return (
      (city === "mathura" || district === "mathura") &&
      !city.includes("vrind") &&
      !city.includes("goverdhan") &&
      !city.includes("govardhan") &&
      !city.includes("barsana") &&
      !city.includes("burja")
    );
  }

  return false;
}
