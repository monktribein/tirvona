/**
 * Ashram Booking Unique Identity Code — `CCPT-PPPPP-VXXXX`.
 *
 * Example: `BCAG-00001-A1001` — the 1001st visitor of the first Ashram Guest
 * property registered in the Braj Cluster.
 *
 * | Segment  | Meaning                                              |
 * | -------- | ---------------------------------------------------- |
 * | `CC`     | Cluster code (`BC` Braj, `HC` Haridwar, …)            |
 * | `PT`     | Property/guest type (`AG`, `DG`, `HG`)                |
 * | `PPPPP`  | Permanent property registration number, per `CC`+`PT` |
 * | `VXXXX`  | Visitor sequence, per property                        |
 *
 * This file is pure format arithmetic — no database, no I/O. Allocation of the
 * two counters lives in `application/booking-identity.service.ts`; keeping the
 * encoding separate is what makes the boundary cases below directly testable.
 */

/** Property/guest type codes and the label each one stands for. */
export const PROPERTY_TYPE_CODES = {
  AG: "Ashram Guest",
  DG: "Dharamshala Guest",
  HG: "Homestay Guest",
} as const;

export type PropertyTypeCode = keyof typeof PROPERTY_TYPE_CODES;

export const PROPERTY_TYPE_CODE_VALUES = Object.keys(
  PROPERTY_TYPE_CODES,
) as PropertyTypeCode[];

/** Type assigned when an ashram's free-text `ashramType` matches nothing. */
export const FALLBACK_PROPERTY_TYPE_CODE: PropertyTypeCode = "AG";

/**
 * Pilgrimage clusters, keyed by the two-letter code that appears in the
 * identity code.
 *
 * Codes are permanent once printed on a booking, so an entry here may be added
 * but its key must never be repurposed to mean a different region.
 */
export const CLUSTER_NAMES: Record<string, string> = {
  BC: "Braj Cluster",
  HC: "Haridwar Cluster",
  RC: "Rishikesh Cluster",
  KC: "Kashi Cluster",
  PC: "Prayag Cluster",
  AC: "Ayodhya Cluster",
  UC: "Ujjain Cluster",
  DC: "Dwarka Cluster",
  JC: "Puri Cluster",
  TC: "Tirupati Cluster",
  SC: "Shirdi Cluster",
  VC: "Vaishno Devi Cluster",
  NC: "Nashik Cluster",
  GC: "Gaya Cluster",
  XC: "Unassigned Cluster",
};

/**
 * Cluster used when a property's city and district match no known locality.
 *
 * Deliberately a real, allocatable cluster rather than an error: refusing to
 * mint a code would block booking an otherwise valid ashram in a region the
 * table has not caught up with. Because a property's registration row is
 * immutable once written, later adding that locality to the table below does
 * not — and must not — rewrite codes already issued under `XC`.
 */
export const FALLBACK_CLUSTER_CODE = "XC";

/**
 * Locality → cluster. Both the city and the district of an ashram are looked
 * up here, city first.
 *
 * Keys are normalised with `normaliseLocality` (lowercase, alphanumeric only),
 * so spelling variants such as "Prayagraj" / "prayag raj" collapse together.
 */
const CLUSTER_LOCALITIES: Record<string, string> = {
  // Braj
  vrindavan: "BC",
  brindavan: "BC",
  mathura: "BC",
  gokul: "BC",
  barsana: "BC",
  nandgaon: "BC",
  govardhan: "BC",
  goverdhan: "BC",
  braj: "BC",
  // Haridwar
  haridwar: "HC",
  hardwar: "HC",
  kankhal: "HC",
  jwalapur: "HC",
  roorkee: "HC",
  // Rishikesh
  rishikesh: "RC",
  hrishikesh: "RC",
  muniki: "RC",
  munikireti: "RC",
  tapovan: "RC",
  swargashram: "RC",
  // Kashi
  varanasi: "KC",
  kashi: "KC",
  banaras: "KC",
  benares: "KC",
  sarnath: "KC",
  ramnagar: "KC",
  // Prayag
  prayagraj: "PC",
  prayag: "PC",
  allahabad: "PC",
  // Ayodhya
  ayodhya: "AC",
  faizabad: "AC",
  // Ujjain
  ujjain: "UC",
  omkareshwar: "UC",
  // Dwarka
  dwarka: "DC",
  dwarkadhish: "DC",
  beyt: "DC",
  // Puri
  puri: "JC",
  jagannathpuri: "JC",
  // Tirupati
  tirupati: "TC",
  tirumala: "TC",
  chittoor: "TC",
  // Shirdi
  shirdi: "SC",
  ahmednagar: "SC",
  // Vaishno Devi
  katra: "VC",
  vaishnodevi: "VC",
  reasi: "VC",
  // Nashik
  nashik: "NC",
  nasik: "NC",
  trimbak: "NC",
  trimbakeshwar: "NC",
  // Gaya
  gaya: "GC",
  bodhgaya: "GC",
};

