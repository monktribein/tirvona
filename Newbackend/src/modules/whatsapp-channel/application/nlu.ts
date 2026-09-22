/**
 * Rule-based understanding of what a guest asked for.
 *
 * This is the interpreter, never the business engine. It turns a message into
 * an intent from a closed list plus whatever parameters it could recognise —
 * and nothing more. It does not read the database, does not decide whether an
 * action is allowed, and never returns a free-form instruction. The action
 * layer re-validates everything it produces.
 *
 * It is deliberately deterministic so the channel works with no AI provider
 * configured. An AI interpreter can be layered in front of it later behind
 * WHATSAPP_NLU_ENABLED, producing exactly this same shape; whatever the model
 * returns still has to survive the same validation, so the model can only
 * ever choose from what is already possible here.
 *
 * Hindi, Hinglish and English are handled together rather than by branching
 * on language first: guests mix them freely inside one sentence, and a
 * message like "kal se 2 din ke liye room chahiye near Prem Mandir" has to
 * work whichever bucket you would have put it in.
 */

export type Intent =
  | "greeting"
  | "menu"
  | "search_stay"
  | "availability_query"
  | "parking"
  | "aarti"
  | "event"
  | "prashad"
  | "marketplace"
  | "my_bookings"
  | "cancel"
  | "refund_status"
  | "help"
  | "affirm"
  | "deny"
  | "payment_claim"
  | "unknown";

export interface ExtractedParameters {
  place?: string;
  checkIn?: Date;
  checkOut?: Date;
  /** Nights, when the guest gave a duration rather than a second date. */
  nights?: number;
  guests?: number;
  /** A Tirvona reference the guest quoted, e.g. TRV-… — a hint, not authority. */
  reference?: string;
}

export interface Understanding {
  intent: Intent;
  parameters: ExtractedParameters;
}

const norm = (value: string): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .trim();

const escape = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A word boundary that works for Devanagari as well as Latin.
 *
 * JavaScript's `\b` is defined against ASCII word characters, so it never
 * fires at the edges of Hindi text — a `\bदो\b` pattern matches nothing at
 * all. Look-arounds over the Unicode letter and number classes give these
 * messages the boundary they actually need.
 */
const bounded = (pattern: string, flags = "iu"): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, flags);

/** Matches whole words only, so "hi" does not fire inside "this". */
const has = (text: string, ...terms: string[]): boolean =>
  terms.some((term) => bounded(escape(term)).test(text));

const GREETING = [
  "hi", "hello", "hey", "start", "namaste", "namaskar", "pranam", "namastey",
  "नमस्ते", "नमस्कार", "प्रणाम", "हाय", "हैलो",
];

const STAY = [
  "room", "rooms", "stay", "stays", "kamra", "kamre", "ashram", "asharam",
  "dharamshala", "dharmshala", "homestay", "guesthouse", "accommodation",
  "thaharna", "rukna", "कमरा", "कमरे", "ठहरना", "रुकना", "आश्रम", "धर्मशाला",
];

const AVAILABILITY_QUERY = [
  "kaunsi date", "kaunsa date", "kaunse date", "kab date", "kab available",
  "which date", "which dates", "when is it available", "when available",
  "available date", "available dates", "date available", "dates available",
  "kya available hai", "kaunsi tareek", "kab ki date",
  "कौनसी डेट", "कब उपलब्ध", "कौन सी तारीख",
];

const PARKING = ["parking", "park", "gaadi", "gadi", "vehicle", "car", "पार्किंग", "गाड़ी"];
const AARTI = ["aarti", "arti", "आरती", "darshan", "दर्शन"];
const EVENT = ["event", "events", "programme", "program", "satsang", "इवेंट", "कार्यक्रम", "सत्संग"];
const PRASHAD = ["prashad", "prasad", "प्रसाद"];
const MARKETPLACE = ["marketplace", "shop", "store", "buy", "khareed", "मार्केट", "दुकान"];

const MY_BOOKINGS = [
  "my booking", "my bookings", "meri booking", "meri bookings", "booking status",
  "mere booking", "bookings", "meri parking", "my parking", "मेरी बुकिंग",
  "बुकिंग", "booking dekho", "booking dikhao",
];

