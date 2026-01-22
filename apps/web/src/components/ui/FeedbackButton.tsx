"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@fitnudge/ui";
import { useTranslation } from "@/lib/i18n";

declare global {
  interface Window {
    Tally?: {
      openPopup: (
        formId: string,
        options?: {
          layout?: "modal" | "default";
          width?: number;
          emoji?: { text: string; animation: string };
        }
      ) => void;
    };
  }
}

const TALLY_FORM_ID = "2EaLE9";

export function FeedbackButton() {
  const { t } = useTranslation();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if script is already loaded
    if (window.Tally) {
      setIsLoaded(true);
      return;
    }

    // Load Tally script
    const script = document.createElement("script");
    script.src = "https://tally.so/widgets/embed.js";
    script.async = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, []);

  // Show button after a short delay for better UX
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    if (window.Tally) {
      window.Tally.openPopup(TALLY_FORM_ID, {
        layout: "modal",
        width: 400,
        emoji: { text: "👋", animation: "wave" },
      });
    }
  };

  if (!isLoaded) return null;

  return (
    <button
      onClick={handleClick}
      className={cn(
        "fixed bottom-6 left-6 z-50",
        "flex items-center gap-2 px-4 py-3",
        "bg-primary hover:bg-primary/90 text-white",
        "rounded-full shadow-lg hover:shadow-xl",
        "transition-all duration-300 ease-out",
        "group",
        // Animation for appearance
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0 pointer-events-none"
      )}
      aria-label={t("common.send_feedback")}
    >
      <MessageSquarePlus className="h-5 w-5" />
      <span className="text-sm font-medium hidden sm:inline">
        {t("common.feedback")}
      </span>
    </button>
  );
}
