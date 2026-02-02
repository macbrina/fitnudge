"use client";

import { useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/lib/i18n";
import { useAppStoreLinks } from "@/store";
import { Apple } from "lucide-react";

const REFERRAL_STORAGE_KEY = "fitnudge_referral_code";
const REFERRAL_STORAGE_EXPIRY_DAYS = 30;

// Clipboard format for iOS - app reads this on first launch after install
const CLIPBOARD_REF_PREFIX = "FITNUDGE_REF:";

// Android Play Store passes referrer via this param; app reads it on first launch
function buildPlayStoreUrlWithReferrer(
  baseUrl: string,
  referralCode: string
): string {
  const url = new URL(baseUrl);
  // Google Play referrer: value is typically a string; we use ref=CODE so the app can parse it
  url.searchParams.set("referrer", `ref=${encodeURIComponent(referralCode)}`);
  return url.toString();
}

// Android icon component
function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 9.49l-2.302 2.302-8.634-8.635z" />
    </svg>
  );
}

export default function JoinPage() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { ios, android } = useAppStoreLinks();
  const refStored = useRef(false);

  const ref = searchParams.get("ref")?.trim() || null;

  // Persist referral code so it survives navigation / revisit (e.g. after installing app)
  useEffect(() => {
    if (typeof window === "undefined" || !ref || refStored.current) return;
    try {
      const expiry =
        Date.now() + REFERRAL_STORAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
      localStorage.setItem(`${REFERRAL_STORAGE_KEY}_expiry`, String(expiry));
      refStored.current = true;
    } catch {
      // ignore
    }
  }, [ref]);

  const androidUrl = useMemo(() => {
    if (!android || !ref) return android || "";
    return buildPlayStoreUrlWithReferrer(android, ref);
  }, [android, ref]);

  // iOS: copy ref to clipboard before App Store redirect (app reads it on first launch)
  const handleIosClick = async (e: React.MouseEvent) => {
    if (ref && typeof navigator?.clipboard?.writeText === "function") {
      try {
        await navigator.clipboard.writeText(`${CLIPBOARD_REF_PREFIX}${ref}`);
      } catch (_) {
        // ignore clipboard failure
      }
    }
    // Let default link behavior open App Store
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-primary/5 via-white to-primary/10 dark:from-gray-900 dark:via-gray-800 dark:to-primary/10 flex flex-col">
      <header className="w-full px-4 sm:px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="FitNudge"
            width={40}
            height={40}
            unoptimized
          />
          <span className="text-xl font-bold">FitNudge</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("join.title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            {t("join.subtitle")}
          </p>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {t("join.choose_platform")}
            </p>

            <div className="flex flex-col gap-4">
              {/* iOS App Store - copy ref to clipboard on click so app can read after install */}
              <a
                href={ios}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleIosClick}
                className="flex items-center gap-4 w-full bg-gray-900 dark:bg-black text-white rounded-xl px-5 py-4 hover:opacity-90 transition-opacity"
              >
                <Apple className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" />
                <div className="text-left flex-1">
                  <div className="text-xs text-gray-400">
                    {t("join.ios_label")}
                  </div>
                  <div className="font-semibold">{t("join.app_store")}</div>
                </div>
              </a>

              {/* Google Play - with referrer so installer gets the code on Android */}
              <a
                href={androidUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 w-full bg-gray-900 dark:bg-black text-white rounded-xl px-5 py-4 hover:opacity-90 transition-opacity"
              >
                <PlayStoreIcon className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" />
                <div className="text-left flex-1">
                  <div className="text-xs text-gray-400">
                    {t("join.android_label")}
                  </div>
                  <div className="font-semibold">{t("join.google_play")}</div>
                </div>
              </a>
            </div>

            {ref && (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                {t("join.referral_applied")}
              </p>
            )}
          </div>

          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            {t("join.already_have_app")}{" "}
            <Link href="/" className="text-primary font-medium hover:underline">
              {t("join.back_home")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
