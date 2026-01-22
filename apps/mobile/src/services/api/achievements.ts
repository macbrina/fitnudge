import { BaseApiService } from "./base";
import { ROUTES } from "@/lib/routes";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";
export type AchievementCategory =
  | "streak"
  | "milestone"
  | "consistency"
  | "social"
  | "special"
  | "engagement";

export interface AchievementType {
  id: string;
  badge_key: string;
  badge_name: string;
  badge_description: string | null;
  badge_icon: string | null;
  unlock_condition: { type: string; value: number }; // JSONB from database
  category: AchievementCategory;
  rarity: AchievementRarity;
  points: number;
  sort_order: number;
  is_active: boolean;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_type_id: string;
  goal_id: string | null;
  unlocked_at: string;
  metadata: Record<string, any>;
  badge_key: string;
  badge_name: string;
  badge_description: string | null;
  points: number;
  rarity: AchievementRarity;
}

export interface AchievementStats {
  total_achievements: number;
  total_points: number;
  rarity_breakdown: {
    common?: number;
    rare?: number;
    epic?: number;
    legendary?: number;
  };
}

class AchievementsService extends BaseApiService {
  /**
   * Get all available achievement types
   */
  async getAchievementTypes(): Promise<AchievementType[]> {
    const response = await this.get<AchievementType[]>(ROUTES.ACHIEVEMENTS.TYPES);
    return response.data || [];
  }

  /**
   * Get user's unlocked achievements
   */
  async getMyAchievements(): Promise<UserAchievement[]> {
    const response = await this.get<UserAchievement[]>(ROUTES.ACHIEVEMENTS.MY_ACHIEVEMENTS);
    return response.data || [];
  }

  /**
   * Manually trigger achievement check
   */
  async checkAchievements(): Promise<UserAchievement[]> {
    const response = await this.post<UserAchievement[]>(ROUTES.ACHIEVEMENTS.CHECK, {});
    return response.data || [];
  }

  /**
   * Get achievement statistics
   */
  async getAchievementStats(): Promise<AchievementStats> {
    const response = await this.get<AchievementStats>(ROUTES.ACHIEVEMENTS.STATS);
    return (
      response.data || {
        total_achievements: 0,
        total_points: 0,
        rarity_breakdown: { common: 0, rare: 0, epic: 0, legendary: 0 }
      }
    );
  }
}

export const achievementsService = new AchievementsService();
