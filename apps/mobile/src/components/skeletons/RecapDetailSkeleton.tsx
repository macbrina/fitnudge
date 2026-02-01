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

export function RecapDetailSkeleton() {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const cardPadding = CARD_PADDING_VALUES.SM;

  return (
    <View style={styles.container}>
      <BackButton
        title={t("recaps.detail_title") || "Weekly Recap"}
        onPress={() => router.back()}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Week Header */}
        <View style={styles.weekHeader}>
          <SkeletonBox width={180} height={20} borderRadius={8} />
          <SkeletonBox width={60} height={16} borderRadius={6} style={{ marginTop: 8 }} />
        </View>

        {/* Summary Card */}
        <SkeletonBox
          width="100%"
          height={232}
          borderRadius={toRN(tokens.borderRadius.xl)}
          inner
          innerPadding={cardPadding}
          style={styles.summaryCard}
        >
          {/* Completion Rate Circle */}
          <View style={styles.rateSection}>
            <SkeletonBox width={100} height={100} borderRadius={50} />
            <SkeletonBox width={100} height={14} borderRadius={6} style={{ marginTop: 12 }} />
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <SkeletonBox width={36} height={24} borderRadius={6} />
              <SkeletonBox width={60} height={12} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
            <View style={styles.statItem}>
              <SkeletonBox width={36} height={24} borderRadius={6} />
              <SkeletonBox width={50} height={12} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
            <View style={styles.statItem}>
              <SkeletonBox width={36} height={24} borderRadius={6} />
              <SkeletonBox width={70} height={12} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          </View>
        </SkeletonBox>

        {/* AI Summary */}
        <SkeletonBox
          width="100%"
          height={120}
          borderRadius={toRN(tokens.borderRadius.xl)}
          inner
          innerPadding={cardPadding}
          style={styles.card}
        >
          <View style={{ padding: toRN(tokens.spacing[2]) }}>
            <SkeletonBox width={100} height={16} borderRadius={6} style={{ marginBottom: 12 }} />
            <SkeletonBox width="100%" height={14} borderRadius={4} />
            <SkeletonBox width="90%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
            <SkeletonBox width="75%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        </SkeletonBox>

        {/* Goals Breakdown Section */}
        <View style={styles.section}>
          <SkeletonBox width={120} height={18} borderRadius={6} style={{ marginBottom: 12 }} />
          {[1, 2].map((i) => (
            <SkeletonBox
              key={i}
              width="100%"
              height={72}
              borderRadius={toRN(tokens.borderRadius.xl)}
              inner
              innerPadding={cardPadding}
              style={styles.goalCard}
            >
              <View style={styles.goalHeader}>
                <SkeletonBox width={24} height={24} borderRadius={12} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <SkeletonBox width="70%" height={16} borderRadius={6} />
                  <SkeletonBox width="40%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
                </View>
                <SkeletonBox width={50} height={20} borderRadius={10} />
              </View>
            </SkeletonBox>
          ))}
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <SkeletonBox width={140} height={18} borderRadius={6} style={{ marginBottom: 12 }} />
          <SkeletonBox
            width="100%"
            height={100}
            borderRadius={toRN(tokens.borderRadius.xl)}
            inner
            innerPadding={cardPadding}
          >
            <View style={styles.achievementRow}>
              {[1, 2].map((i) => (
                <View key={i} style={styles.achievementItem}>
                  <SkeletonBox width={48} height={48} borderRadius={24} />
                  <SkeletonBox width={60} height={12} borderRadius={4} style={{ marginTop: 8 }} />
                </View>
              ))}
            </View>
          </SkeletonBox>
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
  weekHeader: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  summaryCard: {
    marginBottom: toRN(tokens.spacing[4]),
    alignItems: "center" as const
  },
  rateSection: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[2])
  },
  statsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    width: "100%",
    paddingTop: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  statItem: {
    alignItems: "center" as const
  },
  card: {
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  section: {
    marginBottom: toRN(tokens.spacing[4])
  },
  goalCard: {
    marginBottom: toRN(tokens.spacing[3])
  },
  goalHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[2])
  },
  achievementRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[2])
  },
  achievementItem: {
    alignItems: "center" as const
  }
});

export default RecapDetailSkeleton;
