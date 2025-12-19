/**
 * Workout Audio Types
 *
 * Types for music playback, coach voice, and sound effects
 */

// ============================================
// Music Track
// ============================================

export type MusicMood =
  | "energetic"
  | "calm"
  | "motivational"
  | "intense"
  | "chill";

export interface WorkoutMusicTrack {
  id: string;
  title: string;
  artist?: string;
  duration_seconds: number;
  file_url: string;
  file_key: string;
  file_size_bytes?: number;
  bpm?: number;
  genre?: string;
  mood?: MusicMood;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Sound Effects
// ============================================

export type SoundEffectType =
  | "exercise_start"
  | "rest_start"
  | "countdown_tick"
  | "workout_complete";

export interface SoundEffect {
  id: string;
  name: SoundEffectType;
  description?: string;
  file_url: string;
  file_key: string;
  file_size_bytes?: number;
  duration_ms?: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

// ============================================
// User Audio Preferences
// ============================================

export type PreferredMusicApp = "playlist" | "apple_music" | "spotify";

export interface UserAudioPreferences {
  id: string;
  user_id: string;

  // Music
  music_enabled: boolean;
  music_volume: number; // 0.0 to 1.0
  shuffle_enabled: boolean;

  // Coach voice
  coach_voice_enabled: boolean;
  coach_voice_volume: number; // 0.0 to 1.0

  // Sound effects
  sound_effects_enabled: boolean;
  sound_effects_volume: number; // 0.0 to 1.0

  // External apps
  preferred_music_app?: PreferredMusicApp;

  // Resume state
  last_played_track_id?: string;
  last_played_position_seconds?: number;

  created_at: string;
  updated_at: string;
}

// Default preferences for new users
export const DEFAULT_AUDIO_PREFERENCES: Omit<
  UserAudioPreferences,
  "id" | "user_id" | "created_at" | "updated_at"
> = {
  music_enabled: true,
  music_volume: 0.8,
  shuffle_enabled: true,
  coach_voice_enabled: true,
  coach_voice_volume: 0.8,
  sound_effects_enabled: true,
  sound_effects_volume: 0.8,
  preferred_music_app: "playlist",
};

// ============================================
// Music Player State
// ============================================

export interface MusicPlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTrack: WorkoutMusicTrack | null;
  position: number; // seconds
  duration: number; // seconds
  volume: number;
  isShuffle: boolean;
  isRepeat: boolean;
  playlist: WorkoutMusicTrack[];
  currentIndex: number;
}

// ============================================
// Coach Voice Phrases
// ============================================

export const COACH_PHRASES = {
  ready: ["Ready to go!", "Let's do this!", "Get ready!", "Here we go!"],
  start: ["Start!", "Go!", "Let's go!", "Begin!"],
  encouragement: [
    "You're doing great!",
    "Keep it up!",
    "Almost there!",
    "Stay strong!",
    "You've got this!",
    "Push through!",
    "Great form!",
    "Keep going!",
  ],
  rest: [
    "Take a breather",
    "Rest up",
    "Good work, rest now",
    "Catch your breath",
    "Well done, rest",
  ],
  nextExercise: ["Next up:", "Coming up:", "Get ready for:"],
  complete: [
    "Workout complete!",
    "Amazing job!",
    "You crushed it!",
    "Fantastic work!",
    "You did it!",
  ],
} as const;

// Helper to get random phrase
export function getRandomPhrase(category: keyof typeof COACH_PHRASES): string {
  const phrases = COACH_PHRASES[category];
  return phrases[Math.floor(Math.random() * phrases.length)];
}
