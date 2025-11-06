"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@fitnudge/ui";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [isClient, setIsClient] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Note: Universal Links/App Links work automatically when the page loads
    // If the app is installed, iOS/Android will intercept the URL before the page loads
    // If the app is not installed, the page loads normally (which is what we want)
    // No manual redirect needed - we're already at the correct URL
  }, [token]);

  const handleCopyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy token:", error);
    }
  };

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
            Don't have the app installed?
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
          <p className="text-sm text-gray-600 mb-3">
            If the app didn't open automatically, you can manually enter this
            reset token:
          </p>
          <div className="bg-gray-100 rounded-lg p-4 mb-4 relative">
            <code className="text-sm font-mono break-all text-gray-900 pr-12">
              {token}
            </code>
            <Button
              onClick={handleCopyToken}
              className="absolute top-2 right-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors focus:outline-none"
              title={copied ? "Copied!" : "Copy token"}
            >
              {copied ? "✓ Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            This token will expire in 1 hour. If you didn't request a password
            reset, please ignore this email.
          </p>
        </div>
      </div>
    </div>
  );
}
