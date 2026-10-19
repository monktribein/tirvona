/**
 * Rich-text helpers shared by the blog / article editors and the pages that
 * display them.
 *
 * Content written with the rich editor is stored as a small, allow-listed
 * subset of HTML. Older posts are plain text with a light markdown flavour
 * (`## heading`, `- bullet`, `**bold**`); those still render the old way and
 * are converted to HTML only when they are opened in the editor.
 */

const ALLOWED_TAGS = new Set([
  "P", "BR", "DIV", "SPAN", "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "DEL",
  "SUB", "SUP", "H1", "H2", "H3", "H4", "UL", "OL", "LI", "BLOCKQUOTE", "A", "HR",
]);

/** Elements whose content must never survive, not even as text. */
const DROP_TAGS = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "NOSCRIPT", "TEMPLATE",
  "LINK", "META", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT",
  "TITLE", "HEAD",
]);

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\)|hsla?\(\s*[\d.\s,%deg]+\)|[a-z]{3,20})$/i;
const FONT_SIZE =
  /^(xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger|\d{1,3}(\.\d+)?(px|pt|em|rem|%))$/i;
const ALIGN = /^(left|right|center|justify)$/i;
const DECORATION = /^(none|underline|line-through|underline line-through|line-through underline)$/i;

const sanitizeStyle = (style: string): string => {
  const kept: string[] = [];
  for (const rule of style.split(";")) {
    const index = rule.indexOf(":");
    if (index < 1) continue;
    const prop = rule.slice(0, index).trim().toLowerCase();
    const value = rule.slice(index + 1).trim();
    if (!value || /url\(|expression|javascript|@import|\\/i.test(value)) continue;
    if ((prop === "color" || prop === "background-color") && COLOR.test(value)) {
      kept.push(`${prop}: ${value}`);
    } else if (prop === "font-size" && FONT_SIZE.test(value)) {
      kept.push(`${prop}: ${value}`);
    } else if (prop === "text-align" && ALIGN.test(value)) {
      kept.push(`${prop}: ${value}`);
    } else if (prop === "font-weight" && /^(normal|bold|[1-9]00)$/i.test(value)) {
      kept.push(`${prop}: ${value}`);
    } else if (prop === "font-style" && /^(normal|italic)$/i.test(value)) {
      kept.push(`${prop}: ${value}`);
    } else if (prop === "text-decoration" && DECORATION.test(value)) {
      kept.push(`${prop}: ${value}`);
    }
  }
  return kept.join("; ");
};

const safeHref = (href: string): string | null => {
  const value = href.trim();
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (/^(\/|#)/.test(value) && !value.startsWith("//")) return value;
  return null;
};

const cleanNode = (node: Node, doc: Document): Node | DocumentFragment | null => {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as HTMLElement;
  const tag = element.tagName.toUpperCase();
  if (DROP_TAGS.has(tag)) return null;

  const children = document.createDocumentFragment();
  element.childNodes.forEach((child) => {
    const cleaned = cleanNode(child, doc);
    if (cleaned) children.appendChild(cleaned);
  });

  // Legacy <font> tags (older execCommand output / pasted Word text).
  if (tag === "FONT") {
    const span = doc.createElement("span");
    const color = element.getAttribute("color");
    const style = [color && COLOR.test(color) ? `color: ${color}` : "", element.getAttribute("style") ?? ""]
      .filter(Boolean)
      .join("; ");
    const safe = sanitizeStyle(style);
    if (safe) span.setAttribute("style", safe);
    span.appendChild(children);
    return span;
  }

  if (!ALLOWED_TAGS.has(tag)) return children; // unwrap unknown wrappers, keep their text

  const out = doc.createElement(tag.toLowerCase());
  const style = element.getAttribute("style");
  if (style) {
    const safe = sanitizeStyle(style);
    if (safe) out.setAttribute("style", safe);
  }
  if (tag === "A") {
    const href = safeHref(element.getAttribute("href") ?? "");
    if (!href) return children;
    out.setAttribute("href", href);
    out.setAttribute("target", "_blank");
    out.setAttribute("rel", "noopener noreferrer nofollow");
  }
  out.appendChild(children);
  return out;
};

/** Reduces arbitrary HTML to the allow-listed subset. Safe to render with dangerouslySetInnerHTML. */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return "";
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const doc = document.implementation.createHTMLDocument("");
  const wrapper = doc.createElement("div");
  parsed.body.childNodes.forEach((child) => {
    const cleaned = cleanNode(child, doc);
    if (cleaned) wrapper.appendChild(cleaned);
  });
  return wrapper.innerHTML;
}

/** True when the stored value was written by the rich editor (HTML) rather than legacy plain text. */
export function isRichHtml(value: string | undefined | null): boolean {
  return !!value && /<(p|h[1-6]|div|ul|ol|li|blockquote|span|strong|b|em|i|u|s|strike|del|br|hr|a|font)(\s[^>]*)?\/?>/i.test(value);
}

const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "UL", "OL", "BLOCKQUOTE", "HR"]);

/** Wraps loose top-level text / inline nodes (the first typed line has no wrapper) in <p>. */
function wrapLooseInline(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;
  let paragraph: HTMLParagraphElement | null = null;
  Array.from(root.childNodes).forEach((node) => {
    const isBlock = node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as HTMLElement).tagName);
    if (isBlock) {
      paragraph = null;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? "").trim() && !paragraph) return;
    if (!paragraph) {
      paragraph = doc.createElement("p");
      root.insertBefore(paragraph, node);
    }
    paragraph.appendChild(node);
  });
  return root.innerHTML;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inlineMarkdown = (text: string) =>
  escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

/** Converts legacy plain-text / light-markdown content to editor HTML. */
export function plainToHtml(text: string): string {
  if (!text.trim()) return "";
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("### ")) return `<h3>${inlineMarkdown(block.slice(4))}</h3>`;
      if (block.startsWith("## ")) return `<h2>${inlineMarkdown(block.slice(3))}</h2>`;
      if (block.startsWith("- ")) {
        const items = block
          .split("\n")
          .map((line) => `<li>${inlineMarkdown(line.replace(/^- /, ""))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${inlineMarkdown(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

/** Value to load into the editor: rich HTML is sanitised, legacy text is converted. */
export function toEditorHtml(value: string | undefined | null): string {
  if (!value) return "";
  return isRichHtml(value) ? sanitizeRichHtml(value) : plainToHtml(value);
}

/** Plain text of stored content (for previews, excerpts and emptiness checks). */
export function richTextToPlain(value: string | undefined | null): string {
  if (!value) return "";
  if (!isRichHtml(value)) return value;
  const doc = new DOMParser().parseFromString(sanitizeRichHtml(value), "text/html");
  doc.body.querySelectorAll("br, p, div, li, h1, h2, h3, h4, blockquote").forEach((el) => {
    el.appendChild(doc.createTextNode("\n"));
  });
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

/** What the editor reports: sanitised HTML, or "" when there is no visible text. */
export function normalizeEditorHtml(html: string): string {
  const clean = wrapLooseInline(sanitizeRichHtml(html));
  const hasText = richTextToPlain(`<div>${clean}</div>`).replace(/ /g, " ").trim().length > 0;
  return hasText || /<hr/i.test(clean) ? clean : "";
}
