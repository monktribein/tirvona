import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { hiUi } from "../i18n/resources";
import { getActiveLanguage, setActiveLanguage } from "../utils/language";

export type AppLanguage = "en" | "hi";

let currentActiveLanguage: AppLanguage = getActiveLanguage();

export const getUiLanguage = (): AppLanguage => currentActiveLanguage;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: getActiveLanguage(),
    fallbackLng: "en",
    resources: {
      en: { translation: {} },
      hi: { translation: hiUi },
    },
    keySeparator: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

const hindiNumber = (value: string | number) =>
  Number(value).toLocaleString("hi-IN-u-nu-deva");

const UNIT_MAP: Record<string, string> = {
  night: "रात",
  nights: "रातें",
  "bed per night": "बिस्तर प्रति रात",
  "bed rate": "बिस्तर दर",
  day: "दिन",
  days: "दिन",
  meal: "भोजन",
  meals: "भोजन",
  person: "व्यक्ति",
  transfer: "स्थानांतरण",
  month: "माह",
  mo: "माह",
  year: "वर्ष",
  box: "डिब्बा",
  hour: "घंटा",
  hours: "घंटे",
};

const MONTHS: Record<string, string> = {
  January: "जनवरी", Jan: "जन॰", February: "फ़रवरी", Feb: "फ़र॰",
  March: "मार्च", Mar: "मार्च", April: "अप्रैल", Apr: "अप्रैल",
  May: "मई", June: "जून", Jun: "जून", July: "जुलाई", Jul: "जुल॰",
  August: "अगस्त", Aug: "अग॰", September: "सितंबर", Sep: "सित॰",
  October: "अक्टूबर", Oct: "अक्टू॰", November: "नवंबर", Nov: "नव॰",
  December: "दिसंबर", Dec: "दिस॰",
};

