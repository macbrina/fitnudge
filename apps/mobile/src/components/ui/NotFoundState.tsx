import React from "react";
import { View, Text, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import Button from "./Button";

export interface NotFoundStateProps {
  /** Main title - defaults to translation key "errors.not_found_title" */
  title?: string;
  /** Description text - defaults to translation key "errors.not_found_description" */
  description?: string;
  /** Icon name from Ionicons - defaults to "search-outline" */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Whether to show the go back button - defaults to true */
  showBackButton?: boolean;
  /** Custom back button label */
  backButtonLabel?: string;
  /** Custom back button action - defaults to router.back() */
  onBack?: () => void;
  /** Optional action button */
  actionButton?: {
    label: string;
    onPress: () => void;
    variant?: "primary" | "outline" | "ghost";
  };
  /** Additional container style */
  style?: ViewStyle;
}

export function NotFoundState({
  title,
  description,
  icon = "search-outline",
  showBackButton = true,
  backButtonLabel,
  onBack,
  actionButton,
  style,
}: NotFoundStateProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const displayTitle = title || t("errors.not_found_title") || "Not Found";
  const displayDescription =
    description ||
    t("errors.not_found_description") ||
    "The content you're looking for doesn't exist or has been removed.";
  const displayBackLabel = backButtonLabel || t("common.go_back") || "Go Back";

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Illustration */}
      <View style={styles.illustrationContainer}>
        <View style={styles.iconRing}>
          <View style={styles.iconInner}>
            <Ionicons name={icon} size={40} color={brandColors.primary} />
          </View>
        </View>
        {/* Decorative dots */}
        <View style={[styles.dot, styles.dotTopLeft]} />
        <View style={[styles.dot, styles.dotTopRight]} />
        <View style={[styles.dot, styles.dotBottomLeft]} />
        <View style={[styles.dot, styles.dotBottomRight]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>{displayTitle}</Text>
        <Text style={styles.description}>{displayDescription}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {actionButton && (
          <Button
            title={actionButton.label}
            onPress={actionButton.onPress}
            variant={actionButton.variant || "primary"}
            style={styles.actionButton}
          />
        )}
        {showBackButton && (
          <Button
            title={displayBackLabel}
            onPress={handleBack}
            variant={actionButton ? "outline" : "primary"}
            leftIcon="arrow-back"
            style={styles.actionButton}
          />
        )}
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6]),
    paddingVertical: toRN(tokens.spacing[8]),
  },
  illustrationContainer: {
    position: "relative" as const,
    marginBottom: toRN(tokens.spacing[6]),
  },
  iconRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${brand.primary}08`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  iconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${brand.primary}15`,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  dot: {
    position: "absolute" as const,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: `${brand.primary}25`,
  },
  dotTopLeft: {
    top: 8,
    left: 8,
  },
  dotTopRight: {
    top: 16,
    right: 4,
  },
  dotBottomLeft: {
    bottom: 16,
    left: 4,
  },
  dotBottomRight: {
    bottom: 8,
    right: 8,
  },
  content: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[6]),
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: toRN(tokens.typography.fontSize.xl),
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  description: {
    fontFamily: fontFamily.regular,
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    maxWidth: 300,
  },
  actions: {
    gap: toRN(tokens.spacing[3]),
    width: "100%" as const,
    maxWidth: 280,
  },
  actionButton: {
    width: "100%" as const,
  },
});

export default NotFoundState;
