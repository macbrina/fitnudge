import React from "react";
import { Text, TextProps, Pressable, ViewStyle, StyleProp } from "react-native";
import { useInAppBrowser } from "./InAppBrowser";
import { useTheme } from "@/themes";

interface LinkTextProps extends Omit<TextProps, "style"> {
  /**
   * URL to open when pressed
   */
  url: string;
  /**
   * Title to display in the browser
   */
  title?: string;
  /**
   * Whether to show user choice between in-app and external browser
   */
  showChoice?: boolean;
  /**
   * Whether to open directly in external browser
   */
  openExternal?: boolean;
  /**
   * Custom text color (defaults to brand primary)
   */
  color?: string;
  /**
   * Whether to show underline
   */
  underline?: boolean;
  /**
   * Use as a container with flexbox support (wraps in Pressable instead of Text)
   */
  asContainer?: boolean;
  /**
   * Style - supports both TextStyle and ViewStyle depending on asContainer
   */
  style?: StyleProp<ViewStyle> | TextProps["style"];
}

/**
 * LinkText component for clickable text that opens URLs
 * Automatically handles in-app browser vs external browser
 * Use asContainer={true} when you need flexbox layout support
 */
export default function LinkText({
  url,
  title,
  showChoice = false,
  openExternal = false,
  color,
  underline = true,
  asContainer = false,
  style,
  children,
  ...props
}: LinkTextProps) {
  const { colors, brandColors } = useTheme();
  const { openBrowser, openWithChoice, openExternal: openExternalBrowser } = useInAppBrowser();

  const handlePress = () => {
    if (openExternal) {
      openExternalBrowser(url);
    } else if (showChoice) {
      openWithChoice({
        url,
        title,
        showOpenInBrowser: true,
        toolbarColor: brandColors.primary,
        controlsColor: colors.text.primary
      });
    } else {
      openBrowser({
        url,
        title,
        showOpenInBrowser: true,
        toolbarColor: brandColors.primary,
        controlsColor: colors.text.primary
      });
    }
  };

  // Use Pressable container for flexbox layout support
  if (asContainer) {
    return (
      <Pressable style={style as StyleProp<ViewStyle>} onPress={handlePress}>
        {children}
      </Pressable>
    );
  }

  // Default Text-based link
  return (
    <Text
      style={[
        {
          color: color || brandColors.primary,
          textDecorationLine: underline ? "underline" : "none"
        },
        style as TextProps["style"]
      ]}
      onPress={handlePress}
      {...props}
    >
      {children}
    </Text>
  );
}
