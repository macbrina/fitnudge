import React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes";
import { tokens } from "@/themes/tokens";
import { CARD_PADDING_VALUES } from "@/constants/general";

export function AchievementsSkeleton() {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const cardPadding = CARD_PADDING_VALUES.SM;

  return (
    <View style={styles.container}>
      <BackButton title={t("achievements.title")} onPress={() => router.back()} />

      {/* Segmented Control Skeleton */}
      <View style={styles.tabContainer}>
        <SkeletonBox width="100%" height={40} borderRadius={20} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <SkeletonBox width={80} height={64} borderRadius={8} />
          <SkeletonBox width={140} height={20} borderRadius={6} style={{ marginTop: 8 }} />
        </View>

        {/* Featured Badges - Podium style (^) */}
        <View style={styles.featuredSection}>
          <View style={styles.featuredBadges}>
            {/* Left badge - lower */}
            <View style={[styles.featuredItem, styles.featuredItemSide]}>
              <SkeletonBox width={64} height={64} borderRadius={16} />
              <SkeletonBox width={60} height={14} borderRadius={4} style={{ marginTop: 8 }} />
              <SkeletonBox width={40} height={12} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            {/* Center badge (larger, elevated) */}
            <View style={[styles.featuredItem, styles.featuredItemCenter]}>
              <SkeletonBox width={88} height={88} borderRadius={22} />
              <SkeletonBox width={70} height={14} borderRadius={4} style={{ marginTop: 8 }} />
              <SkeletonBox width={40} height={12} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            {/* Right badge - lower */}
            <View style={[styles.featuredItem, styles.featuredItemSide]}>
              <SkeletonBox width={64} height={64} borderRadius={16} />
              <SkeletonBox width={60} height={14} borderRadius={4} style={{ marginTop: 8 }} />
              <SkeletonBox width={40} height={12} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
          </View>
        </View>

        {/* Section Title */}
        <SkeletonBox width={140} height={20} borderRadius={6} style={{ marginBottom: 16 }} />

        {/* Achievement List Items */}
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonBox
            key={i}
            width="100%"
            height={75}
            borderRadius={toRN(tokens.borderRadius.xl)}
            inner
            innerPadding={cardPadding}
            style={styles.achievementCard}
          >
            <View style={styles.achievementContent}>
              <SkeletonBox width={44} height={44} borderRadius={12} />
              <View style={styles.achievementInfo}>
                <SkeletonBox width="60%" height={16} borderRadius={6} />
                <SkeletonBox width="80%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
              </View>
              <SkeletonBox width={32} height={32} borderRadius={16} />
            </View>
          </SkeletonBox>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brandColors: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  tabContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3])
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },

  // Hero Section
  heroSection: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[6])
  },

  // Featured Section - Podium style (^)
  featuredSection: {
    marginBottom: toRN(tokens.spacing[6])
  },
  featuredBadges: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3])
  },
  featuredItem: {
    alignItems: "center" as const,
    width: 100
  },
  // Side items pushed down for ^ effect
  featuredItemSide: {
    marginTop: toRN(tokens.spacing[8])
  },
  // Center item stays at top (elevated)
  featuredItemCenter: {
    marginTop: 0
  },

  // Achievement Card
  achievementCard: {
    marginBottom: toRN(tokens.spacing[2])
  },
  achievementContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[1])
  },
  achievementInfo: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3])
  }
});

export default AchievementsSkeleton;
