
export const PROPERTY_TYPE_CODES = {
  AG: "Ashram Guest",
  DG: "Dharamshala Guest",
  HG: "Homestay Guest",
} as const;

export type PropertyTypeCode = keyof typeof PROPERTY_TYPE_CODES;

export const PROPERTY_TYPE_CODE_VALUES = Object.keys(
  PROPERTY_TYPE_CODES,
) as PropertyTypeCode[];

export const FALLBACK_PROPERTY_TYPE_CODE: PropertyTypeCode = "AG";

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

export const FALLBACK_CLUSTER_CODE = "XC";

const CLUSTER_LOCALITIES: Record<string, string> = {
  vrindavan: "BC",
  brindavan: "BC",
  mathura: "BC",
  gokul: "BC",
  barsana: "BC",
  nandgaon: "BC",
  govardhan: "BC",
  goverdhan: "BC",
  braj: "BC",
  haridwar: "HC",
  hardwar: "HC",
  kankhal: "HC",
  jwalapur: "HC",
  roorkee: "HC",
  rishikesh: "RC",
  hrishikesh: "RC",
  muniki: "RC",
  munikireti: "RC",
  tapovan: "RC",
  swargashram: "RC",
  varanasi: "KC",
  kashi: "KC",
  banaras: "KC",
  benares: "KC",
  sarnath: "KC",
  ramnagar: "KC",
  prayagraj: "PC",
  prayag: "PC",
  allahabad: "PC",
  ayodhya: "AC",
  faizabad: "AC",
  ujjain: "UC",
  omkareshwar: "UC",
  dwarka: "DC",
  dwarkadhish: "DC",
  beyt: "DC",
  puri: "JC",
  jagannathpuri: "JC",
  tirupati: "TC",
  tirumala: "TC",
  chittoor: "TC",
  shirdi: "SC",
  ahmednagar: "SC",
  katra: "VC",
  vaishnodevi: "VC",
  reasi: "VC",
  nashik: "NC",
  nasik: "NC",
  trimbak: "NC",
  trimbakeshwar: "NC",
  gaya: "GC",
  bodhgaya: "GC",
};

export const normaliseLocality = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const resolveClusterCode = (address: {
  city?: unknown;
  district?: unknown;
}): string =>
  CLUSTER_LOCALITIES[normaliseLocality(address?.city)] ??
  CLUSTER_LOCALITIES[normaliseLocality(address?.district)] ??
  FALLBACK_CLUSTER_CODE;

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

export const MIN_PROPERTY_SEQUENCE = 1;
export const MAX_PROPERTY_SEQUENCE = 99_999;

export const VISITOR_BLOCK_START = 1001;
export const VISITOR_BLOCK_END = 9999;
export const VISITOR_BLOCK_SIZE = VISITOR_BLOCK_END - VISITOR_BLOCK_START + 1;
export const VISITOR_BLOCK_COUNT = 26;
export const MAX_VISITOR_SEQUENCE = VISITOR_BLOCK_SIZE * VISITOR_BLOCK_COUNT;

const LETTER_A = 65;

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

export const visitorSequenceFromToken = (token: string): number | null => {
  const match = /^([A-Z])(\d{4})$/.exec(token);
  if (!match) return null;
  const block = match[1].charCodeAt(0) - LETTER_A;
  const offset = Number(match[2]);
  if (block < 0 || block >= VISITOR_BLOCK_COUNT) return null;
  if (offset < VISITOR_BLOCK_START || offset > VISITOR_BLOCK_END) return null;
  return block * VISITOR_BLOCK_SIZE + (offset - VISITOR_BLOCK_START) + 1;
};

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

export const formatIdentityCode = (
  propertyCode: string,
  visitorSequence: number,
): string => `${propertyCode}-${visitorToken(visitorSequence)}`;

export const IDENTITY_CODE_PATTERN =
  /^[A-Z]{2}(?:AG|DG|HG)-\d{5}-[A-Z]\d{4}$/;

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

export const propertyCounterKey = (
  clusterCode: string,
  propertyTypeCode: PropertyTypeCode,
): string => `property:${clusterCode}:${propertyTypeCode}`;

export const visitorCounterKey = (propertyCode: string): string =>
  `visitor:${propertyCode}`;
