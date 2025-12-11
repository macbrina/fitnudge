import React from "react";
import { Text, TextProps } from "react-native";
import { useInAppBrowser } from "./InAppBrowser";
import { useTheme } from "@/themes";

interface LinkTextProps extends TextProps {
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
}

/**
 * LinkText component for clickable text that opens URLs
 * Automatically handles in-app browser vs external browser
 */
export default function LinkText({
  url,
  title,
  showChoice = false,
  openExternal = false,
  color,
  underline = true,
  style,
  children,
  ...props
}: LinkTextProps) {
  const { colors, brandColors } = useTheme();
  const {
    openBrowser,
    openWithChoice,
    openExternal: openExternalBrowser,
  } = useInAppBrowser();

  const handlePress = () => {
    if (openExternal) {
      openExternalBrowser(url);
    } else if (showChoice) {
      openWithChoice({
        url,
        title,
        showOpenInBrowser: true,
        toolbarColor: brandColors.primary,
        controlsColor: colors.text.primary,
      });
    } else {
      openBrowser({
        url,
        title,
        showOpenInBrowser: true,
        toolbarColor: brandColors.primary,
        controlsColor: colors.text.primary,
      });
    }
  };

  return (
    <Text
      style={[
        {
          color: color || brandColors.primary,
          textDecorationLine: underline ? "underline" : "none",
        },
        style,
      ]}
      onPress={handlePress}
      {...props}
    >
      {children}
    </Text>
  );
}
