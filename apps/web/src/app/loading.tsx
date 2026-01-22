"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";

// Smooth loading animation
const ANIMATION_URL =
  "https://assets5.lottiefiles.com/packages/lf20_usmfx6bp.json";

export default function Loading() {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch(ANIMATION_URL)
      .then((res) => res.json())
      .then((data) => setAnimationData(data))
      .catch(() => {
        // Animation failed to load, will show fallback
      });
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-primary/5 via-white to-purple-100 dark:from-gray-900 dark:via-gray-800 dark:to-primary/10 flex items-center justify-center">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="text-center relative z-10">
        {/* Lottie Animation or Fallback */}
        <div className="w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-4">
          {animationData ? (
            <Lottie
              animationData={animationData}
              loop={true}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {/* Fallback spinner */}
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-primary/20 rounded-full" />
                <div className="absolute top-0 left-0 w-16 h-16 sm:w-20 sm:h-20 border-4 border-transparent border-t-primary rounded-full animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Loading text with animated dots */}
        <div className="flex items-center justify-center gap-1">
          <span className="text-lg font-medium text-gray-600 dark:text-gray-400">
            Loading
          </span>
          <span className="flex gap-0.5">
            <span
              className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
