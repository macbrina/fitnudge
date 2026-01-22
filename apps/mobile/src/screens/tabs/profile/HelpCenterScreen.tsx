import React, { useState, useCallback, useRef } from "react";
import { View, ActivityIndicator, Linking, Text } from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useRouter } from "expo-router";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { BackButton } from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { useExternalUrls } from "@/hooks/api/useAppConfig";

export default function HelpCenterScreen() {
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { brandColors, colors } = useTheme();
  const { t } = useTranslation();
  const externalUrls = useExternalUrls();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Handle WebView errors
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Retry loading
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

    // Allow the help center URL and its subpages
    const helpCenterDomain = new URL(externalUrls.helpCenter).hostname;
    if (url.includes(helpCenterDomain)) {
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
      <BackButton title={t("profile.help_center") || "Help Center"} onPress={() => router.back()} />

      <View style={styles.webViewContainer}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={brandColors.primary} />
          </View>
        )}

        {hasError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>
              {t("profile.help_center_error_title") || "Unable to load Help Center"}
            </Text>
            <Text style={styles.errorMessage}>
              {t("profile.help_center_error_message") ||
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
            source={{ uri: externalUrls.helpCenter }}
            style={styles.webView}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={handleError}
            onHttpError={handleError}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
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
    flex: 1
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