/** Lowercase and strip everything that is not a letter or digit. */
export const normaliseLocality = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * The cluster a property belongs to, from its address.
 *
 * City wins over district: a district can span more than one cluster (Mathura
 * district holds Vrindavan and Mathura town, which are the same cluster, but
 * Dehradun district holds Rishikesh and much that is not), and the city is the
 * more specific signal.
 */
export const resolveClusterCode = (address: {
  city?: unknown;
  district?: unknown;
}): string =>
  CLUSTER_LOCALITIES[normaliseLocality(address?.city)] ??
  CLUSTER_LOCALITIES[normaliseLocality(address?.district)] ??
  FALLBACK_CLUSTER_CODE;

/**
 * The guest-type code for an ashram's free-text `ashramType`.
 *
 * `ashramType` is an unconstrained string on the ashram record and this module
 * may not change that, so matching is by substring on a normalised form.
 * Anything unrecognised — including an empty value — is an Ashram Guest, which
 * is what the overwhelming majority of listings are.
 */
export const resolvePropertyTypeCode = (
  propertyType: unknown,
): PropertyTypeCode => {
  const value = normaliseLocality(propertyType);
  if (!value) return FALLBACK_PROPERTY_TYPE_CODE;
  if (/dharam?sh?ala|dharmshala|dharmasala|sarai|serai/.test(value))
    return "DG";
  if (/homestay|home|guesthouse|guestho|paying?guest|bnb/.test(value))
    return "HG";
  return FALLBACK_PROPERTY_TYPE_CODE;
};

/** Lowest property registration number. */
export const MIN_PROPERTY_SEQUENCE = 1;
/** Highest property registration number — `99999`, the 5-digit ceiling. */
export const MAX_PROPERTY_SEQUENCE = 99_999;

/** First number inside a visitor letter block. */
export const VISITOR_BLOCK_START = 1001;
/** Last number inside a visitor letter block. */
export const VISITOR_BLOCK_END = 9999;
/** Visitors per letter block: 1001…9999 inclusive. */
export const VISITOR_BLOCK_SIZE = VISITOR_BLOCK_END - VISITOR_BLOCK_START + 1;
/** Letter blocks available: A…Z. */
export const VISITOR_BLOCK_COUNT = 26;
/** Visitors a single property can ever be issued: 26 × 8999. */
export const MAX_VISITOR_SEQUENCE = VISITOR_BLOCK_SIZE * VISITOR_BLOCK_COUNT;

const LETTER_A = 65;

/**
 * The `VXXXX` token for a 1-based visitor sequence.
 *
 * The blocks do not start at 0000 — the specified sequence runs A1001…A9999,
 * then B1001…B9999 — so each letter carries 8999 codes rather than 10000, and
 * the block boundary is arithmetic rather than a simple divide by ten.
 *
 * 1 → `A1001`, 8999 → `A9999`, 9000 → `B1001`, 233974 → `Z9999`.
 */
export const visitorToken = (sequence: number): string => {
  if (!Number.isInteger(sequence) || sequence < 1)
    throw new RangeError(
      `Visitor sequence must be a positive integer, received ${String(sequence)}.`,
    );
  if (sequence > MAX_VISITOR_SEQUENCE)
    throw new RangeError(
      `Visitor sequence ${sequence} exceeds the ${MAX_VISITOR_SEQUENCE} codes addressable by A1001–Z9999.`,
    );
  const block = Math.floor((sequence - 1) / VISITOR_BLOCK_SIZE);
  const offset = ((sequence - 1) % VISITOR_BLOCK_SIZE) + VISITOR_BLOCK_START;
  return `${String.fromCharCode(LETTER_A + block)}${offset}`;
};

