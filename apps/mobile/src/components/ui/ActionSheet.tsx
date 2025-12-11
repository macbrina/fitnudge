import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";

export interface ActionSheetOption {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

export interface ActionSheetProps {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
  cancelLabel?: string;
  showCancel?: boolean;
}

/**
 * ActionSheet - A bottom sheet with action options
 *
 * Usage:
 * ```tsx
 * <ActionSheet
 *   visible={showOptions}
 *   title="Add Photo"
 *   options={[
 *     { id: 'camera', label: 'Take Photo', icon: 'camera-outline', onPress: handleCamera },
 *     { id: 'library', label: 'Choose from Library', icon: 'image-outline', onPress: handleLibrary },
 *   ]}
 *   onClose={() => setShowOptions(false)}
 * />
 * ```
 *
 * Note: This component uses absolute positioning and should be rendered
 * inside the parent container (e.g., a Modal) that you want it to overlay.
 */
export function ActionSheet({
  visible,
  title,
  options,
  onClose,
  cancelLabel = "Cancel",
  showCancel = true,
}: ActionSheetProps) {
  const styles = useStyles(makeActionSheetStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={[
          styles.container,
          { paddingBottom: insets.bottom + toRN(tokens.spacing[4]) },
        ]}
      >
        {title && <Text style={styles.title}>{title}</Text>}

        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.option,
              option.destructive && styles.optionDestructive,
            ]}
            onPress={() => {
              onClose();
              option.onPress();
            }}
            activeOpacity={0.7}
          >
            {option.icon && (
              <Ionicons
                name={option.icon}
                size={toRN(tokens.typography.fontSize["2xl"])}
                color={
                  option.destructive
                    ? colors.feedback.error
                    : colors.text.primary
                }
                style={styles.optionIcon}
              />
            )}
            <Text
              style={[
                styles.optionText,
                option.destructive && styles.optionTextDestructive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

        {showCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeActionSheetStyles = (tokens: any, colors: any, brand: any) => ({
  overlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end" as const,
    zIndex: 1000,
  },
  backdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
    padding: toRN(tokens.spacing[6]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
  },
  option: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    backgroundColor: colors.bg.muted,
    marginBottom: toRN(tokens.spacing[3]),
  },
  optionDestructive: {
    backgroundColor: colors.feedback.error + "15",
  },
  optionIcon: {
    marginRight: toRN(tokens.spacing[3]),
  },
  optionText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
    flex: 1,
  },
  optionTextDestructive: {
    color: colors.feedback.error,
  },
  cancelButton: {
    marginTop: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
  },
  cancelText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary,
  },
});
