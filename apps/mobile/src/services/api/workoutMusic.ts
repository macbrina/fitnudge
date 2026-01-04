/**
 * Workout Music API Service
 *
 * Fetches workout music tracks from the backend.
 */

import { BaseApiService, ApiResponse } from "./base";
import type { WorkoutMusicTrack } from "@/types/audio";

export interface WorkoutMusicResponse {
  tracks: WorkoutMusicTrack[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// API route helpers
const ROUTES = {
  ALL: "/workout-music/all",
  PAGINATED: "/workout-music"
};

class WorkoutMusicService extends BaseApiService {
  /**
   * Get all active workout music tracks.
   * Since music library is small (~20-50 tracks), we fetch all at once.
   */
  async getAll(): Promise<WorkoutMusicTrack[]> {
    const response = await this.get<WorkoutMusicTrack[]>(ROUTES.ALL);
    return response.data || [];
  }

  /**
   * Get paginated workout music tracks.
   */
  async getPaginated(page = 1, pageSize = 50, mood?: string): Promise<WorkoutMusicResponse> {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize)
    });

    if (mood) {
      params.append("mood", mood);
    }

    const response = await this.get<WorkoutMusicResponse>(
      `${ROUTES.PAGINATED}?${params.toString()}`
    );
    return (
      response.data || {
        tracks: [],
        total: 0,
        page,
        page_size: pageSize,
        has_more: false
      }
    );
  }
}

// Export singleton instance
export const workoutMusicService = new WorkoutMusicService();
