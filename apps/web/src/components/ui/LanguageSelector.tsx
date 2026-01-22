"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { cn } from "@fitnudge/ui";
import { useTranslation } from "@/lib/i18n";
import {
  setAppLanguage,
  getCurrentLanguage,
  type SupportedLanguage,
} from "@/lib/i18n";

const LANGUAGES: { code: SupportedLanguage; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
];

interface LanguageSelectorProps {
  variant?: "light" | "dark";
  className?: string;
}

export function LanguageSelector({
  variant = "light",
  className,
}: LanguageSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = getCurrentLanguage();
  const currentLanguage =
    LANGUAGES.find((lang) => lang.code === currentLang) || LANGUAGES[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = (langCode: SupportedLanguage) => {
    setAppLanguage(langCode);
    setIsOpen(false);
  };

  const isLight = variant === "light";

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors",
          isLight
            ? "text-white/90 hover:text-white hover:bg-white/10"
            : "text-foreground hover:bg-accent"
        )}
        aria-label={t("nav.select_language")}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">
          {currentLanguage.code.toUpperCase()}
        </span>
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 w-40 rounded-xl shadow-lg border z-50",
            "bg-background border-border",
            "max-h-48 sm:max-h-64 overflow-y-auto",
            // Open upward on mobile/tablet, downward on desktop
            "bottom-full mb-2 lg:bottom-auto lg:top-full lg:mb-0 lg:mt-2"
          )}
        >
          <div className="py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                  "hover:bg-accent text-foreground",
                  lang.code === currentLang && "bg-accent/50"
                )}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="flex-1 text-left">{lang.name}</span>
                {lang.code === currentLang && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
