import { useTranslation } from "react-i18next";
import { getCurrentLanguage, setAppLanguage, SupportedLanguage } from "@/lib/i18n";

export const useLocale = () => {
  const { i18n } = useTranslation();

  const currentLanguage = getCurrentLanguage();

  const changeLanguage = (language: SupportedLanguage) => {
    setAppLanguage(language);
  };

  return {
    currentLanguage,
    changeLanguage,
    isReady: i18n.isInitialized
  };
};
