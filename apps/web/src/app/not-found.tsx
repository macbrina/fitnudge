"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { Home, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@fitnudge/ui";
import { useTranslation } from "@/lib/i18n";

// Fun 404 animation - cute robot/character
const ANIMATION_URL =
  "https://assets2.lottiefiles.com/packages/lf20_kcsr6fcp.json";

export default function NotFound() {
  const { t } = useTranslation();
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch(ANIMATION_URL)
      .then((res) => res.json())
      .then((data) => {
        setAnimationData(data);
      })
      .catch(() => {
        // Animation failed to load, will show fallback
      });
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-primary/5 via-white to-purple-100 dark:from-gray-900 dark:via-gray-800 dark:to-primary/10 flex items-center justify-center px-4 py-8">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-purple-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-16 h-16 bg-blue-400/10 rounded-full blur-2xl" />
      </div>

      <div className="max-w-lg mx-auto text-center relative z-10">
        {/* Fun 404 Display */}
        <div className="relative mb-2">
          {/* Animated Lottie or Fun Fallback */}
          <div className="w-44 h-44 sm:w-56 sm:h-56 mx-auto">
            {animationData ? (
              <Lottie
                animationData={animationData}
                loop={true}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center relative">
                {/* Fun animated 404 fallback */}
                <div className="relative">
                  <span className="text-7xl sm:text-8xl font-black bg-linear-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent animate-pulse">
                    404
                  </span>
                  {/* Floating sparkles */}
                  <Sparkles className="absolute -top-2 -right-4 w-6 h-6 text-yellow-400 animate-bounce" />
                  <Sparkles className="absolute -bottom-1 -left-3 w-4 h-4 text-purple-400 animate-bounce delay-150" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
            {t("errors.not_found_title")}
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
            {t("errors.not_found_description")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Link href="/">
            <Button className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-full font-semibold flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
              <Home className="h-5 w-5" />
              {t("errors.go_home")}
            </Button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors font-medium rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
            {t("errors.go_back")}
          </button>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/features"
            className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary border border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
          >
            {t("nav.features")}
          </Link>
          <Link
            href="/blog"
            className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary border border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
          >
            {t("nav.blog")}
          </Link>
          <Link
            href="/contact"
            className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary border border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
          >
            {t("nav.contact")}
          </Link>
        </div>
      </div>
    </div>
  );
}
