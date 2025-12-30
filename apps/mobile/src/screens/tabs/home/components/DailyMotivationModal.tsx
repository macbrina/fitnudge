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
  StyleSheet,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DailyMotivation } from "@/services/api";
import {
  useShareDailyMotivation,
  useRegenerateDailyMotivation,
} from "@/hooks/api/useDailyMotivations";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { getContrastingTextColor } from "@/utils/helper";

interface DailyMotivationModalProps {
  visible: boolean;
  motivation: DailyMotivation;
  onClose: () => void;
  onRegenerateComplete?: (newMotivation: DailyMotivation) => void;
}

// Fallback gradient colors if API doesn't provide them (shouldn't happen, but safety first)
const getFallbackGradient = (style: string): string[] => {
  switch (style) {
    case "gradient_sunset":
      return ["#FF9A9E", "#FECFEF", "#FECFEF"];
    case "gradient_mountain":
      return ["#E0C3FC", "#C8A8FF", "#9B7BFF"];
    case "gradient_ocean":
      return ["#667EEA", "#764BA2", "#667EEA"];
    case "gradient_forest":
      return ["#84FAB0", "#8FD3F4", "#84FAB0"];
    case "gradient_purple":
      return ["#A8EDEA", "#FED6E3", "#D299C2"];
    case "gradient_pink":
      return ["#FFECD2", "#FCB69F", "#FF9A9E"];
    default:
      return ["#FF9A9E", "#FECFEF", "#FECFEF"]; // Default sunset
  }
};

export function DailyMotivationModal({
  visible,
  motivation: initialMotivation,
  onClose,
  onRegenerateComplete,
}: DailyMotivationModalProps) {
  const styles = useStyles(makeDailyMotivationModalStyles);
  const { colors } = useTheme();
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
    state.hasFeature("unlimited_text_motivation"),
  );

  // Animation values - starts off-screen at the bottom
  const translateY = useMemo(() => new Animated.Value(screenHeight), []);

  // Handle modal visibility animation - slide from bottom to top
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        mass: 1,
        stiffness: 120,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY, screenHeight]);

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `${motivation.message}\n\n- ${t("home.daily_motivation_share_footer")}`,
        title: t("home.daily_motivation_share_title"),
      });

      // Only increment share count if sharing was successful
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
        // Update local state immediately
        setMotivation(newMotivation);
        // Notify parent to refetch (which will update the prop)
        if (onRegenerateComplete) {
          onRegenerateComplete(newMotivation);
        }
      },
      onError: (error) => {
        console.error("Error regenerating motivation:", error);
        // You might want to show an error toast here
      },
    });
  };

  // Use colors from API response, fallback to style-based mapping if not provided
  const gradientColors =
    motivation.background_colors && motivation.background_colors.length > 0
      ? motivation.background_colors
      : getFallbackGradient(motivation.background_style);

  // Calculate contrasting text color based on gradient
  const textColor = getContrastingTextColor(gradientColors);
  const buttonTextColor = textColor; // Use same color for buttons
  const closeButtonBg =
    textColor === "#000000"
      ? "rgba(0, 0, 0, 0.15)"
      : "rgba(255, 255, 255, 0.2)";
  const actionButtonBg =
    textColor === "#000000"
      ? "rgba(0, 0, 0, 0.15)"
      : "rgba(255, 255, 255, 0.2)";
  const actionBarBg =
    textColor === "#000000" ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)";

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />

      {/* Full Screen Modal Content */}
      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Gradient Background using SVG */}
        <View style={styles.gradientContainer}>
          <Svg
            width={Dimensions.get("window").width}
            height={
              Dimensions.get("window").height + insets.top + insets.bottom
            }
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <SvgLinearGradient
                id="backgroundGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                {gradientColors.map((color, index) => (
                  <Stop
                    key={index}
                    offset={`${(index / (gradientColors.length - 1)) * 100}%`}
                    stopColor={color}
                    stopOpacity="1"
                  />
                ))}
              </SvgLinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#backgroundGradient)" />
          </Svg>

          {/* Close Button */}
          <TouchableOpacity
            style={[
              styles.closeButton,
              {
                top: insets.top + toRN(tokens.spacing[4]),
                backgroundColor: closeButtonBg,
              },
            ]}
            onPress={onClose}
            accessibilityLabel={t("common.close")}
            accessibilityRole="button"
          >
            <Ionicons
              name="close"
              size={toRN(tokens.typography.fontSize["2xl"])}
              color={textColor}
            />
          </TouchableOpacity>

          {/* Motivation Text */}
          <View
            style={[
              styles.contentContainer,
              {
                paddingTop: insets.top + toRN(tokens.spacing[20]),
                paddingBottom: insets.bottom + toRN(tokens.spacing[20]),
              },
            ]}
          >
            <Text style={[styles.motivationText, { color: textColor }]}>
              {motivation.message}
            </Text>
          </View>

          {/* Bottom Action Bar */}
          <View
            style={[
              styles.actionBar,
              {
                paddingBottom: insets.bottom + toRN(tokens.spacing[4]),
                backgroundColor: actionBarBg,
              },
            ]}
          >
            {hasUnlimitedMotivation && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: actionButtonBg },
                  isRegenerating && styles.actionButtonDisabled,
                ]}
                onPress={handleRegenerate}
                disabled={isRegenerating}
                accessibilityLabel={t("home.generate_another_motivation")}
                accessibilityRole="button"
              >
                <Ionicons
                  name={isRegenerating ? "refresh" : "refresh-outline"}
                  size={toRN(tokens.typography.fontSize.xl)}
                  color={buttonTextColor}
                />
                <Text
                  style={[styles.actionButtonText, { color: buttonTextColor }]}
                >
                  {isRegenerating
                    ? t("home.generating_motivation")
                    : t("home.generate_another_motivation")}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: actionButtonBg }]}
              onPress={handleShare}
              accessibilityLabel={t("common.share")}
              accessibilityRole="button"
            >
              <Ionicons
                name="share-outline"
                size={toRN(tokens.typography.fontSize.xl)}
                color={buttonTextColor}
              />
              <Text
                style={[styles.actionButtonText, { color: buttonTextColor }]}
              >
                {t("common.share")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const makeDailyMotivationModalStyles = (
  tokens: any,
  colors: any,
  brand: any,
) => ({
  modalContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    right: toRN(tokens.spacing[4]),
    zIndex: 10,
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    // backgroundColor is set dynamically based on text color
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: toRN(tokens.spacing[6]),
    width: "100%",
  },
  motivationText: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.bold,
    // color is set dynamically based on gradient luminance
    textAlign: "center",
    lineHeight: toRN(tokens.typography.fontSize["3xl"]) * 1.4,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    paddingVertical: toRN(tokens.spacing[4]),
    // backgroundColor is set dynamically based on text color
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    borderRadius: toRN(tokens.borderRadius.full),
    // backgroundColor is set dynamically based on text color
    gap: toRN(tokens.spacing[2]),
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    // color is set dynamically based on gradient luminance
  },
});