const translateDynamicHindi = (text: string): string => {
  let match = text.match(/^([A-Za-z\s]+),\s*([A-Za-z\s]+)$/);
  if (match) {
    const city = match[1].trim();
    const state = match[2].trim();
    const transCity = hiUi[city] || city;
    const transState = hiUi[state] || state;
    if (transCity !== city || transState !== state) {
      return `${transCity}, ${transState}`;
    }
  }

  match = text.match(/^(.+?)\s*(→|->|›|>|»|←|<-)$/);
  if (match) {
    const base = match[1].trim();
    const transBase = hiUi[base] || translateDynamicHindi(base);
    if (transBase !== base) {
      return `${transBase} ${match[2]}`;
    }
  }

  match = text.match(/^(.+?)\s*\((\d+)\)$/);
  if (match) {
    const base = match[1].trim();
    const transBase = hiUi[base] || translateDynamicHindi(base);
    return `${transBase} (${hindiNumber(match[2])})`;
  }

  match = text.match(/^(\d+)\s*Guests?\s*·\s*(\d+)\s*Rooms?$/i);
  if (match) {
    return `${hindiNumber(match[1])} अतिथि · ${hindiNumber(match[2])} ${Number(match[2]) === 1 ? "कमरा" : "कमरे"}`;
  }
  match = text.match(/^(\d+)\s*Rooms?\s*·\s*(\d+)\s*Adults?(?:,\s*(\d+)\s*Children)?$/i);
  if (match) {
    const r = Number(match[1]) === 1 ? "कमरा" : "कमरे";
    const ch = match[3] ? `, ${hindiNumber(match[3])} बच्चे` : "";
    return `${hindiNumber(match[1])} ${r} · ${hindiNumber(match[2])} वयस्क${ch}`;
  }
  match = text.match(/^(\d+)\s*Room,\s*(\d+)\s*Guests?$/i);
  if (match) {
    return `${hindiNumber(match[1])} कमरा, ${hindiNumber(match[2])} अतिथि`;
  }
  match = text.match(/^(\d+)\s*Rooms,\s*(\d+)\s*Guests?$/i);
  if (match) {
    return `${hindiNumber(match[1])} कमरे, ${hindiNumber(match[2])} अतिथि`;
  }

  match = text.match(/^(.+?)\s*\/\s*(night|bed per night|bed rate|day|meal|person|transfer|month|year|box)$/i);
  if (match) {
    const base = match[1].trim();
    const unitKey = match[2].toLowerCase();
    const transUnit = UNIT_MAP[unitKey] || match[2];
    const transBase = hiUi[base] || base;
    return `${transBase} / ${transUnit}`;
  }
  match = text.match(/^(.+?)\s*\/\s*5(\.0)?$/);
  if (match) {
    const base = match[1].trim();
    const transBase = hiUi[base] || base;
    return `${transBase} / ५.०`;
  }

  match = text.match(/^(\d+)\+?\s*reviews?$/i);
  if (match) return `${hindiNumber(match[1])}+ समीक्षाएँ`;
  match = text.match(/^\((\d+)\s*reviews?\)$/i);
  if (match) return `(${hindiNumber(match[1])} समीक्षाएँ)`;
  match = text.match(/^(\d+)\+?\s*views?$/i);
  if (match) return `${hindiNumber(match[1])} बार देखा गया`;
  match = text.match(/^(\d+)\s*min\s*read$/i);
  if (match) return `${hindiNumber(match[1])} मिनट का पठन`;
  match = text.match(/^(\d+)%\s*off$/i);
  if (match) return `${hindiNumber(match[1])}% छूट`;
  match = text.match(/^(\d+)\+?\s*vendors?$/i);
  if (match) return `${hindiNumber(match[1])}+ विक्रेता`;
  match = text.match(/^(\d+)\s*days?$/i);
  if (match) return `${hindiNumber(match[1])} दिन`;
  match = text.match(/^(\d+)\s*nights?$/i);
  if (match) return `${hindiNumber(match[1])} रातें`;
  match = text.match(/^(\d+)\s*stays?$/i);
  if (match) return `${hindiNumber(match[1])} प्रवास`;
  match = text.match(/^(\d+)\s*ashrams?$/i);
  if (match) return `${hindiNumber(match[1])} आश्रम`;
  match = text.match(/^(\d+)\s*yrs?\s*(service|experience)?$/i);
  if (match) return `${hindiNumber(match[1])} वर्ष सेवा`;
  match = text.match(/^(\d+)\s*left$/i);
  if (match) return `${hindiNumber(match[1])} शेष`;
  match = text.match(/^(\d+)\s*available\s*days?$/i);
  if (match) return `${hindiNumber(match[1])} उपलब्ध दिन`;
  match = text.match(/^(\d+)\s*openings(\s*available)?$/i);
  if (match) return `${hindiNumber(match[1])} रिक्तियाँ उपलब्ध`;
  match = text.match(/^Next\s*(\d+)\s*days$/i);
  if (match) return `अगले ${hindiNumber(match[1])} दिन`;
  match = text.match(/^(\d+)\s*unread updates$/i);
  if (match) return `${hindiNumber(match[1])} अपठित अपडेट`;
  match = text.match(/^(\d+)\s*item\(s\)\s*selected$/i);
  if (match) return `${hindiNumber(match[1])} आइटम चुने गए`;
  match = text.match(/^(\d+)\s*items?$/i);
  if (match) return `${hindiNumber(match[1])} आइटम`;
  match = text.match(/^Type at least (\d+) characters$/i);
  if (match) return `कम से कम ${hindiNumber(match[1])} अक्षर लिखें`;
  match = text.match(/^Showing (\d+) to (\d+) of (\d+) results$/i);
  if (match) {
    return `${hindiNumber(match[1])} से ${hindiNumber(match[2])}, कुल ${hindiNumber(match[3])} परिणाम`;
  }
  match = text.match(/^Page (\d+) of (\d+)$/i);
  if (match) return `पृष्ठ ${hindiNumber(match[1])}, कुल ${hindiNumber(match[2])}`;

  match = text.match(/^(.+?)\s+(prasad|mahaprasad)$/i);
  if (match) {
    const base = match[1].trim();
    const transBase = hiUi[base] || hiUi[base.toLowerCase()] || base;
    const prasadWord = match[2].toLowerCase() === "mahaprasad" ? "महाप्रसाद" : "प्रसाद";
    return `${transBase} ${prasadWord}`;
  }
  match = text.match(/^(.+?)\s+(trust|foundation|samiti|mandir|temple)$/i);
  if (match) {
    const base = match[1].trim();
    const suffixMap: Record<string, string> = {
      trust: "ट्रस्ट",
      foundation: "फ़ाउंडेशन",
      samiti: "समिति",
      mandir: "मंदिर",
      temple: "मंदिर",
    };
    const transBase = hiUi[base] || hiUi[base.toLowerCase()] || base;
    return `${transBase} ${suffixMap[match[2].toLowerCase()] || match[2]}`;
  }
  match = text.match(/^Related Stays in (.+)$/i);
  if (match) {
    const city = match[1].trim();
    return `${hiUi[city] || city} में संबंधित पावन प्रवास`;
  }
  match = text.match(/^How was (.+)\?$/i);
  if (match) {
    const place = match[1].trim();
    return `${hiUi[place] || place} का आपका अनुभव कैसा रहा?`;
  }
  match = text.match(/^Earn\s+(\d+)\s+reward\s+points(\s+after\s+stay)?$/i);
  if (match) {
    return `प्रवास के बाद ${hindiNumber(match[1])} रिवॉर्ड पॉइंट प्राप्त करें`;
  }

  match = text.match(/^Found\s+(\d+)\s+verified\s+Ashrams\s+matching\s+(.+)$/i);
  if (match) {
    const rawDest = match[2].trim().replace(/^"|"$/g, "");
    const transDest = hiUi[rawDest] || rawDest;
    return `"${transDest}" के अनुसार ${hindiNumber(match[1])} सत्यापित आश्रम मिले`;
  }
  match = text.match(/^Finding\s+verified\s+Ashrams\s+in\s+(.+)$/i);
  if (match) {
    const rawDest = match[1].trim().replace(/^"|"$/g, "");
    const transDest = hiUi[rawDest] || rawDest;
    return `"${transDest}" में सत्यापित आश्रम खोजे जा रहे हैं`;
  }
  match = text.match(/^No\s+verified\s+Ashrams\s+found\s+matching\s+(.+)$/i);
  if (match) {
    const rawDest = match[1].trim().replace(/^"|"$/g, "");
    const transDest = hiUi[rawDest] || rawDest;
    return `"${transDest}" के अनुसार कोई सत्यापित आश्रम नहीं मिला`;
  }

  match = text.match(/^Under\s+(.+)$/i);
  if (match) return `${hiUi[match[1]] || match[1]} से कम`;
  match = text.match(/^Over\s+(.+)$/i);
  if (match) return `${hiUi[match[1]] || match[1]} से अधिक`;

  match = text.match(/^(.+?)(\s*\*)$/);
  if (match) {
    const base = match[1].trim();
    if (hiUi[base]) return `${hiUi[base]}${match[2]}`;
  }
  match = text.match(/^(.+?):$/);
  if (match) {
    const base = match[1].trim();
    if (hiUi[base]) return `${hiUi[base]}:`;
  }
  match = text.match(/^(.+?)\s*\(₹\)(\s*\*|\s*:)?$/);
  if (match) {
    const base = match[1].trim();
    if (hiUi[base]) return `${hiUi[base]} (₹)${match[2] || ""}`;
  }
  match = text.match(/^(.+?) is required\.?$/i);
  if (match) {
    const field = hiUi[match[1]] || hiUi[match[1].replace(/^./, (c) => c.toUpperCase())];
    if (field) return `${field} आवश्यक है।`;
  }

  const monthPattern = new RegExp(
    `\\b(${Object.keys(MONTHS).join("|")})\\b`,
    "g",
  );
  if (monthPattern.test(text) && /\d/.test(text)) {
    return text
      .replace(monthPattern, (month) => MONTHS[month] || month)
      .replace(/\d/g, (digit) => "०१२३४५६७८९"[Number(digit)]);
  }

  return text;
};

