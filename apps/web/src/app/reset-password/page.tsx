"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    if (!token) {
      return;
    }

    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    // App Store and Play Store URLs (update with actual app IDs when available)
    const appStoreUrl = "https://apps.apple.com/app/idXXXXXXXXXX"; // Replace with actual App Store ID
    const playStoreUrl =
      "https://play.google.com/store/apps/details?id=com.fitnudge.app";

    // Try to open app with deep link first
    const deepLink = `fitnudge://reset-password?token=${encodeURIComponent(token)}`;

    // Try opening the deep link
    const startTime = Date.now();
    window.location.href = deepLink;

    // If deep link doesn't work, redirect to app store after timeout
    setTimeout(() => {
      const elapsed = Date.now() - startTime;

      // If still on page after 2 seconds, app likely not installed
      if (elapsed >= 2000) {
        if (isIOS) {
          window.location.href = appStoreUrl;
        } else if (isAndroid) {
          window.location.href = playStoreUrl;
        } else {
          // Desktop or unknown - show manual instructions
          // (already showing in JSX below)
        }
      }
    }, 2000);
  }, [token]);

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
            We're opening the FitNudge app for you...
          </p>
        </div>

        <div className="mb-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 mb-2 font-semibold">
            Don't have the app installed?
          </p>
          <div className="space-y-2">
            <a
              href="https://apps.apple.com/app/idXXXXXXXXXX"
              className="block w-full bg-black text-white text-center py-3 rounded-lg font-medium hover:bg-gray-800 transition"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download on App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.fitnudge.app"
              className="block w-full bg-green-600 text-white text-center py-3 rounded-lg font-medium hover:bg-green-700 transition"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get it on Google Play
            </a>
          </div>
        </div>

        <div className="border-t pt-6">
          <p className="text-sm text-gray-600 mb-3">
            Or manually enter this reset token in the app:
          </p>
          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            <code className="text-sm font-mono break-all text-gray-900">
              {token}
            </code>
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
