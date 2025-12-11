import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { PlanStatus } from "@/services/api/actionablePlans";
import { useTranslation } from "@/lib/i18n";

interface PlanStatusBadgeProps {
  status: PlanStatus;
  size?: "sm" | "md";
}

export function PlanStatusBadge({ status, size = "sm" }: PlanStatusBadgeProps) {
  const styles = useStyles(makePlanStatusBadgeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Animate spinner for pending or generating status
  useEffect(() => {
    if (status === "pending" || status === "generating") {
      const animation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    }
  }, [status, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return {
          icon: "hourglass-outline" as const,
          iconColor: brandColors.primary,
          text: t("goals.plan.status_pending") || "Queued",
          bgColor: brandColors.primary + "1A", // 10% opacity
          textColor: brandColors.primary,
          animated: true,
        };
      case "generating":
        return {
          icon: "refresh" as const,
          iconColor: brandColors.primary,
          text: t("goals.plan.status_generating"),
          bgColor: brandColors.primary + "1A", // 10% opacity
          textColor: brandColors.primary,
          animated: true,
        };
      case "completed":
        return {
          icon: "checkmark-circle" as const,
          iconColor: colors.feedback.success,
          text: t("goals.plan.status_ready"),
          bgColor: colors.bg.success + "1A",
          textColor: colors.feedback.success,
          animated: false,
        };
      case "failed":
        return {
          icon: "alert-circle" as const,
          iconColor: colors.feedback.error,
          text: t("goals.plan.status_failed"),
          bgColor: colors.feedback.error + "1A",
          textColor: colors.feedback.error,
          animated: false,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const isSizeSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bgColor },
        isSizeSmall ? styles.badgeSm : styles.badgeMd,
      ]}
    >
      {config.animated ? (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons
            name={config.icon}
            size={isSizeSmall ? 12 : 16}
            color={config.iconColor}
          />
        </Animated.View>
      ) : (
        <Ionicons
          name={config.icon}
          size={isSizeSmall ? 12 : 16}
          color={config.iconColor}
        />
      )}
      <Text
        style={[
          styles.badgeText,
          { color: config.textColor },
          isSizeSmall ? styles.badgeTextSm : styles.badgeTextMd,
        ]}
      >
        {config.text}
      </Text>
    </View>
  );
}

const makePlanStatusBadgeStyles = (tokens: any, colors: any, brand: any) => ({
  badge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: toRN(tokens.borderRadius.full),
    alignSelf: "flex-start" as const,
  },
  badgeSm: {
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[0.5]),
    paddingHorizontal: toRN(tokens.spacing[2]),
  },
  badgeMd: {
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    paddingHorizontal: toRN(tokens.spacing[3]),
  },
  badgeText: {
    fontFamily: fontFamily.groteskMedium,
  },
  badgeTextSm: {
    fontSize: toRN(tokens.typography.fontSize.xs),
  },
  badgeTextMd: {
    fontSize: toRN(tokens.typography.fontSize.sm),
  },
});