export const tUi = (text: string, forceLang?: AppLanguage): string => {
  if (!text || typeof text !== "string") return text;
  const activeLang = forceLang || currentActiveLanguage || getActiveLanguage();
  if (activeLang !== "hi") return text;

  if (hiUi[text]) return hiUi[text];

  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return text;
  if (hiUi[normalized]) return hiUi[normalized];

  const translated = String(i18n.t(normalized, { defaultValue: "" }));
  if (translated && translated !== normalized) return translated;

  const dynamic = translateDynamicHindi(normalized);
  if (dynamic !== normalized) return dynamic;

  return text;
};

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

const translatedAttributes = ["placeholder", "title", "aria-label"] as const;
const localizedTextNodes = new Map<
  Text,
  { original: string; translated: string }
>();
const localizedAttributes = new Map<Element, Map<string, string>>();

const localizeElementTree = (root: Node) => {
  if (currentActiveLanguage !== "hi") return;
  const textNodes: Text[] = root instanceof Text ? [root] : [];
  if (!(root instanceof Text)) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  }
  textNodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || ["SCRIPT", "STYLE", "CODE", "NOSCRIPT"].includes(parent.tagName)) return;
    const current = node.nodeValue || "";
    const leading = current.match(/^\s*/)?.[0] || "";
    const trailing = current.match(/\s*$/)?.[0] || "";
    const value = current.trim();
    if (!value) return;

    const existing = localizedTextNodes.get(node);
    const original = existing ? existing.original : current;

    if (existing && current === existing.translated) {
      return;
    }

    const translated = tUi(value);
    if (translated === value) {
      const origValue = original.trim();
      if (origValue !== value) {
        const origTranslated = tUi(origValue);
        if (origTranslated !== origValue) {
          const transVal = `${leading}${origTranslated}${trailing}`;
          localizedTextNodes.set(node, { original, translated: transVal });
          node.nodeValue = transVal;
        }
      }
      return;
    }

    const translatedValue = `${leading}${translated}${trailing}`;
    localizedTextNodes.set(node, {
      original,
      translated: translatedValue,
    });
    node.nodeValue = translatedValue;
  });

  const elements =
    root instanceof Element
      ? [root, ...Array.from(root.querySelectorAll("*"))]
      : Array.from((root as ParentNode).querySelectorAll?.("*") || []);
  elements.forEach((element) => {
    translatedAttributes.forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value) {
        const translated = tUi(value);
        if (translated !== value) {
          const originals = localizedAttributes.get(element) || new Map();
          if (!originals.has(attribute)) {
            originals.set(attribute, value);
            localizedAttributes.set(element, originals);
          }
          element.setAttribute(attribute, translated);
        }
      }
    });
  });
};

