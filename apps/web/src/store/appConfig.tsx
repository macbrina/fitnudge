"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { createBrowserClient } from "@/lib/supabase";

// Types for app config
export interface AppConfig {
  // App Store URLs
  ios_app_store_url: string;
  android_play_store_url: string;

  // Social Media Links
  social_twitter: string;
  social_instagram: string;
  social_facebook: string;
  social_linkedin: string;
  social_tiktok: string;

  // External URLs
  privacy_policy_url: string;
  terms_of_service_url: string;
  help_center_url: string;
  tally_feedback_url: string;
  tawk_chat_url: string;
  contact_email: string;
}

// Default fallback values (used when DB is unavailable)
const DEFAULT_CONFIG: AppConfig = {
  ios_app_store_url: "https://apps.apple.com/app/fitnudge",
  android_play_store_url:
    "https://play.google.com/store/apps/details?id=com.fitnudge.app",
  social_twitter: "https://twitter.com/fitnudgeapp",
  social_instagram: "https://instagram.com/fitnudgeapp",
  social_facebook: "https://facebook.com/fitnudgeapp",
  social_linkedin: "https://linkedin.com/company/fitnudgeapp",
  social_tiktok: "https://tiktok.com/@fitnudgeapp",
  privacy_policy_url: "https://fitnudge.app/privacy-policy",
  terms_of_service_url: "https://fitnudge.app/terms-of-service",
  help_center_url: "https://fitnudge.tawk.help/",
  tally_feedback_url: "https://tally.so/r/2EaLE9",
  tawk_chat_url: "https://tawk.to/chat/695732b53a0c9b197f142f94/1jdu9s5a9",
  contact_email: "mailto:hello@fitnudge.app",
};

interface AppConfigContextValue {
  config: AppConfig;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

// Cache key for localStorage
const CACHE_KEY = "fitnudge.app_config";
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

interface CachedConfig {
  config: AppConfig;
  timestamp: number;
}

function loadFromCache(): AppConfig | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedConfig = JSON.parse(cached);
    const isExpired = Date.now() - parsed.timestamp > CACHE_TTL;

    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.config;
  } catch {
    return null;
  }
}

function saveToCache(config: AppConfig): void {
  if (typeof window === "undefined") return;

  try {
    const cached: CachedConfig = {
      config,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
}

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    // Try loading from cache first
    const cached = loadFromCache();
    if (cached) {
      setConfig(cached);
      setIsLoading(false);
      // Still fetch in background to update cache
    }

    try {
      const supabase = createBrowserClient();
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("app_config")
        .select("key, value")
        .eq("is_public", true);

      if (fetchError) {
        setError(fetchError.message);
        setIsLoading(false);
        return;
      }

      if (data && data.length > 0) {
        // Convert array of {key, value} to object
        const configObj: Partial<AppConfig> = {};
        data.forEach((item: { key: string; value: string }) => {
          if (item.key in DEFAULT_CONFIG) {
            (configObj as Record<string, string>)[item.key] = item.value;
          }
        });

        const mergedConfig = { ...DEFAULT_CONFIG, ...configObj };
        setConfig(mergedConfig);
        saveToCache(mergedConfig);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return (
    <AppConfigContext.Provider
      value={{ config, isLoading, error, refetch: fetchConfig }}
    >
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig(): AppConfigContextValue {
  const context = useContext(AppConfigContext);

  if (!context) {
    // Return default config if used outside provider
    return {
      config: DEFAULT_CONFIG,
      isLoading: false,
      error: null,
      refetch: async () => {},
    };
  }

  return context;
}

// Helper hooks for specific config sections
export function useSocialLinks() {
  const { config, isLoading } = useAppConfig();

  return {
    twitter: config.social_twitter,
    instagram: config.social_instagram,
    facebook: config.social_facebook,
    linkedin: config.social_linkedin,
    tiktok: config.social_tiktok,
    isLoading,
  };
}

export function useAppStoreLinks() {
  const { config, isLoading } = useAppConfig();

  return {
    ios: config.ios_app_store_url,
    android: config.android_play_store_url,
    isLoading,
  };
}
