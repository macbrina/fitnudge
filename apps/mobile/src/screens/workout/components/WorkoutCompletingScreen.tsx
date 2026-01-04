import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";

// Simple motivational messages
const MESSAGES = [
  "You crushed it! 💪",
  "On fire today! 🔥",
  "Great session! ⭐",
  "Well done! 🏆",
  "Amazing work! ✨"
];

export function WorkoutCompletingScreen() {
  const styles = useStyles(makeStyles);
  const { brandColors, colors } = useTheme();
  const { t } = useTranslation();

  // Animations
  const pulseScale = useRef(new Animated.Value(0.8)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  // Message cycling
  const [messageIndex, setMessageIndex] = useState(Math.floor(Math.random() * MESSAGES.length));

  // Check icon pop-in and pulse
  useEffect(() => {
    Animated.sequence([
      // Pop in
      Animated.parallel([
        Animated.spring(pulseScale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]),
      // Gentle pulse loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.05,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      )
    ]).start();
  }, []);

  // Loading spinner
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
  }, []);

  // Cycle messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Checkmark with pulse */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              opacity: checkOpacity,
              transform: [{ scale: pulseScale }]
            }
          ]}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={48} color={brandColors.primary} />
          </View>
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>{t("workout.completing_title", "Workout Complete!")}</Text>

        {/* Cycling message */}
        <Text style={styles.message}>{MESSAGES[messageIndex]}</Text>

        {/* Loading indicator */}
        <View style={styles.loadingSection}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync" size={20} color={colors.text.tertiary} />
          </Animated.View>
          <Text style={styles.loadingText}>
            {t("workout.calculating_stats", "Calculating your stats")}...
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  content: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6])
  },
  iconContainer: {
    marginBottom: toRN(tokens.spacing[6])
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 3,
    borderColor: brand.primary
  },
  title: {
    fontSize: toRN(24),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  message: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[10])
  },
  loadingSection: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  loadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  }
});
