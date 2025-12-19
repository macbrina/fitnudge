import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Vibration,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useGoalPlan } from "@/hooks/api/useActionablePlans";
import { useWorkoutTimer } from "@/hooks/useWorkoutTimer";
import { useWorkoutSession } from "@/hooks/useWorkoutSession";
import {
  WorkoutComplete,
  ReadyCountdown,
  ExerciseCountdown,
  RestScreen,
  ExitConfirmationModal,
  QuitFeedback,
  LandscapeWorkoutView,
  MusicVoiceModal,
} from "./components";
import { ExerciseDetailModal } from "@/components/exercises/ExerciseDetailModal";
import type { WorkoutExercise, WorkoutPlan, QuitReason } from "@/types/workout";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";

export function WorkoutPlayerScreen() {
  const router = useRouter();
  const { goalId, resume, restart } = useLocalSearchParams<{
    goalId: string;
    resume?: string;
    restart?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { colors, brandColors } = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();

  // Fetch the workout plan
  const { data: planData, isLoading: planLoading } = useGoalPlan(goalId!, true);

  // Workout session hook
  const {
    activeSession,
    canResume,
    resumePercentage,
    startSession,
    saveProgress,
    completeSession,
    submitFeedback,
  } = useWorkoutSession(goalId);

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
    completeWorkout,
    skipReadyCountdown,
    startExerciseAfterCountdown,
    markExerciseDone,
    extendRest,
    skipRest,
    resumeFromProgress,
    workoutStats,
    getNextExerciseInfo,
  } = useWorkoutTimer(planData?.plan?.structured_data);

  // State for screens
  const [showExitModal, setShowExitModal] = useState(false);
  const [showQuitFeedback, setShowQuitFeedback] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);

  // Track if user manually paused before opening modals
  const wasManuallyPausedRef = useRef(false);
  // Track original music volume before reducing for modals
  const originalMusicVolumeRef = useRef<number | null>(null);

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
    playlist: musicPlaylist,
    playTrack: playMusicTrack,
  } = useWorkoutAudio({ autoPlay: true });

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Toggle landscape mode
  const toggleLandscape = useCallback(async () => {
    try {
      if (isLandscape) {
        // Switch back to portrait
        console.log("Switching to portrait...");
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );
        setIsLandscape(false);
      } else {
        // Switch to landscape - use LANDSCAPE to allow both directions
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
        setIsLandscape(true);
        console.log("Switched to landscape successfully");
      }
    } catch (error) {
      console.error("Failed to toggle orientation:", error);
      // Still toggle the UI even if orientation fails
      setIsLandscape(!isLandscape);
    }
  }, [isLandscape]);

  // Reset orientation when leaving screen
  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      ).catch(() => {});
    };
  }, []);

  // Handle workout start
  const handleStartWorkout = useCallback(async () => {
    if (hasStarted) return; // Prevent double-start
    setHasStarted(true);
    startWorkout();

    // Start fade animation IMMEDIATELY - don't wait for session creation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200, // Faster animation
      useNativeDriver: true,
    }).start();

    // Start session in backend (fire and forget - don't block UI)
    const totalExercises =
      warmUpExercises.length + exercises.length + coolDownExercises.length;
    // Total sets includes warmup, workout (with rounds), and cooldown
    const warmupSets = warmUpExercises.length;
    const workoutSets = exercises.reduce((sum, ex) => sum + (ex.sets || 3), 0);
    const cooldownSets = coolDownExercises.length;
    const totalSetsCount = warmupSets + workoutSets + cooldownSets;

    startSession({
      goal_id: goalId!,
      plan_id: planData?.plan?.id,
      exercises_total: totalExercises,
      sets_total: totalSetsCount,
    })
      .then((session) => setSessionId(session.id))
      .catch((error) => console.error("Failed to start session:", error));
  }, [
    hasStarted,
    startWorkout,
    fadeAnim,
    startSession,
    goalId,
    planData,
    warmUpExercises,
    exercises,
    coolDownExercises,
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
        currentRound: saved.current_round,
      });

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [activeSession, resumeFromProgress, fadeAnim]);

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

    // Auto-pause if not already paused
    if (!isPaused) {
      pauseWorkout();
      pauseMusic();
    }

    // Reduce music volume without reflecting on slider
    if (isMusicPlaying && audioPreferences.music_enabled) {
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
    audioPreferences.music_enabled,
    audioPreferences.music_volume,
    setMusicVolume,
    router,
  ]);

  // Handle resume from exit modal (restore state like closing a modal)
  const handleResume = useCallback(() => {
    setShowExitModal(false);

    // Restore original music volume
    if (originalMusicVolumeRef.current !== null) {
      setMusicVolume(originalMusicVolumeRef.current);
      originalMusicVolumeRef.current = null;
    }

    // Only resume if user didn't manually pause before opening modal
    if (!wasManuallyPausedRef.current) {
      resumeWorkout();
      if (audioPreferences.music_enabled) {
        playMusic();
      }
    }
  }, [
    resumeWorkout,
    playMusic,
    setMusicVolume,
    audioPreferences.music_enabled,
  ]);

  // Handle restart from exit modal
  const handleRestart = useCallback(() => {
    setShowExitModal(false);

    // Restore original music volume
    if (originalMusicVolumeRef.current !== null) {
      setMusicVolume(originalMusicVolumeRef.current);
      originalMusicVolumeRef.current = null;
    }

    startWorkout();

    // Resume music
    if (audioPreferences.music_enabled) {
      playMusic();
    }
  }, [startWorkout, setMusicVolume, playMusic, audioPreferences.music_enabled]);

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
            paused_duration_seconds: workoutStats.pausedDurationSeconds,
          },
        }).catch((error) => console.error("Failed to save progress:", error));
      }

      // Submit feedback in background (fire and forget)
      submitFeedback({
        session_id: sessionId || undefined,
        goal_id: goalId!,
        plan_id: planData?.plan?.id,
        quit_reason: reason,
        exercises_completed: workoutStats.exercisesCompleted,
        completion_percentage: progress,
        time_spent_seconds: workoutStats.totalDurationSeconds,
        current_exercise_name: currentExercise?.name,
      }).catch((error) => console.error("Failed to submit feedback:", error));

      // Go back immediately without waiting
      router.back();
    },
    [
      submitFeedback,
      saveProgress,
      sessionId,
      goalId,
      planData,
      workoutStats,
      progress,
      router,
      phase,
      currentExerciseIndex,
      currentSetIndex,
      currentRound,
      currentExercise,
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
          paused_duration_seconds: workoutStats.pausedDurationSeconds,
        },
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
    workoutStats,
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

    // Only resume if user didn't manually pause before opening modal
    if (!wasManuallyPausedRef.current) {
      resumeWorkout();
      if (audioPreferences.music_enabled) {
        playMusic();
      }
    }
  }, [
    resumeWorkout,
    playMusic,
    setMusicVolume,
    audioPreferences.music_enabled,
  ]);

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
    audioPreferences.music_enabled,
  ]);

  // ========== MODAL AUTO-PAUSE HANDLERS ==========

  // Open music modal - auto pause if not already paused
  const handleOpenMusicModal = useCallback(() => {
    wasManuallyPausedRef.current = isPaused;

    if (!isPaused) {
      pauseWorkout();
    }

    // Reduce music volume without reflecting on slider
    if (isMusicPlaying && audioPreferences.music_enabled) {
      originalMusicVolumeRef.current = audioPreferences.music_volume;
      setMusicVolume(audioPreferences.music_volume * 0.3); // Reduce to 30%
    }

    setShowMusicModal(true);
  }, [
    isPaused,
    pauseWorkout,
    isMusicPlaying,
    audioPreferences.music_enabled,
    audioPreferences.music_volume,
    setMusicVolume,
  ]);

  // Close music modal - restore state
  const handleCloseMusicModal = useCallback(() => {
    setShowMusicModal(false);

    // Restore original music volume
    if (originalMusicVolumeRef.current !== null) {
      setMusicVolume(originalMusicVolumeRef.current);
      originalMusicVolumeRef.current = null;
    }

    // Only resume if user didn't manually pause before opening modal
    if (!wasManuallyPausedRef.current) {
      resumeWorkout();
      if (audioPreferences.music_enabled) {
        playMusic();
      }
    }
  }, [
    resumeWorkout,
    playMusic,
    setMusicVolume,
    audioPreferences.music_enabled,
  ]);

  // Open exercise detail modal - auto pause if not already paused
  const handleOpenExerciseDetail = useCallback(() => {
    wasManuallyPausedRef.current = isPaused;

    if (!isPaused) {
      pauseWorkout();
    }

    // Reduce music volume without reflecting on slider
    if (isMusicPlaying && audioPreferences.music_enabled) {
      originalMusicVolumeRef.current = audioPreferences.music_volume;
      setMusicVolume(audioPreferences.music_volume * 0.3); // Reduce to 30%
    }

    setShowExerciseDetail(true);
  }, [
    isPaused,
    pauseWorkout,
    isMusicPlaying,
    audioPreferences.music_enabled,
    audioPreferences.music_volume,
    setMusicVolume,
  ]);

  // Close exercise detail modal - restore state
  const handleCloseExerciseDetail = useCallback(() => {
    setShowExerciseDetail(false);

    // Restore original music volume
    if (originalMusicVolumeRef.current !== null) {
      setMusicVolume(originalMusicVolumeRef.current);
      originalMusicVolumeRef.current = null;
    }

    // Only resume if user didn't manually pause before opening modal
    if (!wasManuallyPausedRef.current) {
      resumeWorkout();
      if (audioPreferences.music_enabled) {
        playMusic();
      }
    }
  }, [
    resumeWorkout,
    playMusic,
    setMusicVolume,
    audioPreferences.music_enabled,
  ]);

  // Handle workout completion
  const handleWorkoutComplete = useCallback(async () => {
    if (sessionId) {
      try {
        await completeSession({
          sessionId,
          data: {
            exercises_completed: workoutStats.exercisesCompleted,
            exercises_skipped: workoutStats.exercisesSkipped,
            sets_completed: workoutStats.setsCompleted,
            paused_duration_seconds: workoutStats.pausedDurationSeconds,
          },
        });
      } catch (error) {
        console.error("Failed to complete session:", error);
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

  // Save initial progress when ready countdown ends (user enters first exercise)
  useEffect(() => {
    // Detect transition from showReadyCountdown=true to showReadyCountdown=false
    const wasShowingCountdown = prevShowReadyCountdownRef.current;
    prevShowReadyCountdownRef.current = showReadyCountdown;

    if (wasShowingCountdown && !showReadyCountdown && sessionId) {
      // Countdown just ended, user is now on first exercise - save initial progress
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
          paused_duration_seconds: 0,
        },
      }).catch((error) =>
        console.error("Failed to save initial progress:", error)
      );
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
          paused_duration_seconds: 0,
        },
      }).catch((error) => console.error("Failed to reset progress:", error));

      // Use the existing session but start workout from beginning
      setSessionId(activeSession.session.id);
      setHasStarted(true);
      startWorkout(); // This starts from the beginning

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
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
    fadeAnim,
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
  if (phase === "completed") {
    return (
      <WorkoutComplete
        stats={workoutStats}
        onClose={() => router.back()}
        goalId={goalId!}
      />
    );
  }

  // Get current exercise for display (even during ready countdown)
  // When resuming, currentExercise is already set to the resumed position
  const displayExercise = showReadyCountdown
    ? currentExercise ||
      (warmUpExercises.length > 0 ? warmUpExercises[0] : exercises[0])
    : currentExercise;

  // Get next exercise name for header
  const getNextExerciseNameForHeader = () => {
    if (showReadyCountdown) {
      if (warmUpExercises.length > 1) return warmUpExercises[1]?.name;
      if (warmUpExercises.length === 1 && exercises.length > 0)
        return exercises[0]?.name;
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

  // Video player for exercise demonstration
  const exercisePlayer = useVideoPlayer(displayMp4Url || "", (player) => {
    player.loop = true;
    player.playbackRate = 0.5; // Slow motion
    player.muted = true;
  });

  // Sync video playback with workout pause state
  useEffect(() => {
    if (exercisePlayer && displayMp4Url) {
      if (isPaused || showReadyCountdown) {
        exercisePlayer.pause();
      } else {
        exercisePlayer.play();
      }
    }
  }, [isPaused, showReadyCountdown, displayMp4Url, exercisePlayer]);

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
        onSkipNext={skipToNext}
        onMarkDone={markExerciseDone}
        onExitLandscape={toggleLandscape}
      />
    );
  }

  // Rest Screen (Blue Theme)
  if (phase === "rest") {
    const nextInfo = getNextExerciseInfo();
    const nextExercise = nextInfo?.exercise || null;
    // Calculate the display index based on total workout progress
    const nextDisplayIndex = nextInfo
      ? (nextInfo.phase === "warmup"
          ? nextInfo.exerciseIndex
          : nextInfo.phase === "workout"
            ? warmUpExercises.length + nextInfo.exerciseIndex
            : warmUpExercises.length +
              exercises.length +
              nextInfo.exerciseIndex) + 1
      : 0;

    return (
      <View style={styles.restContainer}>
        <RestScreen
          timeRemaining={timeRemaining}
          nextExerciseIndex={nextDisplayIndex}
          totalExercises={totalExercisesCount}
          nextExercise={nextExercise}
          onExtendRest={extendRest}
          onSkipRest={skipRest}
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
                index === overallExerciseIndex && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>

        {/* Header */}
        <View style={styles.workoutHeader}>
          {!showReadyCountdown && (
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButtonCircle}
            >
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
            <TouchableOpacity
              style={styles.sideIconButton}
              onPress={toggleLandscape}
            >
              <Ionicons name="expand" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sideIconButton}
              onPress={handleOpenMusicModal}
            >
              <Ionicons
                name="musical-note"
                size={20}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Video Display */}
        <View style={styles.videoContainer}>
          {displayMp4Url ? (
            <VideoView
              player={exercisePlayer}
              style={[
                styles.exerciseVideo,
                isPaused && !showReadyCountdown && styles.videoPaused,
              ]}
              contentFit="contain"
              nativeControls={false}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Ionicons name="fitness" size={80} color={colors.text.tertiary} />
            </View>
          )}
          {isPaused && !showReadyCountdown && (
            <View style={styles.pausedOverlay}>
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
            style={[
              styles.bottomPanel,
              { paddingBottom: insets.bottom + toRN(tokens.spacing[4]) },
            ]}
          >
            {/* Phase label */}
            <Text style={styles.phaseLabel}>
              {phase === "warmup" && t("workout.phase.warm_up", "WARM UP")}
              {phase === "workout" && t("workout.phase.work", "WORKOUT")}
              {phase === "cooldown" &&
                t("workout.phase.cool_down", "COOL DOWN")}
            </Text>

            {/* Exercise name with help */}
            <View style={styles.exerciseNameRow}>
              <Text style={styles.bottomExerciseName}>
                {currentExercise?.name || ""}
              </Text>
              <TouchableOpacity
                style={styles.helpIcon}
                onPress={handleOpenExerciseDetail}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={20}
                  color="rgba(255,255,255,0.6)"
                />
              </TouchableOpacity>
            </View>

            {/* Round/Set indicator */}
            {phase === "workout" && (
              <Text style={styles.roundLabel}>
                {t("workout.round_of", "Round {{current}}/{{total}}", {
                  current: currentRound,
                  total: maxSets,
                })}
              </Text>
            )}

            {/* Timer or Done button */}
            {isCurrentExerciseTimed ? (
              <View style={styles.timerDisplay}>
                <Text style={styles.timerText}>
                  {formatTime(timeRemaining)}
                </Text>
              </View>
            ) : (
              <View style={styles.repDisplay}>
                <Text style={styles.repText}>
                  {t("workout.do_reps", "Do {{count}} reps", {
                    count: (currentExercise as WorkoutExercise)?.reps || 10,
                  })}
                </Text>
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={markExerciseDone}
                >
                  <Text style={styles.doneButtonText}>
                    {t("workout.done", "Done")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Controls */}
            <View style={styles.controlsContainer}>
              {/* Previous button - hidden when at first exercise */}
              {overallExerciseIndex > 0 ? (
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={skipToPrevious}
                >
                  <Ionicons name="play-skip-back" size={28} color="white" />
                </TouchableOpacity>
              ) : (
                <View style={styles.navButtonPlaceholder} />
              )}

              <TouchableOpacity
                style={styles.pauseButton}
                onPress={handleWorkoutPlayPause}
              >
                <Ionicons
                  name={isPaused ? "play" : "pause"}
                  size={32}
                  color="white"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.navButton} onPress={skipToNext}>
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
        onUpdatePreferences={updateAudioPreferences}
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
    backgroundColor: colors.bg.canvas,
  },
  restContainer: {
    flex: 1,
    backgroundColor: "#007AFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.canvas,
  },
  loadingText: {
    marginTop: toRN(tokens.spacing[4]),
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },

  // Active Workout
  workoutContainer: {
    flex: 1,
  },

  // Progress bar
  progressBarContainer: {
    flexDirection: "row" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[2]),
    gap: toRN(4),
  },
  progressSegment: {
    flex: 1,
    height: toRN(4),
    backgroundColor: colors.border.subtle,
    borderRadius: toRN(2),
  },
  progressSegmentComplete: {
    backgroundColor: brand.primary,
  },
  progressSegmentActive: {
    backgroundColor: brand.primary,
    opacity: 0.6,
  },

  // Workout header
  workoutHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
  },
  closeButtonCircle: {
    width: toRN(40),
    height: toRN(40),
    borderRadius: toRN(20),
    backgroundColor: colors.bg.secondary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[2]),
  },
  currentExerciseName: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textTransform: "capitalize" as const,
  },
  nextExerciseLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(2),
  },
  headerRight: {
    width: toRN(40),
    alignItems: "flex-end" as const,
  },

  // Side controls (expand, music, chevron)
  sideControls: {
    position: "absolute" as const,
    right: toRN(tokens.spacing[4]),
    top: toRN(130),
    gap: toRN(tokens.spacing[3]),
    zIndex: 5,
  },
  sideIconButton: {
    width: toRN(36),
    height: toRN(36),
    borderRadius: toRN(18),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
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
    alignItems: "center" as const,
  },
  exerciseVideo: {
    width: "100%",
    height: "100%",
  },
  videoPaused: {
    opacity: 0.5,
  },
  videoPlaceholder: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: toRN(tokens.borderRadius.xl),
    borderTopRightRadius: toRN(tokens.borderRadius.xl),
    paddingHorizontal: toRN(tokens.spacing[5]),
    paddingTop: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[6]),
  },
  phaseLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[1]),
  },
  exerciseNameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[1]),
  },
  bottomExerciseName: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.groteskBold,
    color: "white",
    textTransform: "capitalize" as const,
  },
  helpIcon: {
    marginLeft: toRN(tokens.spacing[1]),
    padding: toRN(4),
  },
  roundLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },

  // Timer display
  timerDisplay: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  timerText: {
    fontSize: toRN(56),
    fontFamily: fontFamily.groteskBold,
    color: "white",
  },

  // Rep display
  repDisplay: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  repText: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.semiBold,
    color: "white",
    marginBottom: toRN(tokens.spacing[3]),
  },
  doneButton: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.full),
  },
  doneButtonText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: "white",
  },

  // Controls
  controlsContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[6]),
  },
  navButton: {
    width: toRN(50),
    height: toRN(50),
    borderRadius: toRN(25),
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  navButtonPlaceholder: {
    width: toRN(50),
    height: toRN(50),
  },
  pauseButton: {
    width: toRN(70),
    height: toRN(70),
    borderRadius: toRN(35),
    backgroundColor: brand.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
});

// Need to import StyleSheet for absoluteFillObject
import { StyleSheet as RNStyleSheet } from "react-native";
const StyleSheet = RNStyleSheet;

export default WorkoutPlayerScreen;
