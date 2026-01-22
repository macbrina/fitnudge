/**
 * AdBanner Component
 *
 * A reusable banner ad component that:
 * - Only shows for free users (premium users never see ads)
 * - Uses test IDs in development, production IDs in production
 * - Optionally shows a "Go Premium" CTA to encourage upgrades
 * - Handles ad loading errors gracefully
 *
 * @example
 * ```tsx
 * <AdBanner unitId="HOME_BANNER" />
 * <AdBanner unitId="GOAL_DETAIL_BANNER" showUpgradeCTA={false} />
 * ```
 */

import { AdUnitKey, getAdUnitId } from "@/constants/adUnits";
import { useShowAds } from "@/hooks/useShowAds";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useAdMobStore } from "@/stores/adMobStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { BannerAd, BannerAdSize, useForeground } from "react-native-google-mobile-ads";

type BannerAdUnitKey = Exclude<AdUnitKey, "BLOG_NATIVE" | "REWARDED">;

interface AdBannerProps {
  /** The ad unit key - determines which ad to show */
  unitId: BannerAdUnitKey;
  /** Ad size - defaults to BANNER (320x50) which fits with padding */
  size?: BannerAdSize;
  /** Whether to show the "Go Premium" CTA below the ad */
  showUpgradeCTA?: boolean;
  /** Custom container style */
  style?: any;
}

export function AdBanner({
  unitId,
  size = BannerAdSize.BANNER, // 320x50 - fits within padded container
  showUpgradeCTA = true,
  style
}: AdBannerProps) {
  const showAds = useShowAds();
  const isAdMobInitialized = useAdMobStore((state) => state.isInitialized);
  const openModal = useSubscriptionStore((state) => state.openModal);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);

  const bannerRef = useRef<BannerAd>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // iOS: WKWebView can terminate if app is in "suspended state", resulting in empty banner.
  // Reload the ad when app returns to foreground.
  useForeground(() => {
    if (Platform.OS === "ios" && isAdMobInitialized) {
      bannerRef.current?.load();
    }
  });

  const handleAdLoaded = useCallback(() => {
    setIsLoaded(true);
    setHasError(false);
  }, []);

  const handleAdError = useCallback((error: Error) => {
    console.log("[AdBanner] Ad failed to load:", error.message);
    setHasError(true);
    setIsLoaded(false);
  }, []);

  // Don't render anything for premium users
  if (!showAds) {
    return null;
  }

  // Don't render until AdMob SDK is initialized
  if (!isAdMobInitialized) {
    return null;
  }

  // Don't render if ad failed to load (avoid empty space)
  if (hasError) {
    return null;
  }

  return (
    <View style={[styles.container, !isLoaded && styles.containerLoading, style]}>
      {/* Constrained wrapper to add horizontal padding like other apps */}
      <View style={styles.bannerWrapper}>
        <BannerAd
          ref={bannerRef}
          unitId={getAdUnitId(unitId)}
          size={size}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true
          }}
          onAdLoaded={handleAdLoaded}
          onAdFailedToLoad={handleAdError}
        />
      </View>

      {isLoaded && showUpgradeCTA && (
        <TouchableOpacity
          style={[styles.upgradeCTA, { backgroundColor: `${brandColors.primary}10` }]}
          onPress={openModal}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles" size={14} color={brandColors.primary} />
          <Text style={[styles.upgradeText, { color: brandColors.primary }]}>
            {t("ads.remove_ads") || "Go Premium to remove ads"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    alignItems: "center" as const,
    marginVertical: toRN(tokens.spacing[4])
  },
  bannerWrapper: {
    borderRadius: toRN(tokens.borderRadius.lg),
    overflow: "hidden" as const
  },
  containerLoading: {
    minHeight: 50 // Reserve space while loading
  },
  upgradeCTA: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    borderRadius: toRN(tokens.borderRadius.full),
    marginTop: toRN(tokens.spacing[2])
  },
  upgradeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium
  }
});

export default AdBanner;
