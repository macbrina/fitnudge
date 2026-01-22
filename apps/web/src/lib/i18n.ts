"use client";

import i18next from "i18next";
import { initReactI18next } from "react-i18next";

// Import translation resources
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";
import de from "../locales/de.json";
import it from "../locales/it.json";
import nl from "../locales/nl.json";
import pt from "../locales/pt.json";

// Constants
export const SUPPORTED_LANGS = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "nl",
  "pt",
] as const;
export const DEFAULT_LANG = "en" as const;
export const STORAGE_KEY = "app.language";

// Types
export type SupportedLanguage = (typeof SUPPORTED_LANGS)[number];

const languageDetector = {
  type: "languageDetector" as const,
  async: true,
  detect: async (cb: (lng: string) => void) => {
    try {
      // Use localStorage for web
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return cb(stored);

      // Use browser language detection
      const browserLang = navigator.language || "en";
      const supported = SUPPORTED_LANGS as readonly string[];
      const normalized = browserLang.split("-")[0];
      cb(supported.includes(normalized) ? normalized : "en");
    } catch {
      cb("en");
    }
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, lng);
    } catch {
      // Fallback if localStorage is not available
    }
  },
};

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  nl: { translation: nl },
  pt: { translation: pt },
};

// Initialize i18next
i18next
  .use(initReactI18next)
  .use(languageDetector)
  .init({
    compatibilityJSON: "v4",
    resources,
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    fallbackLng: "en",
    load: "languageOnly",
    returnEmptyString: false,
    lng: "en",
    ns: ["translation"],
    defaultNS: "translation",
    debug: false,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
    saveMissing: true,
    missingKeyHandler: () => {
      // Missing translation key - handled silently in production
    },
  });

export const setAppLanguage = (lng: SupportedLanguage) => {
  i18next.changeLanguage(lng);
};

export const getCurrentLanguage = (): SupportedLanguage => {
  return i18next.language as SupportedLanguage;
};

export { useTranslation } from "react-i18next";

export default i18next;
