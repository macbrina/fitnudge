import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Vibration } from "react-native";
import Video, { ResizeMode } from "react-native-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Speech from "expo-speech";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useGoalPlan, useChallengePlan } from "@/hooks/api/useActionablePlans";
import { useWorkoutTimer } from "@/hooks/useWorkoutTimer";
import { useWorkoutSession } from "@/hooks/useWorkoutSession";
import {
  ReadyCountdown,
  ExerciseCountdown,
  RestScreen,
  ExitConfirmationModal,
  QuitFeedback,
  LandscapeWorkoutView,
  MusicVoiceModal,
  CompletionFlow,
  WorkoutCompletingScreen
} from "./components";
import type { CompletedSessionResponse } from "@/services/api/workoutSessions";
import { workoutSessionsService } from "@/services/api/workoutSessions";
import { ExerciseDetailModal } from "@/components/exercises/ExerciseDetailModal";
import type { WorkoutExercise, WorkoutPlan, QuitReason } from "@/types/workout";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useWorkoutMusic } from "@/hooks/api/useWorkoutMusic";
import {
  useAudioPreferences,
  useUpdateAudioPreferences,
  useAudioPreferencesCache
} from "@/hooks/api/useAudioPreferences";

// Need to import StyleSheet for absoluteFillObject
import { StyleSheet as RNStyleSheet } from "react-native";

