/**
 * Deterministic language detection for inbound WhatsApp messages.
 *
 * Guests write in four overlapping styles — English, Hindi in Devanagari,
 * Hinglish (Hindi in Latin script), and messages that mix English and Hindi
 * in one sentence. The bot replies in the style it was addressed in, so this
 * runs on every inbound message before anything else.
 *
 * It is rule-based on purpose: the reply language must keep working with the
 * AI interpreter disabled or failing, so detection cannot depend on it.
 */

export type ReplyLanguage = "en" | "hi" | "hinglish";

const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * Hindi function words as they are actually typed in Latin script. Content
 * words (room, booking, parking) are deliberately absent — they are shared
 * with English and would misread a plain English sentence as Hinglish.
 */
const HINGLISH_MARKERS = [
  "hai", "hain", "haan", "nahi", "nahin", "mujhe", "mujhko", "mera", "meri",
  "mere", "aap", "aapka", "aapki", "aapke", "kya", "kyun", "kaise", "kaisa",
  "kab", "kahan", "kitna", "kitne", "kitni", "chahiye", "karna", "karni",
  "karo", "kar", "krna", "krni", "kro", "krdo", "dena", "dedo", "dena",
  "bhai", "bhaiya", "ji", "namaste", "namaskar", "pranam", "thik", "theek",
  "acha", "accha", "bilkul", "abhi", "phir", "fir", "aur", "lekin", "par",
  "se", "ko", "ka", "ki", "ke", "mein", "par", "tak", "liye", "wala", "wali",
  "hoga", "hogi", "gaya", "gayi", "raha", "rahi", "rahe", "diya", "diye",
  "log", "logon", "din", "raat", "subah", "shaam", "paas", "pass", "yahan",
  "wahan", "chalega", "batao", "bataye", "dikhao", "dikhaye", "band", "chalu",
];

const HINGLISH_SET = new Set(HINGLISH_MARKERS);

const words = (value: string): string[] =>
  value
    .toLowerCase()
    // Unicode property escapes rather than a literal Devanagari range: the
    // range spans combining marks, which makes the class ambiguous about
    // where one character ends and the next begins.
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Picks the reply style for one message.
 *
 * Any Devanagari at all means the guest is comfortable reading Devanagari, so
 * the reply goes back in Hindi — a single Devanagari word in an otherwise
 * Latin sentence is still a strong signal, and replying in Devanagari is
 * never wrong for someone who just used it.
 *
 * Otherwise a Latin message is Hinglish if it carries any Hindi function
 * word, and English if it carries none. `null` means the message was too
 * short to tell (a bare "2", an emoji, a tapped button) — the caller keeps
 * whatever the session already had rather than flip-flopping on it.
 */
export const detectLanguage = (text: string): ReplyLanguage | null => {
  const value = String(text ?? "").trim();
  if (!value) return null;
  if (DEVANAGARI.test(value)) return "hi";

  const tokens = words(value);
  if (!tokens.length) return null;
  if (tokens.some((token) => HINGLISH_SET.has(token))) return "hinglish";

  // One or two Latin words with no Hindi marker is not enough to switch a
  // conversation that was already running in Hindi or Hinglish.
  if (tokens.length < 3) return null;
  return "en";
};

/**
 * Resolves the language for a reply: what this message says, else what the
 * session was already using, else what the customer's profile remembers.
 */
export const resolveReplyLanguage = (
  text: string,
  sessionLanguage?: ReplyLanguage | null,
  profileLanguage?: ReplyLanguage | null,
): ReplyLanguage =>
  detectLanguage(text) ?? sessionLanguage ?? profileLanguage ?? "hinglish";
