import React, { useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

interface InAppBrowserOptions {
  /**
   * URL to open in the in-app browser
   */
  url: string;
  /**
   * Title to display in the browser header
   */
  title?: string;
  /**
   * Whether to show the browser controls
   */
  showControls?: boolean;
  /**
   * Whether to show the "Open in Browser" option
   */
  showOpenInBrowser?: boolean;
  /**
   * Custom presentation style (iOS only)
   */
  presentationStyle?: WebBrowser.WebBrowserPresentationStyle;
  /**
   * Custom toolbar color
   */
  toolbarColor?: string;
  /**
   * Custom controls color
   */
  controlsColor?: string;
  /**
   * Whether to show the title in the browser
   */
  showTitle?: boolean;
  /**
   * Whether to enable bar collapsing
   */
  enableBarCollapsing?: boolean;
  /**
   * Whether to show in recent apps (Android only)
   */
  showInRecents?: boolean;
}

/**
 * InAppBrowser component for opening URLs in a native in-app browser
 * Uses Expo WebBrowser for consistent cross-platform experience
 */
export const InAppBrowser = {
  /**
   * Open a URL in the in-app browser
   */
  open: async (options: InAppBrowserOptions): Promise<void> => {
    const {
      url,
      title,
      showControls = true,
      showOpenInBrowser = true,
      presentationStyle = WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      toolbarColor = "#007AFF",
      controlsColor = "#FFFFFF",
      showTitle = true,
      enableBarCollapsing = false,
      showInRecents = false,
    } = options;

    try {
      // Validate URL
      if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
        throw new Error("Invalid URL provided");
      }

      // Configure browser options
      const browserOptions: WebBrowser.WebBrowserOpenOptions = {
        presentationStyle,
        controlsColor,
        showTitle,
        enableBarCollapsing,
        showInRecents,
        // Add custom toolbar color for Android
        ...(Platform.OS === "android" && { toolbarColor }),
      };

      // Open the browser
      const result = await WebBrowser.openBrowserAsync(url, browserOptions);

      // Handle the result
      switch (result.type) {
        case "cancel":
          console.log("User cancelled the browser");
          break;
        case "dismiss":
          console.log("User dismissed the browser");
          break;
        default:
          console.log("Browser closed normally");
      }
    } catch (error) {
      console.error("Error opening in-app browser:", error);

      // Fallback to external browser if in-app browser fails
      if (showOpenInBrowser) {
        Alert.alert(
          "Open Link",
          "Unable to open in-app browser. Would you like to open in external browser?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open in Browser",
              onPress: () => Linking.openURL(url),
            },
          ]
        );
      } else {
        Alert.alert("Error", "Unable to open the link");
      }
    }
  },

  /**
   * Open a URL with user choice between in-app and external browser
   */
  openWithChoice: async (options: InAppBrowserOptions): Promise<void> => {
    const { url, title } = options;

    Alert.alert(title || "Open Link", "How would you like to open this link?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "In App",
        onPress: () => InAppBrowser.open(options),
      },
      {
        text: "External Browser",
        onPress: () => Linking.openURL(url),
      },
    ]);
  },

  /**
   * Open a URL directly in external browser
   */
  openExternal: async (url: string): Promise<void> => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open this URL");
      }
    } catch (error) {
      console.error("Error opening external browser:", error);
      Alert.alert("Error", "Unable to open the link");
    }
  },

  /**
   * Check if a URL can be opened
   */
  canOpen: async (url: string): Promise<boolean> => {
    try {
      return await Linking.canOpenURL(url);
    } catch {
      return false;
    }
  },
};

/**
 * Hook for using InAppBrowser with state management
 */
export const useInAppBrowser = () => {
  const [isLoading, setIsLoading] = useState(false);

  const openBrowser = async (options: InAppBrowserOptions) => {
    setIsLoading(true);
    try {
      await InAppBrowser.open(options);
    } finally {
      setIsLoading(false);
    }
  };

  const openWithChoice = async (options: InAppBrowserOptions) => {
    setIsLoading(true);
    try {
      await InAppBrowser.openWithChoice(options);
    } finally {
      setIsLoading(false);
    }
  };

  const openExternal = async (url: string) => {
    setIsLoading(true);
    try {
      await InAppBrowser.openExternal(url);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    openBrowser,
    openWithChoice,
    openExternal,
    isLoading,
  };
};

export default InAppBrowser;
