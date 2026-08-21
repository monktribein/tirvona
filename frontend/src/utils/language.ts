export interface LanguageOption {
  code: "en" | "hi";
  label: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeName: "English" },
  { code: "hi", label: "Hindi", nativeName: "हिंदी" },
];

export const getActiveLanguage = (): "en" | "hi" => {
  try {
    const stored = localStorage.getItem("tirvona_active_language");
    if (stored === "hi" || stored === "en") return stored;
    const cachedMem = localStorage.getItem("tirvona_user_memory");
    if (cachedMem) {
      const parsed = JSON.parse(cachedMem);
      if (parsed?.preferences?.language === "hi") return "hi";
    }
  } catch {
  }
  return "en";
};

export const setActiveLanguage = (lang: "en" | "hi") => {
  try {
    localStorage.setItem("tirvona_active_language", lang);
    const cachedMem = localStorage.getItem("tirvona_user_memory");
    if (cachedMem) {
      const parsed = JSON.parse(cachedMem);
      parsed.preferences = { ...(parsed.preferences || {}), language: lang };
      localStorage.setItem("tirvona_user_memory", JSON.stringify(parsed));
    }
    window.dispatchEvent(
      new CustomEvent("language_changed", { detail: lang }),
    );
  } catch {
  }
};