/** "mera refund kahan hai" — asking where a refund stands, not cancelling. */
const REFUND_STATUS = ["refund", "refunds", "रिफंड", "रिफ़ंड", "paisa wapas", "paise wapas", "पैसे वापस"];

const CANCEL = ["cancel", "cancellation", "rad", "radd", "cancle", "रद्द", "कैंसिल"];
const HELP = ["help", "support", "madad", "sahayata", "मदद", "सहायता", "हेल्प"];

const AFFIRM = [
  "yes", "y", "yeah", "yep", "ok", "okay", "sure", "haan", "han", "ha",
  "haa", "ji", "jee", "theek", "thik", "bilkul", "confirm",
  "हाँ", "हां", "ठीक", "बिल्कुल", "जी",
];

const DENY = [
  "no", "n", "nope", "nahi", "nahin", "na", "mat", "नहीं", "ना", "मत",
];

const PAYMENT_CLAIM = [
  "paid", "payment done", "payment ho gaya", "paisa bhej diya",
  "pay kar diya", "kar diya payment", "भुगतान कर दिया", "पेमेंट हो गया",
];

/**
 * The calendar day in India, as a UTC midnight.
 *
 * "Tomorrow" has to mean tomorrow in India whatever timezone the server runs
 * in, so the current day is read in IST — but the value returned is UTC
 * midnight of that day, because that is how every stay date is stored and
 * compared (`eachNight` and `booking_daily_availability` both use `Date.UTC`).
 * Returning a real IST instant would put every WhatsApp booking 5½ hours off
 * the inventory rows it has to match.
 */
const istStartOfDay = (offsetDays: number, from = new Date()): Date => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const ist = new Date(from.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(
      ist.getUTCFullYear(),
      ist.getUTCMonth(),
      ist.getUTCDate() + offsetDays,
    ),
  );
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Reads a check-in date from relative words or an explicit date.
 *
 * A date with no year is read as the next occurrence rather than this
 * calendar year, so "5 Jan" asked in September means next January rather than
 * a date eight months in the past.
 */
