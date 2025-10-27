"use client";

import { useState, useEffect } from "react";
import { X, Settings, Check, AlertCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@fitnudge/ui";

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always true, can't be disabled
    analytics: false,
    marketing: false,
    functional: false,
  });
  const { t } = useTranslation();

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    };
    localStorage.setItem("cookie-consent", JSON.stringify(allAccepted));
    setIsVisible(false);
  };

  const acceptSelected = () => {
    localStorage.setItem("cookie-consent", JSON.stringify(preferences));
    setIsVisible(false);
  };

  const rejectAll = () => {
    const onlyNecessary = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    };
    localStorage.setItem("cookie-consent", JSON.stringify(onlyNecessary));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setIsVisible(false)}
      />

      {/* Cookie consent modal */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6">
          {!showPreferences ? (
            // Main consent view
            <>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t("cookies.title")}
                  </h3>
                </div>
                <button
                  onClick={() => setIsVisible(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">
                {t("cookies.description")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={acceptAll}
                  className="flex-1 rounded-full"
                  size="lg"
                >
                  {t("cookies.accept_all")}
                </Button>
                <Button
                  onClick={() => setShowPreferences(true)}
                  variant="outline"
                  className="flex-1 rounded-full"
                  size="lg"
                >
                  <Settings className="h-4 w-4" />
                  <span>{t("cookies.customize")}</span>
                </Button>
              </div>

              <button
                onClick={rejectAll}
                className="w-full mt-3 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {t("cookies.reject_all")}
              </button>
            </>
          ) : (
            // Preferences view
            <>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("cookies.preferences.title")}
                </h3>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {/* Necessary cookies */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {t("cookies.preferences.necessary.title")}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {t("cookies.preferences.necessary.description")}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-gray-500">
                      {t("cookies.preferences.required")}
                    </span>
                  </div>
                </div>

                {/* Analytics cookies */}
                <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {t("cookies.preferences.analytics.title")}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {t("cookies.preferences.analytics.description")}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          analytics: e.target.checked,
                        }))
                      }
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors ${
                        preferences.analytics
                          ? "bg-blue-600"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transition-transform ${
                          preferences.analytics
                            ? "translate-x-6"
                            : "translate-x-1"
                        } mt-1`}
                      />
                    </div>
                  </label>
                </div>

                {/* Marketing cookies */}
                <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {t("cookies.preferences.marketing.title")}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {t("cookies.preferences.marketing.description")}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          marketing: e.target.checked,
                        }))
                      }
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors ${
                        preferences.marketing
                          ? "bg-blue-600"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transition-transform ${
                          preferences.marketing
                            ? "translate-x-6"
                            : "translate-x-1"
                        } mt-1`}
                      />
                    </div>
                  </label>
                </div>

                {/* Functional cookies */}
                <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {t("cookies.preferences.functional.title")}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {t("cookies.preferences.functional.description")}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          functional: e.target.checked,
                        }))
                      }
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors ${
                        preferences.functional
                          ? "bg-blue-600"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transition-transform ${
                          preferences.functional
                            ? "translate-x-6"
                            : "translate-x-1"
                        } mt-1`}
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={acceptSelected}
                  className="flex-1 rounded-full"
                  size="lg"
                >
                  {t("cookies.preferences.save")}
                </Button>
                <Button
                  onClick={() => setShowPreferences(false)}
                  variant="outline"
                  className="rounded-full"
                  size="lg"
                >
                  {t("cookies.preferences.cancel")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
