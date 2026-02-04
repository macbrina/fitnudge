"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";
import { Button } from "@fitnudge/ui";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

// Fun error animation - sad/error character
const ANIMATION_URL =
  "https://assets2.lottiefiles.com/packages/lf20_afwjhfb2.json";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const { t } = useTranslation();
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch(ANIMATION_URL)
      .then((res) => res.json())
      .then((data) => setAnimationData(data))
      .catch(() => {
        // Animation failed to load, will show fallback
      });
  }, [error]);

  return (
    <div className="min-h-screen bg-linear-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-red-900/10 flex items-center justify-center px-4 py-8">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-24 h-24 bg-red-400/10 rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-orange-400/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-lg mx-auto text-center relative z-10">
        {/* Lottie Animation */}
        <div className="w-40 h-40 sm:w-52 sm:h-52 mx-auto mb-2">
          {animationData ? (
            <Lottie
              animationData={animationData}
              loop={true}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="relative">
                <AlertTriangle className="w-20 h-20 sm:w-24 sm:h-24 text-red-500/60" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping" />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
            {t("errors.error_title")}
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
            {t("errors.error_description")}
          </p>
        </div>

        {/* Error details (only in development) */}
        {process.env.NODE_ENV === "development" && error.message && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 text-left">
            <p className="text-sm font-mono text-red-600 dark:text-red-400 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-400 dark:text-red-500 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Button
            onClick={reset}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-full font-semibold flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-xl transition-all"
          >
            <RefreshCw className="h-5 w-5" />
            {t("errors.try_again")}
          </Button>
          <Link href="/">
            <Button
              variant="outline"
              className="px-6 py-3 rounded-full font-semibold flex items-center gap-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Home className="h-5 w-5" />
              {t("errors.go_home")}
            </Button>
          </Link>
        </div>

        {/* Support info */}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("errors.persist_message")}{" "}
          <Link
            href="/contact"
            className="text-primary hover:underline font-medium"
          >
            {t("errors.contact_support")}
          </Link>
        </p>
      </div>
    </div>
  );
}
