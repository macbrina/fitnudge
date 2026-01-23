import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
  Share,
  StatusBar,
  Platform
} from "react-native";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Share2, RefreshCw } from "lucide-react-native";
import { DailyMotivation } from "@/services/api";
import {
  useShareDailyMotivation,
  useRegenerateDailyMotivation
} from "@/hooks/api/useDailyMotivations";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

interface DailyMotivationModalProps {
  visible: boolean;
  motivation: DailyMotivation;
  onClose: () => void;
  onRegenerateComplete?: (newMotivation: DailyMotivation) => void;
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

export function DailyMotivationModal({
  visible,
  motivation: initialMotivation,
  onClose,
  onRegenerateComplete
}: DailyMotivationModalProps) {
  const styles = useStyles(makeDailyMotivationModalStyles);
  const { colors, brandColors, isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;

  // Local state for motivation to handle regeneration
  const [motivation, setMotivation] = useState(initialMotivation);

  // Update local state when prop changes or modal opens
  useEffect(() => {
    if (visible) {
      setMotivation(initialMotivation);
    }
  }, [initialMotivation, visible]);

  const { mutate: shareMotivation } = useShareDailyMotivation();
  const { mutate: regenerateMotivation, isPending: isRegenerating } =
    useRegenerateDailyMotivation();

  // Check if user has unlimited_text_motivation feature
  const hasUnlimitedMotivation = useSubscriptionStore((state) =>
    state.hasFeature("unlimited_text_motivation")
  );

  // Animation values - starts off-screen at the bottom
  const translateY = useMemo(() => new Animated.Value(screenHeight), [screenHeight]);

  // Handle modal visibility animation - slide from bottom to top
  useEffect(() => {
    if (visible) {
      // Reset to off-screen position before animating in
      translateY.setValue(screenHeight);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        mass: 1,
        stiffness: 120,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true
      }).start();
    }
  }, [visible, translateY, screenHeight]);

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `"${motivation.message}"\n\n- ${t("home.daily_motivation_share_footer")}`,
        title: t("home.daily_motivation_share_title")
      });

      if (result.action === Share.sharedAction) {
        shareMotivation(motivation.id);
      }
    } catch (error) {
      console.error("Error sharing motivation:", error);
    }
  };

  const handleRegenerate = () => {
    regenerateMotivation(undefined, {
      onSuccess: (newMotivation) => {
        setMotivation(newMotivation);
        if (onRegenerateComplete) {
          onRegenerateComplete(newMotivation);
        }
      },
      onError: (error) => {
        console.error("Error regenerating motivation:", error);
      }
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Full Screen Modal Content */}
      <Animated.View
        style={[
          styles.modalContainer,
          {
            backgroundColor: colors.bg.canvas,
            transform: [{ translateY }]
          }
        ]}
      >
        {/* Close Button */}
        <TouchableOpacity
          style={[
            styles.closeButton,
            {
              top: insets.top + toRN(tokens.spacing[4]),
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"
            }
          ]}
          onPress={onClose}
          accessibilityLabel={t("common.close")}
          accessibilityRole="button"
        >
          <X size={24} color={colors.text.primary} strokeWidth={2} />
        </TouchableOpacity>

        {/* Scattered Glow Orbs */}
        <GlowOrb size={10} color={brandColors.primary} opacity={0.12} top={80} left={30} />
        <GlowOrb size={14} color={brandColors.primary} opacity={0.08} top={150} right={40} />
        <GlowOrb size={8} color={brandColors.primary} opacity={0.15} top={220} left={60} />
        <GlowOrb size={12} color={brandColors.primary} opacity={0.1} top={300} right={80} />
        <GlowOrb size={6} color={brandColors.primary} opacity={0.18} bottom={250} left={40} />
        <GlowOrb size={16} color={brandColors.primary} opacity={0.06} bottom={180} right={50} />
        <GlowOrb size={9} color={brandColors.primary} opacity={0.14} bottom={320} left={100} />
        <GlowOrb size={11} color={brandColors.primary} opacity={0.1} top={400} left={25} />

        {/* Decorative Quote Mark */}
        <Text
          style={[
            styles.quoteMark,
            {
              color: brandColors.primary,
              opacity: isDark ? 0.1 : 0.08
            }
          ]}
        >
          "
        </Text>

        {/* Motivation Text */}
        <View
          style={[
            styles.contentContainer,
            {
              paddingTop: insets.top + 100,
              paddingBottom: insets.bottom + 120
            }
          ]}
        >
          <Text style={[styles.motivationText, { color: colors.text.primary }]}>
            {motivation.message}
          </Text>
        </View>

        {/* Bottom Action Bar */}
        <View
          style={[
            styles.actionBar,
            {
              paddingBottom: insets.bottom + toRN(tokens.spacing[4]),
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)"
            }
          ]}
        >
          {hasUnlimitedMotivation && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"
                },
                isRegenerating && styles.actionButtonDisabled
              ]}
              onPress={handleRegenerate}
              disabled={isRegenerating}
              accessibilityLabel={t("home.generate_another_motivation")}
              accessibilityRole="button"
            >
              <RefreshCw
                size={18}
                color={brandColors.primary}
                strokeWidth={2}
                style={isRegenerating ? { opacity: 0.5 } : undefined}
              />
              <Text style={[styles.actionButtonText, { color: colors.text.primary }]}>
                {isRegenerating
                  ? t("home.generating_motivation")
                  : t("home.generate_another_motivation")}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: brandColors.primary }]}
            onPress={handleShare}
            accessibilityLabel={t("common.share")}
            accessibilityRole="button"
          >
            <Share2 size={18} color="#ffffff" strokeWidth={2} />
            <Text style={[styles.actionButtonText, { color: "#ffffff" }]}>{t("common.share")}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const makeDailyMotivationModalStyles = (tokens: any, colors: any, brand: any) => ({
  modalContainer: {
    flex: 1,
    width: "100%" as const,
    height: "100%" as const,
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  closeButton: {
    position: "absolute" as const,
    right: toRN(tokens.spacing[4]),
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  quoteMark: {
    position: "absolute" as const,
    top: 60,
    left: 20,
    fontSize: 200,
    fontFamily: fontFamily.bold,
    lineHeight: 200
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[8]),
    width: "100%" as const
  },
  motivationText: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.mediumItalic,
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize["2xl"]) * 1.5
  },
  actionBar: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    paddingVertical: toRN(tokens.spacing[4])
  },
  actionButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[5]),
    borderRadius: toRN(tokens.borderRadius.full),
    gap: toRN(tokens.spacing[2])
  },
  actionButtonDisabled: {
    opacity: 0.6
  },
  actionButtonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold
  }
});
