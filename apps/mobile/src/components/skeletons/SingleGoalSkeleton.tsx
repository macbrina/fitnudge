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

export function SingleGoalSkeleton() {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const cardPadding = CARD_PADDING_VALUES.SM;

  return (
    <View style={styles.container}>
      <BackButton title="" onPress={() => router.back()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Goal Info Card - matches SingleGoalScreen infoCard structure */}
        <SkeletonBox
          width="100%"
          height={200}
          borderRadius={toRN(tokens.borderRadius.xl)}
          inner
          innerPadding={cardPadding}
          style={styles.infoCard}
        >
          {/* Title + description stacked vertically */}
          <View style={styles.goalInfo}>
            <SkeletonBox
              width="50%"
              height={22}
              borderRadius={8}
              style={{ marginBottom: toRN(tokens.spacing[1]) }}
            />
            <SkeletonBox width="40%" height={22} borderRadius={6} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <SkeletonBox width={20} height={20} borderRadius={10} />
              <SkeletonBox width={32} height={20} borderRadius={6} />
              <SkeletonBox width={48} height={12} borderRadius={4} />
            </View>
            <View style={styles.statItem}>
              <SkeletonBox width={20} height={20} borderRadius={10} />
              <SkeletonBox width={40} height={20} borderRadius={6} />
              <SkeletonBox width={36} height={12} borderRadius={4} />
            </View>
            <View style={styles.statItem}>
              <SkeletonBox width={20} height={20} borderRadius={10} />
              <SkeletonBox width={28} height={20} borderRadius={6} />
              <SkeletonBox width={56} height={12} borderRadius={4} />
            </View>
          </View>
        </SkeletonBox>

        {/* Schedule Card - matches SingleGoalScreen scheduleCard (column layout) */}
        <SkeletonBox
          width="100%"
          height={130}
          borderRadius={toRN(tokens.borderRadius.xl)}
          inner
          innerPadding={cardPadding}
          style={styles.scheduleCard}
        >
          <View style={styles.scheduleRow}>
            <View style={styles.scheduleItem}>
              <SkeletonBox width={36} height={36} borderRadius={18} />
              <View style={styles.scheduleContent}>
                <SkeletonBox width={80} height={12} borderRadius={4} />
                <SkeletonBox width={120} height={16} borderRadius={6} />
              </View>
            </View>
            <View style={styles.scheduleItem}>
              <SkeletonBox width={36} height={36} borderRadius={18} />
              <View style={styles.scheduleContent}>
                <SkeletonBox width={70} height={12} borderRadius={4} />
                <SkeletonBox width={80} height={16} borderRadius={6} />
              </View>
            </View>
          </View>
        </SkeletonBox>

        {/* Check-in Button */}
        <SkeletonBox
          width="100%"
          height={48}
          borderRadius={12}
          style={{ marginBottom: toRN(tokens.spacing[4]) }}
        />

        {/* Pattern Insights - before Recent Check-ins, matches SingleGoalScreen order */}
        <SkeletonBox
          width="100%"
          height={120}
          borderRadius={toRN(tokens.borderRadius.xl)}
          inner
          innerPadding={cardPadding}
          style={styles.insightsCard}
        >
          <View style={styles.insightsHeader}>
            <SkeletonBox width={100} height={18} borderRadius={6} />
          </View>
          <View style={styles.insightRow}>
            <SkeletonBox width={24} height={24} borderRadius={12} />
            <View style={{ flex: 1, marginLeft: toRN(tokens.spacing[3]) }}>
              <SkeletonBox width="90%" height={14} borderRadius={4} />
              <SkeletonBox
                width="70%"
                height={12}
                borderRadius={4}
                style={{ marginTop: toRN(tokens.spacing[1]) }}
              />
            </View>
          </View>
        </SkeletonBox>

        {/* Recent Check-ins - matches SingleGoalScreen historyCard */}
        <SkeletonBox
          width="100%"
          height={230}
          borderRadius={toRN(tokens.borderRadius.xl)}
          inner
          innerPadding={cardPadding}
          style={styles.historyCard}
        >
          <View style={styles.historyHeader}>
            <View style={styles.historyHeaderTitle}>
              <SkeletonBox width="100%" height={18} borderRadius={6} />
            </View>
            <SkeletonBox width={60} height={14} borderRadius={4} />
          </View>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.checkInItem}>
              <SkeletonBox
                width={20}
                height={20}
                borderRadius={10}
                style={{ marginRight: toRN(tokens.spacing[3]) }}
              />
              <View style={styles.checkInInfo}>
                <SkeletonBox width="45%" height={14} borderRadius={4} />
                <SkeletonBox
                  width="30%"
                  height={12}
                  borderRadius={4}
                  style={{ marginTop: toRN(tokens.spacing[1]) }}
                />
              </View>
            </View>
          ))}
        </SkeletonBox>
      </ScrollView>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },
  infoCard: {
    marginBottom: toRN(tokens.spacing[4])
  },
  goalInfo: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3]),
    justifyContent: "space-between" as const,
    marginTop: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  statsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    paddingTop: toRN(tokens.spacing[4])
  },
  statItem: {
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1])
  },
  scheduleCard: {
    marginBottom: toRN(tokens.spacing[4])
  },
  scheduleRow: {
    flexDirection: "column" as const,
    gap: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[2])
  },
  scheduleItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3])
  },
  scheduleContent: {
    flex: 1,
    gap: toRN(tokens.spacing[1])
  },
  historyCard: {},
  insightsCard: {
    marginBottom: toRN(tokens.spacing[4])
  },
  insightsHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  historyHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  historyHeaderTitle: {
    flex: 1,
    marginRight: toRN(tokens.spacing[2])
  },
  checkInItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[2])
  },
  checkInInfo: {
    flex: 1
  },
  insightRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    paddingHorizontal: toRN(tokens.spacing[2])
  }
});

export default SingleGoalSkeleton;
