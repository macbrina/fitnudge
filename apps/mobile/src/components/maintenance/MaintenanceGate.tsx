import React, { type ReactNode } from "react";
import { useAppConfig, useAppConfigRealtime } from "@/hooks/api/useAppConfig";
import { useAuthStore } from "@/stores/authStore";
import { MaintenanceScreen } from "./MaintenanceScreen";

const MAINTENANCE_KEYS = {
  ENABLED: "maintenance_enabled",
  TITLE: "maintenance_title",
  MESSAGE: "maintenance_message",
  IMAGE_URL: "maintenance_image_url",
  CTA_LABEL: "maintenance_cta_label",
  CTA_URL: "maintenance_cta_url",
  BYPASS_IDS: "maintenance_bypass_user_ids"
} as const;

const DEFAULTS = {
  TITLE: "We'll be back soon",
  MESSAGE: "We're performing scheduled maintenance. Please check back shortly.",
  BYPASS_IDS: "[]"
};

function parseBypassIds(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];
  try {
    const arr = JSON.parse(value) as unknown;
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

interface MaintenanceGateProps {
  children: ReactNode;
}

/**
 * Blocks all app content (including auth) when maintenance_enabled is true.
 * Offline/config error → allow app. Bypass whitelist skips maintenance for testers.
 */
export function MaintenanceGate({ children }: MaintenanceGateProps) {
  useAppConfigRealtime();
  const { data, isLoading, error, refetch, isFetching } = useAppConfig();
  const { isAuthenticated, user } = useAuthStore();

  if (isLoading) return <>{children}</>;
  if (error) return <>{children}</>;

  const config = data?.config ?? {};
  const enabled = config[MAINTENANCE_KEYS.ENABLED]?.toLowerCase() === "true";
  if (!enabled) return <>{children}</>;

  const bypassIds = parseBypassIds(config[MAINTENANCE_KEYS.BYPASS_IDS]);
  if (isAuthenticated && user?.id && bypassIds.includes(user.id)) {
    return <>{children}</>;
  }

  const handleRetry = () => {
    refetch();
  };

  return (
    <MaintenanceScreen
      title={config[MAINTENANCE_KEYS.TITLE] || DEFAULTS.TITLE}
      message={config[MAINTENANCE_KEYS.MESSAGE] || DEFAULTS.MESSAGE}
      imageUrl={config[MAINTENANCE_KEYS.IMAGE_URL] || null}
      ctaLabel={config[MAINTENANCE_KEYS.CTA_LABEL] || null}
      ctaUrl={config[MAINTENANCE_KEYS.CTA_URL] || null}
      onRetry={handleRetry}
      isRetrying={isFetching}
    />
  );
}
