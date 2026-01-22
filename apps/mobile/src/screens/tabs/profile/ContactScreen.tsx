import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Linking,
  TouchableOpacity,
  Modal as RNModal,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useExternalUrls } from "@/hooks/api/useAppConfig";
import { MOBILE_ROUTES } from "@/lib/routes";

export default function ContactScreen() {
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const externalUrls = useExternalUrls();

  // Feature suggestions modal state
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const handleEmailPress = () => {
    Linking.openURL(externalUrls.contact);
  };

  const handleChatPress = () => {
    router.push(MOBILE_ROUTES.PROFILE.LIVE_CHAT as any);
  };

  const handleFeatureSuggestionsPress = () => {
    setShowSuggestionsModal(true);
    setIsLoading(true);
    setHasError(false);
  };

  const handleCloseModal = () => {
    setShowSuggestionsModal(false);
    setIsLoading(true);
    setHasError(false);
  };

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  const handleShouldStartLoad = useCallback((event: WebViewNavigation) => {
    const { url } = event;

    // Allow internal WebView URLs

    const internalSchemes = ["about:", "blob:", "data:", "javascript:"];
    if (internalSchemes.some((scheme) => url.startsWith(scheme))) {
      return true;
    }

    // Allow Tally.so URLs
    if (url.includes("tally.so")) {
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
      <BackButton title={t("profile.contact_us") || "Contact Us"} onPress={() => router.back()} />

      <View style={styles.content}>
        <Text style={styles.description}>
          {t("contact.description") || "Have questions or feedback? We'd love to hear from you!"}
        </Text>

        <Card style={styles.menuCard}>
          {/* Email Option */}
          <TouchableOpacity style={styles.menuItem} onPress={handleEmailPress} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: `${brandColors.primary}15` }]}>
              <Ionicons name="mail-outline" size={22} color={brandColors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{t("contact.send_email") || "Send us an Email"}</Text>
              <Text style={styles.menuDescription}>
                {t("contact.send_email_desc") || "We typically respond within 24 hours"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Live Chat Option */}
          <TouchableOpacity style={styles.menuItem} onPress={handleChatPress} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: `${colors.feedback.success}15` }]}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.feedback.success} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{t("contact.live_chat") || "Chat with Us"}</Text>
              <Text style={styles.menuDescription}>
                {t("contact.live_chat_desc") || "Get instant support from our team"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Feature Suggestions Option */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleFeatureSuggestionsPress}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${colors.feedback.warning}15` }]}>
              <Ionicons name="bulb-outline" size={22} color={colors.feedback.warning} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>
                {t("contact.feature_suggestions") || "Suggest a Feature"}
              </Text>
              <Text style={styles.menuDescription}>
                {t("contact.feature_suggestions_desc") || "Help us build what you need"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        </Card>
      </View>

      {/* Full-screen Feature Suggestions Modal */}
      <RNModal
        visible={showSuggestionsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t("contact.feature_suggestions") || "Suggest a Feature"}
            </Text>
            <TouchableOpacity onPress={handleCloseModal} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* WebView Container */}
          <View style={styles.webViewContainer}>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={brandColors.primary} />
              </View>
            )}

            {hasError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>
                  {t("contact.form_error_title") || "Unable to load form"}
                </Text>
                <Text style={styles.errorMessage}>
                  {t("contact.form_error_message") ||
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
                source={{ uri: externalUrls.tallyFeedback }}
                style={styles.webView}
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={handleLoadEnd}
                onError={handleError}
                onHttpError={handleError}
                onShouldStartLoadWithRequest={handleShouldStartLoad}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                allowsInlineMediaPlayback
              />
            )}
          </View>
        </SafeAreaView>
      </RNModal>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  content: {
    flex: 1,
    padding: toRN(tokens.spacing[4])
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[6]),
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5
  },
  menuCard: {
    padding: 0,
    overflow: "hidden" as const
  },
  menuItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4])
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  menuContent: {
    flex: 1
  },
  menuLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  menuDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 60
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  modalHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  modalTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    flex: 1
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const
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
