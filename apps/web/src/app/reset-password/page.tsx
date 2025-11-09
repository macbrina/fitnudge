"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@fitnudge/ui";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
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
      setValidationMessage(
        "This password reset link is invalid or missing a token. Please request a new reset email."
      );
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
          detail ||
            "This password reset link is no longer valid. Please request a new reset email."
        );
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to validate reset token:", error);
        setValidationState("invalid");
        setValidationMessage(
          "We couldn't verify this reset link right now. Please request a new password reset email."
        );
      }
    };

    validateToken();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Invalid Reset Link
          </h1>
          <p className="text-gray-600">
            This password reset link is invalid or missing a token. Please
            request a new password reset.
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
          <p className="mt-4 text-gray-600">Opening FitNudge app...</p>
        </div>
      </div>
    );
  }

  if (validationState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-gray-600">Validating your reset link...</p>
        </div>
      </div>
    );
  }

  if (validationState === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Reset Link Expired
          </h1>
          <p className="text-gray-600 mb-6">
            {validationMessage ||
              "This password reset link is no longer valid. Please request a new reset email."}
          </p>
          <div className="space-y-3">
            <Button
              className="w-full"
              title="Request a new reset email"
              onClick={() => {
                window.location.href =
                  "mailto:support@fitnudge.app?subject=Password%20Reset%20Help";
              }}
            />
            <p className="text-xs text-gray-500 text-center">
              Need help? Contact support and we’ll get you back in quickly.
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
            Reset Your Password
          </h1>
          <p className="text-gray-600">
            {typeof window !== "undefined" &&
            /iphone|ipad|ipod|android/.test(navigator.userAgent.toLowerCase())
              ? "Opening the FitNudge app..."
              : "Download the app to reset your password"}
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
            Do not have the app installed?
          </p>
          <div className="space-y-2 md:space-y-0 flex flex-col md:flex-row md:justify-center items-center">
            <a
              href="https://apps.apple.com/app/idXXXXXXXXXX"
              className="block hover:opacity-90 transition-opacity mx-auto"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/images/appstore.webp"
                alt="Download on App Store"
                width={150}
                height={45}
                className="h-auto rounded-lg"
              />
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.fitnudge.app"
              className="block hover:opacity-90 transition-opacity mx-auto"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/images/playstore.webp"
                alt="Get it on Google Play"
                width={150}
                height={45}
                className="h-auto rounded-lg"
              />
            </a>
          </div>
        </div>

        <div className="border-t pt-6">
          <p className="text-sm text-gray-600 mb-4">
            If the app did not open automatically, open the FitNudge app and use
            “Forgot password” to request a fresh link. Your reset code from this
            link has already been applied inside the app if it opened
            successfully.
          </p>
          <p className="text-xs text-gray-500">
            Password reset links expire in 1 hour for your security. If you did
            not request a reset, you can safely ignore this email.
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
            <p className="mt-4 text-gray-600">Loading reset page...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
