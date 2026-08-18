const PROTECTED_UPPERCASE = new Set([
  "AC", "API", "CMS", "GST", "ID", "IFSC", "ISKCON", "KYC", "PAN",
  "PDF", "PIN", "QR", "SEO", "SMS", "UPI", "URL", "VIP",
]);

const NON_CONTENT_FIELD =
  /(?:email|e-mail|url|uri|password|phone|mobile|contact|otp|code|slug|username|handle|aadhaar|aadhar|pan|gst|ifsc|pincode|pin code|latitude|longitude|amount|price|rate|quantity|capacity|year)/i;

const PARAGRAPH_FIELD =
  /(?:description|details|content|paragraph|notes?|message|about|bio|policy|policies|guidelines?|instructions?|remarks?|summary|overview|terms)/i;

const isLinkLike = (value: string) =>
  /^(?:https?:\/\/|www\.)/i.test(value) || /^\S+@\S+\.\S+$/.test(value);

const formatTitleWord = (word: string): string => {
  if (!word || isLinkLike(word)) return word;
  const upper = word.toUpperCase();
  if (PROTECTED_UPPERCASE.has(upper)) return upper;

  return word.replace(/\p{L}[\p{L}'’]*/gu, (part) => {
    const normalized = part === part.toUpperCase() && part.length > 1
      ? part.toLocaleLowerCase("en-IN")
      : part;
    return normalized.charAt(0).toLocaleUpperCase("en-IN") + normalized.slice(1);
  });
};

/** Formats names, headings, locations and other short labels without changing punctuation. */
export const toTitleCase = (value: unknown): string => {
  const text = String(value ?? "").trim().replace(/[\t ]+/g, " ");
  if (!text || isLinkLike(text)) return text;
  return text.split(/(\s+)/).map(formatTitleWord).join("");
};

/** Capitalizes the beginning of every sentence while preserving the author's remaining copy. */
export const toSentenceCase = (value: unknown): string => {
  const text = String(value ?? "").trim();
  if (!text || isLinkLike(text)) return text;
  return text.replace(
    /(^|[.!?][\s\n]+|\n+)(["'“‘(\[]*)(\p{L})/gu,
    (_match, boundary: string, punctuation: string, letter: string) =>
      `${boundary}${punctuation}${letter.toLocaleUpperCase("en-IN")}`,
  );
};

const fieldDescriptor = (element: HTMLInputElement | HTMLTextAreaElement) =>
  [element.name, element.id, element.placeholder, element.getAttribute("aria-label")]
    .filter(Boolean)
    .join(" ");

const setNativeValue = (
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) => {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
};

/**
 * Applies consistent casing to user-entered copy at blur time. Fields can opt
 * out or override detection with data-text-case="none|title|sentence".
 */
export const installAutomaticTextCase = (): (() => void) => {
  const onBlur = (event: FocusEvent) => {
    const element = event.target;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
    if (element.disabled || element.readOnly || !element.value.trim()) return;

    const explicit = element.dataset.textCase;
    if (explicit === "none") return;

    if (element instanceof HTMLInputElement) {
      const excludedTypes = new Set([
        "email", "password", "tel", "url", "number", "date", "datetime-local",
        "time", "month", "week", "file", "hidden", "checkbox", "radio", "range",
      ]);
      if (excludedTypes.has(element.type)) return;
    }

    const descriptor = fieldDescriptor(element);
    if (NON_CONTENT_FIELD.test(descriptor)) return;

    const mode = explicit ||
      (element instanceof HTMLTextAreaElement || PARAGRAPH_FIELD.test(descriptor)
        ? "sentence"
        : "title");
    const nextValue = mode === "sentence"
      ? toSentenceCase(element.value)
      : toTitleCase(element.value);

    if (nextValue !== element.value) setNativeValue(element, nextValue);
  };

  document.addEventListener("blur", onBlur, true);
  return () => document.removeEventListener("blur", onBlur, true);
};
