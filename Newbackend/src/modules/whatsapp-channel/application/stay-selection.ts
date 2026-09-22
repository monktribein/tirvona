/**
 * Reading a guest's stay choices out of free text.
 *
 * Everything here only *interprets* words into structured intent — which room
 * category, how many units, which coupon code, which add-on, how many adults
 * and children. Nothing here prices anything, checks a coupon, or decides
 * whether a room is free: those answers come from the booking domain
 * services, and what this module produces is only ever the *input* to them.
 *
 * Deterministic on purpose: it must keep working with the AI interpreter
 * disabled, and a rule-based reading is easy to test against the actual
 * sentences guests type ("1 deluxe aur 2 standard rooms", "ABC123 coupon
 * laga do", "2 adults aur 1 child").
 */

const NUMBER_WORDS: Record<string, number> = {
  ek: 1, ik: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5,
  panch: 5, chhe: 6, chheh: 6,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "पांच": 5, "छह": 6,
};

const norm = (value: string): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    // Combining marks (\p{M}) are part of Devanagari words — vowel signs and
    // the virama — so they must survive or "कमरे" becomes "कमर".
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const escape = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const bounded = (pattern: string, flags = "iu"): RegExp =>
  new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])(?:${pattern})(?![\\p{L}\\p{M}\\p{N}])`,
    flags,
  );

const NUM = `\\d{1,2}|${Object.keys(NUMBER_WORDS).map(escape).join("|")}`;

const toCount = (token: string): number | null => {
  const t = token.toLowerCase();
  if (/^\d+$/.test(t)) return Number(t);
  return NUMBER_WORDS[t] ?? null;
};

// ---- adults / children ------------------------------------------------------

const ADULT_UNIT =
  "adult|adults|bade|bada|vayask|vyask|grown\\s*ups?|बड़े|वयस्क";
const CHILD_UNIT =
  "child|children|kid|kids|bacche|bachche|bachcha|baccha|bachhe|बच्चे|बच्चा|बच्चों";

export interface PartySplit {
  adults?: number;
  children?: number;
}

/**
 * "2 adults aur 1 child" → `{ adults: 2, children: 1 }`.
 *
 * The backend only takes a total, so this is conversational detail that is
 * kept for the summary; `guestsCount` is always `adults + children`.
 */
export const extractPartySplit = (text: string): PartySplit => {
  const value = norm(text);
  const result: PartySplit = {};
  const find = (unit: string): number | null => {
    const before = bounded(`(${NUM})\\s*(?:${unit})`).exec(value);
    if (before) return toCount(before[1]);
    const after = bounded(`(?:${unit})\\s*(?:x|=|:)?\\s*(\\d{1,2})`).exec(value);
    return after ? Number(after[1]) : null;
  };
  const adults = find(ADULT_UNIT);
  const children = find(CHILD_UNIT);
  if (adults !== null && adults >= 0 && adults <= 30) result.adults = adults;
  if (children !== null && children >= 0 && children <= 30)
    result.children = children;
  return result;
};

// ---- room categories --------------------------------------------------------

export interface RoomOption {
  _id?: unknown;
  id?: string;
  name?: string;
  type?: string;
}

export interface RoomPick {
  roomId: string;
  units: number;
}

export interface RoomRequest {
  /**
   * Rooms the text named. `explicit` is true when the guest also gave a
   * number ("2 deluxe"); a bare name ("deluxe wala") leaves an existing
   * count alone instead of resetting it to one.
   */
  picks: (RoomPick & { explicit: boolean })[];
  /** A name that fits more than one category — the guest must choose. */
  ambiguous: { units: number; candidates: RoomOption[] }[];
  /** "2 rooms kar do" with no name: a count for whatever is already chosen. */
  unitsOnly?: number;
}

const ROOM_STOPWORDS = new Set([
  "room", "rooms", "ac", "non", "the", "a", "an", "with", "and", "for",
  "kamra", "kamre", "wala", "wali", "wale",
]);

const ROOM_KEYWORD = "room|rooms|kamra|kamre|कमरा|कमरे|कमरों";

const roomId = (room: RoomOption): string =>
  String(room.id ?? room._id ?? "");

const distinctiveTokens = (name: string): string[] => {
  const tokens = norm(name).split(" ").filter(Boolean);
  const distinct = tokens.filter(
    (token) => token.length >= 2 && !ROOM_STOPWORDS.has(token),
  );
  return distinct.length ? distinct : tokens;
};

/** How well a clause names a room category: fraction of its distinctive words present. */
const nameScore = (clause: string, room: RoomOption): number => {
  const tokens = distinctiveTokens(String(room.name ?? ""));
  if (!tokens.length) return 0;
  const hits = tokens.filter((token) =>
    bounded(escape(token)).test(clause),
  ).length;
  return hits / tokens.length;
};

/**
 * Reads "2 deluxe rooms", "1 deluxe aur 2 standard rooms", "deluxe x2",
 * "ye wala room 3 chahiye" against the property's actual room categories.
 *
 * A number is only taken as a room count when it sits next to a room name or
 * the word "room" — never a guest count ("2 guests ke liye deluxe"), a night
 * count or a date.
 */
export const extractRoomRequest = (
  text: string,
  rooms: RoomOption[],
): RoomRequest => {
  const result: RoomRequest = { picks: [], ambiguous: [] };
  if (!rooms.length) return result;

  const cleaned = norm(text)
    // Strip counts that belong to something other than rooms.
    .replace(
      bounded(
        `(?:${NUM})\\s*(?:adult|adults|child|children|kid|kids|bacche|bachche|log|logon|guest|guests|people|persons?|jane|din|dino|raat|raatein|night|nights|days?|बच्चे|लोग|दिन|रात)`,
        "giu",
      ),
      " ",
    )
    .replace(/\s+/g, " ");

  const clauses = cleaned
    .split(/\b(?:aur|and|tatha|plus)\b|[,&+]/u)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    // The count for this clause: right before a name/"room", or right after.
    const scored = rooms
      .map((room) => ({ room, score: nameScore(clause, room) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const numberNear = (anchor: string): number | null => {
      const before = bounded(`(${NUM})\\s*(?:x\\s*)?(?:\\w+\\s+){0,2}?${anchor}`).exec(
        clause,
      );
      if (before) return toCount(before[1]);
      const after = bounded(
        `${anchor}\\s*(?:x|=|:)?\\s*(${NUM})(?=\\s|$)`,
      ).exec(clause);
      return after ? toCount(after[1]) : null;
    };

    if (scored.length) {
      const best = scored[0];
      const tied = scored.filter((entry) => entry.score === best.score);
      const anchors = distinctiveTokens(String(best.room.name ?? ""))
        .map(escape)
        .join("|");
      const given =
        numberNear(`(?:${anchors})`) ?? numberNear(`(?:${ROOM_KEYWORD})`);
      const clamped = Math.max(1, Math.min(20, given ?? 1));
      if (tied.length > 1 && best.score < 1) {
        result.ambiguous.push({
          units: clamped,
          candidates: tied.map((entry) => entry.room),
        });
      } else {
        result.picks.push({
          roomId: roomId(best.room),
          units: clamped,
          explicit: given !== null,
        });
      }
      continue;
    }

    const bare = numberNear(`(?:${ROOM_KEYWORD})`);
    if (bare !== null && result.unitsOnly === undefined)
      result.unitsOnly = Math.max(1, Math.min(20, bare));
  }

  // The same category named twice sums nothing new: the later mention wins.
  const merged = new Map<string, RoomPick & { explicit: boolean }>();
  for (const pick of result.picks) merged.set(pick.roomId, pick);
  result.picks = [...merged.values()];
  return result;
};

// ---- coupons and offers -----------------------------------------------------

const COUPON_WORD = bounded(
  "coupon|coupons|promo|promocode|promo\\s*code|code|voucher|kupan|coupon\\s*code|कूपन|कोड|प्रोमो",
);

const CODE_STOPWORDS = new Set([
  "coupon", "coupons", "promo", "code", "voucher", "laga", "lagao", "lagado",
  "laga​do", "do", "dena", "apply", "karo", "kar", "krdo", "kardo", "hai",
  "hain", "the", "a", "on", "is", "ko", "ka", "ki", "ke", "se", "ye", "yeh",
  "wala", "wali", "please", "plz", "add", "use", "remove", "hata", "hatao",
  "hatado", "delete", "clear", "koi", "any", "available", "milega", "mil",
  "kya", "aur", "and", "with", "mera", "meri", "mere", "abhi", "isme", "isko",
  "book", "booking", "room", "rooms", "price", "offer", "offers", "discount",
  "cancel", "nahi", "nahin", "no", "yes", "haan", "ok", "okay", "kijiye",
  "kijie", "lagaiye", "lagana", "lagani", "chahiye", "chaiye", "dikhao",
  "batao", "list", "show", "check", "test",
]);

/**
 * A coupon code the guest typed, or null.
 *
 * Only a token that *looks like* a code counts — it contains a digit, or is
 * written in capitals — and only when the message is about a coupon (or the
 * bot just asked for one). Whether the code is real, current and applicable
 * is never decided here; the offers service decides that.
 */
export const extractCouponCode = (
  text: string,
  opts: { expectingCode?: boolean } = {},
): string | null => {
  const raw = String(text ?? "");
  const aboutCoupon = COUPON_WORD.test(norm(raw));
  if (!aboutCoupon && !opts.expectingCode) return null;
  const tokens = raw.match(/[A-Za-z0-9][A-Za-z0-9_-]{2,23}/g) ?? [];
  for (const token of tokens) {
    if (CODE_STOPWORDS.has(token.toLowerCase())) continue;
    const hasDigit = /\d/.test(token);
    const hasLetter = /[A-Za-z]/.test(token);
    const capitals = token === token.toUpperCase() && /[A-Z]{3,}/.test(token);
    if (!hasLetter) continue;
    if (hasDigit || capitals) return token.toUpperCase();
    // While the bot is waiting for a code, a lone plain word is the code.
    if (opts.expectingCode && tokens.length === 1) return token.toUpperCase();
  }
  return null;
};

const REMOVE_WORD =
  bounded(
    "hata|hatao|hatado|hata\\s*do|hatana|remove|delete|clear|nikal|nikaal|nikalo|cancel|nahi\\s*chahiye|nahin\\s*chahiye|no\\s*coupon|हटा|हटाओ|निकाल",
  );

/** "Coupon hata do" — take the applied coupon off. */
export const isCouponRemoval = (text: string): boolean => {
  const value = norm(text);
  return COUPON_WORD.test(value) && REMOVE_WORD.test(value);
};

/** "Koi coupon available hai?" — asking what exists, not naming one. */
export const isCouponQuestion = (text: string): boolean => {
  const value = norm(text);
  if (!COUPON_WORD.test(value)) return false;
  if (extractCouponCode(text)) return false;
  if (REMOVE_WORD.test(value)) return false;
  return true;
};

/** "Koi offer hai?" */
export const isOfferQuestion = (text: string): boolean =>
  bounded("offer|offers|discount|discounts|deal|deals|chhoot|chhut|छूट|ऑफर|ऑफ़र|डिस्काउंट").test(
    norm(text),
  );

/** "Price batao", "total kitna hoga". */
export const isPriceQuestion = (text: string): boolean =>
  bounded(
    "price|prices|pricing|rate|rates|cost|total|kitna|kitne|kimat|kimmat|bill|amount|charges?|breakup|breakdown|कीमत|कितना|कितने|दाम|रेट",
  ).test(norm(text));

// ---- add-ons and services ---------------------------------------------------

export const FLAT_SERVICES = ["prasad", "meals", "parking", "locker"] as const;
export type FlatService = (typeof FLAT_SERVICES)[number];

const FLAT_SERVICE_WORDS: Record<FlatService, string> = {
  prasad: "prasad|prashad|prasadam|प्रसाद",
  meals: "meals?|khana|bhojan|food|lunch|dinner|breakfast|खाना|भोजन",
  parking: "parking|पार्किंग",
  locker: "locker|lockers|लॉकर",
};

const ADD_VERB = bounded(
  "chahiye|chaiye|chahie|add|include|lena|lene|le\\s*lo|leni|laga|lagao|dena|dedo|dalo|daal|book|want|need|with|sath|saath|bhi|चाहिए|जोड़",
);
const DROP_VERB = bounded(
  "hata|hatao|hatado|hata\\s*do|remove|nahi|nahin|mat|without|cancel|delete|नहीं|हटा",
);

export interface AddOnOption {
  _id?: unknown;
  id?: string;
  name?: string;
  maxQuantity?: number;
}

export interface ServiceCommands {
  flat: Partial<Record<FlatService, boolean>>;
  addOns: { serviceId: string; quantity: number }[];
  removeAddOns: string[];
}

/**
 * "parking bhi chahiye", "meals hata do", "2 extra bed add karo".
 *
 * Add-ons are matched against the property's own add-on list by name; the
 * four flat services are the ones the website offers on every stay. A
 * service word on its own, with no add/remove verb, is not a command — it
 * falls through to the ordinary reader.
 */
export const extractServiceCommands = (
  text: string,
  addOns: AddOnOption[] = [],
): ServiceCommands => {
  const value = norm(text);
  const out: ServiceCommands = { flat: {}, addOns: [], removeAddOns: [] };
  const wantsAdd = ADD_VERB.test(value);
  const wantsDrop = DROP_VERB.test(value);
  if (!wantsAdd && !wantsDrop) return out;

  const clauses = value
    .split(/\b(?:aur|and)\b|[,&+]/u)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const drop = DROP_VERB.test(clause) || (wantsDrop && !ADD_VERB.test(clause));
    for (const service of FLAT_SERVICES) {
      if (bounded(FLAT_SERVICE_WORDS[service]).test(clause))
        out.flat[service] = !drop;
    }
    for (const addOn of addOns) {
      const tokens = norm(String(addOn.name ?? ""))
        .split(" ")
        .filter((t) => t.length >= 3 && !ROOM_STOPWORDS.has(t));
      if (!tokens.length) continue;
      const matched = tokens.every((token) => bounded(escape(token)).test(clause));
      if (!matched) continue;
      const id = String(addOn.id ?? addOn._id ?? "");
      if (drop) {
        out.removeAddOns.push(id);
        continue;
      }
      const qty = bounded(`(${NUM})\\s*(?:x\\s*)?`).exec(clause);
      const quantity = Math.max(
        1,
        Math.min(Number(addOn.maxQuantity ?? 10), qty ? (toCount(qty[1]) ?? 1) : 1),
      );
      out.addOns.push({ serviceId: id, quantity });
    }
  }
  return out;
};

/** True when a message is plausibly a stay-configuration command. */
export const looksLikeStayCommand = (text: string): boolean =>
  COUPON_WORD.test(norm(text)) ||
  isOfferQuestion(text) ||
  isPriceQuestion(text);