export const extractDate = (text: string, from = new Date()): Date | null => {
  const value = norm(text);

  // Checked before "tomorrow", which is contained inside it.
  if (has(value, "day after tomorrow") || has(value, "parso", "parson", "परसों"))
    return istStartOfDay(2, from);
  if (has(value, "tomorrow", "kal", "कल")) return istStartOfDay(1, from);
  if (has(value, "today", "aaj", "abhi", "आज", "अभी"))
    return istStartOfDay(0, from);

  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(value);
  if (iso) {
    const parsed = new Date(
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
    );
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const numeric = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(value);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const year = numeric[3]
        ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3])
        : from.getUTCFullYear();
      const candidate = new Date(Date.UTC(year, month, day));
      if (!numeric[3] && candidate < istStartOfDay(0, from))
        return new Date(Date.UTC(year + 1, month, day));
      return candidate;
    }
  }

  const named =
    /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-z]{3,9})\b/.exec(value) ??
    /\b([a-z]{3,9})\s+(\d{1,2})\s*(?:st|nd|rd|th)?\b/.exec(value);
  if (named) {
    const first = Number(named[1]);
    const day = Number.isFinite(first) ? first : Number(named[2]);
    const monthName = Number.isFinite(first) ? named[2] : named[1];
    const month = MONTHS[monthName];
    if (month !== undefined && day >= 1 && day <= 31) {
      const candidate = new Date(Date.UTC(from.getUTCFullYear(), month, day));
      return candidate < istStartOfDay(0, from)
        ? new Date(Date.UTC(from.getUTCFullYear() + 1, month, day))
        : candidate;
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Time parsing.
//
// Two layers, deliberately kept apart: `extractTime` reads only an EXPLICIT
// time — a period-of-day word, an am/pm marker, or an unambiguous 24-hour
// hour — so it never guesses. `extractBareHour` reads a plain "N baje" with
// no period attached, which is genuinely ambiguous on its own; resolving it
// is `resolveBareHour`'s job below, using the hotel-domain convention that a
// check-in time defaults to the afternoon and a check-out time defaults to
// the morning — the same default every worked example in this flow already
// assumes, and one exact enough that asking "subah ya shaam?" would slow the
// guest down for no real gain. `extractTime` itself never assumes anything,
// so a caller that genuinely needs to know "was this explicit" still can.
// ---------------------------------------------------------------------------

export interface TimeToken {
  hour24: number;
  minute: number;
}

type Period = "am" | "pm";

const PERIOD_WORDS: Record<string, Period> = {
  subah: "am", morning: "am", "सुबह": "am",
  dopahar: "pm", afternoon: "pm", "दोपहर": "pm",
  shaam: "pm", sham: "pm", evening: "pm", "शाम": "pm",
  raat: "pm", night: "pm", "रात": "pm",
};

const BAJE = "baje|bje|bajhe|baj";

const to24Hour = (hour12: number, period: Period): number => {
  const base = hour12 % 12;
  return period === "pm" ? base + 12 : base;
};

/** An explicit time only — a period word, am/pm, or an unambiguous 24-hour hour. */
export const extractTime = (text: string): TimeToken | null => {
  const value = norm(text);

  if (has(value, "noon", "दोपहर के 12", "12 दोपहर")) return { hour24: 12, minute: 0 };
  if (has(value, "midnight", "आधी रात")) return { hour24: 0, minute: 0 };

  // 24-hour hours (13-23) need no period to be unambiguous.
  const colon24 = bounded(`([01]?\\d|2[0-3]):([0-5]\\d)`).exec(value);
  if (colon24 && Number(colon24[1]) >= 13)
    return { hour24: Number(colon24[1]), minute: Number(colon24[2]) };
  const baje24 = bounded(`(1[3-9]|2[0-3])\\s*(?:${BAJE}|hours|hrs)`).exec(value);
  if (baje24) return { hour24: Number(baje24[1]), minute: 0 };

  const periodPattern = Object.keys(PERIOD_WORDS).map(escape).join("|");

  // Period word before the hour: "shaam 4 baje", "subah 10:30".
  const before = bounded(
    `(${periodPattern})\\s*(\\d{1,2})(?::([0-5]\\d))?\\s*(?:${BAJE})?`,
  ).exec(value);
  if (before) {
    const hour = Number(before[2]);
    if (hour >= 1 && hour <= 12)
      return {
        hour24: to24Hour(hour, PERIOD_WORDS[before[1]]),
        minute: Number(before[3] ?? 0),
      };
  }

  // Period word after the hour: "4 baje shaam", "10 raat".
  const after = bounded(
    `(\\d{1,2})(?::([0-5]\\d))?\\s*(?:${BAJE})?\\s*(${periodPattern})`,
  ).exec(value);
  if (after) {
    const hour = Number(after[1]);
    if (hour >= 1 && hour <= 12)
      return {
        hour24: to24Hour(hour, PERIOD_WORDS[after[3]]),
        minute: Number(after[2] ?? 0),
      };
  }

  // A plain am/pm marker: "4 PM", "4:30pm", "11 AM".
  const ampm = bounded(
    `(\\d{1,2})(?::([0-5]\\d))?\\s*(am|a\\.m\\.|pm|p\\.m\\.)`,
  ).exec(value);
  if (ampm) {
    const hour = Number(ampm[1]);
    const period: Period = ampm[3].startsWith("a") ? "am" : "pm";
    if (hour >= 1 && hour <= 12)
      return { hour24: to24Hour(hour, period), minute: Number(ampm[2] ?? 0) };
  }
  return null;
};

/**
 * A bare hour attached to "baje" with no period word at all — e.g. "4 baje"
 * on its own. Genuinely ambiguous by itself; the caller resolves it with
 * `resolveBareHour` once it knows whether this is a check-in or check-out
 * time.
 */
export const extractBareHour = (text: string): number | null => {
  const match = bounded(`(\\d{1,2})\\s*(?:${BAJE})`).exec(norm(text));
  if (!match) return null;
  const hour = Number(match[1]);
  return hour >= 1 && hour <= 12 ? hour : null;
};

/**
 * Resolves a bare 1-12 hour into a 24-hour time using the hotel-domain
 * convention: check-in defaults to the afternoon/evening, check-out to the
 * morning. `12` means noon for both, which is the one hour where "morning or
 * afternoon" would otherwise be a real coin flip.
 */
export const resolveBareHour = (
  hour12: number,
  slot: "checkIn" | "checkOut",
): TimeToken => ({
  hour24:
    slot === "checkIn" ? (hour12 === 12 ? 12 : hour12 + 12) : hour12,
  minute: 0,
});

export const formatTimeToken = (token: TimeToken): string =>
  `${String(token.hour24).padStart(2, "0")}:${String(token.minute).padStart(2, "0")}`;

const NIGHT_UNIT =
  "din|dino|dinon|raat|raatein|raaton|night|nights|day|days|दिन|दिनों|रात|रातें";

const GUEST_UNIT =
  "log|logon|logo|aadmi|admi|vyakti|guest|guests|people|person|persons|adult|adults|jane|jan|लोग|लोगों|व्यक्ति|मेहमान";

const NUMBER_WORDS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "पांच": 5, "छह": 6,
};

/** Finds "<number> <unit>", in digits or in words, in any of the three styles. */
const countBefore = (
  value: string,
  unit: string,
  max: number,
): number | null => {
  const digits = bounded(`(\\d{1,2})\\s*(?:${unit})`).exec(value);
  if (digits) {
    const parsed = Number(digits[1]);
    if (parsed >= 1 && parsed <= max) return parsed;
  }
  for (const [word, count] of Object.entries(NUMBER_WORDS))
    if (bounded(`${escape(word)}\\s*(?:${unit})`).test(value)) return count;
  return null;
};

/** Reads a stay length: "2 din", "3 nights", "दो दिन", "ek raat". */
export const extractNights = (text: string): number | null =>
  countBefore(norm(text), NIGHT_UNIT, 60);

/**
 * Reads a guest count: "2 log", "3 people", "चार लोग".
 *
 * A bare number is deliberately not read here — "2 din ke liye" would
 * otherwise become two guests. The caller decides what a bare number means
 * from the question it just asked.
 */
export const extractGuests = (text: string): number | null => {
  const value = norm(text);
  const before = countBefore(value, GUEST_UNIT, 30);
  if (before !== null) return before;
  const after = bounded(`(?:${GUEST_UNIT})\\s*(\\d{1,2})`).exec(value);
  if (after) {
    const parsed = Number(after[1]);
    if (parsed >= 1 && parsed <= 30) return parsed;
  }
  return null;
};

/** A bare number, for a step that asked for one. */
export const extractBareNumber = (text: string): number | null => {
  const match = /^\s*(\d{1,2})\s*$/.exec(norm(text));
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 1 && value <= 60 ? value : null;
};

/** A Tirvona reference the guest quoted. A hint only — never authorization. */
export const extractReference = (text: string): string | null => {
  const match = /\b(TRV|PKG|ART|EVT|RES)-[A-Z0-9-]{4,}\b/i.exec(
    String(text ?? ""),
  );
  return match ? match[0].toUpperCase() : null;
};

/**
 * Words that surround a place name without being part of one.
 *
 * A token list rather than one large regex, because the regex version left
 * fragments behind whenever a word appeared twice in a sentence — "ke paas …
 * ke liye" stripped the first "ke" and kept the second, which then travelled
 * into the search query.
 */
const PLACE_STOPWORDS = new Set([
  // request verbs and pronouns
  "mujhe", "muje", "mujhko", "mera", "meri", "mere", "hume", "humein", "hum",
  "chahiye", "chaiye", "chahie", "karna", "karni", "krna", "krni", "karo",
  "kar", "kare", "kiya", "kiye", "kro", "krdo", "dena", "dedo", "de", "do",
  "book", "booking", "dhundo", "dhoondo", "dikhao", "batao", "chahta",
  "chahti", "lena", "rakho", "rakhna", "le", "liya", "dijiye", "kijiye",
  "kijiyega", "chal", "chalo",
  "i", "we", "me", "my", "want", "wants", "wanted", "need", "needs", "needed",
  "looking", "look", "like", "would", "get", "find", "show", "please", "plz",
  "pls", "can", "could", "help", "give", "make", "any", "some", "available",
  // stay nouns
  "room", "rooms", "kamra", "kamre", "stay", "stays", "hotel", "ashram",
  "ashrams", "dharamshala", "dharmshala", "homestay", "guesthouse",
  "accommodation", "place", "places",
  // prepositions and particles
  "ke", "ki", "ka", "k", "ko", "se", "par", "pe", "liye", "lie", "mein", "me",
  "near", "nearby", "around", "in", "at", "by", "close", "to", "for", "from",
  "till", "until", "tak", "paas", "pass", "najdeek", "nazdeek", "aur", "and", "or",
  "a", "an", "the", "of", "on", "with", "is", "are", "am", "be",
  // fillers
  "hai", "hain", "he", "h", "ji", "bhai", "bhaiya", "sir", "madam", "hello",
  "hi", "namaste", "please",
  // time words
  "tomorrow", "today", "kal", "aaj", "parso", "parson", "day", "days", "night",
  "nights", "din", "dino", "dinon", "raat", "week", "month",
  // clock time and check-in/out vocabulary — none of these are place names,
  // and leaving them out let a combined date+time sentence like "kal 4 baje
  // checkin aur agle din 11 baje checkout" leak "baje checkin agle checkout"
  // through as a bogus location.
  "baje", "bje", "bajhe", "baj", "am", "pm", "checkin", "check-in", "checkout",
  "check-out", "agle", "agla", "aglaa", "doosre", "dusre", "subah", "dopahar",
  "shaam", "sham",
  // people words
  "log", "logon", "logo", "people", "person", "persons", "guest", "guests",
  "adult", "adults", "aadmi", "admi",
  // listing/discovery words — "asharam ka list do" must not be read as a
  // place called "list do".
  "list", "lists", "listing", "asharam", "sabhi", "saare", "sare",
  "properties", "property",
  // correction markers — "actually 4 log hain" must update the guest count,
  // not be read as a place called "actually".
  "actually", "acutally", "waise", "vaise", "galti", "galat", "sorry", "nahi",
  "nahin", "matlab", "wait",
  // hedges and fillers — a guest thinking out loud ("hmm not sure yet") must
  // not be read as naming a place.
  "hmm", "hmmm", "umm", "uhh", "not", "sure", "yet", "maybe", "shayad",
  "pata", "nahi pata", "dunno", "know", "let", "me", "think", "socho",
  "sochta", "sochti",
  // reference pronouns — "isme booking karni hai" ("book this one") must not
  // read "isme" itself as a place; it refers to something already shown.
  "isme", "ismein", "isi", "iske", "isko", "isse", "usme", "usmein", "usi",
  "uske", "usko", "usse", "wala", "waali", "wale",
  // availability-query vocabulary — "kaunsi date available hai" must not
  // read "kaunsi date" as a place.
  "kab", "kaunsi", "kaunsa", "kaunse", "date", "dates", "tareek", "tarikh",
  "available", "उपलब्ध",
  // party and booking-adjustment vocabulary — "2 adults aur 1 child" must not
  // read "child" as a place (which would silently drop the property the guest
  // chose), and "change kar do", "coupon laga do", "price batao" are about the
  // booking, not somewhere to stay.
  "child", "children", "kid", "kids", "bacche", "bachche", "bachcha", "baccha",
  "bade", "bada", "vayask", "grown", "ups",
  "change", "badlo", "badal", "badalna", "update",
  "price", "prices", "rate", "cost", "total", "kitna", "kitne", "kimat",
  "coupon", "coupons", "promo", "code", "voucher", "offer", "offers",
  "discount", "deal", "apply", "laga", "lagao", "lagado", "hata", "hatao",
  "hatado", "remove", "add", "extra", "refund", "status",
]);

/** "list do", "sabhi ashram", "dikhao" — a browse request, not a booking one. */
const DISCOVERY_TRIGGER = bounded(
  "list|dikhao|dikha do|batao|batayein|sabhi|saare|sare",
);

/**
 * Pulls a likely place name out of a free-text request.
 *
 * Deliberately conservative: it drops the tokens that are certainly not part
 * of a place and returns what is left. A wrong guess costs little — the
 * result goes to the same search the website uses, and finding nothing just
 * means the guest is asked to name the place. Returning a whole sentence
 * would be worse, so anything longer than a plausible place name is refused.
 */
/**
 * "X nahi, Y" ("not X, Y") — a spoken correction names the wrong value before
 * the right one. Reading it whole would join both into one bogus place
 * ("Vrindavan Mathura"); only the part after the last correction marker is
 * the guest's actual, current answer.
 */
const CORRECTION_MARKER = /\b(?:nahi|nahin)\b/iu;

export const extractPlace = (text: string): string | null => {
  const raw = String(text ?? "");
  const parts = raw.split(CORRECTION_MARKER);
  const relevant = parts.length > 1 ? parts[parts.length - 1] : raw;

  const tokens = relevant
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/\d/.test(token))
    .filter((token) => token.length > 1)
    .filter((token) => !PLACE_STOPWORDS.has(token.toLowerCase()))
    .filter((token) => !(token.toLowerCase() in NUMBER_WORDS));

  if (!tokens.length) return null;
  // A place name is at most a few words. More than that means the stripping
  // failed and we are about to search on a sentence.
  if (tokens.length > 4) return null;
  const place = tokens.join(" ");
  // A single leftover token under four letters is disproportionately likely
  // to be a short verb root the stopword list has not caught yet ("kar",
  // "de", "lo") rather than a real place — every destination Tirvona
  // actually serves is four letters or more ("Puri", "Gaya", "Ujjain", ...).
  // A multi-word result carries no such risk, since two unrelated three- and
  // four-letter filler words surviving the filters together is vanishingly
  // unlikely.
  if (tokens.length === 1 && place.length < 4) return null;
  return place;
};

