import React, { useEffect, useRef, useState } from "react";
import { View, Animated, StyleSheet } from "react-native";
import * as Speech from "expo-speech";
import { useTheme } from "@/themes";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";

interface ExerciseCountdownProps {
  visible: boolean;
  onComplete: () => void;
  coachVoiceEnabled?: boolean;
  isPaused?: boolean; // When paused, countdown freezes
}

/**
 * 3-2-1 Countdown Animation
 *
 * Shows before every exercise starts (after ready countdown, after rest).
 * Animation: Number drops from top and fades out to bottom.
 * No background - shows over the GIF.
 * User can still interact with controls during countdown.
 * If paused during countdown, animation freezes.
 * If played while paused during countdown, countdown is skipped and "Let's go" is spoken.
 */
export function ExerciseCountdown({
  visible,
  onComplete,
  coachVoiceEnabled = true,
  isPaused = false,
}: ExerciseCountdownProps) {
  const { brandColors } = useTheme();
  const [currentNumber, setCurrentNumber] = useState(3);
  const [countdownStarted, setCountdownStarted] = useState(false);
  const [wasEverPaused, setWasEverPaused] = useState(false);

  // Animation values
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  // Track animation state
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const isMountedRef = useRef(true);
  const pendingNumberRef = useRef<number | null>(null);

  // Track if paused during countdown
  useEffect(() => {
    if (visible && isPaused && countdownStarted) {
      setWasEverPaused(true);
      // Stop animation when paused
      if (animationRef.current) {
        animationRef.current.stop();
      }
      Speech.stop();
    }
  }, [visible, isPaused, countdownStarted]);

  // Handle resume from pause - skip countdown immediately
  useEffect(() => {
    if (visible && !isPaused && wasEverPaused && countdownStarted) {
      // User resumed after pausing during countdown - skip it immediately
      // Reset state first
      setWasEverPaused(false);

      // Stop any animations
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }

      // Say "Let's go!" and complete
      if (coachVoiceEnabled) {
        Speech.speak("Do the exercise!", {
          rate: 1.0,
          pitch: 1.2,
          onDone: () => {
            onComplete();
          },
          onError: () => {
            onComplete();
          },
        });
      } else {
        onComplete();
      }
    }
  }, [
    visible,
    isPaused,
    wasEverPaused,
    countdownStarted,
    coachVoiceEnabled,
    onComplete,
  ]);

  // Run countdown when visible
  useEffect(() => {
    if (!visible) {
      setCurrentNumber(3);
      setCountdownStarted(false);
      setWasEverPaused(false);
      pendingNumberRef.current = null;
      return;
    }

    // Don't start if paused - wait for resume
    if (isPaused) {
      return;
    }

    // If user was ever paused during this countdown, skip effect handles it
    if (wasEverPaused) {
      return;
    }

    // Don't restart if already started
    if (countdownStarted) {
      return;
    }

    isMountedRef.current = true;
    setCountdownStarted(true);
    let isSpeakingGo = false;

    const animateNumber = (num: number) => {
      if (!isMountedRef.current || isPaused) return;

      setCurrentNumber(num);
      pendingNumberRef.current = num;

      // Speak the number
      if (coachVoiceEnabled) {
        Speech.speak(String(num), {
          rate: 1.0,
          pitch: 1.1,
        });
      }

      // Reset animation values
      translateY.setValue(-80);
      opacity.setValue(0);
      scale.setValue(0.5);

      // Animate: drop down, scale up, fade in, then fade out and drop further
      const animation = Animated.sequence([
        // Drop in and scale up
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            tension: 80,
            friction: 10,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
        // Hold briefly
        Animated.delay(300),
        // Fade out and drop down
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 80,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
      ]);

      animationRef.current = animation;

      animation.start(({ finished }) => {
        if (!isMountedRef.current) return;
        if (!finished) return; // Animation was stopped (e.g., paused)

        if (num > 1) {
          // Continue countdown
          animateNumber(num - 1);
        } else {
          // Countdown complete - say "Go!" and trigger callback after speech
          if (coachVoiceEnabled) {
            isSpeakingGo = true;
            const phrases = ["Do the exercise!", "Start!", "Let's go!"];
            const phrase = "Do the exercise!";
            Speech.speak(phrase, {
              rate: 1.0,
              pitch: 1.2,
              onDone: () => {
                isSpeakingGo = false;
                if (isMountedRef.current) onComplete();
              },
              onError: () => {
                isSpeakingGo = false;
                if (isMountedRef.current) onComplete();
              },
            });
          } else {
            onComplete();
          }
        }
      });
    };

    // Start countdown from 3
    animateNumber(3);

    return () => {
      isMountedRef.current = false;
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      // Don't stop speech if we're saying "Go!" - let it finish
      if (!isSpeakingGo) {
        Speech.stop();
      }
    };
  }, [visible, isPaused, coachVoiceEnabled, onComplete]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.Text
        style={[
          styles.number,
          {
            color: brandColors.primary,
            transform: [{ translateY }, { scale }],
            opacity,
          },
        ]}
      >
        {currentNumber}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  number: {
    fontSize: toRN(180),
    fontFamily: fontFamily.groteskBold,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
});
