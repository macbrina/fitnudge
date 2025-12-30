/**
 * Audio Preferences API Service
 *
 * Handles fetching and updating user audio preferences for workout music,
 * coach voice, and sound effects.
 */

import { BaseApiService } from "./base";

export interface AudioPreferences {
  id: string;
  user_id: string;
  music_enabled: boolean;
  music_volume: number;
  shuffle_enabled: boolean;
  coach_voice_enabled: boolean;
  coach_voice_volume: number;
  sound_effects_enabled: boolean;
  sound_effects_volume: number;
  preferred_music_app: "playlist" | "apple_music" | "spotify" | null;
  last_played_track_id: string | null;
  last_played_position_seconds: number;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateAudioPreferencesRequest {
  music_enabled?: boolean;
  music_volume?: number;
  shuffle_enabled?: boolean;
  coach_voice_enabled?: boolean;
  coach_voice_volume?: number;
  sound_effects_enabled?: boolean;
  sound_effects_volume?: number;
  preferred_music_app?: "playlist" | "apple_music" | "spotify" | null;
  last_played_track_id?: string | null;
  last_played_position_seconds?: number;
}

// API routes
const ROUTES = {
  PREFERENCES: "/audio-preferences",
};

class AudioPreferencesService extends BaseApiService {
  /**
   * Get current user's audio preferences
   * Creates default preferences if they don't exist
   */
  async getPreferences(): Promise<AudioPreferences> {
    const response = await this.get<AudioPreferences>(ROUTES.PREFERENCES);
    return response.data!;
  }

  /**
   * Update user's audio preferences (partial update)
   */
  async updatePreferences(
    updates: UpdateAudioPreferencesRequest,
  ): Promise<AudioPreferences> {
    const response = await this.patch<AudioPreferences>(
      ROUTES.PREFERENCES,
      updates,
    );
    return response.data!;
  }
}

export const audioPreferencesService = new AudioPreferencesService();
