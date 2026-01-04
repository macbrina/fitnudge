import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { BaseApiService } from "@/services/api/base";

interface AppVersionResponse {
  latest_version: string;
  minimum_version: string;
  release_notes?: string;
  force_update: boolean;
  update_url?: string;
}

class AppVersionService extends BaseApiService {
  /**
   * Check for app updates
   */
  async checkForUpdate(): Promise<AppVersionResponse> {
    const platform = Platform.OS; // 'ios' or 'android'
    const currentVersion = Constants.expoConfig?.version || "1.0.0";

    const response = await this.get<AppVersionResponse>(
      `/app-version/check?platform=${platform}&current_version=${currentVersion}`
    );

    if (response.error || !response.data) {
      throw new Error(response.error || "Failed to check for updates");
    }

    return response.data;
  }
}

const appVersionService = new AppVersionService();

/**
 * Hook to check for app updates
 *
 * Usage:
 * ```tsx
 * const { data: updateInfo, isLoading } = useAppUpdate();
 *
 * if (updateInfo?.hasUpdate) {
 *   // Show update modal
 * }
 * ```
 */
export function useAppUpdate(enabled: boolean = true) {
  const currentVersion = Constants.expoConfig?.version || "1.0.0";

  return useQuery({
    queryKey: ["app-version-check"],
    queryFn: () => appVersionService.checkForUpdate(),
    staleTime: 1000 * 60 * 60, // Check once per hour
    gcTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
    enabled,
    refetchOnMount: "always", // Always refetch on mount, ignore staleTime
    retry: false, // Don't retry on failure
    select: (data) => {
      const hasUpdate = compareVersions(data.latest_version, currentVersion) > 0;
      const requiresUpdate =
        data.force_update || compareVersions(data.minimum_version, currentVersion) > 0;

      return {
        ...data,
        currentVersion,
        hasUpdate,
        requiresUpdate
      };
    }
  });
}

/**
 * Compares two semantic version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export default useAppUpdate;
