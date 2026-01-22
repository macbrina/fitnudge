"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@fitnudge/ui";
import { useTranslation } from "@/lib/i18n";
import { useAppStoreLinks, useAppConfig } from "@/store/appConfig";

function ResetPasswordContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { ios: iosAppUrl, android: androidAppUrl } = useAppStoreLinks();
  const { config } = useAppConfig();
  const [isClient, setIsClient] = useState(false);
  const [validationState, setValidationState] = useState<
    "checking" | "valid" | "invalid" | "missing"
  >(token ? "checking" : "missing");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );

  const apiBaseUrl = useMemo(() => {
    const candidates = [
      process.env.NEXT_PUBLIC_API_BASE_URL,
      process.env.NEXT_PUBLIC_API_URL,
      process.env.NEXT_PUBLIC_API_ENDPOINT,
    ].filter(Boolean) as string[];

    if (candidates.length === 0) {
      return null;
    }

    const normalized = candidates[0].replace(/\/$/, "");
    return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
  }, []);

  useEffect(() => {
    setIsClient(true);

    // Note: Universal Links/App Links work automatically when the page loads
    // If the app is installed, iOS/Android will intercept the URL before the page loads
    // If the app is not installed, the page loads normally (which is what we want)
    // No manual redirect needed - we're already at the correct URL
  }, [token]);

  useEffect(() => {
    if (!token) {
      setValidationState("missing");
      setValidationMessage(t("reset_password.validation_error_missing"));
      return;
    }

    if (!apiBaseUrl) {
      setValidationState("valid");
      setValidationMessage(null);
      return;
    }

    let cancelled = false;

    const validateToken = async () => {
      setValidationState("checking");
      setValidationMessage(null);

      try {
        const response = await fetch(
          `${apiBaseUrl}/auth/reset-password/validate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
          }
        );

        if (cancelled) return;

        if (response.ok) {
          setValidationState("valid");
          setValidationMessage(null);
          return;
        }

        let detail: string | null = null;
        try {
          const payload = await response.json();
          detail = payload?.detail || payload?.message || null;
        } catch {
          detail = null;
        }

        setValidationState("invalid");
        setValidationMessage(
          detail || t("reset_password.validation_error_expired")
        );
      } catch {
        if (cancelled) return;
        setValidationState("invalid");
        setValidationMessage(t("reset_password.validation_error_network"));
      }
    };

    validateToken();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, token, t]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {t("reset_password.invalid_link")}
          </h1>
          <p className="text-gray-600">
            {t("reset_password.invalid_link_description")}
          </p>
        </div>
      </div>
    );
  }

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {t("reset_password.opening_app")}
          </p>
        </div>
      </div>
    );
  }

  if (validationState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-gray-600">{t("reset_password.validating")}</p>
        </div>
      </div>
    );
  }

  if (validationState === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {t("reset_password.expired_title")}
          </h1>
          <p className="text-gray-600 mb-6">
            {validationMessage || t("reset_password.expired_description")}
          </p>
          <div className="space-y-3">
            <Button
              className="w-full"
              title={t("reset_password.request_new")}
              onClick={() => {
                const email = config.contact_email.replace("mailto:", "");
                window.location.href = `mailto:${email}?subject=Password%20Reset%20Help`;
              }}
            />
            <p className="text-xs text-gray-500 text-center">
              {t("reset_password.need_help")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t("reset_password.title")}
          </h1>
          <p className="text-gray-600">
            {typeof window !== "undefined" &&
            /iphone|ipad|ipod|android/.test(navigator.userAgent.toLowerCase())
              ? t("reset_password.opening_mobile")
              : t("reset_password.download_prompt")}
          </p>
        </div>

        {typeof window !== "undefined" &&
          /iphone|ipad|ipod|android/.test(
            navigator.userAgent.toLowerCase()
          ) && (
            <div className="mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          )}

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 text-center md:text-left mb-4 font-semibold">
            {t("reset_password.no_app_installed")}
          </p>
          <div className="space-y-2 md:space-y-0 flex flex-col md:flex-row md:justify-center items-center">
            <a
              href={iosAppUrl}
              className="block hover:opacity-90 transition-opacity mx-auto"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/images/appstore.webp"
                alt={t("reset_password.app_store_alt")}
                width={150}
                height={45}
                className="h-auto rounded-lg"
              />
            </a>
            <a
              href={androidAppUrl}
              className="block hover:opacity-90 transition-opacity mx-auto"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/images/playstore.webp"
                alt={t("reset_password.play_store_alt")}
                width={150}
                height={45}
                className="h-auto rounded-lg"
              />
            </a>
          </div>
        </div>

        <div className="border-t pt-6">
          <p className="text-sm text-gray-600 mb-4">
            {t("reset_password.manual_instructions")}
          </p>
          <p className="text-xs text-gray-500">
            {t("reset_password.security_note")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
