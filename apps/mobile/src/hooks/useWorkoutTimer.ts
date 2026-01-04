import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type {
  WorkoutExercise,
  WarmupCooldownExercise,
  WorkoutPlan,
  WorkoutPhase,
  WorkoutTimerState
} from "@/types/workout";

// Re-export for backward compatibility
export type { WorkoutPhase };

/**
 * Workout statistics for completion screen
 */
export interface WorkoutStats {
  totalDurationSeconds: number;
  exercisesCompleted: number;
  exercisesSkipped: number;
  setsCompleted: number;
  totalSets: number;
  pausedDurationSeconds: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

// Default timing constants
const DEFAULT_WORK_DURATION = 45; // seconds
const DEFAULT_REST_BETWEEN_SETS = 30; // seconds
const DEFAULT_REST_BETWEEN_EXERCISES = 60; // seconds
const WARMUP_REST_SECONDS = 20; // Rest after warmup before main workout
const COOLDOWN_REST_SECONDS = 30; // Rest before cooldown stretches
const READY_COUNTDOWN_SECONDS = 15; // "Ready to Go" countdown
const REST_EXTEND_SECONDS = 20; // "+20s" extend button

/**
 * Hook for managing workout timer state and progression
 *
 * Handles:
 * - Ready countdown (15s before workout starts)
 * - Timer countdown for timed exercises
 * - Rep-based exercises (is_timed: false) wait for "Done" button
 * - Circuit-style progression: all exercises in round before next set
 * - Rest periods with extend option
 * - Pause/resume functionality
 * - Workout statistics tracking
 */
export function useWorkoutTimer(plan?: WorkoutPlan) {
  // Parse exercises from plan
  const exercises = useMemo<WorkoutExercise[]>(() => {
    if (!plan?.structure) return [];
    const mainWorkout = plan.structure.main_workout || plan.structure.routine;
    return mainWorkout?.exercises || [];
  }, [plan]);

  const warmUpExercises = useMemo<WarmupCooldownExercise[]>(() => {
    return plan?.structure?.warm_up?.exercises || [];
  }, [plan]);

  const coolDownExercises = useMemo<WarmupCooldownExercise[]>(() => {
    return plan?.structure?.cool_down?.exercises || [];
  }, [plan]);

  // Rest between exercises from plan
  const restBetweenExercises = useMemo(() => {
    return (
      plan?.structure?.main_workout?.rest_between_exercises_seconds ||
      DEFAULT_REST_BETWEEN_EXERCISES
    );
  }, [plan]);

  // State
  const [phase, setPhase] = useState<WorkoutPhase>("warmup");
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(READY_COUNTDOWN_SECONDS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // IMPORTANT: Start as false - only show when startWorkout or resumeFromProgress is called
  const [showReadyCountdown, setShowReadyCountdown] = useState(false);
  const [showExerciseCountdown, setShowExerciseCountdown] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);

  // Stats tracking
  const [exercisesSkipped, setExercisesSkipped] = useState(0);
  const [setsCompleted, setSetsCompleted] = useState(0);
  const [pausedDuration, setPausedDuration] = useState(0);
  const pauseStartRef = useRef<Date | null>(null);
  const workoutStartRef = useRef<Date | null>(null);

  // Timer interval ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Flag to track if we're resuming from saved progress
  // When true, countdown ending should use the restored phase/exercise instead of starting from 0
  const isResumingRef = useRef(false);
  // Store the time for the resumed exercise (used after countdown ends)
  const resumeTimeRef = useRef(0);
  // Store next phase info for transitions that go through rest first
  const nextPhaseRef = useRef<{
    phase: WorkoutPhase;
    exerciseIndex: number;
    time: number;
    setIndex?: number;
    round?: number;
  } | null>(null);

  // Current exercise (considering warmup/cooldown phases)
  const currentExercise = useMemo(() => {
    if (phase === "warmup" && warmUpExercises.length > 0) {
      return warmUpExercises[currentExerciseIndex] as WarmupCooldownExercise;
    }
    if (phase === "cooldown" && coolDownExercises.length > 0) {
      return coolDownExercises[currentExerciseIndex] as WarmupCooldownExercise;
    }
    return exercises[currentExerciseIndex];
  }, [phase, currentExerciseIndex, exercises, warmUpExercises, coolDownExercises]);

  // Current phase exercises
  const currentPhaseExercises = useMemo(() => {
    if (phase === "warmup") return warmUpExercises;
    if (phase === "cooldown") return coolDownExercises;
    return exercises;
  }, [phase, exercises, warmUpExercises, coolDownExercises]);

  // Total exercises count for current phase
  const totalExercisesInPhase = currentPhaseExercises.length;

  // Max sets (all exercises should have same sets for circuit)
  const maxSets = useMemo(() => {
    if (exercises.length === 0) return 1;
    return Math.max(...exercises.map((ex) => ex.sets || 3));
  }, [exercises]);

  // Total time for current phase
  const totalTime = useMemo(() => {
    if (showReadyCountdown) {
      return READY_COUNTDOWN_SECONDS;
    }
    if (phase === "rest") {
      return restTimeRemaining || restBetweenExercises;
    }
    if (currentExercise) {
      if ("duration_seconds" in currentExercise) {
        return currentExercise.duration_seconds || DEFAULT_WORK_DURATION;
      }
      return (currentExercise as WorkoutExercise).work_duration_seconds || DEFAULT_WORK_DURATION;
    }
    return DEFAULT_WORK_DURATION;
  }, [phase, currentExercise, restTimeRemaining, restBetweenExercises, showReadyCountdown]);

  // Is current exercise timed or rep-based?
  const isCurrentExerciseTimed = useMemo(() => {
    if (!currentExercise) return true;
    // Warmup/cooldown are always timed
    if (phase === "warmup" || phase === "cooldown") return true;
    // Check is_timed field
    return (currentExercise as WorkoutExercise).is_timed !== false;
  }, [currentExercise, phase]);

  // Progress calculation (overall workout progress 0-100)
  const progress = useMemo(() => {
    const totalPhases =
      warmUpExercises.length + exercises.length * maxSets + coolDownExercises.length;
    if (totalPhases === 0) return 0;

    let completed = 0;

    // Count warmup exercises completed
    if (phase === "warmup") {
      completed = currentExerciseIndex;
    } else {
      completed = warmUpExercises.length;
    }

    // Count main workout progress
    if (phase === "workout" || phase === "rest") {
      // Each round completes all exercises once
      const completedRounds = currentRound - 1;
      const exercisesInCurrentRound = currentExerciseIndex;
      completed += completedRounds * exercises.length + exercisesInCurrentRound;
    } else if (phase === "cooldown" || phase === "completed") {
      completed += exercises.length * maxSets;
    }

    // Count cooldown progress
    if (phase === "cooldown") {
      completed += currentExerciseIndex;
    } else if (phase === "completed") {
      completed += coolDownExercises.length;
    }

    return Math.min((completed / totalPhases) * 100, 100);
  }, [
    phase,
    currentExerciseIndex,
    currentRound,
    warmUpExercises,
    exercises,
    coolDownExercises,
    maxSets
  ]);

  // Total sets calculation - includes warmup, workout (with rounds), and cooldown
  const totalSets = useMemo(() => {
    const warmupCount = warmUpExercises.length;
    const workoutCount = exercises.reduce((sum, ex) => sum + (ex.sets || 3), 0);
    const cooldownCount = coolDownExercises.length;
    return warmupCount + workoutCount + cooldownCount;
  }, [warmUpExercises, exercises, coolDownExercises]);

  // Total exercises across all phases INCLUDING rounds (for progress bar)
  // Each main exercise is done once per round, so multiply by maxSets
  const totalExercisesCount = useMemo(() => {
    return (
      warmUpExercises.length +
      exercises.length * maxSets + // Each main exercise × number of rounds
      coolDownExercises.length
    );
  }, [warmUpExercises, exercises, coolDownExercises, maxSets]);

  // Overall exercise index across all phases INCLUDING rounds (for progress bar)
  const overallExerciseIndex = useMemo(() => {
    if (phase === "warmup") {
      return currentExerciseIndex;
    } else if (phase === "workout" || phase === "rest") {
      // Warmup completed + previous rounds completed + current exercise in current round
      return warmUpExercises.length + (currentRound - 1) * exercises.length + currentExerciseIndex;
    } else if (phase === "cooldown") {
      // Warmup + all main workout rounds completed + current cooldown exercise
      return warmUpExercises.length + exercises.length * maxSets + currentExerciseIndex;
    } else if (phase === "completed") {
      return totalExercisesCount;
    }
    return 0;
  }, [
    phase,
    currentExerciseIndex,
    currentRound,
    warmUpExercises,
    exercises,
    maxSets,
    totalExercisesCount
  ]);

  // Exercises remaining (includes all rounds/sets)
  const exercisesRemaining = useMemo(() => {
    if (phase === "completed") return 0;

    let remaining = 0;

    if (phase === "warmup") {
      remaining = warmUpExercises.length - currentExerciseIndex;
      remaining += exercises.length * maxSets;
      remaining += coolDownExercises.length;
    } else if (phase === "workout" || phase === "rest") {
      // Remaining in current round
      remaining = exercises.length - currentExerciseIndex;
      // Remaining rounds
      remaining += exercises.length * (maxSets - currentRound);
      // Cooldown
      remaining += coolDownExercises.length;
    } else if (phase === "cooldown") {
      remaining = coolDownExercises.length - currentExerciseIndex;
    }

    return remaining;
  }, [
    phase,
    currentExerciseIndex,
    currentRound,
    warmUpExercises,
    exercises,
    coolDownExercises,
    maxSets
  ]);

  // Workout statistics
  const workoutStats = useMemo<WorkoutStats>(() => {
    return {
      totalDurationSeconds: workoutStartRef.current
        ? Math.floor((new Date().getTime() - workoutStartRef.current.getTime()) / 1000) -
          pausedDuration
        : 0,
      exercisesCompleted: setsCompleted,
      exercisesSkipped,
      setsCompleted,
      totalSets,
      pausedDurationSeconds: pausedDuration,
      startedAt: workoutStartRef.current,
      completedAt: phase === "completed" ? new Date() : null
    };
  }, [setsCompleted, exercisesSkipped, totalSets, pausedDuration, phase]);

  // Clear timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Move to next phase/exercise
  const advanceWorkout = useCallback(() => {
    // Handle warmup phase
    if (phase === "warmup") {
      // Warmup exercise completed - increment sets completed
      setSetsCompleted((prev) => prev + 1);

      const nextIndex = currentExerciseIndex + 1;
      if (nextIndex < warmUpExercises.length) {
        // More warmup exercises - go to rest first (use warmup rest time)
        setPhase("rest");
        setRestTimeRemaining(WARMUP_REST_SECONDS);
        setTimeRemaining(WARMUP_REST_SECONDS);
        // Store next phase info for after rest
        nextPhaseRef.current = {
          phase: "warmup",
          exerciseIndex: nextIndex,
          time: warmUpExercises[nextIndex].duration_seconds || 30
        };
      } else {
        // Move to main workout - go to rest first (use warmup rest time)
        if (exercises.length > 0) {
          setPhase("rest");
          setRestTimeRemaining(WARMUP_REST_SECONDS);
          setTimeRemaining(WARMUP_REST_SECONDS);
          // Store next phase info for after rest
          nextPhaseRef.current = {
            phase: "workout",
            exerciseIndex: 0,
            time: exercises[0].work_duration_seconds || DEFAULT_WORK_DURATION,
            setIndex: 0,
            round: 1
          };
        } else {
          setPhase("completed");
          setIsPlaying(false);
        }
      }
      return;
    }

    // Handle rest phase - move to next exercise
    if (phase === "rest") {
      // Check if we have stored next phase info (from warmup/cooldown transition)
      if (nextPhaseRef.current) {
        const nextPhase = nextPhaseRef.current;
        setPhase(nextPhase.phase);
        setCurrentExerciseIndex(nextPhase.exerciseIndex);
        resumeTimeRef.current = nextPhase.time;
        if (nextPhase.setIndex !== undefined) {
          setCurrentSetIndex(nextPhase.setIndex);
        }
        if (nextPhase.round !== undefined) {
          setCurrentRound(nextPhase.round);
        }
        nextPhaseRef.current = null;
        // Ensure workout is playing when showing countdown
        setIsPlaying(true);
        setIsPaused(false);
        // Set timer to show correct duration during countdown
        setTimeRemaining(resumeTimeRef.current);
        setShowExerciseCountdown(true);
        return;
      }

      const nextIndex = currentExerciseIndex + 1;

      if (nextIndex < exercises.length) {
        // Next exercise in current round
        setCurrentExerciseIndex(nextIndex);
        setPhase("workout");
        const nextEx = exercises[nextIndex];
        // Show 3-2-1 countdown before next exercise
        resumeTimeRef.current = nextEx.work_duration_seconds || DEFAULT_WORK_DURATION;
        // Ensure workout is playing when showing countdown
        setIsPlaying(true);
        setIsPaused(false);
        // Set timer to show correct duration during countdown
        setTimeRemaining(resumeTimeRef.current);
        setShowExerciseCountdown(true);
      } else {
        // End of round - start next round or move to cooldown
        const nextRound = currentRound + 1;
        if (nextRound <= maxSets) {
          // Start next round
          setCurrentRound(nextRound);
          setCurrentExerciseIndex(0);
          setPhase("workout");
          const firstEx = exercises[0];
          // Show 3-2-1 countdown before first exercise of new round
          resumeTimeRef.current = firstEx.work_duration_seconds || DEFAULT_WORK_DURATION;
          // Ensure workout is playing when showing countdown
          setIsPlaying(true);
          setIsPaused(false);
          // Set timer to show correct duration during countdown
          setTimeRemaining(resumeTimeRef.current);
          setShowExerciseCountdown(true);
        } else {
          // Move to cooldown
          if (coolDownExercises.length > 0) {
            // Go directly to cooldown with 3-2-1 countdown
            setPhase("cooldown");
            setCurrentExerciseIndex(0);
            const firstCooldown = coolDownExercises[0];
            resumeTimeRef.current = firstCooldown.duration_seconds || 30;
            setIsPlaying(true);
            setIsPaused(false);
            setTimeRemaining(resumeTimeRef.current);
            setShowExerciseCountdown(true);
          } else {
            setPhase("completed");
            setIsPlaying(false);
          }
        }
      }
      return;
    }

    // Handle cooldown phase
    if (phase === "cooldown") {
      // Cooldown exercise completed - increment sets completed
      setSetsCompleted((prev) => prev + 1);

      const nextIndex = currentExerciseIndex + 1;
      if (nextIndex < coolDownExercises.length) {
        // More cooldown exercises - no rest between stretches (just go to next)
        setCurrentExerciseIndex(nextIndex);
        const nextEx = coolDownExercises[nextIndex];
        resumeTimeRef.current = nextEx.duration_seconds || 30;
        // Ensure workout is playing when showing countdown
        setIsPlaying(true);
        setIsPaused(false);
        // Set timer to show correct duration during countdown
        setTimeRemaining(resumeTimeRef.current);
        setShowExerciseCountdown(true);
      } else {
        // Cooldown complete - workout finished!
        setPhase("completed");
        setIsPlaying(false);
      }
      return;
    }

    // Handle workout phase - exercise completed
    if (phase === "workout" && currentExercise) {
      setSetsCompleted((prev) => prev + 1);

      // Move to rest between exercises (no countdown for rest)
      setPhase("rest");
      setRestTimeRemaining(restBetweenExercises);
      setTimeRemaining(restBetweenExercises);
    }
  }, [
    phase,
    currentExercise,
    currentExerciseIndex,
    currentRound,
    exercises,
    warmUpExercises,
    coolDownExercises,
    restBetweenExercises,
    maxSets
  ]);

  // Timer tick
  useEffect(() => {
    // Don't tick while showing exercise countdown (3-2-1)
    if (showExerciseCountdown) return;

    if (isPlaying && !isPaused && timeRemaining > 0) {
      // Only tick for timed exercises and rest
      if (showReadyCountdown || isCurrentExerciseTimed || phase === "rest") {
        timerRef.current = setInterval(() => {
          setTimeRemaining((prev) => {
            if (prev <= 1) {
              if (showReadyCountdown) {
                setShowReadyCountdown(false);

                // If resuming, use restored values
                if (isResumingRef.current) {
                  isResumingRef.current = false;
                  resumeTimeRef.current = resumeTimeRef.current || DEFAULT_WORK_DURATION;
                } else {
                  // Set up for first exercise
                  if (warmUpExercises.length > 0) {
                    setPhase("warmup");
                    setCurrentExerciseIndex(0);
                    resumeTimeRef.current = warmUpExercises[0].duration_seconds || 30;
                  } else if (exercises.length > 0) {
                    setPhase("workout");
                    setCurrentExerciseIndex(0);
                    resumeTimeRef.current =
                      exercises[0].work_duration_seconds || DEFAULT_WORK_DURATION;
                  }
                }

                // Show 3-2-1 countdown before starting exercise
                // Ensure workout is playing
                setIsPlaying(true);
                setIsPaused(false);
                // Set timer to show correct duration during countdown
                setTimeRemaining(resumeTimeRef.current);
                setShowExerciseCountdown(true);
                return resumeTimeRef.current; // Show correct time during countdown
              } else {
                advanceWorkout();
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }

    return () => clearTimer();
  }, [
    isPlaying,
    isPaused,
    showReadyCountdown,
    showExerciseCountdown,
    isCurrentExerciseTimed,
    phase,
    advanceWorkout,
    clearTimer,
    warmUpExercises,
    exercises
  ]);

  // Start workout
  const startWorkout = useCallback(() => {
    if (exercises.length === 0 && warmUpExercises.length === 0) {
      setPhase("completed");
      return;
    }

    workoutStartRef.current = new Date();
    setCurrentExerciseIndex(0);
    setCurrentSetIndex(0);
    setCurrentRound(1);
    setSetsCompleted(0);
    setExercisesSkipped(0);
    setPausedDuration(0);
    setShowReadyCountdown(true);
    setTimeRemaining(READY_COUNTDOWN_SECONDS);
    setIsPlaying(true);
    setIsPaused(false);
  }, [exercises, warmUpExercises]);

  // Skip ready countdown and go to 3-2-1 countdown
  const skipReadyCountdown = useCallback(() => {
    setShowReadyCountdown(false);

    // If resuming, use the stored position and time
    if (isResumingRef.current) {
      isResumingRef.current = false;
      // resumeTimeRef already set, show 3-2-1 countdown
    } else {
      // Set up for first exercise
      if (warmUpExercises.length > 0) {
        setPhase("warmup");
        setCurrentExerciseIndex(0);
        resumeTimeRef.current = warmUpExercises[0].duration_seconds || 30;
      } else if (exercises.length > 0) {
        setPhase("workout");
        setCurrentExerciseIndex(0);
        resumeTimeRef.current = exercises[0].work_duration_seconds || DEFAULT_WORK_DURATION;
      }
    }

    // Show 3-2-1 countdown before starting exercise
    // Ensure workout is playing
    setIsPlaying(true);
    setIsPaused(false);
    // Set timer to show correct duration during countdown
    setTimeRemaining(resumeTimeRef.current);
    setShowExerciseCountdown(true);
  }, [warmUpExercises, exercises]);

  // Called when 3-2-1 countdown completes - start the actual exercise timer
  const startExerciseAfterCountdown = useCallback(() => {
    setShowExerciseCountdown(false);
    setTimeRemaining(resumeTimeRef.current || DEFAULT_WORK_DURATION);
  }, []);

  // Restart current exercise (used when user clicks "Restart Exercise" in exit modal)
  // This restarts just the current exercise with 3-2-1 countdown, not from beginning
  const restartCurrentExercise = useCallback(() => {
    clearTimer();

    // Get current exercise duration based on phase
    let exerciseTime = DEFAULT_WORK_DURATION;
    if (phase === "warmup" && warmUpExercises[currentExerciseIndex]) {
      exerciseTime = warmUpExercises[currentExerciseIndex].duration_seconds || 30;
    } else if (phase === "workout" && exercises[currentExerciseIndex]) {
      exerciseTime = exercises[currentExerciseIndex].work_duration_seconds || DEFAULT_WORK_DURATION;
    } else if (phase === "cooldown" && coolDownExercises[currentExerciseIndex]) {
      exerciseTime = coolDownExercises[currentExerciseIndex].duration_seconds || 30;
    } else if (phase === "rest") {
      // If in rest, go back to the previous exercise
      exerciseTime = restBetweenExercises;
    }

    // Store the time for after countdown
    resumeTimeRef.current = exerciseTime;

    // Reset and show 3-2-1 countdown
    setTimeRemaining(exerciseTime);
    setShowExerciseCountdown(false);
    setTimeout(() => setShowExerciseCountdown(true), 0);
    setIsPlaying(true);
    setIsPaused(false);
  }, [
    clearTimer,
    phase,
    currentExerciseIndex,
    warmUpExercises,
    exercises,
    coolDownExercises,
    restBetweenExercises
  ]);

  // Mark rep-based exercise as done
  const markExerciseDone = useCallback(() => {
    if (!isCurrentExerciseTimed && phase === "workout") {
      advanceWorkout();
    }
  }, [isCurrentExerciseTimed, phase, advanceWorkout]);

  // Extend rest by 20 seconds
  const extendRest = useCallback(() => {
    if (phase === "rest") {
      setTimeRemaining((prev) => prev + REST_EXTEND_SECONDS);
      setRestTimeRemaining((prev) => prev + REST_EXTEND_SECONDS);
    }
  }, [phase]);

  // Skip rest
  const skipRest = useCallback(() => {
    if (phase === "rest") {
      setTimeRemaining(0);
      advanceWorkout();
    }
  }, [phase, advanceWorkout]);

  // Pause workout
  const pauseWorkout = useCallback(() => {
    clearTimer();
    setIsPaused(true);
    pauseStartRef.current = new Date();
  }, [clearTimer]);

  // Resume workout
  const resumeWorkout = useCallback(() => {
    if (pauseStartRef.current) {
      const pausedTime = Math.floor(
        (new Date().getTime() - pauseStartRef.current.getTime()) / 1000
      );
      setPausedDuration((prev) => prev + pausedTime);
      pauseStartRef.current = null;
    }
    setIsPaused(false);
  }, []);

  // Skip to next exercise (goes through rest screen)
  const skipToNext = useCallback(() => {
    // Reset countdown first (force remount by toggling off then on)
    setShowExerciseCountdown(false);

    // Handle rest phase - skip rest and go to next exercise with countdown
    // Note: advanceWorkout increments setsCompleted for exercise phases,
    // so we DON'T increment here (advanceWorkout will handle it)
    if (phase === "rest") {
      const storedNext = nextPhaseRef.current;
      nextPhaseRef.current = null;
      if (storedNext) {
        setPhase(storedNext.phase);
        setCurrentExerciseIndex(storedNext.exerciseIndex);
        if (storedNext.setIndex !== undefined) setCurrentSetIndex(storedNext.setIndex);
        if (storedNext.round !== undefined) setCurrentRound(storedNext.round);
        resumeTimeRef.current = storedNext.time;
        // Ensure workout is playing
        setIsPlaying(true);
        setIsPaused(false);
        // Set timer to show correct duration during countdown
        setTimeRemaining(storedNext.time);
        // Use setTimeout to ensure state updates before showing countdown
        setTimeout(() => setShowExerciseCountdown(true), 0);
      } else {
        advanceWorkout();
      }
      return;
    }

    // For non-rest phases, use advanceWorkout which properly goes through rest
    // advanceWorkout will increment setsCompleted for the current exercise
    // Ensure workout is playing after navigation
    setIsPlaying(true);
    setIsPaused(false);
    advanceWorkout();
  }, [phase, advanceWorkout]);

  // Skip to previous exercise (directly, no rest screen)
  const skipToPrevious = useCallback(() => {
    // Clear any pending next phase info
    nextPhaseRef.current = null;

    // Reset countdown first (force remount by toggling off then on)
    setShowExerciseCountdown(false);

    // Ensure workout is playing after navigation
    setIsPlaying(true);
    setIsPaused(false);

    // Helper to show countdown after state updates (also sets timeRemaining)
    const showCountdown = (time: number) => {
      setTimeRemaining(time);
      setTimeout(() => setShowExerciseCountdown(true), 0);
    };

    if (phase === "rest") {
      // From rest, go back to the current exercise (the one before rest)
      if (exercises.length > 0) {
        setPhase("workout");
        const time =
          exercises[currentExerciseIndex]?.work_duration_seconds || DEFAULT_WORK_DURATION;
        resumeTimeRef.current = time;
        showCountdown(time);
      }
      return;
    }

    if (phase === "warmup") {
      if (currentExerciseIndex > 0) {
        const prevIndex = currentExerciseIndex - 1;
        setCurrentExerciseIndex(prevIndex);
        const time = warmUpExercises[prevIndex].duration_seconds || 30;
        resumeTimeRef.current = time;
        showCountdown(time);
      }
      // Can't go before first warmup exercise
    } else if (phase === "workout") {
      if (currentExerciseIndex > 0) {
        // Previous exercise in current round
        const prevIndex = currentExerciseIndex - 1;
        setCurrentExerciseIndex(prevIndex);
        const time = exercises[prevIndex].work_duration_seconds || DEFAULT_WORK_DURATION;
        resumeTimeRef.current = time;
        showCountdown(time);
      } else if (currentRound > 1) {
        // Go to last exercise of previous round
        const prevRound = currentRound - 1;
        const lastExIndex = exercises.length - 1;
        setCurrentRound(prevRound);
        setCurrentExerciseIndex(lastExIndex);
        const time = exercises[lastExIndex].work_duration_seconds || DEFAULT_WORK_DURATION;
        resumeTimeRef.current = time;
        showCountdown(time);
      } else if (warmUpExercises.length > 0) {
        // Go back to last warmup exercise
        const lastWarmupIndex = warmUpExercises.length - 1;
        setPhase("warmup");
        setCurrentExerciseIndex(lastWarmupIndex);
        const time = warmUpExercises[lastWarmupIndex].duration_seconds || 30;
        resumeTimeRef.current = time;
        showCountdown(time);
      }
      // Can't go before if no warmup and at start
    } else if (phase === "cooldown") {
      if (currentExerciseIndex > 0) {
        const prevIndex = currentExerciseIndex - 1;
        setCurrentExerciseIndex(prevIndex);
        const time = coolDownExercises[prevIndex].duration_seconds || 30;
        resumeTimeRef.current = time;
        showCountdown(time);
      } else if (exercises.length > 0) {
        // Go back to last exercise of last round
        setPhase("workout");
        setCurrentRound(maxSets);
        setCurrentExerciseIndex(exercises.length - 1);
        const time = exercises[exercises.length - 1].work_duration_seconds || DEFAULT_WORK_DURATION;
        resumeTimeRef.current = time;
        showCountdown(time);
      }
    }
  }, [
    phase,
    currentExerciseIndex,
    currentRound,
    maxSets,
    warmUpExercises,
    exercises,
    coolDownExercises
  ]);

  // Complete workout manually
  const completeWorkout = useCallback(() => {
    clearTimer();
    setPhase("completed");
    setIsPlaying(false);
    setIsPaused(false);
  }, [clearTimer]);

  // Jump to a specific exercise by global index (0-based)
  // This maps the global index to the correct phase, exercise index, and round
  const jumpToExercise = useCallback(
    (globalIndex: number) => {
      clearTimer();

      // Determine which phase and exercise index based on global index
      const warmupCount = warmUpExercises.length;
      const workoutCount = exercises.length * maxSets;
      const cooldownCount = coolDownExercises.length;

      let targetPhase: WorkoutPhase;
      let targetExerciseIndex: number;
      let targetRound = 1;
      let exerciseTime = DEFAULT_WORK_DURATION;

      if (globalIndex < warmupCount) {
        // Warmup phase
        targetPhase = "warmup";
        targetExerciseIndex = globalIndex;
        exerciseTime = warmUpExercises[targetExerciseIndex]?.duration_seconds || 30;
      } else if (globalIndex < warmupCount + workoutCount) {
        // Main workout phase
        targetPhase = "workout";
        const workoutIndex = globalIndex - warmupCount;
        targetRound = Math.floor(workoutIndex / exercises.length) + 1;
        targetExerciseIndex = workoutIndex % exercises.length;
        exerciseTime =
          exercises[targetExerciseIndex]?.work_duration_seconds || DEFAULT_WORK_DURATION;
      } else if (globalIndex < warmupCount + workoutCount + cooldownCount) {
        // Cooldown phase
        targetPhase = "cooldown";
        targetExerciseIndex = globalIndex - warmupCount - workoutCount;
        exerciseTime = coolDownExercises[targetExerciseIndex]?.duration_seconds || 30;
      } else {
        // Beyond the end - go to cooldown end or complete
        completeWorkout();
        return;
      }

      // Set the new state
      setPhase(targetPhase);
      setCurrentExerciseIndex(targetExerciseIndex);
      setCurrentRound(targetRound);
      setTimeRemaining(exerciseTime);

      // Update sets completed to reflect completed exercises
      setSetsCompleted(globalIndex);

      // Clear any stored next phase info
      nextPhaseRef.current = null;

      // Show exercise countdown and start playing
      setShowExerciseCountdown(false);
      setTimeout(() => setShowExerciseCountdown(true), 0);
      setIsPlaying(true);
      setIsPaused(false);
    },
    [clearTimer, warmUpExercises, exercises, coolDownExercises, maxSets, completeWorkout]
  );

  // Resume from saved progress
  // IMPORTANT: Continue should NEVER show rest screen - always go to the next exercise
  const resumeFromProgress = useCallback(
    (savedProgress: {
      phase: WorkoutPhase;
      currentExerciseIndex: number;
      currentSet: number;
      currentRound: number;
    }) => {
      let targetPhase = savedProgress.phase;
      let targetExerciseIndex = savedProgress.currentExerciseIndex;
      let targetRound = savedProgress.currentRound;

      // If saved phase was "rest", skip to the next exercise that would come after rest
      // Continue should never show rest screen - always show ReadyCountdown -> Exercise
      if (savedProgress.phase === "rest") {
        // Determine what exercise comes after this rest
        const nextIndex = savedProgress.currentExerciseIndex + 1;

        if (nextIndex < exercises.length) {
          // Next exercise in current round
          targetPhase = "workout";
          targetExerciseIndex = nextIndex;
        } else {
          // End of round - check if more rounds
          const nextRound = savedProgress.currentRound + 1;
          if (nextRound <= maxSets) {
            // Start next round
            targetPhase = "workout";
            targetExerciseIndex = 0;
            targetRound = nextRound;
          } else {
            // Move to cooldown
            if (coolDownExercises.length > 0) {
              targetPhase = "cooldown";
              targetExerciseIndex = 0;
            } else {
              // No cooldown, workout complete
              setPhase("completed");
              setIsPlaying(false);
              return;
            }
          }
        }
      }

      // Set resumed position
      setPhase(targetPhase);
      setCurrentExerciseIndex(targetExerciseIndex);
      setCurrentSetIndex(savedProgress.currentSet - 1);
      setCurrentRound(targetRound);

      // Calculate and store the time for the resumed exercise (used after countdown)
      let exerciseTime = DEFAULT_WORK_DURATION;
      if (targetPhase === "warmup" && warmUpExercises[targetExerciseIndex]) {
        exerciseTime = warmUpExercises[targetExerciseIndex].duration_seconds || 30;
      } else if (targetPhase === "workout" && exercises[targetExerciseIndex]) {
        exerciseTime =
          exercises[targetExerciseIndex].work_duration_seconds || DEFAULT_WORK_DURATION;
      } else if (targetPhase === "cooldown" && coolDownExercises[targetExerciseIndex]) {
        exerciseTime = coolDownExercises[targetExerciseIndex].duration_seconds || 30;
      }

      // Store the time for after countdown ends
      resumeTimeRef.current = exerciseTime;
      isResumingRef.current = true;

      // Show countdown first, then exercise starts
      setShowReadyCountdown(true);
      setTimeRemaining(READY_COUNTDOWN_SECONDS);

      workoutStartRef.current = new Date();
      setIsPlaying(true);
      setIsPaused(false);
    },
    [warmUpExercises, exercises, coolDownExercises, maxSets]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // Get the next exercise info for rest screen (works across all phases)
  const getNextExerciseInfo = useCallback(() => {
    // Check if we have a stored next phase (from phase transitions)
    if (nextPhaseRef.current) {
      const next = nextPhaseRef.current;
      let exercise = null;
      if (next.phase === "warmup") {
        exercise = warmUpExercises[next.exerciseIndex];
      } else if (next.phase === "workout") {
        exercise = exercises[next.exerciseIndex];
      } else if (next.phase === "cooldown") {
        exercise = coolDownExercises[next.exerciseIndex];
      }
      if (exercise) {
        return {
          exercise,
          phase: next.phase,
          exerciseIndex: next.exerciseIndex,
          round: next.round || currentRound
        };
      }
    }

    // Default: next exercise in main workout
    const nextIndex = currentExerciseIndex + 1;
    if (nextIndex < exercises.length) {
      return {
        exercise: exercises[nextIndex],
        phase: "workout" as WorkoutPhase,
        exerciseIndex: nextIndex,
        round: currentRound
      };
    }

    // End of round - check if more rounds
    const nextRound = currentRound + 1;
    if (nextRound <= maxSets) {
      return {
        exercise: exercises[0],
        phase: "workout" as WorkoutPhase,
        exerciseIndex: 0,
        round: nextRound
      };
    }

    // Move to cooldown
    if (coolDownExercises.length > 0) {
      return {
        exercise: coolDownExercises[0],
        phase: "cooldown" as WorkoutPhase,
        exerciseIndex: 0,
        round: currentRound
      };
    }

    return null;
  }, [warmUpExercises, exercises, coolDownExercises, currentExerciseIndex, currentRound, maxSets]);

  return {
    // State
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

    // Data
    exercises,
    currentExercise,
    currentPhaseExercises,
    warmUpExercises,
    coolDownExercises,
    progress,
    workoutStats,
    maxSets,
    totalExercisesInPhase,
    totalExercisesCount,
    overallExerciseIndex,
    exercisesRemaining,
    isCurrentExerciseTimed,

    // Actions
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
    getNextExerciseInfo
  };
}
