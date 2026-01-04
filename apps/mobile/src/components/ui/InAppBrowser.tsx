import React, { useState } from "react";
import { Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useTranslation } from "@/lib/i18n";

interface AlertCallbacks {
  showAlert: (options: {
    title: string;
    message: string;
    variant?: "success" | "warning" | "error" | "info";
    confirmLabel?: string;
  }) => Promise<boolean>;
  showConfirm: (options: {
    title: string;
    message: string;
    variant?: "success" | "warning" | "error" | "info";
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
  t?: (key: string) => string; // Translation function (optional)
}

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
  /**
   * Optional alert callbacks for error handling (from useAlertModal)
   */
  alertCallbacks?: AlertCallbacks;
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
      showInRecents = false
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
        ...(Platform.OS === "android" && { toolbarColor })
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
      if (showOpenInBrowser && options.alertCallbacks) {
        // Get translated strings from callbacks if available
        const t = options.alertCallbacks.t || ((key: string) => key);
        const confirmed = await options.alertCallbacks.showConfirm({
          title: t("browser.open_link"),
          message: t("browser.unable_to_open_in_app"),
          variant: "warning",
          confirmLabel: t("browser.open_in_browser"),
          cancelLabel: t("common.cancel")
        });
        if (confirmed) {
          await Linking.openURL(url);
        }
      } else if (options.alertCallbacks) {
        const t = options.alertCallbacks.t || ((key: string) => key);
        await options.alertCallbacks.showAlert({
          title: t("common.error"),
          message: t("browser.unable_to_open_link"),
          variant: "error",
          confirmLabel: t("common.ok")
        });
      } else {
        // Fallback to console if no alert callbacks provided
        console.error("Unable to open the link:", error);
      }
    }
  },

  /**
   * Open a URL with user choice between in-app and external browser
   */
  openWithChoice: async (options: InAppBrowserOptions): Promise<void> => {
    const { url, title } = options;

    // Note: Action sheet with multiple options requires a different UI pattern
    // For now, this defaults to opening in-app browser
    // A proper action sheet component should be created for multiple-choice dialogs
    if (options.alertCallbacks) {
      const t = options.alertCallbacks.t || ((key: string) => key);
      const choice = await options.alertCallbacks.showConfirm({
        title: title || t("browser.open_link"),
        message: t("browser.would_like_external"),
        variant: "info",
        confirmLabel: t("browser.external_browser"),
        cancelLabel: t("browser.in_app")
      });
      if (choice) {
        await Linking.openURL(url);
      } else {
        await InAppBrowser.open({
          ...options,
          alertCallbacks: options.alertCallbacks
        });
      }
    } else {
      // Fallback: just open in-app
      await InAppBrowser.open(options);
    }
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
        // Note: This function doesn't receive alertCallbacks, so we just throw
        // Callers should catch and handle errors
        throw new Error("Cannot open this URL");
      }
    } catch (error) {
      console.error("Error opening external browser:", error);
      throw error; // Re-throw for caller to handle
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
  }
};

/**
 * Hook for using InAppBrowser with state management and AlertModalContext
 */
export const useInAppBrowser = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { showAlert, showConfirm } = useAlertModal();
  const { t } = useTranslation();

  const alertCallbacks: AlertCallbacks = {
    showAlert,
    showConfirm,
    t
  };

  const openBrowser = async (options: InAppBrowserOptions) => {
    setIsLoading(true);
    try {
      await InAppBrowser.open({ ...options, alertCallbacks });
    } finally {
      setIsLoading(false);
    }
  };

  const openWithChoice = async (options: InAppBrowserOptions) => {
    setIsLoading(true);
    try {
      await InAppBrowser.openWithChoice({ ...options, alertCallbacks });
    } finally {
      setIsLoading(false);
    }
  };

  const openExternal = async (url: string) => {
    setIsLoading(true);
    try {
      await InAppBrowser.openExternal(url);
    } catch (error) {
      await showAlert({
        title: t("common.error"),
        message: error instanceof Error ? error.message : t("browser.unable_to_open_link"),
        variant: "error",
        confirmLabel: t("common.ok")
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    openBrowser,
    openWithChoice,
    openExternal,
    isLoading
  };
};

export default InAppBrowser;