// ---------------------------------------------------------------------------
// Combined stay-slot extraction.
//
// This is the fix for the reported "bot asks the same question twice" bug.
// The old code called `extractDate`/`extractNights`/... once per message and
// let the *conversation layer* decide, from `session.step` alone, whether a
// found date meant check-in or check-out. That guess had no way to know a
// reply was actually answering the checkout question, so a lone "tomorrow"
// given in answer to "when do you check out?" was silently written back onto
// check-in instead — the guest's answer vanished, and the same question came
// back next turn looking exactly like it had been ignored.
//
// `extractStayEntities` fixes this two ways: it reads a *whole* sentence for
// up to two date/time pairs at once (splitting on an explicit "checkout"
// marker, or on "agle din"/"next day" wherever that appears), and — for a
// message that mentions only one, unmarked date or time — it is told which
// side of the booking the conversation is currently focused on, so a lone
// "tomorrow at 11 AM" is read as an answer to the question just asked
// instead of always defaulting to check-in.
// ---------------------------------------------------------------------------

export interface StayEntities {
  location?: string;
  checkInDate?: string;
  checkInTime?: string;
  checkOutDate?: string;
  checkOutTime?: string;
  guests?: number;
}

export interface StayEntityContext {
  now?: Date;
  /** The check-in date already on file, so "agle din" ("the next day") on a
   *  checkout-only message ("checkout agle din 11 baje kar do") resolves
   *  relative to it instead of being lost. */
  knownCheckInDate?: string;
  /**
   * The checkout date already on file, if any. Without this, a message that
   * only corrects the checkout *time* ("checkout 12 baje kar do") would look,
   * from that message alone, exactly like "a checkout time with no date yet"
   * — and get a brand-new checkout date invented for it, silently moving an
   * already-confirmed checkout day.
   */
  knownCheckOutDate?: string;
  /** Which slot the conversation just asked about, for attributing a single
   *  unmarked date/time when the message does not say which side it means. */
  focusSlot?: "checkInDate" | "checkInTime" | "checkOutDate" | "checkOutTime" | string | null;
}

