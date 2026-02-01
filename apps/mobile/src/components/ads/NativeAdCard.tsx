/**
 * NativeAdCard Component
 *
 * A native ad component for blog feed that:
 * - Blends with blog post cards for natural UX
 * - Only shows for free users
 * - Waits for AdMob initialization
 * - Handles loading and error states gracefully
 *
 * @example
 * ```tsx
 * <NativeAdCard />
 * ```
 */

import { getAdUnitId } from "@/constants/adUnits";
import { useShowAds } from "@/hooks/useShowAds";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useAdMobStore } from "@/stores/adMobStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useStyles, useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView
} from "react-native-google-mobile-ads";
import { useTranslation } from "@/lib/i18n";

type NativeAdVariant = "default" | "compact" | "horizontal";

interface NativeAdCardProps {
  /** Custom container style */
  style?: any;
  /** Whether to show the "Go Premium" CTA */
  showUpgradeCTA?: boolean;
  /** Variant: "default" for full width, "compact" for grid card size, "horizontal" for list view */
  variant?: NativeAdVariant;
}

export function NativeAdCard({
  style,
  showUpgradeCTA = false,
  variant = "default"
}: NativeAdCardProps) {
  const showAds = useShowAds();
  const isAdMobInitialized = useAdMobStore((state) => state.isInitialized);
  const openModal = useSubscriptionStore((state) => state.openModal);
  const { colors, brandColors } = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();

  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Load native ad
  useEffect(() => {
    if (!showAds || !isAdMobInitialized) return;

    let isMounted = true;

    const loadAd = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const ad = await NativeAd.createForAdRequest(getAdUnitId("BLOG_NATIVE"), {
          requestNonPersonalizedAdsOnly: true
        });

        if (isMounted) {
          setNativeAd(ad);
          setIsLoading(false);
        }
      } catch (error) {
        console.log("[NativeAdCard] Failed to load native ad:", error);
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    loadAd();

    return () => {
      isMounted = false;
      // Clean up the ad when component unmounts
      if (nativeAd) {
        nativeAd.destroy();
      }
    };
  }, [showAds, isAdMobInitialized]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (nativeAd) {
        nativeAd.destroy();
      }
    };
  }, [nativeAd]);

  // Don't render for premium users
  if (!showAds) {
    return null;
  }

  // Don't render until AdMob is initialized
  if (!isAdMobInitialized) {
    return null;
  }

  // Don't render on error (avoid empty space)
  if (hasError) {
    return null;
  }

  const isCompact = variant === "compact";
  const isHorizontal = variant === "horizontal";

  // Show skeleton while loading
  if (isLoading || !nativeAd) {
    if (isCompact) {
      return (
        <View style={[styles.compactContainer, style]}>
          <View style={styles.compactLoadingSkeleton} />
        </View>
      );
    }
    if (isHorizontal) {
      return (
        <View style={[styles.horizontalContainer, style]}>
          <View style={styles.horizontalLoadingImage} />
          <View style={styles.horizontalLoadingContent}>
            <View style={styles.loadingTitle} />
            <View style={styles.loadingBody} />
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <View style={styles.loadingImage} />
        <View style={styles.loadingContent}>
          <View style={styles.loadingTitle} />
          <View style={styles.loadingBody} />
        </View>
      </View>
    );
  }

  // Compact variant - grid card style
  if (isCompact) {
    return (
      <NativeAdView nativeAd={nativeAd} style={[styles.compactContainer, style]}>
        {/* Media as background - must be first child */}
        <NativeMediaView style={styles.compactMediaView} resizeMode="cover" />

        {/* Sponsored badge - inside NativeAdView */}
        <View style={styles.compactSponsoredBadge}>
          <Ionicons name="megaphone-outline" size={8} color={colors.text.tertiary} />
          <Text style={styles.compactSponsoredText}>Ad</Text>
        </View>

        {/* Overlay content at bottom - inside NativeAdView */}
        <View style={styles.compactOverlay}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.compactHeadline} numberOfLines={2}>
              {nativeAd.headline}
            </Text>
          </NativeAsset>
          {nativeAd.callToAction && (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <View style={[styles.compactCta, { backgroundColor: brandColors.primary }]}>
                <Text style={styles.compactCtaText}>{nativeAd.callToAction}</Text>
              </View>
            </NativeAsset>
          )}
        </View>
      </NativeAdView>
    );
  }

  // Horizontal variant - list card style (thumbnail left, content right)
  // Match default structure exactly: outer View (container) > NativeAdView > MediaView direct (no wrapper), content View, badge.
  if (isHorizontal) {
    return (
      <View style={[styles.container, styles.horizontalOuter, style]}>
        <NativeAdView nativeAd={nativeAd} style={styles.horizontalAdView}>
          {/* Media - direct child, same as default (no View wrapper) */}
          <NativeMediaView style={styles.horizontalMediaView} resizeMode="cover" />

          {/* Content on right */}
          <View style={styles.horizontalContent}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.horizontalHeadline} numberOfLines={2}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>

            {nativeAd.advertiser && (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.horizontalAdvertiser} numberOfLines={1}>
                  {nativeAd.advertiser}
                </Text>
              </NativeAsset>
            )}

            {nativeAd.callToAction && (
              <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                <View style={[styles.horizontalCta, { backgroundColor: brandColors.primary }]}>
                  <Text style={styles.horizontalCtaText}>{nativeAd.callToAction}</Text>
                </View>
              </NativeAsset>
            )}
          </View>

          {/* Ad attribution badge - direct child, same as default */}
          <View style={styles.horizontalAdBadge}>
            <Ionicons name="megaphone-outline" size={10} color={colors.text.tertiary} />
            <Text style={styles.horizontalAdBadgeText}>Ad</Text>
          </View>
        </NativeAdView>
      </View>
    );
  }

  // Default variant - full width card
  return (
    <View style={[styles.container, style]}>
      <NativeAdView nativeAd={nativeAd} style={styles.adView}>
        {/* Media/Image */}
        <NativeMediaView style={styles.mediaView} resizeMode="cover" />

        {/* Content */}
        <View style={styles.content}>
          {/* Icon + Headline */}
          <View style={styles.headerRow}>
            {nativeAd.icon && (
              <NativeAsset assetType={NativeAssetType.ICON}>
                <Image
                  source={{ uri: nativeAd.icon.url }}
                  style={styles.iconImage}
                  resizeMode="cover"
                />
              </NativeAsset>
            )}
            <View style={styles.headerText}>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={styles.headline} numberOfLines={2}>
                  {nativeAd.headline}
                </Text>
              </NativeAsset>
              {nativeAd.advertiser && (
                <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                  <Text style={styles.advertiser} numberOfLines={1}>
                    {nativeAd.advertiser}
                  </Text>
                </NativeAsset>
              )}
            </View>
          </View>

          {/* Body */}
          {nativeAd.body && (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.body} numberOfLines={2}>
                {nativeAd.body}
              </Text>
            </NativeAsset>
          )}

          {/* CTA Button */}
          {nativeAd.callToAction && (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <View style={[styles.ctaButton, { backgroundColor: brandColors.primary }]}>
                <Text style={styles.ctaText}>{nativeAd.callToAction}</Text>
              </View>
            </NativeAsset>
          )}
        </View>

        {/* Sponsored badge last so it paints on top; AdMob ad attribution required */}
        <View style={styles.sponsoredBadge}>
          <Ionicons name="megaphone-outline" size={10} color={colors.text.tertiary} />
          <Text style={styles.sponsoredText}>Ad</Text>
        </View>
      </NativeAdView>

      {/* Optional upgrade CTA - outside NativeAdView (not an advertiser asset) */}
      {showUpgradeCTA && (
        <TouchableOpacity
          style={[styles.upgradeCTA, { backgroundColor: `${brandColors.primary}10` }]}
          onPress={openModal}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles" size={12} color={brandColors.primary} />
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
    marginVertical: toRN(tokens.spacing[3]),
    marginHorizontal: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: colors.bg.elevated,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  adView: {
    width: "100%" as const,
    minWidth: toRN(120),
    minHeight: toRN(120),
    overflow: "hidden" as const
  },
  sponsoredBadge: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[2]),
    left: toRN(tokens.spacing[2]),
    zIndex: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(3),
    borderRadius: toRN(tokens.borderRadius.sm),
    maxWidth: "90%" as const,
    minHeight: toRN(15),
    minWidth: toRN(15),
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)"
  },
  sponsoredText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  mediaView: {
    width: "100%" as const,
    aspectRatio: 16 / 9,
    minWidth: toRN(120),
    minHeight: toRN(120),
    backgroundColor: colors.bg.subtle
  },
  content: {
    padding: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[2]),
    overflow: "hidden" as const
  },
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2])
  },
  iconImage: {
    width: 40,
    height: 40,
    borderRadius: 8
  },
  headerText: {
    flex: 1,
    gap: 2
  },
  headline: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.3
  },
  advertiser: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  body: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4
  },
  ctaButton: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.lg),
    marginTop: toRN(tokens.spacing[1])
  },
  ctaText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  },
  // Loading state
  loadingContainer: {
    padding: toRN(tokens.spacing[3])
  },
  loadingImage: {
    width: "100%" as const,
    aspectRatio: 16 / 9,
    backgroundColor: colors.bg.subtle,
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  loadingContent: {
    marginTop: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[2])
  },
  loadingTitle: {
    width: "80%" as const,
    height: 16,
    backgroundColor: colors.bg.subtle,
    borderRadius: 4
  },
  loadingBody: {
    width: "60%" as const,
    height: 12,
    backgroundColor: colors.bg.subtle,
    borderRadius: 4
  },
  // Upgrade CTA
  upgradeCTA: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: toRN(tokens.spacing[2]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  upgradeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium
  },

  // Compact variant styles (for grid view)
  compactContainer: {
    borderRadius: toRN(tokens.borderRadius.xl),
    overflow: "hidden" as const,
    height: 180, // Match grid card height
    minWidth: toRN(120),
    minHeight: toRN(120),
    position: "relative" as const,
    width: "100%" as const
  },
  compactMediaView: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    minWidth: toRN(120),
    minHeight: toRN(120),
    backgroundColor: colors.bg.subtle
  },
  compactSponsoredBadge: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[2]),
    left: toRN(tokens.spacing[2]),
    zIndex: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 2,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(3), // Minimum 15px height: icon (8px) + padding (3px top + 3px bottom) = 14px, but minHeight ensures 15px
    borderRadius: toRN(tokens.borderRadius.sm),
    maxWidth: "90%" as const,
    minHeight: toRN(15), // AdMob requirement: minimum 15px
    minWidth: toRN(15) // AdMob requirement: minimum 15px
  },
  compactSponsoredText: {
    fontSize: 9,
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  compactOverlay: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: toRN(tokens.spacing[2]),
    paddingTop: toRN(tokens.spacing[6]),
    background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
    backgroundColor: "rgba(0,0,0,0.6)",
    overflow: "hidden" as const,
    maxWidth: "100%" as const
  },
  compactHeadline: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF",
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.3,
    marginBottom: toRN(tokens.spacing[1])
  },
  compactCta: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.md)
  },
  compactCtaText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  },
  compactLoadingSkeleton: {
    flex: 1,
    backgroundColor: colors.bg.subtle,
    borderRadius: toRN(tokens.borderRadius.xl)
  },

  // Horizontal variant - same structure as default: container > NativeAdView > MediaView direct, content, badge
  horizontalOuter: {
    marginVertical: toRN(tokens.spacing[2])
  },
  horizontalContainer: {
    flexDirection: "row" as const,
    marginVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: colors.bg.elevated,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    minWidth: toRN(120),
    minHeight: toRN(120),
    width: "100%" as const
  },
  horizontalAdView: {
    flexDirection: "row" as const,
    width: "100%" as const,
    minWidth: toRN(120),
    minHeight: toRN(120),
    overflow: "hidden" as const,
    position: "relative" as const
  },
  horizontalMediaView: {
    width: 120,
    height: 120,
    minWidth: toRN(120),
    minHeight: toRN(120),
    backgroundColor: colors.bg.subtle,
    borderTopLeftRadius: toRN(tokens.borderRadius.xl),
    borderBottomLeftRadius: toRN(tokens.borderRadius.xl)
  },
  horizontalAdBadge: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[2]),
    left: toRN(tokens.spacing[2]),
    zIndex: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(3),
    borderRadius: toRN(tokens.borderRadius.sm),
    maxWidth: "90%" as const,
    minHeight: toRN(15),
    minWidth: toRN(15)
  },
  horizontalAdBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  horizontalContent: {
    flex: 1,
    padding: toRN(tokens.spacing[3]),
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1]),
    overflow: "hidden" as const
  },
  horizontalHeadline: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.3
  },
  horizontalAdvertiser: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  horizontalCta: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.md),
    marginTop: toRN(tokens.spacing[1])
  },
  horizontalCtaText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  },
  horizontalLoadingImage: {
    width: 120,
    height: 120,
    backgroundColor: colors.bg.subtle,
    borderTopLeftRadius: toRN(tokens.borderRadius.xl),
    borderBottomLeftRadius: toRN(tokens.borderRadius.xl)
  },
  horizontalLoadingContent: {
    flex: 1,
    padding: toRN(tokens.spacing[3]),
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2])
  }
});

export default NativeAdCard;