const restoreLocalizedUi = () => {
  localizedTextNodes.forEach(({ original }, node) => {
    if (node.isConnected) node.nodeValue = original;
  });
  localizedTextNodes.clear();
  localizedAttributes.forEach((attributes, element) => {
    if (!element.isConnected) return;
    attributes.forEach((original, attribute) =>
      element.setAttribute(attribute, original),
    );
  });
  localizedAttributes.clear();
};

const AutomaticUiLocalizer: React.FC<{ language: AppLanguage }> = ({
  language,
}) => {
  useEffect(() => {
    currentActiveLanguage = language;
    if (language !== "hi") {
      restoreLocalizedUi();
      return;
    }

    localizeElementTree(document.body);
    const rafId = requestAnimationFrame(() => {
      localizeElementTree(document.body);
    });

    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      try {
        mutations.forEach((mutation) => {
          if (mutation.type === "characterData") {
            localizeElementTree(mutation.target);
          } else if (mutation.type === "attributes") {
            localizeElementTree(mutation.target);
          } else {
            localizeElementTree(mutation.target);
            mutation.addedNodes.forEach(localizeElementTree);
          }
        });
      } finally {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: [...translatedAttributes],
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      restoreLocalizedUi();
    };
  }, [language]);
  return null;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const active = getActiveLanguage();
    currentActiveLanguage = active;
    return active;
  });

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    currentActiveLanguage = nextLanguage;
    setActiveLanguage(nextLanguage);
    setLanguageState(nextLanguage);
    void i18n.changeLanguage(nextLanguage).then(() => {
      if (nextLanguage === "hi") {
        localizeElementTree(document.body);
      } else {
        restoreLocalizedUi();
      }
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
    currentActiveLanguage = language;
    void i18n.changeLanguage(language);
  }, [language]);

  const t = useCallback((text: string) => tUi(text), [language]);
  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      <AutomaticUiLocalizer language={language} />
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};