const pad2 = (value: number): string => String(value).padStart(2, "0");

const toIsoDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

const addIsoDays = (isoDate: string, days: number): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return toIsoDate(new Date(Date.UTC(year, month - 1, day + days)));
};

const CHECKOUT_MARKER = /check[\s-]?out|chekout|checkaut|छुट्टी|चेक\s?आउट|चेकआउट/iu;
const NEXT_DAY_PHRASE =
  /agle\s*din|agla\s*din|aglaa\s*din|next\s*day|doosre\s*din|dusre\s*din|अगले\s*दिन|दूसरे\s*दिन/iu;
const SECOND_DATE_HINT = /parso|parson|परसों|day\s*after\s*tomorrow/iu;

/** The earlier of two possible match indices, or null if neither matched. */
const earliestIndex = (...matches: (RegExpExecArray | null)[]): number | null => {
  const indices = matches.filter((m): m is RegExpExecArray => m !== null).map((m) => m.index);
  return indices.length ? Math.min(...indices) : null;
};

/** A time from a segment, explicit first, falling back to a resolved bare hour. */
const timeInSegment = (
  segment: string,
  slot: "checkIn" | "checkOut",
): string | null => {
  const explicit = extractTime(segment);
  if (explicit) return formatTimeToken(explicit);
  const bare = extractBareHour(segment);
  return bare === null ? null : formatTimeToken(resolveBareHour(bare, slot));
};

