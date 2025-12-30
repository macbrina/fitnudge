import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";

export interface BottomMenuOption {
  id: string;
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface BottomMenuInfoLink {
  id: string;
  label: string;
  description?: string;
  onPress?: () => void;
}

export interface BottomMenuSection {
  id: string;
  options: BottomMenuOption[];
}

export interface BottomMenuSheetProps {
  visible: boolean;
  title?: string;
  /** Simple flat list of options (legacy support) */
  options?: BottomMenuOption[];
  /** Grouped sections of options (Facebook-style) */
  sections?: BottomMenuSection[];
  /** Info link shown above options (e.g., "Why am I seeing this?") */
  infoLink?: BottomMenuInfoLink;
  onClose: () => void;
  cancelLabel?: string;
  showCancel?: boolean;
}

/**
 * BottomMenuSheet - A modal bottom sheet with action options
 *
 * Supports both flat list of options and grouped sections (Facebook-style).
 * Features:
 * - Drag handle indicator
 * - Grouped sections with separators
 * - Option descriptions/subtitles
 * - Info links (like "Why am I seeing this?")
 * - Proper iconography with circle backgrounds
 *
 * Usage with flat options:
 * ```tsx
 * <BottomMenuSheet
 *   visible={showMenu}
 *   title="Goal Options"
 *   options={[
 *     { id: 'edit', label: 'Edit Goal', icon: 'create-outline', onPress: handleEdit },
 *     { id: 'delete', label: 'Delete Goal', icon: 'trash-outline', destructive: true, onPress: handleDelete },
 *   ]}
 *   onClose={() => setShowMenu(false)}
 * />
 * ```
 *
 * Usage with grouped sections:
 * ```tsx
 * <BottomMenuSheet
 *   visible={showMenu}
 *   title="Goal Options"
 *   infoLink={{ id: 'info', label: 'Why am I seeing this?', description: 'This goal is active' }}
 *   sections={[
 *     {
 *       id: 'actions',
 *       options: [
 *         { id: 'share', label: 'Share Goal', description: 'Share with friends', icon: 'share-outline', onPress: handleShare },
 *       ],
 *     },
 *     {
 *       id: 'danger',
 *       options: [
 *         { id: 'delete', label: 'Delete Goal', icon: 'trash-outline', destructive: true, onPress: handleDelete },
 *       ],
 *     },
 *   ]}
 *   onClose={() => setShowMenu(false)}
 * />
 * ```
 */
export function BottomMenuSheet({
  visible,
  title,
  options,
  sections,
  infoLink,
  onClose,
  cancelLabel = "Cancel",
  showCancel = true,
}: BottomMenuSheetProps) {
  const styles = useStyles(makeBottomMenuSheetStyles);
  const { colors, brandColors } = useTheme();
  const insets = useSafeAreaInsets();

  // Animation
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset for next open
      slideAnim.setValue(400);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleClose = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleOptionPress = (option: BottomMenuOption) => {
    if (option.disabled) return;

    // Close first, then execute action
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      option.onPress();
    });
  };

  const handleInfoLinkPress = () => {
    if (infoLink?.onPress) {
      handleClose();
      infoLink.onPress();
    }
  };

  const renderOption = (option: BottomMenuOption, isLast: boolean = false) => {
    const isDestructive = option.destructive;
    const isDisabled = option.disabled;

    return (
      <TouchableOpacity
        key={option.id}
        style={[
          styles.option,
          isLast && styles.optionLast,
          isDisabled && styles.optionDisabled,
        ]}
        onPress={() => handleOptionPress(option)}
        activeOpacity={isDisabled ? 1 : 0.7}
        disabled={isDisabled}
      >
        {option.icon && (
          <View
            style={[
              styles.iconContainer,
              isDestructive && styles.iconContainerDestructive,
              isDisabled && styles.iconContainerDisabled,
            ]}
          >
            <Ionicons
              name={option.icon}
              size={toRN(tokens.typography.fontSize.xl)}
              color={
                isDisabled
                  ? colors.text.muted
                  : isDestructive
                    ? colors.feedback.error
                    : colors.text.primary
              }
            />
          </View>
        )}
        <View style={styles.optionContent}>
          <Text
            style={[
              styles.optionLabel,
              isDestructive && styles.optionLabelDestructive,
              isDisabled && styles.optionLabelDisabled,
            ]}
          >
            {option.label}
          </Text>
          {option.description && (
            <Text
              style={[
                styles.optionDescription,
                isDisabled && styles.optionDescriptionDisabled,
              ]}
            >
              {option.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Convert flat options to single section if needed
  const effectiveSections: BottomMenuSection[] = sections || [
    { id: "default", options: options || [] },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.container,
            {
              paddingBottom: insets.bottom + toRN(tokens.spacing[4]),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Drag Handle Indicator */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Title */}
          {title && <Text style={styles.title}>{title}</Text>}

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Info Link (like "Why am I seeing this?") */}
            {infoLink && (
              <TouchableOpacity
                style={styles.infoLinkContainer}
                onPress={handleInfoLinkPress}
                activeOpacity={infoLink.onPress ? 0.7 : 1}
              >
                <Text style={styles.infoLinkLabel}>{infoLink.label}</Text>
                {infoLink.description && (
                  <Text style={styles.infoLinkDescription}>
                    {infoLink.description}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Sections */}
            {effectiveSections.map((section, sectionIndex) => (
              <View key={section.id}>
                {/* Section separator */}
                {sectionIndex > 0 && <View style={styles.sectionSeparator} />}

                {/* Section options */}
                <View style={styles.sectionContainer}>
                  {section.options.map((option, optionIndex) =>
                    renderOption(
                      option,
                      optionIndex === section.options.length - 1,
                    ),
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Cancel Button */}
          {showCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeBottomMenuSheetStyles = (tokens: any, colors: any, brand: any) => ({
  overlay: {
    flex: 1,
    justifyContent: "flex-end" as const,
  },
  backdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdropTouchable: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
    maxHeight: "80%",
  },
  dragHandleContainer: {
    alignItems: "center" as const,
    paddingTop: toRN(tokens.spacing[3]),
    paddingBottom: toRN(tokens.spacing[2]),
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6]),
    paddingBottom: toRN(tokens.spacing[3]),
  },
  scrollView: {
    flexGrow: 0,
  },

  // Info Link (Why am I seeing this?)
  infoLinkContainer: {
    backgroundColor: colors.bg.muted,
    marginHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
  },
  infoLinkLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  infoLinkDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },

  // Section
  sectionContainer: {
    backgroundColor: colors.bg.muted,
    marginHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    overflow: "hidden" as const,
  },
  sectionSeparator: {
    height: toRN(tokens.spacing[3]),
  },

  // Option
  option: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3.5] || tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default + "30",
  },
  optionLast: {
    borderBottomWidth: 0,
  },
  optionDisabled: {
    opacity: 0.5,
  },

  // Icon container (circle background like Facebook)
  iconContainer: {
    width: toRN(36),
    height: toRN(36),
    borderRadius: toRN(18),
    backgroundColor: colors.bg.surface,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  iconContainerDestructive: {
    backgroundColor: colors.feedback.error + "15",
  },
  iconContainerDisabled: {
    backgroundColor: colors.bg.muted,
  },

  // Option content
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  optionLabelDestructive: {
    color: colors.feedback.error,
  },
  optionLabelDisabled: {
    color: colors.text.muted,
  },
  optionDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5] || 2),
  },
  optionDescriptionDisabled: {
    color: colors.text.muted,
  },

  // Cancel button
  cancelButton: {
    marginTop: toRN(tokens.spacing[3]),
    marginHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3.5] || tokens.spacing[3]),
    alignItems: "center" as const,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
  },
  cancelText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary,
  },
});
