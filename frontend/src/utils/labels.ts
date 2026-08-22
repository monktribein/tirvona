export const humanizeLabel = (value?: string | null): string => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  const words = text
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  const label = words
    .map((word, index) => {
      const isShouted = word === word.toUpperCase();
      const base = isShouted ? word.toLowerCase() : word;
      return index === 0 ? base.charAt(0).toUpperCase() + base.slice(1) : base;
    })
    .join(" ");
  return tUi(label);
};

export const titleizeLabel = (value?: string | null): string =>
  humanizeLabel(value)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export default humanizeLabel;
import { tUi } from "../contexts/LanguageContext";
