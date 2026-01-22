import React, { useEffect, useRef, useMemo } from "react";
import { View, Animated, Easing, Dimensions } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";

interface OnboardingCompleteScreenProps {
  name: string;
  reminderTime: string;
  onComplete: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const CONFETTI_COUNT = 50;
const celeberateImage = require("@assetsimages/images/celeberate.png");

// Confetti piece component
function ConfettiPiece({
  delay,
  color,
  startX,
  size
}: {
  delay: number;
  color: string;
  startX: number;
  size: number;
}) {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const duration = 2500 + Math.random() * 1500;
    const horizontalDrift = (Math.random() - 0.5) * 100;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight + 100,
          duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(translateX, {
          toValue: horizontalDrift,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(rotate, {
          toValue: 360 * (2 + Math.random() * 3),
          duration,
          easing: Easing.linear,
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration,
          delay: duration * 0.6,
          useNativeDriver: true
        })
      ])
    ]).start();
  }, [delay, translateY, translateX, rotate, opacity]);

  const rotateInterpolation = rotate.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"]
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: startX,
        top: -20,
        width: size,
        height: size * 1.5,
        backgroundColor: color,
        borderRadius: size / 4,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate: rotateInterpolation }]
      }}
    />
  );
}

// Celebration image animation
function CelebrationImage() {
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true
        }),
        Animated.sequence([
          Animated.timing(rotate, {
            toValue: -10,
            duration: 100,
            useNativeDriver: true
          }),
          Animated.timing(rotate, {
            toValue: 10,
            duration: 150,
            useNativeDriver: true
          }),
          Animated.timing(rotate, {
            toValue: -6,
            duration: 150,
            useNativeDriver: true
          }),
          Animated.timing(rotate, {
            toValue: 6,
            duration: 150,
            useNativeDriver: true
          }),
          Animated.timing(rotate, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true
          })
        ])
      ])
    ]).start();
  }, [scale, rotate]);

  const rotateInterpolation = rotate.interpolate({
    inputRange: [-10, 10],
    outputRange: ["-10deg", "10deg"]
  });

  return (
    <Animated.Image
      source={celeberateImage}
      style={{
        width: 120,
        height: 120,
        transform: [{ scale }, { rotate: rotateInterpolation }]
      }}
      resizeMode="contain"
    />
  );
}

export default function OnboardingCompleteScreen({
  name,
  reminderTime,
  onComplete
}: OnboardingCompleteScreenProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();
  const insets = useSafeAreaInsets();

  // Animation values
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(20)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(20)).current;

  // Generate confetti pieces
  const confettiColors = useMemo(
    () => [brandColors.primary, "#FFD700", "#FF6B6B", "#4ECDC4", "#A855F7"],
    [brandColors.primary]
  );

  const confettiPieces = useMemo(() => {
    return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      delay: Math.random() * 500,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      startX: Math.random() * screenWidth,
      size: 6 + Math.random() * 8
    }));
  }, [confettiColors]);

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true
        })
      ]),
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true
        })
      ]),
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.timing(buttonTranslateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        })
      ])
    ]).start();
  }, [
    titleOpacity,
    titleTranslateY,
    subtitleOpacity,
    subtitleTranslateY,
    buttonOpacity,
    buttonTranslateY
  ]);

  return (
    <View style={styles.container}>
      {/* Confetti overlay */}
      <View style={styles.confettiContainer} pointerEvents="none">
        {confettiPieces.map((piece) => (
          <ConfettiPiece
            key={piece.id}
            delay={piece.delay}
            color={piece.color}
            startX={piece.startX}
            size={piece.size}
          />
        ))}
      </View>

      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* Celebration image */}
        <View style={styles.imageContainer}>
          <CelebrationImage />
        </View>

        <Animated.Text
          style={[
            styles.title,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }]
            }
          ]}
        >
          {t("onboarding.complete.title", { name })}
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }]
            }
          ]}
        >
          {t("onboarding.complete.subtitle", { time: reminderTime })}
        </Animated.Text>
      </View>

      {/* Bottom button */}
      <Animated.View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 20,
            opacity: buttonOpacity,
            transform: [{ translateY: buttonTranslateY }]
          }
        ]}
      >
        <Button title={t("onboarding.complete.start_button")} onPress={onComplete} size="md" />
      </Animated.View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas
    },
    confettiContainer: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: "hidden" as const
    },
    content: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[8])
    },
    imageContainer: {
      marginBottom: toRN(tokens.spacing[6]),
      alignItems: "center" as const,
      justifyContent: "center" as const
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[3]),
      fontFamily: fontFamily.groteskBold,
      textAlign: "center" as const,
      lineHeight: lineHeight(tokens.typography.fontSize["2xl"], tokens.typography.lineHeight.tight)
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskRegular,
      textAlign: "center" as const,
      lineHeight: lineHeight(tokens.typography.fontSize.lg, tokens.typography.lineHeight.relaxed)
    },
    footer: {
      paddingHorizontal: toRN(tokens.spacing[6])
    }
  };
};