/** Inverse of `visitorToken`. Returns null for anything malformed. */
export const visitorSequenceFromToken = (token: string): number | null => {
  const match = /^([A-Z])(\d{4})$/.exec(token);
  if (!match) return null;
  const block = match[1].charCodeAt(0) - LETTER_A;
  const offset = Number(match[2]);
  if (block < 0 || block >= VISITOR_BLOCK_COUNT) return null;
  if (offset < VISITOR_BLOCK_START || offset > VISITOR_BLOCK_END) return null;
  return block * VISITOR_BLOCK_SIZE + (offset - VISITOR_BLOCK_START) + 1;
};

/** The permanent `CCPT-PPPPP` half of a property's identity. */
export const formatPropertyCode = (
  clusterCode: string,
  propertyTypeCode: PropertyTypeCode,
  propertySequence: number,
): string => {
  if (!/^[A-Z]{2}$/.test(clusterCode))
    throw new RangeError(`Cluster code must be two capitals, got "${clusterCode}".`);
  if (!PROPERTY_TYPE_CODE_VALUES.includes(propertyTypeCode))
    throw new RangeError(`Unknown property type code "${propertyTypeCode}".`);
  if (
    !Number.isInteger(propertySequence) ||
    propertySequence < MIN_PROPERTY_SEQUENCE ||
    propertySequence > MAX_PROPERTY_SEQUENCE
  )
    throw new RangeError(
      `Property sequence must be ${MIN_PROPERTY_SEQUENCE}–${MAX_PROPERTY_SEQUENCE}, received ${String(propertySequence)}.`,
    );
  return `${clusterCode}${propertyTypeCode}-${String(propertySequence).padStart(5, "0")}`;
};

/** A full booking identity code from a property code and a visitor sequence. */
export const formatIdentityCode = (
  propertyCode: string,
  visitorSequence: number,
): string => `${propertyCode}-${visitorToken(visitorSequence)}`;

/** Matches a complete, well-formed identity code. */
export const IDENTITY_CODE_PATTERN =
  /^[A-Z]{2}(?:AG|DG|HG)-\d{5}-[A-Z]\d{4}$/;

/** Matches the property half on its own. */
export const PROPERTY_CODE_PATTERN = /^[A-Z]{2}(?:AG|DG|HG)-\d{5}$/;

export interface ParsedIdentityCode {
  clusterCode: string;
  clusterName: string;
  propertyTypeCode: PropertyTypeCode;
  propertyTypeName: string;
  propertySequence: number;
  propertyCode: string;
  visitorToken: string;
  visitorSequence: number;
}

/**
 * Decode an identity code back into its parts, or null if it is not one.
 *
 * Stricter than `IDENTITY_CODE_PATTERN`: `BCAG-00000-A1001` matches the shape
 * but names no property, so it is rejected here.
 */
export const parseIdentityCode = (
  code: unknown,
): ParsedIdentityCode | null => {
  const value = String(code ?? "").trim().toUpperCase();
  const match = /^([A-Z]{2})(AG|DG|HG)-(\d{5})-([A-Z]\d{4})$/.exec(value);
  if (!match) return null;
  const propertySequence = Number(match[3]);
  if (
    propertySequence < MIN_PROPERTY_SEQUENCE ||
    propertySequence > MAX_PROPERTY_SEQUENCE
  )
    return null;
  const visitorSequence = visitorSequenceFromToken(match[4]);
  if (visitorSequence === null) return null;
  const clusterCode = match[1];
  const propertyTypeCode = match[2] as PropertyTypeCode;
  return {
    clusterCode,
    clusterName: CLUSTER_NAMES[clusterCode] ?? "Unknown Cluster",
    propertyTypeCode,
    propertyTypeName: PROPERTY_TYPE_CODES[propertyTypeCode],
    propertySequence,
    propertyCode: `${clusterCode}${propertyTypeCode}-${match[3]}`,
    visitorToken: match[4],
    visitorSequence,
  };
};

/** Counter document key for a cluster/type property register. */
export const propertyCounterKey = (
  clusterCode: string,
  propertyTypeCode: PropertyTypeCode,
): string => `property:${clusterCode}:${propertyTypeCode}`;

/** Counter document key for one property's visitor register. */
export const visitorCounterKey = (propertyCode: string): string =>
  `visitor:${propertyCode}`;
