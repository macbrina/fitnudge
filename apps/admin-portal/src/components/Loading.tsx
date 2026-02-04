"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@fitnudge/ui";

type LoadingVariant = "page" | "inline";

type LoadingProps = {
  variant?: LoadingVariant;
  label?: string;
  className?: string;
};

export function Loading({
  variant = "inline",
  label,
  className,
}: LoadingProps) {
  const { t } = useTranslation();
  const displayLabel = label ?? t("common.loading");

  const spinner = (
    <div className="relative">
      <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-primary/20 rounded-full" />
      <div
        className="absolute inset-0 w-10 h-10 sm:w-12 sm:h-12 border-2 border-transparent border-t-primary rounded-full animate-spin"
        style={{ animationDuration: "0.8s" }}
      />
    </div>
  );

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      {spinner}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {displayLabel}
        </span>
        <span className="flex gap-0.5" aria-hidden>
          <span
            className="w-1 h-1 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-1 h-1 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-1 h-1 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </span>
      </div>
    </div>
  );

  if (variant === "page") {
    return (
      <div
        className={cn(
          "min-h-screen flex items-center justify-center",
          "bg-gray-50 dark:bg-gray-950",
          className
        )}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 scale-125 sm:scale-150">{content}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center py-12",
        className
      )}
    >
      {content}
    </div>
  );
}
