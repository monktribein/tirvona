/**
 * The picture a stay card shows when the stay has no photo yet (or its photo fails to load): a small
 * built-in illustration of a stay with the stay's name on it. It is made here, not fetched, so it always
 * loads and it never shows another property's photo as if it were this stay.
 */
const PALETTES: Array<[string, string, string]> = [
  ["#FDE7C8", "#F9B872", "#B45309"],
  ["#E0ECFB", "#9CC3F0", "#1E4E8C"],
  ["#E4F3E6", "#9ED6A6", "#1F6B34"],
  ["#F7E3EE", "#EDA9CB", "#9D2B6B"],
  ["#EDE7F8", "#B9A6E8", "#5B3FA3"],
];

const escapeXml = (value: string): string =>
  value.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] as string);

export const stayFallbackImage = (name?: string): string => {
  const label = String(name ?? "").trim().slice(0, 26);
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const [sky, glow, ink] = PALETTES[hash % PALETTES.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="${glow}"/></linearGradient></defs>` +
    `<rect width="480" height="320" fill="url(#g)"/>` +
    `<circle cx="380" cy="70" r="34" fill="#fff" opacity=".55"/>` +
    `<g fill="${ink}" opacity=".9">` +
    `<rect x="120" y="170" width="240" height="90"/>` +
    `<rect x="100" y="256" width="280" height="14"/>` +
    `<path d="M240 96 C216 120 206 142 206 170 L274 170 C274 142 264 120 240 96 Z"/>` +
    `<rect x="238" y="78" width="4" height="22"/>` +
    `<path d="M120 170 L140 140 L160 170 Z"/><path d="M320 170 L340 140 L360 170 Z"/>` +
    `</g>` +
    `<g fill="${sky}"><rect x="144" y="190" width="22" height="34" rx="11"/><rect x="314" y="190" width="22" height="34" rx="11"/><rect x="226" y="206" width="28" height="54" rx="14"/></g>` +
    (label ? `<text x="240" y="300" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="${ink}">${escapeXml(label)}</text>` : "") +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
