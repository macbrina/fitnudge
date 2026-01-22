import React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";

export function PartnerDetailSkeleton() {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <BackButton
        title={t("partners.partner_details") || "Partner Details"}
        onPress={() => router.back()}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Section Skeleton */}
        <View style={styles.profileSection}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <SkeletonBox width={90} height={90} borderRadius={45} />
          </View>
          {/* Username */}
          <SkeletonBox
            width={100}
            height={14}
            borderRadius={7}
            style={{ marginTop: 12, alignSelf: "center" }}
          />
          {/* Name */}
          <SkeletonBox
            width={160}
            height={22}
            borderRadius={8}
            style={{ marginTop: 8, alignSelf: "center" }}
          />
          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <SkeletonBox width={120} height={36} borderRadius={8} />
            <SkeletonBox width={140} height={36} borderRadius={8} />
          </View>
          {/* Secondary Actions */}
          <View style={styles.secondaryActionsRow}>
            <SkeletonBox width={60} height={16} borderRadius={6} />
            <SkeletonBox width={60} height={16} borderRadius={6} />
          </View>
        </View>

        {/* Stats Grid Skeleton */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <SkeletonBox width={40} height={28} borderRadius={6} />
            <SkeletonBox width={80} height={12} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
          <View style={styles.statCard}>
            <SkeletonBox width={50} height={28} borderRadius={6} />
            <SkeletonBox width={70} height={12} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
          <View style={styles.statCard}>
            <SkeletonBox width={36} height={28} borderRadius={6} />
            <SkeletonBox width={90} height={12} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
        </View>

        {/* Goals Section Skeleton */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SkeletonBox width={100} height={18} borderRadius={6} />
            <SkeletonBox width={24} height={24} borderRadius={12} />
          </View>
          <View style={styles.goalsList}>
            {/* Goal Card Skeletons */}
            {[1, 2].map((i) => (
              <View key={i} style={styles.goalCard}>
                <View style={styles.goalCardHeader}>
                  <SkeletonBox width={32} height={32} borderRadius={16} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <SkeletonBox width="70%" height={16} borderRadius={6} />
                    <SkeletonBox
                      width="50%"
                      height={12}
                      borderRadius={4}
                      style={{ marginTop: 6 }}
                    />
                  </View>
                  <SkeletonBox width={24} height={24} borderRadius={12} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brandColors: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },

  // Profile Section
  profileSection: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[6])
  },
  avatarWrapper: {
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  actionButtonsRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[4])
  },
  secondaryActionsRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[6]),
    marginTop: toRN(tokens.spacing[3])
  },

  // Stats Grid
  statsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[5])
  },
  statCard: {
    flex: 1,
    minWidth: "30%" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
    justifyContent: "center" as const
  },

  // Goals Section
  section: {
    marginBottom: toRN(tokens.spacing[5])
  },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  goalsList: {
    gap: toRN(tokens.spacing[3])
  },
  goalCard: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4])
  },
  goalCardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  }
});

export default PartnerDetailSkeleton;