/** Reads every stay-booking fact one message contains, given what is already known. */
export const extractStayEntities = (
  rawText: string,
  context: StayEntityContext = {},
): StayEntities => {
  const text = String(rawText ?? "");
  const now = context.now ?? new Date();
  const result: StayEntities = {};

  const guests = extractGuests(text);
  if (guests) result.guests = guests;
  else if (context.focusSlot === "guests") {
    const bare = extractBareNumber(text);
    if (bare !== null) result.guests = bare;
  }

  const checkoutMatch = CHECKOUT_MARKER.exec(text);
  const nextDayMatch = NEXT_DAY_PHRASE.exec(text);
  // A second *absolute* date word ("parso") after some earlier content is
  // also a checkout marker: "kal ... se parson ... tak" names two distinct
  // calendar dates with no "checkout"/"agle din" word at all. Without this,
  // `extractDate` — which checks "parso" before "kal" — would read the whole
  // sentence as a single day-after-tomorrow date and lose "kal" entirely.
  // Excluded at index 0 so a lone "parso" (an answer to a question, not a
  // second date in a longer sentence) is left to the single-mention branch.
  const secondAbsoluteDate = SECOND_DATE_HINT.exec(text);
  const hasEarlierContent = secondAbsoluteDate && secondAbsoluteDate.index > 0;
  // Whichever marker appears first is where the checkout clause starts: in
  // "...aur checkout agle din 11 bje" that's "checkout"; in "...agle din 11
  // baje checkout" (checkout trailing as a label) it's "agle din". Taking the
  // later one would leave the checkout clause's own date/time stranded on
  // the check-in side.
  const splitIndex = earliestIndex(
    checkoutMatch,
    nextDayMatch,
    hasEarlierContent ? secondAbsoluteDate : null,
  );

  if (splitIndex !== null) {
    const checkinSegment = text.slice(0, splitIndex);
    const checkoutSegment = text.slice(splitIndex);

    const checkInDate = extractDate(checkinSegment, now);
    if (checkInDate) result.checkInDate = toIsoDate(checkInDate);
    const checkInTime = timeInSegment(checkinSegment, "checkIn");
    if (checkInTime) result.checkInTime = checkInTime;

    const checkInBase = result.checkInDate ?? context.knownCheckInDate;
    if (NEXT_DAY_PHRASE.test(checkoutSegment) && checkInBase) {
      result.checkOutDate = addIsoDays(checkInBase, 1);
    } else {
      const checkOutDate = extractDate(checkoutSegment, now);
      if (checkOutDate) result.checkOutDate = toIsoDate(checkOutDate);
    }
    const checkOutTime = timeInSegment(checkoutSegment, "checkOut");
    if (checkOutTime) result.checkOutTime = checkOutTime;
  } else {
    // One unmarked mention: attribute it to whichever side of the booking
    // the conversation is currently waiting on, so a lone "tomorrow at 11
    // AM" answers the checkout question it was actually a reply to.
    const towardsCheckout =
      context.focusSlot === "checkOutDate" || context.focusSlot === "checkOutTime";

    const date = extractDate(text, now);
    if (date) {
      if (towardsCheckout) result.checkOutDate = toIsoDate(date);
      else result.checkInDate = toIsoDate(date);
    }
    const time = timeInSegment(text, towardsCheckout ? "checkOut" : "checkIn");
    if (time) {
      if (towardsCheckout) result.checkOutTime = time;
      else result.checkInTime = time;
    }
  }

  // Neither fallback below should fire when a checkout date is already on
  // file and this message did not touch it — "checkout 12 baje kar do" must
  // correct only the time, never invent a new checkout day next to the one
  // already confirmed.
  const checkOutDateAlreadyKnown = !result.checkOutDate && Boolean(context.knownCheckOutDate);

  // A stay length ("2 din ke liye") fixes the checkout date once check-in is
  // known, same as it always has.
  const nights = extractNights(text);
  if (nights && !result.checkOutDate && !checkOutDateAlreadyKnown) {
    const base = result.checkInDate ?? context.knownCheckInDate;
    if (base) result.checkOutDate = addIsoDays(base, nights);
  }
  // A checkout time with no checkout date at all — "and check out at 11 AM"
  // — reads naturally as "the day after check-in", the shortest stay that
  // sentence could mean, rather than being dropped for want of a date. Only
  // when there truly is no checkout date anywhere yet, session included.
  if (result.checkOutTime && !result.checkOutDate && !checkOutDateAlreadyKnown) {
    const base = result.checkInDate ?? context.knownCheckInDate;
    if (base) result.checkOutDate = addIsoDays(base, 1);
  }

  const place = extractPlace(text);
  if (place) result.location = place;

  return result;
};

