import { useState, useEffect, useCallback, useRef } from "react";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
  createAudioPlayer,
  AudioPlayer,
} from "expo-audio";
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
  initialPreferences?: Partial<UserAudioPreferences>;
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
  stopDing: () => void;

  // Coach Voice
  speakCoachPhrase: (
    category: "ready" | "start" | "encouragement" | "rest" | "complete",
    customText?: string,
  ) => void;
  speakExerciseName: (name: string) => void;
  speakCountdown: (number: number) => void;
  stopSpeaking: () => void;

  // Preferences
  preferences: UserAudioPreferences;
  updatePreferences: (updates: Partial<UserAudioPreferences>) => void;
}

/**
 * Hook to manage all workout audio: music, sound effects, and coach voice
 */
export function useWorkoutAudio(
  options: UseWorkoutAudioOptions = {},
): UseWorkoutAudioReturn {
  const { autoPlay = false, initialPreferences } = options;

  // State
  const [playlist, setPlaylist] = useState<WorkoutMusicTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShuffleOn, setIsShuffleOn] = useState(
    initialPreferences?.shuffle_enabled ?? true,
  );
  const [preferences, setPreferences] = useState<UserAudioPreferences>({
    id: "",
    user_id: "",
    created_at: "",
    updated_at: "",
    ...DEFAULT_AUDIO_PREFERENCES,
    ...initialPreferences, // Override with database preferences
  });
  const prefsInitializedRef = useRef(false);

  // Update preferences when initialPreferences changes (e.g., after fetch)
  useEffect(() => {
    if (initialPreferences && !prefsInitializedRef.current) {
      prefsInitializedRef.current = true;
      setPreferences((prev) => ({
        ...prev,
        ...initialPreferences,
      }));
      setIsShuffleOn(initialPreferences.shuffle_enabled ?? true);
    }
  }, [initialPreferences]);
  const audioModeConfiguredRef = useRef(false);
  const [isAudioReady, setIsAudioReady] = useState(false);

  // Music player ref - using createAudioPlayer for dynamic track changes
  const musicPlayerRef = useRef<AudioPlayer | null>(null);
  const shouldAutoPlayRef = useRef(false); // Flag to auto-play when player is ready
  const shouldAutoPlayOnTrackChangeRef = useRef(false); // Flag to auto-play when track changes (next/prev/select)
  const [playerState2, setPlayerState2] = useState({
    isPlaying: false,
    isLoaded: false,
    currentTime: 0,
    duration: 0,
  });

  // Configure audio mode on mount (required for iOS silent mode and audio mixing)
  useEffect(() => {
    if (audioModeConfiguredRef.current) return;
    audioModeConfiguredRef.current = true;

    const configureAudioMode = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          // Allow sound effects (ding) and speech to play together without interrupting each other
          interruptionMode: "mixWithOthers",
        });
        setIsAudioReady(true);
      } catch (error) {
        // Still allow audio attempts even if configuration fails
        setIsAudioReady(true);
      }
    };

    configureAudioMode();
  }, []);

  // Current track URL
  const currentTrackUrl = playlist[currentIndex]?.file_url || null;

  // Ref to store initial volume to set on player creation
  const initialVolumeRef = useRef(preferences.music_volume);

  // Keep initial volume ref updated (but don't trigger player recreation)
  useEffect(() => {
    initialVolumeRef.current = preferences.music_volume;
  }, [preferences.music_volume]);

  // Create/replace music player when track changes (NOT when volume changes!)
  useEffect(() => {
    if (!currentTrackUrl || !isAudioReady) {
      return;
    }

    // Release previous player
    if (musicPlayerRef.current) {
      try {
        musicPlayerRef.current.release();
      } catch (e) {
        // Ignore release errors
      }
    }

    // Create new player with the track URL
    const player = createAudioPlayer(currentTrackUrl);
    musicPlayerRef.current = player;

    // Set volume from ref (doesn't cause re-render)
    player.volume = initialVolumeRef.current;

    setPlayerState2((prev) => ({ ...prev, isLoaded: true }));

    // Auto-play if we were waiting for the player to be ready OR if this is a track change
    const shouldAutoPlay =
      (shouldAutoPlayRef.current || shouldAutoPlayOnTrackChangeRef.current) &&
      preferences.music_enabled;

    if (shouldAutoPlay) {
      shouldAutoPlayRef.current = false;
      shouldAutoPlayOnTrackChangeRef.current = false;
      // Small delay to ensure player is fully initialized
      setTimeout(() => {
        try {
          player.play();
          setPlayerState2((prev) => ({ ...prev, isPlaying: true }));
        } catch (error) {
          console.error("[useWorkoutAudio] Auto-play error:", error);
        }
      }, 100);
    }

    // Cleanup on unmount or track change
    return () => {
      try {
        player.release();
      } catch (e) {
        // Ignore
      }
    };
    // NOTE: preferences.music_volume is intentionally NOT in deps - we use ref instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackUrl, isAudioReady]);

  // Ding sound effect player - using useAudioPlayer for static sound
  const dingPlayer = useAudioPlayer(DING_SOUND_URL);

  // Current track
  const currentTrack = playlist[currentIndex] || null;
  const isPlaying = playerState2.isPlaying;
  const isPaused = !playerState2.isPlaying && playerState2.currentTime > 0;

  // Player state
  const playerState: MusicPlayerState = {
    isPlaying,
    isPaused,
    currentTrack,
    position: playerState2.currentTime / 1000,
    duration: playerState2.duration / 1000,
    volume: musicPlayerRef.current?.volume ?? preferences.music_volume,
    isShuffle: isShuffleOn,
    isRepeat: false,
    playlist,
    currentIndex,
  };

  // ========== MUSIC CONTROLS ==========

  const playMusic = useCallback(() => {
    const player = musicPlayerRef.current;

    if (!preferences.music_enabled) {
      return;
    }

    // If no player yet, set flag to auto-play when ready
    if (!player) {
      shouldAutoPlayRef.current = true;
      return;
    }

    try {
      player.play();
      setPlayerState2((prev) => ({ ...prev, isPlaying: true }));
    } catch (error) {
      console.error("[useWorkoutAudio] play() error:", error);
    }
  }, [preferences.music_enabled, currentTrack]);

  const pauseMusic = useCallback(() => {
    const player = musicPlayerRef.current;
    if (player) {
      player.pause();
      setPlayerState2((prev) => ({ ...prev, isPlaying: false }));
    }
  }, []);

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

    // Set flag to auto-play when new track loads
    shouldAutoPlayOnTrackChangeRef.current = true;
    setCurrentIndex(nextIndex);
    setPlayerState2((prev) => ({ ...prev, isPlaying: false }));
  }, [playlist, currentIndex, isShuffleOn]);

  const previousTrack = useCallback(() => {
    if (playlist.length === 0) return;

    const player = musicPlayerRef.current;
    // If more than 3 seconds in, restart current track
    if (player && playerState2.currentTime > 3) {
      player.seekTo(0);
      player.play(); // Ensure it plays
      setPlayerState2((prev) => ({ ...prev, isPlaying: true }));
      return;
    }

    // Set flag to auto-play when new track loads
    shouldAutoPlayOnTrackChangeRef.current = true;
    const prevIndex =
      currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    setPlayerState2((prev) => ({ ...prev, isPlaying: false }));
  }, [playlist, currentIndex, playerState2.currentTime]);

  const toggleShuffle = useCallback(() => {
    setIsShuffleOn((prev) => !prev);
    setPreferences((prev) => ({
      ...prev,
      shuffle_enabled: !prev.shuffle_enabled,
    }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    // Update player volume directly (no state update, no re-render)
    const player = musicPlayerRef.current;
    if (player) {
      player.volume = volume;
    }
    // Update ref for future player creations
    initialVolumeRef.current = volume;
    // Note: We don't update preferences state here to avoid re-renders during slider drag
    // The preferences.music_volume will be synced when updatePreferences is called
  }, []);

  const playTrack = useCallback(
    (track: WorkoutMusicTrack) => {
      const index = playlist.findIndex((t) => t.id === track.id);
      if (index !== -1) {
        // Set flag to auto-play when new track loads
        shouldAutoPlayOnTrackChangeRef.current = true;
        setCurrentIndex(index);
        setPlayerState2((prev) => ({ ...prev, isPlaying: false }));
      }
    },
    [playlist],
  );

  // Auto-play on mount if enabled, or when playlist becomes available
  useEffect(() => {
    // Auto-play if autoPlay option is set
    if (
      autoPlay &&
      preferences.music_enabled &&
      playlist.length > 0 &&
      isAudioReady
    ) {
      const timer = setTimeout(() => {
        playMusic();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, preferences.music_enabled, playlist.length, isAudioReady]);

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

  const stopDing = useCallback(() => {
    dingPlayer.pause();
  }, [dingPlayer]);

  // ========== COACH VOICE ==========

  const speakCoachPhrase = useCallback(
    (
      category: "ready" | "start" | "encouragement" | "rest" | "complete",
      customText?: string,
    ) => {
      if (!preferences.coach_voice_enabled) return;

      const text = customText || getRandomPhrase(category);

      Speech.speak(text, {
        rate: 0.9,
        pitch: 1.0,
        volume: preferences.coach_voice_volume,
      });
    },
    [preferences.coach_voice_enabled, preferences.coach_voice_volume],
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
    [preferences.coach_voice_enabled, preferences.coach_voice_volume],
  );

  const speakCountdown = useCallback(
    (number: number) => {
      if (!preferences.coach_voice_enabled) return;

      Speech.speak(String(number), {
        rate: 1.0,
        pitch: 1.0,
        volume: preferences.coach_voice_volume,
      });
    },
    [preferences.coach_voice_enabled, preferences.coach_voice_volume],
  );

  const stopSpeaking = useCallback(() => {
    Speech.stop();
  }, []);

  // ========== PREFERENCES ==========

  const updatePreferences = useCallback(
    (updates: Partial<UserAudioPreferences>) => {
      setPreferences((prev) => {
        const updated = { ...prev, ...updates };

        if (updates.music_volume !== undefined && musicPlayerRef.current) {
          musicPlayerRef.current.volume = updates.music_volume;
        }

        return updated;
      });
    },
    [],
  );

  // ========== CLEANUP ==========

  useEffect(() => {
    return () => {
      // Release player on unmount
      if (musicPlayerRef.current) {
        try {
          musicPlayerRef.current.release();
        } catch {
          // Player already released, ignore
        }
      }
      Speech.stop();
    };
  }, []);

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
    stopDing,

    // Coach Voice
    speakCoachPhrase,
    speakExerciseName,
    speakCountdown,
    stopSpeaking,

    // Preferences
    preferences,
    updatePreferences,
  };
}

export default useWorkoutAudio;
