import React, { useState, useCallback, useRef } from "react";
import { View, ActivityIndicator, Linking, Text } from "react-native";
import { WebView, WebViewNavigation, WebViewMessageEvent } from "react-native-webview";
import { useRouter } from "expo-router";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { BackButton } from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { useExternalUrls } from "@/hooks/api/useAppConfig";
import { useMediaPermissions } from "@/hooks/media/useMediaPermissions";

export default function LiveChatScreen() {
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { brandColors, colors } = useTheme();
  const { t } = useTranslation();
  const externalUrls = useExternalUrls();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Media permissions for file uploads
  const { hasAnyPermission, canAskCamera, canAskLibrary, requestAllPermissions } =
    useMediaPermissions();

  // Handle WebView load complete - request media permissions if needed
  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);

    // Request media permissions if not granted (for file/image uploads in chat)
    if (!hasAnyPermission && (canAskCamera || canAskLibrary)) {
      // Request permissions silently - don't block the chat
      requestAllPermissions().catch(() => {});
    }
  }, [hasAnyPermission, canAskCamera, canAskLibrary, requestAllPermissions]);

  // Handle WebView errors
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Handle messages from WebView (for future integration)
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("[LiveChat] Message from WebView:", data);
    } catch {
      // Not JSON, ignore
    }
  }, []);

  // Retry loading the chat
  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  // Handle URL requests to prevent errors with internal URLs
  const handleShouldStartLoad = useCallback((event: WebViewNavigation) => {
    const { url } = event;

    // Allow internal WebView URLs (about:, blob:, data:, js protocol)

    const internalSchemes = ["about:", "blob:", "data:", "javascript:"];
    if (internalSchemes.some((scheme) => url.startsWith(scheme))) {
      return true;
    }

    // Allow the main chat URL and its subpages
    if (url.includes("tawk.to") || url.includes(externalUrls.tawkChat)) {
      return true;
    }

    // Open external links in the browser
    if (url.startsWith("http://") || url.startsWith("https://")) {
      Linking.openURL(url).catch(() => {});
      return false;
    }

    return true;
  }, []);

  return (
    <View style={styles.container}>
      <BackButton title={t("contact.live_chat") || "Live Chat"} onPress={() => router.back()} />

      <View style={styles.webViewContainer}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={brandColors.primary} />
          </View>
        )}

        {hasError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>
              {t("contact.chat_error_title") || "Unable to load chat"}
            </Text>
            <Text style={styles.errorMessage}>
              {t("contact.chat_error_message") ||
                "Please check your internet connection and try again."}
            </Text>
            <Button
              title={t("common.retry") || "Retry"}
              onPress={handleRetry}
              variant="primary"
              style={styles.retryButton}
            />
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: externalUrls.tawkChat }}
            style={styles.webView}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            onHttpError={handleError}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            originWhitelist={["*"]}
          />
        )}
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  webViewContainer: {
    flex: 1
  },
  webView: {
    flex: 1,
    marginBottom: toRN(tokens.spacing[4])
  },
  loadingContainer: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.canvas,
    zIndex: 1
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[6])
  },
  errorTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2])
  },
  errorMessage: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },
  retryButton: {
    minWidth: 120
  }
});
