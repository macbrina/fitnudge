import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
  LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";

// Menu item types
export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "default" | "danger" | "primary";
  disabled?: boolean;
  onPress: () => void | Promise<void>;
}

export interface DropdownMenuProps {
  /** Menu items to display */
  items: DropdownMenuItem[];
  /** Custom trigger element - defaults to 3 dots */
  trigger?: React.ReactNode;
  /** Icon name for default trigger */
  triggerIcon?: keyof typeof Ionicons.glyphMap;
  /** Size of the trigger icon */
  triggerIconSize?: number;
  /** Color of the trigger icon */
  triggerIconColor?: string;
  /** Position of dropdown relative to trigger */
  position?: "left" | "right";
  /** Minimum width of dropdown */
  minWidth?: number;
  /** Whether dropdown is disabled */
  disabled?: boolean;
  /** Callback when menu opens */
  onOpen?: () => void;
  /** Callback when menu closes */
  onClose?: () => void;
  /** Style for the container */
  style?: ViewStyle;
  /** Style for the trigger button */
  triggerStyle?: ViewStyle;
}

export function DropdownMenu({
  items,
  trigger,
  triggerIcon = "ellipsis-horizontal",
  triggerIconSize,
  triggerIconColor,
  position = "right",
  minWidth = 150,
  disabled = false,
  onOpen,
  onClose,
  style,
  triggerStyle,
}: DropdownMenuProps) {
  const { colors, brandColors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState({ width: 0, height: 0 });

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setVisible(true);
    onOpen?.();
  }, [disabled, onOpen]);

  const handleClose = useCallback(() => {
    setVisible(false);
    onClose?.();
  }, [onClose]);

  const handleToggle = useCallback(() => {
    if (visible) {
      handleClose();
    } else {
      handleOpen();
    }
  }, [visible, handleOpen, handleClose]);

  const handleItemPress = useCallback(
    async (item: DropdownMenuItem) => {
      if (item.disabled) return;
      handleClose();
      await item.onPress();
    },
    [handleClose],
  );

  const handleTriggerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setTriggerLayout({ width, height });
  };

  const getVariantColors = (variant: DropdownMenuItem["variant"]) => {
    switch (variant) {
      case "danger":
        return {
          text: colors.feedback?.error || "#EF4444",
          icon: colors.feedback?.error || "#EF4444",
        };
      case "primary":
        return {
          text: brandColors.primary,
          icon: brandColors.primary,
        };
      default:
        return {
          text: colors.text.primary,
          icon: colors.text.secondary,
        };
    }
  };

  const styles = makeStyles(colors, brandColors, position, minWidth);

  return (
    <View style={[styles.container, style]}>
      {/* Trigger Button */}
      <TouchableOpacity
        style={[styles.trigger, triggerStyle]}
        onPress={handleToggle}
        onLayout={handleTriggerLayout}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {trigger || (
          <Ionicons
            name={triggerIcon}
            size={triggerIconSize || toRN(tokens.typography.fontSize.xl)}
            color={
              triggerIconColor ||
              (disabled ? colors.text.muted : colors.text.tertiary)
            }
          />
        )}
      </TouchableOpacity>

      {/* Dropdown Menu */}
      {visible && (
        <>
          {/* Invisible overlay to close menu when tapping outside */}
          <Pressable style={styles.overlay} onPress={handleClose} />

          {/* Menu Dropdown */}
          <View
            style={[
              styles.dropdown,
              position === "left" ? styles.dropdownLeft : styles.dropdownRight,
            ]}
          >
            {items.map((item, index) => {
              const variantColors = getVariantColors(item.variant);
              const isLast = index === items.length - 1;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.menuItem,
                    !isLast && styles.menuItemBorder,
                    item.disabled && styles.menuItemDisabled,
                  ]}
                  onPress={() => handleItemPress(item)}
                  disabled={item.disabled}
                  activeOpacity={0.7}
                >
                  {item.icon && (
                    <Ionicons
                      name={item.icon}
                      size={toRN(tokens.typography.fontSize.lg)}
                      color={
                        item.disabled ? colors.text.muted : variantColors.icon
                      }
                      style={styles.menuItemIcon}
                    />
                  )}
                  <Text
                    style={[
                      styles.menuItemText,
                      { color: variantColors.text },
                      item.disabled && styles.menuItemTextDisabled,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

// Convenience component for common kebab menu pattern
export interface KebabMenuProps
  extends Omit<DropdownMenuProps, "trigger" | "triggerIcon"> {
  /** Orientation of the dots */
  orientation?: "horizontal" | "vertical";
}

export function KebabMenu({
  orientation = "horizontal",
  ...props
}: KebabMenuProps) {
  return (
    <DropdownMenu
      {...props}
      triggerIcon={
        orientation === "horizontal"
          ? "ellipsis-horizontal"
          : "ellipsis-vertical"
      }
    />
  );
}

const makeStyles = (
  colors: any,
  brandColors: any,
  position: "left" | "right",
  minWidth: number,
) =>
  StyleSheet.create({
    container: {
      position: "relative",
      zIndex: 100,
    },
    trigger: {
      padding: toRN(tokens.spacing[1]),
    },
    overlay: {
      position: "absolute",
      top: -1000,
      left: -1000,
      right: -1000,
      bottom: -1000,
      width: 5000,
      height: 5000,
      zIndex: 999,
    },
    dropdown: {
      position: "absolute",
      top: toRN(tokens.spacing[8]),
      backgroundColor: colors.bg.surface,
      borderRadius: toRN(tokens.borderRadius.lg),
      paddingVertical: toRN(tokens.spacing[1]),
      minWidth: minWidth,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      zIndex: 1000,
      borderWidth: 1,
      borderColor: colors.border?.subtle || colors.border?.default || "#E5E7EB",
    },
    dropdownLeft: {
      left: 0,
    },
    dropdownRight: {
      right: 0,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: toRN(tokens.spacing[3]),
      paddingHorizontal: toRN(tokens.spacing[4]),
    },
    menuItemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border?.subtle || colors.border?.default || "#E5E7EB",
    },
    menuItemDisabled: {
      opacity: 0.5,
    },
    menuItemIcon: {
      marginRight: toRN(tokens.spacing[3]),
    },
    menuItemText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.medium,
    },
    menuItemTextDisabled: {
      color: colors.text.disabled,
    },
  });

export default DropdownMenu;
