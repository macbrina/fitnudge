import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  achievementsService,
  UserAchievement,
  AchievementType,
  AchievementStats
} from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

// Query Keys
export const achievementsQueryKeys = {
  all: ["achievements"] as const,
  types: () => [...achievementsQueryKeys.all, "types"] as const,
  myAchievements: () => [...achievementsQueryKeys.all, "my"] as const,
  stats: () => [...achievementsQueryKeys.all, "stats"] as const
} as const;

// Empty placeholders - commented out to show proper loading skeletons
// const EMPTY_ACHIEVEMENTS: UserAchievement[] = [];
// const EMPTY_ACHIEVEMENT_TYPES: AchievementType[] = [];
// const EMPTY_STATS: AchievementStats = {
//   total_achievements: 0,
//   total_points: 0,
//   rarity_breakdown: { common: 0, rare: 0, epic: 0, legendary: 0 }
// };

/**
 * Hook to get all available achievement types
 */
export const useAchievementTypes = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: achievementsQueryKeys.types(),
    queryFn: () => achievementsService.getAchievementTypes(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes - achievement types rarely change
    refetchOnMount: true // Check for fresh data on mount
  });
};

/**
 * Hook to get user's unlocked achievements
 */
export const useMyAchievements = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: achievementsQueryKeys.myAchievements(),
    queryFn: () => achievementsService.getMyAchievements(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: true // Always check for fresh data on mount
  });
};

/**
 * Hook to get achievement statistics
 */
export const useAchievementStats = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: achievementsQueryKeys.stats(),
    queryFn: () => achievementsService.getAchievementStats(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: true // Always check for fresh data on mount
  });
};

/**
 * Hook to manually trigger achievement check
 */
export const useCheckAchievements = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => achievementsService.checkAchievements(),
    onSuccess: (newAchievements) => {
      // If new achievements were unlocked, invalidate queries
      if (newAchievements.length > 0) {
        queryClient.invalidateQueries({
          queryKey: achievementsQueryKeys.myAchievements()
        });
        queryClient.invalidateQueries({
          queryKey: achievementsQueryKeys.stats()
        });
      }
    }
  });
};

/**
 * Helper to get rarity color
 */
export const getRarityColor = (rarity: string): string => {
  switch (rarity) {
    case "common":
      return "#9CA3AF"; // gray
    case "rare":
      return "#3B82F6"; // blue
    case "epic":
      return "#8B5CF6"; // purple
    case "legendary":
      return "#F59E0B"; // gold/amber
    default:
      return "#9CA3AF";
  }
};

/**
 * Helper to get rarity emoji
 */
export const getRarityEmoji = (rarity: string): string => {
  switch (rarity) {
    case "common":
      return "⭐";
    case "rare":
      return "💎";
    case "epic":
      return "🏆";
    case "legendary":
      return "👑";
    default:
      return "⭐";
  }
};

/**
 * Helper to get badge icon based on badge_key
 */
export const getBadgeIcon = (badgeKey: string): string => {
  const icons: Record<string, string> = {
    first_checkin: "🎯",
    streak_3: "🔥",
    streak_7: "💪",
    streak_30: "🏅",
    streak_100: "🏆",
    checkins_50: "✅",
    checkins_100: "💯",
    first_goal: "🎯",
    perfect_week: "⭐"
  };
  return icons[badgeKey] || "🏅";
};
