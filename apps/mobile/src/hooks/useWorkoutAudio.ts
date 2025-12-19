import { useState, useEffect, useCallback } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Speech from "expo-speech";
import type {
  WorkoutMusicTrack,
  UserAudioPreferences,
  MusicPlayerState,
} from "@/types/audio";
import { DEFAULT_AUDIO_PREFERENCES, getRandomPhrase } from "@/types/audio";

// CDN URL for the ding sound effect
const DING_SOUND_URL = "https://media.fitnudge.app/sounds/exercise_start.mp3";

interface UseWorkoutAudioOptions {
  autoPlay?: boolean;
}

interface UseWorkoutAudioReturn {
  // Music Player State
  playerState: MusicPlayerState;
  currentTrack: WorkoutMusicTrack | null;
  isPlaying: boolean;
  isPaused: boolean;

  // Music Controls
  playMusic: () => void;
  pauseMusic: () => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleShuffle: () => void;
  setVolume: (volume: number) => void;

  // Playlist
  playlist: WorkoutMusicTrack[];
  setPlaylist: (tracks: WorkoutMusicTrack[]) => void;
  playTrack: (track: WorkoutMusicTrack) => void;

  // Sound Effects
  playDing: () => void;

  // Coach Voice
  speakCoachPhrase: (
    category: "ready" | "start" | "encouragement" | "rest" | "complete",
    customText?: string
  ) => void;
  speakExerciseName: (name: string) => void;
  stopSpeaking: () => void;

  // Preferences
  preferences: UserAudioPreferences;
  updatePreferences: (updates: Partial<UserAudioPreferences>) => void;
}

/**
 * Hook to manage all workout audio: music, sound effects, and coach voice
 */