/** True for a browse/listing request ("asharam ka list do") rather than a booking one. */
export const isDiscoveryPhrasing = (text: string): boolean =>
  DISCOVERY_TRIGGER.test(norm(text));

/** Classifies one message and pulls out whatever it can. */
export const understand = (text: string, from = new Date()): Understanding => {
  const raw = String(text ?? "");
  const value = norm(raw);

  const parameters: ExtractedParameters = {};
  const reference = extractReference(raw);
  if (reference) parameters.reference = reference;

  const intent = ((): Intent => {
    if (!value) return "unknown";
    // Cancellation is checked before the service words, because "cancel my
    // room booking" is a cancellation, not a stay search.
    if (has(value, ...CANCEL)) return "cancel";
    if (PAYMENT_CLAIM.some((phrase) => value.includes(phrase)))
      return "payment_claim";
    if (has(value, ...REFUND_STATUS)) return "refund_status";
    if (MY_BOOKINGS.some((phrase) => value.includes(phrase)))
      return "my_bookings";
    if (AVAILABILITY_QUERY.some((phrase) => value.includes(phrase)))
      return "availability_query";
    if (has(value, ...PARKING)) return "parking";
    if (has(value, ...AARTI)) return "aarti";
    if (has(value, ...EVENT)) return "event";
    if (has(value, ...PRASHAD)) return "prashad";
    if (has(value, ...MARKETPLACE)) return "marketplace";
    if (has(value, ...STAY)) return "search_stay";
    if (has(value, ...HELP)) return "help";
    if (has(value, "menu", "options", "vikalp", "मेनू", "विकल्प")) return "menu";
    if (has(value, ...GREETING)) return "greeting";
    if (has(value, ...DENY)) return "deny";
    if (has(value, ...AFFIRM)) return "affirm";
    return "unknown";
  })();

  const checkIn = extractDate(raw, from);
  if (checkIn) parameters.checkIn = checkIn;
  const nights = extractNights(raw);
  if (nights) parameters.nights = nights;
  const guests = extractGuests(raw);
  if (guests) parameters.guests = guests;
  if (checkIn && nights)
    parameters.checkOut = new Date(checkIn.getTime() + nights * 86_400_000);

  if (intent === "search_stay") {
    const place = extractPlace(raw);
    if (place) parameters.place = place;
  }

  return { intent, parameters };
};
