/**
 * AI Coach Card
 *
 * A visually striking card with 3D bot image and scattered glow effects.
 * Clean white/dark background with decorative light orbs.
 * Placed on HomeScreen to provide easy access to the AI Coach.
 */

import React from "react";
import { View, Text, TouchableOpacity, Image, Platform, ImageSourcePropType } from "react-native";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { ChevronRight } from "lucide-react-native";

// 3D Bot image asset
const Bot3DImage: ImageSourcePropType = require("@assetsimages/images/3d_bot.png");

interface AICoachCardProps {
  onPress: () => void;
}

// Tiny glow orb component for decorative effect
function GlowOrb({
  size,
  color,
  opacity,
  top,
  left,
  right,
  bottom
}: {
  size: number;
  color: string;
  opacity: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}) {
  return (
    <View
      style={{
        position: "absolute" as const,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        top,
        left,
        right,
        bottom,
        ...Platform.select({
          ios: {
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: size / 2
          }
        })
      }}
    />
  );
}

export function AICoachCard({ onPress }: AICoachCardProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors, isDark } = useTheme();
  const { t } = useTranslation();

  // Card background color
  const cardBgColor = isDark ? colors.bg.card : "#ffffff";
  // Glow orb colors - using brand primary with varying opacity
  const glowColor = brandColors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[
        styles.container,
        {
          backgroundColor: cardBgColor,
          shadowColor: isDark ? brandColors.primary : "#000"
        }
      ]}
      accessibilityLabel={t("home.ai_coach_card_label") || "Chat with AI Coach"}
      accessibilityRole="button"
    >
      {/* Scattered Tiny Glow Orbs - positioned around edges/corners */}
      <GlowOrb size={6} color={glowColor} opacity={0.15} top={12} left={12} />
      <GlowOrb size={8} color={glowColor} opacity={0.12} top={8} right={100} />
      <GlowOrb size={5} color={glowColor} opacity={0.18} top={25} right={140} />
      <GlowOrb size={10} color={glowColor} opacity={0.1} bottom={5} left={56} />
      <GlowOrb size={7} color={glowColor} opacity={0.14} bottom={8} right={120} />
      <GlowOrb size={4} color={glowColor} opacity={0.2} bottom={30} right={160} />

      {/* Subtle border */}
      <View
        style={[
          styles.innerBorder,
          {
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"
          }
        ]}
      />

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {t("home.ai_coach_title") || "Your AI Coach"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]} numberOfLines={2}>
            {t("home.ai_coach_subtitle") || "Get personalized guidance & motivation"}
          </Text>

          {/* CTA */}
          <View style={styles.ctaContainer}>
            <Text style={[styles.ctaText, { color: brandColors.primary }]}>
              {t("home.ai_coach_cta") || "Start chatting"}
            </Text>
            <ChevronRight size={16} color={brandColors.primary} strokeWidth={2.5} />
          </View>
        </View>

        {/* 3D Bot Image */}
        <View style={styles.imageContainer}>
          <Image source={Bot3DImage} style={styles.botImage} resizeMode="contain" />
        </View>
      </View>

      {/* Accent Glow Effect - keeping this one as requested */}
      <View
        style={[
          styles.glowEffect,
          {
            backgroundColor: `${brandColors.primary}20`,
            shadowColor: brandColors.primary
          }
        ]}
      />
    </TouchableOpacity>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4]),
    borderRadius: 20,
    overflow: "hidden" as const,
    // Shadow for depth (shadowColor applied dynamically)
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12
      },
      android: {
        elevation: 6
      }
    })
  },

  innerBorder: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1
  },

  contentContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    paddingLeft: toRN(tokens.spacing[5]),
    paddingRight: toRN(tokens.spacing[2]),
    minHeight: 120
  },

  textContainer: {
    flex: 1,
    paddingRight: toRN(tokens.spacing[2]),
    zIndex: 10 // Above glow orbs
  },

  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    marginBottom: toRN(tokens.spacing[1])
  },

  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4,
    marginBottom: toRN(tokens.spacing[3])
  },

  ctaContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4
  },

  ctaText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold
  },

  imageContainer: {
    width: 100,
    height: 100,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    zIndex: 10 // Above glow orbs
  },

  botImage: {
    width: 110,
    height: 110,
    marginRight: -10
  },

  glowEffect: {
    position: "absolute" as const,
    top: "50%" as const,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    // backgroundColor and shadowColor applied dynamically
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20
      }
    })
  }
});

export default AICoachCard;