export function WorkoutPlayerScreen() {
  const router = useRouter();
  // Support both goal and challenge routes
  // Route: /workout/[goalId] OR /workout/challenge/[challengeId]
  const { goalId, challengeId, resume, restart } = useLocalSearchParams<{
    goalId?: string;
    challengeId?: string;
    resume?: string;
    restart?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { colors, brandColors } = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();

  // Determine if this is a challenge or goal workout
  const isChallenge = !!challengeId && !goalId;
  const entityId = goalId || challengeId || "";

  // Fetch the workout plan based on entity type
  const { data: goalPlanData, isLoading: goalPlanLoading } = useGoalPlan(goalId, !!goalId);
  const { data: challengePlanData, isLoading: challengePlanLoading } = useChallengePlan(
    challengeId,
    isChallenge
  );

  const planData = isChallenge ? challengePlanData : goalPlanData;
  const planLoading = isChallenge ? challengePlanLoading : goalPlanLoading;

  // Fetch workout music tracks
  const { data: musicTracks = [] } = useWorkoutMusic();

  // Workout session hook - pass isChallenge flag
  const {
    activeSession,
    canResume,
    resumePercentage,
    startSession,
    saveProgress,
    completeSession,
    submitFeedback
  } = useWorkoutSession(entityId, isChallenge);

  // Workout timer hook
  const {
    phase,
    currentExerciseIndex,
    currentSetIndex,
    currentRound,
    timeRemaining,
    totalTime,
    isPlaying,
    isPaused,
    showReadyCountdown,
    showExerciseCountdown,
    exercises,
    currentExercise,
    currentPhaseExercises,
    warmUpExercises,
    coolDownExercises,
    progress,
    maxSets,
    totalExercisesCount,
    overallExerciseIndex,
    exercisesRemaining,
    isCurrentExerciseTimed,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    skipToNext,
    skipToPrevious,
    jumpToExercise,
    completeWorkout,
    skipReadyCountdown,
    startExerciseAfterCountdown,
    restartCurrentExercise,
    markExerciseDone,
    extendRest,
    skipRest,
    resumeFromProgress,
    workoutStats,
    getNextExerciseInfo
  } = useWorkoutTimer(planData?.plan?.structured_data);

  // State for screens
  const [showExitModal, setShowExitModal] = useState(false);
  const [showQuitFeedback, setShowQuitFeedback] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);
  const [completionData, setCompletionData] = useState<CompletedSessionResponse | null>(null);

  // Track if user manually paused before opening modals
  const wasManuallyPausedRef = useRef(false);
  // Track if music was actually playing before opening modals
  const wasMusicPlayingRef = useRef(false);
  // Track original music volume before reducing for modals
  const originalMusicVolumeRef = useRef<number | null>(null);

  // Load audio preferences from backend (prefetched in PlanSection)
  const { data: savedAudioPrefs } = useAudioPreferences();
  const updateAudioPrefsMutation = useUpdateAudioPreferences();

  // Audio hook for music, sound effects, and coach voice
  const {
    currentTrack,
    isPlaying: isMusicPlaying,
    togglePlayPause: toggleMusicPlayPause,
    playMusic,
    pauseMusic,
    setVolume: setMusicVolume,
    nextTrack,
    previousTrack,
    toggleShuffle,
    preferences: audioPreferences,
    updatePreferences: updateAudioPreferences,
    playDing,
    stopDing,
    playlist: musicPlaylist,
    setPlaylist,
    playTrack: playMusicTrack,
    speakCountdown,
    speakCoachPhrase
  } = useWorkoutAudio({
    autoPlay: false,
    // Map API response to hook's expected format (handle null -> undefined)
    initialPreferences: savedAudioPrefs
      ? {
          ...savedAudioPrefs,
          preferred_music_app: savedAudioPrefs.preferred_music_app ?? undefined,
          last_played_track_id: savedAudioPrefs.last_played_track_id ?? undefined
        }
      : undefined
  });

  // Track if we should auto-play music when playlist becomes available
  const shouldAutoPlayMusicRef = useRef(false);

  // Set playlist when music tracks load
  useEffect(() => {
    if (musicTracks.length > 0 && musicPlaylist.length === 0) {
      setPlaylist(musicTracks);
    }
  }, [musicTracks, musicPlaylist.length, setPlaylist]);

  // Auto-play music when playlist becomes available and we wanted to play
  useEffect(() => {
    if (
      shouldAutoPlayMusicRef.current &&
      musicPlaylist.length > 0 &&
      audioPreferences.music_enabled &&
      hasStarted
    ) {
      shouldAutoPlayMusicRef.current = false;
      playMusic();
    }
  }, [musicPlaylist.length, audioPreferences.music_enabled, hasStarted, playMusic]);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Toggle landscape mode
  const toggleLandscape = useCallback(async () => {
    try {
      if (isLandscape) {
        // Switch back to portrait
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsLandscape(false);
      } else {
        // Switch to landscape - use LANDSCAPE to allow both directions
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsLandscape(true);
      }
    } catch (error) {
      // Still toggle the UI even if orientation fails
      setIsLandscape(!isLandscape);
    }
  }, [isLandscape]);

  // Reset orientation when leaving screen
  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // Track last spoken countdown number to avoid repeating
  const lastSpokenCountdownRef = useRef<number | null>(null);

  // Countdown speech effect - speak 5, 4, 3, 2, 1 during timed exercises
  useEffect(() => {
    // Only speak during active timed exercises (not rest, not ready countdown, not exercise countdown)
    if (
      !isPlaying ||
      isPaused ||
      showReadyCountdown ||
      showExerciseCountdown ||
      phase === "rest" ||
      phase === "completed" ||
      !isCurrentExerciseTimed
    ) {
      // Reset last spoken when not in countdown range
      if (timeRemaining > 5) {
        lastSpokenCountdownRef.current = null;
      }
      return;
    }

    // Speak countdown from 5 to 1
    if (timeRemaining >= 1 && timeRemaining <= 5) {
      // Only speak if we haven't spoken this number yet
      if (lastSpokenCountdownRef.current !== timeRemaining) {
        lastSpokenCountdownRef.current = timeRemaining;
        speakCountdown(timeRemaining);
      }
    }
  }, [
    timeRemaining,
    isPlaying,
    isPaused,
    showReadyCountdown,
    showExerciseCountdown,
    phase,
    isCurrentExerciseTimed,
    speakCountdown
  ]);

  // Track previous phase to detect transition to rest
  const prevPhaseRef = useRef<string | null>(null);

  // Play ding and speak "Next {duration} {name}" when transitioning to rest phase
  useEffect(() => {
    // Check if we just transitioned to rest phase
    if (phase === "rest" && prevPhaseRef.current !== "rest" && prevPhaseRef.current !== null) {
      // Play ding sound when entering rest
      playDing();

      // Small delay after ding, then stop ding before speaking to avoid audio conflict
      setTimeout(() => {
        // Stop the ding sound to free up audio session for speech
        stopDing();

        // Get the next exercise info for speech
        const nextInfo = getNextExerciseInfo();
        if (nextInfo?.exercise) {
          const duration = (() => {
            const ex = nextInfo.exercise;
            if ("duration_seconds" in ex && ex.duration_seconds) {
              return `${ex.duration_seconds} seconds`;
            }
            if ("work_duration_seconds" in ex && ex.work_duration_seconds) {
              return `${ex.work_duration_seconds} seconds`;
            }
            if ("reps" in ex && ex.reps) {
              return `${ex.reps} reps`;
            }
            return "";
          })();
          const speechText = duration
            ? `Next, ${duration}, ${nextInfo.exercise.name}`
            : `Next, ${nextInfo.exercise.name}`;
          speakCoachPhrase("rest", speechText);
        } else {
          speakCoachPhrase("rest", "Take a rest");
        }
      }, 700); // Allow ding to play fully before stopping and starting speech
    }
    prevPhaseRef.current = phase;
  }, [phase, speakCoachPhrase, getNextExerciseInfo, playDing, stopDing]);

  // Combined list of all exercises for the exercise list modal
  const allExercisesForList = useMemo(() => {
    return [...warmUpExercises, ...exercises, ...coolDownExercises];
  }, [warmUpExercises, exercises, coolDownExercises]);

  // Handle jumping to a specific exercise from the exercise list modal
  const handleJumpToExercise = useCallback(
    (globalIndex: number) => {
      // Jump to the selected exercise using the global index
      jumpToExercise(globalIndex);

      // Save progress after jump
      if (sessionId) {
        saveProgress({
          sessionId,
          data: {
            current_phase: phase,
            current_exercise_index: currentExerciseIndex,
            current_set: currentSetIndex + 1,
            current_round: currentRound,
            completion_percentage: progress,
            exercises_completed: globalIndex,
            sets_completed: globalIndex,
            paused_duration_seconds: workoutStats.pausedDurationSeconds
          }
        }).catch((error) => console.error("Failed to save progress:", error));
      }
    },
    [
      jumpToExercise,
      saveProgress,
      sessionId,
      phase,
      currentExerciseIndex,
      currentSetIndex,
      currentRound,
      progress,
      workoutStats.pausedDurationSeconds
    ]
  );

  // Handle workout start
  const handleStartWorkout = useCallback(async () => {
    if (hasStarted) return; // Prevent double-start
    setHasStarted(true);
    startWorkout();

    // Start music if enabled and playlist is ready
    if (audioPreferences.music_enabled) {
      if (musicPlaylist.length > 0) {
        playMusic();
      } else {
        // Playlist not ready yet, set flag to auto-play when it becomes available
        shouldAutoPlayMusicRef.current = true;
      }
    }

    // Start fade animation IMMEDIATELY - don't wait for session creation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200, // Faster animation
      useNativeDriver: true
    }).start();

    // Start session in backend (fire and forget - don't block UI)
    const totalExercises = warmUpExercises.length + exercises.length + coolDownExercises.length;
    // Total sets includes warmup, workout (with rounds), and cooldown
    const warmupSets = warmUpExercises.length;
    const workoutSets = exercises.reduce((sum, ex) => sum + (ex.sets || 3), 0);
    const cooldownSets = coolDownExercises.length;
    const totalSetsCount = warmupSets + workoutSets + cooldownSets;

    startSession({
      goal_id: isChallenge ? undefined : entityId,
      challenge_id: isChallenge ? entityId : undefined,
      plan_id: planData?.plan?.id,
      exercises_total: totalExercises,
      sets_total: totalSetsCount
    })
      .then((session) => setSessionId(session.id))
      .catch((error) => console.error("Failed to start session:", error));
  }, [
    hasStarted,
    startWorkout,
    fadeAnim,
    startSession,
    entityId,
    isChallenge,
    planData,
    warmUpExercises,
    exercises,
    coolDownExercises,
    audioPreferences.music_enabled,
    musicPlaylist.length,
    playMusic
  ]);

  // Handle resume from saved progress
  const handleResumeWorkout = useCallback(async () => {
    if (activeSession?.session) {
      const saved = activeSession.session;
      setSessionId(saved.id);
      setHasStarted(true);

      resumeFromProgress({
        phase: saved.current_phase,
        currentExerciseIndex: saved.current_exercise_index,
        currentSet: saved.current_set,
        currentRound: saved.current_round
      });

      // Start music if enabled and playlist is ready
      if (audioPreferences.music_enabled) {
        if (musicPlaylist.length > 0) {
          playMusic();
        } else {
          // Playlist not ready yet, set flag to auto-play when it becomes available
          shouldAutoPlayMusicRef.current = true;
        }
      }

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [
    activeSession,
    resumeFromProgress,
    fadeAnim,
    audioPreferences.music_enabled,
    musicPlaylist.length,
    playMusic
  ]);

  // Handle close/exit - show exit confirmation (auto-pause like modals)
  const handleClose = useCallback(() => {
    if (phase === "completed") {
      router.back();
      return;
    }

    // If workout hasn't started yet OR still in ready countdown, just go back
    // No need to show exit modal since exercise hasn't actually started
    if (!hasStarted || showReadyCountdown) {
      router.back();
      return;
    }

    // Remember if user manually paused before opening
    wasManuallyPausedRef.current = isPaused;
    wasMusicPlayingRef.current = isMusicPlaying; // Track if music was playing

    // Auto-pause if not already paused
    if (!isPaused) {
      pauseWorkout();
    }

    // Pause music and reduce volume (only if playing)
    if (isMusicPlaying) {
      pauseMusic();
      originalMusicVolumeRef.current = audioPreferences.music_volume;
      setMusicVolume(audioPreferences.music_volume * 0.3);
    }

    setShowExitModal(true);
  }, [
    phase,
    hasStarted,
    showReadyCountdown,
    isPaused,
    pauseWorkout,
    pauseMusic,
    isMusicPlaying,
    audioPreferences.music_volume,
    setMusicVolume,
    router
  ]);

  // Handle resume from exit modal (restore state like closing a modal)
  const handleResume = useCallback(() => {
    setShowExitModal(false);

    // Restore original music volume
    if (originalMusicVolumeRef.current !== null) {
      setMusicVolume(originalMusicVolumeRef.current);
      originalMusicVolumeRef.current = null;
    }

    // Only resume workout if user didn't manually pause before opening modal
    if (!wasManuallyPausedRef.current) {
      resumeWorkout();
    }

    // Only resume music if it was actually playing before
    if (wasMusicPlayingRef.current) {
      playMusic();
    }
  }, [resumeWorkout, playMusic, setMusicVolume]);

  // Handle restart from exit modal - restarts CURRENT exercise, not from beginning
  const handleRestart = useCallback(() => {
    setShowExitModal(false);

    // Restore original music volume
    if (originalMusicVolumeRef.current !== null) {
      setMusicVolume(originalMusicVolumeRef.current);
      originalMusicVolumeRef.current = null;
    }

    // Restart current exercise with 3-2-1 countdown (not ReadyCountdown)
    restartCurrentExercise();

    // Resume music only if it was playing before
    if (wasMusicPlayingRef.current) {
      playMusic();
    }
  }, [restartCurrentExercise, setMusicVolume, playMusic]);

  // Handle skip rest - stop any ongoing speech first
  const handleSkipRest = useCallback(() => {
    Speech.stop(); // Stop "Next 30 seconds..." announcement
    skipRest();
  }, [skipRest]);

  // Handle extend rest - this doesn't need to stop speech as we're just adding time
  // but let's wrap it for consistency

  // Handle jump to exercise from rest screen - stop speech first
  const handleJumpFromRest = useCallback(
    (index: number) => {
      Speech.stop(); // Stop any ongoing speech
      handleJumpToExercise(index);
    },
    [handleJumpToExercise]
  );

  // Handle next exercise - save progress for crash protection
  const handleNext = useCallback(() => {
    // Save current progress before navigating
    if (sessionId) {
      saveProgress({
        sessionId,
        data: {
          current_phase: phase,
          current_exercise_index: currentExerciseIndex,
          current_set: currentSetIndex + 1,
          current_round: currentRound,
          completion_percentage: progress,
          exercises_completed: workoutStats.exercisesCompleted,
          sets_completed: workoutStats.setsCompleted,
          paused_duration_seconds: workoutStats.pausedDurationSeconds
        }
      }).catch((error) => console.error("Failed to save progress on next:", error));
    }
    skipToNext();
  }, [
    sessionId,
    saveProgress,
    phase,
    currentExerciseIndex,
    currentSetIndex,
    currentRound,
    progress,
    workoutStats,
    skipToNext
  ]);

  // Handle previous exercise - save progress for crash protection
  const handlePrevious = useCallback(() => {
    // Save current progress before navigating
    if (sessionId) {
      saveProgress({
        sessionId,
        data: {
          current_phase: phase,
          current_exercise_index: currentExerciseIndex,
          current_set: currentSetIndex + 1,
          current_round: currentRound,
          completion_percentage: progress,
          exercises_completed: workoutStats.exercisesCompleted,
          sets_completed: workoutStats.setsCompleted,
          paused_duration_seconds: workoutStats.pausedDurationSeconds
        }
      }).catch((error) => console.error("Failed to save progress on prev:", error));
    }
    skipToPrevious();
  }, [
    sessionId,
    saveProgress,
    phase,
    currentExerciseIndex,
    currentSetIndex,
    currentRound,
    progress,
    workoutStats,
    skipToPrevious
  ]);

  // Handle quit - show feedback screen (progress saved there when user confirms)
  const handleQuit = useCallback(() => {
    setShowExitModal(false);
    setShowQuitFeedback(true);
  }, []);

  // Handle feedback submission - fire and forget, go back immediately
  // The feedback endpoint also saves progress, so no need to call saveProgress separately
  const handleSubmitFeedback = useCallback(
    (reason: QuitReason) => {
      // Save full progress in background (fire and forget)
      if (sessionId) {
        saveProgress({
          sessionId,
          data: {
            current_phase: phase,
            current_exercise_index: currentExerciseIndex,
            current_set: currentSetIndex + 1, // API expects 1-indexed
            current_round: currentRound,
            completion_percentage: progress,
            exercises_completed: workoutStats.exercisesCompleted,
            sets_completed: workoutStats.setsCompleted,
            paused_duration_seconds: workoutStats.pausedDurationSeconds
          }
        }).catch((error) => console.error("Failed to save progress:", error));
      }

      // Submit feedback in background (fire and forget)
      submitFeedback({
        session_id: sessionId || undefined,
        goal_id: isChallenge ? undefined : entityId,
        challenge_id: isChallenge ? entityId : undefined,
        plan_id: planData?.plan?.id,
        quit_reason: reason,
        exercises_completed: workoutStats.exercisesCompleted,
        completion_percentage: progress,
        time_spent_seconds: workoutStats.totalDurationSeconds,
        current_exercise_name: currentExercise?.name
      }).catch((error) => console.error("Failed to submit feedback:", error));

      // Go back immediately without waiting
      router.back();
    },
    [
      submitFeedback,
      saveProgress,
      sessionId,
      entityId,
      isChallenge,
      planData,
      workoutStats,
      progress,
      router,
      phase,
      currentExerciseIndex,
      currentSetIndex,
      currentRound,
      currentExercise
    ]
  );

  // Handle quit without feedback - save progress in background and exit immediately
  const handleQuitWithoutFeedback = useCallback(() => {
    // Save progress in background (fire and forget)
    if (sessionId) {
      saveProgress({
        sessionId,
        data: {
          current_phase: phase,
          current_exercise_index: currentExerciseIndex,
          current_set: currentSetIndex + 1, // API expects 1-indexed
          current_round: currentRound,
          completion_percentage: progress,
          exercises_completed: workoutStats.exercisesCompleted,
          sets_completed: workoutStats.setsCompleted,
          paused_duration_seconds: workoutStats.pausedDurationSeconds
        }
      }).catch((error) => console.error("Failed to save progress:", error));
    }

    // Go back immediately without waiting
    router.back();
  }, [
    router,
    sessionId,
    saveProgress,
    phase,
    currentExerciseIndex,
    currentSetIndex,
    currentRound,
    progress,
    workoutStats
  ]);

  // Handle resume from feedback screen
  const handleResumeFromFeedback = useCallback(() => {
    setShowQuitFeedback(false);
    setShowExitModal(false);

    // Restore original music volume
    if (originalMusicVolumeRef.current !== null) {
      setMusicVolume(originalMusicVolumeRef.current);
      originalMusicVolumeRef.current = null;
    }

    // Only resume workout if user didn't manually pause before opening modal
    if (!wasManuallyPausedRef.current) {
      resumeWorkout();
    }

    // Only resume music if it was actually playing before
    if (wasMusicPlayingRef.current) {
      playMusic();
    }
  }, [resumeWorkout, playMusic, setMusicVolume]);

  // ========== MUSIC SYNC WITH WORKOUT ==========

  // Sync music with workout play/pause
  const handleWorkoutPlayPause = useCallback(() => {
    if (isPaused) {
      // Resume workout and music
      resumeWorkout();
      if (audioPreferences.music_enabled) {
        playMusic();
      }
    } else {
      // Pause workout and music
      pauseWorkout();
      pauseMusic();
    }
  }, [
    isPaused,
    resumeWorkout,
    pauseWorkout,
    playMusic,
    pauseMusic,
    audioPreferences.music_enabled
  ]);

  // ========== MODAL AUTO-PAUSE HANDLERS ==========

  // Open music modal - auto pause if not already paused
  const handleOpenMusicModal = useCallback(() => {
    wasManuallyPausedRef.current = isPaused;
    wasMusicPlayingRef.current = isMusicPlaying; // Track if music was actually playing

    if (!isPaused) {
      pauseWorkout();
    }

    // Reduce music volume without reflecting on slider (only if music is playing)
    if (isMusicPlaying) {
      originalMusicVolumeRef.current = audioPreferences.music_volume;
      setMusicVolume(audioPreferences.music_volume * 0.3); // Reduce to 30%
    }

    setShowMusicModal(true);
  }, [isPaused, pauseWorkout, isMusicPlaying, audioPreferences.music_volume, setMusicVolume]);

  // Close music modal - restore state
  const handleCloseMusicModal = useCallback(() => {
    setShowMusicModal(false);

    // Restore original music volume (only if we reduced it)
    if (originalMusicVolumeRef.current !== null) {
      setMusicVolume(originalMusicVolumeRef.current);
      originalMusicVolumeRef.current = null;
    }

    // Only resume workout if user didn't manually pause before opening modal
    if (!wasManuallyPausedRef.current) {
      resumeWorkout();
    }

    // Only resume music if it was actually playing before opening modal
    if (wasMusicPlayingRef.current) {
      playMusic();
    }
  }, [resumeWorkout, playMusic, setMusicVolume]);

  // Open exercise detail modal - auto pause if not already paused
  const handleOpenExerciseDetail = useCallback(() => {
    wasManuallyPausedRef.current = isPaused;
    wasMusicPlayingRef.current = isMusicPlaying; // Track if music was playing

    if (!isPaused) {
      pauseWorkout();
    }

    // Reduce music volume (only if playing)
    if (isMusicPlaying) {
      originalMusicVolumeRef.current = audioPreferences.music_volume;
      setMusicVolume(audioPreferences.music_volume * 0.3); // Reduce to 30%
    }

    setShowExerciseDetail(true);
  }, [isPaused, pauseWorkout, isMusicPlaying, audioPreferences.music_volume, setMusicVolume]);

  // Close exercise detail modal - restore state
  const handleCloseExerciseDetail = useCallback(() => {
    setShowExerciseDetail(false);

    // Restore original music volume
    if (originalMusicVolumeRef.current !== null) {
      setMusicVolume(originalMusicVolumeRef.current);
      originalMusicVolumeRef.current = null;
    }

    // Only resume workout if user didn't manually pause before opening modal
    if (!wasManuallyPausedRef.current) {
      resumeWorkout();
    }

    // Only resume music if it was actually playing before
    if (wasMusicPlayingRef.current) {
      playMusic();
    }
  }, [resumeWorkout, playMusic, setMusicVolume]);

  // Handle audio preferences update (local only - for immediate UI feedback)
  const handleUpdateAudioPreferencesLocal = useCallback(
    (updates: Parameters<typeof updateAudioPreferences>[0]) => {
      // Update local state immediately (no backend call)
      updateAudioPreferences(updates);
    },
    [updateAudioPreferences]
  );

  // Save audio preferences to backend (called when Done is clicked)
  const handleSaveAudioPreferencesToBackend = useCallback(() => {
    // Save current preferences to backend (fire and forget)
    updateAudioPrefsMutation.mutate(audioPreferences);
  }, [updateAudioPrefsMutation, audioPreferences]);

  // Handle workout completion
  const handleWorkoutComplete = useCallback(async () => {
    if (sessionId) {
      try {
        // completeSession returns CompletedSessionResponse directly (unwrapped by mutateAsync)
        const completionResult = await completeSession({
          sessionId,
          data: {
            exercises_completed: workoutStats.exercisesCompleted,
            exercises_skipped: workoutStats.exercisesSkipped,
            sets_completed: workoutStats.setsCompleted,
            paused_duration_seconds: workoutStats.pausedDurationSeconds
          }
        });

        // Store completion data for CompletionFlow
        if (completionResult) {
          setCompletionData(completionResult);
        }
      } catch (error) {
        console.error("Failed to complete session:", error);
        // Still show completion flow with basic data even if API fails
        setCompletionData({
          session: {} as any,
          achievements_unlocked: [],
          streak: {
            current_streak: 0,
            longest_streak: 0,
            milestone_target: 7,
            days_until_milestone: 7,
            workout_dates_this_week: []
          },
          workout_number_today: 1,
          is_practice: false,
          can_add_reflection: false // Don't show reflection if API failed
        });
      }
    }
  }, [sessionId, completeSession, workoutStats]);

  // When phase becomes completed, handle it
  useEffect(() => {
    if (phase === "completed" && sessionId) {
      handleWorkoutComplete();
    }
  }, [phase, sessionId, handleWorkoutComplete]);

  // Vibrate on phase changes
  useEffect(() => {
    if (phase === "rest") {
      Vibration.vibrate(200);
    } else if (phase === "completed") {
      Vibration.vibrate([0, 200, 100, 200, 100, 400]);
    }
  }, [phase]);

  // Track previous showReadyCountdown value to detect when countdown ends
  const prevShowReadyCountdownRef = useRef(showReadyCountdown);

  // Save initial progress and play ding when ready countdown ends (user enters first exercise)
  useEffect(() => {
    // Detect transition from showReadyCountdown=true to showReadyCountdown=false
    const wasShowingCountdown = prevShowReadyCountdownRef.current;
    prevShowReadyCountdownRef.current = showReadyCountdown;

    if (wasShowingCountdown && !showReadyCountdown) {
      // Countdown just ended, user is now on first exercise - play ding!
      playDing();

      // Save initial progress if we have a session
      if (!sessionId) return;
      saveProgress({
        sessionId,
        data: {
          current_phase: phase,
          current_exercise_index: currentExerciseIndex,
          current_set: currentSetIndex + 1,
          current_round: currentRound,
          completion_percentage: progress,
          exercises_completed: 0,
          sets_completed: 0,
          paused_duration_seconds: 0
        }
      }).catch((error) => console.error("Failed to save initial progress:", error));
    }
  }, [
    showReadyCountdown,
    sessionId,
    saveProgress,
    phase,
    currentExerciseIndex,
    currentSetIndex,
    currentRound,
    progress,
    playDing
  ]);

  // Auto-start or auto-resume when plan loads
  useEffect(() => {
    if (planLoading || !planData?.plan || hasStarted) return;
    if (showQuitFeedback || showExitModal) return;

    // If restart=true, reset the existing session's progress and start fresh
    if (restart === "true" && activeSession?.session) {
      // Reset progress on existing session (fire and forget)
      saveProgress({
        sessionId: activeSession.session.id,
        data: {
          current_phase: "warmup",
          current_exercise_index: 0,
          current_set: 1,
          current_round: 1,
          completion_percentage: 0,
          exercises_completed: 0,
          sets_completed: 0,
          paused_duration_seconds: 0
        }
      }).catch((error) => console.error("Failed to reset progress:", error));

      // Use the existing session but start workout from beginning
      setSessionId(activeSession.session.id);
      setHasStarted(true);
      startWorkout(); // This starts from the beginning

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      }).start();
      return;
    }

    // If there's an existing session to resume, always use it
    // This prevents creating duplicate sessions
    if (canResume && activeSession?.session) {
      handleResumeWorkout();
      return;
    }

    // Only start fresh if there's no existing session
    handleStartWorkout();
  }, [
    planLoading,
    planData,
    canResume,
    hasStarted,
    activeSession,
    showQuitFeedback,
    showExitModal,
    handleResumeWorkout,
    handleStartWorkout,
    restart,
    saveProgress,
    startWorkout,
    fadeAnim
  ]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Loading state
  if (planLoading || !planData?.plan) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={brandColors.primary} />
        <Text style={styles.loadingText}>{t("workout.loading")}</Text>
      </SafeAreaView>
    );
  }

  // Completion screen
  if (phase === "completed" && completionData) {
    // Calculate day number (could be enhanced with actual program day tracking)
    const dayNumber = completionData.workout_number_today || 1;

    return (
      <CompletionFlow
        stats={workoutStats}
        completionData={{
          achievements_unlocked: completionData.achievements_unlocked || [],
          streak: completionData.streak || {
            current_streak: 0,
            longest_streak: 0,
            milestone_target: 7,
            days_until_milestone: 7,
            workout_dates_this_week: []
          },
          workout_number_today: completionData.workout_number_today || 1,
          is_practice: completionData.is_practice || false,
          can_add_reflection: completionData.can_add_reflection || false
        }}
        dayNumber={dayNumber}
        onComplete={(feedback) => {
          // Update feedback if provided
          if (feedback && sessionId) {
            workoutSessionsService.updateFeedback(sessionId, feedback).catch(console.error);
          }
          router.back();
        }}
        onSaveReflection={(data) => {
          // Save reflection data (mood, notes, photo) to the check-in
          // Returns a promise that CompletionFlow handles in background
          return workoutSessionsService.saveReflection({
            goal_id: isChallenge ? undefined : entityId,
            challenge_id: isChallenge ? entityId : undefined,
            mood: data.mood,
            notes: data.notes,
            photo_url: data.photo_url
          });
        }}
      />
    );
  }

  // Waiting for completion data to load - show fun animated screen
  if (phase === "completed" && !completionData) {
    return <WorkoutCompletingScreen />;
  }

  // Get current exercise for display (even during ready countdown)
  // When resuming, currentExercise is already set to the resumed position
  const displayExercise = showReadyCountdown
    ? currentExercise || (warmUpExercises.length > 0 ? warmUpExercises[0] : exercises[0])
    : currentExercise;

  // Get next exercise name for header
  const getNextExerciseNameForHeader = () => {
    if (showReadyCountdown) {
      if (warmUpExercises.length > 1) return warmUpExercises[1]?.name;
      if (warmUpExercises.length === 1 && exercises.length > 0) return exercises[0]?.name;
      if (exercises.length > 1) return exercises[1]?.name;
      return null;
    }
    return exercises[currentExerciseIndex + 1]?.name || null;
  };

  // Get MP4 URL for display exercise (Cloudflare CDN URLs stored in database)
  const displayMp4Url = (() => {
    if (!displayExercise) return null;

    // Check for mp4_url directly on the exercise
    if ("mp4_url" in displayExercise && displayExercise.mp4_url) {
      return displayExercise.mp4_url;
    }
    // Fallback to demo.mp4_url
    if ("demo" in displayExercise && displayExercise.demo?.mp4_url) {
      return displayExercise.demo.mp4_url;
    }

    return null;
  })();

  // Landscape mode view (note: completed phase returns early above)
  if (isLandscape && phase !== "rest" && !showReadyCountdown) {
    return (
      <LandscapeWorkoutView
        exerciseName={currentExercise?.name || ""}
        exerciseNumber={overallExerciseIndex + 1}
        totalExercises={totalExercisesCount}
        mp4Url={displayMp4Url}
        timeRemaining={timeRemaining}
        isPlaying={isPlaying}
        isPaused={isPaused}
        isTimed={isCurrentExerciseTimed}
        totalExercisesCount={totalExercisesCount}
        overallExerciseIndex={overallExerciseIndex}
        onTogglePause={isPaused ? resumeWorkout : pauseWorkout}
        onSkipNext={handleNext}
        onMarkDone={markExerciseDone}
        onExitLandscape={toggleLandscape}
      />
    );
  }

  // Rest Screen (Blue Theme)
  if (phase === "rest") {
    const nextInfo = getNextExerciseInfo();
    const nextExercise = nextInfo?.exercise || null;

    // Calculate the 0-based global index for highlighting in modal
    const nextGlobalIndex = nextInfo
      ? nextInfo.phase === "warmup"
        ? nextInfo.exerciseIndex
        : nextInfo.phase === "workout"
          ? warmUpExercises.length +
            ((nextInfo.round || currentRound) - 1) * exercises.length +
            nextInfo.exerciseIndex
          : warmUpExercises.length + exercises.length * maxSets + nextInfo.exerciseIndex
      : overallExerciseIndex;

    // 1-based display index for "NEXT X/Y" label
    const nextDisplayIndex = nextGlobalIndex + 1;

    return (
      <View style={styles.restContainer}>
        <RestScreen
          timeRemaining={timeRemaining}
          nextExerciseIndex={nextDisplayIndex}
          nextExerciseGlobalIndex={nextGlobalIndex}
          totalExercises={totalExercisesCount}
          nextExercise={nextExercise}
          allExercises={allExercisesForList}
          onExtendRest={extendRest}
          onSkipRest={handleSkipRest}
          onJumpToExercise={handleJumpFromRest}
          onPauseTimer={pauseWorkout}
          onResumeTimer={resumeWorkout}
        />
        {/* Exit confirmation modal */}
        <ExitConfirmationModal
          visible={showExitModal}
          completionPercentage={progress}
          exercisesRemaining={exercisesRemaining}
          onResume={handleResume}
          onRestart={handleRestart}
          onQuit={handleQuit}
        />
        {/* Quit Feedback Overlay */}
        <QuitFeedback
          visible={showQuitFeedback}
          exercisesCompleted={workoutStats.exercisesCompleted}
          totalExercises={totalExercisesCount}
          timeSpent={formatTime(workoutStats.totalDurationSeconds)}
          onResume={handleResumeFromFeedback}
          onSubmitFeedback={handleSubmitFeedback}
          onQuitWithoutFeedback={handleQuitWithoutFeedback}
        />
      </View>
    );
  }

  const nextExerciseName = getNextExerciseNameForHeader();

  // Active Workout Screen (IMG_9567 design)
  return (
    <View style={styles.container}>
      <Animated.View style={[styles.workoutContainer, { opacity: fadeAnim }]}>
        {/* Progress bar (segmented) - shows all exercises across phases */}
        <View style={[styles.progressBarContainer, { marginTop: insets.top }]}>
          {Array.from({ length: totalExercisesCount }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressSegment,
                index < overallExerciseIndex && styles.progressSegmentComplete,
                index === overallExerciseIndex && styles.progressSegmentActive
              ]}
            />
          ))}
        </View>

        {/* Header */}
        <View style={styles.workoutHeader}>
          {!showReadyCountdown && (
            <TouchableOpacity onPress={handleClose} style={styles.closeButtonCircle}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.currentExerciseName} numberOfLines={1}>
              {displayExercise?.name || ""}
            </Text>
            {nextExerciseName && (
              <Text style={styles.nextExerciseLabel}>
                {t("workout.next_label", "Next")}: {nextExerciseName}
              </Text>
            )}
          </View>
          {/* Empty spacer to balance header */}
          <View style={styles.headerRight} />
        </View>

        {/* Side controls (expand, music) - hidden during ready countdown */}
        {!showReadyCountdown && (
          <View style={styles.sideControls}>
            <TouchableOpacity style={styles.sideIconButton} onPress={toggleLandscape}>
              <Ionicons name="expand" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sideIconButton} onPress={handleOpenMusicModal}>
              <Ionicons name="musical-note" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Video Display */}
        <View style={styles.videoContainer}>
          {displayMp4Url ? (
            <Video
              source={{ uri: displayMp4Url }}
              style={styles.exerciseVideo}
              resizeMode={ResizeMode.CONTAIN}
              repeat={true}
              rate={0.75}
              muted={true}
              paused={isPaused || showReadyCountdown}
              controls={false}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Ionicons name="fitness" size={80} color={colors.text.tertiary} />
            </View>
          )}
          {isPaused && !showReadyCountdown && (
            <View style={styles.pauseIconContainer}>
              <Ionicons name="pause" size={60} color="white" />
            </View>
          )}

          {/* 3-2-1 Exercise Countdown - shows over the GIF */}
          <ExerciseCountdown
            visible={showExerciseCountdown}
            onComplete={startExerciseAfterCountdown}
            coachVoiceEnabled={audioPreferences.coach_voice_enabled}
            isPaused={isPaused}
          />
        </View>

        {/* Bottom panel (black background) - hidden during ready countdown */}
        {!showReadyCountdown && (
          <View
            style={[styles.bottomPanel, { paddingBottom: insets.bottom + toRN(tokens.spacing[4]) }]}
          >
            {/* Phase label */}
            <Text style={styles.phaseLabel}>
              {phase === "warmup" && t("workout.phase.warm_up", "WARM UP")}
              {phase === "workout" && t("workout.phase.work", "WORKOUT")}
              {phase === "cooldown" && t("workout.phase.cool_down", "COOL DOWN")}
            </Text>

            {/* Exercise name with help */}
            <View style={styles.exerciseNameRow}>
              <Text style={styles.bottomExerciseName} numberOfLines={2}>
                {currentExercise?.name || ""}
              </Text>
              <TouchableOpacity style={styles.helpIcon} onPress={handleOpenExerciseDetail}>
                <Ionicons name="help-circle-outline" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Round/Set indicator */}
            {phase === "workout" && (
              <Text style={styles.roundLabel}>
                {t("workout.round_of", "Round {{current}}/{{total}}", {
                  current: currentRound,
                  total: maxSets
                })}
              </Text>
            )}

            {/* Timer or Done button */}
            {isCurrentExerciseTimed ? (
              <View style={styles.timerDisplay}>
                <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              </View>
            ) : (
              <View style={styles.repDisplay}>
                <Text style={styles.repText}>
                  {t("workout.do_reps", "Do {{count}} reps", {
                    count: (currentExercise as WorkoutExercise)?.reps || 10
                  })}
                </Text>
                <TouchableOpacity style={styles.doneButton} onPress={markExerciseDone}>
                  <Text style={styles.doneButtonText}>{t("workout.done", "Done")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Controls */}
            <View style={styles.controlsContainer}>
              {/* Previous button - hidden when at first exercise */}
              {overallExerciseIndex > 0 ? (
                <TouchableOpacity style={styles.navButton} onPress={handlePrevious}>
                  <Ionicons name="play-skip-back" size={28} color="white" />
                </TouchableOpacity>
              ) : (
                <View style={styles.navButtonPlaceholder} />
              )}

              <TouchableOpacity style={styles.pauseButton} onPress={handleWorkoutPlayPause}>
                <Ionicons name={isPaused ? "play" : "pause"} size={32} color="white" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.navButton} onPress={handleNext}>
                <Ionicons name="play-skip-forward" size={28} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Ready Countdown Overlay - Full screen overlay during countdown */}
      {showReadyCountdown && (
        <ReadyCountdown
          timeRemaining={timeRemaining}
          exerciseNumber={overallExerciseIndex + 1}
          totalExercises={totalExercisesCount}
          exerciseName={displayExercise?.name || t("workout.get_ready")}
          onSkip={skipReadyCountdown}
          onClose={handleClose}
        />
      )}

      {/* Exit confirmation modal */}
      <ExitConfirmationModal
        visible={showExitModal}
        completionPercentage={progress}
        exercisesRemaining={exercisesRemaining}
        onResume={handleResume}
        onRestart={handleRestart}
        onQuit={handleQuit}
      />

      {/* Quit Feedback Overlay */}
      <QuitFeedback
        visible={showQuitFeedback}
        exercisesCompleted={workoutStats.exercisesCompleted}
        totalExercises={totalExercisesCount}
        timeSpent={formatTime(workoutStats.totalDurationSeconds)}
        onResume={handleResumeFromFeedback}
        onSubmitFeedback={handleSubmitFeedback}
        onQuitWithoutFeedback={handleQuitWithoutFeedback}
      />

      {/* Music & Voice Modal */}
      <MusicVoiceModal
        visible={showMusicModal}
        onClose={handleCloseMusicModal}
        currentTrack={currentTrack}
        isPlaying={isMusicPlaying}
        onPlayPause={toggleMusicPlayPause}
        onPrevious={previousTrack}
        onNext={nextTrack}
        onShuffle={toggleShuffle}
        isShuffleOn={audioPreferences.shuffle_enabled}
        preferences={audioPreferences}
        onUpdatePreferences={handleUpdateAudioPreferencesLocal}
        onSavePreferences={handleSaveAudioPreferencesToBackend}
        tracks={musicPlaylist}
        onSelectTrack={playMusicTrack}
      />

      {/* Exercise Detail Modal */}
      <ExerciseDetailModal
        visible={showExerciseDetail}
        exerciseId={currentExercise?.exercise_id}
        exerciseData={currentExercise}
        onClose={handleCloseExerciseDetail}
      />
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  restContainer: {
    flex: 1,
    backgroundColor: "#007AFF"
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.canvas
  },
  loadingText: {
    marginTop: toRN(tokens.spacing[4]),
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },

  // Active Workout
  workoutContainer: {
    flex: 1
  },

  // Progress bar
  progressBarContainer: {
    flexDirection: "row" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[2]),
    gap: toRN(4)
  },
  progressSegment: {
    flex: 1,
    height: toRN(4),
    backgroundColor: colors.border.subtle,
    borderRadius: toRN(2)
  },
  progressSegmentComplete: {
    backgroundColor: brand.primary
  },
  progressSegmentActive: {
    backgroundColor: brand.primary,
    opacity: 0.6
  },

  // Workout header
  workoutHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3])
  },
  closeButtonCircle: {
    width: toRN(40),
    height: toRN(40),
    borderRadius: toRN(20),
    backgroundColor: colors.bg.secondary,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  headerCenter: {
    flex: 1,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  currentExerciseName: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textTransform: "capitalize" as const
  },
  nextExerciseLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(2)
  },
  headerRight: {
    width: toRN(40),
    alignItems: "flex-end" as const
  },

  // Side controls (expand, music, chevron)
  sideControls: {
    position: "absolute" as const,
    right: toRN(tokens.spacing[4]),
    top: toRN(130),
    gap: toRN(tokens.spacing[3]),
    zIndex: 5
  },
  sideIconButton: {
    width: toRN(36),
    height: toRN(36),
    borderRadius: toRN(18),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },

  // Video display
  videoContainer: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
    marginHorizontal: toRN(tokens.spacing[4]),
    marginVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.xl),
    overflow: "hidden" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  exerciseVideo: {
    width: "100%",
    height: "100%"
  },
  videoPlaceholder: {
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  pauseIconContainer: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: toRN(tokens.borderRadius.xl),
    borderTopRightRadius: toRN(tokens.borderRadius.xl),
    paddingHorizontal: toRN(tokens.spacing[5]),
    paddingTop: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[6])
  },
  phaseLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[1])
  },
  exerciseNameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  bottomExerciseName: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskBold,
    color: "white",
    textTransform: "capitalize" as const,
    textAlign: "center" as const,
    flexShrink: 1
  },
  helpIcon: {
    marginLeft: toRN(tokens.spacing[2]),
    padding: toRN(4),
    flexShrink: 0
  },
  roundLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },

  // Timer display
  timerDisplay: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  timerText: {
    fontSize: toRN(56),
    fontFamily: fontFamily.groteskBold,
    color: "white"
  },

  // Rep display
  repDisplay: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  repText: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.semiBold,
    color: "white",
    marginBottom: toRN(tokens.spacing[3])
  },
  doneButton: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  doneButtonText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: "white"
  },

  // Controls
  controlsContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[6])
  },
  navButton: {
    width: toRN(50),
    height: toRN(50),
    borderRadius: toRN(25),
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  navButtonPlaceholder: {
    width: toRN(50),
    height: toRN(50)
  },
  pauseButton: {
    width: toRN(70),
    height: toRN(70),
    borderRadius: toRN(35),
    backgroundColor: brand.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const
  }
});
const StyleSheet = RNStyleSheet;

export default WorkoutPlayerScreen;