export function useWorkoutAudio(
  options: UseWorkoutAudioOptions = {}
): UseWorkoutAudioReturn {
  const { autoPlay = false } = options;

  // State
  const [playlist, setPlaylist] = useState<WorkoutMusicTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShuffleOn, setIsShuffleOn] = useState(true);
  const [preferences, setPreferences] = useState<UserAudioPreferences>({
    id: "",
    user_id: "",
    created_at: "",
    updated_at: "",
    ...DEFAULT_AUDIO_PREFERENCES,
  });

  // Music player
  const currentTrackUrl = playlist[currentIndex]?.file_url || null;
  const musicPlayer = useAudioPlayer(currentTrackUrl);
  const playerStatus = useAudioPlayerStatus(musicPlayer);

  // Ding sound effect player
  const dingPlayer = useAudioPlayer(DING_SOUND_URL);

  // Current track
  const currentTrack = playlist[currentIndex] || null;
  const isPlaying = playerStatus.playing;
  const isPaused = !playerStatus.playing && playerStatus.currentTime > 0;

  // Player state
  const playerState: MusicPlayerState = {
    isPlaying,
    isPaused,
    currentTrack,
    position: playerStatus.currentTime / 1000,
    duration: playerStatus.duration / 1000,
    volume: musicPlayer.volume,
    isShuffle: isShuffleOn,
    isRepeat: false,
    playlist,
    currentIndex,
  };

  // ========== MUSIC CONTROLS ==========

  const playMusic = useCallback(() => {
    if (preferences.music_enabled && currentTrack) {
      musicPlayer.play();
    }
  }, [musicPlayer, preferences.music_enabled, currentTrack]);

  const pauseMusic = useCallback(() => {
    musicPlayer.pause();
  }, [musicPlayer]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseMusic();
    } else {
      playMusic();
    }
  }, [isPlaying, playMusic, pauseMusic]);

  const nextTrack = useCallback(() => {
    if (playlist.length === 0) return;

    let nextIndex: number;
    if (isShuffleOn) {
      do {
        nextIndex = Math.floor(Math.random() * playlist.length);
      } while (nextIndex === currentIndex && playlist.length > 1);
    } else {
      nextIndex = (currentIndex + 1) % playlist.length;
    }

    setCurrentIndex(nextIndex);
  }, [playlist, currentIndex, isShuffleOn]);

  const previousTrack = useCallback(() => {
    if (playlist.length === 0) return;

    if (playerStatus.currentTime > 3000) {
      musicPlayer.seekTo(0);
      return;
    }

    const prevIndex =
      currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
  }, [playlist, currentIndex, playerStatus.currentTime, musicPlayer]);

  const toggleShuffle = useCallback(() => {
    setIsShuffleOn((prev) => !prev);
    setPreferences((prev) => ({
      ...prev,
      shuffle_enabled: !prev.shuffle_enabled,
    }));
  }, []);

  const setVolume = useCallback(
    (volume: number) => {
      musicPlayer.volume = volume;
      setPreferences((prev) => ({ ...prev, music_volume: volume }));
    },
    [musicPlayer]
  );

  const playTrack = useCallback(
    (track: WorkoutMusicTrack) => {
      const index = playlist.findIndex((t) => t.id === track.id);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    },
    [playlist]
  );

  // Auto-play next track when current ends
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      nextTrack();
    }
  }, [playerStatus.didJustFinish, nextTrack]);

  // Auto-play on mount if enabled
  useEffect(() => {
    if (autoPlay && preferences.music_enabled && playlist.length > 0) {
      playMusic();
    }
  }, [autoPlay, preferences.music_enabled, playlist.length]);

  // ========== SOUND EFFECT (DING) ==========

  const playDing = useCallback(() => {
    if (!preferences.sound_effects_enabled) return;

    // Set volume and play from beginning
    dingPlayer.volume = preferences.sound_effects_volume;
    dingPlayer.seekTo(0);
    dingPlayer.play();
  }, [
    dingPlayer,
    preferences.sound_effects_enabled,
    preferences.sound_effects_volume,
  ]);

  // ========== COACH VOICE ==========

  const speakCoachPhrase = useCallback(
    (
      category: "ready" | "start" | "encouragement" | "rest" | "complete",
      customText?: string
    ) => {
      if (!preferences.coach_voice_enabled) return;

      const text = customText || getRandomPhrase(category);

      Speech.speak(text, {
        rate: 0.9,
        pitch: 1.0,
        volume: preferences.coach_voice_volume,
      });
    },
    [preferences.coach_voice_enabled, preferences.coach_voice_volume]
  );

  const speakExerciseName = useCallback(
    (name: string) => {
      if (!preferences.coach_voice_enabled) return;

      Speech.speak(name, {
        rate: 0.85,
        pitch: 1.0,
        volume: preferences.coach_voice_volume,
      });
    },
    [preferences.coach_voice_enabled, preferences.coach_voice_volume]
  );

  const stopSpeaking = useCallback(() => {
    Speech.stop();
  }, []);

  // ========== PREFERENCES ==========

  const updatePreferences = useCallback(
    (updates: Partial<UserAudioPreferences>) => {
      setPreferences((prev) => {
        const updated = { ...prev, ...updates };

        if (updates.music_volume !== undefined) {
          musicPlayer.volume = updates.music_volume;
        }

        return updated;
      });
    },
    [musicPlayer]
  );

  // ========== CLEANUP ==========

  useEffect(() => {
    return () => {
      // Wrap in try-catch as the player may already be released on unmount
      try {
        musicPlayer.pause();
      } catch {
        // Player already released, ignore
      }
      Speech.stop();
    };
  }, [musicPlayer]);

  return {
    // Music Player State
    playerState,
    currentTrack,
    isPlaying,
    isPaused,

    // Music Controls
    playMusic,
    pauseMusic,
    togglePlayPause,
    nextTrack,
    previousTrack,
    toggleShuffle,
    setVolume,

    // Playlist
    playlist,
    setPlaylist,
    playTrack,

    // Sound Effects
    playDing,

    // Coach Voice
    speakCoachPhrase,
    speakExerciseName,
    stopSpeaking,

    // Preferences
    preferences,
    updatePreferences,
  };
}

export default useWorkoutAudio;
