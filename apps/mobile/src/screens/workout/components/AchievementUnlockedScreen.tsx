import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Pressable, Share, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";

interface Achievement {
  id: string;
  badge_key: string;
  badge_name: string;
  badge_description: string;
  points: number;
  rarity: string;
  unlocked_at?: string;
  badge_icon?: string; // URL or local path to badge icon
}

interface AchievementUnlockedScreenProps {
  achievement: Achievement;
  onContinue: () => void;
  onShare?: () => void;
}

// Rarity colors
const rarityColors: Record<string, { primary: string; secondary: string }> = {
  common: { primary: "#6B7280", secondary: "#9CA3AF" },
  rare: { primary: "#3B82F6", secondary: "#60A5FA" },
  epic: { primary: "#8B5CF6", secondary: "#A78BFA" },
  legendary: { primary: "#F59E0B", secondary: "#FBBF24" }
};

// Badge icons based on badge_key prefix (fallback for when CDN image fails to load)
const getBadgeIcon = (badgeKey: string): keyof typeof Ionicons.glyphMap => {
  if (badgeKey.includes("workout")) return "fitness";
  if (badgeKey.includes("streak")) return "flame";
  if (badgeKey.includes("perfect")) return "star";
  if (badgeKey.includes("early")) return "sunny";
  if (badgeKey.includes("night")) return "moon";
  if (badgeKey.includes("marathon") || badgeKey.includes("endurance")) return "timer";
  if (badgeKey.includes("weekly")) return "calendar";
  if (badgeKey.includes("program")) return "trophy";
  return "ribbon";
};

export function AchievementUnlockedScreen({
  achievement,
  onContinue,
  onShare
}: AchievementUnlockedScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const colors_rarity = rarityColors[achievement.rarity] || rarityColors.common;

  // Track if CDN image failed to load
  const [imageError, setImageError] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const badgeRotate = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const starsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation sequence
    Animated.sequence([
      // Fade in background
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      // Pop in badge with bounce
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true
        }),
        // Subtle rotation on appear
        Animated.timing(badgeRotate, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true
        })
      ]),
      // Glow effect
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true
      }),
      // Stars animate in
      Animated.timing(starsAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();

    // Continuous subtle glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.7,
          duration: 1500,
          useNativeDriver: true
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    ).start();
  }, []);

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }

    try {
      await Share.share({
        message: t("completion.achievement.share_message", {
          name: achievement.badge_name,
          description: achievement.badge_description
        })
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const rotateInterpolate = badgeRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-10deg", "0deg"]
  });

  const formattedDate = achievement.unlocked_at
    ? new Date(achievement.unlocked_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Gradient Background */}
      <View style={StyleSheet.absoluteFill}>
        <Svg height="100%" width="100%">
          <Defs>
            <SvgLinearGradient id="bgGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors_rarity.primary} stopOpacity="0.3" />
              <Stop offset="0.5" stopColor={colors.bg.canvas} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.bg.canvas} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgGradient)" />
        </Svg>
      </View>

      {/* Close button */}
      <Pressable style={[styles.closeButton, { top: insets.top + toRN(16) }]} onPress={onContinue}>
        <Ionicons name="close" size={24} color={colors.text.secondary} />
      </Pressable>

      <View style={styles.content}>
        {/* Award label */}
        <Text style={styles.awardLabel}>{t("completion.achievement.awards")}</Text>

        {/* Badge name */}
        <Text style={styles.badgeName}>{achievement.badge_name}</Text>

        {/* Date */}
        <Text style={styles.dateText}>{formattedDate}</Text>

        {/* Badge icon with glow */}
        <Animated.View
          style={[
            styles.badgeContainer,
            {
              transform: [{ scale: scaleAnim }, { rotate: rotateInterpolate }]
            }
          ]}
        >
          {/* Glow effect */}
          <Animated.View
            style={[
              styles.glow,
              {
                backgroundColor: colors_rarity.primary,
                opacity: Animated.multiply(glowAnim, 0.3)
              }
            ]}
          />

          {/* Badge circle */}
          <View style={[styles.badgeCircle, { backgroundColor: colors_rarity.primary + "20" }]}>
            <View
              style={[
                styles.badgeInner,
                {
                  borderColor: colors_rarity.primary,
                  backgroundColor: colors_rarity.primary + "30"
                }
              ]}
            >
              {achievement.badge_icon && !imageError ? (
                <Image
                  source={{ uri: achievement.badge_icon }}
                  style={styles.badgeImage}
                  resizeMode="contain"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Ionicons
                  name={getBadgeIcon(achievement.badge_key)}
                  size={64}
                  color={colors_rarity.primary}
                />
              )}
            </View>
          </View>

          {/* Decorative stars */}
          <Animated.View style={[styles.starsContainer, { opacity: starsAnim }]}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.star,
                  {
                    transform: [{ rotate: `${i * 60}deg` }, { translateY: -100 }]
                  }
                ]}
              >
                <Ionicons name="sparkles" size={16} color={colors_rarity.secondary} />
              </View>
            ))}
          </Animated.View>
        </Animated.View>

        {/* Rarity badge */}
        <View style={[styles.rarityBadge, { backgroundColor: colors_rarity.primary + "20" }]}>
          <Text style={[styles.rarityText, { color: colors_rarity.primary }]}>
            {achievement.rarity.toUpperCase()}
          </Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>{achievement.badge_description}</Text>

        {/* Points */}
        <View style={styles.pointsContainer}>
          <Ionicons name="star" size={20} color="#FFD700" />
          <Text style={styles.pointsText}>
            {t("completion.achievement.points", { count: achievement.points })}
          </Text>
        </View>
      </View>

      {/* Share button */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + toRN(16) }]}>
        <Pressable style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-social" size={20} color={colors.text.primary} />
          <Text style={styles.shareButtonText}>{t("common.share")}</Text>
        </Pressable>

        <Pressable style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueButtonText}>{t("common.continue")}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  closeButton: {
    position: "absolute" as const,
    right: toRN(16),
    zIndex: 10,
    width: toRN(40),
    height: toRN(40),
    borderRadius: toRN(20),
    backgroundColor: colors.bg.secondary,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  content: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6])
  },
  awardLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    letterSpacing: 2,
    marginBottom: toRN(tokens.spacing[2])
  },
  badgeName: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  dateText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[8])
  },
  badgeContainer: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[6])
  },
  glow: {
    position: "absolute" as const,
    width: toRN(200),
    height: toRN(200),
    borderRadius: toRN(100)
  },
  badgeCircle: {
    width: toRN(160),
    height: toRN(160),
    borderRadius: toRN(80),
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  badgeInner: {
    width: toRN(120),
    height: toRN(120),
    borderRadius: toRN(60),
    borderWidth: 3,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const
  },
  badgeImage: {
    width: toRN(80),
    height: toRN(80)
  },
  starsContainer: {
    position: "absolute" as const,
    width: toRN(200),
    height: toRN(200),
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  star: {
    position: "absolute" as const
  },
  rarityBadge: {
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.full),
    marginBottom: toRN(tokens.spacing[4])
  },
  rarityText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.bold,
    letterSpacing: 1
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  pointsContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  pointsText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: "#FFD700"
  },
  buttonContainer: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[4])
  },
  shareButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: colors.bg.secondary
  },
  shareButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  continueButton: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: brand.primary
  },
  continueButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  }
});
