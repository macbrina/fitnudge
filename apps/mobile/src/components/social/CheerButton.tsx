import React, { useState } from "react";
import { TouchableOpacity, Text, ActivityIndicator, Animated } from "react-native";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useSendCheer } from "@/hooks/api/useNudges";
import { Ionicons } from "@expo/vector-icons";

interface CheerButtonProps {
  recipientId: string;
  goalId?: string;
  partnershipId?: string;
  checkInId?: string;
  initialCheered?: boolean;
  onSuccess?: () => void;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  style?: any;
}

export function CheerButton({
  recipientId,
  goalId,
  partnershipId,
  checkInId,
  initialCheered = false,
  onSuccess,
  size = "md",
  showLabel = false,
  style
}: CheerButtonProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [hasCheered, setHasCheered] = useState(initialCheered);
  const [scaleAnim] = useState(new Animated.Value(1));

  const sendCheerMutation = useSendCheer();

  const iconSize = size === "sm" ? 16 : size === "md" ? 20 : 24;
  const buttonSize = size === "sm" ? 32 : size === "md" ? 40 : 48;

  const animatePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.3,
        friction: 3,
        useNativeDriver: true
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true
      })
    ]).start();
  };

  const handlePress = async () => {
    if (hasCheered) return; // Already cheered this check-in

    animatePress();

    try {
      await sendCheerMutation.mutateAsync({
        recipientId,
        goalId,
        emoji: "🎉"
      });

      setHasCheered(true);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to send cheer:", error);
    }
  };

  const isSending = sendCheerMutation.isPending;

  const iconColor = hasCheered ? "#F59E0B" : colors.text.tertiary;
  const iconName = hasCheered ? "heart" : "heart-outline";

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isSending || hasCheered}
      style={[
        styles.button,
        {
          width: showLabel ? undefined : buttonSize,
          height: buttonSize,
          paddingHorizontal: showLabel ? toRN(tokens.spacing[3]) : 0,
          backgroundColor: hasCheered ? "#FEF3C7" : colors.bg.muted
        },
        style
      ]}
    >
      {isSending ? (
        <ActivityIndicator size="small" color="#F59E0B" />
      ) : (
        <>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Ionicons name={iconName} size={iconSize} color={iconColor} />
          </Animated.View>
          {showLabel && (
            <Text style={[styles.label, { color: hasCheered ? "#F59E0B" : colors.text.secondary }]}>
              {hasCheered ? t("social.cheered") : t("social.cheer")}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  button: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  label: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium
  }
});

export default CheerButton;
